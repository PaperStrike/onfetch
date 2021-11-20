import { test, expect } from '..';
import onfetch from '../../src';

/**
 * This test suite is broken as unregister() take effects only after a reload.
 * TODO Fix this. Some possible solutions:
 *  1. Unregister immediately when it supports. See [A way to immediately unregister a service worker · Issue #614 · w3c/ServiceWorker](https://github.com/w3c/ServiceWorker/issues/614).
 *  2. Investigate using an iframe.
 */
test.describe('browser e2e', () => {
  test.beforeAll(async () => {
    await onfetch.useServiceWorker();
  });
  test.afterAll(async () => {
    await onfetch.useDefault();
  });

  test('await service worker registration', async () => {
    // Get the current service worker script URL.
    const registration = await navigator.serviceWorker.getRegistration();
    const scriptURL = registration?.active?.scriptURL;
    if (!scriptURL) {
      throw new Error('failed to parse service worker script URL');
    }

    // Call activate after unregistered, and then register.
    await onfetch.restore();
    await registration.unregister();
    const activation = onfetch.activate();
    await navigator.serviceWorker.register(scriptURL);

    // Check activation.
    await expect(activation).resolves.not.toThrow();
    onfetch('/mock').reply('mocked');
    await expect(fetch('/mock').then((res) => res.text())).resolves.toBe('mocked');
  });
});
