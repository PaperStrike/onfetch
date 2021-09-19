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

  constructor(scope: ServiceWorkerGlobalScope) {
    this.scope = scope;
  }

  onFetchResolveList: (((res: Response) => void) | null)[] = [];

  onFetch = (event: FetchEvent): void => {
    const respondPromise = (async () => {
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
    })();
    event.respondWith(respondPromise);
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

  private addedListeners = false;

  isActive(): boolean {
    return this.addedListeners;
  }

  deactivate(): void {
    this.scope.removeEventListener('fetch', this.onFetch);
    this.scope.removeEventListener('message', this.onMessage);
    this.addedListeners = false;
  }

  activate(): void {
    this.scope.addEventListener('fetch', this.onFetch);
    this.scope.addEventListener('message', this.onMessage);
    this.addedListeners = true;
  }
}
