import toCloneable from './toCloneable';
import { FulfillList, RequestMessage, ResponseMessage } from './Message';

/**
 * A fetch receiver
 * - For received requests, message to service worker.
 * - For messaged requests, send to the receiver. <- Intercept here.
 */
export default class Channel {
  port?: MessagePort;

  fulfillList?: FulfillList;

  private beActive = false;

  constructor(workerContainer: ServiceWorkerContainer) {
    this.registerController(workerContainer);
    workerContainer.addEventListener('controllerchange', () => {
      this.registerController(workerContainer);
    });
  }

  private registerController = (workerContainer: ServiceWorkerContainer): void => {
    const { controller } = workerContainer;
    if (!controller) return;

    const { port1, port2 } = new MessageChannel();
    port1.onmessage = this.onMessage;

    this.port = port1;
    this.fulfillList = [];
    controller.postMessage({ onfetch: true }, [port2]);

    if (this.beActive) port1.postMessage({ status: 'on' });
  };

  /**
   * For received requests, message to the service worker.
   */
  fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const { port, fulfillList } = this;
    if (!port || !fulfillList) {
      throw new Error('Service worker not ready yet');
    }
    port.postMessage({
      request: await toCloneable(new Request(...args)),
      index: fulfillList.length,
    });
    return new Promise<Response>((resolve, reject) => {
      fulfillList.push([resolve, reject]);
    });
  };

  onMessage = (event: MessageEvent): void => {
    if (!this.beActive || !event.data) return;

    if ('request' in event.data) {
      // eslint-disable-next-line no-void
      void this.onRequestMessage(event);
    }
    if ('response' in event.data) {
      // eslint-disable-next-line no-void
      void this.onResponseMessage(event);
    }
  };

  /**
   * For messaged requests, send to the receiver.
   */
  onRequestMessage = async (
    event: MessageEvent<RequestMessage>,
  ): Promise<void> => {
    const { data: { request, index } } = event;
    const { port } = this;
    if (!port) {
      throw new Error('Service worker not ready yet');
    }
    const responseOrError = await this.fetch(request.url, request).catch((err: Error) => err);
    port.postMessage({
      response: responseOrError instanceof Error
        ? responseOrError
        : await toCloneable(responseOrError),
      index,
    });
  };

  /**
   * For messaged responses, treat as a previous received request's response.
   */
  onResponseMessage = async (
    event: MessageEvent<ResponseMessage>,
  ): Promise<void> => {
    const { data: { response, index } } = event;
    const { fulfillList } = this;
    if (!fulfillList) {
      throw new Error('Service worker not ready yet');
    }
    const fulfill = fulfillList[index];
    if (!fulfill) {
      throw new Error('Response came for unknown request');
    }
    if (response instanceof Error) {
      fulfill[1](response);
    } else {
      fulfill[0](new Response(response.body, response));
    }
    fulfillList[index] = null;
  };

  isActive(): boolean {
    return this.beActive;
  }

  /**
   * Stop receiving worker messages.
   */
  deactivate(): void {
    this.beActive = false;
    this.port?.postMessage({ status: 'off' });
  }

  /**
   * Start receiving worker messages.
   */
  activate(): void {
    this.beActive = true;
    this.port?.postMessage({ status: 'on' });
  }
}
