import { CloneableRequest, CloneableResponse } from './toCloneable';

export interface Message {
  onfetch: number;
}

export interface StatusMessage extends Message {
  status: 'on' | 'off';
}

export interface RequestMessage extends Message {
  request: CloneableRequest;
}

export interface ResponseMessage extends Message {
  response: CloneableResponse;
}
