'use client';

import { useEffect } from 'react';
import { useScene, useSceneApi } from '@/lib/store';
import type { PartsResponse, TransformMode } from '@/lib/types';

const MODES: { mode: TransformMode; label: string; key: string }[] = [
  { mode: 'translate', label: 'Move', key: 'W' },
  { mode: 'rotate', label: 'Rotate', key: 'E' },
  { mode: 'scale', label: 'Scale', key: 'R' },
];

const KEY_TO_MODE: Record<string, TransformMode> = { w: 'translate', e: 'rotate', r: 'scale' };

const fmt = (v: number[]) => v.map((n) => n.toFixed(2)).join(', ');

function isTypingTarget(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  return !!node && (node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName));
}

export function ControlPanel() {
  const api = useSceneApi();
  const parts = useScene((s) => s.parts);
  const selectedId = useScene((s) => s.selectedId);
  const mode = useScene((s) => s.mode);
  const dirty = useScene((s) => s.dirty);
  const saveState = useScene((s) => s.saveState);
  const showTelemetry = useScene((s) => s.showTelemetry);
  const dpr = useScene((s) => s.dpr);
  const select = useScene((s) => s.select);
  const setMode = useScene((s) => s.setMode);
  const updatePart = useScene((s) => s.updatePart);
  const reset = useScene((s) => s.reset);
  const toggleTelemetry = useScene((s) => s.toggleTelemetry);

  const selected = parts.find((p) => p.id === selectedId) ?? null;

  // Editor-style shortcuts (Blender/Unity convention): W/E/R, Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Leave browser shortcuts (Ctrl+R reload, Cmd+W close...) and text fields alone.
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const k = e.key.toLowerCase();
      if (KEY_TO_MODE[k]) setMode(KEY_TO_MODE[k]);
      else if (k === 'escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMode, select]);

  const save = async () => {
    const { setSaveState, setParts } = api.getState();
    setSaveState('saving');
    try {
      const res = await fetch('/api/parts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: api.getState().parts }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as PartsResponse;
      setParts(data.parts);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  return (
    <aside className="panel" aria-label="Scene controls">
      <header>
        <h1>Mesh Studio</h1>
        <p className="muted">Click a part to select · drag gizmo to transform</p>
      </header>

      <section aria-labelledby="parts-heading">
        <h2 id="parts-heading">Parts</h2>
        <ul className="parts">
          {parts.map((p) => (
            <li key={p.id}>
              <button className={p.id === selectedId ? 'active' : ''} aria-pressed={p.id === selectedId} onClick={() => select(p.id)}>
                <span className="swatch" style={{ background: p.color }} aria-hidden />
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="transform-heading">
        <h2 id="transform-heading">Transform</h2>
        <div className="seg" role="group" aria-label="Transform mode">
          {MODES.map((m) => (
            <button
              key={m.mode}
              className={mode === m.mode ? 'active' : ''}
              aria-pressed={mode === m.mode}
              aria-keyshortcuts={m.key}
              onClick={() => setMode(m.mode)}
            >
              {m.label} <kbd>{m.key}</kbd>
            </button>
          ))}
        </div>
      </section>

      {selected ? (
        <section aria-labelledby="selected-heading" data-testid="properties">
          <h2 id="selected-heading">{selected.name}</h2>
          <dl className="readout">
            <dt>Position</dt>
            <dd data-testid="readout-position">{fmt(selected.position)}</dd>
            <dt>Rotation</dt>
            <dd data-testid="readout-rotation">{fmt(selected.rotation)}</dd>
            <dt>Scale</dt>
            <dd data-testid="readout-scale">{fmt(selected.scale)}</dd>
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

      <section aria-labelledby="viz-heading">
        <h2 id="viz-heading">Visualization</h2>
        <label className="row">
          <input type="checkbox" checked={showTelemetry} onChange={toggleTelemetry} />
          Live sensor heatmap
        </label>
        <p className="muted small">
          Render resolution: <strong data-testid="dpr">{dpr}x</strong> (auto-tuned to keep frame rate smooth)
        </p>
      </section>

      <footer>
        <button onClick={reset}>Reset</button>
        <button className="primary" disabled={!dirty || saveState === 'saving'} onClick={save}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save to API'}
        </button>
        <p className="status" role="status" aria-live="polite">
          {saveState === 'error' ? <span className="error">Save failed — try again.</span> : null}
        </p>
      </footer>
    </aside>
  );
}
