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
  port?: MessagePort;

  fulfillList?: FulfillList;

  private beActive = false;

  constructor(workerContainer: ServiceWorkerContainer) {
    super();

    this.registerController(workerContainer);
    workerContainer.addEventListener('controllerchange', () => {
      this.registerController(workerContainer);
    });
  }

  private registerController(workerContainer: ServiceWorkerContainer) {
    const { controller } = workerContainer;
    if (!controller) return;

    const { port1, port2 } = new MessageChannel();
    port1.onmessage = this.onMessage.bind(this);

    this.port = port1;
    this.fulfillList = [];
    controller.postMessage({ onfetch: true }, [port2]);

    if (this.beActive) port1.postMessage({ status: 'on' });
  }

  /**
   * For received requests, message to the service worker.
   */
  fetch: typeof fetch = async (...args) => {
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

  /**
   * For messaged requests, send to the receiver.
   */
  async onRequestMessage(event: MessageEvent<RequestMessage>) {
    const { data: { request, index } } = event;
    const { port } = this;
    if (!port) {
      throw new Error('Service worker not ready yet');
    }
    const response = await this.fetch(request.url, request).catch((err: Error) => err);
    port.postMessage({
      response: response instanceof Error ? response : await toCloneable(response),
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

  onStatusMessage(event: MessageEvent<StatusMessage>) {
    const { data: { status } } = event;
    const { port } = this;
    if (!port) {
      throw new Error('Service worker not ready yet');
    }
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
    const { port } = this;
    if (!port) return;
    await new Promise<void>((resolve) => {
      this.statusResolve = resolve;
      port.postMessage({ status });
    });
  }

  /**
   * Start receiving worker messages.
   */
  activate() {
    return this.switchToStatus('on');
  }

  /**
   * Stop receiving worker messages.
   */
  restore() {
    return this.switchToStatus('off');
  }
}
