'use client';

// view/page.tsx — 뷰어: 룸 생성 → 코드/QR 표시 → 수신 → 영상 전체 표시
// PRD: "PC에서 보기" 역할
import { useCallback, useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import CodeDisplay from '@/components/CodeDisplay';
import VideoViewer from '@/components/VideoViewer';
import ErrorHelpCard from '@/components/ErrorHelpCard';
import BigButton from '@/components/BigButton';
import { COPY, statusCopy } from '@/lib/copy.ko';
import type { StatusKey, FailReason } from '@/lib/copy.ko';
import type { ConnectionType } from '@/lib/webrtc';
import { openSignalingChannel, roomChannelName } from '@/lib/signaling';
import { PeerSession, fetchIceServers, generatePeerId } from '@/lib/webrtc';
import { useConnectionMetrics } from '@/lib/useConnectionMetrics';
import { deviceHint } from '@/lib/detect';
import { createRoom } from '@/lib/room';
import AuthGate from '@/components/AuthGate';

function ViewPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const rejoinCode = params.get('code');
  const rejoinToken = params.get('token');

  function goHome() {
    sessionRef.current?.close();
    router.push('/');
  }

  const [code, setCode] = useState(rejoinCode ?? '');
  const [channelToken, setChannelToken] = useState(rejoinToken ?? '');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusKey>('idle');
  const [error, setError] = useState<FailReason | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connType, setConnType] = useState<ConnectionType>('unknown');

  const sessionRef = useRef<PeerSession | null>(null);
  const roomCreatedRef = useRef(false);
  const { tap, markConnected, report } = useConnectionMetrics();

  // 룸 생성 (StrictMode 이중 실행 방지)
  useEffect(() => {
    if (rejoinCode) return; // 재연결 시 기존 코드 사용
    if (roomCreatedRef.current) return;
    roomCreatedRef.current = true;

    (async () => {
      try {
        const room = await createRoom();
        setCode(room.code);
        setChannelToken(room.channelToken);
      } catch {
        setError('timeout');
      }
    })();
  }, [rejoinCode]);

  // QR 코드 생성
  useEffect(() => {
    if (!code || !channelToken) return;

    (async () => {
      try {
        const qrcodeModule = await import('qrcode');
        const QRCode = qrcodeModule.default || qrcodeModule;
        // QR에는 "폰이 접속할 수 있는 주소"를 담는다.
        // PC가 localhost로 열려 있으면 폰은 localhost를 열 수 없으므로 LAN IP로 치환.
        let origin = window.location.origin;
        if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
          try {
            const r = await fetch('/api/host-info');
            const d = await r.json();
            if (d.lanOrigin) origin = d.lanOrigin;
          } catch {}
        }
        const url = `${origin}/send?code=${code}&token=${encodeURIComponent(channelToken)}`;
        setShareUrl(origin);
        const dataUrl = await QRCode.toDataURL(url, {
          width: 400,
          margin: 2,
          color: { dark: '#F4F7FB', light: '#0B1220' },
        });
        setQrDataUrl(dataUrl);
      } catch {
        // QR 생성 실패해도 코드 입력은 가능
      }
    })();
  }, [code, channelToken]);

  // 시그널링 + WebRTC 시작
  useEffect(() => {
    if (!code || !channelToken) return;

    let cancelled = false;

    (async () => {
      const iceServers = await fetchIceServers(channelToken);
      if (cancelled) return;

      const peerId = generatePeerId();
      const channel = openSignalingChannel(roomChannelName(code));

      const session = new PeerSession({
        config: { iceServers },
        channel,
        peerId,
        polite: true, // viewer(수신측)는 polite — 먼저 offer하지 않음
        events: {
          onStatus: (s) => {
            if (cancelled) return;
            setStatus(s);
            if (s === 'connected_p2p' || s === 'connected_relay') {
              markConnected();
            }
            if (s === 'ended') {
              // 상대(폰)가 멈추면 대기 화면으로 복귀 — 같은 코드로 재연결 가능
              setRemoteStream(null);
            }
          },
          onTrack: (stream) => {
            if (!cancelled) setRemoteStream(stream);
          },
          onConnectionType: (t) => {
            if (!cancelled) setConnType(t);
          },
          onStats: () => {},
          onError: (reason) => {
            if (!cancelled) setError(reason as FailReason);
          },
        },
      });

      session.join('viewer', {});
      sessionRef.current = session;
    })();

    return () => {
      cancelled = true;
      sessionRef.current?.close();
    };
  }, [code, channelToken, markConnected]);

  // 기억하기 시트 (연결 성공 3초 후)
  const [showRememberSheet, setShowRememberSheet] = useState(false);
  const [remembered, setRemembered] = useState(false);
  useEffect(() => {
    if (status === 'connected_p2p' || status === 'connected_relay') {
      const t = setTimeout(() => setShowRememberSheet(true), 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const handleRemember = useCallback(async () => {
    tap();
    try {
      const res = await fetch('/api/pairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceAHint: '내 컴퓨터',
          deviceBHint: '휴대폰',
          lastRoleA: 'viewer',
        }),
      });
      const data = await res.json();
      if (data.pairToken) {
        const pairs = JSON.parse(localStorage.getItem('mirroron_pairs') ?? '[]');
        pairs.unshift({ token: data.pairToken, nickname: '휴대폰', lastRole: 'viewer' });
        localStorage.setItem('mirroron_pairs', JSON.stringify(pairs.slice(0, 5)));
        setRemembered(true);
        // 상대(폰)도 같은 토큰을 저장하도록 룸 채널로 알림 — 폰 첫 화면에 [다시 연결] 노출
        sessionRef.current?.sendSignal('pair-invite', {
          action: 'save',
          token: data.pairToken,
          nickname: deviceHint(), // 폰에서 "맥북에 다시 연결"처럼 표시
        });
      }
    } catch {}
    setShowRememberSheet(false);
  }, [tap]);

  // 에러
  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6 bg-base">
        <ErrorHelpCard
          reason={error}
          onRetry={() => {
            setError(null);
            window.location.reload();
          }}
        />
      </div>
    );
  }

  // 영상 수신 중
  if (remoteStream) {
    return (
      <div className="relative w-full h-[100dvh] bg-black">
        <VideoViewer stream={remoteStream} />

        {/* 홈으로 (좌상단, 64px) */}
        <button
          type="button"
          onClick={goHome}
          aria-label="처음 화면으로"
          className="pressable absolute top-4 left-4 min-w-[64px] min-h-[64px] px-4 bg-base/80 rounded-big flex items-center gap-2 text-caption text-primary"
        >
          <span aria-hidden="true" className="text-2xl">🏠</span> 홈
        </button>

        {/* 연결 상태 (상단 중앙) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-base/80 rounded-big px-4 py-2 text-caption text-muted">
          {statusCopy(status)}
        </div>

        {/* 교육 모드 진입 (우하단 작게) */}
        <a
          href="/admin"
          className="absolute bottom-4 right-4 w-12 h-12 bg-surface/80 rounded-full flex items-center justify-center text-xl"
          aria-label={COPY.adminTitle}
        >
          🎓
        </a>

        {/* 기억하기 시트 */}
        {showRememberSheet && !remembered && (
          <div className="absolute bottom-0 left-0 right-0 bg-surface border-t border-line rounded-t-big p-6 flex flex-col gap-4 animate-[slideUp_0.3s_ease-out]">
            <p className="text-title text-center">{COPY.rememberAsk}</p>
            <p className="text-body text-muted text-center">{COPY.rememberBody}</p>
            <div className="flex gap-3">
              <BigButton
                label={COPY.rememberYes}
                onClick={handleRemember}
                className="flex-1"
              />
              <BigButton
                label={COPY.rememberNo}
                variant="secondary"
                onClick={() => setShowRememberSheet(false)}
                className="flex-1"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // 대기: 코드/QR 표시
  const ended = status === 'ended';
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[100dvh] px-6 gap-8 bg-base">
      {/* 홈으로 (좌상단, 64px 상시) */}
      <button
        type="button"
        onClick={goHome}
        aria-label="처음 화면으로"
        className="pressable absolute top-4 left-4 min-w-[64px] min-h-[64px] px-4 border-2 border-line bg-surface rounded-big flex items-center gap-2 text-caption text-primary"
      >
        <span aria-hidden="true" className="text-2xl">🏠</span> 홈
      </button>

      <h1 className="text-title text-center">{ended ? COPY.status_ended : COPY.viewTitle}</h1>

      {/* 연결이 끝났으면 홈으로 큰 버튼 */}
      {ended && (
        <BigButton icon="🏠" label="처음 화면으로 돌아가기" onClick={goHome} />
      )}

      {/* QR 코드 */}
      {qrDataUrl && (
        <div className="flex flex-col items-center gap-2">
          <div className="w-72 h-72 rounded-big overflow-hidden bg-surface p-3">
            <img src={qrDataUrl} alt="QR 코드" className="w-full h-full" />
          </div>
          {shareUrl && (
            <p className="text-caption text-muted">휴대폰 접속 주소: {shareUrl.replace(/^https?:\/\//, '')}</p>
          )}
        </div>
      )}

      {/* 숫자 코드 */}
      {code && (
        <div>
          <p className="text-caption text-muted text-center mb-3">{COPY.viewCodeHint}</p>
          <CodeDisplay code={code} />
        </div>
      )}

      {/* 대기 상태 */}
      <p className="text-body text-muted animate-breathe">
        {status === 'idle' ? COPY.viewWaiting : statusCopy(status)}
      </p>
    </div>
  );
}

export default function ViewPage() {
  return (
    <AuthGate>
      <Suspense fallback={<div className="min-h-[100dvh] bg-base flex items-center justify-center text-body text-muted">{COPY.status_idle}</div>}>
        <ViewPageInner />
      </Suspense>
    </AuthGate>
  );
}
