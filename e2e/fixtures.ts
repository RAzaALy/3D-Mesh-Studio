import { test as base, expect, type Page } from '@playwright/test';
import { PerspectiveCamera, Vector3 } from 'three';
import { DEFAULT_PARTS } from '../lib/defaultParts';

/** the WebGL canvas (dev mode also renders small canvases for the FPS meter) */
export const SCENE_CANVAS = '[data-testid="viewport"] canvas[data-ready="true"]';

/**
 * Installs a listener on three.js' built-in devtools hook (window.__THREE_DEVTOOLS__),
 * so tests can count frames and draw calls without any test-only code in the app.
 */
async function installRenderProbe(page: Page) {
  await page.addInitScript(() => {
    type Frame = { t: number; calls: number };
    const w = window as unknown as { __render: { frames: Frame[] }; __THREE_DEVTOOLS__: EventTarget };
    w.__render = { frames: [] };
    const hook = new EventTarget();
    let attached = false;
    hook.addEventListener('observe', (e) => {
      const r = (e as CustomEvent).detail;
      if (!r?.isWebGLRenderer || attached) return;
      attached = true;
      r.info.autoReset = false;
      const tick = () => {
        if (r.info.render.calls > 0) w.__render.frames.push({ t: performance.now(), calls: r.info.render.calls });
        r.info.reset();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    w.__THREE_DEVTOOLS__ = hook;
  });
}

export const renderStats = (page: Page, windowMs: number) =>
  page.evaluate((ms) => {
    const now = performance.now();
    const f = (window as unknown as { __render: { frames: { t: number; calls: number }[] } }).__render.frames.filter(
      (x) => x.t > now - ms,
    );
    return { frames: f.length, maxCalls: Math.max(0, ...f.map((x) => x.calls)) };
  }, windowMs);

/**
 * Projects a world-space point to a pixel inside the canvas, using the same camera the
 * app uses (position [6,4.5,7], fov 45, looking at the orbit target [0,1,-1]).
 */
export async function worldToScreen(page: Page, point: [number, number, number]) {
  const box = await page.locator(SCENE_CANVAS).boundingBox();
  if (!box) throw new Error('canvas not found');
  const cam = new PerspectiveCamera(45, box.width / box.height, 0.1, 60);
  cam.position.set(6, 4.5, 7);
  cam.lookAt(0, 1, -1);
  cam.updateMatrixWorld();
  const ndc = new Vector3(...point).project(cam);
  return { x: box.x + ((ndc.x + 1) / 2) * box.width, y: box.y + ((1 - ndc.y) / 2) * box.height };
}

/** Fraction of sampled canvas pixels that are not the background colour. */
export async function nonBackgroundRatio(page: Page) {
  const png = await page.locator(SCENE_CANVAS).screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let lit = 0;
    let total = 0;
    for (let i = 0; i < data.length; i += 4 * 97) {
      total++;
      // background is #0f1115 (15,17,21); anything clearly brighter is rendered content
      if (data[i] + data[i + 1] + data[i + 2] > 15 + 17 + 21 + 45) lit++;
    }
    return lit / total;
  }, png.toString('base64'));
}

export async function resetScene(page: Page) {
  const res = await page.request.put('/api/parts', { data: { parts: DEFAULT_PARTS } });
  expect(res.ok()).toBeTruthy();
}

type Fixtures = { studio: Page; consoleErrors: string[] };

export const test = base.extend<Fixtures>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      // GPU driver chatter from software rendering is not an app error.
      if (m.type() === 'error' && !/GL Driver|GPU stall|WebGL/i.test(m.text())) errors.push(m.text());
    });
    await use(errors);
  },
  /** the app, loaded, with the 3D canvas created and first frames drawn */
  studio: async ({ page }, use) => {
    await installRenderProbe(page);
    await resetScene(page);
    await page.goto('/');
    await expect(page.locator(SCENE_CANVAS)).toBeVisible();
    await expect.poll(() => renderStats(page, 60_000).then((s) => s.frames)).toBeGreaterThan(2);
    await use(page);
  },
});

export { expect, DEFAULT_PARTS };
