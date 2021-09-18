import mockFetchOn from './core';

export * from './core';
export { mockFetchOn };

const onfetch = mockFetchOn(globalThis);
onfetch.activate();

export default onfetch;
