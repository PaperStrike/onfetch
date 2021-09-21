import toCloneable from './toCloneable';
import { RequestMessage, ResponseMessage } from './Message';

/**
 * A fetch receiver
 * - For received requests, message to service worker.
 * - For messaged requests, send to the receiver. <- Intercept here.
 */
export default class Client {
  workerContainer: ServiceWorkerContainer;

  fetchResolveList: (((res: Response) => void) | null)[] = [];

  constructor(workerContainer: ServiceWorkerContainer) {
    this.workerContainer = workerContainer;
  }

  /**
   * For received requests, message to the service worker.
   */
  fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const { controller } = this.workerContainer;
    if (!controller) {
      throw new Error('No active service worker found');
    }
    controller.postMessage({
      request: await toCloneable(new Request(...args)),
      onfetch: this.fetchResolveList.length,
    });
    return new Promise<Response>((resolve) => {
      this.fetchResolveList.push(resolve);
    });
  };

  onMessage = (event: MessageEvent<RequestMessage | ResponseMessage>): void => {
    if (event.data && 'request' in event.data) {
      // eslint-disable-next-line no-void
      void this.onRequestMessage(event as MessageEvent<RequestMessage>);
    }
    if (event.data && 'response' in event.data) {
      // eslint-disable-next-line no-void
      void this.onResponseMessage(event as MessageEvent<ResponseMessage>);
    }
  };

  /**
   * For messaged requests, send to the receiver.
   */
  onRequestMessage = async (
    event: MessageEvent<RequestMessage>,
  ): Promise<void> => {
    const { source, data: { request, onfetch } } = event;
    if (!source) {
      throw new Error('Request came from unknown source');
    }
    source.postMessage({
      response: await toCloneable(await this.fetch(request.url, request)),
      onfetch,
    });
  };

  /**
   * For messaged responses, treat as a previous received request's response.
   */
  onResponseMessage = async (
    event: MessageEvent<ResponseMessage>,
  ): Promise<void> => {
    const { data: { response, onfetch } } = event;
    const resolve = this.fetchResolveList[onfetch];
    if (!resolve) {
      throw new Error('Response came for unknown request');
    }
    resolve(new Response(response.body, response));
    this.fetchResolveList[onfetch] = null;
  };

  unregisterController = (): void => {
    this.workerContainer.controller?.postMessage({ onfetch: -1, status: 'off' });
  };

  registerController = (): void => {
    this.workerContainer.controller?.postMessage({ onfetch: -1, status: 'on' });
  };

  private addedListeners = false;

  isActive(): boolean {
    return this.addedListeners;
  }

  /**
   * Stop receiving worker messages.
   */
  deactivate(): void {
    this.unregisterController();
    this.workerContainer.removeEventListener('controllerchange', this.registerController);
    this.workerContainer.removeEventListener('message', this.onMessage);
    this.addedListeners = false;
  }

  /**
   * Start receiving worker messages.
   */
  activate(): void {
    this.registerController();
    this.workerContainer.addEventListener('controllerchange', this.registerController);
    this.workerContainer.addEventListener('message', this.onMessage);
    this.addedListeners = true;
  }
}
