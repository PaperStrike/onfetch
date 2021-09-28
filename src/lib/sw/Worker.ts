import toCloneable from './toCloneable';
import {
  FulfillList,
  StatusMessage,
  RequestMessage,
  ResponseMessage,
} from './Message';

/**
 * A fetch forwarder
 * - For captured requests, message back to client.
 * - For messaged requests, message back the real response.
 */
export default class Worker {
  scope: ServiceWorkerGlobalScope;

  portMap: Map<string, MessagePort> = new Map();

  fulfillListMap: Map<MessagePort, FulfillList> = new Map();

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
    if (!(target instanceof MessagePort) || !this.fulfillListMap.has(target)) {
      throw new Error('Request came from unrecognized source');
    }
    const responseOrError = await this.scope.fetch(request.url, request).catch((err: Error) => err);
    target.postMessage({
      response: responseOrError instanceof Error
        ? responseOrError
        : await toCloneable(responseOrError),
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
      fulfill[0](new Response(response.body, response));
    }
    fulfillList[index] = null;
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
        this.fulfillListMap.set(target, []);
        break;
      }
      case 'off': {
        this.fulfillListMap.delete(target);
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
   * Start capturing requests and receiving messages.
   */
  activate(): void {
    this.beActive = true;
  }

  /**
   * Stop capturing requests and receiving messages.
   */
  restore(): void {
    this.beActive = false;
  }
}
