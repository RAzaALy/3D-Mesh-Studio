export type Vec3 = [number, number, number];

export type GeometryKind = 'box' | 'cylinder' | 'sphere' | 'torus' | 'cone';

export interface PartConfig {
  id: string;
  name: string;
  geometry: GeometryKind;
  /** geometry-specific constructor args */
  args: number[];
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  color: string;
  metalness: number;
  roughness: number;
}

export interface PartsResponse {
  parts: PartConfig[];
  updatedAt: string;
}

export interface TelemetryResponse {
  /** grid size per side (grid is size x size) */
  size: number;
  /** normalized sensor values 0..1, row-major, length = size * size */
  values: number[];
  timestamp: number;
}

export type TransformMode = 'translate' | 'rotate' | 'scale';
