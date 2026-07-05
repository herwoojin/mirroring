'use client';

// dev-preview — 컴포넌트 카탈로그 (스토리북 대체)
import BigButton from '@/components/BigButton';
import FontScaleToggle from '@/components/FontScaleToggle';
import NumPad from '@/components/NumPad';
import CodeDisplay from '@/components/CodeDisplay';
import ErrorHelpCard from '@/components/ErrorHelpCard';
import DeviceFrame from '@/components/DeviceFrame';
import { COPY } from '@/lib/copy.ko';
import { useState } from 'react';

export default function DevPreviewPage() {
  const [numpadResult, setNumpadResult] = useState('');

  return (
    <div className="min-h-[100dvh] bg-base p-6 space-y-10">
      <h1 className="text-title">🧩 컴포넌트 카탈로그</h1>

      {/* BigButton */}
      <section>
        <h2 className="text-button text-muted mb-4">BigButton</h2>
        <div className="space-y-3 max-w-md">
          <BigButton icon="📱" label={COPY.homeSend} />
          <BigButton icon="🖥️" label={COPY.homeView} variant="secondary" />
          <BigButton icon="⏹️" label={COPY.stop} variant="danger" />
          <BigButton icon="📱" label="초대형" tall />
        </div>
      </section>

      {/* FontScaleToggle */}
      <section>
        <h2 className="text-button text-muted mb-4">FontScaleToggle</h2>
        <FontScaleToggle />
      </section>

      {/* CodeDisplay */}
      <section>
        <h2 className="text-button text-muted mb-4">CodeDisplay</h2>
        <CodeDisplay code="482917" />
      </section>

      {/* NumPad */}
      <section>
        <h2 className="text-button text-muted mb-4">NumPad</h2>
        <div className="max-w-xs">
          <NumPad onComplete={(c) => setNumpadResult(c)} />
          {numpadResult && <p className="text-body text-success mt-4">입력: {numpadResult}</p>}
        </div>
      </section>

      {/* ErrorHelpCard */}
      <section>
        <h2 className="text-button text-muted mb-4">ErrorHelpCard</h2>
        <div className="space-y-4">
          <ErrorHelpCard reason="ice-failed" onRetry={() => {}} />
          <ErrorHelpCard reason="permission-denied" onRetry={() => {}} />
          <ErrorHelpCard reason="room-expired" onRetry={() => {}} />
          <ErrorHelpCard reason="timeout" onRetry={() => {}} />
        </div>
      </section>

      {/* DeviceFrame */}
      <section>
        <h2 className="text-button text-muted mb-4">DeviceFrame</h2>
        <div className="flex gap-6 flex-wrap">
          <div className="w-40">
            <DeviceFrame type="galaxy">
              <div className="w-full h-full bg-accent/20 flex items-center justify-center text-caption">갤럭시</div>
            </DeviceFrame>
          </div>
          <div className="w-40">
            <DeviceFrame type="iphone">
              <div className="w-full h-full bg-accent/20 flex items-center justify-center text-caption">아이폰</div>
            </DeviceFrame>
          </div>
        </div>
      </section>

      {/* 타이포 */}
      <section>
        <h2 className="text-button text-muted mb-4">타이포그래피 토큰</h2>
        <p className="text-code">text-code (56px)</p>
        <p className="text-title">text-title (32px)</p>
        <p className="text-button">text-button (24px)</p>
        <p className="text-body">text-body (20px)</p>
        <p className="text-caption">text-caption (17px)</p>
      </section>

      {/* 컬러 팔레트 */}
      <section>
        <h2 className="text-button text-muted mb-4">컬러 팔레트 (WCAG AA)</h2>
        <div className="flex flex-wrap gap-3">
          <div className="w-24 h-24 bg-base rounded-big border border-line flex items-center justify-center text-caption">base</div>
          <div className="w-24 h-24 bg-surface rounded-big border border-line flex items-center justify-center text-caption">surface</div>
          <div className="w-24 h-24 bg-accent rounded-big flex items-center justify-center text-accent-ink text-caption">accent</div>
          <div className="w-24 h-24 bg-success rounded-big flex items-center justify-center text-base text-caption">success</div>
          <div className="w-24 h-24 bg-error rounded-big flex items-center justify-center text-base text-caption">error</div>
          <div className="w-24 h-24 bg-warn rounded-big flex items-center justify-center text-base text-caption">warn</div>
        </div>
      </section>
    </div>
  );
}
