import type { TelemetryResponse } from './types';

export const DEFAULT_GRID = 24;
export const MIN_GRID = 4;
export const MAX_GRID = 64;

export function clampGridSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_GRID;
  return Math.min(Math.max(Math.round(size), MIN_GRID), MAX_GRID);
}

/**
 * Simulated sensor grid (e.g. temperature/vibration across a factory floor).
 * Deterministic in time so every client sees the same field.
 *
 * Values are rounded to 3 decimals: the bars can't show more precision than that,
 * and it cuts the JSON payload by roughly 3x (about 11 KB down to under 4 KB per poll).
 */
export function sampleTelemetry(requestedSize: number, nowMs: number): TelemetryResponse {
  const size = clampGridSize(requestedSize);
  const t = nowMs / 1000;
  const values: number[] = new Array(size * size);

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size - 0.5;
      const nz = z / size - 0.5;
      const r = Math.sqrt(nx * nx + nz * nz);
      const wave = Math.sin(r * 14 - t * 1.6) * 0.5 + 0.5;
      const drift = Math.sin(nx * 6 + t * 0.7) * Math.cos(nz * 5 - t * 0.5) * 0.5 + 0.5;
      const v = Math.min(1, Math.max(0, wave * 0.65 + drift * 0.35));
      values[z * size + x] = Math.round(v * 1000) / 1000;
    }
  }

  return { size, values, timestamp: nowMs };
}
