'use client';

// CodeDisplay (TRD 7.3) — 56px+ 코드 표시 + [소리내어 읽기] 자리
import { COPY } from '@/lib/copy.ko';

interface CodeDisplayProps {
  code: string;
}

export default function CodeDisplay({ code }: CodeDisplayProps) {
  const left = code.slice(0, 3);
  const right = code.slice(3, 6);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-4 items-center justify-center" aria-label={`연결 번호: ${code.split('').join(' ')}`}>
        <span className="text-code tracking-[0.12em] font-bold text-primary">{left}</span>
        <span className="text-muted text-title">–</span>
        <span className="text-code tracking-[0.12em] font-bold text-primary">{right}</span>
      </div>
      <button
        type="button"
        className="pressable text-caption text-muted underline min-h-[48px]"
        onClick={() => {
          if ('speechSynthesis' in window) {
            const msg = new SpeechSynthesisUtterance(code.split('').join(', '));
            msg.lang = 'ko-KR';
            msg.rate = 0.7;
            speechSynthesis.speak(msg);
          }
        }}
        aria-label={COPY.readAloud}
      >
        🔊 {COPY.readAloud}
      </button>
    </div>
  );
}
