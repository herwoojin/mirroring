'use client';

// DeviceFrame — SVG 베젤 프레임 (갤럭시/아이폰/없음)
interface DeviceFrameProps {
  type: 'galaxy' | 'iphone' | 'none';
  children: React.ReactNode;
}

export default function DeviceFrame({ type, children }: DeviceFrameProps) {
  if (type === 'none') {
    return <div className="relative w-full h-full">{children}</div>;
  }

  const isIphone = type === 'iphone';
  const borderRadius = isIphone ? '44px' : '20px';
  const notchWidth = isIphone ? '40%' : '20%';

  return (
    <div
      className="relative bg-[#1a1a1a] border-4 border-[#333] overflow-hidden"
      style={{ borderRadius, aspectRatio: '9/19.5' }}
    >
      {/* 노치/펀치홀 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 bg-[#1a1a1a]" style={{
        width: notchWidth,
        height: isIphone ? '30px' : '12px',
        borderBottomLeftRadius: isIphone ? '16px' : '6px',
        borderBottomRightRadius: isIphone ? '16px' : '6px',
      }} />

      {/* 영상 영역 */}
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius }}>
        {children}
      </div>

      {/* 하단 바 (아이폰) */}
      {isIphone && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-1.5 rounded-full bg-white/30" />
      )}
    </div>
  );
}
