import { describe, expect, it } from 'vitest';
import { createSceneStore } from '@/lib/store';
import { DEFAULT_PARTS } from '@/lib/defaultParts';

describe('scene store', () => {
  it('seeds from the parts it is given (server-rendered data)', () => {
    const custom = [{ ...DEFAULT_PARTS[0], color: '#123456' }];
    expect(createSceneStore(custom).getState().parts).toEqual(custom);
    expect(createSceneStore().getState().parts).toEqual(DEFAULT_PARTS);
  });

  it('creates isolated instances (no shared state between requests)', () => {
    const a = createSceneStore();
    const b = createSceneStore();
    a.getState().select('arm');
    expect(b.getState().selectedId).toBeNull();
  });

  it('updatePart changes only the target part and marks the scene dirty', () => {
    const store = createSceneStore();
    const before = store.getState().parts;
    store.getState().updatePart('arm', { color: '#000000' });
    const after = store.getState().parts;

    expect(after.find((p) => p.id === 'arm')?.color).toBe('#000000');
    // untouched parts keep referential identity, so their memoized meshes don't re-render
    after.filter((p) => p.id !== 'arm').forEach((p, i) => expect(p).toBe(before.filter((q) => q.id !== 'arm')[i]));
    expect(store.getState().dirty).toBe(true);
  });

  it('commitTransform stores the transform and bumps layoutVersion', () => {
    const store = createSceneStore();
    const v = store.getState().layoutVersion;
    store.getState().commitTransform('arm', { position: [1, 2, 3], rotation: [0, 1, 0], scale: [2, 2, 2] });
    const arm = store.getState().parts.find((p) => p.id === 'arm')!;
    expect(arm.position).toEqual([1, 2, 3]);
    expect(arm.scale).toEqual([2, 2, 2]);
    expect(store.getState().layoutVersion).toBe(v + 1);
  });

  it('material edits do not bump layoutVersion (no shadow re-bake needed)', () => {
    const store = createSceneStore();
    store.getState().updatePart('arm', { roughness: 0.9 });
    expect(store.getState().layoutVersion).toBe(0);
  });

  it('setParts clears the dirty flag (after a successful save)', () => {
    const store = createSceneStore();
    store.getState().updatePart('arm', { color: '#000000' });
    store.getState().setParts(store.getState().parts);
    expect(store.getState().dirty).toBe(false);
  });

  it('reset restores defaults, deselects and marks dirty', () => {
    const store = createSceneStore();
    store.getState().select('arm');
    store.getState().updatePart('arm', { color: '#000000' });
    store.getState().reset();
    expect(store.getState().parts).toEqual(DEFAULT_PARTS);
    expect(store.getState().selectedId).toBeNull();
    expect(store.getState().dirty).toBe(true);
  });

  it('toggles telemetry and sets mode / dpr', () => {
    const store = createSceneStore();
    store.getState().toggleTelemetry();
    expect(store.getState().showTelemetry).toBe(false);
    store.getState().setMode('rotate');
    expect(store.getState().mode).toBe('rotate');
    store.getState().setDpr(1);
    expect(store.getState().dpr).toBe(1);
  });
});
