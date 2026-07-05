'use client';

// 터치 수 + 소요 시간 측정 훅 (PRD KPI: ≤4 터치, ≤5초)
import { useCallback, useRef } from 'react';

export interface Metrics {
  tapCount: number;
  startTime: number;
  timeToConnectMs: number | null;
  wizardAbandonStep: number | null;
}

export function useConnectionMetrics() {
  const metrics = useRef<Metrics>({
    tapCount: 0,
    startTime: Date.now(),
    timeToConnectMs: null,
    wizardAbandonStep: null,
  });

  const tap = useCallback(() => {
    metrics.current.tapCount++;
  }, []);

  const markConnected = useCallback(() => {
    metrics.current.timeToConnectMs = Date.now() - metrics.current.startTime;
  }, []);

  const markAbandon = useCallback((step: number) => {
    metrics.current.wizardAbandonStep = step;
  }, []);

  const report = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      const m = metrics.current;
      try {
        await fetch('/api/logs/connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tapCount: m.tapCount,
            timeToConnectMs: m.timeToConnectMs,
            wizardAbandonStep: m.wizardAbandonStep,
            ...extra,
          }),
        });
      } catch {
        // 로그 실패가 UX를 막지 않음
      }
    },
    [],
  );

  return { metrics, tap, markConnected, markAbandon, report };
}
