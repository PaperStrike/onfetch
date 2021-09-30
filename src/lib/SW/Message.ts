import { CloneableRequest, CloneableResponse } from './toCloneable';

export interface StatusMessage {
  status: 'on' | 'off';
}

interface NetworkMessage {
  index: number;
}

export type FulfillList = ([(res: Response) => void, (err: Error) => void] | null)[];

export interface RequestMessage extends NetworkMessage {
  request: CloneableRequest;
}

export interface ResponseMessage extends NetworkMessage {
  response: CloneableResponse | Error;
}
