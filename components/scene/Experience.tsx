'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
  PerformanceMonitor,
  Stats,
} from '@react-three/drei';
import { useScene } from '@/lib/store';
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
  return (
    <>
      <ambientLight intensity={0.25} />
      {/*
        Shadows stay on permanently. Toggling castShadow at runtime changes the number of
        shadow-casting lights, which forces every material's shader to recompile (a visible
        hitch). We scale resolution (DPR) instead when the device struggles.
      */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={20}
      />
      {/* Studio environment built from Lightformers: no HDR download, rendered once. */}
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={2} position={[0, 5, -5]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={1} position={[-5, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
        <Lightformer form="ring" intensity={1.5} position={[5, 3, 3]} scale={2} />
      </Environment>
    </>
  );
}

/**
 * Soft ground shadow. Rendering it costs a full extra pass of the scene plus two blur
 * passes, so it is baked once (frames={1}) and re-baked only when a part is moved.
 */
function GroundShadow() {
  const layoutVersion = useScene((s) => s.layoutVersion);
  return (
    <ContactShadows key={layoutVersion} frames={1} position={[0, 0.001, 0]} opacity={0.5} scale={6} blur={2.5} far={3} resolution={256} />
  );
}

const DPR_STEPS = [0.75, 1, 1.25, 1.5, 2];

export default function Experience() {
  const select = useScene((s) => s.select);
  const showTelemetry = useScene((s) => s.showTelemetry);
  const dpr = useScene((s) => s.dpr);
  const setDpr = useScene((s) => s.setDpr);

  return (
    <Canvas
      shadows
      // Render continuously only while something animates; otherwise only on change.
      frameloop={showTelemetry ? 'always' : 'demand'}
      // [min, max]: never above the screen's own pixel ratio, never above the adaptive cap.
      dpr={[0.75, dpr]}
      camera={{ position: [6, 4.5, 7], fov: 45, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => select(null)}
      onCreated={({ gl }) => gl.domElement.setAttribute('data-ready', 'true')}
    >
      <color attach="background" args={['#0f1115']} />
      <fog attach="fog" args={['#0f1115', 14, 30]} />

      {/* Watches real FPS and nudges resolution up or down; settles on 1x if it keeps flip-flopping. */}
      <PerformanceMonitor
        onChange={({ factor }) => setDpr(DPR_STEPS[Math.round(factor * (DPR_STEPS.length - 1))])}
        flipflops={3}
        onFallback={() => setDpr(1)}
      />

      <Suspense fallback={null}>
        <Lighting />
        <Product />
        <TransformGizmo />
        {showTelemetry && <TelemetryField position={[0, 0, -7]} />}
      </Suspense>

      <GroundShadow />
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
      {process.env.NODE_ENV === 'development' && <Stats />}
    </Canvas>
  );
}
