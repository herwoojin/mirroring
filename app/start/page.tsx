'use client';

// /start — 아주 쉬운 설치·사용 가이드 (큰 글자 + 실제 화면 사진)
// 디지털 초보자/시니어가 종이 없이 화면만 보고 따라할 수 있게.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/BigButton';
import FontScaleToggle from '@/components/FontScaleToggle';
import { detectDevice } from '@/lib/detect';

export default function StartPage() {
  const router = useRouter();
  const [os, setOs] = useState<'android' | 'ios' | 'desktop' | 'other'>('other');

  useEffect(() => {
    const d = detectDevice();
    if (d.type === 'desktop') setOs('desktop');
    else setOs(d.os === 'android' ? 'android' : d.os === 'ios' ? 'ios' : 'other');
  }, []);

  return (
    <div className="min-h-[100dvh] bg-base text-primary px-6 py-8 flex flex-col gap-8 safe-bottom">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-title">처음 오셨나요?</h1>
        <FontScaleToggle />
      </div>

      <p className="text-body text-muted">
        휴대폰 화면을 컴퓨터(PC)에 크게 보여주는 방법이에요. 아래를 순서대로 따라 하면 돼요.
      </p>

      {/* 컴퓨터에서 할 일 */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-accent text-accent-ink flex items-center justify-center text-button" aria-hidden="true">1</span>
          <h2 className="text-title">💻 컴퓨터에서</h2>
        </div>
        <div className="bg-surface rounded-big p-5 flex flex-col gap-3 border border-line">
          <p className="text-body">미러온을 열고 <b className="text-accent">[다른 기기 화면 보기]</b>를 눌러요.</p>
          <p className="text-body">그러면 <b>네모 무늬(QR)</b>와 <b>숫자 6개</b>가 나와요.</p>
        </div>
        {os === 'desktop' && (
          <BigButton icon="🖥️" label="다른 기기 화면 보기 열기" onClick={() => router.push('/view')} />
        )}
      </section>

      {/* 휴대폰에서 할 일 */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-accent text-accent-ink flex items-center justify-center text-button" aria-hidden="true">2</span>
          <h2 className="text-title">📱 휴대폰에서 (갤럭시)</h2>
        </div>

        <div className="bg-surface rounded-big p-5 flex flex-col gap-4 border border-line">
          <p className="text-body">
            휴대폰 화면을 보내려면 <b className="text-accent">미러온 앱</b>이 필요해요.
            아래 버튼으로 한 번만 설치하면 돼요.
          </p>

          <BigButton
            icon="📥"
            label="미러온 앱 내려받기"
            onClick={() => { window.location.href = '/mirroron-companion.apk'; }}
          />
          <p className="text-caption text-muted">
            내려받은 뒤 파일을 열어 <b>[설치]</b>를 눌러요. &ldquo;출처를 알 수 없는 앱&rdquo; 안내가
            나오면 <b>[허용]</b> 후 설치해요. (한 번만 하면 돼요)
          </p>

          {/* 실제 앱 화면 사진 */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <img
              src="/guide-shots/app-home.png"
              alt="미러온 앱 첫 화면 사진 — 숫자 6개 입력칸과 파란 [화면 보여주기 시작] 버튼"
              className="w-56 rounded-2xl border border-line"
            />
            <p className="text-caption text-muted text-center">앱을 열면 이런 화면이 나와요</p>
          </div>

          <ol className="flex flex-col gap-3 pt-2">
            {[
              '앱을 열어요.',
              '컴퓨터 화면에 나온 숫자 6개를 그대로 눌러요.',
              '파란 [화면 보여주기 시작] 버튼을 눌러요.',
              '"지금 시작"이 뜨면 눌러요.',
              '끝! 컴퓨터에 내 휴대폰 화면이 보여요.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-body">
                <span className="w-8 h-8 rounded-full bg-line text-primary flex items-center justify-center shrink-0">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 아이폰 안내 */}
      {os === 'ios' && (
        <section className="bg-surface rounded-big p-5 border border-line flex flex-col gap-2">
          <h2 className="text-title">🍎 아이폰이신가요?</h2>
          <p className="text-body text-muted">
            아이폰은 화면을 직접 보내는 기능이 막혀 있어요. 대신 <b>카메라로 보여주기</b>를 쓸 수 있어요.
          </p>
          <BigButton icon="📷" label="카메라로 보여주기" variant="secondary" onClick={() => router.push('/send?camera=1')} />
        </section>
      )}

      {/* 하단 이동 */}
      <div className="flex flex-col gap-3 pt-2">
        <BigButton icon="🏠" label="처음 화면으로" variant="secondary" onClick={() => router.push('/')} />
      </div>
    </div>
  );
}
