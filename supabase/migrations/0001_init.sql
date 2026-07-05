-- 0001_init.sql — 미러온 v1 기본 테이블 (ERD 2절)
-- 원칙: 영상 미저장, 메타·로그만. SDP/ICE는 DB 미저장(Realtime Broadcast 전용).

create extension if not exists pgcrypto;

-- 2.1 rooms
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code char(6) unique not null,               -- 숫자 6자리 (초보자 입력 편의)
  channel_token text not null,                -- 해시 저장
  owner_id uuid references auth.users(id),
  status text not null default 'waiting' check (status in ('waiting','active','closed')),
  max_viewers smallint not null default 4,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  closed_at timestamptz
);
create index if not exists idx_rooms_code on rooms(code);
create index if not exists idx_rooms_expires on rooms(expires_at);

-- 2.2 sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  peer_id text not null,
  role text not null check (role in ('sender','viewer')),
  device_os text,
  device_type text,
  browser text,
  capture_capable boolean,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);
create index if not exists idx_sessions_room on sessions(room_id);

-- 2.3 connection_logs — KPI 산출
create table if not exists connection_logs (
  id bigint generated always as identity primary key,
  session_id uuid references sessions(id) on delete set null,
  room_id uuid references rooms(id) on delete set null,
  result text check (result in ('connected','failed','disconnected','reconnected')),
  connection_type text check (connection_type in ('host','srflx','relay')),
  ttff_ms integer,
  avg_rtt_ms integer,
  avg_fps integer,
  duration_sec integer,
  resolution text,
  network_pair text,
  fail_reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_logs_created on connection_logs(created_at);

-- 2.4 room_join_attempts — 무차별 대입 방지 (5회/60초)
create table if not exists room_join_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  code_tried text,
  success boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_attempts_ip on room_join_attempts(ip_hash, created_at);

-- RLS: 서비스 롤 전용 (API 경유). owner는 본인 룸·로그 SELECT.
alter table rooms enable row level security;
alter table sessions enable row level security;
alter table connection_logs enable row level security;
alter table room_join_attempts enable row level security;

create policy rooms_owner_select on rooms for select using (auth.uid() = owner_id);
create policy logs_owner_select on connection_logs for select using (
  exists (select 1 from rooms r where r.id = connection_logs.room_id and r.owner_id = auth.uid())
);

-- pg_cron 청소 잡 (Supabase 대시보드에서 pg_cron 확장 활성화 후 실행)
-- select cron.schedule('cleanup-rooms', '*/30 * * * *',
--   $$delete from rooms where status = 'closed' and closed_at < now() - interval '24 hours';
--     delete from rooms where expires_at < now() - interval '1 hour';
--     delete from room_join_attempts where created_at < now() - interval '7 days';$$);
