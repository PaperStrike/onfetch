import Worker from './lib/SW/Worker';

declare const globalThis: ServiceWorkerGlobalScope;

const onfetchWorker = new Worker(globalThis);
onfetchWorker.activate();

export default onfetchWorker;
