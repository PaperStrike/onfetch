import Fetcher, { type Context, type Options } from './Fetcher.js';
import InterceptRule, { passThrough } from './InterceptRule.js';

export {
  Fetcher,
  Context,
  Options,
  InterceptRule,
  passThrough,
};

export type OnfetchCall = ((input: RequestInfo | RegExp, init?: RequestInit) => InterceptRule);

export type Onfetch = OnfetchCall & {
  readonly adopt: (context: Context) => void;
  readonly remove: (rule: InterceptRule) => boolean;
  readonly cleanAll: () => void;
  readonly hasActive: () => boolean;
  readonly isActive: () => boolean;
  readonly activate: () => void;
  readonly restore: () => void;
  readonly config: (config: Partial<Options>) => void;
};

const mockFetchOn = (context: Context): Onfetch => {
  const {
    addRule,
    adopt,
    remove,
    cleanAll,
    hasActive,
    isActive,
    activate,
    restore,
    config,
  } = new Fetcher(context);
  return Object.assign(addRule, {
    adopt,
    remove,
    cleanAll,
    hasActive,
    isActive,
    activate,
    restore,
    config,
  });
};

export default mockFetchOn;
