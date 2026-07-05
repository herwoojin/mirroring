import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '미러온 — 화면 미러링',
  description: '설치 없이 브라우저만으로 휴대폰 ↔ PC 화면을 양방향 미러링하세요. 초보자도 3번의 터치로 연결할 수 있어요.',
  manifest: '/manifest.json',
  icons: [
    { rel: 'icon', url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { rel: 'apple-touch-icon', url: '/icons/icon-512.png' },
  ],
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B1220',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-font-scale="base" suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/subsets/Paperlogy-dynamic-subset.css"
        />
      </head>
      <body className="bg-base text-primary min-h-[100dvh]">
        {children}
      </body>
    </html>
  );
}
