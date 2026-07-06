'use client';

// /start — 아주 쉬운 사용 가이드 (큰 글자 + 그림). 두 가지 방법을 탭으로 구분.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/BigButton';
import FontScaleToggle from '@/components/FontScaleToggle';

type Tab = 'screen' | 'camera';

function Step({ n, img, alt, text }: { n: number; img: string; alt: string; text: string }) {
  return (
    <div className="bg-surface rounded-big border border-line p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-accent text-accent-ink flex items-center justify-center text-button font-bold shrink-0">{n}</span>
        <p className="text-body font-semibold">{text}</p>
      </div>
      <img src={img} alt={alt} className="w-full rounded-xl" />
    </div>
  );
}

export default function StartPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('screen');

  return (
    <div className="min-h-[100dvh] bg-base text-primary px-5 py-6 flex flex-col gap-5 safe-bottom">
      <div className="flex items-center justify-between">
        <h1 className="text-title">쉬운 사용 방법</h1>
        <FontScaleToggle />
      </div>

      {/* 방법 선택 탭 */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab('screen')}
          className={`pressable min-h-[64px] rounded-big text-button font-semibold border-2 ${tab === 'screen' ? 'bg-accent text-accent-ink border-accent' : 'bg-surface text-primary border-line'}`}
        >
          📱 폰 화면 보내기
        </button>
        <button
          type="button"
          onClick={() => setTab('camera')}
          className={`pressable min-h-[64px] rounded-big text-button font-semibold border-2 ${tab === 'camera' ? 'bg-accent text-accent-ink border-accent' : 'bg-surface text-primary border-line'}`}
        >
          📷 폰 카메라 보내기
        </button>
      </div>

      {tab === 'screen' ? (
        <>
          <p className="text-body text-muted">폰 화면을 통째로 컴퓨터에 보여줘요. (갤럭시)</p>
          <Step n={1} img="/guide-shots/step-pc.png" alt="컴퓨터에 숫자 6개가 뜬 모습" text="컴퓨터에서 [휴대폰 화면 보기]를 눌러요" />
          <div className="bg-surface rounded-big border border-line p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-accent text-accent-ink flex items-center justify-center text-button font-bold shrink-0">2</span>
              <p className="text-body font-semibold">폰에 미러온 앱을 설치해요 (처음 한 번만)</p>
            </div>
            <BigButton icon="📥" label="앱 설치하러 가기" onClick={() => router.push('/app')} />
          </div>
          <Step n={3} img="/guide-shots/step-app.png" alt="앱에 숫자를 입력하는 모습" text="앱을 열고 컴퓨터의 숫자 6개를 눌러요" />
          <Step n={4} img="/guide-shots/step-done.png" alt="컴퓨터에 폰 화면이 보이는 모습" text="끝! 컴퓨터에 내 폰 화면이 보여요" />
        </>
      ) : (
        <>
          <p className="text-body text-muted">폰 카메라로 비추는 모습을 컴퓨터에 보여줘요. (갤럭시·아이폰 모두)</p>
          <Step n={1} img="/guide-shots/step-pc.png" alt="컴퓨터에 숫자 6개가 뜬 모습" text="컴퓨터에서 [휴대폰 화면 보기]를 눌러요" />
          <div className="bg-surface rounded-big border border-line p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-accent text-accent-ink flex items-center justify-center text-button font-bold shrink-0">2</span>
              <p className="text-body font-semibold">폰에서 [폰 카메라를 PC로 보내기]를 눌러요</p>
            </div>
            <BigButton icon="📷" label="카메라 보내기 시작" onClick={() => router.push('/camera')} />
          </div>
          <Step n={3} img="/guide-shots/step-camera.png" alt="폰 카메라가 컴퓨터에 보이는 모습" text="숫자 6개를 넣고 [카메라 켜기]를 눌러요" />
          <div className="bg-surface rounded-big border border-line p-4">
            <p className="text-body">✅ 끝! 컴퓨터에 폰 카메라 화면이 보여요. <b>앞뒤 바꾸기</b>로 카메라를 돌릴 수 있어요.</p>
          </div>
        </>
      )}

      <BigButton icon="🏠" label="처음 화면으로" variant="secondary" onClick={() => router.push('/')} />
    </div>
  );
}
