import { NextResponse } from 'next/server';
import { sampleTelemetry } from '@/lib/telemetry';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const body = sampleTelemetry(Number(searchParams.get('size')), Date.now());
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
