'use client';

// 첫 화면: 초대형 버튼 2개 + 글자크기 토글 + 가이드 링크 + RejoinButton(있으면)
// PRD 1.4 "한 화면, 한 행동" + TRD 2.2 "첫 화면 2대 버튼 각 35%"
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/BigButton';
import FontScaleToggle from '@/components/FontScaleToggle';
import RejoinButton from '@/components/RejoinButton';
import AuthGate from '@/components/AuthGate';
import { signOutUser, authEnabled } from '@/lib/auth';
import { COPY } from '@/lib/copy.ko';
import { detectCaptureSupport, detectDevice } from '@/lib/detect';
import type { CaptureSupport } from '@/lib/detect';
import { openSignalingChannel, pairChannelName } from '@/lib/signaling';
import { createRoom } from '@/lib/room';

interface SavedPair {
  token: string;
  nickname: string;
  lastRole: 'sender' | 'viewer';
}

export default function HomePage() {
  const router = useRouter();
  const [captureSupport, setCaptureSupport] = useState<CaptureSupport>('full');
  const [os, setOs] = useState<'android' | 'ios' | 'other'>('other');
  const [pairs, setPairs] = useState<SavedPair[]>([]);
  const [rejoinLoading, setRejoinLoading] = useState(false);

  useEffect(() => {
    setCaptureSupport(detectCaptureSupport());
    const d = detectDevice().os;
    setOs(d === 'android' ? 'android' : d === 'ios' ? 'ios' : 'other');

    // localStorage에서 기억된 기기 쌍 불러오기
    try {
      const saved = localStorage.getItem('mirroron_pairs');
      if (saved) setPairs(JSON.parse(saved));
    } catch {}
  }, []);

  // ⭐v3: 상대 기기가 [다시 연결]을 누르면 pair 채널로 초대가 옴 → 자동 응답
  useEffect(() => {
    if (pairs.length === 0) return;
    const channels = pairs.slice(0, 5).map((pair) => {
      const ch = openSignalingChannel(pairChannelName(pair.token));
      ch.onMessage((msg) => {
        if (msg.type !== 'pair-invite') return;
        const p = msg.payload as { action?: string; code?: string; token?: string };
        if (p.action !== 'connect' || !p.code) return;
        const params = new URLSearchParams({ code: p.code, rejoin: '1' });
        if (p.token) params.set('token', p.token);
        // 지난 역할 그대로 복원 (PC=보기, 폰=보여주기)
        router.push(pair.lastRole === 'viewer' ? `/view?${params}` : `/send?${params}`);
      });
      return ch;
    });
    return () => channels.forEach((c) => c.close());
  }, [pairs, router]);

  async function handleRejoin(pair: SavedPair) {
    setRejoinLoading(true);
    try {
      // 새 룸 생성 (Firebase 또는 로컬 API — lib/room.ts가 자동 분기)
      const room = await createRoom();

      // 상대 기기에 초대 푸시 (pair 채널) — 상대가 미러온을 열어두었으면 자동 연결
      const inviteCh = openSignalingChannel(pairChannelName(pair.token));
      inviteCh.send({
        type: 'pair-invite',
        from: 'rejoin-initiator',
        payload: { action: 'connect', code: room.code, token: room.channelToken },
      });
      setTimeout(() => inviteCh.close(), 2000);

      const params = new URLSearchParams({
        code: room.code,
        token: room.channelToken,
        rejoin: '1',
      });
      router.push(pair.lastRole === 'sender' ? `/send?${params}` : `/view?${params}`);
    } catch {
      // 실패 → 조용히 일반 플로우로 강등
      router.push(pair.lastRole === 'sender' ? '/send' : '/view');
    }
  }

  return (
    <AuthGate>
    <div className="flex flex-col min-h-[100dvh] px-6 py-8 gap-4 safe-bottom">
      {/* 상단: 앱 이름 + 글자크기 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title">{COPY.appName}</h1>
          <p className="text-caption text-muted">{COPY.appTagline}</p>
        </div>
        <div className="flex items-center gap-2">
          <FontScaleToggle />
          {authEnabled() && (
            <button
              type="button"
              onClick={() => signOutUser()}
              aria-label="로그아웃"
              className="pressable min-w-[64px] min-h-[64px] px-3 rounded-big border-2 border-line bg-surface text-caption text-muted"
            >
              나가기
            </button>
          )}
        </div>
      </div>

      {/* ⭐v3 재연결 버튼 (기억된 기기가 있을 때) */}
      {pairs.length > 0 && (
        <div className="flex flex-col gap-3">
          {pairs.slice(0, 3).map((pair) => (
            <RejoinButton
              key={pair.token}
              nickname={pair.nickname}
              onRejoin={() => handleRejoin(pair)}
              loading={rejoinLoading}
            />
          ))}
        </div>
      )}

      {/* 행동 버튼 — 방향(무엇을 어디로)을 제목에 명확히 */}
      <div className="flex-1 flex flex-col gap-4 justify-center">
        {os === 'android' ? (
          <>
            {/* 갤럭시: 화면 미러링은 앱이 담당 */}
            <BigButton
              icon="📱"
              label={COPY.homeSendScreen}
              sub="앱으로 폰 화면을 통째로"
              tall
              onClick={() => router.push('/app')}
            />
            <BigButton
              icon="📷"
              label={COPY.homeSendCameraClear}
              sub="폰 카메라로 비추기"
              variant="secondary"
              onClick={() => router.push('/camera')}
            />
            <BigButton
              icon="🖥️"
              label={COPY.homeViewClear}
              variant="secondary"
              onClick={() => router.push('/view')}
            />
          </>
        ) : captureSupport === 'camera-only' ? (
          <>
            {/* iOS: 화면 송출 불가 → 보기 + 카메라 */}
            <BigButton
              icon="🖥️"
              label={COPY.homeViewClear}
              tall
              onClick={() => router.push('/view')}
            />
            <BigButton
              icon="📷"
              label={COPY.homeSendCameraClear}
              sub="폰 카메라로 비추기"
              variant="secondary"
              onClick={() => router.push('/camera')}
            />
          </>
        ) : (
          <>
            {/* PC: 보기가 기본, 이 컴퓨터 화면 보내기도 가능 */}
            <BigButton
              icon="🖥️"
              label={COPY.homeViewClear}
              tall
              onClick={() => router.push('/view')}
            />
            <BigButton
              icon="💻"
              label={COPY.homePcShare}
              variant="secondary"
              onClick={() => router.push('/send')}
            />
          </>
        )}
      </div>

      {/* 하단: 처음 사용 안내 + 가이드 링크 */}
      <div className="flex flex-col items-center gap-2 pb-4">
        <a
          href="/start"
          className="text-body text-accent underline underline-offset-4 min-h-[48px] inline-flex items-center font-semibold"
        >
          ✨ 처음이신가요? 쉬운 설명 보기
        </a>
        <a
          href="/guide"
          className="text-caption text-muted underline underline-offset-4 min-h-[48px] inline-flex items-center"
        >
          📖 {COPY.homeGuideLink}
        </a>
      </div>
    </div>
    </AuthGate>
  );
}
