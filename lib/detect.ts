// 기기·브라우저 감지 + 요건 사전 점검 (PRD 2.3 "요건 사전 점검")
// 첫 화면 진입 시 가능한 버튼만 보여주기 위한 감지 유틸

export type CaptureSupport = 'full' | 'camera-only' | 'viewer-only';

export interface DeviceInfo {
  os: 'android' | 'ios' | 'macos' | 'windows' | 'other';
  type: 'phone' | 'tablet' | 'desktop';
  browser: string;
  isTouch: boolean;
}

export function detectDevice(): DeviceInfo {
  if (typeof navigator === 'undefined') {
    return { os: 'other', type: 'desktop', browser: 'unknown', isTouch: false };
  }
  const ua = navigator.userAgent;
  const isIpadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  let os: DeviceInfo['os'] = 'other';
  if (/Android/i.test(ua)) os = 'android';
  else if (/iPhone|iPad|iPod/i.test(ua) || isIpadOS) os = 'ios';
  else if (/Macintosh/i.test(ua)) os = 'macos';
  else if (/Windows/i.test(ua)) os = 'windows';

  let type: DeviceInfo['type'] = 'desktop';
  if (/Mobile|iPhone/i.test(ua)) type = 'phone';
  else if (/iPad|Tablet/i.test(ua) || isIpadOS) type = 'tablet';
  else if (os === 'android') type = 'tablet';

  let browser = 'unknown';
  if (/Edg\//.test(ua)) browser = 'edge';
  else if (/Chrome\//.test(ua)) browser = 'chrome';
  else if (/Safari\//.test(ua)) browser = 'safari';
  else if (/Firefox\//.test(ua)) browser = 'firefox';

  return { os, type, browser, isTouch: navigator.maxTouchPoints > 0 };
}

// 'full' = 화면 캡처 송출 가능 / 'camera-only' = iOS(카메라 폴백) / 'viewer-only'
export function detectCaptureSupport(): CaptureSupport {
  if (typeof navigator === 'undefined') return 'viewer-only';
  const { os } = detectDevice();
  const hasDisplayMedia =
    !!navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function';
  const hasCamera =
    !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';

  // iOS Safari는 getDisplayMedia가 있어도 실제 화면 캡처를 막아둠
  if (os === 'ios') return hasCamera ? 'camera-only' : 'viewer-only';
  if (hasDisplayMedia) return 'full';
  if (hasCamera) return 'camera-only';
  return 'viewer-only';
}

// 기기 별명 자동 생성 (trusted_pairs device hint — 개인정보 아닌 UA 기반)
export function deviceHint(): string {
  const d = detectDevice();
  const osName = { android: '갤럭시/안드로이드', ios: '아이폰', macos: '맥북', windows: '윈도우 컴퓨터', other: '기기' }[d.os];
  return d.type === 'desktop' ? osName : `${osName} 휴대폰`.replace('휴대폰 휴대폰', '휴대폰');
}

// 4조합 가이드 콤보 추론
export function guessCombo(): string {
  const d = detectDevice();
  if (d.os === 'ios') return 'mac-iphone';
  if (d.os === 'android') return 'win-galaxy';
  if (d.os === 'macos') return 'mac-galaxy';
  return 'win-galaxy';
}
