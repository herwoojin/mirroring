// signaling.ts — Supabase Realtime Broadcast 시그널링 + HTTP 폴링 데브 폴백
// 프로토콜: join/offer/answer/ice/role-swap/leave (TRD 4.3)
//
// 데브 폴백 설계 원칙 (실기기 크로스 디바이스 대응):
//  - 자기 메시지는 절대 되돌려받지 않는다 (sid 필터 — WebRTC 협상이 꼬이는 주원인)
//  - 구독 시점 이후의 메시지만 받는다 (이전 시도의 offer/leave 재생 금지)
//  - 메시지는 도착 순서대로 "순차" 전달한다 (offer 적용 전 ICE 추가 방지)

import { getSupabase } from './supabase';
import { getDb, hasFirebase } from './firebase';
import {
  ref,
  push,
  onChildAdded,
  serverTimestamp,
  get,
  query,
  orderByKey,
  startAfter,
  limitToLast,
} from 'firebase/database';

export type SignalType = 'join' | 'offer' | 'answer' | 'ice' | 'role-swap' | 'leave' | 'pair-invite';

export interface SignalMessage {
  type: SignalType;
  from: string; // peerId
  to?: string; // 대상 peer (없으면 브로드캐스트)
  payload: Record<string, unknown>;
}

type Handler = (msg: SignalMessage) => void | Promise<void>;

export interface SignalingChannel {
  send(msg: SignalMessage): void;
  onMessage(handler: Handler): void;
  close(): void;
  readonly channelName: string;
}

// ── Supabase Realtime 채널 ──────────────────────────
function createRealtimeChannel(channelName: string): SignalingChannel {
  const sb = getSupabase()!;
  const channel = sb.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  let handler: Handler | null = null;
  let ready = false;
  let closed = false;
  const outbox: SignalMessage[] = []; // SUBSCRIBED 전 전송분 유실 방지 큐

  const push = (msg: SignalMessage) =>
    channel.send({ type: 'broadcast', event: 'signal', payload: msg });

  channel
    .on('broadcast', { event: 'signal' }, ({ payload }) => {
      if (payload && handler) void handler(payload as SignalMessage);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' && !closed) {
        ready = true;
        for (const msg of outbox.splice(0)) void push(msg);
      }
    });

  return {
    channelName,
    send(msg) {
      if (!ready) {
        outbox.push(msg);
        return;
      }
      void push(msg);
    },
    onMessage(h) {
      handler = h;
    },
    close() {
      closed = true;
      handler = null;
      sb.removeChannel(channel);
    },
  };
}

// ── HTTP 폴링 데브 폴백 (Supabase 없이 같은 Wi-Fi 실기기 테스트) ──
function createDevChannel(channelName: string): SignalingChannel {
  // 채널 인스턴스 고유 id — 서버가 자기 메시지를 걸러줄 때 사용
  const sid = Math.random().toString(36).slice(2, 12);
  let handler: Handler | null = null;
  let sinceIdx: number | null = null; // null = 아직 구독 시점 미확정
  let closed = false;
  let polling = false;
  let dispatching = Promise.resolve(); // 순차 전달 체인

  const base = `/api/dev-signaling?channel=${encodeURIComponent(channelName)}&sid=${sid}`;

  async function poll() {
    if (closed || polling) return;
    polling = true;
    try {
      if (sinceIdx === null) {
        // 구독 시점 확정: 현재 큐 끝 이후만 받는다 (히스토리 재생 금지)
        const res = await fetch(`${base}&init=1`, { cache: 'no-store' });
        if (res.ok) sinceIdx = (await res.json()).newIdx ?? 0;
        return;
      }
      const res = await fetch(`${base}&since=${sinceIdx}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.newIdx === 'number') sinceIdx = data.newIdx;
      const messages: SignalMessage[] = data.messages ?? [];
      for (const m of messages) {
        // 도착 순서 보장 — 이전 메시지 처리(await)가 끝난 뒤 다음 전달
        dispatching = dispatching.then(() => (handler ? handler(m) : undefined)).catch(() => {});
      }
    } catch {
      // 네트워크 순단은 다음 폴링에서 회복
    } finally {
      polling = false;
    }
  }

  const timer = setInterval(poll, 500);
  void poll();

  return {
    channelName,
    send(msg) {
      fetch('/api/dev-signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: channelName, sid, msg }),
      }).catch(() => {});
    },
    onMessage(h) {
      handler = h;
    },
    close() {
      closed = true;
      handler = null;
      clearInterval(timer);
    },
  };
}

// ── Firebase Realtime Database 채널 (프로덕션 — Netlify 배포용) ──
// 경로: signals/{channelName}/{pushId} = { sid, at, ...SignalMessage }
// 자기 메시지는 sid로 필터, 구독 시점 이후(at >= now)만 수신.
function createFirebaseChannel(channelName: string): SignalingChannel {
  const db = getDb()!;
  const sid = Math.random().toString(36).slice(2, 12);
  const safeName = channelName.replace(/[.#$/[\]]/g, '_');
  const listRef = ref(db, `signals/${safeName}`);
  let handler: Handler | null = null;
  let unsub: (() => void) | null = null;
  let closed = false;

  // "구독 시점 이후 새 메시지만" — push키가 시간순이라 마지막 기존 키 이후만 수신.
  // (시계 오차와 무관하고, 재사용 채널(pair)의 과거 초대 재생도 막음)
  const emit = (snap: any) => {
    const v = snap.val();
    if (!v || v.sid === sid) return; // 자기 메시지 무시
    if (handler) void handler({ type: v.type, from: v.from, to: v.to, payload: v.payload ?? {} });
  };

  get(query(listRef, limitToLast(1)))
    .then((snap) => {
      if (closed) return;
      let lastKey: string | null = null;
      snap.forEach((c) => {
        lastKey = c.key;
      });
      const q = lastKey ? query(listRef, orderByKey(), startAfter(lastKey)) : listRef;
      unsub = onChildAdded(q, emit);
    })
    .catch(() => {
      if (!closed) unsub = onChildAdded(listRef, emit);
    });

  return {
    channelName,
    send(msg) {
      push(listRef, {
        sid,
        at: serverTimestamp(),
        type: msg.type,
        from: msg.from,
        ...(msg.to ? { to: msg.to } : {}),
        payload: msg.payload ?? {},
      }).catch(() => {});
    },
    onMessage(h) {
      handler = h;
    },
    close() {
      closed = true;
      handler = null;
      unsub?.();
    },
  };
}

// ── 팩토리: Firebase > Supabase > HTTP 폴링(로컬 데브) ──
export function openSignalingChannel(channelName: string): SignalingChannel {
  if (hasFirebase()) return createFirebaseChannel(channelName);
  const sb = getSupabase();
  if (sb) return createRealtimeChannel(channelName);
  console.info('[signaling] Firebase/Supabase 없음 → HTTP 폴링 데브 모드');
  return createDevChannel(channelName);
}

// 룸 채널명 규칙
export function roomChannelName(code: string): string {
  return `room:${code}`;
}

export function pairChannelName(token: string): string {
  return `pair:${token}`;
}
