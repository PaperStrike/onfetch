import type * as wrightplay from 'wrightplay';

export default class WPRoute {
  constructor(
    private readonly wp: typeof wrightplay,
  ) {}

  fetch: typeof fetch = (...args) => this.wp.bypassFetch(...args);

  readonly handler: wrightplay.RouteHandlerCallback = async (route, routeRequest) => {
    const request = new Request(routeRequest.url(), {
      body: routeRequest.postDataBlob(),
      headers: routeRequest.headersArray().map(({ name, value }) => [name, value]),
    });
    await route.fulfill({
      response: await this.fetch(request),
    });
  };

  async activate() {
    await this.wp.pageRoute('', this.handler);
  }

  async restore() {
    await this.wp.pageUnroute('', this.handler);
  }
}
