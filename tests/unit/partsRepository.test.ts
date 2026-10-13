// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PARTS } from '@/lib/defaultParts';
import { isPart, partsRepository, validateParts } from '@/lib/partsRepository';
import type { PartConfig } from '@/lib/types';

const valid: PartConfig = { ...DEFAULT_PARTS[0] };

describe('isPart', () => {
  it('accepts every default part', () => {
    expect(DEFAULT_PARTS.every(isPart)).toBe(true);
  });

  it.each([
    ['missing id', { ...valid, id: undefined }],
    ['empty id', { ...valid, id: '' }],
    ['overlong id', { ...valid, id: 'x'.repeat(65) }],
    ['unknown geometry', { ...valid, geometry: 'teapot' }],
    ['non-numeric args', { ...valid, args: [1, 'a'] }],
    ['too many args', { ...valid, args: [1, 2, 3, 4, 5, 6, 7] }],
    ['shorthand hex colour', { ...valid, color: '#fff' }],
    ['css colour name', { ...valid, color: 'red' }],
    ['script in colour', { ...valid, color: '<script>' }],
    ['2D position', { ...valid, position: [0, 0] }],
    ['NaN in rotation', { ...valid, rotation: [0, NaN, 0] }],
    ['Infinity in scale', { ...valid, scale: [1, Infinity, 1] }],
    ['metalness above 1', { ...valid, metalness: 1.5 }],
    ['negative roughness', { ...valid, roughness: -0.1 }],
    ['null', null],
    ['string', 'part'],
  ])('rejects %s', (_label, input) => {
    expect(isPart(input)).toBe(false);
  });
});

describe('validateParts', () => {
  it('returns the parts when all are valid', () => {
    expect(validateParts(DEFAULT_PARTS)).toEqual(DEFAULT_PARTS);
  });

  it('accepts an empty scene', () => {
    expect(validateParts([])).toEqual([]);
  });

  it('rejects duplicate ids', () => {
    expect(validateParts([valid, { ...valid }])).toBeNull();
  });

  it('rejects more than 200 parts', () => {
    const many = Array.from({ length: 201 }, (_, i) => ({ ...valid, id: `p${i}` }));
    expect(validateParts(many)).toBeNull();
  });

  it('rejects non-arrays', () => {
    expect(validateParts({ parts: [] })).toBeNull();
    expect(validateParts(undefined)).toBeNull();
  });
});

describe('partsRepository', () => {
  beforeEach(() => partsRepository.reset());

  it('starts with the default scene', () => {
    expect(partsRepository.get().parts).toEqual(DEFAULT_PARTS);
  });

  it('persists a save and stamps updatedAt', () => {
    const saved = partsRepository.save([valid]);
    expect(saved.parts).toEqual([valid]);
    expect(Date.parse(saved.updatedAt)).toBeGreaterThan(0);
    expect(partsRepository.get()).toBe(saved);
  });
});
