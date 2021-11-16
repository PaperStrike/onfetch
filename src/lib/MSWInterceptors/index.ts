import { createInterceptor, Resolver } from '@mswjs/interceptors';
import { interceptClientRequest } from '@mswjs/interceptors/lib/interceptors/ClientRequest';
import { interceptXMLHttpRequest } from '@mswjs/interceptors/lib/interceptors/XMLHttpRequest';

export default class MSWInterceptors {
  private bypassNext = false;

  /**
   * The fetch that bypasses the mock.
   */
  fetch: typeof fetch = (...args) => {
    this.bypassNext = true;
    return fetch(...args);
  };

  /**
   * The resolver that parses the requests.
   */
  resolver: Resolver = async (isomorphicRequest, ref) => {
    if (this.bypassNext) {
      this.bypassNext = false;
      return undefined;
    }

    const request = ref instanceof Request
      ? ref
      : new Request(isomorphicRequest.url.href, {
        ...isomorphicRequest,
        // avoid the invalid '' body in GET/HEAD requests.
        body: isomorphicRequest.body || null,
      });

    const response = await this.fetch(request);
    const { status, statusText, headers } = response;

    return {
      status,
      statusText,
      headers: [...headers]
        .reduce((acc: Record<string, string[]>, [key, value]) => {
          if (acc[key]) {
            acc[key].push(value);
          } else {
            acc[key] = [value];
          }
          return acc;
        }, {}),
      body: await response.text(),
    };
  };

  interceptor = createInterceptor({
    modules: [interceptClientRequest, interceptXMLHttpRequest],
    resolver: this.resolver,
  });

  activate() {
    this.interceptor.apply();
  }

  restore() {
    this.interceptor.restore();
  }
}
