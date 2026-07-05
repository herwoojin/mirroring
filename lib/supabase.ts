'use client';

// 브라우저용 Supabase 클라이언트 (Realtime Broadcast 시그널링).
// 환경변수가 없으면 null → signaling.ts가 BroadcastChannel 데브 모드로 폴백.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}
