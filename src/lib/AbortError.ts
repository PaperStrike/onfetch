const message = 'The user aborted a request.';

class AbortError extends Error {
  name = 'AbortError';

  constructor() {
    super(message);
  }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore for inconsistent error types in node and browsers
const ParsedAbortError: typeof AbortError = (() => {
  if (typeof DOMException !== 'undefined') {
    return DOMException.bind(null, message, 'AbortError');
  }
  return AbortError;
})();

export default ParsedAbortError;
