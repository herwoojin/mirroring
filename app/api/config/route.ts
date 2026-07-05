import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/config — 안드로이드 앱이 배포 주소로 접속해 Firebase RTDB 설정을 받아온다.
// 공개 가능한 값만 노출 (NEXT_PUBLIC_* — Firebase 웹 config는 원래 클라이언트 공개용).
export async function GET() {
  return NextResponse.json({
    firebase: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? null,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? null,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? null,
    },
    hasFirebase: !!(
      process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL && process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    ),
  });
}
