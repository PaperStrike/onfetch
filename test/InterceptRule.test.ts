import { test, expect } from './setup.js';
import InterceptRule, { Reply } from '../src/InterceptRule.js';

test.describe('matching', () => {
  type MatchingFixture = {
    createMatchFor: (
      ...ruleArgs: ConstructorParameters<typeof InterceptRule>
    ) => InterceptRule['test'];
  };
  const matchingTest = test.extend<MatchingFixture>({
    createMatchFor: (_, use) => (
      use((...ruleArgs) => {
        const rule = new InterceptRule(...ruleArgs);
        return rule.test.bind(rule);
      })
    ),
  });

  matchingTest.describe('string', () => {
    matchingTest('basic', async ({ createMatchFor }) => {
      const match = createMatchFor('/string');
      expect(match('/')).toBeFalsy();
      expect(match('/string')).toBeTruthy();
      expect(match('/string?query')).toBeTruthy();
      expect(match('/string#hash')).toBeTruthy();
    });
    matchingTest('with query', async ({ createMatchFor }) => {
      const match = createMatchFor('/string?specify-query');
      expect(match('/string')).toBeFalsy();
      expect(match('/string?other-query')).toBeFalsy();
      expect(match('/string?specify-query')).toBeTruthy();
      expect(match('/string?specify-query#hash')).toBeTruthy();
    });
    matchingTest('with hash', async ({ createMatchFor }) => {
      const match = createMatchFor('/string#specify-hash');
      expect(match('/string')).toBeFalsy();
      expect(match('/string#other-hash')).toBeFalsy();
      expect(match('/string#specify-hash')).toBeTruthy();
      expect(match('/string?query#specify-hash')).toBeTruthy();

      // No query but a hash '#specify-hash?specify-query'
      expect(match('/string#specify-hash?specify-query')).toBeFalsy();
    });
    matchingTest('with both query and hash', async ({ createMatchFor }) => {
      const match = createMatchFor('/string?specify-query#specify-hash');
      expect(match('/string')).toBeFalsy();
      expect(match('/string?specify-query#other-hash')).toBeFalsy();
      expect(match('/string?other-query#specify-hash')).toBeFalsy();
      expect(match('/string?specify-query#specify-hash')).toBeTruthy();
    });
  });

  matchingTest.describe('RequestInit', () => {
    matchingTest('basic', async ({ createMatchFor }) => {
      const match = createMatchFor('', {
        method: 'GET',
      });
      expect(match('', { method: 'POST' })).toBeFalsy();
      expect(match('', { method: 'GET' })).toBeTruthy();
    });
    matchingTest('with headers', async ({ createMatchFor }) => {
      const match = createMatchFor('', {
        method: 'GET',
        headers: {
          'Content-Type': 'text/plain',
        },
      });
      expect(match('', { method: 'GET' })).toBeFalsy();
      expect(match('', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
      })).toBeFalsy();
      expect(match('', {
        cache: 'no-cache',
        method: 'GET',
        headers: {
          Accept: 'text/html',
          'Content-Type': 'text/plain',
        },
      })).toBeTruthy();
    });
  });

  matchingTest.describe('RegExp', () => {
    matchingTest('basic', async ({ createMatchFor }) => {
      const match = createMatchFor(/\.foo$/);
      expect(match('abc.foo')).toBeTruthy();
      expect(match('abc.foo?query')).toBeFalsy();
      expect(match('abc.foo#hash')).toBeFalsy();
    });
    matchingTest('looser', async ({ createMatchFor }) => {
      const match = createMatchFor(/^[^?#]*\.foo([?#]|$)/);
      expect(match('abc.foo')).toBeTruthy();
      expect(match('abc.foo?query')).toBeTruthy();
      expect(match('abc.foo#hash')).toBeTruthy();
      expect(match('abc.fooEnd')).toBeFalsy();
      expect(match('abc?.foo')).toBeFalsy();
    });
  });
});

test.describe('reply', () => {
  type ReplyFixture = {
    replyAs: (replier?: Reply, init?: ResponseInit) => Promise<Response>;
  };
  const replyTest = test.extend<ReplyFixture>({
    replyAs: (_, use) => (
      use((...replyArgs) => {
        const fetcher = () => {
          throw new Error('Fetchers shouldn\'t be used in test cases');
        };
        const rule = new InterceptRule('');
        rule.reply(...replyArgs as Parameters<InterceptRule['reply']>);
        return rule.apply(new Request(''), {
          original: fetcher,
          mocked: fetcher,
        });
      })
    ),
  });

  replyTest('error in callback to be rethrown with `cause`', async ({ replyAs }) => {
    const p = [new Error('normal Error'), 'non-Error'].map(async (error) => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      await expect(replyAs(() => { throw error; }))
        .rejects.toMatchObject({ cause: error });

      // eslint-disable-next-line prefer-promise-reject-errors
      await expect(replyAs(() => Promise.reject(error)))
        .rejects.toMatchObject({ cause: error });
    });
    await expect(Promise.all(p)).resolves.not.toThrow();
  });

  replyTest('promises', async ({ replyAs }) => {
    const response = await replyAs(Promise.resolve(new Response('response')));
    await expect(response.text()).resolves.toBe('response');

    const stringRes = await replyAs(Promise.resolve('string'));
    await expect(stringRes.text()).resolves.toBe('string');

    const nullRes = await replyAs(Promise.resolve(null));
    await expect(nullRes.text()).resolves.toBe('');

    const arrayBufferRes = await replyAs(new Response('array buffer').arrayBuffer());
    await expect(arrayBufferRes.text()).resolves.toBe('array buffer');
  });
});
