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

export class CloudflareRTCPeer extends EventEmitter {
  private config: RTCPeerConfig;
  private pc: RTCPeerConnection | null;
  private transceivers: RTCRtpTransceiver[];
  private stream: MediaStream | null;
  public connected: boolean;

  constructor(config: RTCPeerConfig) {
    super();
    this.config = config;
    this.transceivers = [];
    this.stream = null;
    this.connected = false;
    this.pc = new RTCPeerConnection({
      iceServers: config.iceServers,
      bundlePolicy: 'max-bundle',
    });

    this.pc.onicecandidate = ({candidate}) => {
      if (candidate) {
        this.emit('candidate', candidate);
      }
    };

    this.pc.ontrack = ({track, streams}) => {
      this.config.logger.logDebug('ontrack', track.kind, track.id);
      if (streams && streams.length > 0) {
        this.emit('stream', streams[0]);
      } else {
        // streams が空の場合は新しいMediaStreamを作成して発火
        const remoteStream = new MediaStream([track]);
        this.emit('stream', remoteStream);
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      this.config.logger.logDebug('connection state change', state);
      if (state === 'connected') {
        this.connected = true;
        this.emit('connect');
      } else if (state === 'failed' || state === 'closed') {
        this.emit('close');
      }
    };
  }

  public async init(stream: MediaStream) {
    if (!this.pc) {
      throw new Error('peer has been destroyed already');
    }

    this.stream = stream;

    const transceivers = stream.getTracks().map((track) => {
      if (!this.pc) {
        throw new Error('peer has been destroyed already');
      }
      return this.pc.addTransceiver(track, {direction: 'sendonly'});
    });
    this.transceivers.push(...transceivers);
  }

  public get_transceivers(stream: MediaStream): RTCRtpTransceiver[] {
    return this.transceivers.filter((t) =>
      stream.getTracks().some((track) => t.sender.track?.id === track.id),
    );
  }

  public async createOffer() {
    if (!this.pc) {
      throw new Error('peer has been destroyed already');
    }

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.emit('offer', this.pc.localDescription);
  }

  public async addUser() {
    if (!this.pc) {
      throw new Error('peer has been destroyed already');
    }

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.emit('addUser', this.transceivers);
  }

  public async signal(data: Record<string, unknown>) {
    if (!this.pc) {
      throw new Error('peer has been destroyed already');
    }

    // data はすでにパース済みのオブジェクトとして受け取る
    const sd = data.sessionDescription as RTCSessionDescriptionInit | undefined;

    if (sd) {
      if (sd.type === 'answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sd));
      } else if (sd.type === 'offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(sd));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.emit('answer', this.pc.localDescription);
      }
      return;
    }

    if (data.candidate) {
      await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit));
    }
  }

  public addScreenStream(stream: MediaStream) {
    if (!this.pc) {
      throw new Error('peer has been destroyed already');
    }
    for (const track of stream.getTracks()) {
      const transceiver = this.pc.addTransceiver(track, {direction: 'sendonly'});
      this.transceivers.push(transceiver);
    }
  }

  public removeScreenTrack(trackID: string) {
    const idx = this.transceivers.findIndex((t) => t.sender.track?.id === trackID);
    if (idx !== -1) {
      this.transceivers[idx].sender.replaceTrack(null);
      this.transceivers.splice(idx, 1);
    }
  }

  public muteTrack(track: MediaStreamTrack) {
    const transceiver = this.transceivers.find((t) => t.sender.track?.id === track.id);
    if (transceiver) {
      transceiver.sender.replaceTrack(null);
    }
  }

  public unmuteTrack(track: MediaStreamTrack) {
    const transceiver = this.transceivers.find(
      (t) => t.sender.track === null || t.sender.track?.kind === track.kind,
    );
    if (transceiver) {
      transceiver.sender.replaceTrack(track);
    }
  }

  // ミュート中でも古いトラックの参照を新トラックに置き換える（送信は停止したまま）
  public replaceAudioTrack(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack) {
    const transceiver = this.transceivers.find((t) =>
      t.sender.track?.id === oldTrack.id || t.sender.track?.kind === 'audio',
    );
    if (transceiver) {
      // null を送ったまま内部参照だけ更新する（次回 unmuteTrack で新トラックが使われる）
      // ここでは kind による一致を transceivers 内で更新するのみ
      // 実際の sender には null が入ったまま（ミュート状態を維持）
      this.transceivers = this.transceivers.map((t) => {
        if (t === transceiver) {
          // sender.track は replaceTrack で null になっているので kind で追跡
          // unmuteTrack 呼び出し時に newTrack を渡せるよう、stream を更新
          if (this.stream) {
            const oldStreamTrack = this.stream.getAudioTracks().find((st) => st.id === oldTrack.id);
            if (oldStreamTrack) {
              this.stream.removeTrack(oldStreamTrack);
              this.stream.addTrack(newTrack);
            }
          }
        }
        return t;
      });
    }
  }

  public getStats(): Promise<RTCStatsReport> {
    if (!this.pc) {
      return Promise.reject(new Error('peer has been destroyed already'));
    }
    return this.pc.getStats();
  }

  public destroy() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.removeAllListeners();
  }
}
