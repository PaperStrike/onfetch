import fixtureWrap from 'playwright-fixtures';
import expect from 'expect';
import * as nodeFetch from 'node-fetch';

// Polyfills for Node environment.
if (typeof fetch === 'undefined' && typeof nodeFetch !== 'undefined') {
  const { Request, Headers, Response } = nodeFetch;
  const baseURL = 'https://localhost/';
  Object.assign(globalThis, {
    fetch: nodeFetch.default,
    Request: new Proxy(Request, {
      construct(Target, [input, init]: ConstructorParameters<typeof Request>) {
        if (typeof input === 'string') {
          return new Target(new URL(input, baseURL).href, init);
        }
        return new Target(input, init);
      },
    }),
    Headers,
    Response,
  });
}

// Playwright like test runner.
const test = fixtureWrap(
  Object.assign(it, {
    describe,
    beforeAll: before,
    afterAll: after,
  }),
);

export { test, expect };
