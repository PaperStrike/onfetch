import mockFetchOn, { MSWInterceptors, Channel, Onfetch } from './core';

export * from './core';
export { mockFetchOn };

const swSupported = typeof window !== 'undefined' && !!window?.navigator?.serviceWorker;
const isInNode = typeof process !== 'undefined' && process?.release?.name === 'node';

let channel: Channel;
let mswInterceptors: MSWInterceptors;

let libRestore = () => {};

const onfetch: Onfetch & {
  useServiceWorker(): void;
  useMSWInterceptors(): void;
  useAutoAdvanced(): void;
  useDefault(): void;
} = Object.assign(
  mockFetchOn(globalThis),
  {
    useServiceWorker() {
      if (!channel) {
        if (!swSupported) {
          throw new Error('Environment not compatible with service worker mode');
        }
        channel = new Channel(window.navigator.serviceWorker);
      }
      libRestore();
      channel.activate();
      libRestore = channel.restore.bind(channel);

      onfetch.adopt(channel);
      onfetch.config({
        bypassRedirect: true,
      });
    },

    useMSWInterceptors() {
      if (!mswInterceptors) {
        if (!isInNode) {
          throw new Error('Environment not compatible with msw interceptor mode');
        }
        mswInterceptors = new MSWInterceptors();
      }
      libRestore();
      mswInterceptors.activate();
      libRestore = mswInterceptors.restore.bind(mswInterceptors);

      onfetch.adopt(mswInterceptors);
      onfetch.config({
        bypassRedirect: true,
      });
    },

    useAutoAdvanced() {
      if (swSupported) {
        this.useServiceWorker();
      } else if (isInNode) {
        this.useMSWInterceptors();
      } else {
        throw new Error('Environment not compatible with any advanced mode');
      }
    },

    useDefault() {
      libRestore();

      onfetch.adopt(globalThis);
      onfetch.config({
        bypassRedirect: false,
      });
    },
  },
);

onfetch.activate();

export default onfetch;
