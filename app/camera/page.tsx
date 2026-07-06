'use client';

// /camera — 폰 카메라를 PC로 보내기 (전용, 간단·확실)
// 흐름: 숫자 6개 입력 → [카메라 켜기](제스처) → 자동 연결 → PC에 카메라 화면 표시
import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import NumPad from '@/components/NumPad';
import BigButton from '@/components/BigButton';
import ErrorHelpCard from '@/components/ErrorHelpCard';
import { COPY, statusCopy } from '@/lib/copy.ko';
import type { StatusKey, FailReason } from '@/lib/copy.ko';
import { startCameraCapture, flipCamera, stopCapture } from '@/lib/capture';
import { joinRoom } from '@/lib/room';
import { openSignalingChannel, roomChannelName } from '@/lib/signaling';
import { PeerSession, fetchIceServers, generatePeerId } from '@/lib/webrtc';

type Phase = 'code' | 'ready' | 'live';

function CameraPageInner() {
  const params = useSearchParams();
  const preCode = params.get('code');

  const [phase, setPhase] = useState<Phase>(preCode ? 'ready' : 'code');
  const [code, setCode] = useState(preCode ?? '');
  const [status, setStatus] = useState<StatusKey>('idle');
  const [error, setError] = useState<FailReason | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<PeerSession | null>(null);

  // 코드 입력 완료 → 방 확인
  const handleCode = useCallback(async (c: string) => {
    const r = await joinRoom(c, 'numpad');
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setCode(c);
    setPhase('ready');
  }, []);

  // 카메라 켜기 (사용자 제스처) → 연결
  const startCamera = useCallback(async () => {
    try {
      const { stream } = await startCameraCapture('environment');
      streamRef.current = stream;
      setFacing('environment');
      if (videoRef.current) videoRef.current.srcObject = stream;

      const iceServers = await fetchIceServers();
      const channel = openSignalingChannel(roomChannelName(code));
      const session = new PeerSession({
        config: { iceServers },
        channel,
        peerId: generatePeerId(),
        polite: false, // 미디어 보유측(offer 주도)
        events: {
          onStatus: (s) => setStatus(s),
          onTrack: () => {},
          onConnectionType: () => {},
          onStats: () => {},
          onError: (reason) => setError(reason as FailReason),
        },
      });
      session.addStream(stream);
      session.join('sender', {});
      sessionRef.current = session;
      setPhase('live');
    } catch (e: any) {
      setError(e?.name === 'NotAllowedError' ? 'permission-denied' : 'ice-failed');
    }
  }, [code]);

  // 앞뒤 카메라 전환 (연결 유지한 채 트랙 교체)
  const handleFlip = useCallback(async () => {
    if (!streamRef.current) return;
    try {
      const { stream, facing: newFacing } = await flipCamera(streamRef.current, facing);
      streamRef.current = stream;
      setFacing(newFacing);
      if (videoRef.current) videoRef.current.srcObject = stream;
      // 세션의 보내는 영상 트랙 교체
      const newTrack = stream.getVideoTracks()[0];
      const sender = sessionRef.current?.pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && newTrack) await sender.replaceTrack(newTrack);
    } catch {}
  }, [facing]);

  const goHome = () => {
    try {
      stopCapture(streamRef.current);
      sessionRef.current?.close();
    } catch {}
    window.location.href = '/';
  };

  useEffect(() => {
    return () => {
      stopCapture(streamRef.current);
      sessionRef.current?.close();
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6 bg-base">
        <ErrorHelpCard
          reason={error}
          onRetry={() => {
            stopCapture(streamRef.current);
            streamRef.current = null;
            sessionRef.current?.close();
            sessionRef.current = null;
            setError(null);
            setStatus('idle');
            setPhase(code && /^\d{6}$/.test(code) && error !== 'room-expired' && error !== 'wrong-code' ? 'ready' : 'code');
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-base text-primary flex flex-col">
      {/* 홈 (링크라 항상 이동) */}
      <a
        href="/"
        onClick={() => { try { stopCapture(streamRef.current); sessionRef.current?.close(); } catch {} }}
        aria-label="처음 화면으로"
        className="pressable absolute top-4 left-4 z-10 min-w-[64px] min-h-[64px] px-4 border-2 border-line bg-surface rounded-big flex items-center gap-2 text-caption text-primary no-underline"
      >
        <span aria-hidden="true" className="text-2xl">🏠</span> 홈
      </a>

      {phase === 'code' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 pt-20">
          <h1 className="text-title text-center">PC 화면의 큰 숫자 6개를 눌러주세요</h1>
          <NumPad onComplete={handleCode} />
        </div>
      )}

      {phase === 'ready' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6 pt-20">
          <div className="text-7xl" aria-hidden="true">📷</div>
          <h1 className="text-title text-center">카메라를 켜서 PC로 보낼게요</h1>
          <p className="text-body text-muted text-center">아래 버튼을 누르면 카메라가 켜져요</p>
          <BigButton icon="📷" label="카메라 켜기" onClick={startCamera} />
        </div>
      )}

      {phase === 'live' && (
        <div className="flex-1 flex flex-col">
          {/* 내 카메라 미리보기 */}
          <div className="relative flex-1 bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
              aria-label="내 카메라 미리보기"
            />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-base/80 rounded-big px-4 py-2 text-caption text-muted">
              {status === 'idle' ? '연결하고 있어요…' : statusCopy(status)}
            </div>
          </div>
          {/* 조작 */}
          <div className="p-4 flex flex-col gap-3 safe-bottom">
            <BigButton icon="🔄" label={COPY.cameraFlip} variant="secondary" onClick={handleFlip} />
            <BigButton icon="⏹️" label={COPY.stop} variant="danger" onClick={goHome} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-base flex items-center justify-center text-body text-muted">{COPY.status_idle}</div>}>
      <CameraPageInner />
    </Suspense>
  );
}
