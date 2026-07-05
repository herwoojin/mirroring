'use client';

// QrScanner — @zxing/browser 기반 QR 스캐너 (카메라 뷰파인더)
import { useEffect, useRef, useState } from 'react';

interface QrScannerProps {
  onScan: (value: string) => void;
  active?: boolean;
}

export default function QrScanner({ onScan, active = true }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    let stopped = false;
    let reader: any = null;

    async function start() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        reader = new BrowserQRCodeReader();
        const devices = await BrowserQRCodeReader.listVideoInputDevices();
        // 후면 카메라 우선
        const back = devices.find((d) => /back|rear|환경/i.test(d.label));
        const deviceId = back?.deviceId ?? devices[0]?.deviceId;

        if (!deviceId) {
          setError('카메라를 찾을 수 없어요');
          return;
        }

        await reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result: any) => {
          if (stopped) return;
          if (result) {
            const text = result.getText();
            if (text) {
              stopped = true;
              onScan(text);
            }
          }
        });
      } catch (e: any) {
        if (!stopped) setError('카메라를 사용할 수 없어요');
        console.error('[QrScanner]', e);
      }
    }

    start();

    return () => {
      stopped = true;
      // reader controls cleanup
      if (reader && typeof reader.reset === 'function') reader.reset();
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
    };
  }, [active, onScan]);

  if (error) {
    return (
      <div className="w-full aspect-square bg-surface rounded-big flex items-center justify-center text-body text-muted text-center p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full aspect-square rounded-big overflow-hidden bg-surface relative">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay
        playsInline
        muted
        aria-label="QR 스캐너 카메라"
      />
      {/* 스캔 가이드 프레임 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-2/3 h-2/3 border-2 border-accent rounded-2xl opacity-60" />
      </div>
    </div>
  );
}
