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

  private beActive = false;

  onFetchResolveMap: Map<string, (((res: Response) => void) | null)[]> = new Map();

  constructor(scope: ServiceWorkerGlobalScope) {
    this.scope = scope;

    // Service worker listeners can only be added on the initial evaluation.
    this.scope.addEventListener('fetch', (event) => {
      if (!this.beActive) return;

      if (!this.onFetchResolveMap.has(event.clientId)) return;

      event.respondWith(this.onFetch(event));
    });
    this.scope.addEventListener('message', (event) => {
      if (!this.beActive) return;
      this.onMessage(event);
    });
  }

  /**
   * For captured requests, message back to the client.
   */
  onFetch = async (event: FetchEvent): Promise<Response> => {
    const client = await this.scope.clients.get(event.clientId);
    if (!client) {
      throw new Error('No client matched');
    }
    const onFetchResolveList = this.onFetchResolveMap.get(event.clientId);
    if (!onFetchResolveList) {
      throw new Error('Client not registered');
    }
    client.postMessage({
      request: await toCloneable(event.request),
      onfetch: onFetchResolveList.length,
    });
    return new Promise<Response>((resolve) => {
      onFetchResolveList.push(resolve);
    });
  };

  onMessage = (event: ExtendableMessageEvent): void => {
    if (!event.data || !('onfetch' in event.data)) return;

    if (event.data && 'request' in event.data) {
      // eslint-disable-next-line no-void
      void this.onRequestMessage(event);
    }
    if (event.data && 'response' in event.data) {
      // eslint-disable-next-line no-void
      void this.onResponseMessage(event);
    }
    if (event.data && 'status' in event.data) {
      // eslint-disable-next-line no-void
      void this.onStatusMessage(event);
    }
  };

  /**
   * For messaged requests, respond with real responses.
   */
  onRequestMessage = async (
    event: Omit<ExtendableMessageEvent, 'data'> & { data: RequestMessage },
  ): Promise<void> => {
    const { source, data: { request, onfetch } } = event;
    if (!source) {
      throw new Error('Request came from unknown source');
    }
    source.postMessage({
      response: await toCloneable(await this.scope.fetch(request.url, request)),
      onfetch,
    });
  };

  /**
   * For messaged responses, treat as a previous captured request's response.
   */
  onResponseMessage = async (
    event: Omit<ExtendableMessageEvent, 'data'> & { data: ResponseMessage },
  ): Promise<void> => {
    const { source, data: { response, onfetch } } = event;
    if (!(source instanceof Client)) {
      throw new Error('Response came from unknown source');
    }
    const onFetchResolveList = this.onFetchResolveMap.get(source.id);
    if (!onFetchResolveList) {
      throw new Error('Response came from unregistered source');
    }
    const resolve = onFetchResolveList[onfetch];
    if (!resolve) {
      throw new Error('Response came for unknown request');
    }
    resolve(new Response(response.body, response));
    onFetchResolveList[onfetch] = null;
  };

  onStatusMessage = async (
    event: Omit<ExtendableMessageEvent, 'data'> & { data: StatusMessage },
  ): Promise<void> => {
    const { source, data: { status } } = event;
    if (!(source instanceof Client)) {
      throw new Error('Status came from unknown source');
    }
    switch (status) {
      case 'on': {
        this.onFetchResolveMap.set(source.id, []);
        break;
      }
      case 'off': {
        this.onFetchResolveMap.delete(source.id);
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
