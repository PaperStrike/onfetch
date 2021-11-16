import toCloneable from './toCloneable';
import {
  FulfillList,
  StatusMessage,
  RequestMessage,
  ResponseMessage,
  MessageProcessor,
} from './Message';

/**
 * A fetch forwarder
 * - For captured requests, message back to client.
 * - For messaged requests, message back the real response.
 */
export default class Worker extends MessageProcessor {
  scope: ServiceWorkerGlobalScope;

  portMap: Map<string, MessagePort> = new Map();

  fulfillListMap: Map<MessagePort, FulfillList> = new Map();

  constructor(scope: ServiceWorkerGlobalScope) {
    super();

    this.scope = scope;

    // Service worker listeners can only be added on the initial evaluation.
    scope.addEventListener('fetch', this.onFetch.bind(this));

    // For clients' port registration.
    scope.addEventListener('message', (event) => {
      if (!event.data || !('onfetch' in event.data)) return;

      const { source } = event;
      if (!(source instanceof Client)) return;
      if (this.portMap.has(source.id)) return;

      const [port] = event.ports;
      this.portMap.set(source.id, port);
      port.onmessage = this.onMessage.bind(this);
    });
  }

  /**
   * For captured requests, message back to the client.
   */
  onFetch(event: FetchEvent) {
    const port = this.portMap.get(event.clientId);
    if (!port) return;

    const fulfillList = this.fulfillListMap.get(port);
    if (!fulfillList) return;

    event.respondWith((async () => {
      port.postMessage({
        request: await toCloneable(event.request),
        index: fulfillList.length,
      });
      return new Promise<Response>((resolve, reject) => {
        fulfillList.push([resolve, reject]);
      });
    })());
  }

  /**
   * For messaged requests, respond with real responses.
   */
  async onRequestMessage(event: MessageEvent<RequestMessage>) {
    const { target, data: { request, index } } = event;
    if (!(target instanceof MessagePort) || !this.fulfillListMap.has(target)) {
      throw new Error('Request came from unrecognized source');
    }
    const response = await this.scope.fetch(request.url, request).catch((err: Error) => err);
    target.postMessage({
      response: response instanceof Error ? response : await toCloneable(response),
      index,
    });
  }

  /**
   * For messaged responses, treat as a previous captured request's response.
   */
  onResponseMessage(event: MessageEvent<ResponseMessage>) {
    const { target, data: { response, index } } = event;
    if (!(target instanceof MessagePort)) {
      throw new Error('Request came from unknown source');
    }
    const fulfillList = this.fulfillListMap.get(target);
    if (!fulfillList) {
      throw new Error('Response came from unregistered source');
    }
    const fulfill = fulfillList[index];
    if (!fulfill) {
      throw new Error('Response came for unknown request');
    }
    if (response instanceof Error) {
      fulfill[1](response);
    } else {
      // Client response may be of type 'error'.
      const nativeResponse = response.type === 'error'
        ? Response.error()
        : new Response(response.body, response);
      fulfill[0](nativeResponse);
    }
    fulfillList[index] = null;
  }

  statusResolveMap: Map<MessagePort, (() => void) | null> = new Map();

  onStatusMessage(event: MessageEvent<StatusMessage>) {
    const { target, data: { status } } = event;
    if (!(target instanceof MessagePort)) {
      throw new Error('Request came from unknown source');
    }
    if (status === 'on') {
      this.fulfillListMap.set(target, []);
    } else {
      this.fulfillListMap.delete(target);
    }
    const statusResolve = this.statusResolveMap.get(target);
    if (statusResolve) {
      statusResolve();
      this.statusResolveMap.delete(target);
    } else {
      target.postMessage({ status });
    }
  }

  hasActive(): boolean {
    return this.fulfillListMap.size > 0;
  }

  async switchToStatus(status: 'on' | 'off'): Promise<void> {
    const switchPromiseList = [...this.portMap.values()]
      .map((port) => new Promise<void>((resolve) => {
        this.statusResolveMap.set(port, resolve);
        port.postMessage({ status });
      }));
    await Promise.all(switchPromiseList);
  }

  /**
   * Start capturing requests and receiving messages.
   */
  async activate(): Promise<void> {
    return this.switchToStatus('on');
  }

  /**
   * Stop capturing requests and receiving messages.
   */
  async restore(): Promise<void> {
    return this.switchToStatus('off');
  }
}
