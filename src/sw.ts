import Worker from './lib/SW/Worker';

declare const globalThis: ServiceWorkerGlobalScope;

// Require immediate effects.
globalThis.addEventListener('install', (event) => {
  event.waitUntil(globalThis.skipWaiting());
});
globalThis.addEventListener('activate', (event) => {
  event.waitUntil(globalThis.clients.claim());
});

const onfetchWorker = new Worker(globalThis);

// eslint-disable-next-line no-void
void onfetchWorker.activate();

export default onfetchWorker;
