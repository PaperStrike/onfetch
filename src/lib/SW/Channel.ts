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

  private beActive!: boolean;

  constructor(public workerContainer: ServiceWorkerContainer) {
    super();

    this.registerContainer();
  }

  private registerContainer() {
    this.beActive = false;
    this.fulfillList = [];
    this.port = this.preparePort()
      .finally(() => {
        this.workerContainer.addEventListener('controllerchange', () => {
          this.registerContainer();
        }, { once: true });
      });
  }

  async preparePort() {
    const { controller } = this.workerContainer;
    if (!controller) {
      return new Promise<MessagePort>((resolve) => {
        this.workerContainer.addEventListener('controllerchange', () => {
          resolve(this.preparePort());
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
    const { target, data: { request, index } } = event;
    if (!(target instanceof MessagePort)) {
      throw new Error('Request came from unknown source');
    }
    const responseOrError = await this.fetch(request.url, request)
      .then((response) => toCloneable(response))
      .catch((err: Error) => err);
    target.postMessage({
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
    const { target, data: { status } } = event;
    if (!(target instanceof MessagePort)) {
      throw new Error('Status came from unknown source');
    }
    this.beActive = status === 'on';
    const { statusResolve } = this;
    if (statusResolve) {
      statusResolve();
      this.statusResolve = null;
    } else {
      target.postMessage({ status });
    }
  }

  isActive() {
    return this.beActive;
  }

  async switchToStatus(status: 'on' | 'off', targetPort?: MessagePort) {
    const port = targetPort || await this.port;
    await new Promise<void>((resolve) => {
      this.statusResolve = resolve;
      port.postMessage({ status });
    });
  }
}
