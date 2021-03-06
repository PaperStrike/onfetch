import mockFetchOn, { Context, Onfetch, OnfetchCall } from './core.js';
import type MSWInterceptors from './lib/MSWInterceptors/index.js';
import type Channel from './lib/SW/Channel.js';
import type WPRoute from './lib/WPRoute/index.js';

// Export core package
export * from './core.js';
export { mockFetchOn };

// Lib compatibility checks.
const swSupported = typeof window !== 'undefined' && !!window?.navigator?.serviceWorker;
const isInNode = typeof process !== 'undefined' && process?.release?.name === 'node';

// Lib clients. Initialize when needed.
const channelMap = new Map<ServiceWorkerContainer, Channel>();
let mswInterceptors: MSWInterceptors;
let wpRoute: WPRoute;

// Context helpers.
export interface ContextHelpers {
  isActive?(): boolean;
  activate?(): void | Promise<void>;
  restore?(): void | Promise<void>;
}

// Context helpers.
let contextHelpers: ContextHelpers = {};

// Mock globalThis and activate by default.
const fetchMock = mockFetchOn(globalThis);
fetchMock.activate();

const onfetch: OnfetchCall & Omit<Onfetch, keyof ContextHelpers | 'adopt'> & {
  useServiceWorker(serviceWorkerContainer?: ServiceWorkerContainer): Promise<void>;
  useMSWInterceptors(): Promise<void>;
  useWrightplayRoute(): Promise<void>;
  useAutoAdvanced(): Promise<void>;
  useDefault(): Promise<void>;
  isActive(): boolean;
  activate(): Promise<void>;
  restore(): Promise<void>;
  adopt(context: Context, helpers?: ContextHelpers): Promise<void>;
} = Object.assign(
  // Use a copy to avoid overwriting the fetchMock props in runtime.
  fetchMock.bind(fetchMock),
  fetchMock,
  {
    async useServiceWorker(serviceWorkerContainer = navigator.serviceWorker) {
      if (!swSupported) {
        throw new Error('Environment not compatible with service worker mode');
      }
      const channel = await (async () => {
        const existing = channelMap.get(serviceWorkerContainer);
        if (existing) return existing;

        const Channel = (await import('./lib/SW/Channel.js')).default;
        const newChannel = new Channel(serviceWorkerContainer);
        channelMap.set(serviceWorkerContainer, newChannel);
        return newChannel;
      })();

      await this.adopt(channel, channel);

      fetchMock.config({
        bypassRedirect: true,
      });
    },

    async useMSWInterceptors() {
      if (!mswInterceptors) {
        if (!isInNode) {
          throw new Error('Environment not compatible with msw interceptor mode');
        }
        const MSWInterceptors = (await import('./lib/MSWInterceptors/index.js')).default;
        mswInterceptors = new MSWInterceptors();
      }

      await this.adopt(mswInterceptors, mswInterceptors);

      fetchMock.config({
        bypassRedirect: true,
      });
    },

    async useWrightplayRoute() {
      if (!wpRoute) {
        if (isInNode) {
          throw new Error('Environment not compatible with wrightplay route mode');
        }

        // Intended try-catch for downstream bundlers like esbuild to know the package
        // (wrightplay in this case) is not always required when bundling for browsers.
        // Node.js libs don't need this as they can be safely fully excluded by using
        // package browser field.
        try {
          const wp = await import('wrightplay');
          const WPRoute = (await import('./lib/WPRoute/index.js')).default;
          wpRoute = new WPRoute(wp);
        } catch (e) {
          throw new Error('Failed load wrightplay route lib. Have you installed "wrightplay"?', { cause: e as Error });
        }
      }

      await this.adopt(wpRoute, wpRoute);

      fetchMock.config({
        bypassRedirect: false,
      });
    },

    async useAutoAdvanced() {
      if (swSupported) {
        await this.useServiceWorker();
      } else if (isInNode) {
        await this.useMSWInterceptors();
      } else {
        throw new Error('Environment not compatible with any advanced mode');
      }
    },

    async useDefault() {
      await this.adopt(globalThis);

      fetchMock.config({
        bypassRedirect: false,
      });
    },

    isActive() {
      return contextHelpers.isActive?.() ?? fetchMock.isActive();
    },

    async activate() {
      await contextHelpers.activate?.();
      fetchMock.activate();
    },

    async restore() {
      fetchMock.restore();
      await contextHelpers.restore?.();
    },

    async adopt(context: Context, controllers: ContextHelpers = {}) {
      const beActive = this.isActive();
      await contextHelpers.restore?.();
      contextHelpers = controllers;
      if (beActive) await contextHelpers.activate?.();
      fetchMock.adopt(context);
    },
  },
);

export default onfetch;
