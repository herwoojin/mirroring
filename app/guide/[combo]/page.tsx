'use client';

// guide/[combo]/page.tsx — 4조합 단계별 그림 가이드 + 👍👎 피드백
import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import BigButton from '@/components/BigButton';
import { COPY } from '@/lib/copy.ko';
import { detectDevice } from '@/lib/detect';

interface GuideStep {
  title: string;
  body: string;
  icon: string;
}

const GUIDES: Record<string, GuideStep[]> = {
  'win-galaxy': [
    { icon: '🖥️', title: '컴퓨터에서 미러온을 열어주세요', body: '크롬이나 엣지 브라우저를 여세요' },
    { icon: '🖥️', title: '[다른 기기 화면 보기]를 눌러주세요', body: '화면에 큰 버튼이 보여요' },
    { icon: '📱', title: '갤럭시에서 미러온을 열어주세요', body: '같은 주소를 입력하세요' },
    { icon: '📱', title: '[내 화면 보여주기]를 눌러주세요', body: 'QR을 찍거나 숫자를 입력하세요' },
    { icon: '✅', title: '"지금 시작"을 눌러주세요', body: '갤럭시가 화면 공유를 물어볼 거예요' },
  ],
  'mac-galaxy': [
    { icon: '💻', title: '맥북에서 미러온을 열어주세요', body: '사파리나 크롬을 여세요' },
    { icon: '💻', title: '[다른 기기 화면 보기]를 눌러주세요', body: '화면에 큰 버튼이 보여요' },
    { icon: '📱', title: '갤럭시에서 미러온을 열어주세요', body: '같은 주소를 입력하세요' },
    { icon: '📱', title: '[내 화면 보여주기]를 눌러주세요', body: 'QR을 찍거나 숫자를 입력하세요' },
    { icon: '✅', title: '"지금 시작"을 눌러주세요', body: '갤럭시가 화면 공유를 물어볼 거예요' },
  ],
  'win-iphone': [
    { icon: '⚠️', title: '아이폰은 화면을 직접 보낼 수 없어요', body: '대신 다른 방법을 알려드릴게요' },
    { icon: '📷', title: '방법 1: 카메라로 보여주기', body: '미러온에서 [카메라로 보여주기]를 쓰세요' },
    { icon: '🔌', title: '방법 2: 외부 도구 사용하기', body: 'LetsView 같은 앱을 양쪽에 설치하세요' },
    { icon: '📱', title: '아이폰에서 화면 보기는 가능해요', body: '컴퓨터 화면을 아이폰에서 볼 수 있어요' },
  ],
  'mac-iphone': [
    { icon: '⚠️', title: '아이폰은 화면을 직접 보낼 수 없어요', body: '맥북과 아이폰이면 QuickTime을 쓸 수 있어요' },
    { icon: '🔌', title: '아이폰을 USB 케이블로 맥북에 연결하세요', body: '충전 케이블을 사용하면 돼요' },
    { icon: '💻', title: '맥북에서 QuickTime을 열어주세요', body: '파일 → 새로운 동영상 녹화를 선택하세요' },
    { icon: '📱', title: '카메라를 아이폰으로 바꿔주세요', body: '녹화 버튼 옆 화살표를 눌러 아이폰을 선택해요' },
    { icon: '✅', title: '맥북에서 아이폰 화면이 보여요', body: 'OBS로 녹화하려면 창 캡처를 사용하세요' },
  ],
};

export default function GuideComboPage() {
  const { combo } = useParams<{ combo: string }>();
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [feedbackSent, setFeedbackSent] = useState<Set<number>>(new Set());
  const [thanks, setThanks] = useState(false);

  const steps = GUIDES[combo] ?? GUIDES['win-galaxy'];
  const step = steps[current];
  const total = steps.length;

  const sendFeedback = useCallback(
    async (helpful: boolean) => {
      if (feedbackSent.has(current)) return;
      setFeedbackSent((prev) => new Set(prev).add(current));
      setThanks(true);
      setTimeout(() => setThanks(false), 2000);

      try {
        await fetch('/api/feedback/guide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            combo,
            stepIndex: current,
            helpful,
            deviceOs: detectDevice().os,
          }),
        });
      } catch {}
    },
    [combo, current, feedbackSent],
  );

  return (
    <div className="flex flex-col min-h-[100dvh] px-6 py-8 gap-6 bg-base">
      {/* 상단 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => (current > 0 ? setCurrent(current - 1) : router.push('/guide'))}
          aria-label={COPY.back}
          className="pressable min-w-[64px] min-h-[64px] flex items-center justify-center rounded-big text-3xl"
        >
          ←
        </button>
        <span className="text-caption text-muted">
          {COPY.wizardStepLabel(current + 1, total)}
        </span>
        <div className="w-[64px]" />
      </div>

      {/* 진행 인디케이터 */}
      <div className="flex gap-2 justify-center">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${
              i <= current ? 'bg-accent' : 'bg-line'
            }`}
          />
        ))}
      </div>

      {/* 단계 컨텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
        <div className="text-7xl" aria-hidden="true">{step.icon}</div>
        <h1 className="text-title">{step.title}</h1>
        <p className="text-body text-muted">{step.body}</p>
      </div>

      {/* 피드백 */}
      <div className="flex gap-3 justify-center">
        {thanks ? (
          <p className="text-body text-success">{COPY.guideThanks}</p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => sendFeedback(true)}
              disabled={feedbackSent.has(current)}
              className="pressable min-h-[48px] px-6 rounded-big bg-surface text-body text-muted border border-line"
            >
              👍 {COPY.guideHelpful}
            </button>
            <button
              type="button"
              onClick={() => sendFeedback(false)}
              disabled={feedbackSent.has(current)}
              className="pressable min-h-[48px] px-6 rounded-big bg-surface text-body text-muted border border-line"
            >
              👎 {COPY.guideNotHelpful}
            </button>
          </>
        )}
      </div>

      {/* 다음 버튼 */}
      {current < total - 1 ? (
        <BigButton
          label={COPY.next}
          onClick={() => setCurrent(current + 1)}
        />
      ) : (
        <BigButton
          label={COPY.homeSend}
          onClick={() => router.push('/send')}
        />
      )}
    </div>
  );
}
