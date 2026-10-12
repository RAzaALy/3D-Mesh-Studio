'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTelemetry } from '@/hooks/useTelemetry';

const SIZE = 24;
const COUNT = SIZE * SIZE;
const SPACING = 0.32;
const MAX_HEIGHT = 1.4;

const cold = new THREE.Color('#1d4ed8');
const mid = new THREE.Color('#22c55e');
const hot = new THREE.Color('#ef4444');

/**
 * Real-time sensor heatmap: 576 bars rendered in ONE draw call via InstancedMesh.
 *
 * Data arrives ~2x/sec from the API; every frame we ease the current heights
 * toward the latest values with frame-rate independent damping, so motion is
 * smooth at 30fps or 144fps.
 */
export function TelemetryField({ position = [0, 0, 0] as [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const latest = useTelemetry(true, SIZE, 500);
  const current = useMemo(() => new Float32Array(COUNT), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  // Allocate instanceColor once so setColorAt does not create it lazily mid-frame.
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < COUNT; i++) mesh.setColorAt(i, cold);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useFrame((_, delta) => {
    const mesh = ref.current;
    const data = latest.current;
    if (!mesh || !data || data.values.length !== COUNT) return;

    const k = 1 - Math.exp(-6 * delta); // damping factor
    const offset = ((SIZE - 1) * SPACING) / 2;

    for (let i = 0; i < COUNT; i++) {
      const v = (current[i] += (data.values[i] - current[i]) * k);
      const x = i % SIZE;
      const z = Math.floor(i / SIZE);
      const h = 0.05 + v * MAX_HEIGHT;
      dummy.position.set(x * SPACING - offset, h / 2, z * SPACING - offset);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      if (v < 0.5) color.copy(cold).lerp(mid, v * 2);
      else color.copy(mid).lerp(hot, (v - 0.5) * 2);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, COUNT]}
      position={position}
      frustumCulled={false}
      // Not part of the editable product: let clicks fall through.
      raycast={() => null}
    >
      <boxGeometry args={[SPACING * 0.8, 1, SPACING * 0.8]} />
      <meshStandardMaterial roughness={0.6} metalness={0.1} />
    </instancedMesh>
  );
}
