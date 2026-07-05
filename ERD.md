# ERD — 미러온 (MirrorON) v3 데이터 모델

**DB**: Supabase PostgreSQL | **원칙**: 영상 미저장, 메타·로그만
**v2 변경**: ①user_preferences에 접근성 설정 ②connection_logs에 초보자 UX 지표 ③guide_feedback 신설

---

## 1. 엔티티 관계도

```
users (Supabase Auth, 선택적)
  │ 1
  ├──────────── 1:1 ── user_preferences (글자크기 등 접근성 설정)
  │ 0..N
rooms ────────< sessions
  │ 1               │ 1
  │ 0..N            │ 0..N
room_join_attempts  connection_logs (UX 지표 포함)

guide_feedback (독립 — 가이드 페이지 "도움이 됐어요" 수집)
trusted_pairs  (독립 — [다시 연결] 기기 쌍 토큰, ⭐v3)
```

---

## 2. 테이블 정의

### 2.1 `rooms`
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | |
| code | char(6) | UNIQUE NOT NULL | 숫자 6자리 (초보자 입력 편의로 숫자만) |
| channel_token | text | NOT NULL | 해시 저장 |
| owner_id | uuid | FK auth.users, NULL | |
| status | text | 'waiting','active','closed' | |
| max_viewers | smallint | default 4 | |
| created_at / expires_at / closed_at | timestamptz | | TTL 10분, active 시 +4h |

### 2.2 `sessions`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| room_id | uuid FK CASCADE | |
| peer_id | text | |
| role | 'sender'\|'viewer' | role-swap 시 UPDATE |
| device_os / device_type / browser | text | |
| capture_capable | boolean | |
| font_scale_used | text ⭐v2 | 'base'\|'large' — 큰글자 모드 사용률 측정 |
| entry_method | text ⭐v2 | 'qr'\|'numpad'\|'deeplink' — QR vs 숫자입력 비율 |
| joined_at / left_at | timestamptz | |

### 2.3 `connection_logs` — KPI 산출 (v2 UX 지표 확장)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | bigint PK | |
| session_id / room_id | uuid FK | |
| result | 'connected','failed','disconnected','reconnected' | |
| connection_type | 'host','srflx','relay' | |
| ttff_ms / avg_rtt_ms / avg_fps / duration_sec | int | |
| resolution / network_pair / fail_reason | text | |
| **tap_count** ⭐v2 | smallint | 첫 화면→연결 완료까지 터치 수 (KPI ≤4) |
| **time_to_connect_ms** ⭐v2 | integer | 첫 화면 진입→첫 프레임 총 소요 |
| **error_card_shown** ⭐v2 | text | 표시된 ErrorHelpCard 종류 |
| **error_card_resolved** ⭐v2 | boolean | 해결 카드로 재시도 성공 여부 (자가 해결률 KPI) |
| **wizard_abandon_step** ⭐v2 | smallint | 이탈 시 중단 단계 (1~3, NULL=완료) |
| created_at | timestamptz | |

### 2.4 `room_join_attempts` — 무차별 대입 방지
| 컬럼 | 설명 |
|---|---|
| ip_hash / code_tried / success / created_at | v1과 동일. 5회/60초 쿨다운 |

### 2.5 `user_preferences` ⭐v2 확장 (접근성 설정)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| user_id | uuid PK FK | |
| font_scale | 'base'\|'large' | 글자 크기 모드 |
| reduce_motion | boolean | 애니메이션 최소화 |
| voice_guide | boolean | 음성 안내 (P2 대비) |
| default_role | 'sender'\|'viewer' | |
| edu_mode_frame / edu_mode_bg / stats_overlay | text/text/bool | 관리자 교육 모드 |
| updated_at | timestamptz | |

### 2.6 `trusted_pairs` ⭐v3 신설 — [다시 연결] 원탭 재연결
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK = pair_token |
| device_a_hint / device_b_hint | text | 기기 표시명 ("갤럭시 S25", "회사 컴퓨터") — 개인정보 아닌 UA 기반 별명 |
| nickname | text | 사용자가 수정한 별명 (NULL이면 hint 사용) |
| last_role_a | text | 지난 연결에서 A의 역할 ('sender'/'viewer') — 재연결 시 역할 자동 복원 |
| created_at | timestamptz | |
| last_used_at | timestamptz | 재연결 시 갱신, TTL 기준점 |
| expires_at | timestamptz | last_used_at + 30일 |

정책: 익명 기기 식별자는 저장하지 않음 (토큰 소지 = 권한). 기기당 최대 5쌍은 클라이언트 localStorage에서 관리, 서버는 만료 청소만.

### 2.7 `guide_feedback` ⭐v2 신설 — 가이드 개선 루프
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | bigint PK | |
| combo | text | 'mac-galaxy','mac-iphone','win-galaxy','win-iphone' |
| step_index | smallint | 몇 번째 단계에서 피드백했는지 |
| helpful | boolean | [도움이 됐어요 👍] / [잘 모르겠어요 👎] |
| device_os | text | |
| created_at | timestamptz | |
> 👎 비율 높은 단계 = 그림/문구 개선 대상. 익명 수집, 개인정보 없음.

---

## 3. RLS 정책
| 테이블 | 정책 |
|---|---|
| rooms / sessions / connection_logs / room_join_attempts | 서비스 롤 전용 (API 경유). owner는 본인 룸·로그 SELECT |
| user_preferences | 본인 행만 ALL (`auth.uid() = user_id`) |
| guide_feedback | INSERT anon 허용(익명 피드백), SELECT 서비스 롤 |
| trusted_pairs | 서비스 롤 전용 (rejoin API 경유). 토큰 소지자만 사용 가능 |

> SDP/ICE는 DB 미저장 — Realtime Broadcast로만 흐름.

## 4. 마이그레이션 스켈레톤 (v2 diff 중심)

```sql
-- 0001_init.sql: v1 기본 테이블 (rooms, sessions, connection_logs, room_join_attempts)
-- 0002_beginner_ux.sql: v2 확장
alter table sessions add column font_scale_used text,
                     add column entry_method text;

alter table connection_logs
  add column tap_count smallint,
  add column time_to_connect_ms integer,
  add column error_card_shown text,
  add column error_card_resolved boolean,
  add column wizard_abandon_step smallint;

create table user_preferences (
  user_id uuid primary key references auth.users(id),
  font_scale text not null default 'base' check (font_scale in ('base','large')),
  reduce_motion boolean not null default false,
  voice_guide boolean not null default false,
  default_role text check (default_role in ('sender','viewer')),
  edu_mode_frame text, edu_mode_bg text, stats_overlay boolean default false,
  updated_at timestamptz not null default now()
);

create table trusted_pairs (
  id uuid primary key default gen_random_uuid(),
  device_a_hint text, device_b_hint text, nickname text,
  last_role_a text check (last_role_a in ('sender','viewer')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index idx_pairs_expires on trusted_pairs(expires_at);

create table guide_feedback (
  id bigint generated always as identity primary key,
  combo text not null,
  step_index smallint not null,
  helpful boolean not null,
  device_os text,
  created_at timestamptz not null default now()
);
alter table guide_feedback enable row level security;
create policy gf_insert_anon on guide_feedback for insert to anon with check (true);
```

## 5. KPI 집계 쿼리 예시 (대시보드용)

```sql
-- 초보자 과업 성공: 평균 터치 수 & 위저드 이탈 단계 분포
select avg(tap_count) as avg_taps,
       wizard_abandon_step, count(*)
from connection_logs
where created_at > now() - interval '7 days'
group by wizard_abandon_step;

-- 오류 자가 해결률
select error_card_shown,
       avg(case when error_card_resolved then 1 else 0 end)::numeric(4,2) as self_resolve_rate
from connection_logs
where error_card_shown is not null
group by error_card_shown;

-- 가이드 개선 대상 (👎 30% 초과 단계)
select combo, step_index,
       avg(case when helpful then 0 else 1 end) as unhelpful_rate
from guide_feedback group by combo, step_index
having avg(case when helpful then 0 else 1 end) > 0.3;
```

## 6. 데이터 보존
| 데이터 | 보존 |
|---|---|
| rooms(closed) | 24h 후 삭제 (pg_cron) |
| connection_logs | 90일 → 월별 요약 롤업 |
| room_join_attempts | 7일 |
| guide_feedback | 1년 (제품 개선용) |
| trusted_pairs | 마지막 사용 +30일 (pg_cron 청소) |
