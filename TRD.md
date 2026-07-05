# TRD — 미러온 (MirrorON) v3 기술 요구사항 정의서

**버전**: 2.0 | **변경 핵심**: 초보자 퍼스트 디자인 시스템(2절) 신설, UI 컴포넌트 재정의(7절)

---

## 1. 기술 스택

| 레이어 | 선택 |
|---|---|
| 프레임워크 | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui (초보자용 대형 변형 커스텀) |
| 실시간 미디어 | WebRTC (getDisplayMedia / RTCPeerConnection) |
| 시그널링 | Supabase Realtime (Broadcast) |
| DB / Auth | Supabase PostgreSQL |
| STUN / TURN | Google STUN + metered.ca → 확장 시 coturn(Azure VM) |
| PWA | 수동 Service Worker + Web App Manifest (PWABuilder 사양) |
| QR | `qrcode`(생성) / `@zxing/browser`(스캔) |
| 배포 | Vercel + PWABuilder(APK) |

---

## 2. 초보자 퍼스트 디자인 시스템 ⭐ v2 신설

### 2.1 타이포그래피 (Pretendard, 다크 배경 기준)
| 토큰 | 기본 크게 | 더 크게(×1.25) | 용도 |
|---|---|---|---|
| `text-code` | 56px / bold | 70px | 6자리 룸 코드 |
| `text-title` | 32px / bold | 40px | 화면 제목 (한 문장) |
| `text-button` | 24px / semibold | 30px | 모든 버튼 라벨 |
| `text-body` | 20px / regular | 25px | 안내 문장 |
| `text-caption` | 17px | 21px | 보조 설명 (최소 크기, 이 이하 금지) |

- 구현: `html`에 `data-font-scale="base|large"` → CSS 변수 `--fs-*` 전환. 설정은 localStorage가 아닌 **메모리 상태 + user_preferences(로그인 시)** 저장
- 줄 간격 1.6, 한 줄 최대 18자 내외로 문장 설계

### 2.2 터치 타겟 & 레이아웃
| 규칙 | 값 |
|---|---|
| 주요 액션 버튼(BigButton) | 최소 높이 88px, 화면 폭 90%, 모서리 20px |
| 첫 화면 2대 버튼 | 각각 화면 높이의 ~35% (초대형) |
| 일반 버튼/토글 | 최소 64×64px |
| 버튼 간 간격 | ≥ 16px |
| 화면당 인터랙션 요소 | 최대 3개 (주 버튼 1 + 보조 1 + 뒤로가기) |
| 숫자 키패드 | 키 1개 72×72px, 전화 키패드 배열 |

### 2.3 컬러 & 대비 (다크 베이스 #0B1220)
| 토큰 | 값 | 대비 검증 |
|---|---|---|
| `bg-base` | #0B1220 | — |
| `text-primary` | #F4F7FB | 15:1 ✅ |
| `accent`(주 버튼) | #22D3EE(시안) 배경 + #06222A 텍스트 | 8:1 ✅ |
| `success` | #4ADE80 + ✓ 아이콘 병행 | |
| `error` | #F87171 + ⚠ 아이콘 + 해결 문구 병행 | |
- 상태는 **색+아이콘+문구 3중 표현** (색약 대응)

### 2.4 쉬운 한국어 문구 사전 (i18n 키로 중앙 관리: `lib/copy.ko.ts`)
| 기술 상태 | 화면 문구 |
|---|---|
| signaling connecting | 상대 기기를 찾고 있어요… |
| ICE gathering / P2P established | 연결하고 있어요… / 빠른 연결이 되었어요 ⚡ |
| TURN relay fallback | 연결되었어요 (조금 느릴 수 있어요) |
| permission denied | 화면 공유가 취소되었어요. 다시 하려면 아래 버튼을 눌러주세요 |
| ice failed | 연결이 어려워요. Wi-Fi를 확인하고 다시 해볼까요? |
| room expired | 시간이 지나 연결 번호가 사라졌어요. 새 번호를 받아주세요 |
- 규칙: 문장 끝 "~해요"체 통일, 한 문장 25자 이내, 외래어·영문 약어 금지(QR은 "네모 무늬(QR)"로 첫 표기)

### 2.5 단계 위저드 패턴
- 모든 연결 흐름은 `StepWizard`로 감싼다: 상단 진행 표시(●●○ + "2단계 / 3단계"), 중앙 일러스트, 한 문장 설명, 하단 BigButton 1개
- 뒤로가기: 좌상단 상시 노출(64px), 진행 상태 보존
- 시스템 권한 팝업 전 **프리뷰 카드**: 실제 OS 팝업 스크린샷 + 눌러야 할 버튼에 화살표 표시

---

## 3. 시스템 아키텍처

```
[송출 Sender]                              [수신 Viewer]
 getDisplayMedia()                          <video> 재생
 RTCPeerConnection ◄──── SRTP(P2P/TURN) ───► RTCPeerConnection
        │                                        │
        └────────── Supabase Realtime ───────────┘
             room:{code} — offer/answer/ice/role-swap
                        │
                Supabase PostgreSQL (메타·로그만)
```
- 미디어는 서버 미경유 (TURN도 암호화 패킷 릴레이만)

## 4. WebRTC 상세 설계

### 4.1 화면 캡처 & 기능 감지
```ts
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { frameRate: { ideal: 30, max: 60 }, width: { ideal: 1920 } },
});
// detectCaptureSupport(): 'full' | 'camera-only'(iOS) | 'viewer-only'
```
- Windows/macOS Chrome·Edge·Safari 17+ ✅ / **Android Chrome ❌** / iOS Safari ❌ → 4.4 폴백
- ⚠️ **정정 (2026-07-05 실측·caniuse 확인)**: 모바일 브라우저(Android Chrome v149·삼성 인터넷 포함)는 getDisplayMedia 미지원. **폰 화면 송출은 iOS·Android 모두 브라우저만으로는 불가** → 카메라 모드 폴백. 폰 화면 송출은 네이티브 컴패니언 앱(MediaProjection/ReplayKit) 로드맵 항목 (경쟁사가 모두 폰 앱 설치를 요구하는 근본 이유)
- 감지 결과에 따라 **첫 화면 버튼 구성 자체가 바뀜**: iOS면 [내 화면 보여주기] 대신 [카메라로 보여주기] + [PC 화면 보기]를 크게

### 4.2 ICE 구성 & 연결 판별
```ts
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:relay.metered.ca:443?transport=tcp', username, credential },
  ],
  iceCandidatePoolSize: 4,
});
```
- TURN 자격증명은 `/api/turn-credentials`에서 단기 발급
- `getStats()` candidate-pair로 host/srflx/relay 판별 → 2.4 문구 사전의 쉬운 말로 표시 (기술 배지는 관리자 모드에서만)

### 4.3 시그널링 프로토콜 (Realtime Broadcast, 채널 `room:{code}`)
| type | payload | 방향 |
|---|---|---|
| join | { peerId, role, device } | 입장 |
| offer / answer | { sdp, from, to } | 협상 |
| ice | { candidate, from, to } | 양방향 |
| role-swap | { requestId } | 방향 전환(재협상) |
| leave | { peerId } | 퇴장 |

### 4.4 iOS 송출 폴백
1. 감지 → 쉬운 말 안내: "아이폰은 화면을 직접 보내는 기능을 막아두었어요"
2. **[카메라로 보여주기]**: getUserMedia 후면 카메라 송출 (실물 시연용)
3. **[그림으로 방법 보기]**: 맥북=QuickTime 유선 미러링 단계 가이드 / 윈도우=외부 도구 안내
4. 뷰어 역할은 100% 지원 — iOS 첫 화면에서 뷰어 버튼을 최상단 대형 배치

### 4.5 [다시 연결] 원탭 재연결 ⭐ v3 (경쟁사 마찰 제거)
LetsView의 "세션 만료 후 재연결 요구", 삼성 Flow의 "사전 기기 등록 절차"를 대체하는 설계.

1. **기억하기**: 연결 성공 직후 1회 질문 "이 컴퓨터를 기억할까요?" → 수락 시 서버가 `pair_token`(UUID) 발급, 양쪽 기기 localStorage에 저장 (기기 별명: "회사 컴퓨터" 등 수정 가능, 기본값은 브라우저/OS 자동 명명)
2. **재연결**: 다음 방문 시 pair_token 존재 → 첫 화면 최상단에 [🔄 {별명}에 다시 연결] 대형 버튼
   - 탭 1번 → `/api/rooms/rejoin`이 토큰 검증 후 **새 룸을 자동 생성**하고, 상대 기기에 Realtime 개인 채널(`pair:{token}`)로 초대 푸시 → 상대가 앱을 열어두었으면 즉시 연결, 아니면 "컴퓨터에서 미러온을 열어주세요" 안내
3. **보안**: pair_token은 30일 TTL, 기기당 최대 5쌍, 언제든 [기억 지우기]. 토큰만으로는 미디어 접근 불가(매번 새 룸 + 새 channel_token 발급 구조 유지)
4. **실패 시 우아한 강등**: 상대 미접속·토큰 만료 → 일반 QR/코드 플로우로 자연스럽게 전환 (오류처럼 보이지 않게)

### 4.6 재연결 & 품질
- `disconnected` 5초 → `restartIce()` → 실패 시 전체 재협상 (사용자에게는 "다시 연결하고 있어요…" 단일 문구)
- 자동 재시도 3회 실패 → 오류 해결 카드 표시 (7.5)
- `setParameters` maxBitrate 3단계 (2.5M/1.2M/600k) 자동 적응

## 5. API 설계

| 메서드 | 경로 | 기능 |
|---|---|---|
| POST | /api/rooms | 룸 생성 (6자리 숫자 코드 + 채널 토큰, TTL 10분) |
| POST | /api/rooms/join | 코드 검증, 5회/60초 IP 제한 |
| GET | /api/turn-credentials | 단기 TURN 자격증명 |
| POST | /api/rooms/rejoin | ⭐v3 pair_token 검증 → 새 룸 자동 생성 + 상대 기기 초대 푸시 |
| DELETE | /api/pairs/{token} | ⭐v3 기억된 기기 쌍 삭제 |
| POST | /api/logs/connection | 연결 로그 (KPI: 터치 수, 소요 시간 포함 ⭐v2) |
| GET | /.well-known/assetlinks.json | TWA 자산 링크 |

## 6. 페이지 구조

```
app/
  page.tsx              # 첫 화면: 초대형 버튼 2개 + 글자크기 토글
  send/page.tsx         # 송출 위저드 (3단계)
  view/page.tsx         # 뷰어: 코드/QR 대형 표시 → 수신
  guide/page.tsx        # "어떤 기기끼리 연결하나요?" 그림 선택
  guide/[combo]/page.tsx# 4조합 단계별 그림 가이드
  admin/page.tsx        # 교육 모드·통계 (관리자 전용, 첫 화면 비노출)
  api/...
components/
  BigButton.tsx  StepWizard.tsx  CodeDisplay.tsx  NumPad.tsx
  QrScanner.tsx  VideoViewer.tsx  PermissionPreview.tsx
  ErrorHelpCard.tsx  FontScaleToggle.tsx  DeviceFrame.tsx  RejoinButton.tsx
  EduModePanel.tsx  StatsOverlay.tsx(관리자)
lib/
  webrtc.ts  signaling.ts  capture.ts  detect.ts  supabase.ts  copy.ko.ts
```

## 7. 핵심 UI 컴포넌트 사양 ⭐ v2

### 7.1 BigButton
- 높이 88px+, 아이콘(40px) + 라벨(24px+), 눌림 상태 시각 피드백(스케일 0.97 + 진동 haptic)
- variant: primary(시안) / secondary(외곽선) / danger(멈추기)

### 7.2 StepWizard
- props: steps[{ illustration, title(한 문장), action }], 진행 표시 자동
- 각 스텝 전환 시 스크린리더 알림(aria-live)

### 7.3 CodeDisplay / NumPad
- 코드 표시 56px+ 자간 넓게, 3-3 분할, [소리내어 읽기] 버튼(P2 TTS 대비 자리)
- NumPad: 72px 키, 오입력 시 흔들림 없이 지우기 큰 버튼

### 7.4 PermissionPreview
- OS별(안드로이드/맥/윈도우) 실제 권한 팝업 스크린샷 + 눌러야 할 버튼 화살표 강조
- "곧 이런 창이 나타나요" → [준비됐어요] 버튼 후 실제 API 호출 (사용자 제스처 체인 유지 필수)

### 7.5 ErrorHelpCard
- 실패 원인 → 쉬운 말 제목 + 그림 + 해결 단계 1~3개 + [다시 해보기] BigButton
- 예: ice-failed → "Wi-Fi가 서로 다른가 봐요" → ①두 기기를 같은 Wi-Fi에 ②그래도 안 되면 [다시 해보기] (자동으로 릴레이 연결 시도)

### 7.6 교육 녹화 모드 (관리자)
- Document PiP 항상-위 창, 베젤 프레임 SVG(갤럭시/아이폰), 배경 투명/그린/커스텀, StatsOverlay
- 초보자 화면과 완전 분리 (`/admin`) — 첫 화면 오염 금지

## 8. PWA & PWABuilder

### 8.1 manifest.json (검증 통과 필수 필드)
v1과 동일 사양 유지: `id`, name("미러온 - 화면 미러링"), short_name("미러온"), start_url("/?source=pwa"), display standalone, display_override, theme/background #0B1220, **아이콘 192/512 × any/maskable 4종**, **screenshots wide/narrow 2종**, shortcuts([화면 보여주기]/[화면 보기]), lang "ko"
- TWA: `/.well-known/assetlinks.json` SHA256 반영으로 주소창 제거

### 8.2 Service Worker
- 셸 Cache-First / API·시그널링 Network-Only / WebRTC 미개입
- 오프라인 페이지도 초보자 문구: "인터넷이 연결되어 있지 않아요. Wi-Fi를 켜고 다시 열어주세요"

### 8.3 지속성
- `wakeLock` 화면 유지, 백그라운드 전환 감지 → "화면을 켜두어야 계속 보여줄 수 있어요" 복귀 안내

## 9. 접근성 기술 요구 (PRD 7절 구현)
- 시맨틱 헤딩 구조, 모든 인터랙션 요소 aria-label(쉬운 한국어)
- 포커스 링 3px 고대비, 키보드 조작 가능(PC)
- `prefers-reduced-motion` 시 전환 애니메이션 제거
- Lighthouse Accessibility ≥ 90 게이트

## 10. 비기능 요구사항
| 항목 | 기준 |
|---|---|
| TTFF | ≤ 5s (P95) |
| 첫 화면 로드(LCP, 4G) | ≤ 2.5s |
| Lighthouse PWA / A11y / Perf | 통과 / ≥90 / ≥85 |
| 동시 룸 | MVP 100 |
| 브라우저 | Chrome/Edge 105+, Safari 17+, Android Chrome 105+, iOS Safari 17+(뷰어) |
| 보안 | DTLS-SRTP, 룸 코드 crypto 랜덤+TTL, RLS, CSP/HSTS |
