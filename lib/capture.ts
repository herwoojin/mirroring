// capture.ts — 화면 캡처 + iOS 카메라 폴백 (TRD 4.1)
// detectCaptureSupport()는 detect.ts에서 이미 제공

export interface CaptureResult {
  stream: MediaStream;
  mode: 'screen' | 'camera';
}

// 화면 캡처 (Android/Desktop)
export async function startScreenCapture(): Promise<CaptureResult> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 30, max: 60 },
      width: { ideal: 1920 },
    },
    audio: false, // 화면 캡처 오디오는 플랫폼 제한 많아 기본 꺼둠
  });
  return { stream, mode: 'screen' };
}

// 카메라 폴백 (iOS — 후면 카메라)
export async function startCameraCapture(
  facingMode: 'user' | 'environment' = 'environment',
): Promise<CaptureResult> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode,
      width: { ideal: 1920 },
      frameRate: { ideal: 30 },
    },
    audio: false,
  });
  return { stream, mode: 'camera' };
}

// 캡처 스트림 정리 — 모든 트랙 stop
export function stopCapture(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

// 카메라 전후면 전환
export async function flipCamera(
  currentStream: MediaStream,
  currentFacing: 'user' | 'environment',
): Promise<{ stream: MediaStream; facing: 'user' | 'environment' }> {
  stopCapture(currentStream);
  const next = currentFacing === 'user' ? 'environment' : 'user';
  const { stream } = await startCameraCapture(next);
  return { stream, facing: next };
}
