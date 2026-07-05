import { NextRequest, NextResponse } from 'next/server';
import { getKpis, insertConnectionLog } from '@/lib/store';

export const runtime = 'nodejs';

const RESULTS = ['connected', 'failed', 'disconnected', 'reconnected'];
const CONN_TYPES = ['host', 'srflx', 'relay'];

// POST /api/logs/connection — v2 UX 지표 포함 연결 로그
export async function POST(req: NextRequest) {
  try {
    const b = await req.json().catch(() => ({}));
    const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

    await insertConnectionLog({
      room_id: typeof b.roomId === 'string' ? b.roomId : null,
      result: RESULTS.includes(b.result) ? b.result : null,
      connection_type: CONN_TYPES.includes(b.connectionType) ? b.connectionType : null,
      ttff_ms: int(b.ttffMs),
      avg_rtt_ms: int(b.avgRttMs),
      avg_fps: int(b.avgFps),
      duration_sec: int(b.durationSec),
      resolution: typeof b.resolution === 'string' ? b.resolution.slice(0, 20) : null,
      network_pair: typeof b.networkPair === 'string' ? b.networkPair.slice(0, 40) : null,
      fail_reason: typeof b.failReason === 'string' ? b.failReason.slice(0, 40) : null,
      // ⭐v2 초보자 UX 지표
      tap_count: int(b.tapCount),
      time_to_connect_ms: int(b.timeToConnectMs),
      error_card_shown: typeof b.errorCardShown === 'string' ? b.errorCardShown.slice(0, 40) : null,
      error_card_resolved: typeof b.errorCardResolved === 'boolean' ? b.errorCardResolved : null,
      wizard_abandon_step: int(b.wizardAbandonStep),
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error('POST /api/logs/connection', e);
    return new NextResponse(null, { status: 204 }); // 로그 실패가 UX를 막지 않음
  }
}

// GET — /admin KPI 대시보드용 집계 (ERD 5절)
export async function GET() {
  try {
    return NextResponse.json(await getKpis());
  } catch (e) {
    console.error('GET /api/logs/connection', e);
    return NextResponse.json({ error: 'kpi_failed' }, { status: 500 });
  }
}
