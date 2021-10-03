import { test, expect } from '..';
import onfetch from '../../src';

test.describe('common e2e', () => {
  test.beforeAll(() => {
    onfetch.useAutoAdvanced();
  });
  test.afterAll(() => {
    onfetch.useDefault();
  });

  test('basic', async () => {
    onfetch('/mock').reply('ready');
    const res = await fetch('/mock');
    await expect(res.text()).resolves.toBe('ready');
  });

  test('redirect', async () => {
    onfetch('/from').reply(Response.redirect('/to'));
    onfetch('/to').reply('redirected');
    const res = await fetch('/from');
    await expect(res.text()).resolves.toBe('redirected');
  });
});
