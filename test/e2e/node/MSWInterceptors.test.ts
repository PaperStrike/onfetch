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

  test('direct', async () => {
    onfetch('/server-status').reply(passThrough);
    onfetch('/server-status').reply('mocked');

    const directRes = await fetch(`${fastifyAddress}/server-status`);
    await expect(directRes.text()).resolves.toBe('ready');

    const afterRes = await fetch(`${fastifyAddress}/server-status`);
    await expect(afterRes.text()).resolves.toBe('mocked');
  });
});
