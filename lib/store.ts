// 서버 측 데이터 계층.
// Supabase 환경변수가 있으면 Supabase를, 없으면 인메모리 스토어(개발 모드)를 사용한다.
// → 자격증명 없이도 `npm run dev`만으로 전체 플로우가 동작하게 하기 위한 설계.
import { createHash, randomBytes, randomUUID } from 'crypto';
import { getAdminClient, hasSupabase } from './supabase-admin';

export interface Room {
  id: string;
  code: string;
  channel_token_hash: string;
  status: 'waiting' | 'active' | 'closed';
  max_viewers: number;
  created_at: number;
  expires_at: number;
}

export interface TrustedPair {
  id: string; // pair_token
  device_a_hint: string | null;
  device_b_hint: string | null;
  nickname: string | null;
  last_role_a: 'sender' | 'viewer' | null;
  created_at: number;
  last_used_at: number;
  expires_at: number;
}

interface MemDB {
  rooms: Map<string, Room>; // key: code
  pairs: Map<string, TrustedPair>; // key: pair_token
  joinAttempts: Map<string, number[]>; // ip_hash -> timestamps
  connectionLogs: Record<string, unknown>[];
  guideFeedback: Record<string, unknown>[];
  signals: Map<string, any[]>; // channelName -> SignalMessage[]
  appCrashes: Record<string, unknown>[]; // 컴패니언 앱 크래시 리포트 (개발용)
}

const g = globalThis as unknown as { __mirroronDB?: MemDB };
export function mem(): MemDB {
  if (!g.__mirroronDB) {
    g.__mirroronDB = {
      rooms: new Map(),
      pairs: new Map(),
      joinAttempts: new Map(),
      connectionLogs: [],
      guideFeedback: [],
      signals: new Map(),
      appCrashes: [],
    };
  }
  return g.__mirroronDB;
}

export const ROOM_TTL_MS = 10 * 60 * 1000; // TTL 10분
const PAIR_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

export function sha256(v: string): string {
  return createHash('sha256').update(v).digest('hex');
}

function genCode(): string {
  // 숫자 6자리 crypto 생성 (초보자 입력 편의로 숫자만)
  const n = randomBytes(4).readUInt32BE(0) % 1000000;
  return n.toString().padStart(6, '0');
}

// ── 룸 ──────────────────────────────────────────────
export async function createRoom(): Promise<{ room: Room; channelToken: string }> {
  const channelToken = randomBytes(24).toString('hex');
  const room: Room = {
    id: randomUUID(),
    code: genCode(),
    channel_token_hash: sha256(channelToken),
    status: 'waiting',
    max_viewers: 4,
    created_at: Date.now(),
    expires_at: Date.now() + ROOM_TTL_MS,
  };

  if (hasSupabase()) {
    const db = getAdminClient();
    // 코드 충돌 시 1회 재시도
    for (let i = 0; i < 3; i++) {
      const { error } = await db.from('rooms').insert({
        id: room.id,
        code: room.code,
        channel_token: room.channel_token_hash,
        status: room.status,
        max_viewers: room.max_viewers,
        expires_at: new Date(room.expires_at).toISOString(),
      });
      if (!error) break;
      room.code = genCode();
    }
  } else {
    // 인메모리: 만료 룸 청소 후 저장
    const db = mem();
    for (const [code, r] of db.rooms) if (r.expires_at < Date.now()) db.rooms.delete(code);
    while (db.rooms.has(room.code)) room.code = genCode();
    db.rooms.set(room.code, room);
  }
  return { room, channelToken };
}

export async function findRoom(code: string): Promise<Room | null> {
  if (hasSupabase()) {
    const db = getAdminClient();
    const { data } = await db.from('rooms').select('*').eq('code', code).maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      code: data.code,
      channel_token_hash: data.channel_token,
      status: data.status,
      max_viewers: data.max_viewers,
      created_at: new Date(data.created_at).getTime(),
      expires_at: new Date(data.expires_at).getTime(),
    };
  }
  return mem().rooms.get(code) ?? null;
}

export async function activateRoom(code: string): Promise<void> {
  if (hasSupabase()) {
    await getAdminClient()
      .from('rooms')
      .update({ status: 'active', expires_at: new Date(Date.now() + 4 * 3600e3).toISOString() })
      .eq('code', code);
  } else {
    const r = mem().rooms.get(code);
    if (r) {
      r.status = 'active';
      r.expires_at = Date.now() + 4 * 3600e3; // active 시 +4h
    }
  }
}

// ── 무차별 대입 방지: 5회/60초 ───────────────────────
export async function checkRateLimit(ipHash: string): Promise<boolean> {
  const now = Date.now();
  if (hasSupabase()) {
    const db = getAdminClient();
    const { count } = await db
      .from('room_join_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', new Date(now - 60_000).toISOString());
    return (count ?? 0) < 5;
  }
  const db = mem();
  const list = (db.joinAttempts.get(ipHash) ?? []).filter((t) => now - t < 60_000);
  db.joinAttempts.set(ipHash, list);
  return list.length < 5;
}

export async function recordJoinAttempt(ipHash: string, code: string, success: boolean) {
  if (hasSupabase()) {
    await getAdminClient()
      .from('room_join_attempts')
      .insert({ ip_hash: ipHash, code_tried: code, success });
  } else {
    const db = mem();
    const list = db.joinAttempts.get(ipHash) ?? [];
    list.push(Date.now());
    db.joinAttempts.set(ipHash, list);
  }
}

// ── trusted_pairs (v3 원탭 재연결) ────────────────────
export async function createPair(input: {
  deviceAHint: string;
  deviceBHint: string;
  lastRoleA: 'sender' | 'viewer';
}): Promise<TrustedPair> {
  const pair: TrustedPair = {
    id: randomUUID(),
    device_a_hint: input.deviceAHint,
    device_b_hint: input.deviceBHint,
    nickname: null,
    last_role_a: input.lastRoleA,
    created_at: Date.now(),
    last_used_at: Date.now(),
    expires_at: Date.now() + PAIR_TTL_MS,
  };
  if (hasSupabase()) {
    await getAdminClient().from('trusted_pairs').insert({
      id: pair.id,
      device_a_hint: pair.device_a_hint,
      device_b_hint: pair.device_b_hint,
      last_role_a: pair.last_role_a,
    });
  } else {
    mem().pairs.set(pair.id, pair);
  }
  return pair;
}

export async function findPair(token: string): Promise<TrustedPair | null> {
  if (hasSupabase()) {
    const { data } = await getAdminClient()
      .from('trusted_pairs')
      .select('*')
      .eq('id', token)
      .maybeSingle();
    if (!data) return null;
    const p: TrustedPair = {
      id: data.id,
      device_a_hint: data.device_a_hint,
      device_b_hint: data.device_b_hint,
      nickname: data.nickname,
      last_role_a: data.last_role_a,
      created_at: new Date(data.created_at).getTime(),
      last_used_at: new Date(data.last_used_at).getTime(),
      expires_at: new Date(data.expires_at).getTime(),
    };
    return p.expires_at < Date.now() ? null : p;
  }
  const p = mem().pairs.get(token);
  return p && p.expires_at > Date.now() ? p : null;
}

export async function touchPair(token: string): Promise<void> {
  if (hasSupabase()) {
    await getAdminClient()
      .from('trusted_pairs')
      .update({
        last_used_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + PAIR_TTL_MS).toISOString(),
      })
      .eq('id', token);
  } else {
    const p = mem().pairs.get(token);
    if (p) {
      p.last_used_at = Date.now();
      p.expires_at = Date.now() + PAIR_TTL_MS;
    }
  }
}

export async function deletePair(token: string): Promise<void> {
  if (hasSupabase()) {
    await getAdminClient().from('trusted_pairs').delete().eq('id', token);
  } else {
    mem().pairs.delete(token);
  }
}

// ── 로그 ─────────────────────────────────────────────
export async function insertConnectionLog(row: Record<string, unknown>): Promise<void> {
  if (hasSupabase()) {
    await getAdminClient().from('connection_logs').insert(row);
  } else {
    const db = mem();
    db.connectionLogs.push({ ...row, created_at: Date.now() });
    if (db.connectionLogs.length > 2000) db.connectionLogs.shift();
  }
}

export async function insertGuideFeedback(row: Record<string, unknown>): Promise<void> {
  if (hasSupabase()) {
    await getAdminClient().from('guide_feedback').insert(row);
  } else {
    mem().guideFeedback.push({ ...row, created_at: Date.now() });
  }
}

// ── KPI 집계 (ERD 5절 — /admin 대시보드용) ─────────────
export async function getKpis() {
  if (hasSupabase()) {
    const db = getAdminClient();
    const since = new Date(Date.now() - 7 * 86400e3).toISOString();
    const { data: logs } = await db
      .from('connection_logs')
      .select('tap_count, time_to_connect_ms, error_card_shown, error_card_resolved, wizard_abandon_step, result')
      .gte('created_at', since)
      .limit(5000);
    const { data: fb } = await db.from('guide_feedback').select('combo, step_index, helpful').limit(5000);
    return aggregate(logs ?? [], fb ?? []);
  }
  const db = mem();
  return aggregate(db.connectionLogs, db.guideFeedback);
}

function aggregate(logs: any[], fb: any[]) {
  const taps = logs.map((l) => l.tap_count).filter((v) => typeof v === 'number');
  const ttcs = logs.map((l) => l.time_to_connect_ms).filter((v) => typeof v === 'number');
  const connected = logs.filter((l) => l.result === 'connected').length;
  const failed = logs.filter((l) => l.result === 'failed').length;

  const errorCards: Record<string, { shown: number; resolved: number }> = {};
  for (const l of logs) {
    if (!l.error_card_shown) continue;
    errorCards[l.error_card_shown] ??= { shown: 0, resolved: 0 };
    errorCards[l.error_card_shown].shown++;
    if (l.error_card_resolved) errorCards[l.error_card_shown].resolved++;
  }

  const abandon: Record<string, number> = {};
  for (const l of logs) {
    if (l.wizard_abandon_step != null) {
      abandon[String(l.wizard_abandon_step)] = (abandon[String(l.wizard_abandon_step)] ?? 0) + 1;
    }
  }

  const guide: Record<string, { up: number; down: number }> = {};
  for (const f of fb) {
    const key = `${f.combo}#${f.step_index}`;
    guide[key] ??= { up: 0, down: 0 };
    if (f.helpful) guide[key].up++;
    else guide[key].down++;
  }

  return {
    totalLogs: logs.length,
    avgTapCount: taps.length ? +(taps.reduce((a, b) => a + b, 0) / taps.length).toFixed(1) : null,
    avgTimeToConnectMs: ttcs.length ? Math.round(ttcs.reduce((a, b) => a + b, 0) / ttcs.length) : null,
    successRate: connected + failed ? +(connected / (connected + failed)).toFixed(2) : null,
    errorCards,
    wizardAbandon: abandon,
    guideFeedback: guide,
  };
}
