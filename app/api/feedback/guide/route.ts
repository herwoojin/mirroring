import { NextRequest, NextResponse } from 'next/server';
import { insertGuideFeedback } from '@/lib/store';

export const runtime = 'nodejs';

const COMBOS = ['mac-galaxy', 'mac-iphone', 'win-galaxy', 'win-iphone'];

// POST /api/feedback/guide — 가이드 단계별 👍👎 (익명, 개인정보 없음)
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    if (!COMBOS.includes(b.combo) || typeof b.helpful !== 'boolean') {
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    await insertGuideFeedback({
      combo: b.combo,
      step_index: Number.isInteger(b.stepIndex) ? b.stepIndex : 0,
      helpful: b.helpful,
      device_os: typeof b.deviceOs === 'string' ? b.deviceOs.slice(0, 20) : null,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error('POST /api/feedback/guide', e);
    return new NextResponse(null, { status: 204 });
  }
}
