import {EventEmitter} from 'events';
import {zlibSync, strToU8} from 'fflate';
import {AudioDevices, CallsClientConfig} from 'src/types/types';
import type {CallsClientJoinData, EmojiData} from '@mattermost/calls-common/lib/types';
import {CloudflareRTCPeer} from './cloudflare_peer';
import {
    STORAGE_CALLS_DEFAULT_AUDIO_INPUT_KEY,
    STORAGE_CALLS_DEFAULT_AUDIO_OUTPUT_KEY,
} from 'src/constants';
import {logDebug, logErr, logWarn, logInfo} from './log';
import {getScreenStream} from './utils';
import {WebSocketClient, WebSocketError, WebSocketErrorType} from './websocket';

export const insecureContextErr = new Error('insecure context');
export const rtcPeerErr = new Error('rtc peer error');
export const rtcPeerTimeoutErr = new Error('timed out waiting for rtc connection');
export const rtcPeerCloseErr = new Error('rtc peer close');

export default class CloudflareCallsClient extends EventEmitter {
  public channelID: string;
  private readonly config: CallsClientConfig;
  private peer: CloudflareRTCPeer | null;
  public ws: WebSocketClient | null;
  private stream: MediaStream | null;
  private streams: MediaStream[];
  private audioTrack: MediaStreamTrack | null;
  private localScreenTrack: MediaStreamTrack | null;
  private remoteScreenTrack: MediaStreamTrack | null;
  private remoteVoiceTracks: MediaStreamTrack[];
  private audioDevices: AudioDevices;
  public currentAudioInputDevice: MediaDeviceInfo | null;
  public currentAudioOutputDevice: MediaDeviceInfo | null;
  private closed: boolean;
  private connected: boolean;
  public initTime: number;
  private readonly onDeviceChange: () => void;
  private readonly onBeforeUnload: () => void;

  constructor(config: CallsClientConfig) {
    super();
    this.channelID = '';
    this.config = config;
    this.peer = null;
    this.ws = null;
    this.stream = null;
    this.streams = [];
    this.audioTrack = null;
    this.localScreenTrack = null;
    this.remoteScreenTrack = null;
    this.remoteVoiceTracks = [];
    this.audioDevices = {inputs: [], outputs: []};
    this.currentAudioInputDevice = null;
    this.currentAudioOutputDevice = null;
    this.closed = false;
    this.connected = false;
    this.initTime = Date.now();
    this.onDeviceChange = async () => {
      await this.updateDevices();
    };
    this.onBeforeUnload = () => {
      logDebug('unload');
      this.disconnect();
    };
    window.addEventListener('beforeunload', this.onBeforeUnload);
  }

  private async updateDevices() {
    logDebug('a/v device change detected');
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.audioDevices = {
        inputs: devices.filter((device) => device.kind === 'audioinput'),
        outputs: devices.filter((device) => device.kind === 'audiooutput'),
      };
      this.emit('devicechange', this.audioDevices);
    } catch (err) {
      logErr(err);
    }
  }

  private async initAudio(deviceId?: string) {
    const audioOptions: MediaTrackConstraints = {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
    };

    if (deviceId) {
      audioOptions.deviceId = { exact: deviceId };
    }

    const defaultInputID = window.localStorage.getItem(STORAGE_CALLS_DEFAULT_AUDIO_INPUT_KEY);
    const defaultOutputID = window.localStorage.getItem(STORAGE_CALLS_DEFAULT_AUDIO_OUTPUT_KEY);

    if (defaultInputID && !this.currentAudioInputDevice) {
      const devices = this.audioDevices.inputs.filter((dev) => dev.deviceId === defaultInputID);
      if (devices.length === 1) {
        logDebug(`found default audio input device to use: ${devices[0].label}`);
        audioOptions.deviceId = { exact: defaultInputID };
        this.currentAudioInputDevice = devices[0];
      } else {
        logDebug('audio input device not found');
        window.localStorage.removeItem(STORAGE_CALLS_DEFAULT_AUDIO_INPUT_KEY);
      }
    }

    if (defaultOutputID) {
      const devices = this.audioDevices.outputs.filter((dev) => dev.deviceId === defaultOutputID);
      if (devices.length === 1) {
        logDebug(`found default audio output device to use: ${devices[0].label}`);
        this.currentAudioOutputDevice = devices[0];
      } else {
        logDebug('audio output device not found');
        window.localStorage.removeItem(STORAGE_CALLS_DEFAULT_AUDIO_OUTPUT_KEY);
      }
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: audioOptions,
      });

      await this.updateDevices();

      this.audioTrack = this.stream.getAudioTracks()[0];
      this.streams.push(this.stream);

      // start muted
      this.audioTrack.enabled = false;

      this.emit('initaudio');
    } catch (err) {
      logErr(err);
      throw err;
    }
  }

  private cleanup() {
    this.streams.forEach((s) => {
      s.getTracks().forEach((track) => {
        track.stop();
        track.dispatchEvent(new Event('ended'));
      });
    });
  }

  public async init(joinData: CallsClientJoinData) {
    this.channelID = joinData.channelID;

    if (!window.isSecureContext) {
        throw insecureContextErr;
    }

    await this.updateDevices();
    navigator.mediaDevices.addEventListener('devicechange', this.onDeviceChange);

    try {
        await this.initAudio();
        if (this.closed) {
            this.cleanup();
            return;
        }
    } catch (err) {
        this.emit('error', err);
    }

    // authToken は CallsClientConfig に存在しないため省略
    const ws = new WebSocketClient(this.config.wsURL);
    this.ws = ws;

    ws.on('error', (err: WebSocketError) => {
      logErr('ws error', err);
      switch (err.type) {
      case WebSocketErrorType.Native:
          break;
      case WebSocketErrorType.ReconnectTimeout:
          this.ws = null;
          this.disconnect(err);
          break;
      case WebSocketErrorType.Join:
          this.disconnect(err);
          break;
      default:
      }
    });

    ws.on('close', (code?: number) => {
      logDebug(`ws close: ${code}`);
    });

    ws.on('open', (originalConnID: string, prevConnID: string, isReconnect: boolean) => {
      if (isReconnect) {
          logDebug('ws reconnect, sending reconnect msg');
          ws.send('reconnect', {
              channelID: joinData.channelID,
              originalConnID,
              prevConnID,
          });
      } else {
          logDebug('ws open, sending join msg');
          ws.send('join', joinData);
      }
    });

    ws.on('join', async () => {
        logDebug('join ack received, initializing connection');

        // 既にpeerが存在する場合（予期しない再join）は破棄して再初期化
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

        const peer = new CloudflareRTCPeer({
            iceServers: this.config.iceServers || [],
            logger: {
                logDebug,
                logErr,
                logWarn,
                logInfo,
            },
            simulcast: this.config.simulcast,
            dcSignaling: this.config.dcSignaling,
        });

        this.peer = peer;

        const sdpHandler = (sdp: RTCSessionDescription) => {
            const payload = JSON.stringify(sdp);
            ws.send('sdp', {
                data: zlibSync(strToU8(payload)),
            }, true);
        };

        // 初回join時のofferはトラック情報も含めて送信する
        const offerWithTracksHandler = (sdp: RTCSessionDescription) => {
            const payload = JSON.stringify(sdp);

            if (!this.stream) {
                logErr('no stream available');
                return;
            }

            const transceivers = peer.get_transceivers(this.stream);

            ws.send('sdp', {
                tracks: transceivers.map(({mid, sender}) => ({
                    location: 'local',
                    mid,
                    trackName: sender.track?.id,
                })),
                sdp: zlibSync(strToU8(payload)),
            }, true);
        };

        peer.on('offer', offerWithTracksHandler);
        peer.on('answer', sdpHandler);

        peer.on('addUser', (transceivers: RTCRtpTransceiver[]) => {
            ws.send('addUser', {
                tracks: transceivers.map(({mid, sender}) => ({
                    location: 'local',
                    mid,
                    trackName: sender.track?.id,
                })),
            });
        });

        peer.on('candidate', (candidate: RTCIceCandidate) => {
            ws.send('ice', {
                data: JSON.stringify(candidate),
            });
        });

        peer.on('stream', (remoteStream: MediaStream) => {
            logDebug('new remote stream received', remoteStream.id);
            this.streams.push(remoteStream);

            if (remoteStream.getAudioTracks().length > 0) {
                this.remoteVoiceTracks.push(...remoteStream.getAudioTracks());
                this.emit('remoteVoiceStream', remoteStream);
            } else if (remoteStream.getVideoTracks().length > 0) {
                this.remoteScreenTrack = remoteStream.getVideoTracks()[0];
                this.emit('remoteScreenStream', remoteStream);
            }
        });

        peer.on('error', (err: Error) => {
            logErr('peer error', err);
            if (!this.closed) {
                this.disconnect(err?.message === rtcPeerTimeoutErr.message ? rtcPeerTimeoutErr : rtcPeerErr);
            }
        });

        peer.on('connect', () => {
            logDebug('rtc connected');
            this.emit('connect');
            this.connected = true;
        });

        peer.on('close', () => {
            logDebug('rtc closed');
            if (!this.closed) {
                this.disconnect(rtcPeerCloseErr);
            }
        });

        try {
            if (!this.stream) {
                throw new Error('no stream available');
            }
            await peer.init(this.stream);
            await peer.createOffer();

            if (this.closed) {
                return;
            }
        } catch (err) {
            logErr(err);
            this.disconnect(err as Error);
        }
    });

    ws.on('message', async (data: Record<string, unknown>) => {
        if (!data) {
            return;
        }
        // sessionDescription がある場合は SDP (answer/offer)、candidate フィールドがある場合は ICE
        // peer.signal() にはすでにパース済みのオブジェクトを渡す
        if (data.sessionDescription || data.candidate) {
            if (this.peer) {
                await this.peer.signal(data);
            }
        }
    });
  }

  public mute() {
    if (!this.peer || !this.audioTrack) {
      return;
    }

    logDebug('muting audio track', this.audioTrack.id);
    this.peer.muteTrack(this.audioTrack);
    this.audioTrack.enabled = false;

    this.emit('mute');

    if (this.ws) {
      this.ws.send('mute', {});
    }
  }

  public async unmute() {
    if (!this.peer) {
      return;
    }

    if (!this.audioTrack) {
      try {
        await this.initAudio();
      } catch (err) {
        this.emit('error', err);
        return;
      }
    }

    if (this.audioTrack) {
      logDebug('unmuting audio track', this.audioTrack.id);
      this.peer.unmuteTrack(this.audioTrack);
      this.audioTrack.enabled = true;
    }

    this.emit('unmute');

    if (this.ws) {
      this.ws.send('unmute', {});
    }
  }

  public raiseHand() {
    this.emit('raise_hand');
    this.ws?.send('raise_hand');
  }

  public unraiseHand() {
    this.emit('lower_hand');
    this.ws?.send('unraise_hand');
  }

  public destroy() {
    this.removeAllListeners('close');
    this.removeAllListeners('connect');
    this.removeAllListeners('remoteVoiceStream');
    this.removeAllListeners('remoteScreenStream');
    this.removeAllListeners('localScreenStream');
    this.removeAllListeners('devicechange');
    this.removeAllListeners('error');
    this.removeAllListeners('initaudio');
    this.removeAllListeners('mute');
    this.removeAllListeners('unmute');
    this.removeAllListeners('raise_hand');
    this.removeAllListeners('lower_hand');
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    navigator.mediaDevices?.removeEventListener('devicechange', this.onDeviceChange);
  }

  public getSessionID() {
    return this.ws?.getOriginalConnID();
  }

  public disconnect(err?: Error) {
    logDebug('disconnect');

    if (this.closed) {
      logErr('client already disconnected');
      return;
    }

    this.closed = true;

    // デバイスイベントリスナーを解除
    navigator.mediaDevices?.removeEventListener('devicechange', this.onDeviceChange);
    window.removeEventListener('beforeunload', this.onBeforeUnload);

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    this.cleanup();

    if (this.ws) {
      this.ws.send('leave');
      this.ws.close();
      this.ws = null;
    }

    this.emit('close', err);
  }

  public setScreenStream(screenStream: MediaStream) {
    if (!this.ws || !this.peer || this.localScreenTrack || !screenStream) {
      return;
    }

    const screenTrack = screenStream.getVideoTracks()[0];
    this.localScreenTrack = screenTrack;

    const screenAudioTrack = screenStream.getAudioTracks()[0];
    const stream = screenAudioTrack
      ? new MediaStream([screenTrack, screenAudioTrack])
      : new MediaStream([screenTrack]);

    this.streams.push(stream);

    screenTrack.onended = () => {
      if (screenAudioTrack) {
        screenAudioTrack.stop();
      }
      this.localScreenTrack = null;
      if (!this.ws || !this.peer) {
        return;
      }
      this.peer.removeScreenTrack(screenTrack.id);
      this.ws.send('screen_off');
    };

    logDebug('adding screen stream to peer', stream.id);
    this.peer.addScreenStream(stream);

    this.ws.send('screen_on', {
      data: JSON.stringify({screenStreamID: stream.id}),
    });

    this.emit('localScreenStream', stream);
  }

  public async shareScreen(sourceID?: string, withAudio?: boolean) {
    if (!this.ws || !this.peer) {
      return null;
    }

    const screenStream = await getScreenStream(sourceID, withAudio);
    if (screenStream === null) {
      return null;
    }

    this.setScreenStream(screenStream);
    return screenStream;
  }

  public unshareScreen() {
    if (!this.ws || !this.localScreenTrack) {
      return;
    }
    this.localScreenTrack.stop();
    this.localScreenTrack.dispatchEvent(new Event('ended'));
    this.localScreenTrack = null;
  }

  public getLocalScreenStream(): MediaStream | null {
    if (!this.localScreenTrack) {
      return null;
    }
    return new MediaStream([this.localScreenTrack]);
  }

  public getRemoteScreenStream(): MediaStream | null {
    if (!this.remoteScreenTrack || this.remoteScreenTrack.readyState !== 'live') {
      return null;
    }
    return new MediaStream([this.remoteScreenTrack]);
  }

  public getRemoteVoiceTracks(): MediaStreamTrack[] {
    return this.remoteVoiceTracks.filter((t) => t.readyState === 'live');
  }

  public async setAudioInputDevice(device: MediaDeviceInfo) {
    if (!this.peer) {
      return;
    }

    window.localStorage.setItem(STORAGE_CALLS_DEFAULT_AUDIO_INPUT_KEY, device.deviceId);
    this.currentAudioInputDevice = device;
    this.emit('devicechange', this.audioDevices);

    if (!this.audioTrack || !this.stream) {
      await this.initAudio(device.deviceId);
      return;
    }

    const isEnabled = this.audioTrack.enabled;
    this.audioTrack.stop();

    const newStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        deviceId: {exact: device.deviceId},
        autoGainControl: true,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    this.streams.push(newStream);
    const newTrack = newStream.getAudioTracks()[0];
    newTrack.enabled = isEnabled;

    if (isEnabled) {
      // ミュート解除中の場合はトランシーバーに新トラックをセット
      this.peer.unmuteTrack(newTrack);
    } else {
      // ミュート中でもトランシーバーの参照を新トラックに更新（送信は停止したまま）
      this.peer.replaceAudioTrack(this.audioTrack, newTrack);
    }

    this.audioTrack = newTrack;
  }

  public setAudioOutputDevice(device: MediaDeviceInfo) {
    window.localStorage.setItem(STORAGE_CALLS_DEFAULT_AUDIO_OUTPUT_KEY, device.deviceId);
    this.currentAudioOutputDevice = device;
    this.emit('devicechange', this.audioDevices);
  }

  public sendUserReaction(data: EmojiData) {
    this.ws?.send('react', {
      data: JSON.stringify(data),
    });
  }

  public getAudioDevices() {
    return this.audioDevices;
  }
}
