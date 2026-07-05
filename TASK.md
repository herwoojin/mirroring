# TASK — 미러온 (MirrorON) v3 작업 체크리스트

> PROMPT.md P0~P7과 1:1 매핑. 🔴 P0(MVP) / 🟡 P1 / 🟢 P2

---

## Phase 0 — 초기화 + 디자인 시스템 (P0)
- [ ] 🔴 Next.js 14 + TS + Tailwind + shadcn/ui
- [ ] 🔴 타이포 토큰(56/32/24/20/17px) + data-font-scale 전환(×1.25)
- [ ] 🔴 FontScaleToggle (첫 화면 우상단 상시)
- [ ] 🔴 BigButton (88px+, 눌림 피드백, 3 variant)
- [ ] 🔴 lib/copy.ko.ts 쉬운 한국어 문구 사전
- [ ] 🔴 첫 화면: 초대형 버튼 2개 + 가이드 링크
- [ ] 🔴 /dev-preview 컴포넌트 카탈로그
- [ ] 🟡 다크 팔레트 대비 검증 주석 (AA)

## Phase 1 — 데이터 & API (P1)
- [ ] 🔴 0001_init.sql (4테이블 + RLS)
- [ ] 🔴 0002_beginner_ux.sql (UX 지표 컬럼, user_preferences, guide_feedback)
- [ ] 🔴 /api/rooms, /api/rooms/join (레이트리밋 + entry_method)
- [ ] 🔴 /api/turn-credentials
- [ ] 🟡 /api/logs/connection (tap_count 등 v2 지표)
- [ ] 🟡 /api/feedback/guide
- [ ] 🟡 pg_cron 만료 청소

## Phase 2 — WebRTC 코어 (P2) ⭐ 성패 구간
- [ ] 🔴 capture.ts (getDisplayMedia + 3분류 감지)
- [ ] 🔴 signaling.ts (Realtime 프로토콜)
- [ ] 🔴 webrtc.ts (perfect negotiation, 재연결, 판별)
- [ ] 🔴 상태 → 쉬운 문구 키 이벤트 매핑
- [ ] 🔴 로컬 탭 2개 E2E 성공
- [ ] 🟡 maxBitrate 3단계 / role-swap

## Phase 3 — 연결 위저드 (P3) ⭐ 초보자 UX 핵심
- [ ] 🔴 StepWizard (진행 표시 + aria-live)
- [ ] 🔴 send 3단계: QR 스캔 → PermissionPreview → 완료([멈추기] 단일 버튼)
- [ ] 🔴 NumPad (72px 키, 전화 배열)
- [ ] 🔴 view: CodeDisplay 56px + QR 대형 + 한 문장 안내
- [ ] 🔴 ErrorHelpCard 4종 (ice-failed/permission-denied/room-expired/timeout)
- [ ] 🔴 tap_count·time_to_connect 측정 훅
- [ ] 🟡 ?code= 딥링크 자동 입장

## Phase 3.5 — [다시 연결] 원탭 재연결 (P3.5) ⭐ v3
- [ ] 🔴 trusted_pairs 마이그레이션 + /api/pairs, /api/rooms/rejoin
- [ ] 🔴 연결 성공 후 "기억할까요?" 시트 (1회 질문)
- [ ] 🔴 첫 화면 RejoinButton (터치 1번 재연결)
- [ ] 🔴 상대 미접속 대기 → 60초 후 일반 플로우 자연 전환
- [ ] 🟡 기억된 기기 관리 시트 (별명 수정·삭제)

## Phase 4 — iOS 폴백 & 그림 가이드 (P4)
- [ ] 🔴 iOS 감지 → 쉬운 말 안내 + 버튼 재구성
- [ ] 🟡 카메라 미러 모드 (전/후면 전환)
- [ ] 🔴 /guide 기기 선택(2×2 대형 카드)
- [ ] 🔴 /guide/[combo] 4종 — 한 화면 한 단계, 👍👎 피드백
- [ ] 🟡 mac-iphone·win-iphone QuickTime/외부도구 단계

## Phase 5 — 교육 모드 (P5, 관리자)
- [ ] 🔴 /admin 분리 진입 (첫 화면 비노출)
- [ ] 🔴 EduModePanel + DeviceFrame SVG
- [ ] 🔴 Document PiP (+기본 PiP 폴백)
- [ ] 🟡 StatsOverlay / 🟢 크로마키 커스텀

## Phase 6 — PWA & PWABuilder (P6)
- [ ] 🔴 manifest.json 전체 필드 (TRD 8.1)
- [ ] 🔴 아이콘 8종 + 스크린샷 2종
- [ ] 🔴 sw.js (오프라인 페이지도 쉬운 문구)
- [ ] 🔴 wakeLock + 백그라운드 복귀 안내
- [ ] 🔴 Lighthouse PWA 통과 + **Accessibility ≥ 90**
- [ ] 🔴 PWABuilder 통과 → APK → assetlinks SHA256 반영 → standalone 확인
- [ ] 🟡 설치 배너 (쉬운 문구)

## Phase 7 — 배포 & 검증 (P7)
- [ ] 🔴 CSP/HSTS, Vercel 프로덕션
- [ ] 🔴 연결 로그 훅 최종 점검
- [ ] 🟡 /admin KPI 대시보드 카드 3종
- [ ] 🟡 README 정리

## 품질 감사 (PROMPT 품질 검증 프롬프트와 매핑)
- [ ] 🔴 문구 감사: ~해요체·25자·기술용어 금지 전수 점검
- [ ] 🔴 접근성 감사: 터치 64px·대비 4.5:1·aria-label·색 단독 구분 금지
- [ ] 🔴 제스처 체인 검증 (PermissionPreview → getDisplayMedia)

## 실기기 테스트 매트릭스 (릴리즈 게이트)
| # | 시나리오 | 같은 Wi-Fi | 교차 네트워크 |
|---|---|---|---|
| T1 | 갤럭시 → 맥북 | [ ] | [ ] |
| T2 | 갤럭시 → 윈도우 | [ ] | [ ] |
| T3 | 맥북 → 갤럭시 | [ ] | [ ] |
| T4 | 맥북 → 아이폰 | [ ] | [ ] |
| T5 | 윈도우 → 갤럭시 | [ ] | [ ] |
| T6 | 윈도우 → 아이폰 | [ ] | [ ] |
| T7 | 아이폰 카메라 모드 + 가이드 플로우 | [ ] | [ ] |
| T8 | OBS 교육 녹화 E2E | [ ] | — |
| T9 | APK로 T2 재검증 (standalone) | [ ] | [ ] |

## 초보자 사용자 테스트 (릴리즈 게이트) ⭐ v2 신설
| # | 시나리오 | 기준 | 결과 |
|---|---|---|---|
| U1 | 디지털 초보 3인: 안내 없이 폰→PC 연결 | 3인 중 3인 5분 내 성공 | [ ] |
| U2 | 60대 사용자 1인: 앱 화면만 보고 연결 | 5분 내, 도움 요청 0회 | [ ] |
| U3 | [더 크게] 모드에서 전체 플로우 | 레이아웃 깨짐 0건 | [ ] |
| U4 | 일부러 권한 거부 → ErrorHelpCard로 재시도 | 자가 해결 성공 | [ ] |
| U5 | 숫자 입력(QR 미사용) 경로 | 오입력 후 수정 포함 성공 | [ ] |
| U6 | 재방문: [다시 연결] 버튼으로 재연결 ⭐v3 | 터치 1번, 10초 내 | [ ] |
| C1 | 경쟁 비교 리허설: 동일 초보자에게 LetsView vs 미러온 첫 연결 | 미러온 소요시간 1/2 이하 | [ ] |
