'use client';

import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  AdaptiveDpr,
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
  PerformanceMonitor,
  Stats,
} from '@react-three/drei';
import { useScene } from '@/lib/store';
import type { PartsResponse } from '@/lib/types';
import { SelectableMesh } from './SelectableMesh';
import { TransformGizmo } from './TransformGizmo';
import { TelemetryField } from './TelemetryField';

function Product() {
  const parts = useScene((s) => s.parts);
  return (
    <group>
      {parts.map((p) => (
        <SelectableMesh key={p.id} part={p} />
      ))}
    </group>
  );
}

function Lighting() {
  const quality = useScene((s) => s.quality);
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.6}
        castShadow={quality === 'high'}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      {/* Studio environment built from Lightformers: no HDR download, works offline. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={2} position={[0, 5, -5]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1} position={[-5, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="ring" intensity={1.5} position={[5, 3, 3]} scale={2} />
      </Environment>
    </>
  );
}

export default function Experience() {
  const select = useScene((s) => s.select);
  const setParts = useScene((s) => s.setParts);
  const showTelemetry = useScene((s) => s.showTelemetry);
  const quality = useScene((s) => s.quality);
  const setQuality = useScene((s) => s.setQuality);

  // Hydrate the scene from the backend.
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/parts', { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<PartsResponse>) : Promise.reject(r.status)))
      .then((data) => setParts(data.parts))
      .catch((err) => {
        if (err?.name !== 'AbortError') console.warn('Using default parts; API failed:', err);
      });
    return () => controller.abort();
  }, [setParts]);

  return (
    <Canvas
      shadows
      // Only render continuously when something animates; otherwise render on demand.
      frameloop={showTelemetry ? 'always' : 'demand'}
      dpr={quality === 'high' ? [1, 2] : [0.75, 1]}
      camera={{ position: [6, 4.5, 7], fov: 45, near: 0.1, far: 100 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={['#0f1115']} />
      <fog attach="fog" args={['#0f1115', 14, 30]} />

      <PerformanceMonitor onDecline={() => setQuality('low')} onIncline={() => setQuality('high')} flipflops={3} />
      <AdaptiveDpr pixelated />

      <Suspense fallback={null}>
        <Lighting />
        <Product />
        <TransformGizmo />
        {showTelemetry && <TelemetryField position={[0, 0, -7]} />}
      </Suspense>

      <ContactShadows position={[0, 0.001, 0]} opacity={0.5} scale={8} blur={2.5} far={3} />
      <Grid
        infiniteGrid
        cellSize={0.5}
        sectionSize={2.5}
        cellColor="#252a33"
        sectionColor="#3a4250"
        fadeDistance={25}
        position={[0, -0.001, 0]}
      />

      <OrbitControls makeDefault enableDamping maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={20} target={[0, 1, -1]} />
      {process.env.NODE_ENV !== 'production' && <Stats />}
    </Canvas>
  );
}
