import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// GET /api/server-health — 서버 용량 상태 (배터리 인디케이터용)
export async function GET() {
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const usagePercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

  let status: 'ok' | 'warn' | 'danger' | 'critical' = 'ok';
  if (usagePercent >= 95) status = 'critical';
  else if (usagePercent >= 85) status = 'danger';
  else if (usagePercent >= 70) status = 'warn';

  return NextResponse.json({
    status,
    usagePercent,
    heapUsedMB,
    heapTotalMB,
    uptime: Math.round(process.uptime()),
  });
}
