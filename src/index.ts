import mockFetchOn from './core';

const onfetch = mockFetchOn(globalThis);

export * from './core';
export default onfetch;
