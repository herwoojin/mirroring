'use client';

// AuthGate — 로그인해야 사용할 수 있게 감싸는 게이트.
// 첫 화면(home)과 뷰어(view)를 감싼다. Firebase 미설정(로컬 데브)이면 게이트 없이 통과.
import { ReactNode, useEffect, useState } from 'react';
import { authEnabled, watchAuth, signInWithGoogle, type User } from '@/lib/auth';
import { COPY } from '@/lib/copy.ko';

export default function AuthGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authEnabled()) {
      setLoading(false);
      return;
    }
    const unsub = watchAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  // 로컬 데브(Firebase 없음) 또는 로그인 완료 → 그대로 통과
  if (!authEnabled() || user) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-base flex items-center justify-center text-body text-muted">
        {COPY.status_idle}
      </div>
    );
  }

  async function handleLogin() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      // 팝업 취소는 오류로 취급하지 않음
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      setError('로그인이 안 됐어요. 다시 눌러주세요');
    }
  }

  // 로그인 화면 (첫 화면)
  return (
    <div className="min-h-[100dvh] bg-base text-primary flex flex-col items-center justify-center px-6 gap-8 safe-bottom">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="text-7xl" aria-hidden="true">📱↔️💻</div>
        <h1 className="text-title">{COPY.appName}</h1>
        <p className="text-body text-muted">{COPY.appTagline}</p>
      </div>

      <p className="text-body text-muted text-center max-w-xs">
        시작하려면 구글 계정으로 들어와 주세요.
      </p>

      <button
        type="button"
        onClick={handleLogin}
        aria-label="구글 계정으로 로그인"
        className="pressable w-full max-w-sm min-h-[88px] rounded-big bg-white text-[#1F1F1F] flex items-center justify-center gap-3 text-button font-semibold"
      >
        <svg width="28" height="28" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        구글로 시작하기
      </button>

      {error && (
        <p className="text-body text-error flex items-center gap-2">
          <span aria-hidden="true">⚠</span> {error}
        </p>
      )}

      <a href="/start" className="text-caption text-muted underline underline-offset-4 min-h-[48px] inline-flex items-center">
        ✨ 처음이신가요? 사용 방법 보기
      </a>
    </div>
  );
}
