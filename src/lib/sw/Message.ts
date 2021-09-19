import { CloneableRequest, CloneableResponse } from './toCloneable';

export interface Message {
  id: number;
}

export interface RequestMessage extends Message {
  request: CloneableRequest;
}

export interface ResponseMessage extends Message {
  response: CloneableResponse;
}
