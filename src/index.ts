import mockFetchOn, { Context, Onfetch, OnfetchCall } from './core';
import type MSWInterceptors from './lib/MSWInterceptors';
import type Channel from './lib/SW/Channel';

// Export core package
export * from './core';
export { mockFetchOn };

// Lib compatibility checks.
const swSupported = typeof window !== 'undefined' && !!window?.navigator?.serviceWorker;
const isInNode = typeof process !== 'undefined' && process?.release?.name === 'node';

// Lib clients. Initialize when needed.
let channel: Channel;
let mswInterceptors: MSWInterceptors;

// Lib controllers.
let libIsActive: (() => boolean) | undefined;
let libActivate: (() => void | Promise<void>) | undefined;
let libRestore: (() => void | Promise<void>) | undefined;

// Mock globalThis and activate by default.
const fetchMock = mockFetchOn(globalThis);
fetchMock.activate();

export interface ContextControllers {
  isActive?: () => boolean;
  activate?: () => void | Promise<void>;
  restore?: () => void | Promise<void>;
}

const onfetch: OnfetchCall & Omit<Onfetch, keyof ContextControllers | 'adopt'> & {
  useServiceWorker(): Promise<void>;
  useMSWInterceptors(): Promise<void>;
  useAutoAdvanced(): Promise<void>;
  useDefault(): Promise<void>;
  isActive(): boolean;
  activate(): Promise<void>;
  restore(): Promise<void>;
  adopt(context: Context, helpers?: ContextControllers): Promise<void>;
} = Object.assign(
  // Use a copy to avoid overwriting the fetchMock props in runtime.
  fetchMock.bind(fetchMock),
  fetchMock,
  {
    async useServiceWorker() {
      if (!channel) {
        if (!swSupported) {
          throw new Error('Environment not compatible with service worker mode');
        }
        const Channel = (await import('./lib/SW/Channel')).default;
        channel = new Channel(window.navigator.serviceWorker);
      }

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
        const MSWInterceptors = (await import('./lib/MSWInterceptors')).default;
        mswInterceptors = new MSWInterceptors();
      }

      await this.adopt(mswInterceptors, mswInterceptors);

      fetchMock.config({
        bypassRedirect: true,
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
      return libIsActive ? libIsActive() : fetchMock.isActive.call(fetchMock);
    },

    async activate() {
      await libActivate?.();
      fetchMock.activate();
    },

    async restore() {
      fetchMock.restore();
      await libRestore?.();
    },

    async adopt(context: Context, controllers: ContextControllers = {}) {
      const { isActive, activate, restore } = controllers;
      const wasActive = this.isActive();
      await libRestore?.();
      libIsActive = isActive;
      libActivate = activate;
      libRestore = restore;
      fetchMock.adopt(context);
      if (wasActive) await activate?.();
    },
  },
);

export default onfetch;
