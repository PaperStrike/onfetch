import InterceptRule from './InterceptRule';
import AbortError from './AbortError';

export interface Options {
  defaultRule: InterceptRule;
  AbortError: typeof AbortError
}

/**
 * Generate the mocked fetch with given context.
 * Multiple arrow functions are used to bypass `.bind(this)`
 * which will be frequently used if not doing so.
 */
export default class Fetcher {
  options: Options = {
    defaultRule: new InterceptRule('').reply((request) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore until https://github.com/microsoft/TypeScript/issues/45167
      throw new Error('No onfetch rule matches this fetch request', {
        cause: request,
      });
    }),
    AbortError,
  };

  rules: InterceptRule[] = [];

  context: { fetch: typeof fetch };

  original: typeof fetch;

  mocked: typeof fetch = async (...argArray: Parameters<typeof fetch>): Promise<Response> => {
    const request = new Request(...argArray);
    const { signal } = request;

    if (signal?.aborted) {
      throw new this.options.AbortError();
    }

    const applyPromise = (this.rules.find((rule) => rule.test(request)) || this.options.defaultRule)
      .apply(request, {
        original: this.original,
        mocked: this.mocked,
      });

    if (signal) {
      return Promise.race([
        applyPromise,
        new Promise<never>((resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new this.options.AbortError());
          });
        }),
      ]);
    }
    return applyPromise;
  };

  constructor(context: { fetch: typeof fetch }) {
    this.context = context;
    this.original = context.fetch;
  }

  addRule = (input: RequestInfo | RegExp, init: RequestInit = {}): InterceptRule => {
    const rule = new InterceptRule(input, init);
    this.rules.push(rule);
    return rule;
  };

  hasActive = (): boolean => this.rules.some((rule) => rule.isActive());

  isActive = (): boolean => this.context.fetch === this.mocked;

  deactivate = (): void => {
    this.context.fetch = this.original;
  };

  activate = (): void => {
    this.context.fetch = this.mocked;
  };

  config = (config: Partial<Options>): void => {
    Object.assign(this.options, config);
  };
}
