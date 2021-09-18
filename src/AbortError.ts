const message = 'The user aborted a request.';

class AbortError extends Error {
  name = 'AbortError';

  constructor() {
    super(message);
  }
}

const ParsedAbortError: typeof AbortError = (() => {
  if (typeof DOMException !== 'undefined') {
    return DOMException.bind(null, message, 'AbortError');
  }
  return AbortError;
})();

export default ParsedAbortError;
