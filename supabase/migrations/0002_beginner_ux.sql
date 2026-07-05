-- 0002_beginner_ux.sql — v2/v3 확장 (ERD 4절)
-- ① sessions/connection_logs 초보자 UX 지표 ② user_preferences ③ trusted_pairs ④ guide_feedback

alter table sessions
  add column if not exists font_scale_used text check (font_scale_used in ('base','large')),
  add column if not exists entry_method text check (entry_method in ('qr','numpad','deeplink'));

alter table connection_logs
  add column if not exists tap_count smallint,             -- 첫 화면→연결 완료 터치 수 (KPI ≤4)
  add column if not exists time_to_connect_ms integer,     -- 첫 화면 진입→첫 프레임
  add column if not exists error_card_shown text,          -- 표시된 ErrorHelpCard 종류
  add column if not exists error_card_resolved boolean,    -- 자가 해결률 KPI
  add column if not exists wizard_abandon_step smallint;   -- 이탈 단계 (1~3, NULL=완료)

-- user_preferences (접근성 설정)
create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id),
  font_scale text not null default 'base' check (font_scale in ('base','large')),
  reduce_motion boolean not null default false,
  voice_guide boolean not null default false,
  default_role text check (default_role in ('sender','viewer')),
  edu_mode_frame text,
  edu_mode_bg text,
  stats_overlay boolean default false,
  updated_at timestamptz not null default now()
);
alter table user_preferences enable row level security;
create policy prefs_own on user_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- trusted_pairs ⭐v3 — [다시 연결] 원탭 재연결
-- 정책: 익명 기기 식별자 미저장 (토큰 소지 = 권한). 서버는 만료 청소만.
create table if not exists trusted_pairs (
  id uuid primary key default gen_random_uuid(),
  device_a_hint text,
  device_b_hint text,
  nickname text,
  last_role_a text check (last_role_a in ('sender','viewer')),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists idx_pairs_expires on trusted_pairs(expires_at);
alter table trusted_pairs enable row level security; -- 서비스 롤 전용 (rejoin API 경유)

-- guide_feedback ⭐v2 — 가이드 개선 루프 (익명, 개인정보 없음)
create table if not exists guide_feedback (
  id bigint generated always as identity primary key,
  combo text not null,
  step_index smallint not null,
  helpful boolean not null,
  device_os text,
  created_at timestamptz not null default now()
);
alter table guide_feedback enable row level security;
create policy gf_insert_anon on guide_feedback for insert to anon with check (true);

-- pg_cron: trusted_pairs 만료 청소
-- select cron.schedule('cleanup-pairs', '0 4 * * *',
--   $$delete from trusted_pairs where expires_at < now();$$);
