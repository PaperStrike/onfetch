import mockFetchOn, { Client, Onfetch } from './core';

export * from './core';
export { mockFetchOn };

let client: Client;

const onfetch: Onfetch & {
  useServiceWorker(): void;
  useDefault(): void;
} = Object.assign(
  mockFetchOn(globalThis),
  {
    useServiceWorker() {
      if (!client) client = new Client(window.navigator.serviceWorker);
      client.activate();
      onfetch.adopt(client);
      onfetch.config({
        bypassRedirect: true,
      });
    },
    useDefault() {
      if (client) client.deactivate();
      onfetch.adopt(globalThis);
      onfetch.config({
        bypassRedirect: false,
      });
    },
  },
);
onfetch.activate();

export default onfetch;
