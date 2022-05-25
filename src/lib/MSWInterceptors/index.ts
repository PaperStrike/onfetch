import { ClientRequestInterceptor } from '@mswjs/interceptors/lib/interceptors/ClientRequest';
import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/lib/interceptors/XMLHttpRequest';
import { BatchInterceptor } from '@mswjs/interceptors/lib/BatchInterceptor';
import { HttpRequestEventMap } from '@mswjs/interceptors';

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
  resolver: HttpRequestEventMap['request'] = async (mswRequest) => {
    if (this.bypassNext) {
      this.bypassNext = false;
      return;
    }

    const request = new Request(mswRequest.url.href, {
      ...mswRequest,
      // avoid the invalid '' body in GET/HEAD requests.
      body: mswRequest.body || null,
    });

    const response = await this.fetch(request);
    const { status, statusText, headers } = response;

    mswRequest.respondWith({
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
    });
  };

  interceptor = new BatchInterceptor({
    name: 'onfetch',
    interceptors: [new ClientRequestInterceptor(), new XMLHttpRequestInterceptor()],
  });

  constructor() {
    this.interceptor.on('request', this.resolver);
  }

  activate() {
    this.interceptor.apply();
  }

  restore() {
    this.interceptor.dispose();
  }
}
