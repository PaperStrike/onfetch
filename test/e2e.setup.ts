import onfetch from '../src/index.js';

export const mode = await (async () => {
  await onfetch.restore();
  if (typeof window === 'undefined') {
    return 'msw';
  }
  try {
    await window.navigator.serviceWorker.register('/sw.js');
    return 'sw';
  } catch {
    return 'wp';
  }
})();

export * from '../src/index.js';
export default onfetch;
