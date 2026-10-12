'use client';

import { useEffect } from 'react';
import { useScene } from '@/lib/store';
import type { TransformMode } from '@/lib/types';

const MODES: { mode: TransformMode; label: string; key: string }[] = [
  { mode: 'translate', label: 'Move', key: 'W' },
  { mode: 'rotate', label: 'Rotate', key: 'E' },
  { mode: 'scale', label: 'Scale', key: 'R' },
];

const fmt = (v: number[]) => v.map((n) => n.toFixed(2)).join(', ');

export function ControlPanel() {
  const parts = useScene((s) => s.parts);
  const selectedId = useScene((s) => s.selectedId);
  const mode = useScene((s) => s.mode);
  const dirty = useScene((s) => s.dirty);
  const saveState = useScene((s) => s.saveState);
  const showTelemetry = useScene((s) => s.showTelemetry);
  const quality = useScene((s) => s.quality);
  const { select, setMode, updatePart, reset, setSaveState, setParts, toggleTelemetry } = useScene.getState();

  const selected = parts.find((p) => p.id === selectedId) ?? null;

  // Editor-style shortcuts (same as Blender/Unity: W/E/R, Esc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'w') setMode('translate');
      else if (k === 'e') setMode('rotate');
      else if (k === 'r') setMode('scale');
      else if (k === 'escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode, select]);

  const save = async () => {
    setSaveState('saving');
    try {
      const res = await fetch('/api/parts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: useScene.getState().parts }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setParts(data.parts);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  return (
    <aside className="panel">
      <header>
        <h1>Mesh Studio</h1>
        <p className="muted">Click a part to select · drag gizmo to transform</p>
      </header>

      <section>
        <h2>Parts</h2>
        <ul className="parts">
          {parts.map((p) => (
            <li key={p.id}>
              <button className={p.id === selectedId ? 'active' : ''} onClick={() => select(p.id)}>
                <span className="swatch" style={{ background: p.color }} />
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Transform</h2>
        <div className="seg">
          {MODES.map((m) => (
            <button key={m.mode} className={mode === m.mode ? 'active' : ''} onClick={() => setMode(m.mode)}>
              {m.label} <kbd>{m.key}</kbd>
            </button>
          ))}
        </div>
      </section>

      {selected ? (
        <section>
          <h2>{selected.name}</h2>
          <dl className="readout">
            <dt>Position</dt>
            <dd>{fmt(selected.position)}</dd>
            <dt>Rotation</dt>
            <dd>{fmt(selected.rotation)}</dd>
            <dt>Scale</dt>
            <dd>{fmt(selected.scale)}</dd>
          </dl>
          <label>
            Color
            <input type="color" value={selected.color} onChange={(e) => updatePart(selected.id, { color: e.target.value })} />
          </label>
          <label>
            Metalness <span>{selected.metalness.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selected.metalness}
              onChange={(e) => updatePart(selected.id, { metalness: Number(e.target.value) })}
            />
          </label>
          <label>
            Roughness <span>{selected.roughness.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={selected.roughness}
              onChange={(e) => updatePart(selected.id, { roughness: Number(e.target.value) })}
            />
          </label>
        </section>
      ) : (
        <section className="muted">No part selected.</section>
      )}

      <section>
        <h2>Visualization</h2>
        <label className="row">
          <input type="checkbox" checked={showTelemetry} onChange={toggleTelemetry} />
          Live sensor heatmap
        </label>
        <p className="muted small">
          Render quality: <strong>{quality}</strong> (auto-adjusted by PerformanceMonitor)
        </p>
      </section>

      <footer>
        <button onClick={reset}>Reset</button>
        <button className="primary" disabled={!dirty || saveState === 'saving'} onClick={save}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save to API'}
        </button>
        {saveState === 'error' && <p className="error">Save failed — try again.</p>}
      </footer>
    </aside>
  );
}
