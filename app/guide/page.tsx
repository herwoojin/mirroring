'use client';

// guide/page.tsx — "어떤 기기끼리 연결하나요?" 2×2 대형 카드 (PRD, PROMPT P4)
import { useRouter } from 'next/navigation';
import BigButton from '@/components/BigButton';
import { COPY } from '@/lib/copy.ko';

const COMBOS = [
  { id: 'win-galaxy', icon: '🖥️📱', label: '윈도우 + 갤럭시', sub: '가장 많은 조합이에요' },
  { id: 'mac-galaxy', icon: '💻📱', label: '맥북 + 갤럭시', sub: '' },
  { id: 'win-iphone', icon: '🖥️📱', label: '윈도우 + 아이폰', sub: '외부 도구가 필요해요' },
  { id: 'mac-iphone', icon: '💻📱', label: '맥북 + 아이폰', sub: 'QuickTime 사용' },
];

export default function GuidePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-[100dvh] px-6 py-8 gap-6 bg-base">
      {/* 뒤로가기 */}
      <button
        type="button"
        onClick={() => router.push('/')}
        aria-label={COPY.back}
        className="pressable self-start min-w-[64px] min-h-[64px] flex items-center justify-center rounded-big text-3xl"
      >
        ←
      </button>

      <h1 className="text-title text-center">{COPY.guideTitle}</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
        {COMBOS.map((combo) => (
          <BigButton
            key={combo.id}
            icon={<span className="text-4xl">{combo.icon}</span>}
            label={combo.label}
            sub={combo.sub}
            variant="secondary"
            tall
            onClick={() => router.push(`/guide/${combo.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
