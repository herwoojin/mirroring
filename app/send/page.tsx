'use client';

// send/page.tsx — 송출 위저드 3단계 (TRD 7.2~7.4, PROMPT P3)
// 1단계: QR 스캔 or 숫자 입력 → 2단계: PermissionPreview → 3단계: 연결 완료 + [멈추기]
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import StepWizard from '@/components/StepWizard';
import QrScanner from '@/components/QrScanner';
import NumPad from '@/components/NumPad';
import PermissionPreview from '@/components/PermissionPreview';
import ErrorHelpCard from '@/components/ErrorHelpCard';
import BigButton from '@/components/BigButton';
import { COPY, statusCopy } from '@/lib/copy.ko';
import { startScreenCapture, startCameraCapture, stopCapture } from '@/lib/capture';
import { detectCaptureSupport, detectDevice } from '@/lib/detect';
import { joinRoom } from '@/lib/room';
import { openSignalingChannel, roomChannelName } from '@/lib/signaling';
import { PeerSession, fetchIceServers, generatePeerId } from '@/lib/webrtc';
import { useConnectionMetrics } from '@/lib/useConnectionMetrics';
import type { StatusKey, FailReason } from '@/lib/copy.ko';
import type { ConnectionType } from '@/lib/webrtc';

function SendPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const cameraMode = params.get('camera') === '1';
  const rejoinCode = params.get('code');
  const rejoinToken = params.get('token');

  const [step, setStep] = useState(rejoinCode ? 1 : 0); // 재연결 시 QR 스킵
  const [mode, setMode] = useState<'qr' | 'numpad'>('qr');
  // 화면 캡처 미지원 감지: iOS(정책상 불가) / 안드로이드 비크롬 브라우저(크롬 유도)
  const [cameraFallback, setCameraFallback] = useState(false);
  const [deviceOs, setDeviceOs] = useState<'android' | 'ios' | 'other'>('other');
  // 안내를 보고 사용자가 "카메라로 계속"을 선택했는지
  const [cameraAccepted, setCameraAccepted] = useState(false);
  useEffect(() => {
    setCameraFallback(detectCaptureSupport() === 'camera-only');
    const os = detectDevice().os;
    setDeviceOs(os === 'android' || os === 'ios' ? os : 'other');
  }, []);
  const useCamera = cameraMode || cameraFallback;
  const [code, setCode] = useState(rejoinCode ?? '');
  const [channelToken, setChannelToken] = useState(rejoinToken ?? '');
  const [status, setStatus] = useState<StatusKey>('idle');
  const [error, setError] = useState<FailReason | null>(null);
  const [connected, setConnected] = useState(false);
  const [connType, setConnType] = useState<ConnectionType>('unknown');

  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<PeerSession | null>(null);
  const { tap, markConnected, markAbandon, report } = useConnectionMetrics();

  // 딥링크(카메라 앱 QR·재연결) 진입: 룸 유효성 검증
  useEffect(() => {
    if (!rejoinCode) return;
    joinRoom(rejoinCode, 'deeplink').then((r) => {
      if (!r.ok && r.reason === 'room-expired') setError('room-expired');
    });
  }, [rejoinCode]);

  // 코드 획득 후 자동 진행
  const handleCodeAcquired = useCallback(async (inputCode: string, token?: string) => {
    tap();
    setCode(inputCode);

    const r = await joinRoom(inputCode, mode === 'qr' ? 'qr' : 'numpad');
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setChannelToken(token ?? '');
    setStep(1); // PermissionPreview
  }, [mode, tap]);

  // QR 스캔 결과 처리
  const handleQrScan = useCallback((value: string) => {
    tap();
    // QR에 코드 + 토큰 포함 형태: mirroron://code=123456&token=xxx 또는 URL ?code=xxx
    try {
      const url = new URL(value);
      const c = url.searchParams.get('code');
      const t = url.searchParams.get('token');
      if (c && /^\d{6}$/.test(c)) {
        handleCodeAcquired(c, t ?? undefined);
        return;
      }
    } catch {}
    // 숫자 6자리 직접 인코딩
    if (/^\d{6}$/.test(value)) {
      handleCodeAcquired(value);
    }
  }, [handleCodeAcquired, tap]);

  // 화면 캡처 시작 (제스처 체인 유지 — 동기 호출)
  const handlePermissionReady = useCallback(async () => {
    tap();
    try {
      const result = useCamera
        ? await startCameraCapture()
        : await startScreenCapture();
      streamRef.current = result.stream;

      // 트랙 종료 감지 (사용자가 [공유 중지] 클릭 시)
      result.stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        handleStop();
      });

      // WebRTC 세션 시작
      const iceServers = await fetchIceServers(channelToken || undefined);
      const peerId = generatePeerId();
      const channel = openSignalingChannel(roomChannelName(code));

      const session = new PeerSession({
        config: { iceServers },
        channel,
        peerId,
        polite: false, // sender(미디어 보유·offer 주도측)는 impolite
        events: {
          onStatus: (s) => {
            setStatus(s);
            if (s === 'connected_p2p' || s === 'connected_relay') {
              markConnected();
              setConnected(true);
            }
          },
          onTrack: () => {},
          onConnectionType: (t) => setConnType(t),
          onStats: () => {},
          onError: (reason) => setError(reason as FailReason),
          // PC가 [기억하기]를 누르면 폰에도 pair 토큰 저장 → 첫 화면 [다시 연결] 노출
          onCustom: (msg) => {
            if (msg.type !== 'pair-invite') return;
            const p = msg.payload as { action?: string; token?: string; nickname?: string };
            if (p.action !== 'save' || !p.token) return;
            try {
              const pairs = JSON.parse(localStorage.getItem('mirroron_pairs') ?? '[]');
              if (!pairs.some((x: { token: string }) => x.token === p.token)) {
                pairs.unshift({ token: p.token, nickname: p.nickname ?? '컴퓨터', lastRole: 'sender' });
                localStorage.setItem('mirroron_pairs', JSON.stringify(pairs.slice(0, 5)));
              }
            } catch {}
          },
        },
      });

      session.addStream(result.stream);
      session.join('sender', {});
      sessionRef.current = session;

      setStep(2); // 완료 화면
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') {
        setError('permission-denied');
      } else {
        setError('ice-failed');
      }
    }
  }, [useCamera, channelToken, code, tap, markConnected]);

  // 멈추기
  const handleStop = useCallback(() => {
    stopCapture(streamRef.current);
    sessionRef.current?.close();
    report({
      roomId: code,
      result: connected ? 'connected' : 'disconnected',
      connectionType: connType,
    });
    router.push('/');
  }, [code, connected, connType, report, router]);

  // 뒤로가기
  const handleBack = useCallback(() => {
    if (step === 0) {
      markAbandon(1);
      router.push('/');
    } else if (step === 1) {
      setStep(0);
    }
  }, [step, markAbandon, router]);

  // 에러 시
  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6 bg-base">
        <ErrorHelpCard
          reason={error}
          onRetry={() => {
            // 이전 카메라·연결을 확실히 정리해야 다시 잡힘 (재시도 실패 방지)
            stopCapture(streamRef.current);
            streamRef.current = null;
            sessionRef.current?.close();
            sessionRef.current = null;
            setConnected(false);
            setStatus('idle');
            setError(null);
            // 코드를 이미 알고 있으면 QR 재스캔 없이 [준비됐어요]부터 다시
            setStep(code && /^\d{6}$/.test(code) && error !== 'room-expired' && error !== 'wrong-code' ? 1 : 0);
          }}
        />
      </div>
    );
  }

  // 위저드 단계
  const steps = [
    // 단계 1: QR or NumPad
    {
      title: mode === 'qr' ? COPY.sendStep1Title : COPY.sendStep1NumpadTitle,
      illustration: mode === 'qr' ? (
        <QrScanner onScan={handleQrScan} />
      ) : (
        <NumPad onComplete={(c) => handleCodeAcquired(c)} />
      ),
      action: mode === 'qr' ? (
        <BigButton
          icon="🔢"
          label={COPY.sendStep1Numpad}
          variant="secondary"
          onClick={() => { tap(); setMode('numpad'); }}
        />
      ) : (
        <BigButton
          icon="📷"
          label={COPY.sendStep1Title.replace('비춰주세요', '찍기')}
          variant="secondary"
          onClick={() => { tap(); setMode('qr'); }}
        />
      ),
    },
    // 단계 2: 권한 준비 — 화면 캡처 가능 여부에 따라 분기
    cameraFallback && !cameraMode && !cameraAccepted
      ? {
          // 모바일 브라우저는 화면 송출 미지원(iOS·Android 공통 플랫폼 제한) → 담백하게 안내
          title: deviceOs === 'ios' ? COPY.iosNotice : COPY.androidNotice,
          body: COPY.androidNoticeBody,
          illustration: (
            <div className="text-7xl" aria-hidden="true">📵</div>
          ),
          action: (
            <div className="flex flex-col gap-3">
              {deviceOs === 'android' && (
                // 미러온 컴패니언 앱(진짜 화면 송출) 딥링크 — 설치돼 있으면 열림
                <BigButton
                  icon="📲"
                  label={COPY.openApp}
                  onClick={() => {
                    tap();
                    window.location.href = `mirroron://send?code=${code}&host=${encodeURIComponent(window.location.host)}`;
                  }}
                />
              )}
              <BigButton
                icon="📷"
                label={COPY.iosCameraBtn}
                variant={deviceOs === 'android' ? 'secondary' : 'primary'}
                onClick={() => { tap(); setCameraAccepted(true); }}
              />
              {deviceOs !== 'android' && (
                <BigButton
                  icon="📖"
                  label={COPY.iosGuideBtn}
                  variant="secondary"
                  onClick={() => { tap(); router.push('/guide'); }}
                />
              )}
              {deviceOs === 'android' && (
                <a
                  href="/mirroron-companion.apk"
                  className="text-caption text-muted underline underline-offset-4 text-center min-h-[48px] inline-flex items-center justify-center"
                >
                  앱이 없다면 여기서 내려받기 (APK)
                </a>
              )}
            </div>
          ),
        }
      : {
          title: COPY.sendStep2Title,
          illustration: <PermissionPreview onReady={handlePermissionReady} />,
        },
    // 단계 3: 완료 (연결될 때까지는 진행 상태를 쉬운 문구로 표시)
    {
      title: connected ? COPY.sendStep3Title : statusCopy(status),
      body: connected ? COPY.sendStep3Body : undefined,
      illustration: (
        <div className="text-8xl text-success text-center" aria-hidden="true">✓</div>
      ),
      action: (
        <BigButton
          icon="⏹️"
          label={COPY.stop}
          variant="danger"
          onClick={handleStop}
        />
      ),
    },
  ];

  return (
    <StepWizard
      steps={steps}
      current={step}
      onBack={step < 2 ? handleBack : undefined}
    />
  );
}

export default function SendPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-base flex items-center justify-center text-body text-muted">{COPY.status_idle}</div>}>
      <SendPageInner />
    </Suspense>
  );
}
