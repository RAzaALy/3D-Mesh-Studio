import { create } from 'zustand';
import type { PartConfig, TransformMode, Vec3 } from './types';
import { DEFAULT_PARTS } from './defaultParts';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface SceneState {
  parts: PartConfig[];
  selectedId: string | null;
  hoveredId: string | null;
  mode: TransformMode;
  dirty: boolean;
  saveState: SaveState;
  showTelemetry: boolean;
  quality: 'high' | 'low';

  setParts: (parts: PartConfig[]) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setMode: (mode: TransformMode) => void;
  updatePart: (id: string, patch: Partial<PartConfig>) => void;
  commitTransform: (id: string, t: { position: Vec3; rotation: Vec3; scale: Vec3 }) => void;
  reset: () => void;
  setSaveState: (s: SaveState) => void;
  toggleTelemetry: () => void;
  setQuality: (q: 'high' | 'low') => void;
}

/**
 * Global scene store.
 *
 * Components subscribe with selectors (useScene(s => s.selectedId)) so a change
 * to one slice does not re-render the whole tree. Per-frame values (gizmo drags,
 * animation) never go through React state — they are written to the Three.js
 * object directly and only committed here on pointer-up.
 */
export const useScene = create<SceneState>((set) => ({
  parts: DEFAULT_PARTS,
  selectedId: null,
  hoveredId: null,
  mode: 'translate',
  dirty: false,
  saveState: 'idle',
  showTelemetry: true,
  quality: 'high',

  setParts: (parts) => set({ parts, dirty: false }),
  select: (id) => set({ selectedId: id }),
  hover: (id) => set({ hoveredId: id }),
  setMode: (mode) => set({ mode }),
  updatePart: (id, patch) =>
    set((s) => ({
      parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      dirty: true,
      saveState: 'idle',
    })),
  commitTransform: (id, t) =>
    set((s) => ({
      parts: s.parts.map((p) => (p.id === id ? { ...p, ...t } : p)),
      dirty: true,
      saveState: 'idle',
    })),
  reset: () => set({ parts: DEFAULT_PARTS, selectedId: null, dirty: true, saveState: 'idle' }),
  setSaveState: (saveState) => set({ saveState }),
  toggleTelemetry: () => set((s) => ({ showTelemetry: !s.showTelemetry })),
  setQuality: (quality) => set({ quality }),
}));
