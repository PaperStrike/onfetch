import InterceptRule from './InterceptRule.js';
import AbortError from './lib/AbortError.js';

export interface Options {
  defaultRule: InterceptRule;
  AbortError: typeof AbortError;
  bypassRedirect: boolean;
}

export type Context = { fetch: typeof fetch };

/**
 * Generate the mocked fetch with given context.
 * Multiple arrow functions are used to bypass `.bind(this)`
 * which will be frequently used if not doing so.
 */
export default class Fetcher {
  private readonly options: Options = {
    defaultRule: new InterceptRule('').reply((req) => {
      throw new Error(`No onfetch rule matches this request to '${req.url}'`);
    }),
    AbortError,
    bypassRedirect: false,
  };

  private readonly rules: InterceptRule[] = [];

  private context: Context;

  private original: typeof fetch;

  readonly mocked: typeof fetch = async (
    ...argArray: Parameters<typeof fetch>
  ): Promise<Response> => {
    const request = new Request(...argArray);
    const { signal } = request;

    if (signal?.aborted) {
      throw new this.options.AbortError();
    }

    let redirected = false;
    const respondPromise = (
      this.rules.find((rule) => rule.test(request)) || this.options.defaultRule
    )
      .apply(request, {
        original: this.original,
        mocked: this.mocked,
      })
      .then((response) => {
        if (this.options.bypassRedirect) {
          return response;
        }

        /**
         * @see [A redirect status | Fetch Standard]{@link https://fetch.spec.whatwg.org/#redirect-status}
         */
        if (![301, 302, 303, 307, 308].includes(response.status)) {
          return response;
        }
        if (request.redirect !== 'follow') {
          throw new TypeError('Redirect mode not supported');
        }
        const locationString = response.headers.get('location');
        if (locationString === null) {
          return response;
        }
        const location = new URL(locationString, request.url);
        if (!location.hash) location.hash = new URL(request.url).hash;
        redirected = true;
        return this.mocked(new Request(location.href, request));
      })
      .then((response) => {
        if (redirected && !response.redirected) {
          Object.defineProperty(response, 'redirected', {
            value: true,
          });
        }
        return response;
      });

    if (signal) {
      return Promise.race([
        respondPromise,
        new Promise<never>((resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new this.options.AbortError());
          });
        }),
      ]);
    }
    return respondPromise;
  };

  constructor(context: Context) {
    this.context = context;
    this.original = context.fetch;
  }

  /**
   * Adopt another context. Preserve active status.
   */
  readonly adopt = (context: Context): void => {
    if (this.context === context) return;
    const beActive = this.isActive();
    this.restore();
    this.context = context;
    this.original = context.fetch;
    if (beActive) this.activate();
  };

  readonly remove = (rule: InterceptRule): boolean => {
    const ruleIndex = this.rules.indexOf(rule);
    if (ruleIndex === -1) return false;
    this.rules.splice(ruleIndex, 1);
    return true;
  };

  readonly cleanAll = (): void => {
    this.rules.length = 0;
  };

  readonly addRule = (input: RequestInfo | RegExp, init: RequestInit = {}): InterceptRule => {
    const rule = new InterceptRule(input, init);
    this.rules.push(rule);
    return rule;
  };

  readonly hasActive = (): boolean => this.rules.some((rule) => rule.isActive());

  readonly isActive = (): boolean => this.context.fetch === this.mocked;

  readonly activate = (): void => {
    this.context.fetch = this.mocked;
  };

  readonly restore = (): void => {
    this.context.fetch = this.original;
  };

  readonly config = (config: Partial<Options>): void => {
    Object.assign(this.options, config);
  };
}
