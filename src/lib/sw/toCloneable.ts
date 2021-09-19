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

/**
 * Construct a cloneable object for a given Request or Response.
 * @see [The structured clone algorithm - Web APIs | MDN]{@link https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm}
 */
async function toCloneable(r: Request): Promise<CloneableRequest>;
async function toCloneable(r: Response): Promise<CloneableResponse>;
async function toCloneable(
  requestOrResponse: Request | Response,
): Promise<CloneableRequest | CloneableResponse> {
  const arrayBuffer = await requestOrResponse.clone().arrayBuffer();
  const body = arrayBuffer.byteLength > 0 ? arrayBuffer : null;

  const headers = [...requestOrResponse.headers];

  // To cloneable request.
  if (requestOrResponse instanceof Request) {
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
    } = requestOrResponse;
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
  } = requestOrResponse;
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
