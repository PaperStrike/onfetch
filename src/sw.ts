import { Worker } from './core';

declare const globalThis: ServiceWorkerGlobalScope;

const onfetchWorker = new Worker(globalThis);
onfetchWorker.activate();

export default onfetchWorker;
