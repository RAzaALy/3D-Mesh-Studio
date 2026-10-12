'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type { Mesh } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import { useScene } from '@/lib/store';
import { meshRegistry } from '@/lib/meshRegistry';
import type { PartConfig } from '@/lib/types';

function Geometry({ part }: { part: PartConfig }) {
  const a = part.args;
  switch (part.geometry) {
    case 'box':
      return <boxGeometry args={[a[0], a[1], a[2]]} />;
    case 'cylinder':
      return <cylinderGeometry args={[a[0], a[1], a[2], a[3]]} />;
    case 'sphere':
      return <sphereGeometry args={[a[0], a[1], a[2]]} />;
    case 'torus':
      return <torusGeometry args={[a[0], a[1], a[2], a[3]]} />;
    case 'cone':
      return <coneGeometry args={[a[0], a[1], a[2]]} />;
  }
}

/**
 * A mesh that can be hovered, selected and highlighted.
 * Each instance subscribes only to whether *it* is hovered/selected,
 * so hovering one part does not re-render the others.
 */
function SelectableMeshImpl({ part }: { part: PartConfig }) {
  const ref = useRef<Mesh>(null);
  const isSelected = useScene((s) => s.selectedId === part.id);
  const isHovered = useScene((s) => s.hoveredId === part.id);
  const quality = useScene((s) => s.quality);
  const select = useScene((s) => s.select);
  const hover = useScene((s) => s.hover);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    meshRegistry.set(part.id, mesh);
    return () => {
      meshRegistry.delete(part.id);
    };
  }, [part.id]);

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation(); // only the front-most mesh should react
    hover(part.id);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    hover(null);
    document.body.style.cursor = 'auto';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Ignore clicks that were actually orbit drags.
    if (e.delta > 4) return;
    select(part.id);
  };

  const emissive = isSelected ? '#2f6fed' : isHovered ? '#ffffff' : '#000000';
  const emissiveIntensity = isSelected ? 0.35 : isHovered ? 0.12 : 0;

  return (
    <mesh
      ref={ref}
      name={part.id}
      position={part.position}
      rotation={part.rotation}
      scale={part.scale}
      castShadow={quality === 'high'}
      receiveShadow
      onPointerOver={onOver}
      onPointerOut={onOut}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onClick={onClick}
    >
      <Geometry part={part} />
      <meshStandardMaterial
        color={part.color}
        metalness={part.metalness}
        roughness={part.roughness}
        emissive={emissive}
        emissiveIntensity={pressed ? emissiveIntensity * 1.5 : emissiveIntensity}
      />
      {(isSelected || isHovered) && (
        <Outlines thickness={isSelected ? 0.03 : 0.015} color={isSelected ? '#2f6fed' : '#ffffff'} />
      )}
    </mesh>
  );
}

export const SelectableMesh = memo(SelectableMeshImpl);
