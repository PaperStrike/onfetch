import mockFetchOn from './core';

const onfetch = mockFetchOn(globalThis);
onfetch.activate();

export * from './core';
export default onfetch;
