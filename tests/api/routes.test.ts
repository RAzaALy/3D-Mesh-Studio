// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { GET as getParts, PUT as putParts } from '@/app/api/parts/route';
import { GET as getTelemetry } from '@/app/api/telemetry/route';
import { DEFAULT_PARTS } from '@/lib/defaultParts';
import { partsRepository } from '@/lib/partsRepository';

const put = (body: string, headers: Record<string, string> = {}) =>
  putParts(new Request('http://test/api/parts', { method: 'PUT', body, headers: { 'content-type': 'application/json', ...headers } }));

describe('GET /api/parts', () => {
  beforeEach(() => partsRepository.reset());

  it('returns the current scene', async () => {
    const res = await getParts();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.parts).toEqual(DEFAULT_PARTS);
    expect(typeof json.updatedAt).toBe('string');
  });
});

describe('PUT /api/parts', () => {
  beforeEach(() => partsRepository.reset());

  it('saves a valid scene and returns it', async () => {
    const parts = DEFAULT_PARTS.map((p) => (p.id === 'arm' ? { ...p, color: '#00ff00' } : p));
    const res = await put(JSON.stringify({ parts }));
    expect(res.status).toBe(200);
    expect((await res.json()).parts).toEqual(parts);
    expect(partsRepository.get().parts).toEqual(parts);
  });

  it('400s on malformed JSON', async () => {
    const res = await put('{not json');
    expect(res.status).toBe(400);
  });

  it('422s on an invalid payload and keeps the previous scene', async () => {
    const res = await put(JSON.stringify({ parts: [{ id: 'x' }] }));
    expect(res.status).toBe(422);
    expect(partsRepository.get().parts).toEqual(DEFAULT_PARTS);
  });

  it('422s when the body is not an object with parts', async () => {
    expect((await put('null')).status).toBe(422);
    expect((await put('[]')).status).toBe(422);
  });

  it('413s when the declared body is too large', async () => {
    const res = await put(JSON.stringify({ parts: [] }), { 'content-length': String(1024 * 1024) });
    expect(res.status).toBe(413);
  });
});

describe('GET /api/telemetry', () => {
  it('returns a 24x24 grid by default, uncached', async () => {
    const res = await getTelemetry(new Request('http://test/api/telemetry'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const json = await res.json();
    expect(json.size).toBe(24);
    expect(json.values).toHaveLength(576);
  });

  it('honours and clamps ?size', async () => {
    const small = await (await getTelemetry(new Request('http://test/api/telemetry?size=8'))).json();
    expect(small.values).toHaveLength(64);
    const huge = await (await getTelemetry(new Request('http://test/api/telemetry?size=99999'))).json();
    expect(huge.size).toBe(64);
  });
});
