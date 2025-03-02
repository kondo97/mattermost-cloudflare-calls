import {EventEmitter} from 'events';

interface Logger {
  logDebug: (...args: unknown[]) => void;
  logErr: (...args: unknown[]) => void;
  logWarn: (...args: unknown[]) => void;
  logInfo: (...args: unknown[]) => void;
}

type RTCPeerConfig = {
  iceServers: RTCIceServer[];
  logger: Logger;
  simulcast?: boolean;
  connTimeoutMs?: number;
  dcSignaling?: boolean;
}

class RTCPeer extends EventEmitter {
  constructor(config: RTCPeerConfig) {
    super();
  }

  public async init() {
    // TODO: Implement
  }
}