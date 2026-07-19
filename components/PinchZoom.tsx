'use client';

// PinchZoom — 두 손가락으로 확대/축소 + 드래그 이동 + 더블탭 리셋.
// <video>는 기본 확대가 안 되므로 CSS transform으로 직접 구현한다.
import { ReactNode, useCallback, useRef } from 'react';

const MIN = 1;
const MAX = 5;

export default function PinchZoom({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 현재 변환 상태 (리렌더 없이 ref로 관리 → 부드러움)
  const state = useRef({ scale: 1, tx: 0, ty: 0 });
  // 제스처 시작 스냅샷
  const gesture = useRef<{
    mode: 'none' | 'pinch' | 'pan';
    startDist: number;
    startScale: number;
    startTx: number;
    startTy: number;
    lastX: number;
    lastY: number;
  }>({ mode: 'none', startDist: 0, startScale: 1, startTx: 0, startTy: 0, lastX: 0, lastY: 0 });
  const lastTap = useRef(0);

  const apply = useCallback(() => {
    const { scale, tx, ty } = state.current;
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
  }, []);

  // 이동 범위 제한 (확대된 만큼만 이동 허용)
  const clampPan = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const maxX = (w * (state.current.scale - 1)) / 2;
    const maxY = (h * (state.current.scale - 1)) / 2;
    state.current.tx = Math.max(-maxX, Math.min(maxX, state.current.tx));
    state.current.ty = Math.max(-maxY, Math.min(maxY, state.current.ty));
  }, []);

  const dist = (t: TouchList) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches;
    if (t.length === 2) {
      gesture.current.mode = 'pinch';
      gesture.current.startDist = dist(t as unknown as TouchList);
      gesture.current.startScale = state.current.scale;
      gesture.current.startTx = state.current.tx;
      gesture.current.startTy = state.current.ty;
    } else if (t.length === 1) {
      // 더블탭 리셋
      const now = Date.now();
      if (now - lastTap.current < 300) {
        state.current = { scale: 1, tx: 0, ty: 0 };
        apply();
        gesture.current.mode = 'none';
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;
      // 확대 상태에서만 드래그 이동
      if (state.current.scale > 1) {
        gesture.current.mode = 'pan';
        gesture.current.lastX = t[0].clientX;
        gesture.current.lastY = t[0].clientY;
      } else {
        gesture.current.mode = 'none';
      }
    }
  }, [apply]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = e.touches;
    if (gesture.current.mode === 'pinch' && t.length === 2) {
      e.preventDefault();
      const ratio = dist(t as unknown as TouchList) / (gesture.current.startDist || 1);
      const next = Math.max(MIN, Math.min(MAX, gesture.current.startScale * ratio));
      state.current.scale = next;
      if (next === 1) {
        state.current.tx = 0;
        state.current.ty = 0;
      } else {
        clampPan();
      }
      apply();
    } else if (gesture.current.mode === 'pan' && t.length === 1) {
      e.preventDefault();
      const dx = t[0].clientX - gesture.current.lastX;
      const dy = t[0].clientY - gesture.current.lastY;
      gesture.current.lastX = t[0].clientX;
      gesture.current.lastY = t[0].clientY;
      state.current.tx += dx;
      state.current.ty += dy;
      clampPan();
      apply();
    }
  }, [apply, clampPan]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) gesture.current.mode = 'none';
    else if (e.touches.length === 1 && state.current.scale > 1) {
      gesture.current.mode = 'pan';
      gesture.current.lastX = e.touches[0].clientX;
      gesture.current.lastY = e.touches[0].clientY;
    }
  }, []);

  return (
    // absolute inset-0: 부모(고정 컨테이너)를 확실히 꽉 채움 (percentage 높이 미해결 회피)
    <div
      ref={wrapRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: 'none' }}
    >
      <div ref={contentRef} className="absolute inset-0 origin-center will-change-transform">
        {children}
      </div>
    </div>
  );
}
