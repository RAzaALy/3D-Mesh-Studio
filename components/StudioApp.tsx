'use client';

import dynamic from 'next/dynamic';
import { SceneStoreProvider } from '@/lib/store';
import { ControlPanel } from '@/components/ui/ControlPanel';
import type { PartConfig } from '@/lib/types';

// WebGL needs `window`, and three.js is the heaviest dependency: load the canvas on the
// client only, in its own chunk, so the panel renders and becomes interactive first.
const Experience = dynamic(() => import('@/components/scene/Experience'), {
  ssr: false,
  loading: () => (
    <div className="loader" role="status">
      <span className="spinner" aria-hidden />
      Loading 3D scene…
    </div>
  ),
});

export function StudioApp({ initialParts }: { initialParts: PartConfig[] }) {
  return (
    <SceneStoreProvider initialParts={initialParts}>
      <main className="layout">
        <div className="viewport" data-testid="viewport">
          <Experience />
        </div>
        <ControlPanel />
      </main>
    </SceneStoreProvider>
  );
}
