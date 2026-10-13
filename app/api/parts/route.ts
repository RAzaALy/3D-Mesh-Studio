import { NextResponse } from 'next/server';
import { partsRepository, validateParts } from '@/lib/partsRepository';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 256 * 1024;

export async function GET() {
  return NextResponse.json(partsRepository.get());
}

export async function PUT(req: Request) {
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parts = validateParts((body as { parts?: unknown } | null)?.parts);
  if (!parts) {
    return NextResponse.json({ error: 'Invalid parts payload' }, { status: 422 });
  }
  return NextResponse.json(partsRepository.save(parts));
}
