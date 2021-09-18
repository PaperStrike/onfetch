<div align="end"><sub>
  ENGLISH,
  <a title="Simplified Chinese" href="README.zh-Hans.md">简体中文</a>
</sub></div>

# onfetch
[q-a]: https://github.com/PaperStrike/onfetch/discussions/categories/q-a
[contributing]: https://github.com/PaperStrike/onfetch/blob/main/.github/CONTRIBUTING.md

[mdn-fetch-func]: https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch
[mdn-request-api]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[mdn-response-api]: https://developer.mozilla.org/en-US/docs/Web/API/Response

[![Build Status](https://github.com/PaperStrike/onfetch/actions/workflows/test.yml/badge.svg)](https://github.com/PaperStrike/onfetch/actions/workflows/test.yml)
[![npm Package](https://img.shields.io/npm/v/onfetch?logo=npm "onfetch")](https://www.npmjs.com/package/onfetch)

Mock [`fetch()`][mdn-fetch-func] with native [`Request`][mdn-request-api] / [`Response`][mdn-response-api] API.

Works with [`node-fetch`](https://github.com/node-fetch/node-fetch), [`whatwg-fetch`](https://github.com/github/fetch), [`cross-fetch`](https://github.com/lquixada/cross-fetch), whatever, and mainly, modern browsers.

---

🐿️ Jump to
[Callback](#callback),
[Delay](#delay),
[Redirect](#redirect),
[Times](#times),
[Options](#options),
[Q&A][q-a],
or
[Contributing Guide][contributing].

## Basic
[mdn-headers-api]: https://developer.mozilla.org/en-US/docs/Web/API/Headers

Start with `onfetch`, pass the same params as constructing a [`Request`][mdn-request-api] object. Then `reply` as constructing a [`Response`][mdn-response-api] object.

```js
import onfetch from 'onfetch';

onfetch('/simple').reply('path');

// Or
onfetch('/post', { method: 'POST' })
  .reply('received');

// Or
onfetch('/down')
  .reply(null, { status: 500 });
```

In Node, in addition to setting up global [`fetch`][mdn-fetch-func], you also need to set up global [`Headers`][mdn-headers-api], [`Request`][mdn-request-api], and [`Response`][mdn-response-api].

### Matching
[mdn-request-body]: https://developer.mozilla.org/en-US/docs/Web/API/Request/body

How `onfetch` uses your params to match a [`Request`][mdn-request-api].

To keep this simple and efficient, we don't and won't support [`body`][mdn-request-body] matching. You will have to put your own processing code into a [reply callback](#callback) when needed.

Rules without a positive [`times`](#times) match no request.

#### String
[mdn-url-api]: https://developer.mozilla.org/en-US/docs/Web/API/URL

A string matches the request's URL if all the following checks pass:

1. Split into three parts. Path, query string and hash.
2. Check if the path matches the request's path.
3. For the query string and hash, if not empty, check if it matches the request's one.

```js
onfetch('/string').persist();

fetch('/string'); // match
fetch('/string?query'); // match
fetch('/string#hash'); // match
```

```js
onfetch('/string?specify-query').persist();

fetch('/string'); // not match
fetch('/string?other-query'); // not match
fetch('/string?specify-query'); // match
fetch('/string?specify-query#hash'); // match
```

The use of [`persist()`](#persist) allows the above `onfetch` rules to match an unlimited number of times.

#### RequestInit
[idl-request-init]: https://fetch.spec.whatwg.org/#requestinit

The second param, a [`RequestInit`][idl-request-init] object, matches the [`Request`][mdn-request-api], when all the checks in the following steps pass:

1. Deconstruct `headers`, `body`, `window` and the _rest parts_ from the [`RequestInit`][idl-request-init] object.
2. Check if each header in `headers` has a match in the request's headers.
3. Check if each part in the _rest parts_ has a match in the [`Request`][mdn-request-api].

```js
onfetch('', {
  method: 'GET',
  headers: {
    'Content-Type': 'text/plain',
  },
}).persist();

// not match
fetch('', { method: 'GET' });

// not match
fetch('', {
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain',
  },
});

// match
fetch('', {
  cache: 'no-cache',
  method: 'GET',
  headers: {
    'Accept': 'text/html',
    'Content-Type': 'text/plain',
  },
});
```

#### RegExp
[mdn-regexp-api]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp

Other than using strings, you can also pass a [`RegExp`][mdn-regexp-api] as the first arg to test the request's URL.

```js
// Match URLs that ends with '.foo'.
onfetch(/\.foo$/).reply('bar');
```

Put it in consideration that [`RegExp`][mdn-regexp-api] here test against the _entire URL string_, which means, if this `onfetch` rule needn't care about the query string nor the hash, write it like:

```js
// Use regexp that
// allows any trailing query string and hash.
onfetch(/^[^?#]*\.foo([?#]|$)/).reply('bar');
```

#### Request

You can also pass a [`Request`][mdn-request-api] object as the first arg, to match the request in a manner similar with the [`RequestInit` matcher](#requestinit).

## Callback
[idl-body-init]: https://fetch.spec.whatwg.org/#bodyinit
[mdn-promise-api]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise

Other than `reply` as constructing a [`Response`][mdn-response-api], you can also pass a callback function to form the response.

Your callback will receive two params, the first one points to the [`Request`][mdn-request-api] object, the second one gives you both the original and the mocked `fetch`.

Remember to return a [`Response`][mdn-response-api], [`BodyInit`][idl-body-init], `null`, or a [`Promise`][mdn-promise-api] that resolves to one of them.

```js
onfetch('').reply((request, fetchers) => {
  const example = request.headers.get('One');
  if (example === 'original') {
    return fetchers.original(request);
  }
  if (example === 'mocked') {
    return fetchers.mocked('/mocked');
  }
  return 'default-response';
});
```

### passThough

A syntactic sugar for sending requests via the original `fetch`.

```js
import onfetch, { passThrough } from 'onfetch';
onfetch('/use-original').reply(passThrough);
```

## Delay

```js
// Delay 200ms before reply.
onfetch('').delay(200).reply('');
```

The order of `delay`, `redirect`, and `reply` does not affect the result.

```js
// Same effect.
onfetch('').reply('').delay(200);
```

The delay duration accumulates.

```js
// Delay 400ms before reply.
onfetch('').delay(200).delay(300).delay(-100).reply('');
```

## Redirect

Use `redirect` to redirect the request passed to the [reply callback](#callback), or change the response' URL if no callback provided.

```js
// Redirect the request to '/bar' before reply.
onfetch('/foo').redirect('/bar').reply((req) => req.url);

// Logs 'https://localhost/bar'
fetch('/foo').then((res) => res.text()).then(console.log);
```

The order of `delay`, `redirect`, and `reply` does not affect the result.

```js
// Same effect.
onfetch('/foo').reply((req) => req.url).redirect('/bar');
```

## Times

You can specify the number of times to apply the `onfetch` rule via the `times` function. It accepts an integer as the number of applications of the rule.

```js
// Apply this rule 5 times.
onfetch('/foo').times(5).reply('bar');
```

You may have multiple rules matching a request at the same time, but only the first rule will apply.

By default, an `onfetch` rule only applies _once_. When the times ran out, it bypasses the match.

```js
onfetch('/foo').reply('/alpha');
onfetch('/foo').reply('/beta');

fetch('/foo').then(console.log); // logs alpha
fetch('/foo').then(console.log); // logs beta
```

You can specify the times at any time as long as you store the reference of the `onfetch` rule somewhere.

```js
const onFoo = onfetch('/foo').reply('/bar');

fetch('/foo'); // match

// Once again.
onFoo.once();

fetch('/foo'); // match
```

Note that when all the `onfetch` rules do not match a request, that request goes to [`options.defaultRule`](#default-rule).

The `times(n)` doesn't accumulate. It overrides.

```js
const onFoo = onfetch('/foo').twice().once().reply('/bar');

fetch('/foo'); // match
fetch('/foo'); // fallback to `defaultRule`
```

### `once()`

A syntactic sugar for `rule.times(1)`.

### `twice()`

Syntactic sugar for `rule.times(2)`.

### `thrice()`

Sugar for `rule.times(3)`.

### `persist()`

For `rule.times(Infinity)`.

## Options

Configurable via `onfetch.config`.

### Default rule

The rule used when all `onfetch` rules failed to match a request. You can form a rule by constructing a `InterceptRule` object, which accepts the same params as `onfetch`.

```js
import onfetch, { InterceptRule } from 'onfetch';
onfetch.config({
  defaultRule: new InterceptRule('').reply('default'),
});
```

Defaults to:

```js
new InterceptRule('').reply((request) => {
  throw new Error('No onfetch rule matches this fetch request', {
    cause: request,
  });
})
```

### Abort error

Constructor for abort errors. It extends from `Error` and its instance has the `name` property value `AbortError`.

```js
import onfetch from 'onfetch';
onfetch.config({
  AbortError: PutItHere,
});
```

In Browsers, defaults to:

```js
DOMException.bind(null, 'The user aborted a request.', 'AbortError');
```

In Node, defaults to:

```js
class AbortError extends Error {
  name = 'AbortError';

  constructor() {
    super('The user aborted a request.');
  }
}
```

## Q&A

Checkout our [Q&A Discussions][q-a] for your answers. 👍

## Contributing

Checkout our [Contributing Guide][contributing] please. 👍

## License
[license]: https://github.com/PaperStrike/onfetch/blob/main/LICENSE

[ISC][license]
