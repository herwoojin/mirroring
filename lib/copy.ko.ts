// 쉬운 한국어 문구 사전 (TRD 2.4)
// 규칙: "~해요"체, 한 문장 25자 이내, 외래어·기술용어 금지
// QR은 첫 표기에서 "네모 무늬(QR)"로 안내

export const COPY = {
  // 앱 공통
  appName: '미러온',
  appTagline: '화면을 서로 보여주는 앱이에요',

  // 첫 화면
  homeSend: '내 화면 보여주기',
  homeView: '다른 기기 화면 보기',
  homeSendCamera: '카메라로 보여주기',
  homeGuideLink: '사용 방법 그림으로 보기',
  fontScaleBase: '기본 크기',
  fontScaleLarge: '더 크게',
  fontScaleToggleAria: '글자 크기 바꾸기',

  // 연결 상태 (기술 상태 → 쉬운 문구)
  status_idle: '준비하고 있어요…',
  status_finding_peer: '상대 기기를 찾고 있어요…',
  status_connecting: '연결하고 있어요…',
  status_connected_p2p: '빠른 연결이 되었어요 ⚡',
  status_connected_relay: '연결되었어요 (조금 느릴 수 있어요)',
  status_reconnecting: '다시 연결하고 있어요…',
  status_ended: '연결이 끝났어요',

  // 오류 (원인별 쉬운 제목)
  err_permission_denied: '화면 공유가 취소되었어요',
  err_permission_denied_help: '다시 하려면 아래 버튼을 눌러주세요',
  err_ice_failed: '연결이 어려워요',
  err_ice_failed_help: 'Wi-Fi를 확인하고 다시 해볼까요?',
  err_room_expired: '시간이 지나 연결 번호가 사라졌어요',
  err_room_expired_help: '새 번호를 받아주세요',
  err_timeout: '연결이 오래 걸리고 있어요',
  err_timeout_help: '아래 방법을 해보세요',
  err_wrong_code: '번호가 맞지 않아요',
  err_wrong_code_help: '숫자 6개를 다시 확인해 주세요',
  err_too_many_tries: '잠시 후에 다시 해주세요',
  retry: '다시 해보기',

  // 송출 위저드 (3단계)
  wizardStepLabel: (n: number, total: number) => `${n}단계 / ${total}단계`,
  sendStep1Title: 'PC 화면의 네모 무늬(QR)를 비춰주세요',
  sendStep1Numpad: '숫자로 입력하기',
  sendStep1NumpadTitle: 'PC 화면의 큰 숫자 6개를 눌러주세요',
  sendStep2Title: '곧 이런 창이 나타나요',
  sendStep2Body: '휴대폰이 물어보면 [지금 시작]을 눌러주세요',
  sendStep2Ready: '준비됐어요',
  sendStep3Title: '연결 완료!',
  sendStep3Body: '이제 PC에서 내 화면이 보여요',
  stop: '멈추기',
  back: '뒤로',
  next: '다음',
  delete: '지우기',
  confirm: '확인',

  // 뷰어 화면
  viewTitle: '휴대폰으로 이 무늬를 찍어주세요',
  viewCodeHint: '또는 휴대폰에서 이 숫자를 눌러주세요',
  viewWaiting: '휴대폰을 기다리고 있어요…',
  viewReceiving: '화면을 받고 있어요',
  readAloud: '소리내어 읽기',

  // [다시 연결] (v3)
  rememberAsk: '이 컴퓨터를 기억할까요?',
  rememberBody: '다음엔 버튼 한 번으로 연결돼요',
  rememberYes: '기억하기',
  rememberNo: '괜찮아요',
  rejoin: (name: string) => `${name}에 다시 연결`,
  rejoinWaiting: '컴퓨터에서 미러온을 열어주세요',
  rejoinWaitingBody: '열려 있으면 저절로 연결돼요',
  rejoinFallback: '네모 무늬(QR)로 연결할게요',
  pairListTitle: '기억된 기기',
  pairForget: '기억 지우기',
  pairRename: '별명 바꾸기',

  // iOS 폴백
  iosNotice: '아이폰은 화면을 직접 보내는 기능을 막아두었어요',
  iosCameraBtn: '카메라로 보여주기',
  iosGuideBtn: '그림으로 방법 보기',
  cameraFlip: '앞뒤 바꾸기',

  // 안드로이드: 모바일 브라우저는 화면 캡처 미지원 (플랫폼 제한 — 2026 기준 Chrome Android도 불가)
  androidNotice: '휴대폰 브라우저는 화면을 직접 보내지 못해요',
  androidNoticeBody: '대신 카메라로 보여줄 수 있어요',
  openApp: '앱으로 화면 보내기', // 미러온 컴패니언 앱 (설치 시)

  // 가이드
  guideTitle: '어떤 기기끼리 연결하나요?',
  guideHelpful: '도움이 됐어요',
  guideNotHelpful: '잘 모르겠어요',
  guideThanks: '알려주셔서 고마워요',

  // PWA / 기타
  installBanner: '홈 화면에 추가하면 앱처럼 쓸 수 있어요',
  installBtn: '추가하기',
  installLater: '나중에요',
  offlineTitle: '인터넷이 연결되어 있지 않아요',
  offlineBody: 'Wi-Fi를 켜고 다시 열어주세요',
  keepScreenOn: '화면을 켜두어야 계속 보여줄 수 있어요',

  // 관리자 (여기서만 기술 용어 허용)
  adminTitle: '교육 녹화 모드',
} as const;

export type StatusKey =
  | 'idle'
  | 'finding_peer'
  | 'connecting'
  | 'connected_p2p'
  | 'connected_relay'
  | 'reconnecting'
  | 'ended';

export type FailReason = 'ice-failed' | 'permission-denied' | 'room-expired' | 'timeout' | 'wrong-code';

export function statusCopy(key: StatusKey): string {
  return COPY[`status_${key}` as const] as string;
}
