import toCloneable from './toCloneable';
import { RequestMessage, ResponseMessage } from './Message';

/**
 * A fetch receiver
 * - For received requests, message to service worker.
 * - For messaged requests, send to the receiver. <- Intercept here.
 */
export default class Client {
  workerContainer: ServiceWorkerContainer;

  announceReady = (): void => {
    const { controller } = this.workerContainer;
    if (controller) controller.postMessage({});
  };

  constructor(workerContainer: ServiceWorkerContainer) {
    this.workerContainer = workerContainer;

    this.announceReady();
    workerContainer.addEventListener('controllerchange', this.announceReady);
  }

  fetchResolveList: (((res: Response) => void) | null)[] = [];

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
      id: this.fetchResolveList.length,
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
    const { source, data: { request, id } } = event;
    if (!source) {
      throw new Error('Request came from unknown source');
    }
    source.postMessage({
      response: await toCloneable(await this.fetch(request.url, request)),
      id,
    });
  };

  /**
   * For messaged responses, treat as a previous received request's response.
   */
  onResponseMessage = async (
    event: MessageEvent<ResponseMessage>,
  ): Promise<void> => {
    const { data: { response, id } } = event;
    const resolve = this.fetchResolveList[id];
    if (!resolve) {
      throw new Error('Response came for unknown request');
    }
    resolve(new Response(response.body, response));
    this.fetchResolveList[id] = null;
  };

  private addedListeners = false;

  isActive(): boolean {
    return this.addedListeners;
  }

  /**
   * Stop receiving worker messages.
   */
  deactivate(): void {
    this.workerContainer.removeEventListener('message', this.onMessage);
    this.addedListeners = false;
  }

  /**
   * Start receiving worker messages.
   */
  activate(): void {
    this.workerContainer.addEventListener('message', this.onMessage);
    this.addedListeners = true;
  }
}
