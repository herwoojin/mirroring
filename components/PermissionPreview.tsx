'use client';

// PermissionPreview (TRD 7.4) — OS별 권한 팝업 프리뷰 + [준비됐어요] 제스처 체인
import { useEffect, useState } from 'react';
import { detectDevice } from '@/lib/detect';
import type { DeviceInfo } from '@/lib/detect';
import { COPY } from '@/lib/copy.ko';
import BigButton from './BigButton';

interface PermissionPreviewProps {
  onReady: () => void; // getDisplayMedia를 호출할 핸들러 (제스처 체인 유지)
}

export default function PermissionPreview({ onReady }: PermissionPreviewProps) {
  // SSR과 클라이언트 렌더가 달라지지 않도록 기기 감지는 마운트 후에만 (hydration 오류 방지)
  const [os, setOs] = useState<DeviceInfo['os']>('other');
  useEffect(() => {
    setOs(detectDevice().os);
  }, []);
  const device = { os };

  // OS별 안내 이미지 alt 텍스트
  const previewAlt =
    device.os === 'android'
      ? '안드로이드 화면 공유 권한 팝업 예시'
      : device.os === 'macos'
        ? '맥 화면 공유 권한 팝업 예시'
        : '윈도우 화면 공유 권한 팝업 예시';

  return (
    <div className="flex flex-col items-center gap-6 px-4">
      {/* 프리뷰 카드 */}
      <div className="w-full max-w-sm bg-surface rounded-big p-6 flex flex-col items-center gap-4 border border-line">
        <div className="w-full aspect-video bg-base rounded-xl flex items-center justify-center text-5xl" aria-label={previewAlt}>
          {device.os === 'android' ? '📱' : device.os === 'macos' ? '💻' : '🖥️'}
          <span className="ml-2 text-4xl">→</span>
          <span className="ml-2 text-3xl text-accent">✓</span>
        </div>
        <p className="text-body text-center text-muted">{COPY.sendStep2Body}</p>
      </div>

      {/* 제스처 체인 유지: onClick → 바로 getDisplayMedia 호출 */}
      <BigButton
        icon="👆"
        label={COPY.sendStep2Ready}
        onClick={onReady}
      />
    </div>
  );
}
