#!/usr/bin/env node
/**
 * Load & render performance probe.
 *
 *   npm run build && npm start      # in one terminal
 *   npm run perf                    # in another (BASE_URL defaults to http://localhost:3000)
 *
 * Uses three.js' built-in devtools hook (window.__THREE_DEVTOOLS__) to observe the
 * renderer, so the app needs no test-only code. Reports the median of RUNS page loads.
 */
import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const RUNS = Number(process.env.RUNS ?? 3);

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function measureOnce(browser) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  await page.addInitScript(() => {
    const w = window;
    w.__perf = { longTaskMs: 0, frames: [], firstFrameAt: null, renderer: null };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__perf.longTaskMs += Math.max(0, e.duration - 50);
    }).observe({ type: 'longtask', buffered: true });

    // three.js announces every WebGLRenderer it creates on this EventTarget.
    const hook = new EventTarget();
    hook.addEventListener('observe', (e) => {
      const obj = e.detail;
      if (!obj || !obj.isWebGLRenderer || w.__perf.renderer) return;
      w.__perf.renderer = obj;
      obj.info.autoReset = false; // accumulate across all render() calls in a frame
      const tick = () => {
        const { calls, triangles } = obj.info.render;
        if (calls > 0) {
          if (w.__perf.firstFrameAt === null) w.__perf.firstFrameAt = performance.now();
          w.__perf.frames.push({ t: performance.now(), calls, triangles, programs: obj.info.programs?.length ?? 0 });
        }
        obj.info.reset();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    w.__THREE_DEVTOOLS__ = hook;
  });

  let jsBytes = 0;
  let telemetryBytes = 0;
  page.on('requestfinished', async (req) => {
    const sizes = await req.sizes().catch(() => null);
    if (!sizes) return;
    if (req.resourceType() === 'script') jsBytes += sizes.responseBodySize;
    if (req.url().includes('/api/telemetry')) telemetryBytes = sizes.responseBodySize;
  });

  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__perf.firstFrameAt !== null, null, { timeout: 60_000 });
  const firstFrameMs = await page.evaluate(() => window.__perf.firstFrameAt);

  // Steady state with the heatmap on (continuous rendering).
  await page.waitForTimeout(3000);
  const busy = await page.evaluate(() => {
    const f = window.__perf.frames.filter((x) => x.t > performance.now() - 2000);
    const avg = (k) => f.reduce((s, x) => s + x[k], 0) / Math.max(1, f.length);
    return { fps: f.length / 2, drawCallsPerFrame: avg('calls'), trianglesPerFrame: avg('triangles'), programs: f.at(-1)?.programs ?? 0 };
  });

  // Idle with the heatmap off: a static scene should stop rendering.
  await page.getByLabel('Live sensor heatmap').uncheck();
  await page.waitForTimeout(2500);
  const idleFramesPerSec = await page.evaluate(
    () => window.__perf.frames.filter((x) => x.t > performance.now() - 2000).length / 2,
  );

  const longTaskMs = await page.evaluate(() => window.__perf.longTaskMs);
  await context.close();
  return { firstFrameMs, jsBytes, telemetryBytes, longTaskMs, idleFramesPerSec, ...busy };
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const runs = [];
for (let i = 0; i < RUNS; i++) runs.push(await measureOnce(browser));
await browser.close();

const keys = Object.keys(runs[0]);
const result = Object.fromEntries(keys.map((k) => [k, Math.round(median(runs.map((r) => r[k])) * 10) / 10]));
console.log(JSON.stringify(result, null, 2));
