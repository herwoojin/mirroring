import { NextRequest, NextResponse } from 'next/server';
import { deletePair } from '@/lib/store';

export const runtime = 'nodejs';

// DELETE /api/pairs/{token} — ⭐v3 [기억 지우기]
export async function DELETE(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(params.token)) {
      return NextResponse.json({ error: 'bad_token' }, { status: 400 });
    }
    await deletePair(params.token);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error('DELETE /api/pairs', e);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
