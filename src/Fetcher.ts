import InterceptRule from './InterceptRule';
import AbortError from './lib/AbortError';

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
  private readonly options: Options = {
    defaultRule: new InterceptRule('').reply((request) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore until https://github.com/microsoft/TypeScript/issues/45167
      throw new Error('No onfetch rule matches this fetch request', {
        cause: request,
      });
    }),
    AbortError,
  };

  private readonly rules: InterceptRule[] = [];

  private context: { fetch: typeof fetch };

  private original: typeof fetch;

  private readonly mocked: typeof fetch = async (
    ...argArray: Parameters<typeof fetch>
  ): Promise<Response> => {
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

  /**
   * Adopt another context. Preserve active status.
   */
  readonly adopt = (context: { fetch: typeof fetch }): void => {
    if (this.context === context) return;
    const wasActive = this.isActive();
    this.deactivate();
    this.context = context;
    this.original = context.fetch;
    if (wasActive) this.activate();
  };

  readonly addRule = (input: RequestInfo | RegExp, init: RequestInit = {}): InterceptRule => {
    const rule = new InterceptRule(input, init);
    this.rules.push(rule);
    return rule;
  };

  readonly hasActive = (): boolean => this.rules.some((rule) => rule.isActive());

  readonly isActive = (): boolean => this.context.fetch === this.mocked;

  readonly deactivate = (): void => {
    this.context.fetch = this.original;
  };

  readonly activate = (): void => {
    this.context.fetch = this.mocked;
  };

  readonly config = (config: Partial<Options>): void => {
    Object.assign(this.options, config);
  };
}
