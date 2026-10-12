'use client';

import { useEffect, useState } from 'react';
import type { Mesh } from 'three';
import { TransformControls } from '@react-three/drei';
import { useScene } from '@/lib/store';
import { meshRegistry } from '@/lib/meshRegistry';
import type { Vec3 } from '@/lib/types';

/**
 * Attaches a translate/rotate/scale gizmo to the selected mesh.
 *
 * While dragging, TransformControls mutates the Object3D directly (no React
 * renders). On mouse-up we read the final transform and commit it to the store
 * once — that is the "source of truth" sync point.
 */
export function TransformGizmo() {
  const selectedId = useScene((s) => s.selectedId);
  const mode = useScene((s) => s.mode);
  const commitTransform = useScene((s) => s.commitTransform);
  const [target, setTarget] = useState<Mesh | null>(null);

  useEffect(() => {
    // Mesh registers in its own effect; read after commit.
    setTarget(meshRegistry.get(selectedId));
  }, [selectedId]);

  if (!target || !selectedId) return null;

  const commit = () => {
    commitTransform(selectedId, {
      position: target.position.toArray() as Vec3,
      rotation: [target.rotation.x, target.rotation.y, target.rotation.z],
      scale: target.scale.toArray() as Vec3,
    });
  };

  return (
    <TransformControls
      object={target}
      mode={mode}
      size={0.8}
      translationSnap={0.05}
      rotationSnap={Math.PI / 36}
      onMouseUp={commit}
    />
  );
}
