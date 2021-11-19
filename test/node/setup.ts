import http from 'http';
import type { AddressInfo } from 'net';
import sirv from 'sirv';

import fetch, { Headers, Request, Response } from 'node-fetch';
import 'error-cause/auto';

let baseURL: string;

// Polyfills for Node environment.
// Setup before await the server.
Object.assign(globalThis, {
  fetch: new Proxy(fetch, {
    apply(target, thisArg, [input, init]: Parameters<typeof fetch>) {
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

export const server = http.createServer(
  sirv(),
);

baseURL = await new Promise<string>((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    const addressInfo = server.address() as AddressInfo;
    resolve(`http://${addressInfo.address}:${addressInfo.port}`);
  });
});

// Use const export.
export const serverURL = baseURL;

after(() => {
  server.close();
});
