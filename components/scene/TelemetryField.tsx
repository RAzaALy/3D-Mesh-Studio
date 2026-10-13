'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTelemetry } from '@/hooks/useTelemetry';
import { DEFAULT_GRID } from '@/lib/telemetry';
import { HEAT_COLD, heatColor } from '@/lib/heatColor';

const SIZE = DEFAULT_GRID;
const COUNT = SIZE * SIZE;
const SPACING = 0.32;
const MAX_HEIGHT = 1.4;
/** below this per-bar change the field is visually at rest */
const EPSILON = 0.0005;

/**
 * Real-time sensor heatmap: 576 bars rendered in ONE draw call via InstancedMesh.
 *
 * Data arrives ~2x/sec; every frame we ease the bars toward the latest values with
 * frame-rate independent damping, so motion is smooth at 30fps or 144fps. When the
 * bars have caught up, the frame skips the matrix/color rebuild and the GPU upload.
 */
export function TelemetryField({ position = [0, 0, -7] as [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const latest = useTelemetry(true, SIZE, 500);
  const current = useMemo(() => new Float32Array(COUNT), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  // Lay out the bars at rest and allocate instanceColor before the first frame.
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const offset = ((SIZE - 1) * SPACING) / 2;
    for (let i = 0; i < COUNT; i++) {
      dummy.position.set((i % SIZE) * SPACING - offset, 0.025, Math.floor(i / SIZE) * SPACING - offset);
      dummy.scale.set(1, 0.05, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, HEAT_COLD);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [dummy]);

  useFrame((_, delta) => {
    const mesh = ref.current;
    const data = latest.current;
    if (!mesh || !data || data.values.length !== COUNT) return;

    const k = 1 - Math.exp(-6 * delta); // damping factor
    const offset = ((SIZE - 1) * SPACING) / 2;
    let moved = false;

    for (let i = 0; i < COUNT; i++) {
      const diff = data.values[i] - current[i];
      if (Math.abs(diff) < EPSILON) continue;
      moved = true;
      const v = (current[i] += diff * k);
      const h = 0.05 + v * MAX_HEIGHT;
      dummy.position.set((i % SIZE) * SPACING - offset, h / 2, Math.floor(i / SIZE) * SPACING - offset);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, heatColor(v, color));
    }

    if (!moved) return; // nothing changed: skip the GPU buffer upload
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, COUNT]}
      position={position}
      // One bounding box for all bars would need recomputing as they grow; the field is
      // always in view, so skip culling instead.
      frustumCulled={false}
      // Not part of the editable product: let clicks fall through and skip 576 raycasts per move.
      raycast={() => null}
    >
      <boxGeometry args={[SPACING * 0.8, 1, SPACING * 0.8]} />
      {/* Lambert is far cheaper per pixel than PBR and indistinguishable on matte bars. */}
      <meshLambertMaterial />
    </instancedMesh>
  );
}
