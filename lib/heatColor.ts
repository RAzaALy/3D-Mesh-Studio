import { Color } from 'three';

const cold = new Color('#1d4ed8');
const mid = new Color('#22c55e');
const hot = new Color('#ef4444');

export const HEAT_COLD = cold;

/** Maps a normalized reading 0..1 to blue -> green -> red, writing into `target` (no allocation). */
export function heatColor(v: number, target: Color): Color {
  return v < 0.5 ? target.copy(cold).lerp(mid, v * 2) : target.copy(mid).lerp(hot, (v - 0.5) * 2);
}
