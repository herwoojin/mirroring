'use client';

// /app — 갤럭시 사용자용 앱 설치·열기 안내 (큰 글자 + "무시하고 설치" 단계)
// 웹 카메라 모드는 실물 촬영 보조일 뿐, 폰 화면 미러링은 이 앱이 담당한다.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/BigButton';
import FontScaleToggle from '@/components/FontScaleToggle';

export default function AppInstallPage() {
  const router = useRouter();
  const [triedOpen, setTriedOpen] = useState(false);

  function openApp() {
    // 설치돼 있으면 앱이 열림. 없으면 아무 일도 안 일어남 → 아래 설치 안내 노출.
    setTriedOpen(true);
    const host = typeof window !== 'undefined' ? window.location.host : '';
    window.location.href = `mirroron://send?host=${encodeURIComponent(host)}`;
  }

  function downloadApk() {
    // download 속성으로 깔끔히 저장 (모바일 브라우저에서 미리보기 시도 방지)
    const a = document.createElement('a');
    a.href = '/mirroron-companion.apk';
    a.setAttribute('download', 'mirroron.apk');
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="min-h-[100dvh] bg-base text-primary px-6 py-8 flex flex-col gap-7 safe-bottom">
      <div className="flex items-center justify-between">
        <h1 className="text-title">📱 내 화면 보여주기</h1>
        <FontScaleToggle />
      </div>

      <p className="text-body text-muted">
        휴대폰 화면을 컴퓨터에 보여주려면 <b className="text-accent">미러온 앱</b>이 필요해요.
        한 번만 설치하면 다음부터는 바로 열려요.
      </p>

      {/* 1) 이미 설치한 사람: 앱 열기 */}
      <section className="flex flex-col gap-3">
        <BigButton icon="▶️" label="앱 열기 (이미 설치했어요)" onClick={openApp} />
        {triedOpen && (
          <p className="text-caption text-muted text-center">
            앱이 안 열렸나요? 아래에서 먼저 설치해 주세요 👇
          </p>
        )}
      </section>

      {/* 2) 처음: 설치 */}
      <section className="bg-surface rounded-big p-5 border border-line flex flex-col gap-4">
        <h2 className="text-title">처음이신가요? 앱 설치</h2>

        <BigButton icon="📥" label="미러온 앱 내려받기" onClick={downloadApk} />

        <div className="flex flex-col gap-3">
          <p className="text-body font-semibold">내려받은 뒤 이렇게 설치해요:</p>
          {[
            '내려받기가 끝나면 알림을 눌러 파일을 열어요.',
            '"이 파일은 기기에 피해를 줄 수 있어요" 같은 안내가 나오면 [무시하고 설치] 또는 [계속]을 눌러요.',
            '"출처를 알 수 없는 앱" 안내가 나오면 [설정]을 누르고 [이 출처 허용]을 켠 뒤 뒤로 가요.',
            '[설치]를 누르면 끝! 바탕화면에 미러온 아이콘이 생겨요.',
          ].map((step, i) => (
            <div key={i} className="flex gap-3 text-body">
              <span className="w-8 h-8 rounded-full bg-accent text-accent-ink flex items-center justify-center shrink-0 font-bold">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
          <p className="text-caption text-muted">
            ⚠️ &ldquo;무시하고 설치&rdquo;는 미러온이 스토어가 아닌 곳에서 설치돼서 나오는 정상 안내예요.
            안심하고 진행해도 돼요.
          </p>
        </div>
      </section>

      {/* 3) 설치 후 사용법 */}
      <section className="bg-surface rounded-big p-5 border border-line flex flex-col gap-3">
        <h2 className="text-title">설치한 다음엔</h2>
        <ol className="flex flex-col gap-3">
          {[
            '미러온 앱을 열어요.',
            '컴퓨터 화면에 나온 숫자 6개를 눌러요.',
            '[화면 보여주기 시작] → "지금 시작"을 눌러요.',
            '끝! 컴퓨터에 내 화면이 보여요.',
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-body">
              <span className="w-8 h-8 rounded-full bg-line text-primary flex items-center justify-center shrink-0">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 실물 촬영 보조 */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-caption text-muted text-center">
          화면이 아니라 <b>실물(종이·물건)</b>을 보여주고 싶다면
        </p>
        <BigButton
          icon="📷"
          label="카메라로 보여주기"
          variant="secondary"
          onClick={() => router.push('/send?camera=1')}
        />
      </div>

      <BigButton icon="🏠" label="처음 화면으로" variant="secondary" onClick={() => router.push('/')} />
    </div>
  );
}
