'use client';

import { useEffect, useRef } from 'react';
import type { TelemetryResponse } from '@/lib/types';

/**
 * Polls the telemetry endpoint and writes the latest payload into a ref.
 *
 * Deliberately a ref, not state: the 3D layer reads it inside useFrame and
 * interpolates toward it, so new data never triggers a React re-render.
 *
 * - one request in flight at a time (next poll is scheduled after the previous settles)
 * - out-of-order responses are dropped
 * - polling pauses while the tab is hidden, and resumes immediately when visible again
 */
export function useTelemetry(enabled: boolean, size = 24, intervalMs = 500) {
  const latest = useRef<TelemetryResponse | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let inFlight = false;

    const schedule = (ms: number) => {
      clearTimeout(timer);
      if (!cancelled && document.visibilityState === 'visible') timer = setTimeout(tick, ms);
    };

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      controller = new AbortController();
      try {
        const res = await fetch(`/api/telemetry?size=${size}`, { signal: controller.signal, cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as TelemetryResponse;
          if (!latest.current || data.timestamp >= latest.current.timestamp) latest.current = data;
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.warn('telemetry fetch failed', err);
      } finally {
        inFlight = false;
      }
      schedule(intervalMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule(0);
      else clearTimeout(timer);
    };

    document.addEventListener('visibilitychange', onVisibility);
    schedule(0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, size, intervalMs]);

  return latest;
}
