type Entries<T> = NonNullable<{
  [K in keyof T]: [K, T[K]];
}[keyof T]>[];

type Fetchers = {
  original: typeof fetch;
  mocked: typeof fetch;
};

type ReplyValue = BodyInit | null | Response;
type ReplyCallback =
  (request: Request, fetchers: Fetchers) => ReplyValue | Promise<ReplyValue>;
type Reply = ReplyValue | ReplyCallback;

/**
 * Split the query string and hash
 * and return [path, search, hash].
 */
const splitSearchAndHash = (url: string): [string, string | undefined, string | undefined] => {
  const matchResult = /^(.*?)(\?.*?)?(#.*)?$/.exec(url);
  if (!matchResult) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore until https://github.com/microsoft/TypeScript/issues/45167
    throw new Error('Failed to split search and hash from the input', {
      cause: url,
    });
  }
  const [, path, search, hash] = matchResult;
  return [path, search, hash];
};

export const passThrough: ReplyCallback = (request, { original }) => original(request);

export default class InterceptRule {
  input: RequestInfo | RegExp;

  init: RequestInit;

  headersArr: [string, string][];

  constructor(input: RequestInfo | RegExp, init: RequestInit = {}) {
    this.input = input;
    this.init = init;

    let headers: Iterable<[string, string]>;
    if (init.headers) {
      headers = new Headers(init.headers);
    } else if (input instanceof Request) {
      headers = input.headers;
    } else {
      headers = [];
    }
    this.headersArr = [...headers];
  }

  private delayDuration = 0;

  delay(ms: number): this {
    this.delayDuration += ms;
    return this;
  }

  private declare redirection?: string;

  redirect(url: string): this {
    this.redirection = url;
    return this;
  }

  private declare replier?: Reply;

  reply(body?: BodyInit | null, init?: ResponseInit): this;
  reply(response: Response): this;
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
    } else if (this.input instanceof RegExp) {
      // For regex, test against request URL.
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

    // Separate out body, headers and window.
    const {
      body,
      headers,
      window,
      ...rest
    } = requiredInit as Omit<RequestInit, 'window'> & { window?: null };

    // Check required headers.
    if (this.headersArr.some(([key, value]) => request.headers.get(key) !== value)) {
      return false;
    }

    // Check the rest init.
    return (Object.entries(rest) as Entries<typeof rest>)
      .every(([key, value]) => request[key] === value);
  }

  async apply(request: Request, fetchers: Fetchers): Promise<Response> {
    this.restApplyTimes -= 1;

    const { replier, delayDuration, redirection } = this;

    // Throw if no replier provided.
    if (replier === undefined) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore until https://github.com/microsoft/TypeScript/issues/45167
      throw new Error('No reply body or callback configured on this onfetch rule', {
        cause: this,
      });
    }

    // Apply delay.
    if (delayDuration > 0) await new Promise((r) => setTimeout(r, delayDuration));

    // Apply redirection.
    const parsedRequest = redirection ? new Request(redirection, request) : request;

    // Execute callback.
    const bodyInitOrResponse = typeof replier === 'function'
      ? await replier(parsedRequest, fetchers)
      : replier;

    // Form the response.
    const response = bodyInitOrResponse instanceof Response
      // Avoid using used response.
      ? bodyInitOrResponse.clone()
      : new Response(bodyInitOrResponse);

    // Ensure URL is defined.
    if (!response.url) {
      Object.defineProperty(response, 'url', {
        // Remove hash as the standard behavior.
        value: parsedRequest.url.split('#', 1)[0],
      });
    }

    // Set redirected mark.
    if (redirection && !response.redirected) {
      Object.defineProperty(response, 'redirected', {
        value: true,
      });
    }

    return response;
  }
}
