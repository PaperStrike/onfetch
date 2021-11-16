import Fastify from 'fastify';
import { test, expect } from '../../index';
import onfetch, { passThrough } from '../../../src';

const fastify = Fastify();
let fastifyAddress = '';

fastify.get('/server-status', async (request, reply) => {
  await reply.send('ready');
});

test.describe('MSWInterceptors e2e', () => {
  test.beforeAll(async () => {
    await fastify.listen(0).then((address) => {
      fastifyAddress = address;
    });
    await onfetch.useMSWInterceptors();
  });
  test.afterAll(async () => {
    await fastify.close();
    await onfetch.useDefault();
  });

  test.describe('bypass', () => {
    test('basic', async () => {
      onfetch('/server-status').reply(passThrough);

      const bypassRes = await fetch(`${fastifyAddress}/server-status`);
      await expect(bypassRes.text()).resolves.toBe('ready');
    });

    test('parallel', () => Promise.all(
      Array(2).fill(null).map(async () => {
        onfetch('/server-status').reply(passThrough);
        onfetch('/server-status').reply('mocked');

        const [bypassRes, afterRes] = await Promise.all([
          fetch(`${fastifyAddress}/server-status`),
          fetch(`${fastifyAddress}/server-status`),
        ]);
        await Promise.all([
          expect(bypassRes.text()).resolves.toBe('ready'),
          expect(afterRes.text()).resolves.toBe('mocked'),
        ]);
      }),
    ));
  });
});
