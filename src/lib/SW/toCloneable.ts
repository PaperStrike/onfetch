export type CloneableRequest = {
  body: ArrayBuffer | null;
  cache: RequestCache;
  credentials: RequestCredentials;
  destination: RequestDestination;
  headers: [string, string][];
  integrity: string;
  keepalive: boolean;
  method: string;
  mode: RequestMode;
  redirect: RequestRedirect;
  referrer: string;
  referrerPolicy: ReferrerPolicy;
  url: string;
};

export type CloneableResponse = {
  body: ArrayBuffer | null;
  headers: [string, string][];
  ok: boolean;
  redirected: boolean;
  status: number;
  statusText: string;
  type: ResponseType;
  url: string;
};

export type CloneableError = {
  name: string;
  message: string;
  cause?: CloneableRequest | CloneableResponse;
  stack?: string;
};

/**
 * Construct a cloneable object for a given Request or Response.
 * @see [The structured clone algorithm - Web APIs | MDN]{@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm}
 */
async function toCloneable(request: Request): Promise<CloneableRequest>;
async function toCloneable(response: Response): Promise<CloneableResponse>;
async function toCloneable(error: Error): Promise<CloneableError>;
async function toCloneable(r: Request | Response): Promise<CloneableRequest | CloneableResponse>;
async function toCloneable(r: Response | Error): Promise<CloneableResponse | CloneableError>;
async function toCloneable(
  r: Request | Response | Error,
): Promise<CloneableRequest | CloneableResponse | CloneableError> {
  if (r instanceof Error) {
    const {
      name,
      message,
      cause,
      stack,
    } = r as Error & { cause?: Request | Response };
    const cloneable: CloneableError = { name, message };
    if (cause) cloneable.cause = await toCloneable(cause);
    if (stack) cloneable.stack = stack;
    return cloneable;
  }

  const arrayBuffer = await r.clone().arrayBuffer();
  const body = arrayBuffer.byteLength > 0 ? arrayBuffer : null;

  const headers = [...r.headers];

  // To cloneable request.
  if (r instanceof Request) {
    const {
      cache,
      credentials,
      destination,
      integrity,
      keepalive,
      method,
      mode,
      redirect,
      referrer,
      referrerPolicy,
      url,
    } = r;
    return {
      body,
      cache,
      credentials,
      destination,
      headers,
      integrity,
      keepalive,
      method,
      mode,
      redirect,
      referrer,
      referrerPolicy,
      url,
    };
  }

  // To cloneable response.
  const {
    ok,
    redirected,
    status,
    statusText,
    type,
    url,
  } = r;
  return {
    body,
    headers,
    ok,
    redirected,
    status,
    statusText,
    type,
    url,
  };
}

export default toCloneable;
