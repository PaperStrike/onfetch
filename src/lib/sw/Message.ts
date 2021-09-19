import { CloneableRequest, CloneableResponse } from './toCloneable';

export interface Message {
  id: number;
}

export interface RequestMessage extends Message {
  request: CloneableRequest;
  id: number;
}

export interface ResponseMessage extends Message {
  response: CloneableResponse;
  id: number;
}
