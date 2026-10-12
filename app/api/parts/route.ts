import { NextResponse } from 'next/server';
import { DEFAULT_PARTS } from '@/lib/defaultParts';
import type { PartConfig, PartsResponse } from '@/lib/types';

// In-memory "database" for the demo. Swap for Postgres/Prisma etc. in production.
let store: PartsResponse = { parts: DEFAULT_PARTS, updatedAt: new Date().toISOString() };

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(store);
}

const isVec3 = (v: unknown): v is [number, number, number] =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

function isPart(p: unknown): p is PartConfig {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.color === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(o.color) &&
    isVec3(o.position) &&
    isVec3(o.rotation) &&
    isVec3(o.scale) &&
    typeof o.metalness === 'number' &&
    typeof o.roughness === 'number'
  );
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parts = (body as { parts?: unknown })?.parts;
  if (!Array.isArray(parts) || parts.length > 200 || !parts.every(isPart)) {
    return NextResponse.json({ error: 'Invalid parts payload' }, { status: 422 });
  }
  store = { parts, updatedAt: new Date().toISOString() };
  return NextResponse.json(store);
}
