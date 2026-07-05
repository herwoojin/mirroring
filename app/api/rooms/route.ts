import { NextResponse } from 'next/server';
import { createRoom } from '@/lib/store';

export const runtime = 'nodejs';

// POST /api/rooms — 룸 생성 (6자리 숫자 코드 + 채널 토큰, TTL 10분)
export async function POST() {
  try {
    const { room, channelToken } = await createRoom();
    return NextResponse.json({
      roomId: room.id,
      code: room.code,
      channelToken, // 원본은 여기서만 1회 전달 (DB에는 해시)
      expiresAt: room.expires_at,
    });
  } catch (e) {
    console.error('POST /api/rooms', e);
    return NextResponse.json({ error: 'room_create_failed' }, { status: 500 });
  }
}
