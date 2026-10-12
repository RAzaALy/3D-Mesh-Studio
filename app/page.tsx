'use client';

import dynamic from 'next/dynamic';
import { ControlPanel } from '@/components/ui/ControlPanel';

// WebGL needs `window`; load the canvas on the client only and keep three.js out of the server bundle.
const Experience = dynamic(() => import('@/components/scene/Experience'), {
  ssr: false,
  loading: () => <div className="loader">Loading 3D scene…</div>,
});

export default function Home() {
  return (
    <main className="layout">
      <div className="viewport">
        <Experience />
      </div>
      <ControlPanel />
    </main>
  );
}
