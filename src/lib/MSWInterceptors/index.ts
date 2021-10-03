import { createInterceptor, Resolver } from '@mswjs/interceptors';
import { interceptClientRequest } from '@mswjs/interceptors/lib/interceptors/ClientRequest';
import { interceptXMLHttpRequest } from '@mswjs/interceptors/lib/interceptors/XMLHttpRequest';

export default class MSWInterceptors {
  private bypassNext = false;

  /**
   * The fetch that bypasses the mock.
   */
  fetch: typeof fetch = (input, init) => {
    const request = new Request(input, init);
    this.bypassNext = true;
    return fetch(request);
  };

  /**
   * The resolver that parses the requests.
   */
  resolver: Resolver = async (isomorphicRequest) => {
    if (this.bypassNext) {
      this.bypassNext = false;
      return undefined;
    }
    const { url, body, ...requestInit } = isomorphicRequest;
    const request = new Request(url.href, {
      ...requestInit,
      body: body || null,
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

  activate(): void {
    this.interceptor.apply();
  }

  restore(): void {
    this.interceptor.restore();
  }
}
