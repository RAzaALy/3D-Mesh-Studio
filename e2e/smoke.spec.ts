import { test, expect, nonBackgroundRatio, DEFAULT_PARTS, SCENE_CANVAS } from './fixtures';

/**
 * @smoke — the "is the build alive?" checks. Fast, broad, no deep flows.
 * If any of these fail, nothing else is worth testing.
 */
test.describe('@smoke', () => {
  test('home page returns 200 with the panel server-rendered', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toContain('Mesh Studio');
    // initial scene data is embedded in the HTML (no client fetch waterfall)
    for (const p of DEFAULT_PARTS) expect(html).toContain(p.name);
  });

  test('3D scene boots and actually draws pixels, with no console errors', async ({ studio, consoleErrors }) => {
    await expect(studio.locator(SCENE_CANVAS)).toHaveCount(1);
    expect(await nonBackgroundRatio(studio)).toBeGreaterThan(0.05);
    expect(consoleErrors).toEqual([]);
  });

  test('panel lists all parts and core controls', async ({ studio }) => {
    for (const p of DEFAULT_PARTS) await expect(studio.getByRole('button', { name: p.name })).toBeVisible();
    for (const m of ['Move', 'Rotate', 'Scale']) await expect(studio.getByRole('button', { name: new RegExp(m) })).toBeVisible();
    await expect(studio.getByRole('checkbox', { name: 'Live sensor heatmap' })).toBeChecked();
    await expect(studio.getByRole('button', { name: 'Save to API' })).toBeDisabled();
  });

  test('GET /api/parts returns a valid scene', async ({ request }) => {
    const res = await request.get('/api/parts');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.parts)).toBe(true);
    expect(json.parts.length).toBeGreaterThan(0);
  });

  test('GET /api/telemetry returns a 24x24 grid, uncached', async ({ request }) => {
    const res = await request.get('/api/telemetry');
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toBe('no-store');
    const json = await res.json();
    expect(json.values).toHaveLength(576);
  });

  test('unknown routes 404', async ({ request }) => {
    expect((await request.get('/does-not-exist')).status()).toBe(404);
  });
});
