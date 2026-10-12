import { NextResponse } from 'next/server';
import type { TelemetryResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Simulated sensor grid (e.g. temperature/vibration readings across a factory floor).
 * Values are deterministic in time so multiple clients see the same field.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const size = Math.min(Math.max(Number(searchParams.get('size')) || 24, 4), 64);
  const t = Date.now() / 1000;
  const values: number[] = new Array(size * size);

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size - 0.5;
      const nz = z / size - 0.5;
      const r = Math.sqrt(nx * nx + nz * nz);
      const wave = Math.sin(r * 14 - t * 1.6) * 0.5 + 0.5;
      const drift = Math.sin(nx * 6 + t * 0.7) * Math.cos(nz * 5 - t * 0.5) * 0.5 + 0.5;
      values[z * size + x] = Math.min(1, Math.max(0, wave * 0.65 + drift * 0.35));
    }
  }

  const body: TelemetryResponse = { size, values, timestamp: Date.now() };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
