import { test as base } from '../index.js';

export interface ConnectedIframe extends HTMLIFrameElement {
  contentDocument: Document;
  contentWindow: WindowProxy;
}

export const registerServiceWorker = async (
  targetWindow: WindowProxy,
  scriptURL = navigator.serviceWorker.controller?.scriptURL || '',
  options: RegistrationOptions = { scope: './' },
) => {
  await targetWindow.navigator.serviceWorker.register(scriptURL, options);
  await new Promise((resolve) => {
    targetWindow.navigator.serviceWorker.addEventListener('controllerchange', resolve);
  });
};

/**
 * Test with an empty iframe that has no service worker.
 */
export const iframeTest = base.extend<{ iframe: ConnectedIframe }>({
  iframe: async ({ assets }, use) => {
    // Unregister service worker to avoid the frame inherit it.
    const registration = await navigator.serviceWorker.getRegistration();
    const scriptURL = registration?.active?.scriptURL;
    await registration?.unregister();

    // Create a connected frame element.
    const iframe = document.createElement('iframe') as ConnectedIframe;
    await new Promise((resolve) => {
      iframe.src = assets.blankDoc;
      iframe.addEventListener('load', resolve);
      document.body.append(iframe);
    });

    await use(iframe);

    // Unregister frame service workers to avoid pollution.
    await Promise.all(
      (await iframe.contentWindow.navigator.serviceWorker.getRegistrations())
        .map((frameRegistration) => (
          frameRegistration.unregister()
        )),
    );

    // Remove the frame element.
    iframe.remove();

    // Re-register service worker back.
    if (scriptURL) {
      await navigator.serviceWorker.register(scriptURL);
    }
  },
});
