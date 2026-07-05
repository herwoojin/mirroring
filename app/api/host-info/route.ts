import { NextRequest, NextResponse } from 'next/server';
import os from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/host-info — 개발서버의 LAN 접속 주소.
// PC가 localhost로 열려 있어도 QR에는 폰이 접속 가능한 Wi-Fi IP를 담기 위해 사용.
export async function GET(req: NextRequest) {
  try {
    const candidates: string[] = [];
    for (const list of Object.values(os.networkInterfaces())) {
      for (const iface of list ?? []) {
        if (iface.family === 'IPv4' && !iface.internal) candidates.push(iface.address);
      }
    }
    // 일반 공유기 대역(192.168.x) 우선, VPN(utun 등) 대역은 후순위
    candidates.sort((a, b) => {
      const score = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
      return score(a) - score(b);
    });

    const ip = candidates[0] ?? null;
    const host = req.headers.get('host') ?? 'localhost:3000';
    const port = host.includes(':') ? host.split(':')[1] : '443';
    const proto = req.nextUrl.protocol || 'https:';

    return NextResponse.json({
      lanOrigin: ip ? `${proto}//${ip}:${port}` : null,
    });
  } catch {
    return NextResponse.json({ lanOrigin: null });
  }
}
