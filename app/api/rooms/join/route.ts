import { NextRequest, NextResponse } from 'next/server';
import { activateRoom, checkRateLimit, findRoom, recordJoinAttempt, sha256 } from '@/lib/store';

export const runtime = 'nodejs';

// POST /api/rooms/join — 코드 검증 + ip_hash 5회/60초 제한 + entry_method 기록
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? '').trim();
    const entryMethod = ['qr', 'numpad', 'deeplink'].includes(body.entryMethod)
      ? body.entryMethod
      : null;

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'wrong_code' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    const ipHash = sha256(ip + (process.env.IP_SALT ?? 'mirroron'));

    if (!(await checkRateLimit(ipHash))) {
      return NextResponse.json({ error: 'too_many_tries' }, { status: 429 });
    }

    const room = await findRoom(code);
    const ok = !!room && room.expires_at > Date.now() && room.status !== 'closed';
    await recordJoinAttempt(ipHash, code, ok);

    if (!room) return NextResponse.json({ error: 'wrong_code' }, { status: 404 });
    if (!ok) return NextResponse.json({ error: 'room_expired' }, { status: 410 });

    await activateRoom(code);

    return NextResponse.json({
      roomId: room.id,
      code: room.code,
      // 시그널링 채널 참여 검증용 — 원본 토큰은 뷰어(룸 생성자)가 QR/코드로 전달.
      // join API는 해시 검증 가능한 형태로 채널 식별자만 재발급.
      channelTokenHash: room.channel_token_hash,
      entryMethod,
    });
  } catch (e) {
    console.error('POST /api/rooms/join', e);
    return NextResponse.json({ error: 'join_failed' }, { status: 500 });
  }
}
