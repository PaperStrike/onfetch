import { test, expect } from './index.js';
import onfetch, { passThrough } from '../src/index.js';

test.describe('e2e', () => {
  test.beforeAll(async () => {
    await onfetch.useAutoAdvanced();
  });
  test.afterAll(async () => {
    await onfetch.useDefault();
  });

  test('basic', async () => {
    onfetch('/mock').reply('mocked');
    const res = await fetch('/mock');
    await expect(res.text()).resolves.toBe('mocked');
  });

  test('redirect', async () => {
    onfetch('/from').reply(Response.redirect('/to'));
    onfetch('/to').reply('redirected');
    const res = await fetch('/from');
    await expect(res.text()).resolves.toBe('redirected');
  });

  test.describe('bypass', () => {
    test('basic', async ({ assets }) => {
      onfetch(assets.status).reply(passThrough);

      const bypassRes = await fetch(assets.status);
      await expect(bypassRes.text()).resolves.toContain('ready');
    });

    test('parallel', ({ assets }) => Promise.all(
      Array(2).fill(null).map(async () => {
        onfetch(assets.status).reply(passThrough);
        onfetch(assets.status).reply('mocked');

        const [bypassRes, afterRes] = await Promise.all([
          fetch(assets.status),
          fetch(assets.status),
        ]);
        await Promise.all([
          expect(bypassRes.text()).resolves.toContain('ready'),
          expect(afterRes.text()).resolves.toBe('mocked'),
        ]);
      }),
    ));
  });
});
