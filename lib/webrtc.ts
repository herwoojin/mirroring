// webrtc.ts — Perfect Negotiation WebRTC 래퍼 (TRD 4.2, 4.6)
// 상태 이벤트는 copy.ko.ts의 StatusKey로 발행 → UI가 쉬운 문구로 표시
//
// 협상 토폴로지:
//  - 미디어를 가진 쪽(sender)이 offer를 주도한다. sender = impolite(polite:false)
//  - viewer(트랙 없음)는 절대 먼저 offer를 만들지 않는다. viewer = polite(polite:true)
//  - sender는 'join'(뷰어 입장/재입장)을 받으면 재-offer한다
//  - 충돌(glare)은 perfect negotiation 규칙으로 해소

import type { SignalingChannel, SignalMessage } from './signaling';
import type { StatusKey } from './copy.ko';

export type ConnectionType = 'host' | 'srflx' | 'relay' | 'unknown';

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export interface PeerEvents {
  onStatus: (status: StatusKey) => void;
  onTrack: (stream: MediaStream) => void;
  onConnectionType: (type: ConnectionType) => void;
  onStats: (stats: RTCStatsReport) => void;
  onError: (reason: string) => void;
  onCustom?: (msg: SignalMessage) => void; // pair-invite 등 앱 레벨 메시지
}

// maxBitrate 3단계 (TRD 4.6)
const BITRATE_LEVELS = [2_500_000, 1_200_000, 600_000];

export class PeerSession {
  pc: RTCPeerConnection;
  private channel: SignalingChannel;
  private peerId: string;
  private polite: boolean; // perfect negotiation 역할
  private makingOffer = false;
  private ignoreOffer = false;
  private hasMedia = false; // 송출 트랙 보유 여부 (offer 주도권)
  private remotePeerId: string | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private signalQueue = Promise.resolve(); // 시그널 순차 처리 체인
  private events: PeerEvents;
  private reconnectCount = 0;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private bitrateLevel = 0;
  private closed = false;

  constructor(opts: {
    config: WebRTCConfig;
    channel: SignalingChannel;
    peerId: string;
    polite: boolean;
    events: PeerEvents;
  }) {
    this.channel = opts.channel;
    this.peerId = opts.peerId;
    this.polite = opts.polite;
    this.events = opts.events;

    this.pc = new RTCPeerConnection({
      iceServers: opts.config.iceServers,
      iceCandidatePoolSize: 4,
    });

    this.setupPcListeners();
    // 도착 순서 보장: 이전 시그널 처리가 끝난 뒤 다음 시그널 처리
    this.channel.onMessage((msg) => {
      this.signalQueue = this.signalQueue
        .then(() => this.handleSignal(msg))
        .catch((e) => console.error('[webrtc] signal error', e));
      return this.signalQueue;
    });
    this.events.onStatus('finding_peer');
  }

  // ── 미디어 추가 (sender) ───────────────────────────
  addStream(stream: MediaStream) {
    for (const track of stream.getTracks()) {
      this.pc.addTrack(track, stream);
    }
    this.hasMedia = true;
    this.applyBitrate();
  }

  // ── Perfect Negotiation 시그널 처리 ────────────────
  private async handleSignal(msg: SignalMessage) {
    if (this.closed) return;
    if (msg.from === this.peerId) return; // 자기 메시지 무시 (에코 방어)
    if (msg.to && msg.to !== this.peerId) return;

    if (msg.type === 'pair-invite' || msg.type === 'role-swap') {
      this.events.onCustom?.(msg);
      return;
    }

    if (msg.type === 'offer' || msg.type === 'answer') {
      const description: RTCSessionDescriptionInit = {
        type: msg.type as RTCSdpType,
        sdp: msg.payload.sdp as string,
      };

      if (msg.type === 'offer') {
        const offerCollision = this.makingOffer || this.pc.signalingState !== 'stable';
        this.ignoreOffer = !this.polite && offerCollision;
        if (this.ignoreOffer) return;
      }

      // 상대 피어 확정/갱신 (재시도 시 새 sender의 offer도 수용 — 새 ufrag = ICE 재시작)
      this.remotePeerId = msg.from;

      await this.pc.setRemoteDescription(description);
      this.flushPendingCandidates();

      if (msg.type === 'offer') {
        await this.pc.setLocalDescription();
        this.channel.send({
          type: 'answer',
          from: this.peerId,
          to: msg.from,
          payload: { sdp: this.pc.localDescription!.sdp },
        });
      }
    } else if (msg.type === 'ice') {
      const candidate = msg.payload.candidate as RTCIceCandidateInit;
      if (!this.pc.remoteDescription) {
        // offer보다 먼저 도착한 후보는 버퍼링
        this.pendingCandidates.push(candidate);
        return;
      }
      try {
        await this.pc.addIceCandidate(candidate);
      } catch (e) {
        if (!this.ignoreOffer) throw e;
      }
    } else if (msg.type === 'join') {
      // 상대 입장/재입장 — 미디어를 가진 쪽만 (재)offer
      if (!this.remotePeerId) this.remotePeerId = msg.from;
      if (this.hasMedia) await this.negotiate();
    } else if (msg.type === 'leave') {
      // 현재 연결 중인 상대의 퇴장만 인정 (이전 세션 잔여 leave 방어)
      if (msg.from === this.remotePeerId) {
        this.events.onStatus('ended');
      }
    }
  }

  private flushPendingCandidates() {
    const pending = this.pendingCandidates.splice(0);
    for (const c of pending) {
      this.pc.addIceCandidate(c).catch(() => {});
    }
  }

  // ── negotiation ─────────────────────────────────────
  private async negotiate() {
    if (this.closed) return;
    try {
      this.makingOffer = true;
      await this.pc.setLocalDescription();
      this.channel.send({
        type: 'offer',
        from: this.peerId,
        to: this.remotePeerId ?? undefined,
        payload: { sdp: this.pc.localDescription!.sdp },
      });
    } catch (e) {
      console.error('[webrtc] negotiate error', e);
    } finally {
      this.makingOffer = false;
    }
  }

  // ── PC 이벤트 리스너 ───────────────────────────────
  private setupPcListeners() {
    // 트랙 추가/ICE 재시작 시 브라우저가 요청.
    // 트랜시버가 하나도 없는 신선한 viewer는 빈 offer를 만들지 않는다.
    this.pc.onnegotiationneeded = () => {
      if (this.hasMedia || this.pc.getTransceivers().length > 0) void this.negotiate();
    };

    this.pc.addEventListener('icecandidateerror', (e) => {
      // 개발 진단용 — TURN 인증 실패/도달 불가 등을 콘솔에서 확인
      console.warn('[webrtc] ICE candidate error', e);
    });

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.channel.send({
          type: 'ice',
          from: this.peerId,
          to: this.remotePeerId ?? undefined,
          payload: { candidate: candidate.toJSON() },
        });
      }
    };

    this.pc.ontrack = ({ streams, track }) => {
      const stream = streams[0] ?? new MediaStream([track]);
      this.events.onTrack(stream);
      this.events.onStatus('connected_p2p'); // 잠정 — getStats로 보정
      this.startStatsPolling();
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc.iceConnectionState;
      if (state === 'connected' || state === 'completed') {
        this.reconnectCount = 0;
        this.detectConnectionType();
      } else if (state === 'disconnected') {
        this.events.onStatus('reconnecting');
        // 5초 후 restartIce (TRD 4.6)
        setTimeout(() => {
          if (!this.closed && this.pc.iceConnectionState === 'disconnected') {
            this.pc.restartIce();
          }
        }, 5000);
      } else if (state === 'failed') {
        this.handleConnectionFailure();
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'failed') {
        this.handleConnectionFailure();
      }
    };
  }

  // ── 재연결 (최대 3회) ──────────────────────────────
  private async handleConnectionFailure() {
    if (this.closed) return;
    this.reconnectCount++;
    if (this.reconnectCount <= 3) {
      this.events.onStatus('reconnecting');
      try {
        this.pc.restartIce();
        if (this.hasMedia) await this.negotiate();
      } catch {
        this.events.onError('ice-failed');
      }
    } else {
      this.events.onError('ice-failed');
      this.events.onStatus('ended');
    }
  }

  // ── getStats → 연결 유형 판별 (host/srflx/relay) ───
  private async detectConnectionType() {
    try {
      const stats = await this.pc.getStats();
      let connType = 'unknown' as ConnectionType;

      stats.forEach((report: any) => {
        // 브라우저별: state=succeeded 또는 selected/nominated
        if (
          report.type === 'candidate-pair' &&
          (report.state === 'succeeded' || report.selected || report.nominated) &&
          report.localCandidateId
        ) {
          const localCandidate = stats.get(report.localCandidateId) as any;
          if (localCandidate) {
            const ct = String(localCandidate.candidateType);
            if (ct === 'host' || ct === 'srflx' || ct === 'relay') connType = ct;
          }
        }
      });

      console.info('[webrtc] 연결 방식:', connType);
      this.events.onConnectionType(connType);
      this.events.onStatus(connType === 'relay' ? 'connected_relay' : 'connected_p2p');
    } catch {
      // 판별 실패해도 서비스 계속
    }
  }

  // ── 1초 폴링 stats (교육 모드 StatsOverlay 용) ─────
  private startStatsPolling() {
    if (this.statsTimer) return;
    this.statsTimer = setInterval(async () => {
      try {
        this.events.onStats(await this.pc.getStats());
      } catch {
        // silent
      }
    }, 1000);
  }

  // ── 비트레이트 적용 ─────────────────────────────────
  private applyBitrate() {
    const videoSender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (!videoSender) return;

    const params = videoSender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = BITRATE_LEVELS[this.bitrateLevel];
    videoSender.setParameters(params).catch(() => {});
  }

  // 품질 단계 조절 (외부에서 호출 가능)
  setBitrateLevel(level: 0 | 1 | 2) {
    this.bitrateLevel = level;
    this.applyBitrate();
  }

  // 앱 레벨 메시지 전송 (pair 저장 알림 등)
  sendSignal(type: SignalMessage['type'], payload: Record<string, unknown>) {
    this.channel.send({ type, from: this.peerId, payload });
  }

  // ── Join 알림 ──────────────────────────────────────
  join(role: 'sender' | 'viewer', device: Record<string, unknown> = {}) {
    this.channel.send({
      type: 'join',
      from: this.peerId,
      payload: { role, device },
    });
  }

  // ── 정리 ───────────────────────────────────────────
  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    this.channel.send({ type: 'leave', from: this.peerId, payload: {} });
    this.pc.close();
    // leave 전송이 나갈 시간을 준 뒤 채널 정리
    setTimeout(() => this.channel.close(), 300);
  }
}

// ── ICE 서버 가져오기 ─────────────────────────────────
export async function fetchIceServers(channelToken?: string): Promise<RTCIceServer[]> {
  try {
    const url = channelToken
      ? `/api/turn-credentials?token=${encodeURIComponent(channelToken)}`
      : '/api/turn-credentials';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`turn ${res.status}`);
    const data = await res.json();
    return data.iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }];
  } catch {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
}

// 유틸: 고유 peerId 생성
export function generatePeerId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
