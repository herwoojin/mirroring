'use client';

// 글자 크기 토글 (첫 화면 우상단 상시 노출)
// TRD 2.1: 설정은 localStorage가 아닌 메모리 상태 + user_preferences(로그인 시)
import { useEffect, useState } from 'react';
import { COPY } from '@/lib/copy.ko';

export default function FontScaleToggle() {
  const [large, setLarge] = useState(false);

  useEffect(() => {
    setLarge(document.documentElement.dataset.fontScale === 'large');
  }, []);

  function toggle() {
    const next = !large;
    setLarge(next);
    document.documentElement.dataset.fontScale = next ? 'large' : 'base';
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={COPY.fontScaleToggleAria}
      aria-pressed={large}
      className="pressable min-w-[64px] min-h-[64px] px-4 rounded-big border-2 border-line bg-surface text-primary flex items-center gap-2"
    >
      <span aria-hidden="true" className="text-2xl">
        {large ? '🔍' : '🔠'}
      </span>
      <span className="text-caption font-semibold">
        {large ? COPY.fontScaleBase : COPY.fontScaleLarge}
      </span>
    </button>
  );
}
