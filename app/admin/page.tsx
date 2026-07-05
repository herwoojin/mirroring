'use client';

// admin/page.tsx — 교육 녹화 모드 + KPI 대시보드 (관리자 전용)
import { useEffect, useRef, useState } from 'react';
import DeviceFrame from '@/components/DeviceFrame';
import EduModePanel from '@/components/EduModePanel';
import StatsOverlay from '@/components/StatsOverlay';
import VideoViewer from '@/components/VideoViewer';
import { COPY } from '@/lib/copy.ko';

interface Kpis {
  totalLogs: number;
  avgTapCount: number | null;
  avgTimeToConnectMs: number | null;
  successRate: number | null;
  errorCards: Record<string, { shown: number; resolved: number }>;
  wizardAbandon: Record<string, number>;
}

export default function AdminPage() {
  const [frame, setFrame] = useState<'galaxy' | 'iphone' | 'none'>('galaxy');
  const [background, setBackground] = useState('transparent');
  const [statsVisible, setStatsVisible] = useState(false);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [tab, setTab] = useState<'edu' | 'kpi'>('edu');

  // KPI 로드
  useEffect(() => {
    if (tab !== 'kpi') return;
    fetch('/api/logs/connection')
      .then((r) => r.json())
      .then(setKpis)
      .catch(() => {});
  }, [tab]);

  // PiP 핸들러
  const videoContainerRef = useRef<HTMLDivElement>(null);
  async function handlePip() {
    try {
      if ('documentPictureInPicture' in window) {
        const pipWindow = await (window as any).documentPictureInPicture.requestWindow({
          width: 400,
          height: 700,
        });
        const container = videoContainerRef.current;
        if (container) {
          pipWindow.document.body.appendChild(container.cloneNode(true));
          pipWindow.document.body.style.margin = '0';
          pipWindow.document.body.style.background = getBg();
        }
      } else {
        // 기본 PiP 폴백
        const video = videoContainerRef.current?.querySelector('video');
        if (video) {
          await video.requestPictureInPicture();
        }
      }
    } catch (e) {
      console.error('PiP error', e);
    }
  }

  function getBg() {
    if (background === 'transparent') return 'transparent';
    if (background === 'green') return '#00ff00';
    return background;
  }

  return (
    <div className="min-h-[100dvh] bg-base p-6">
      {/* 탭 전환 */}
      <div className="flex gap-3 mb-6">
        <button
          type="button"
          onClick={() => setTab('edu')}
          className={`pressable px-6 py-3 rounded-big text-button ${
            tab === 'edu' ? 'bg-accent text-accent-ink' : 'bg-surface text-muted border border-line'
          }`}
        >
          🎬 교육 모드
        </button>
        <button
          type="button"
          onClick={() => setTab('kpi')}
          className={`pressable px-6 py-3 rounded-big text-button ${
            tab === 'kpi' ? 'bg-accent text-accent-ink' : 'bg-surface text-muted border border-line'
          }`}
        >
          📊 KPI 대시보드
        </button>
      </div>

      {tab === 'edu' ? (
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* 프리뷰 영역 */}
          <div
            ref={videoContainerRef}
            className="flex-1 flex items-center justify-center p-8 rounded-big min-h-[60vh]"
            style={{ background: getBg() }}
          >
            <div className="w-full max-w-[300px]">
              <DeviceFrame type={frame}>
                <VideoViewer stream={null} className="bg-surface" />
                <StatsOverlay stats={null} connectionType="—" visible={statsVisible} />
              </DeviceFrame>
            </div>
          </div>

          {/* 설정 패널 */}
          <EduModePanel
            frame={frame}
            onFrameChange={setFrame}
            background={background}
            onBackgroundChange={setBackground}
            statsVisible={statsVisible}
            onStatsToggle={() => setStatsVisible(!statsVisible)}
            onPip={handlePip}
          />
        </div>
      ) : (
        /* KPI 대시보드 (ERD 5절) */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard title="평균 터치 수" value={kpis?.avgTapCount ?? '—'} unit="회" target="≤ 4" />
          <KpiCard title="평균 연결 시간" value={kpis?.avgTimeToConnectMs ? `${(kpis.avgTimeToConnectMs / 1000).toFixed(1)}` : '—'} unit="초" target="≤ 5" />
          <KpiCard title="연결 성공률" value={kpis?.successRate ? `${(kpis.successRate * 100).toFixed(0)}` : '—'} unit="%" target="≥ 95" />

          {/* 오류 카드 해결률 */}
          {kpis?.errorCards && Object.entries(kpis.errorCards).map(([type, data]) => (
            <div key={type} className="bg-surface rounded-big p-4 border border-line">
              <p className="text-caption text-muted">{type}</p>
              <p className="text-title">{data.shown > 0 ? `${Math.round(data.resolved / data.shown * 100)}%` : '—'}</p>
              <p className="text-caption text-muted">자가 해결률 ({data.shown}건)</p>
            </div>
          ))}

          {/* 이탈 단계 */}
          {kpis?.wizardAbandon && Object.entries(kpis.wizardAbandon).map(([step, count]) => (
            <div key={step} className="bg-surface rounded-big p-4 border border-line">
              <p className="text-caption text-muted">이탈: {step}단계</p>
              <p className="text-title">{count}건</p>
            </div>
          ))}

          <div className="bg-surface rounded-big p-4 border border-line">
            <p className="text-caption text-muted">총 연결 로그</p>
            <p className="text-title">{kpis?.totalLogs ?? '—'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, unit, target }: { title: string; value: string | number; unit: string; target: string }) {
  return (
    <div className="bg-surface rounded-big p-4 border border-line">
      <p className="text-caption text-muted">{title}</p>
      <p className="text-title">
        {value} <span className="text-body text-muted">{unit}</span>
      </p>
      <p className="text-caption text-muted">목표: {target}</p>
    </div>
  );
}
