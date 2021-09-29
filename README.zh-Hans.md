<div align="end"><sub>
  <a title="英文" href="README.md">ENGLISH</a>,
  简体中文
</sub></div>

# onfetch
[q-a]: https://github.com/PaperStrike/onfetch/discussions/categories/q-a
[contributing]: https://github.com/PaperStrike/onfetch/blob/main/.github/CONTRIBUTING.md

[mdn-fetch-func]: https://developer.mozilla.org/en-US/docs/Web/API/fetch
[mdn-request-api]: https://developer.mozilla.org/en-US/docs/Web/API/Request
[mdn-response-api]: https://developer.mozilla.org/en-US/docs/Web/API/Response

[![CI 状态](https://github.com/PaperStrike/onfetch/actions/workflows/test.yml/badge.svg)](https://github.com/PaperStrike/onfetch/actions/workflows/test.yml)
[![npm 包](https://img.shields.io/npm/v/onfetch?logo=npm "onfetch")](https://www.npmjs.com/package/onfetch)

配合原生 [`Request`][mdn-request-api] / [`Response`][mdn-response-api] API 模拟 [`fetch()`][mdn-fetch-func] 请求响应。可选地，配合 [Service Worker](#service-worker) 模拟**所有**请求响应。

支持主流现代浏览器，兼容 [`node-fetch`](<https://github.com/node-fetch/node-fetch>)、[`whatwg-fetch`](<https://github.com/github/fetch>)、[`cross-fetch`](<https://github.com/lquixada/cross-fetch>) 等 Polyfill 库。

---

🐿️ 跳转到
[回调](#回调)，
[延时](#延时)，
[重定向](#重定向)，
[次数](#次数)，
[恢复](#恢复)，
[Service Worker](#service-worker)，
[选项](#选项)，
[Q&A][q-a]，
或
[Contributing Guide][contributing]。

## 概述
[mdn-headers-api]: https://developer.mozilla.org/en-US/docs/Web/API/Headers

从 `onfetch` 开始，像构造一个 [`Request`][mdn-request-api] 对象一样传参。然后像构造一个 [`Response`][mdn-response-api] 对象一样 `reply`。

```js
import onfetch from 'onfetch';

onfetch('/simple').reply('path');

// 或
onfetch('/post', { method: 'POST' })
  .reply('received');

// 或
onfetch('/down')
  .reply(null, { status: 500 });
```

在 Node 环境中，除了需要提前设置好全局 [`fetch`][mdn-fetch-func]，你还需要设置好全局 [`Headers`][mdn-headers-api]、[`Request`][mdn-request-api]、和 [`Response`][mdn-response-api]。

### 匹配
[mdn-request-body]: https://developer.mozilla.org/en-US/docs/Web/API/Request/body

一个 `onfetch` 规则如何使用给定参数匹配一个 [`Request`][mdn-request-api] 请求。

为保持匹配简单快速，我们不支持也不会支持匹配 [`body`][mdn-request-body]。如若需要请在[响应回调](#回调)里放入自己的匹配逻辑。

[响应次数](#次数)不大于 0 的规则不匹配任一请求。

#### 字符串
[mdn-url-api]: https://developer.mozilla.org/en-US/docs/Web/API/URL

给定字符串在下列检查都通过时与请求的 URL 相匹配：

1. 分成三部分。路径，查询参数，和位置标识。
2. 检查路径与请求路径是否匹配。
3. 对于查询参数和位置标识，如果不为空值，检查其是否匹配请求的对应值。

```js
onfetch('/string').persist();

fetch('/string'); // 匹配
fetch('/string?query'); // 匹配
fetch('/string#hash'); // 匹配
```

```js
onfetch('/string?specify-query').persist();

fetch('/string'); // 不匹配
fetch('/string?other-query'); // 不匹配
fetch('/string?specify-query'); // 匹配
fetch('/string?specify-query#hash'); // 匹配
```

对 [`persist()`](#persist) 的调用允许上述 `onfetch` 规则匹配应用无限次。

#### RequestInit
[idl-request-init]: https://fetch.spec.whatwg.org/#requestinit

第二个参数，一个 [`RequestInit`][idl-request-init] 对象，在下述步骤的检查都通过时与该 [`Request`][mdn-request-api] 相匹配：

1. 从给定 [`RequestInit`][idl-request-init] 对象中解构出 `headers`, `body`, `window` 以及其余部分。
2. 检查 `headers` 中的每个标头都能在请求的标头中有所对应。
3. 检查其余部分中的每部分都能在该 [`Request`][mdn-request-api] 中有所对应。

```js
onfetch('', {
  method: 'GET',
  headers: {
    'Content-Type': 'text/plain',
  },
}).persist();

// 不匹配
fetch('', { method: 'GET' });

// 不匹配
fetch('', {
  method: 'POST',
  headers: {
    'Content-Type': 'text/plain',
  },
});

// 匹配
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

除了使用字符串，你也可以使用正则表达式 [`RegExp`][mdn-regexp-api] 作为第一个参数来规定匹配的请求 URL。

```js
// 匹配以 '.foo' 结尾的 URL
onfetch(/\.foo$/).reply('bar');
```

注意此处正则 [`RegExp`][mdn-regexp-api] 将会与 **完整 URL** 相匹配，或者说，若该规则不应关心查询参数和位置标识，则写成这样：

```js
// 使用接受任意查询参数和位置标识的正则
onfetch(/^[^?#]*\.foo([?#]|$)/).reply('bar');
```

#### URLPattern
[mdn-url-pattern-api]: https://developer.mozilla.org/en-US/docs/Web/API/URLPattern

你也可以使用全新的 [`URLPattern`][mdn-url-pattern-api] 对象作为第一个参数。

```js
const pattern = new URLPattern('http{s}?://*.example.com/books/:id');
onfetch(pattern);
```

实际上，第一个参数只要求给定的对象具有这样一个 `test` 方法，接收 URL 字符串返回匹配结果布尔值。

#### Request

你也可以在第一个参数中给定一个 [`Request`][mdn-request-api] 对象。匹配规则类似于 [`RequestInit` 匹配](#requestinit)。

## 回调
[idl-body-init]: https://fetch.spec.whatwg.org/#bodyinit
[mdn-promise-api]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise

除了像构造一个 [`Response`][mdn-response-api] 一样调用 `reply`，你也可以传递一个回复回调函数来生成请求响应。

请求回调将接收两个参数，第一个参数指向请求对象 [`Request`][mdn-request-api]，第二个参数传递原来的和模拟的 `fetch`。

记得返回一个 [`Response`][mdn-response-api]，[`BodyInit`][idl-body-init]，`null`，或一个解析后为这三者之一的 [`Promise`][mdn-promise-api]。

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

一个总使用原 `fetch` 发送请求的语法糖。

```js
import onfetch, { passThrough } from 'onfetch';
onfetch('/use-original').reply(passThrough);
```

## 延时

```js
// 响应前等待 200 毫秒
onfetch('').delay(200).reply('');
```

`delay` 和 `reply` 的顺序不影响结果。

```js
// 效果一致
onfetch('').reply('').delay(200);
```

延时会累加。

```js
// 响应前等待 400 毫秒
onfetch('').delay(200).delay(300).delay(-100).reply('');
```

## 重定向
[redirect-status]: https://fetch.spec.whatwg.org/#redirect-status
[mdn-response-redirect]: https://developer.mozilla.org/en-US/docs/Web/API/Response/redirect
[mdn-request-redirect]: https://developer.mozilla.org/en-US/docs/Web/API/Request/redirect
[mdn-response-redirected]: https://developer.mozilla.org/en-US/docs/Web/API/Response/redirected
[mdn-response-url]: https://developer.mozilla.org/en-US/docs/Web/API/Response/url

使用具有[重定向状态码][redirect-status]的 [`Response`][mdn-response-api] 对象来重定向请求。你可以使用[`Response.redirect`][mdn-response-redirect] 来构建一个这样的对象。

```js
// 重定向到 '/bar'
onfetch('/foo').reply(Response.redirect('/bar'));

// `/bar` 回应 `redirected`
onfetch('/bar').reply('redirected');

// 输出 'redirected'
fetch('/foo').then((res) => res.text()).then(console.log);
```

### 局限

- 在**非** [Service Worker 模式](#service-worker)下，重定向一个 [`redirect`][mdn-request-redirect] 属性值不为 `follow` 的 [`Request`][mdn-request-api] 请求将使原 fetch 抛出一个 `TypeError` 错误。
- 在**非** [Service Worker 模式](#service-worker)下，重定向过的 [`Response`][mdn-response-api] 正确取值的 [`redirected`][mdn-response-redirected] 和 [`url`][mdn-response-url] 属性设置在该响应对象本身上。通过原型 prototype 读取将返回错误值。

## 次数

你可以通过 `times` 函数指定一个 `onfetch` 规则的应用次数。它接收一个整数作为该规则的应用次数。

```js
// 应用该规则 5 次
onfetch('/foo').times(5).reply('bar');
```

你可能有多个规则同时匹配某一请求，但只有第一个会被应用。

默认情况下，一条 `onfetch` 规则只会应用**一次**。次数用完后，该规则不再参与请求匹配。

```js
onfetch('/foo').reply('alpha');
onfetch('/foo').reply('beta');

// 输出 alpha
fetch('/foo').then((res) => res.text()).then(console.log);

// 输出 beta
fetch('/foo').then((res) => res.text()).then(console.log);
```

你可以存储对某一 `onfetch` 规则的引用，然后在任意时刻重新指定其应用次数。

```js
const onFoo = onfetch('/foo').reply('bar');

fetch('/foo'); // 匹配

// 再来一次
onFoo.once();

fetch('/foo'); // 匹配
```

注意，当未有 `onfetch` 规则匹配某一请求时，该请求将回落到 [`options.defaultRule`](#默认规则)。

`times(n)` 不会累加，只会重写。

```js
const onFoo = onfetch('/foo').twice().once().reply('bar');

fetch('/foo'); // 匹配
fetch('/foo'); // 回落到默认规则 `defaultRule`
```

### `once()`

`rule.times(1)` 的一个语法糖。

### `twice()`

`rule.times(2)` 的语法糖。

### `thrice()`

`rule.times(3)` 的糖。

### `persist()`

`rule.times(Infinity)`。

## 重置

### 恢复

`restore` 函数用于停用 `onfetch`，停止拦截 HTTP 请求。 注意，该方法不会清除任何请求响应规则。

```js
onfetch.restore();
```

### 清除单一规则

```js
const first = onfetch('/same').reply('first');
onfetch('/same').reply('second');

onfetch.remove(first);

// 输出 'second'
fetch('/foo').then((res) => res.text()).then(console.log);
```

### 清除所有请求响应规则

```js
onfetch.cleanAll();
```

### 启用

要（重新）启用 `onfetch` 拦截 HTTP 请求，可使用 `activate()`.

在你第一次引入时 `onfetch` 会自动启用自己。

```js
onfetch.restore();

// 某些代码后

onfetch.activate();
```

## Service Worker
[mdn-service-worker-api]: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
[mdn-xml-http-request-api]: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest

[Service Worker API][mdn-service-worker-api] 只适用于浏览器。

配合 [Service Worker API][mdn-service-worker-api]，你将可以拦截模拟包括 CSS 文件这类不走 [XMLHttpRequest][mdn-xml-http-request-api]、也不走 [`fetch`][mdn-fetch-func] 的，页面所发送的**所有请求资源**。

```js
// 在主页面脚本中
import onfetch from 'onfetch';

onfetch.useServiceWorker();

onfetch('/script.js').reply('console.log(\'mocked!\')');
const script = document.createElement('script');
script.src = '/script.js';

// 输出 'mocked!'
document.head.append(script);
```

要启用这个特性，需在你的 Service Worker 脚本中引入 `onfetch/sw`。

```js
// 在 service worker 中
import 'onfetch/sw';
```

要切换回普通模式，在主页面端执行 `onfetch.useDefault()`。

要停用 `onfetch/sw`，需提前储存其默认导入值，然后执行其 `restore` 方法。这之后，如果主页面端 `onfetch` 仍使用 service worker 模式，将拦截不到任何请求。

```js
// 在 service worker 中
import onfetchWorker from 'onfetch/sw';

self.addEventListener('message', ({ data }) => {
  // 可以使用 `.activate()` 重新启用
  if (data?.example) onfetchWorker.restore();
});
```

## 请求流程

默认模式下：

![onfetch 捕获测试样例的 fetch 请求，据需要发送真实请求，重定向需重定向的响应，然后返回模拟响应。](./docs/default-flow.svg)

配合 [service worker](#service-worker)：

![Service worker 捕获测试样例的所有请求，转发给 onfetch。onfetch 据需要发送真实请求，返回模拟响应。浏览器会自动将需重定向的响应以新请求的形式发给 service worker。](./docs/sw-flow.svg)

## 选项

可通过 `onfetch.config` 配置。

### 默认规则

当某一请求未有 `onfetch` 规则相匹配时所使用的规则。你可以通过使用和调用 `onfetch` 一样的参数，构造 `InterceptRule` 对象构造规则。

```js
import onfetch, { InterceptRule } from 'onfetch';
onfetch.config({
  defaultRule: new InterceptRule('').reply('default'),
});
```

默认值：

```js
new InterceptRule('').reply((request) => {
  throw new Error('No onfetch rule matches this fetch request', {
    cause: request,
  });
})
```

### AbortError

构建中止错误的构造函数。应扩展自`Error`，实例的 `name` 属性值应为 `AbortError`。

```js
import onfetch from 'onfetch';
onfetch.config({
  AbortError: PutItHere,
});
```

对于浏览器，默认值为：

```js
DOMException.bind(null, 'The user aborted a request.', 'AbortError');
```

对于 Node，默认值为：

```js
class AbortError extends Error {
  name = 'AbortError';

  constructor() {
    super('The user aborted a request.');
  }
}
```

### 跳过重定向

将此设为 `true` 可跳过 `onfetch` 的[重定向](#重定向)。

```js
import onfetch from 'onfetch';
onfetch.config({
  bypassRedirect: true, // 或 false
});
```

在 [service worker 模式](#service-worker) 下，此选项默认为 `true`，因为浏览器会自己处理重定向（见[请求流程](#请求流程)）。我们也因此可以克服一些[重定向限制](#局限)。

## Q&A

请进入 [Q&A 讨论区][q-a] 寻找答案。 👍

## Contributing

请查看 [Contributing Guide][contributing] 中的引导。 👍

## License
[license]: https://github.com/PaperStrike/onfetch/blob/main/LICENSE

[ISC][license]
