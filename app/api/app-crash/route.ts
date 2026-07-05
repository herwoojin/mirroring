import { NextRequest, NextResponse } from 'next/server';
import { mem } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 컴패니언 앱 크래시/오류 리포트 수신 (개발용 진단)
// POST {tag, stack, model, sdk} → 저장 + 서버 콘솔 출력
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const entry = {
      tag: String(b.tag ?? 'crash').slice(0, 60),
      stack: String(b.stack ?? '').slice(0, 8000),
      model: String(b.model ?? '').slice(0, 60),
      sdk: b.sdk ?? null,
      at: new Date().toISOString(),
    };
    const db = mem();
    db.appCrashes.push(entry);
    if (db.appCrashes.length > 50) db.appCrashes.shift();
    console.error(`\n===== [APP CRASH] ${entry.tag} (${entry.model}, SDK ${entry.sdk}) =====\n${entry.stack}\n=====`);
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}

// GET — 최근 리포트 조회 (개발 편의)
export async function GET() {
  return NextResponse.json({ crashes: mem().appCrashes.slice(-10) });
}
