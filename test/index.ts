import fixtureWrap from 'playwright-fixtures';
import { expect } from 'expect';

import * as nodeSetup from './node/setup.js';

const serverURL = typeof nodeSetup !== 'undefined'
  ? nodeSetup.serverURL
  : globalThis.location.href;

const assetURL = new URL('/test/fixture/', serverURL).href;
const resolveAsset = (path: string) => new URL(path, assetURL).href;

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
    sw: new URL('./sw-out.js', serverURL).href,
  },
});

export { baseTest as test, expect };
