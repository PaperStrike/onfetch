import nodeMocha from 'mocha';
import { expect } from 'expect';
import fixtureWrap from 'playwright-fixtures';

import * as nodeSetup from './node/setup.js';

const serverURL = typeof nodeSetup !== 'undefined'
  ? nodeSetup.serverURL
  : globalThis.location.href;

const assetURL = new URL('/test/fixture/', serverURL).href;
const resolveAsset = (path: string) => new URL(path, assetURL).href;

const {
  describe,
  it,
  before,
  after,
} = await (async () => {
  if (typeof window === 'undefined') return nodeMocha;

  const { onInit, done } = await import('wrightplay');

  mocha.setup({
    ui: 'bdd',
    reporter: 'spec',
    color: true,
  });

  onInit(() => {
    mocha.run((failures) => {
      done(failures > 0 ? 1 : 0);
    });
  });

  return window;
})();

// Playwright like test runner.
const wrappedTest = fixtureWrap(
  Object.assign(it, {
    describe,
    beforeAll: before,
    afterAll: after,
  }),
);

const baseTest = wrappedTest.extend({
  assets: {
    status: resolveAsset('status.txt'),
    blankDoc: resolveAsset('blank.html'),
    noopSW: resolveAsset('noop-service-worker.js'),
    sw: new URL('/sw.js', serverURL).href,
  },
});

export { baseTest as test, expect };
