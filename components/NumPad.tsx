'use client';

// NumPad (TRD 7.3) — 72px 키, 전화 배열, 6자리 코드 입력
import { useState, useCallback } from 'react';
import { COPY } from '@/lib/copy.ko';

interface NumPadProps {
  onComplete: (code: string) => void;
  maxLength?: number;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'DEL'],
];

export default function NumPad({ onComplete, maxLength = 6 }: NumPadProps) {
  const [value, setValue] = useState('');

  const press = useCallback(
    (key: string) => {
      try { navigator.vibrate?.(8); } catch {}

      if (key === 'DEL') {
        setValue((v) => v.slice(0, -1));
        return;
      }
      setValue((v) => {
        const next = v + key;
        if (next.length >= maxLength) {
          setTimeout(() => onComplete(next), 100);
        }
        return next.length <= maxLength ? next : v;
      });
    },
    [maxLength, onComplete],
  );

  // 3-3 분할 표시
  const display = value.padEnd(maxLength, '·');
  const left = display.slice(0, 3);
  const right = display.slice(3, 6);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 코드 표시 */}
      <div className="flex gap-4 items-center justify-center" aria-live="polite" aria-label={`입력된 숫자: ${value}`}>
        <span className="text-code tracking-[0.12em] font-bold text-primary">{left}</span>
        <span className="text-muted text-title">–</span>
        <span className="text-code tracking-[0.12em] font-bold text-primary">{right}</span>
      </div>

      {/* 키패드 */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {KEYS.flat().map((key, i) =>
          key === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              aria-label={key === 'DEL' ? COPY.delete : key}
              className={`pressable min-w-[72px] min-h-[72px] rounded-big text-button font-semibold flex items-center justify-center select-none ${
                key === 'DEL'
                  ? 'bg-surface text-error text-2xl'
                  : 'bg-surface text-primary'
              }`}
            >
              {key === 'DEL' ? '⌫' : key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
