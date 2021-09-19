import Fetcher, { Options } from './Fetcher';
import InterceptRule, { passThrough } from './InterceptRule';
import Client from './lib/sw/Client';
import Worker from './lib/sw/Worker';

export {
  Fetcher,
  Options,
  InterceptRule,
  passThrough,
  Client,
  Worker,
};

export type OnfetchCall = ((input: RequestInfo | RegExp, init?: RequestInit) => InterceptRule);

export type Onfetch = OnfetchCall & {
  readonly adopt: (context: { fetch: typeof fetch }) => void;
  readonly hasActive: () => boolean;
  readonly isActive: () => boolean;
  readonly deactivate: () => void;
  readonly activate: () => void;
  readonly config: (config: Partial<Options>) => void;
};

const mockFetchOn = (context: { fetch: typeof fetch }): Onfetch => {
  const {
    addRule,
    adopt,
    hasActive,
    isActive,
    deactivate,
    activate,
    config,
  } = new Fetcher(context);
  return Object.assign(addRule, {
    adopt,
    hasActive,
    isActive,
    deactivate,
    activate,
    config,
  });
};

export default mockFetchOn;
