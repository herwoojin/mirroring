import { NextRequest, NextResponse } from 'next/server';
import { createPair } from '@/lib/store';

export const runtime = 'nodejs';

// POST /api/pairs — ⭐v3 [기억하기] 시 기기 쌍 토큰 발급 (30일 TTL)
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const pair = await createPair({
      deviceAHint: String(b.deviceAHint ?? '내 기기').slice(0, 40),
      deviceBHint: String(b.deviceBHint ?? '상대 기기').slice(0, 40),
      lastRoleA: b.lastRoleA === 'viewer' ? 'viewer' : 'sender',
    });
    return NextResponse.json({ pairToken: pair.id, expiresAt: pair.expires_at });
  } catch (e) {
    console.error('POST /api/pairs', e);
    return NextResponse.json({ error: 'pair_failed' }, { status: 500 });
  }
}
