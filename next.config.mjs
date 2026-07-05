/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

// CSP: 자체 자산 + Firebase(Auth·RTDB)·구글 로그인·TURN 허용.
const csp = [
  "default-src 'self'",
  // Firebase Auth 로그인 스크립트(apis.google.com/gstatic)
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://apis.google.com https://www.gstatic.com https://*.firebaseapp.com`,
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  // 구글 프로필 사진
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "media-src 'self' blob:",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  // Firebase RTDB(wss)·Auth 토큰(identitytoolkit/securetoken)·구글 API·TURN
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app https://apis.google.com https://*.metered.ca https://cdn.jsdelivr.net wss:",
  // 로그인 팝업/iframe: 인증 도메인 + 구글 계정
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self), picture-in-picture=(self), screen-wake-lock=(self)' },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
};

export default nextConfig;
