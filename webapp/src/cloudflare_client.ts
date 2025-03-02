import {EventEmitter} from 'events';
import { CallsClientConfig } from 'src/types/types';

export default class CloudflareCallsClient extends EventEmitter {
  constructor(config: CallsClientConfig) {
    super();
  }

  public async init() {
    // TODO: Implement
  }
}