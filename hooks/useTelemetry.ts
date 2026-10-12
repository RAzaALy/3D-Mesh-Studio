'use client';

import { useEffect, useRef } from 'react';
import type { TelemetryResponse } from '@/lib/types';

/**
 * Polls the telemetry endpoint and writes the latest payload into a ref.
 *
 * Deliberately a ref, not state: the 3D layer reads it inside useFrame and
 * interpolates toward it, so new data never triggers a React re-render.
 */
export function useTelemetry(enabled: boolean, size = 24, intervalMs = 500) {
  const latest = useRef<TelemetryResponse | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;

    const tick = async () => {
      controller = new AbortController();
      try {
        const res = await fetch(`/api/telemetry?size=${size}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (res.ok) {
          const data = (await res.json()) as TelemetryResponse;
          // Drop out-of-order responses.
          if (!latest.current || data.timestamp >= latest.current.timestamp) latest.current = data;
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.warn('telemetry fetch failed', err);
      }
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [enabled, size, intervalMs]);

  return latest;
}
