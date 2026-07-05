import { NextRequest, NextResponse } from 'next/server';
import { createRoom, findPair, touchPair } from '@/lib/store';

export const runtime = 'nodejs';

// POST /api/rooms/rejoin — ⭐v3 pair_token으로 새 룸 자동 생성 + 상대 초대
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const token = String(b.pairToken ?? '');

    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      return NextResponse.json({ error: 'bad_token' }, { status: 400 });
    }

    const pair = await findPair(token);
    if (!pair) {
      // 토큰 만료/삭제 → 조용히 강등 (오류처럼 보이지 않게)
      return NextResponse.json({ error: 'pair_expired', fallback: true }, { status: 404 });
    }

    await touchPair(token);
    const { room, channelToken } = await createRoom();

    return NextResponse.json({
      roomId: room.id,
      code: room.code,
      channelToken,
      pairChannel: `pair:${token}`,
      lastRoleA: pair.last_role_a,
      deviceAHint: pair.device_a_hint,
      deviceBHint: pair.device_b_hint,
      nickname: pair.nickname,
    });
  } catch (e) {
    console.error('POST /api/rooms/rejoin', e);
    return NextResponse.json({ error: 'rejoin_failed' }, { status: 500 });
  }
}
