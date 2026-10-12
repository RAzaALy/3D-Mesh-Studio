import type { Mesh } from 'three';

/**
 * Maps part ids to their live Three.js meshes.
 *
 * Keeping object references out of Zustand avoids putting non-serializable,
 * frequently-mutated objects in React state, while still letting siblings
 * (e.g. the transform gizmo) find the selected mesh.
 */
const registry = new Map<string, Mesh>();

export const meshRegistry = {
  set: (id: string, mesh: Mesh) => registry.set(id, mesh),
  delete: (id: string) => registry.delete(id),
  get: (id: string | null) => (id ? registry.get(id) ?? null : null),
};
