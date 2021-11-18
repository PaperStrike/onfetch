import toCloneable from './toCloneable';
import {
  FulfillList,
  StatusMessage,
  RequestMessage,
  ResponseMessage,
  MessageProcessor,
} from './Message';

/**
 * A fetch receiver
 * - For received requests, message to service worker.
 * - For messaged requests, send to the receiver. <- Intercept here.
 */
export default class Channel extends MessageProcessor {
  port!: Promise<MessagePort>;

  fulfillList!: FulfillList;

  private beActive = false;

  constructor(workerContainer: ServiceWorkerContainer) {
    super();

    this.registerContainer(workerContainer);
  }

  private registerContainer(workerContainer: ServiceWorkerContainer) {
    this.fulfillList = [];
    this.port = this.preparePort(workerContainer)
      .finally(() => {
        workerContainer.addEventListener('controllerchange', () => {
          this.registerContainer(workerContainer);
          this.port
            .then(() => (this.beActive ? this.activate() : this.restore()))
            .catch(() => {});
        }, { once: true });
      });
  }

  async preparePort(workerContainer: ServiceWorkerContainer) {
    const controller = (await workerContainer.ready).active;
    if (!controller) {
      return new Promise<MessagePort>((resolve) => {
        workerContainer.addEventListener('controllerchange', () => {
          resolve(this.preparePort(workerContainer));
        }, { once: true });
      });
    }

    const { port1, port2 } = new MessageChannel();
    port1.onmessage = this.onMessage.bind(this);
    controller.postMessage({ onfetch: true }, [port2]);

    return port1;
  }

  /**
   * For received requests, message to the service worker.
   */
  fetch: typeof fetch = async (...args) => {
    const { fulfillList } = this;
    const port = await this.port;
    port.postMessage({
      request: await toCloneable(new Request(...args)),
      index: fulfillList.length,
    });
    return new Promise<Response>((resolve, reject) => {
      fulfillList.push([resolve, reject]);
    });
  };

  /**
   * For messaged requests, send to the receiver.
   */
  async onRequestMessage(event: MessageEvent<RequestMessage>) {
    const { data: { request, index } } = event;
    const port = await this.port;
    const responseOrError = await this.fetch(request.url, request)
      .then((response) => toCloneable(response))
      .catch((err: Error) => err);
    port.postMessage({
      response: responseOrError,
      index,
    });
  }

  /**
   * For messaged responses, treat as a previous received request's response.
   */
  onResponseMessage(event: MessageEvent<ResponseMessage>) {
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
  }

  // Resolve when the service worker responds.
  statusResolve: (() => void) | null = null;

  async onStatusMessage(event: MessageEvent<StatusMessage>) {
    const { data: { status } } = event;
    const port = await this.port;
    this.beActive = status === 'on';
    const { statusResolve } = this;
    if (statusResolve) {
      statusResolve();
      this.statusResolve = null;
    } else {
      port.postMessage({ status });
    }
  }

  isActive() {
    return this.beActive;
  }

  async switchToStatus(status: 'on' | 'off') {
    const port = await this.port;
    await new Promise<void>((resolve) => {
      this.statusResolve = resolve;
      port.postMessage({ status });
    });
  }
}
