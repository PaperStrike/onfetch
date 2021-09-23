/// <reference lib="WebWorker" />
import toCloneable from './toCloneable';
import { StatusMessage, RequestMessage, ResponseMessage } from './Message';

/**
 * A fetch forwarder
 * - For captured requests, message back to client.
 * - For messaged requests, message back the real response.
 */
export default class Worker {
  scope: ServiceWorkerGlobalScope;

  portMap: Map<string, MessagePort> = new Map();

  resolveListMap: Map<MessagePort, (((res: Response) => void) | null)[]> = new Map();

  private beActive = false;

  constructor(scope: ServiceWorkerGlobalScope) {
    this.scope = scope;

    // Service worker listeners can only be added on the initial evaluation.
    scope.addEventListener('fetch', this.onFetch);

    // For clients' port registration.
    scope.addEventListener('message', (event) => {
      if (!this.beActive) return;

      if (!event.data || !('onfetch' in event.data)) return;

      const { source } = event;
      if (!(source instanceof Client)) return;
      if (this.portMap.has(source.id)) return;

      const [port] = event.ports;
      this.portMap.set(source.id, port);
      port.onmessage = this.onMessage;
    });
  }

  /**
   * For captured requests, message back to the client.
   */
  onFetch = (event: FetchEvent): void => {
    if (!this.beActive) return;

    const port = this.portMap.get(event.clientId);
    if (!port) return;

    const resolveList = this.resolveListMap.get(port);
    if (!resolveList) return;

    event.respondWith((async () => {
      port.postMessage({
        request: await toCloneable(event.request),
        index: resolveList.length,
      });
      return new Promise<Response>((resolve) => {
        resolveList.push(resolve);
      });
    })());
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
    if ('status' in event.data) {
      // eslint-disable-next-line no-void
      void this.onStatusMessage(event);
    }
  };

  /**
   * For messaged requests, respond with real responses.
   */
  onRequestMessage = async (
    event: MessageEvent<RequestMessage>,
  ): Promise<void> => {
    const { target, data: { request, index } } = event;
    if (!(target instanceof MessagePort) || !this.resolveListMap.has(target)) {
      throw new Error('Request came from unrecognized source');
    }
    target.postMessage({
      response: await toCloneable(await this.scope.fetch(request.url, request)),
      index,
    });
  };

  /**
   * For messaged responses, treat as a previous captured request's response.
   */
  onResponseMessage = async (
    event: MessageEvent<ResponseMessage>,
  ): Promise<void> => {
    const { target, data: { response, index } } = event;
    if (!(target instanceof MessagePort)) {
      throw new Error('Request came from unknown source');
    }
    const resolveList = this.resolveListMap.get(target);
    if (!resolveList) {
      throw new Error('Response came from unregistered source');
    }
    const resolve = resolveList[index];
    if (!resolve) {
      throw new Error('Response came for unknown request');
    }
    resolve(new Response(response.body, response));
    resolveList[index] = null;
  };

  onStatusMessage = async (
    event: MessageEvent<StatusMessage>,
  ): Promise<void> => {
    const { target, data: { status } } = event;
    if (!(target instanceof MessagePort)) {
      throw new Error('Request came from unknown source');
    }
    switch (status) {
      case 'on': {
        this.resolveListMap.set(target, []);
        break;
      }
      case 'off': {
        this.resolveListMap.delete(target);
        break;
      }
      default: {
        throw new Error('Unknown message status');
      }
    }
  };

  isActive(): boolean {
    return this.beActive;
  }

  /**
   * Stop capturing requests and receiving messages.
   */
  deactivate(): void {
    this.beActive = false;
  }

  /**
   * Start capturing requests and receiving messages.
   */
  activate(): void {
    this.beActive = true;
  }
}
