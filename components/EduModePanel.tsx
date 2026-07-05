'use client';

// EduModePanel — 교육 녹화 설정 패널 (프레임/배경/통계)
import { COPY } from '@/lib/copy.ko';

interface EduModePanelProps {
  frame: 'galaxy' | 'iphone' | 'none';
  onFrameChange: (frame: 'galaxy' | 'iphone' | 'none') => void;
  background: 'transparent' | 'green' | string;
  onBackgroundChange: (bg: string) => void;
  statsVisible: boolean;
  onStatsToggle: () => void;
  onPip: () => void;
}

export default function EduModePanel({
  frame,
  onFrameChange,
  background,
  onBackgroundChange,
  statsVisible,
  onStatsToggle,
  onPip,
}: EduModePanelProps) {
  return (
    <div className="bg-surface rounded-big p-4 border border-line flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-button font-semibold">{COPY.adminTitle}</h2>

      {/* 프레임 선택 */}
      <div>
        <label className="text-caption text-muted block mb-2">기기 프레임</label>
        <div className="flex gap-2">
          {(['galaxy', 'iphone', 'none'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFrameChange(f)}
              className={`pressable px-4 py-2 rounded-big text-caption ${
                frame === f ? 'bg-accent text-accent-ink' : 'bg-base text-muted border border-line'
              }`}
            >
              {f === 'galaxy' ? '갤럭시' : f === 'iphone' ? '아이폰' : '없음'}
            </button>
          ))}
        </div>
      </div>

      {/* 배경 */}
      <div>
        <label className="text-caption text-muted block mb-2">배경</label>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => onBackgroundChange('transparent')}
            className={`pressable w-10 h-10 rounded-big border-2 ${
              background === 'transparent' ? 'border-accent' : 'border-line'
            }`}
            style={{ background: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 16px 16px' }}
            aria-label="투명"
          />
          <button
            type="button"
            onClick={() => onBackgroundChange('green')}
            className={`pressable w-10 h-10 rounded-big border-2 ${
              background === 'green' ? 'border-accent' : 'border-line'
            }`}
            style={{ background: '#00ff00' }}
            aria-label="그린 스크린"
          />
          <input
            type="color"
            value={background.startsWith('#') ? background : '#0B1220'}
            onChange={(e) => onBackgroundChange(e.target.value)}
            className="w-10 h-10 rounded-big border-2 border-line cursor-pointer"
            aria-label="커스텀 색상"
          />
        </div>
      </div>

      {/* 통계 */}
      <button
        type="button"
        onClick={onStatsToggle}
        className={`pressable px-4 py-3 rounded-big text-caption ${
          statsVisible ? 'bg-accent text-accent-ink' : 'bg-base text-muted border border-line'
        }`}
      >
        📊 통계 {statsVisible ? 'ON' : 'OFF'}
      </button>

      {/* PiP */}
      <button
        type="button"
        onClick={onPip}
        className="pressable px-4 py-3 rounded-big bg-accent text-accent-ink text-caption"
      >
        🪟 별도 창으로 띄우기
      </button>
    </div>
  );
}
