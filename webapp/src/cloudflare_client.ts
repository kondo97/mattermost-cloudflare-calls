import {EventEmitter} from 'events';
import { AudioDevices, CallsClientConfig } from 'src/types/types';
import {WebSocketClient, WebSocketError, WebSocketErrorType} from './websocket';
import type {EmojiData, CallsClientJoinData} from '@mattermost/calls-common/lib/types';
import {logDebug, logErr, logInfo, logWarn, persistClientLogs} from './log';
import {
  STORAGE_CALLS_CLIENT_STATS_KEY,
  STORAGE_CALLS_DEFAULT_AUDIO_INPUT_KEY,
  STORAGE_CALLS_DEFAULT_AUDIO_OUTPUT_KEY,
} from 'src/constants';
import {zlibSync, strToU8} from 'fflate';

export const AudioInputPermissionsError = new Error('missing audio input permissions');
export const AudioInputMissingError = new Error('no audio input available');
export const rtcPeerErr = new Error('rtc peer error');
export const rtcPeerTimeoutErr = new Error('timed out waiting for rtc connection');
export const rtcPeerCloseErr = new Error('rtc peer close');
export const insecureContextErr = new Error('insecure context');
export const userRemovedFromChannelErr = new Error('user was removed from channel');
export const userLeftChannelErr = new Error('user has left channel');

type CloudflareCallsClientConfig = CallsClientConfig

// type RTCTrackOptions = {
//   codec: RTCRtpCodecCapability;
// }

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
  private config: RTCPeerConfig;
  private pc: RTCPeerConnection | null;
  private transceivers: RTCRtpTransceiver[];
  private readonly senders: { [key: string]: RTCRtpSender[] };

  constructor(config: RTCPeerConfig) {
    super();
    this.config = config;
    this.pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.cloudflare.com:3478",
        },
      ],
      bundlePolicy: "max-bundle",
    });
    this.transceivers = [];
    this.senders = {};
  }

  public async init(media: MediaStream) {
    if (!this.pc) {
      throw new Error('peer has been destroyed already');
    }

    const transceivers = media.getTracks().map((track) => {
      if (!this.pc) {
        throw new Error('peer has been destroyed already');
      }
      return this.pc.addTransceiver(track, {
        direction: "sendonly",
      });
    });
    this.transceivers.push(...transceivers);

    // const localOffer = await this.pc.createOffer();
    // await this.pc.setLocalDescription(localOffer);

    // this.emit('offer', this.pc.localDescription);
  }

  // public async addTrack(track: MediaStreamTrack, stream: MediaStream, opts?: RTCTrackOptions) {
  //   if (!this.pc) {
  //       throw new Error('peer has been destroyed');
  //   }

  //   let sender : RTCRtpSender;
  //   if (track.kind === 'video') {
  //       // Simulcast

  //       // NOTE: Unfortunately Firefox cannot simulcast screen sharing tracks
  //       // properly (https://bugzilla.mozilla.org/show_bug.cgi?id=1692873).
  //       // TODO: check whether track is coming from screenshare when we
  //       // start supporting video.

  //       // this.logger.logDebug('RTCPeer.addTrack: creating new transceiver on send');
  //       const trx = this.pc.addTransceiver(track, {
  //           direction: 'sendonly',
  //           // sendEncodings: this.config.simulcast && !isFirefox() ? DefaultSimulcastScreenEncodings : FallbackScreenEncodings,
  //           streams: [stream!],
  //       });

  //       if (opts?.codec && trx.setCodecPreferences) {
  //           // this.logger.logDebug('setting video codec preference', opts.codec);
  //           trx.setCodecPreferences([opts.codec]);
  //       }

  //       sender = trx.sender;
  //   } else {
  //       sender = await this.pc.addTrack(track, stream);
  //   }

  //   if (!this.senders[track.id]) {
  //       this.senders[track.id] = [];
  //   }

  //   this.senders[track.id].push(sender);
  // }

  // public replaceTrack(oldTrackID: string, newTrack: MediaStreamTrack | null) {
  //   const senders = this.senders[oldTrackID];
  //   if (!senders) {
  //       throw new Error('senders for track not found');
  //   }

  //   if (newTrack && newTrack.id !== oldTrackID) {
  //       delete this.senders[oldTrackID];
  //       this.senders[newTrack.id] = senders;
  //   }

  //   for (const sender of senders) {
  //       sender.replaceTrack(newTrack);
  //   }
  // }

  public async createOffer() {
    if (!this.pc) {
      throw new Error('peer has been destroyed already');
    }

    const localOffer = await this.pc.createOffer();
    await this.pc.setLocalDescription(localOffer);

    this.emit('offer', this.pc.localDescription);
  }

  public async addUser() {
    if (!this.pc) {
      throw new Error('peer has been destroyed already');
    }

    this.emit('addUser', this.transceivers)
  }

  public get_transceivers(media: MediaStream) {
    return this.transceivers;
  }

  public destroy() {
    if (!this.pc) {
      throw new Error('peer has been destroyed already');
    }
    this.pc = null;
  }

  public async signal(data: string) {
    if (!this.pc) {
      throw new Error('peer has been destroyed already');
    }
   logDebug('RTCPeer.signal: handling remote signaling data', data);

   console.log('signal', data);

    const msg = JSON.parse(data);

    const connected = new Promise((res, rej) => {
        if (!this.pc) {
          throw new Error('peer has been destroyed already');
        }
        // timeout after 5s
        setTimeout(rej, 5000);
        const iceConnectionStateChangeHandler = () => {
        if (!this.pc) {
            throw new Error('peer has been destroyed already');
            }
          if (this.pc.iceConnectionState === "connected") {
            this.pc.removeEventListener(
              "iceconnectionstatechange",
              iceConnectionStateChangeHandler,
            );
            res(undefined);
          }
        };
        this.pc.addEventListener(
          "iceconnectionstatechange",
          iceConnectionStateChangeHandler,
        );
    });

    const type = msg.sessionDescription.type;

    switch (type) {
    case 'answer':
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sessionDescription));
        await connected;
        this.emit('connect');
        break;
    default:
        throw new Error('invalid signaling data received');
    }
  }
}

export default class CloudflareCallsClient extends EventEmitter {
  public channelID: string;
  private readonly config: CloudflareCallsClientConfig;
  private peer: RTCPeer | null;
  public ws: WebSocketClient | null;
  public currentAudioInputDevice: MediaDeviceInfo | null = null;
  public currentAudioOutputDevice: MediaDeviceInfo | null = null;
  private streams: MediaStream[];
  private remoteScreenTrack: MediaStreamTrack | null = null;
  private remoteVoiceTracks: MediaStreamTrack[]
  private voiceTrackAdded: boolean;
  private stream: MediaStream | null;
  public audioTrack: MediaStreamTrack | null;
  private audioDevices: AudioDevices;
  private readonly onDeviceChange: () => void;
  private closed = false;
  private connected = false;

  constructor(config: CloudflareCallsClientConfig) {
    super();
    this.ws = null;
    this.peer = null;
    this.channelID = '';
    this.audioDevices = {inputs: [], outputs: []};
    this.audioTrack = null;
    this.currentAudioInputDevice = null;
    this.currentAudioOutputDevice = null;
    this.remoteVoiceTracks = [];
    this.voiceTrackAdded = false;
    this.streams = [];
    this.stream = null;
    this.audioDevices = {inputs: [], outputs: []};
    this.config = config;
    this.onDeviceChange = async () => {
      await this.updateDevices();
  };
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
          audioOptions.deviceId = {
              exact: deviceId,
          };
      }

      const defaultInputID = window.localStorage.getItem(STORAGE_CALLS_DEFAULT_AUDIO_INPUT_KEY);
      const defaultOutputID = window.localStorage.getItem(STORAGE_CALLS_DEFAULT_AUDIO_OUTPUT_KEY);
      if (defaultInputID && !this.currentAudioInputDevice) {
          const devices = this.audioDevices.inputs.filter((dev) => {
              return dev.deviceId === defaultInputID;
          });

          if (devices && devices.length === 1) {
              logDebug(`found default audio input device to use: ${devices[0].label}`);
              audioOptions.deviceId = {
                  exact: defaultInputID,
              };
              this.currentAudioInputDevice = devices[0];
          } else {
              logDebug('audio input device not found');
              window.localStorage.removeItem(STORAGE_CALLS_DEFAULT_AUDIO_INPUT_KEY);
          }
      }

      if (defaultOutputID) {
          const devices = this.audioDevices.outputs.filter((dev) => {
              return dev.deviceId === defaultOutputID;
          });

          if (devices && devices.length === 1) {
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

          // updating the devices again cause some browsers (e.g Firefox) will
          // return empty labels unless permissions were previously granted.
          await this.updateDevices();

          this.audioTrack = this.stream.getAudioTracks()[0];
          this.streams.push(this.stream);

          this.audioTrack.enabled = false;

          this.emit('initaudio');
      } catch (err) {
          logErr(err);
          if (this.audioDevices.inputs.length > 0) {
              throw AudioInputPermissionsError;
          }
          throw AudioInputMissingError;
      }
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

    const ws = new WebSocketClient(this.config.wsURL, this.config.authToken);
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

    ws.on('join', async (data) => {
        console.log('join', data);
        logDebug('join ack received, initializing connection');

        const peer = new RTCPeer({
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

        // this.collectICEStats();

        // this.rtcMonitor = new RTCMonitor({
        //     peer,
        //     logger: {
        //         logDebug,
        //         logErr,
        //         logWarn,
        //         logInfo,
        //     },
        //     monitorInterval: rtcMonitorInterval,
        // });
        // this.rtcMonitor.on('mos', (mos: number) => this.emit('mos', mos));

        const sdpHandler = (sdp: RTCSessionDescription) => {
            const payload = JSON.stringify(sdp);

            // SDP data is compressed using zlib since it's text based
            // and can grow substantially, potentially hitting the maximum
            // message size (4KB).
            ws.send('sdp', {
                data: zlibSync(strToU8(payload)),
            }, true);
        };

        const sdpandtrackHandler = (sdp: RTCSessionDescription) => {
            const payload = JSON.stringify(sdp);

            if (!this.stream) {
                logErr('no stream available');
                return;
            }

            const transceivers = peer.get_transceivers(this.stream);

            // SDP data is compressed using zlib since it's text based
            // and can grow substantially, potentially hitting the maximum
            // message size (4KB).
            if (data.first_join) {
              ws.send('sdp', {
                tracks: transceivers.map(({ mid, sender }) => ({
                  location: "local",
                  mid,
                  trackName: sender.track?.id,
                })),
                sdp: zlibSync(strToU8(payload)),
              }, true);
            } else {
              ws.send('sdp', {
                sdp: zlibSync(strToU8(payload)),
              }, true);
            }
        }

        // peer.on('offer', sdpHandler);
        peer.on('offer', sdpandtrackHandler);
        peer.on('answer', sdpHandler);

        peer.on('addUser', (transceivers: RTCRtpTransceiver[]) => {
            ws.send('addUser', {
                tracks: transceivers.map(({ mid, sender }) => ({
                    location: "local",
                    mid,
                    trackName: sender.track?.id,
                })),
            });
        });

        peer.on('candidate', (candidate) => {
            ws.send('ice', {
                data: JSON.stringify(candidate),
            });
        });

        peer.on('error', (err) => {
            logErr('peer error', err);
            if (!this.closed) {
                this.disconnect(err === rtcPeerTimeoutErr.message ? rtcPeerTimeoutErr : rtcPeerErr);
            }
        });

        // peer.on('stream', (remoteStream) => {
        //     logDebug('new remote stream received', remoteStream.id);
        //     for (const track of remoteStream.getTracks()) {
        //         logDebug('remote track', track.kind, track.id);
        //     }

        //     this.streams.push(remoteStream);

        //     if (remoteStream.getAudioTracks().length > 0) {
        //         this.emit('remoteVoiceStream', remoteStream);
        //         this.remoteVoiceTracks.push(...remoteStream.getAudioTracks());
        //     } else if (remoteStream.getVideoTracks().length > 0) {
        //         this.emit('remoteScreenStream', remoteStream);
        //         this.remoteScreenTrack = remoteStream.getVideoTracks()[0];
        //     }
        // });

        peer.on('connect', () => {
            logDebug('rtc connected');

            this.emit('connect');
            // this.rtcMonitor?.start();
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

            if (data.first_join) {
              await peer.createOffer();
            } else {
              await peer.addUser();
            }

            if (this.closed) {
                return;
            }
        } catch (err) {
            logErr(err);
            this.disconnect(err);
        }
    });

    ws.on('message', async ({data}) => {
        const msg = JSON.parse(data);
        if (!msg) {
            return;
        }
        const type = msg.sessionDescription.type;
        if (type === 'answer' || type === 'offer' || type === 'candidate') {
            if (this.peer) {
                await this.peer.signal(data);
            }
        }
    });
  }

  public mute() {
    if (!this.peer || !this.audioTrack || !this.stream) {
      return;
    }

    logDebug('replacing track to peer', null);

    // @ts-ignore: we actually mean (and need) to pass null here
    // this.peer.replaceTrack(this.audioTrack.id, null);

    this.audioTrack.enabled = false;

    this.emit('mute');

    if (this.ws) {
        this.ws.send('mute');
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

    // if (this.audioTrack) {
    //   if (this.voiceTrackAdded) {
    //       logDebug('replacing track to peer', this.audioTrack.id);
    //       this.peer.replaceTrack(this.audioTrack.id, this.audioTrack);
    //   } else if (this.stream) {
    //       logDebug('adding track to peer', this.audioTrack.id, this.stream.id);
    //       await this.peer.addTrack(this.audioTrack, this.stream);
    //       this.voiceTrackAdded = true;
    //   }
    //   this.audioTrack.enabled = true;
    // }

    this.emit('unmute');

    if (this.ws) {
      this.ws.send('unmute');
    }
  }

  public disconnect(err?: Error) {
      logDebug('disconnect');

      if (this.closed) {
          logErr('client already disconnected');
          return;
      }

      // this.rtcMonitor?.stop();

      this.closed = true;
      if (this.peer) {
          // this.getStats().then((stats) => {
          //     getPersistentStorage().setItem(STORAGE_CALLS_CLIENT_STATS_KEY, JSON.stringify(stats));
          // }).catch((statsErr) => {
          //     logErr(statsErr);
          // });
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

  private cleanup() {
    this.streams.forEach((s) => {
        s.getTracks().forEach((track) => {
            track.stop();
            track.dispatchEvent(new Event('ended'));
        });
    });
  }

  public getRemoteScreenStream(): MediaStream|null {
    if (!this.remoteScreenTrack || this.remoteScreenTrack.readyState !== 'live') {
        return null;
    }
    return new MediaStream([this.remoteScreenTrack]);
  }

  public getRemoteVoiceTracks(): MediaStreamTrack[] {
    const tracks = [];
    for (const track of this.remoteVoiceTracks) {
        if (track.readyState === 'live') {
            tracks.push(track);
        }
    }
    return tracks;
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
    this.removeAllListeners('mos');
    // window.removeEventListener('beforeunload', this.onBeforeUnload);
    navigator.mediaDevices?.removeEventListener('devicechange', this.onDeviceChange);
    persistClientLogs();
  }

  public getSessionID() {
    return this.ws?.getOriginalConnID();
  }
}