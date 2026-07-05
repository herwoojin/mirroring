import { NextRequest, NextResponse } from 'next/server';
import { mem } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 데브 시그널링 (Supabase 미설정 시 폴백) — 인메모리 큐 + 폴링
// 큐 엔트리: { sid, msg } — sid는 보낸 채널 인스턴스 id (자기 메시지 필터용)

interface Entry {
  sid: string;
  msg: unknown;
  at: number;
}

const MAX_QUEUE = 300;
const ENTRY_TTL_MS = 10 * 60 * 1000;

function queueOf(channel: string): Entry[] {
  const db = mem();
  let list = db.signals.get(channel) as Entry[] | undefined;
  if (!list) {
    list = [];
    db.signals.set(channel, list);
  }
  return list;
}

// POST — 메시지 발행
export async function POST(req: NextRequest) {
  try {
    const { channel, sid, msg } = await req.json();
    if (typeof channel !== 'string' || typeof sid !== 'string' || !msg) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }
    const list = queueOf(channel);
    list.push({ sid, msg, at: Date.now() });
    // 큐 폭주 방지: 오래된 항목은 버리되 인덱스가 당겨지지 않게 자리 표시로 비움
    if (list.length > MAX_QUEUE) {
      const cut = list.length - MAX_QUEUE;
      for (let i = 0; i < cut; i++) list[i] = { sid: '', msg: null, at: 0 };
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'error' }, { status: 500 });
  }
}

// GET — 폴링
//   ?channel=&sid=&init=1        → 현재 큐 끝 인덱스만 반환 (구독 시점 확정)
//   ?channel=&sid=&since=<idx>   → idx 이후 + 다른 sid가 보낸 메시지만 반환
export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get('channel');
  const sid = req.nextUrl.searchParams.get('sid') ?? '';
  if (!channel) return NextResponse.json({ messages: [], newIdx: 0 });

  const list = queueOf(channel);

  if (req.nextUrl.searchParams.get('init') === '1') {
    return NextResponse.json({ messages: [], newIdx: list.length });
  }

  const since = Math.max(0, parseInt(req.nextUrl.searchParams.get('since') ?? '0', 10) || 0);
  const now = Date.now();
  const messages = list
    .slice(since)
    .filter((e) => e.msg && e.sid !== sid && now - e.at < ENTRY_TTL_MS)
    .map((e) => e.msg);

  return NextResponse.json({ messages, newIdx: list.length });
}
