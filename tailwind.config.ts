import type { Config } from 'tailwindcss';

// 초보자 퍼스트 디자인 시스템 (TRD 2절)
// 타이포는 CSS 변수(--fs-*) 기반 → data-font-scale="base|large" 전환(×1.25)
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B1220', // bg-base
        surface: '#131C2E',
        line: '#24314A',
        primary: '#F4F7FB', // text-primary — 대비 15:1 ✅ (on #0B1220)
        muted: '#9FB0C8', // 보조 텍스트 — 대비 7.2:1 ✅
        accent: '#22D3EE', // 주 버튼 배경 — #06222A 텍스트와 8:1 ✅
        'accent-ink': '#06222A',
        success: '#4ADE80', // ✓ 아이콘 병행 (색 단독 구분 금지)
        error: '#F87171', // ⚠ 아이콘 + 해결 문구 병행
        warn: '#FBBF24',
      },
      fontSize: {
        code: ['var(--fs-code)', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '0.12em' }],
        title: ['var(--fs-title)', { lineHeight: '1.35', fontWeight: '700' }],
        button: ['var(--fs-button)', { lineHeight: '1.3', fontWeight: '600' }],
        body: ['var(--fs-body)', { lineHeight: '1.6', fontWeight: '400' }],
        caption: ['var(--fs-caption)', { lineHeight: '1.6', fontWeight: '400' }],
      },
      borderRadius: {
        big: '20px',
      },
      keyframes: {
        breathe: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        pulseFast: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.3' } },
      },
      animation: {
        breathe: 'breathe 2.4s ease-in-out infinite',
        'pulse-danger': 'pulseFast 1.2s ease-in-out infinite',
        'pulse-critical': 'pulseFast 0.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
