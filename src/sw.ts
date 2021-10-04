import Worker from './lib/SW/Worker';

declare const globalThis: ServiceWorkerGlobalScope;

const onfetchWorker = new Worker(globalThis);

// eslint-disable-next-line no-void
void onfetchWorker.activate();

export default onfetchWorker;
