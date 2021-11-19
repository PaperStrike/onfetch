import fixtureWrap from 'playwright-fixtures';
import expect from 'expect';

import * as nodeSetup from './node/setup';

const serverURL = typeof nodeSetup !== 'undefined'
  ? nodeSetup.serverURL
  : globalThis.location.href;

const assetURL = new URL('/test/fixture/', serverURL).href;
const resolveAsset = (path: string) => new URL(`${path}.txt`, assetURL).href;

// Playwright like test runner.
const wrappedTest = fixtureWrap(
  Object.assign(it, {
    describe,
    beforeAll: before,
    afterAll: after,
  }),
);

const assetNames = ['status'] as const;

type Assets = Record<typeof assetNames[number], string>;

const baseTest = wrappedTest.extend<{ assets: Assets }>({
  assets: Object.fromEntries(
    assetNames.map((name) => [name, resolveAsset(name)]),
  ) as Assets,
});

export { baseTest as test, expect };
