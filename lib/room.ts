'use client';

// 클라이언트 룸 생성/조인 추상화.
// Firebase 있으면 RTDB에 직접(서버리스/Netlify 대응), 없으면 기존 API 라우트(로컬 데브).
import { getDb, hasFirebase } from './firebase';
import { ref, get, set, serverTimestamp } from 'firebase/database';

export interface CreatedRoom {
  code: string;
  channelToken: string;
  expiresAt: number;
}

const ROOM_TTL_MS = 10 * 60 * 1000;

function genCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, '0');
}

function genToken(): string {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── 룸 생성 (뷰어/PC) ────────────────────────────────
export async function createRoom(): Promise<CreatedRoom> {
  if (hasFirebase()) {
    const db = getDb()!;
    let code = genCode();
    // 충돌 회피 (최대 5회)
    for (let i = 0; i < 5; i++) {
      const snap = await get(ref(db, `rooms/${code}/meta`));
      if (!snap.exists()) break;
      code = genCode();
    }
    const channelToken = genToken();
    const expiresAt = Date.now() + ROOM_TTL_MS;
    await set(ref(db, `rooms/${code}/meta`), {
      channelTokenHash: channelToken.slice(0, 12), // 참고용(공개 TURN이라 게이팅 최소)
      createdAt: serverTimestamp(),
      expiresAt,
      status: 'waiting',
    });
    return { code, channelToken, expiresAt };
  }

  // 로컬 데브: 서버 API
  const res = await fetch('/api/rooms', { method: 'POST' });
  const data = await res.json();
  return { code: data.code, channelToken: data.channelToken, expiresAt: data.expiresAt };
}

// ── 룸 조인 (송출/폰) ────────────────────────────────
export type JoinResult =
  | { ok: true }
  | { ok: false; reason: 'wrong-code' | 'room-expired' | 'timeout' };

export async function joinRoom(code: string, entryMethod: 'qr' | 'numpad' | 'deeplink'): Promise<JoinResult> {
  if (!/^\d{6}$/.test(code)) return { ok: false, reason: 'wrong-code' };

  if (hasFirebase()) {
    try {
      const db = getDb()!;
      const snap = await get(ref(db, `rooms/${code}/meta`));
      if (!snap.exists()) return { ok: false, reason: 'wrong-code' };
      const meta = snap.val();
      if (typeof meta.expiresAt === 'number' && meta.expiresAt < Date.now()) {
        return { ok: false, reason: 'room-expired' };
      }
      // active 표시 (+4h 연장)
      await set(ref(db, `rooms/${code}/meta/status`), 'active');
      await set(ref(db, `rooms/${code}/meta/expiresAt`), Date.now() + 4 * 3600e3);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'timeout' };
    }
  }

  // 로컬 데브: 서버 API
  try {
    const res = await fetch('/api/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, entryMethod }),
    });
    const data = await res.json();
    if (res.ok) return { ok: true };
    if (data.error === 'wrong_code') return { ok: false, reason: 'wrong-code' };
    if (data.error === 'room_expired') return { ok: false, reason: 'room-expired' };
    return { ok: false, reason: 'timeout' };
  } catch {
    return { ok: false, reason: 'timeout' };
  }
}
