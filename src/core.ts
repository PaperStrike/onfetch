import Fetcher, { Options } from './Fetcher';
import InterceptRule, { passThrough } from './InterceptRule';

export {
  Fetcher,
  Options,
  InterceptRule,
  passThrough,
};

export type OnfetchCall = ((input: RequestInfo | RegExp, init?: RequestInit) => InterceptRule);

export type Onfetch = OnfetchCall & {
  hasActive: () => boolean;
  isActive: () => boolean;
  deactivate: () => void;
  activate: () => void;
  config: (config: Partial<Options>) => void;
};

const mockFetchOn = (context: { fetch: typeof fetch }): Onfetch => {
  const {
    addRule,
    hasActive,
    isActive,
    deactivate,
    activate,
    config,
  } = new Fetcher(context);
  return Object.assign(addRule, {
    hasActive,
    isActive,
    deactivate,
    activate,
    config,
  });
};

export default mockFetchOn;
