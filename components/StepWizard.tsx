'use client';

// StepWizard (TRD 2.5, 7.2) — 상단 진행 표시 + 중앙 슬롯 + 하단 BigButton + 뒤로가기
import { ReactNode } from 'react';
import { COPY } from '@/lib/copy.ko';

interface Step {
  illustration?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode; // BigButton 등
}

interface StepWizardProps {
  steps: Step[];
  current: number; // 0-indexed
  onBack?: () => void;
}

export default function StepWizard({ steps, current, onBack }: StepWizardProps) {
  const step = steps[current];
  if (!step) return null;
  const total = steps.length;

  return (
    <div className="flex flex-col min-h-[100dvh] bg-base text-primary">
      {/* 상단 바: 뒤로가기 + 진행 표시 */}
      <div className="flex items-center justify-between px-4 pt-4 safe-bottom">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label={COPY.back}
            className="pressable min-w-[64px] min-h-[64px] flex items-center justify-center rounded-big text-3xl"
          >
            ←
          </button>
        ) : (
          <div className="w-[64px]" />
        )}
        <span className="text-caption text-muted" aria-live="polite" aria-atomic="true">
          {COPY.wizardStepLabel(current + 1, total)}
        </span>
        <div className="w-[64px]" />
      </div>

      {/* 진행 인디케이터 */}
      <div className="flex gap-2 justify-center py-3" role="progressbar" aria-valuenow={current + 1} aria-valuemin={1} aria-valuemax={total}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${
              i <= current ? 'bg-accent' : 'bg-line'
            }`}
          />
        ))}
      </div>

      {/* 중앙 컨텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center">
        {step.illustration && (
          <div className="w-full max-w-xs">{step.illustration}</div>
        )}
        <h1 className="text-title">{step.title}</h1>
        {step.body && <p className="text-body text-muted max-w-sm">{step.body}</p>}
      </div>

      {/* 하단 액션 */}
      {step.action && (
        <div className="px-6 pb-8 safe-bottom">{step.action}</div>
      )}
    </div>
  );
}
