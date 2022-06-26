import type * as wrightplay from 'wrightplay';

export default class WPRoute {
  constructor(
    private readonly wp: typeof wrightplay,
  ) {}

  fetch: typeof fetch = (...args) => this.wp.bypassFetch(...args);

  readonly handler: wrightplay.RouteHandlerCallback = async (route, routeRequest) => {
    const headers = routeRequest.allHeaders();
    const requestInit: RequestInit = {
      method: routeRequest.method(),
      body: routeRequest.postDataBlob(),
      headers,
      referrer: headers.referer,
    };
    const response = await this.fetch(new Request(routeRequest.url(), requestInit));
    await route.fulfill({ response });
  };

  async activate() {
    await this.wp.pageRoute('', this.handler);
  }

  async restore() {
    await this.wp.pageUnroute('', this.handler);
  }
}
