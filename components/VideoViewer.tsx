'use client';

// VideoViewer — 수신 영상 표시
import { useEffect, useRef } from 'react';

interface VideoViewerProps {
  stream: MediaStream | null;
  className?: string;
}

export default function VideoViewer({ stream, className = '' }: VideoViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={`w-full h-full object-contain bg-black ${className}`}
      aria-label="수신 화면"
    />
  );
}
