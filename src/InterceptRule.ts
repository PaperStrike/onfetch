type Fetchers = {
  original: typeof fetch;
  mocked: typeof fetch;
};

export type ReplyValue = BodyInit | null | Response;
export type ReplyCallback =
  (request: Request, fetchers: Fetchers) => ReplyValue | Promise<ReplyValue>;
export type Reply = ReplyValue | Promise<ReplyValue> | ReplyCallback;

/**
 * Split the query string and hash
 * and return [path, search, hash].
 */
const splitSearchAndHash = (url: string): [string, string | undefined, string | undefined] => {
  const matchResult = /^(.*?)(\?.*?)?(#.*)?$/.exec(url);
  if (!matchResult) {
    throw new Error(`Failed to split search and hash from '${url}'`);
  }
  const [, path, search, hash] = matchResult;
  return [path, search, hash];
};

export const passThrough: ReplyCallback = (request, { original }) => original(request);

export default class InterceptRule {
  input: RequestInfo | { test(str: string): boolean };

  init: RequestInit;

  headersArr: [string, string][] = [];

  constructor(input: RequestInfo | RegExp, init: RequestInit = {}) {
    this.input = input;
    this.init = init;

    if (init.headers) {
      this.headersArr.push(...new Headers(init.headers));
    } else if (input instanceof Request) {
      this.headersArr.push(...input.headers);
    }
  }

  private delayDuration = 0;

  delay(ms: number): this {
    this.delayDuration += ms;
    return this;
  }

  private declare replier?: Reply;

  reply(body?: BodyInit | null, init?: ResponseInit): this;
  reply(body: Promise<BodyInit | null>): this;
  reply(response: Response | Promise<Response>): this;
  reply(callback: ReplyCallback): this;
  reply(replier?: Reply, init?: ResponseInit): this {
    if (replier === undefined || init) {
      this.replier = new Response(replier as BodyInit | null | undefined, init);
    } else {
      this.replier = replier;
    }
    return this;
  }

  private restApplyTimes = 1;

  isActive(): boolean {
    return this.restApplyTimes > 0;
  }

  times(n: number): this {
    this.restApplyTimes = n;
    return this;
  }

  once(): this {
    return this.times(1);
  }

  twice(): this {
    return this.times(2);
  }

  thrice(): this {
    return this.times(3);
  }

  persist(): this {
    return this.times(Infinity);
  }

  test(input: RequestInfo, init?: RequestInit): boolean {
    // Inactive rule matches no request.
    if (!this.isActive()) return false;

    const request = init === undefined && input instanceof Request
      ? input
      : new Request(input, init);

    // Required init in later test.
    let requiredInit: RequestInit = this.init;

    // Test required input.
    if (this.input instanceof Request) {
      // For Request, check in later init.
      requiredInit = new Request(this.input, this.init);
    } else if (typeof this.input === 'object') {
      // For object like RegExp and URLPattern, test against request URL.
      if (!this.input.test(request.url)) return false;
    } else {
      // For string, separate out search and hash.
      const [path, search, hash] = splitSearchAndHash(request.url);

      // Parse the required based on the request as the required may be relative.
      const [
        requiredPath,
        requiredSearch,
        requiredHash,
      ] = splitSearchAndHash(new URL(this.input, request.url).href);

      // Check parts before the query string.
      if (path !== requiredPath) return false;

      // When required, check query string and fragment.
      if ((requiredSearch && search !== requiredSearch)
        || (requiredHash && hash !== requiredHash)) return false;
    }

    // Test required init.

    // Check required headers.
    if (this.headersArr.some(([key, value]) => request.headers.get(key) !== value)) {
      return false;
    }

    // Check init other than `headers`, `body` and `window`.
    // Specify keys, as destructuring and Object.keys won't include inherited props.
    return ([
      'cache',
      'credentials',
      'integrity',
      'keepalive',
      'method',
      'mode',
      'redirect',
      'referrer',
      'referrerPolicy',
      'signal',
    ] as const).every((key) => (
      !(key in requiredInit) || request[key] === requiredInit[key]
    ));
  }

  async apply(request: Request, fetchers: Fetchers): Promise<Response> {
    this.restApplyTimes -= 1;

    const { replier, delayDuration } = this;

    // Throw if no replier provided.
    if (replier === undefined) {
      throw new Error('No reply body or callback configured on this onfetch rule');
    }

    // Apply delay.
    if (delayDuration > 0) {
      await new Promise((r) => {
        setTimeout(r, delayDuration);
      });
    }

    // Execute callback.
    const bodyInitOrResponse = typeof replier === 'function'
      ? await (async () => replier(request, fetchers))()
        .catch((err: unknown) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore until https://github.com/microsoft/TypeScript/issues/45167
          throw new Error('The reply callback threw an error', {
            cause: err,
          });
        })
      : await replier;

    // Form the response.
    const response = bodyInitOrResponse instanceof Response
      // Avoid using used response.
      ? bodyInitOrResponse.clone()
      : new Response(bodyInitOrResponse);

    // Ensure URL is defined.
    if (!response.url) {
      Object.defineProperty(response, 'url', {
        // Remove hash as the standard behavior.
        value: request.url.split('#', 1)[0],
      });
    }

    return response;
  }
}
