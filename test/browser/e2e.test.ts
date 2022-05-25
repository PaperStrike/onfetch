import { iframeTest, registerServiceWorker } from './helpers.js';
import { expect } from '../index.js';
import onfetch from '../../src/index.js';

const test = iframeTest.extend({
  // Switch onfetch context for e2e iframe tests.
  iframe: async ({ iframe }, use) => {
    const { contentWindow } = iframe;

    // Use frame service worker.
    const wasActive = onfetch.isActive();
    await onfetch.restore();
    await onfetch.useServiceWorker(contentWindow.navigator.serviceWorker);

    await use(iframe);

    // Use original.
    await onfetch.useServiceWorker();
    if (wasActive) {
      await onfetch.activate();
    }
  },
});

test.describe('browser e2e', () => {
  test.beforeAll(async () => {
    await onfetch.useServiceWorker();
  });
  test.afterAll(async () => {
    await onfetch.useDefault();
  });

  test('await service worker registration', async ({ assets, iframe: { contentWindow } }) => {
    // Call activate before register.
    const activation = onfetch.activate();
    await registerServiceWorker(contentWindow, assets.sw);

    // Check activation.
    await expect(activation).resolves.not.toThrow();

    // Check mock functionality.
    onfetch(assets.status).reply('mocked');
    const response = await contentWindow.fetch(assets.status);
    await expect(response.text()).resolves.toBe('mocked');
  });

  test('follow service worker controller changes', async ({ assets, iframe: { contentWindow } }) => {
    await registerServiceWorker(contentWindow, assets.sw);
    await onfetch.activate();

    // Change controller.
    await registerServiceWorker(contentWindow, assets.noopSW);
    await registerServiceWorker(contentWindow, assets.sw);

    // Check inactivated and re-activate.
    expect(onfetch.isActive()).toBe(false);
    await onfetch.activate();

    // Check mock functionality.
    onfetch(assets.status).reply('mocked');
    const response = await contentWindow.fetch(assets.status);
    await expect(response.text()).resolves.toBe('mocked');
  });
});
