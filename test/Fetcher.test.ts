import { expect, test } from './index';
import Fetcher from '../src/Fetcher';

const fetcherTest = test.extend<{ fetcher: Fetcher }>({
  fetcher: async (_, use) => {
    await use(new Fetcher(globalThis));
  },
});

fetcherTest.describe('mocked fetch', () => {
  fetcherTest.describe('signal', () => {
    const abortTest = fetcherTest.extend<{ controller: AbortController }>({
      controller: (_, use) => use(new AbortController()),
    });

    abortTest('already', async ({ fetcher, controller }) => {
      const rule = fetcher.addRule('').reply(() => Promise.race([]));

      controller.abort();
      const fetchPromise = fetcher.mocked('', {
        signal: controller.signal,
      });
      await expect(fetchPromise).rejects.toMatchObject({ name: 'AbortError' });

      // The rule is NOT applied when passing an already aborted signal.
      expect(rule.isActive()).toBeTruthy();
    });

    abortTest('ongoing', async ({ fetcher, controller }) => {
      const rule = fetcher.addRule('').reply(() => Promise.race([]));

      const fetchPromise = fetcher.mocked('', {
        signal: controller.signal,
      });
      controller.abort();
      await expect(fetchPromise).rejects.toMatchObject({ name: 'AbortError' });

      // The rule is applied when passing a signal that is being aborted later.
      expect(rule.isActive()).toBeFalsy();
    });
  });
});
