/// <reference lib="WebWorker" />
import { Worker } from './core';

declare const globalThis: ServiceWorkerGlobalScope;

export const onfetchWorker = new Worker(globalThis);
onfetchWorker.activate();

export default onfetchWorker;
