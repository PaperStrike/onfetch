/// <reference lib="WebWorker" />
import toCloneable from './toCloneable';
import { RequestMessage, ResponseMessage } from './Message';

/**
 * A fetch forwarder
 * - For captured requests, message back to client.
 * - For messaged requests, message back the real response.
 */
export default class Worker {
  scope: ServiceWorkerGlobalScope;

  private beActive = false;

  constructor(scope: ServiceWorkerGlobalScope) {
    this.scope = scope;

    // Service worker listeners can only be added on the initial evaluation.
    this.scope.addEventListener('fetch', (event) => {
      if (!this.beActive) return;
      event.respondWith(this.onFetch(event));
    });
    this.scope.addEventListener('message', (event) => {
      if (!this.beActive) return;
      this.onMessage(event);
    });
  }

  onFetchResolveList: (((res: Response) => void) | null)[] = [];

  /**
   * For captured requests, message back to the client.
   */
  onFetch = async (event: FetchEvent): Promise<Response> => {
    const client = await this.scope.clients.get(event.clientId);
    if (!client) {
      throw new Error('No client matched');
    }
    client.postMessage({
      request: await toCloneable(event.request),
      id: this.onFetchResolveList.length,
    });
    return new Promise<Response>((resolve) => {
      this.onFetchResolveList.push(resolve);
    });
  };

  onMessage = (event: ExtendableMessageEvent): void => {
    if (event.data && 'request' in event.data) {
      // eslint-disable-next-line no-void
      void this.onRequestMessage(event);
    }
    if (event.data && 'response' in event.data) {
      // eslint-disable-next-line no-void
      void this.onResponseMessage(event);
    }
  };

  /**
   * For messaged requests, respond with real responses.
   */
  onRequestMessage = async (
    event: Omit<ExtendableMessageEvent, 'data'> & { data: RequestMessage },
  ): Promise<void> => {
    const { source, data: { request, id } } = event;
    if (!source) {
      throw new Error('Request came from unknown source');
    }
    source.postMessage({
      response: await toCloneable(await this.scope.fetch(request.url, request)),
      id,
    });
  };

  /**
   * For messaged responses, treat as a previous captured request's response.
   */
  onResponseMessage = async (
    event: Omit<ExtendableMessageEvent, 'data'> & { data: ResponseMessage },
  ): Promise<void> => {
    const { data: { response, id } } = event;
    const resolve = this.onFetchResolveList[id];
    if (!resolve) {
      throw new Error('Response came for unknown request');
    }
    resolve(new Response(response.body, response));
    this.onFetchResolveList[id] = null;
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
