'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import type { PartConfig, TransformMode, Vec3 } from './types';
import { DEFAULT_PARTS } from './defaultParts';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface SceneState {
  parts: PartConfig[];
  selectedId: string | null;
  hoveredId: string | null;
  mode: TransformMode;
  dirty: boolean;
  saveState: SaveState;
  showTelemetry: boolean;
  /** device-pixel-ratio the canvas renders at; lowered automatically on slow devices */
  dpr: number;
  /** bumps whenever geometry placement changes, so baked effects (contact shadows) can refresh */
  layoutVersion: number;

  setParts: (parts: PartConfig[]) => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setMode: (mode: TransformMode) => void;
  updatePart: (id: string, patch: Partial<PartConfig>) => void;
  commitTransform: (id: string, t: { position: Vec3; rotation: Vec3; scale: Vec3 }) => void;
  reset: () => void;
  setSaveState: (s: SaveState) => void;
  toggleTelemetry: () => void;
  setDpr: (dpr: number) => void;
}

export type SceneStore = StoreApi<SceneState>;

/**
 * A store per app instance (not a module singleton).
 *
 * The page is server-rendered, and a module-level store would be shared by every
 * request on the server. Creating it inside a provider keeps server renders isolated
 * and lets the server seed it with the saved scene. R3F bridges React context into
 * <Canvas>, so 3D components read the same store.
 *
 * Per-frame values (gizmo drags, animation) never go through this store: they are
 * written to Three.js objects directly and committed here only on pointer-up.
 */
export function createSceneStore(initialParts: PartConfig[] = DEFAULT_PARTS): SceneStore {
  return createStore<SceneState>((set) => ({
    parts: initialParts,
    selectedId: null,
    hoveredId: null,
    mode: 'translate',
    dirty: false,
    saveState: 'idle',
    showTelemetry: true,
    dpr: 1.5,
    layoutVersion: 0,

    setParts: (parts) => set((s) => ({ parts, dirty: false, layoutVersion: s.layoutVersion + 1 })),
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
        layoutVersion: s.layoutVersion + 1,
      })),
    reset: () =>
      set((s) => ({
        parts: DEFAULT_PARTS,
        selectedId: null,
        dirty: true,
        saveState: 'idle',
        layoutVersion: s.layoutVersion + 1,
      })),
    setSaveState: (saveState) => set({ saveState }),
    toggleTelemetry: () => set((s) => ({ showTelemetry: !s.showTelemetry })),
    setDpr: (dpr) => set({ dpr }),
  }));
}

const SceneStoreContext = createContext<SceneStore | null>(null);

export function SceneStoreProvider({ initialParts, children }: { initialParts?: PartConfig[]; children: ReactNode }) {
  const [store] = useState(() => createSceneStore(initialParts));
  return <SceneStoreContext.Provider value={store}>{children}</SceneStoreContext.Provider>;
}

export function useSceneApi(): SceneStore {
  const store = useContext(SceneStoreContext);
  if (!store) throw new Error('useScene must be used inside <SceneStoreProvider>');
  return store;
}

/** Subscribe to a slice of scene state. Only re-renders when that slice changes. */
export function useScene<T>(selector: (s: SceneState) => T): T {
  return useStore(useSceneApi(), selector);
}
