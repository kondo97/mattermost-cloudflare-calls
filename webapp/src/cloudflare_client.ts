import {EventEmitter} from 'events';
import {CallsClientConfig} from 'src/types/types';
import type {CallsClientJoinData} from '@mattermost/calls-common/lib/types';

export default class CloudflareCallsClient extends EventEmitter {
  public channelID: string;

  constructor(config: CallsClientConfig) {
    super();
    this.channelID = '';
  }

  public async init(joinData: CallsClientJoinData) {
    // TODO: Implement
  }

  public async destroy() {
    // TODO: Implement
  }

  public async getSessionID() {
    // TODO: Implement
  }

  public async disconnect() {
    // TODO: Implement
  }
}