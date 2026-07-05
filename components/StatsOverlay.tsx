'use client';

// StatsOverlay — getStats 1초 폴링 통계 (교육 모드에서만 기술 용어 허용)
interface StatsOverlayProps {
  stats: RTCStatsReport | null;
  connectionType: string;
  visible: boolean;
}

export default function StatsOverlay({ stats, connectionType, visible }: StatsOverlayProps) {
  if (!visible || !stats) return null;

  let resolution = '—';
  let fps = '—';
  let bitrate = '—';
  let rtt = '—';

  stats.forEach((report) => {
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      if (report.frameWidth && report.frameHeight) {
        resolution = `${report.frameWidth}×${report.frameHeight}`;
      }
      if (report.framesPerSecond) {
        fps = `${Math.round(report.framesPerSecond)} fps`;
      }
    }
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      if (report.currentRoundTripTime) {
        rtt = `${Math.round(report.currentRoundTripTime * 1000)} ms`;
      }
      if (report.availableOutgoingBitrate) {
        bitrate = `${Math.round(report.availableOutgoingBitrate / 1000)} kbps`;
      }
    }
  });

  return (
    <div className="absolute top-4 right-4 bg-black/80 text-white text-xs font-mono rounded-lg p-3 space-y-1 z-50 pointer-events-none select-none">
      <div>📐 {resolution}</div>
      <div>🎬 {fps}</div>
      <div>📡 {bitrate}</div>
      <div>⏱️ RTT {rtt}</div>
      <div>🔗 {connectionType}</div>
    </div>
  );
}
