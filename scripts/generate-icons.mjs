// scripts/generate-icons.mjs — SVG 아이콘 → sharp로 PNG 8종 생성
// 실행: npm run icons

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import sharp from 'sharp';

const ICON_DIR = './public/icons';
if (!existsSync(ICON_DIR)) mkdirSync(ICON_DIR, { recursive: true });

// 시안 그라데이션에 두 화면이 마주보는 미니멀 심볼
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="80" fill="#0B1220"/>
  <rect x="100" y="120" width="140" height="220" rx="16" fill="url(#g)" opacity="0.9"/>
  <rect x="272" y="170" width="140" height="220" rx="16" fill="url(#g)" opacity="0.6"/>
  <path d="M220 230 L292 280" stroke="#F4F7FB" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
  <path d="M220 250 L292 260" stroke="#F4F7FB" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
</svg>
`;

// maskable 버전 (안전 영역 내 축소)
const svgMaskable = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0B1220"/>
  <g transform="translate(76.8, 76.8) scale(0.7)">
    <defs>
      <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#06b6d4"/>
        <stop offset="100%" stop-color="#22d3ee"/>
      </linearGradient>
    </defs>
    <rect x="100" y="120" width="140" height="220" rx="16" fill="url(#g2)" opacity="0.9"/>
    <rect x="272" y="170" width="140" height="220" rx="16" fill="url(#g2)" opacity="0.6"/>
    <path d="M220 230 L292 280" stroke="#F4F7FB" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
    <path d="M220 250 L292 260" stroke="#F4F7FB" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
  </g>
</svg>
`;

const sizes = [48, 72, 96, 128, 192, 384, 512];

async function generate() {
  const iconBuf = Buffer.from(svgIcon);
  const maskBuf = Buffer.from(svgMaskable);

  for (const size of sizes) {
    await sharp(iconBuf).resize(size, size).png().toFile(`${ICON_DIR}/icon-${size}.png`);
    console.log(`✅ icon-${size}.png`);
  }
  // maskable
  await sharp(maskBuf).resize(192, 192).png().toFile(`${ICON_DIR}/icon-192-maskable.png`);
  await sharp(maskBuf).resize(512, 512).png().toFile(`${ICON_DIR}/icon-512-maskable.png`);
  console.log('✅ maskable icons');

  // placeholder screenshots
  const screenshotWide = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
      <rect width="1280" height="720" fill="#0B1220"/>
      <text x="640" y="360" text-anchor="middle" fill="#F4F7FB" font-size="48" font-family="sans-serif">미러온 — 화면 미러링 대기</text>
    </svg>
  `);
  await sharp(screenshotWide).resize(1280, 720).png().toFile(`${ICON_DIR}/screenshot-wide.png`);

  const screenshotNarrow = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844">
      <rect width="390" height="844" fill="#0B1220"/>
      <text x="195" y="422" text-anchor="middle" fill="#F4F7FB" font-size="32" font-family="sans-serif">미러온</text>
    </svg>
  `);
  await sharp(screenshotNarrow).resize(390, 844).png().toFile(`${ICON_DIR}/screenshot-narrow.png`);
  console.log('✅ screenshots');

  // favicon
  await sharp(iconBuf).resize(32, 32).png().toFile('./public/favicon.png');
  console.log('✅ favicon');
}

generate().catch(console.error);
