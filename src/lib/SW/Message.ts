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

export abstract class MessageProcessor {
  abstract onRequestMessage(event: MessageEvent<RequestMessage>): unknown;
  abstract onResponseMessage(event: MessageEvent<ResponseMessage>): unknown;
  abstract onStatusMessage(event: MessageEvent<StatusMessage>): unknown;

  onMessage = (event: MessageEvent<RequestMessage | ResponseMessage | StatusMessage>) => {
    if ('request' in event.data) {
      this.onRequestMessage(event as MessageEvent<RequestMessage>);
    }
    if ('response' in event.data) {
      this.onResponseMessage(event as MessageEvent<ResponseMessage>);
    }
    if ('status' in event.data) {
      this.onStatusMessage(event as MessageEvent<StatusMessage>);
    }
  };

  abstract isActive(): boolean;
  abstract switchToStatus(status: 'on' | 'off'): Promise<void>;

  /**
   * Start receiving messages.
   */
  async activate() {
    return this.switchToStatus('on');
  }

  /**
   * Stop receiving messages.
   */
  async restore() {
    return this.switchToStatus('off');
  }
}
