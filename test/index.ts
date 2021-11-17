import fixtureWrap from 'playwright-fixtures';
import expect from 'expect';
import * as nodeFetch from 'node-fetch';
import 'error-cause/auto';

// Polyfills for Node environment.
if (typeof fetch === 'undefined' && typeof nodeFetch !== 'undefined') {
  const { Request, Headers, Response } = nodeFetch;
  const baseURL = 'https://localhost/';
  Object.assign(globalThis, {
    fetch: new Proxy(nodeFetch.default, {
      apply(target, thisArg, [input, init]: Parameters<typeof nodeFetch.default>) {
        if (typeof input === 'string') {
          return target(new URL(input, baseURL).href, init);
        }
        return target(input, init);
      },
    }),
    Headers,
    Request: new Proxy(Request, {
      construct(Target, [input, init]: ConstructorParameters<typeof Request>) {
        if (typeof input === 'string') {
          return new Target(new URL(input, baseURL).href, init);
        }
        return new Target(input, init);
      },
    }),
    Response: new Proxy(Response, {
      get(Target, key: keyof typeof Response) {
        if (key !== 'redirect') return Target[key];
        return new Proxy(Target[key], {
          apply(target, thisArg, [url, status]: Parameters<typeof Target['redirect']>) {
            return target.apply(thisArg, [new URL(url, baseURL).href, status]);
          },
        });
      },
    }),
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
