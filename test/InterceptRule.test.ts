import { test, expect } from '.';
import InterceptRule from '../src/InterceptRule';

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
    replyAs: (
      ...replyArgs: Parameters<InterceptRule['reply']>
    ) => () => Promise<Response>;
  };
  const replyTest = test.extend<ReplyFixture>({
    replyAs: (_, use) => (
      use((...replyArgs) => {
        const fetcher = () => {
          throw new Error('Fetchers shouldn\'t be used in test cases');
        };
        const rule = new InterceptRule('');
        rule.reply(...replyArgs);
        return () => (
          rule.apply(new Request(''), {
            original: fetcher,
            mocked: fetcher,
          })
        );
      })
    ),
  });

  replyTest('all error in callback to be Error', async ({ replyAs }) => {
    // eslint-disable-next-line prefer-promise-reject-errors
    const replyPromise = replyAs(() => Promise.reject('non-Error'));
    await expect(replyPromise).rejects.toBeInstanceOf(Error);
  });
});
