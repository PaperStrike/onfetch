import {
  pageRoute,
  pageUnroute,
  bypassFetch,
  RouteHandlerCallback,
} from 'wrightplay';

export default class WPRoute {
  // eslint-disable-next-line class-methods-use-this
  fetch: typeof fetch = (...args) => bypassFetch(...args);

  readonly handler: RouteHandlerCallback = async (route, routeRequest) => {
    const request = new Request(routeRequest.url(), {
      body: routeRequest.postDataBlob(),
      headers: routeRequest.headersArray().map(({ name, value }) => [name, value]),
    });
    await route.fulfill({
      response: await this.fetch(request),
    });
  };

  async activate() {
    await pageRoute('', this.handler);
  }

  async restore() {
    await pageUnroute('', this.handler);
  }
}
