import { CloneableError, CloneableRequest, CloneableResponse } from './toCloneable';

function toNative(request: CloneableRequest): Request;
function toNative(response: CloneableResponse): Response;
function toNative(error: CloneableError): Error;
function toNative(r: CloneableRequest | CloneableResponse): Request | Response;
function toNative(r: CloneableResponse | CloneableError): Response | Error;
function toNative(
  r: CloneableRequest | CloneableResponse | CloneableError,
): Request | Response | Error {
  if ('name' in r) {
    const {
      name,
      message,
      cause,
      stack,
    } = r;
    const native = new Error(message);
    native.name = name;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore until https://github.com/microsoft/TypeScript/issues/45167
    if (cause) native.cause = cause;
    if (stack) native.stack = stack;
    return native;
  }

  if ('cache' in r) {
    return new Request(r.url, r);
  }

  if (r.type === 'error') return Response.error();
  return new Response(r.body, r);
}

export default toNative;
