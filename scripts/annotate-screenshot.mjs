#!/usr/bin/env node
/**
 * Regenerates docs/screenshot.png and docs/annotated-screenshot.png from the running app.
 *
 *   npm run build && npm start        # terminal 1
 *   npm run docs:screenshot           # terminal 2
 *
 * Arrow targets are measured, not hand-placed: DOM targets come from element bounding
 * boxes, 3D targets are projected through the same camera the app uses.
 */
import { chromium } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { writeFileSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const W = 1400;
const H = 1040;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

// ---------- 1. capture the app ----------
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.request.put(`${BASE_URL}/api/parts`, { data: { parts: (await (await page.request.get(`${BASE_URL}/api/parts`)).json()).parts } });
await page.goto(BASE_URL);
await page.waitForSelector('canvas[data-ready="true"]');
await page.waitForTimeout(3000);
await page.getByRole('button', { name: 'Arm' }).click();
await page.waitForTimeout(3000);
const shot = await page.screenshot();
writeFileSync('docs/screenshot.png', shot);

const canvasBox = await page.locator('[data-testid="viewport"] canvas[data-ready="true"]').boundingBox();
const project = ([x, y, z]) => {
  const cam = new PerspectiveCamera(45, canvasBox.width / canvasBox.height, 0.1, 60);
  cam.position.set(6, 4.5, 7);
  cam.lookAt(0, 1, -1);
  cam.updateMatrixWorld();
  const v = new Vector3(x, y, z).project(cam);
  return { x: canvasBox.x + ((v.x + 1) / 2) * canvasBox.width, y: canvasBox.y + ((1 - v.y) / 2) * canvasBox.height };
};
// Right-side arrows land in the panel's right padding, beside (not on top of) the control.
const panelBox = await page.locator('aside').boundingBox();
const leftEdge = async (locator, dy = 0.5) => {
  const b = await locator.boundingBox();
  return { x: panelBox.x + panelBox.width - 9, y: b.y + b.height * dy };
};

const panel = page.locator('aside');
const anchors = {
  canvas: { x: 150, y: 120 },
  parts: project([-0.8, 1.0, 0.25]), // column
  highlight: project([0.55, 2.25, 0.15]), // outlined arm
  gizmo: project([0.1, 2.75, 0]), // green arrow of the gizmo
  heatmap: project([1.6, 1.1, -6.2]),
  staging: project([1.2, 0.3, 0.9]), // base plate + contact shadow
  orbit: { x: 230, y: 860 }, // empty floor: drag anywhere
  partsList: await leftEdge(panel.getByRole('button', { name: 'Base Plate' })),
  modes: await leftEdge(panel.getByRole('group', { name: 'Transform mode' })),
  props: await leftEdge(panel.getByTestId('properties'), 0.35),
  viz: await leftEdge(panel.getByRole('checkbox', { name: 'Live sensor heatmap' })),
  save: await leftEdge(panel.getByRole('button', { name: 'Reset' })),
};
await page.close();

// ---------- 2. callout content ----------
const T = {
  three: ['Three.js', 'three'],
  r3f: ['React Three Fiber', 'r3f'],
  drei: ['Drei', 'drei'],
  react: ['React', 'react'],
  zustand: ['Zustand', 'zustand'],
  next: ['Next.js API', 'next'],
};

const left = [
  { n: 1, a: 'canvas', title: '3D viewport (the canvas)', file: 'components/scene/Experience.tsx', tech: [T.r3f, T.three],
    body: 'Creates the WebGL renderer, camera and render loop. Renders every frame only while something animates; otherwise only on change.' },
  { n: 2, a: 'parts', title: 'Machine parts (meshes)', file: 'components/scene/SelectableMesh.tsx', tech: [T.three, T.r3f],
    body: 'Each part = geometry + PBR material (metalness / roughness). R3F raycasts your mouse to know which part you hover or click.' },
  { n: 3, a: 'highlight', title: 'Hover & selection highlight', file: 'components/scene/SelectableMesh.tsx', tech: [T.drei, T.three],
    body: 'Blue outline + glow on the selected part, white on hover. Only the part that changed re-renders.' },
  { n: 4, a: 'gizmo', title: 'Transform gizmo', file: 'components/scene/TransformGizmo.tsx', tech: [T.drei],
    body: 'Arrows move, rings rotate, cubes scale (W / E / R). Moves the object directly while dragging; saves to the store on mouse-up.' },
  { n: 5, a: 'heatmap', title: 'Live sensor heatmap', file: 'TelemetryField.tsx + hooks/useTelemetry.ts', tech: [T.three, T.next],
    body: '576 bars drawn in ONE draw call (InstancedMesh). Polls /api/telemetry twice a second and eases bars smoothly every frame.' },
  { n: 6, a: 'staging', title: 'Lighting, shadows & floor', file: 'components/scene/Experience.tsx', tech: [T.drei, T.three],
    body: 'Sun light with real-time shadows, studio reflections (Lightformers), soft ground shadow baked once, infinite grid.' },
  { n: 7, a: 'orbit', title: 'Camera controls', file: 'components/scene/Experience.tsx', tech: [T.drei],
    body: 'Drag to orbit, scroll to zoom. Disabled automatically while you drag the gizmo, so the two never fight.' },
];

const right = [
  { n: 8, a: 'partsList', title: 'Parts list', file: 'components/ui/ControlPanel.tsx', tech: [T.react, T.zustand],
    body: 'Same selection as clicking in 3D: the panel and the canvas read one shared store.' },
  { n: 9, a: 'modes', title: 'Transform mode', file: 'components/ui/ControlPanel.tsx', tech: [T.zustand, T.drei],
    body: 'Switches the gizmo between move / rotate / scale. Keyboard: W, E, R; Esc deselects.' },
  { n: 10, a: 'props', title: 'Properties of the selection', file: 'components/ui/ControlPanel.tsx', tech: [T.react, T.three],
    body: 'Read-out of the saved position / rotation / scale. Colour and sliders edit the material live.' },
  { n: 11, a: 'viz', title: 'Heatmap toggle & render resolution', file: 'ControlPanel.tsx + Experience.tsx', tech: [T.drei, T.r3f],
    body: 'Off = scene stops rendering when idle. Resolution auto-drops on slow devices (PerformanceMonitor).' },
  { n: 12, a: 'save', title: 'Reset & Save', file: 'app/api/parts/route.ts + app/page.tsx', tech: [T.next],
    body: 'Save sends the scene to a validated API. On reload the server puts it straight into the HTML.' },
];

// ---------- 3. compose ----------
// Number the 3D callouts top-to-bottom by where their arrow lands, so arrows don't cross.
left.sort((a, b) => anchors[a.a].y - anchors[b.a].y).forEach((c, i) => (c.n = i + 1));

const M = 540; // side margin for callouts
const TOP = 150;
const OUT_W = W + M * 2;
const OUT_H = H + TOP + 170;
const CARD_W = M - 60;
const imgX = M;
const imgY = TOP;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const card = (c, side) => `
  <div class="card ${side}" data-n="${c.n}" data-anchor="${c.a}" data-side="${side}">
    <div class="num">${c.n}</div>
    <div class="content">
      <div class="title">${esc(c.title)}</div>
      <div class="file">${esc(c.file)}</div>
      <div class="chips">${c.tech.map(([label, cls]) => `<span class="chip ${cls}">${label}</span>`).join('')}</div>
      <div class="body">${esc(c.body)}</div>
    </div>
  </div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin:0; width:${OUT_W}px; height:${OUT_H}px; background:#0b0d11; color:#e6e8eb; font-family: Inter, 'DejaVu Sans', sans-serif; position:relative; overflow:hidden; }
  h1 { position:absolute; left:${M}px; top:34px; margin:0; font-size:40px; font-weight:700; letter-spacing:-.01em; }
  .sub { position:absolute; left:${M}px; top:90px; font-size:19px; color:#9aa3b2; }
  .legend { position:absolute; right:${M}px; top:46px; display:flex; gap:22px; font-size:16px; color:#9aa3b2; }
  .legend i { display:inline-block; width:14px; height:14px; border-radius:50%; margin-right:8px; vertical-align:-2px; }
  .shot { position:absolute; left:${imgX}px; top:${imgY}px; width:${W}px; height:${H}px; border-radius:14px; box-shadow:0 0 0 1px #2a313c, 0 20px 60px rgba(0,0,0,.5); }
  svg { position:absolute; inset:0; pointer-events:none; }
  .badge { font: 700 14px Inter, sans-serif; fill:#0b0d11; }
  .col-left { position:absolute; left:30px; top:${imgY}px; height:${H}px; width:${CARD_W}px; display:flex; flex-direction:column; justify-content:space-between; }
  .col-right { position:absolute; left:${imgX + W + 30}px; top:0; width:${CARD_W}px; }
  .col-right .card { position:absolute; left:0; width:${CARD_W}px; }
  .card { display:flex; gap:14px; padding:13px 16px; border-radius:12px; background:#151a22; border:1px solid #262d38; }
  .card.left { border-left:4px solid #5b9bff; }
  .card.right { border-left:4px solid #f5a524; }
  .num { flex:none; width:30px; height:30px; border-radius:50%; display:grid; place-items:center; font-weight:700; font-size:15px; color:#0b0d11; }
  .left .num { background:#5b9bff; } .right .num { background:#f5a524; }
  .title { font-size:18px; font-weight:650; line-height:1.2; }
  .file { font-family:'DejaVu Sans Mono', monospace; font-size:12.5px; color:#8b95a5; margin-top:4px; }
  .chips { margin-top:7px; display:flex; gap:6px; flex-wrap:wrap; }
  .chip { font-size:12px; font-weight:600; padding:2px 8px; border-radius:999px; border:1px solid; }
  .chip.three { color:#c9ced6; border-color:#5d6675; }
  .chip.r3f { color:#7fb2ff; border-color:#33507d; }
  .chip.drei { color:#c4a7ff; border-color:#4e3d7a; }
  .chip.react { color:#6fd3f2; border-color:#245a6b; }
  .chip.zustand { color:#f5a524; border-color:#6b4c14; }
  .chip.next { color:#7ee2a0; border-color:#25603a; }
  .body { font-size:14px; line-height:1.4; color:#b9c0cc; margin-top:7px; }
  .flow { position:absolute; left:${M}px; width:${W}px; top:${imgY + H + 36}px; display:flex; align-items:center; gap:14px; font-size:16px; color:#9aa3b2; }
  .node { background:#151a22; border:1px solid #262d38; border-radius:10px; padding:12px 16px; color:#e6e8eb; line-height:1.35; }
  .node small { display:block; color:#8b95a5; font-size:13px; font-family:'DejaVu Sans Mono', monospace; }
  .arrowtxt { color:#5d6675; font-size:24px; }
</style></head><body>
  <h1>Mesh Studio 3D: what you're looking at</h1>
  <div class="sub">Each number points to a part of the screen, the file that builds it, the technology it uses, and what it does.</div>
  <div class="legend"><span><i style="background:#5b9bff"></i>inside the 3D canvas (WebGL)</span><span><i style="background:#f5a524"></i>regular React UI (HTML)</span></div>
  <img class="shot" src="data:image/png;base64,${shot.toString('base64')}"/>
  <svg id="arrows" width="${OUT_W}" height="${OUT_H}"></svg>
  <div class="col-left">${left.map((c) => card(c, 'left')).join('')}</div>
  <div class="col-right">${right.map((c) => card(c, 'right')).join('')}</div>
  <div class="flow">
    <span>How data flows:</span>
    <div class="node">Next.js server<small>app/page.tsx · /api/parts · /api/telemetry</small></div><span class="arrowtxt">→</span>
    <div class="node">Zustand store (shared state)<small>lib/store.tsx</small></div><span class="arrowtxt">→</span>
    <div class="node">3D canvas 1–7<small>React Three Fiber + Drei + Three.js</small></div><span>and</span>
    <div class="node">Side panel 8–12<small>React</small></div>
  </div>
</body></html>`;

// Layout runs in the browser so card heights are real; then arrows are drawn to match.
const drawArrows = ({ anchors, imgX, imgY, W, H }) => {
  const GAP = 12;
  let floor = imgY;
  for (const el of document.querySelectorAll('.col-right .card')) {
    const a = anchors[el.dataset.anchor];
    const want = imgY + a.y - 24;
    const top = Math.max(floor, want); // may run below the screenshot; there is margin there
    el.style.top = `${top}px`;
    floor = top + el.offsetHeight + GAP;
  }
  const svg = document.getElementById('arrows');
  let out = `<defs>
    <marker id="h-left" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#5b9bff"/></marker>
    <marker id="h-right" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#f5a524"/></marker></defs>`;
  for (const el of document.querySelectorAll('.card')) {
    const side = el.dataset.side;
    const a = anchors[el.dataset.anchor];
    const r = el.getBoundingClientRect();
    const ax = imgX + a.x;
    const ay = imgY + a.y;
    const sx = side === 'left' ? r.right : r.left;
    const sy = r.top + 30;
    const mx = side === 'left' ? imgX - 16 : imgX + W + 14;
    const color = side === 'left' ? '#5b9bff' : '#f5a524';
    const d = `M ${sx} ${sy} L ${mx} ${sy} L ${ax} ${ay}`;
    out += `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="6" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" marker-end="url(#h-${side})"/>
      <circle cx="${ax}" cy="${ay}" r="13" fill="${color}" stroke="#0b0d11" stroke-width="3"/>
      <text x="${ax}" y="${ay + 4.5}" text-anchor="middle" class="badge">${el.dataset.n}</text>`;
  }
  svg.innerHTML = out;
};

const out = await browser.newPage({ viewport: { width: OUT_W, height: OUT_H }, deviceScaleFactor: 1 });
await out.setContent(html, { waitUntil: 'load' });
await out.evaluate(() => document.fonts.ready);
await out.evaluate(drawArrows, { anchors, imgX, imgY, W, H });
await out.screenshot({ path: 'docs/annotated-screenshot.png' });
await browser.close();
console.log('wrote docs/screenshot.png and docs/annotated-screenshot.png');
