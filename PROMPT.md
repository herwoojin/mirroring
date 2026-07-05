# PROMPT — 미러온 (MirrorON) v3 Claude Code 실행 프롬프트

> Antigravity IDE + Claude Code에서 순서대로 실행. 루트에 PRD.md, TRD.md, ERD.md 필수.
> **v2 원칙**: 모든 UI 작업 프롬프트에 "초보자 퍼스트 디자인 시스템(TRD 2절) 준수"가 전제됨.

---

## P0. 프로젝트 초기화 + 디자인 시스템

```
PRD.md, TRD.md를 읽고 미러온 프로젝트를 초기화해줘.

1. Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
2. TRD 2절의 초보자 퍼스트 디자인 시스템을 먼저 구축:
   - CSS 변수 기반 타이포 토큰 (text-code 56px ~ text-caption 17px)
   - data-font-scale="base|large" 전환 (×1.25) + FontScaleToggle 컴포넌트
   - 다크 팔레트 (#0B1220 베이스, 시안 accent) — WCAG AA 대비 주석 포함
   - BigButton 컴포넌트 (높이 88px+, 아이콘+라벨, 눌림 피드백, primary/secondary/danger)
3. lib/copy.ko.ts — TRD 2.4 쉬운 한국어 문구 사전 전체를 상수로 정의
4. 첫 화면(page.tsx): 초대형 버튼 2개
   [📱 내 화면 보여주기] / [🖥️ 다른 기기 화면 보기] — 각각 화면 높이 35%
   우상단 글자크기 토글, 하단에 작게 [사용 방법 그림으로 보기] 링크
5. .env.example (SUPABASE 3종 + TURN_API_KEY + NEXT_PUBLIC_APP_URL)
스토리북 없이 /dev-preview 페이지에 컴포넌트 카탈로그를 만들어 확인 가능하게 해줘.
```

## P1. Supabase 스키마 & API

```
ERD.md대로 마이그레이션을 만들어줘.
- supabase/migrations/0001_init.sql (rooms, sessions, connection_logs, room_join_attempts + RLS)
- supabase/migrations/0002_beginner_ux.sql (ERD 4절 그대로: UX 지표 컬럼, user_preferences, guide_feedback)

API Route Handler:
- POST /api/rooms — 숫자 6자리 코드 crypto 생성, channel_token 해시 저장
- POST /api/rooms/join — 검증 + ip_hash 5회/60초 제한 + entry_method 기록
- GET /api/turn-credentials — metered.ca 프록시, 입장 토큰 필수
- POST /api/logs/connection — v2 UX 지표(tap_count, time_to_connect_ms, error_card_*, wizard_abandon_step) 포함
- POST /api/feedback/guide — guide_feedback INSERT (익명)
서비스 롤 키는 lib/supabase-admin.ts 서버 전용으로 분리.
```

## P2. WebRTC 코어

```
TRD 4절대로 구현해줘.
- lib/capture.ts: startScreenCapture(), detectCaptureSupport() → 'full'|'camera-only'|'viewer-only'
- lib/signaling.ts: Realtime room:{code} 래퍼, join/offer/answer/ice/role-swap/leave 타입
- lib/webrtc.ts: perfect negotiation, getStats candidate-pair 판별(host/srflx/relay),
  disconnected 5초 후 restartIce → 실패 시 재협상, maxBitrate 3단계
- 연결 상태는 기술 용어가 아니라 copy.ko.ts의 쉬운 문구 키로 이벤트 발행
  (예: emit('status', 'finding_peer') → UI가 "상대 기기를 찾고 있어요…" 표시)
같은 브라우저 탭 2개 로컬 E2E 미러링까지 확인해줘.
```

## P3. 연결 위저드 (초보자 플로우의 심장) ⭐

```
TRD 2.5, 7.2~7.5 사양으로 연결 위저드를 구현해줘.

- StepWizard 컴포넌트: 상단 진행 표시(●●○ + "2단계 / 3단계"), 중앙 일러스트 슬롯,
  한 문장 제목(text-title), 하단 BigButton 1개, 좌상단 뒤로가기 64px, aria-live 단계 알림

- send/page.tsx (폰에서 내 화면 보여주기, 3단계):
  1단계 "PC 화면의 네모 무늬(QR)를 비춰주세요" — QrScanner 크게 + 하단 [숫자로 입력하기]
     → NumPad: 72px 키, 전화 배열, 입력값 56px 표시, 지우기 큰 버튼
  2단계 PermissionPreview — Android 권한 팝업 실제 스크린샷 + "지금 시작" 버튼에 화살표,
     [준비됐어요] 클릭 시 getDisplayMedia 호출 (사용자 제스처 체인 유지 주의)
  3단계 완료 — 큰 ✓ + "연결 완료! 이제 PC에서 내 화면이 보여요" + [멈추기] danger 버튼 하나만

- view/page.tsx (PC에서 보기):
  룸 생성 → CodeDisplay(56px, 3-3 분할) + QR 대형 + "휴대폰으로 이 무늬를 찍어주세요" 한 문장
  수신 시작되면 영상 전체 표시 + 우하단 [교육 모드](관리자) 진입 아이콘(작게)

- ErrorHelpCard: fail_reason별 쉬운 제목+그림+해결 1~3단계+[다시 해보기]
  ice-failed / permission-denied / room-expired / timeout 4종 우선
- 터치 수(tap_count)와 진입~첫프레임 시간을 측정해 연결 로그에 포함해줘.
```

## P3.5 [다시 연결] 원탭 재연결 ⭐ v3

```
TRD 4.5와 ERD의 trusted_pairs 사양으로 원탭 재연결을 구현해줘.

- 연결 성공 3초 후 하단 시트: "이 컴퓨터를 기억할까요? 다음엔 버튼 한 번으로 연결돼요"
  [기억하기] [괜찮아요] — 기억하기 시 POST /api/pairs → pair_token 양쪽 localStorage 저장
- 첫 화면(page.tsx): pair_token 존재 시 최상단에 RejoinButton
  [🔄 {별명}에 다시 연결] (BigButton, 기존 2대 버튼보다 위)
- POST /api/rooms/rejoin: 토큰 검증 → 새 룸 생성 → Realtime pair:{token} 채널로 상대 초대
  → 상대 접속 중이면 자동 연결(지난 역할 복원), 미접속이면
  "컴퓨터에서 미러온을 열어주세요" 대기 화면 (60초 후 일반 QR 플로우로 자연 전환)
- 설정 시트: 기억된 기기 목록(최대 5), 별명 수정, [기억 지우기](DELETE /api/pairs/{token})
- 만료·삭제된 토큰이면 오류 없이 조용히 일반 플로우로 강등하고 localStorage 정리
```

## P4. iOS 폴백 & 4조합 그림 가이드

```
TRD 4.4 + PRD 4.1을 구현해줘.

- detectCaptureSupport()가 'camera-only'면 send 위저드 대신:
  "아이폰은 화면을 직접 보내는 기능을 막아두었어요" (쉬운 말, 원망 없이 담백하게)
  + [카메라로 보여주기](getUserMedia 후면, 전/후면 전환) + [그림으로 방법 보기]

- app/guide/page.tsx: "어떤 기기끼리 연결하나요?" — 기기 그림 2×2 선택 카드(각 카드 대형)
- app/guide/[combo]/page.tsx (mac-galaxy / mac-iphone / win-galaxy / win-iphone):
  단계별 카드: 실기기 화면 캡처 자리(placeholder img) + 번호 + 한 문장 설명(text-body)
  각 단계 하단 [👍 도움이 됐어요] [👎 잘 모르겠어요] → /api/feedback/guide 전송
  mac-iphone, win-iphone에는 QuickTime/외부도구 안내 단계 포함
- 모든 가이드는 스크롤 최소화: 한 화면 = 한 단계, 좌우 스와이프/다음 버튼 이동
```

## P5. 교육 녹화 모드 (관리자 — 초보자 화면과 분리)

```
app/admin 하위에 교육 모드를 구현해줘. 첫 화면에는 노출하지 않음 (view 우하단 아이콘으로만 진입).
- EduModePanel: 프레임(갤럭시/아이폰/없음), 배경(투명/그린/컬러피커), 통계 on/off
- DeviceFrame: SVG 베젤, 수신 영상 비율 자동 맞춤
- Document Picture-in-Picture [별도 창으로 띄우기] + 미지원 브라우저 기본 PiP 폴백
- StatsOverlay: getStats 1초 폴링 — 해상도/fps/RTT/비트레이트/연결방식(여기서만 기술 용어 허용)
```

## P6. PWA + PWABuilder

```
TRD 8절 사양으로 PWA를 완성해줘.
1. public/manifest.json — id/name/short_name/start_url/display/display_override/
   theme·background #0B1220/lang ko/icons 4종(192·512×any·maskable)/screenshots 2종/shortcuts 2개
2. 아이콘: 시안 그라데이션에 두 화면이 마주보는 미니멀 심볼 SVG 제작 → sharp로 PNG 8종 생성
3. public/sw.js — 셸 Cache-First, API Network-Only, WebRTC 미개입,
   오프라인 페이지 문구 "인터넷이 연결되어 있지 않아요. Wi-Fi를 켜고 다시 열어주세요"
4. layout.tsx — manifest 링크, apple-touch-icon, beforeinstallprompt 설치 배너
   (배너 문구: "홈 화면에 추가하면 앱처럼 쓸 수 있어요")
5. public/.well-known/assetlinks.json placeholder (SHA256 주석)
6. wakeLock + 백그라운드 복귀 안내 토스트
완료 후 Lighthouse PWA·Accessibility 점검 리포트 출력. A11y 90 미만 항목은 즉시 수정해줘.
```

## P7. 마무리 & 배포

```
- CSP/HSTS 헤더, Vercel 배포 설정
- 연결 로그 자동 기록 훅 최종 점검 (tap_count, wizard_abandon_step 포함)
- ERD 5절의 KPI 집계 쿼리 3종을 /admin 대시보드 카드로 표시
- TASK.md 체크리스트 대조 → 미완료 목록 출력
```

---

## 품질 검증 프롬프트

```
[초보자 문구 감사]
전체 코드베이스에서 사용자에게 노출되는 문자열을 모두 추출해서
TRD 2.4 규칙(~해요체, 25자 이내, 외래어·기술용어 금지) 위반을 표로 정리하고 수정해줘.
```

```
[접근성 감사]
모든 페이지에서 터치 타겟 64px 미만, 대비 4.5:1 미만, aria-label 누락,
색만으로 상태 구분하는 요소를 찾아 수정해줘.
```

```
[Android 캡처 제스처 이슈]
PermissionPreview의 [준비됐어요] 클릭과 getDisplayMedia 호출 사이에
비동기 지연이 있으면 사용자 제스처가 끊겨 NotAllowedError가 날 수 있어. 체인을 검증하고 수정해줘.
```
