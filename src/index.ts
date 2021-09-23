import mockFetchOn, { Channel, Onfetch } from './core';

export * from './core';
export { mockFetchOn };

const channel = typeof window !== 'undefined' && window?.navigator?.serviceWorker
  ? new Channel(window.navigator.serviceWorker)
  : null;

const onfetch: Onfetch & {
  useServiceWorker(): void;
  useDefault(): void;
} = Object.assign(
  mockFetchOn(globalThis),
  {
    useServiceWorker() {
      if (!channel) {
        throw new Error('Environment not compatible with service worker mode');
      }
      channel.activate();
      onfetch.adopt(channel);
      onfetch.config({
        bypassRedirect: true,
      });
    },
    useDefault() {
      if (channel) channel.deactivate();
      onfetch.adopt(globalThis);
      onfetch.config({
        bypassRedirect: false,
      });
    },
  },
);
onfetch.activate();

export default onfetch;
