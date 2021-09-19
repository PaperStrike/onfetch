/// <reference lib="WebWorker" />
import mockFetchOn from './core';
import Client from './lib/sw/Client';
import Worker from './lib/sw/Worker';

export * from './core';
export { mockFetchOn, Client, Worker };

declare const globalThis: ServiceWorkerGlobalScope | typeof window;

const isInServiceWorker = (
  typeof ServiceWorkerGlobalScope !== 'undefined' && globalThis instanceof ServiceWorkerGlobalScope
);

export const client = isInServiceWorker ? null : new Client(window.navigator.serviceWorker);
client?.activate();

export const worker = isInServiceWorker ? new Worker(globalThis) : null;
worker?.activate();

/**
 * The fetch mocker.
 * Service worker can mock its fetch, too.
 */
const onfetch = mockFetchOn(client || globalThis);

// Activate client mock by default.
if (!isInServiceWorker) {
  onfetch.activate();
}

export default onfetch;
