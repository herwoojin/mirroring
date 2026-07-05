'use client';

// 구글 로그인 (Firebase Auth)
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { getAuthClient, hasFirebase } from './firebase';

export type { User };

// 로그인 게이트를 적용할지 (Firebase 없으면 로컬 데브라 게이트 생략)
export function authEnabled(): boolean {
  return hasFirebase();
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  const auth = getAuthClient();
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(): Promise<void> {
  const auth = getAuthClient();
  if (!auth) return;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}

export async function signOutUser(): Promise<void> {
  const auth = getAuthClient();
  if (auth) await signOut(auth);
}
