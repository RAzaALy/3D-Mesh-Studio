import { DEFAULT_PARTS } from './defaultParts';
import type { PartConfig, PartsResponse, Vec3 } from './types';

/**
 * Server-side persistence for the scene configuration.
 *
 * Shared by the `/api/parts` Route Handler and the page's Server Component, so the
 * page can embed the current config in its HTML instead of making the browser fetch
 * it after the 3D bundle loads. In-memory for the demo; swap for a database.
 */
const initial = (): PartsResponse => ({ parts: DEFAULT_PARTS, updatedAt: new Date(0).toISOString() });

// Next bundles each route separately, so a plain module variable could exist once per
// route. Pinning it to globalThis gives the page and the API one shared copy.
const g = globalThis as typeof globalThis & { __meshStudioParts?: PartsResponse };

export const partsRepository = {
  get: (): PartsResponse => (g.__meshStudioParts ??= initial()),
  save: (parts: PartConfig[]): PartsResponse => (g.__meshStudioParts = { parts, updatedAt: new Date().toISOString() }),
  /** test helper */
  reset: () => {
    g.__meshStudioParts = initial();
  },
};

const MAX_PARTS = 200;
const GEOMETRIES = new Set(['box', 'cylinder', 'sphere', 'torus', 'cone']);

const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isFiniteNumber);
const inUnit = (n: unknown) => isFiniteNumber(n) && n >= 0 && n <= 1;

export function isPart(p: unknown): p is PartConfig {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    o.id.length > 0 &&
    o.id.length <= 64 &&
    typeof o.name === 'string' &&
    o.name.length <= 100 &&
    typeof o.geometry === 'string' &&
    GEOMETRIES.has(o.geometry) &&
    Array.isArray(o.args) &&
    o.args.length <= 6 &&
    o.args.every(isFiniteNumber) &&
    typeof o.color === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(o.color) &&
    isVec3(o.position) &&
    isVec3(o.rotation) &&
    isVec3(o.scale) &&
    inUnit(o.metalness) &&
    inUnit(o.roughness)
  );
}

export function validateParts(input: unknown): PartConfig[] | null {
  if (!Array.isArray(input) || input.length > MAX_PARTS || !input.every(isPart)) return null;
  const ids = new Set(input.map((p) => p.id));
  return ids.size === input.length ? input : null; // ids must be unique
}
