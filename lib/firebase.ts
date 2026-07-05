'use client';

// Firebase Realtime Database — 시그널링 + 룸 저장 (Netlify 서버리스 배포 대응)
// 환경변수가 없으면 null → signaling/room이 인메모리 데브 모드로 폴백(로컬 개발 유지).
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { getAuth, type Auth } from 'firebase/auth';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let db: Database | null | undefined;
let auth: Auth | null | undefined;

export function hasFirebase(): boolean {
  return !!config.databaseURL && !!config.apiKey;
}

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

export function getDb(): Database | null {
  if (db !== undefined) return db;
  db = hasFirebase() ? getDatabase(app()) : null;
  return db;
}

export function getAuthClient(): Auth | null {
  if (auth !== undefined) return auth;
  auth = hasFirebase() ? getAuth(app()) : null;
  return auth;
}
