import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import os from 'os';

// 개발 모드: 이 머신에서 도는 로컬 coturn(3478)이 있으면 함께 내려준다.
// VPN·공유기 격리 등으로 같은 Wi-Fi P2P가 막혀도 PC 경유 릴레이로 연결 보장.
function devLocalTurn(): RTCIceServer[] {
  if (process.env.NODE_ENV === 'production') return [];
  const candidates: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) candidates.push(iface.address);
    }
  }
  candidates.sort((a, b) => {
    const score = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : 2);
    return score(a) - score(b);
  });
  const ip = candidates[0];
  if (!ip) return [];
  return [
    {
      urls: [`turn:${ip}:3478?transport=udp`, `turn:${ip}:3478?transport=tcp`],
      username: 'mirroron',
      credential: 'mirroron-dev-2026',
    },
  ];
}

// 공개 무료 TURN (metered openrelay) — 계정/키 없이 어느 네트워크든 릴레이 보장.
// 소규모·교육용에 충분. 대규모는 TURN_API_KEY로 전용 자격증명 사용 권장.
const OPENRELAY: RTCIceServer[] = [
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

// GET /api/turn-credentials — metered.ca 프록시 (단기 자격증명)
// TURN_API_KEY 미설정 시: STUN + 로컬 coturn(개발) + 공개 openrelay(프로덕션)
export async function GET(req: NextRequest) {
  const fallback = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      ...devLocalTurn(),
      ...OPENRELAY, // 공개 릴레이 — 로컬 coturn에 못 닿는 원격 사용자 커버
    ],
    relay: true,
  };

  const apiKey = process.env.TURN_API_KEY;
  const appName = process.env.TURN_APP_NAME ?? 'mirroron';
  if (!apiKey) return NextResponse.json(fallback);

  // 입장 토큰 필수 (룸에 참여한 클라이언트만 발급)
  const token = req.nextUrl.searchParams.get('token');
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'token_required' }, { status: 401 });
  }

  try {
    const res = await fetch(
      `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
      { cache: 'no-store' },
    );
    if (!res.ok) throw new Error(`metered ${res.status}`);
    const iceServers = await res.json();
    return NextResponse.json({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, ...iceServers],
      relay: true,
    });
  } catch (e) {
    console.error('turn-credentials', e);
    return NextResponse.json(fallback); // metered 실패 → 공개 릴레이로 강등 (서비스 계속)
  }
}
