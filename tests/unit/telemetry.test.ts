// @vitest-environment node
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clampGridSize, sampleTelemetry, DEFAULT_GRID, MAX_GRID, MIN_GRID } from '@/lib/telemetry';
import { heatColor } from '@/lib/heatColor';

describe('clampGridSize', () => {
  it.each([
    [NaN, DEFAULT_GRID],
    [0, DEFAULT_GRID],
    [-5, DEFAULT_GRID],
    [2, MIN_GRID],
    [10.6, 11],
    [1000, MAX_GRID],
  ])('clamps %s to %s', (input, expected) => {
    expect(clampGridSize(input)).toBe(expected);
  });
});

describe('sampleTelemetry', () => {
  it('returns size² values, all within 0..1, rounded to 3 decimals', () => {
    const { size, values, timestamp } = sampleTelemetry(24, 1_700_000_000_000);
    expect(size).toBe(24);
    expect(values).toHaveLength(576);
    expect(timestamp).toBe(1_700_000_000_000);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(Math.round(v * 1000) / 1000).toBe(v);
    }
  });

  it('is deterministic for the same timestamp and changes over time', () => {
    expect(sampleTelemetry(8, 1000)).toEqual(sampleTelemetry(8, 1000));
    expect(sampleTelemetry(8, 1000).values).not.toEqual(sampleTelemetry(8, 2000).values);
  });

  it('keeps the JSON payload small enough to poll twice a second', () => {
    const bytes = JSON.stringify(sampleTelemetry(24, Date.now())).length;
    expect(bytes).toBeLessThan(5_000);
  });
});

describe('heatColor', () => {
  const c = new THREE.Color();
  it('maps 0 to blue, 0.5 to green and 1 to red', () => {
    expect(heatColor(0, c).getHexString()).toBe('1d4ed8');
    expect(heatColor(0.5, c).getHexString()).toBe('22c55e');
    expect(heatColor(1, c).getHexString()).toBe('ef4444');
  });
});
