import { test, expect, worldToScreen, renderStats, resetScene, DEFAULT_PARTS, SCENE_CANVAS } from './fixtures';

const part = (id: string) => DEFAULT_PARTS.find((p) => p.id === id)!;

test.afterEach(async ({ page }) => resetScene(page));

test.describe('3D selection', () => {
  test('clicking a part in the 3D view selects it (raycasting)', async ({ studio }) => {
    const { x, y } = await worldToScreen(studio, part('head').position);
    await studio.mouse.click(x, y);

    await expect(studio.getByRole('button', { name: 'Tool Head' })).toHaveAttribute('aria-pressed', 'true');
    await expect(studio.getByTestId('properties').getByRole('heading', { name: 'Tool Head' })).toBeVisible();
  });

  test('clicking a different part moves the selection', async ({ studio }) => {
    let p = await worldToScreen(studio, part('head').position);
    await studio.mouse.click(p.x, p.y);
    p = await worldToScreen(studio, part('base').position);
    await studio.mouse.click(p.x, p.y);
    await expect(studio.getByRole('button', { name: 'Base Plate' })).toHaveAttribute('aria-pressed', 'true');
    await expect(studio.getByRole('button', { name: 'Tool Head' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('clicking empty space deselects', async ({ studio }) => {
    await studio.getByRole('button', { name: 'Arm' }).click();
    const box = (await studio.locator(SCENE_CANVAS).boundingBox())!;
    // empty sky, top-right (top-left holds the FPS meter in dev mode)
    await studio.mouse.click(box.x + box.width - 60, box.y + 60);
    await expect(studio.getByText('No part selected.')).toBeVisible();
  });

  test('dragging to orbit the camera does not select a part', async ({ studio }) => {
    const { x, y } = await worldToScreen(studio, part('head').position);
    await studio.mouse.move(x, y);
    await studio.mouse.down();
    await studio.mouse.move(x + 120, y + 30, { steps: 8 });
    await studio.mouse.up();
    await expect(studio.getByText('No part selected.')).toBeVisible();
  });
});

test.describe('editing and persistence', () => {
  test('keyboard shortcuts switch transform mode', async ({ studio }) => {
    await studio.getByRole('button', { name: 'Arm' }).click();
    await studio.keyboard.press('e');
    await expect(studio.getByRole('button', { name: /Rotate/ })).toHaveAttribute('aria-pressed', 'true');
    await studio.keyboard.press('r');
    await expect(studio.getByRole('button', { name: /Scale/ })).toHaveAttribute('aria-pressed', 'true');
    await studio.keyboard.press('Escape');
    await expect(studio.getByText('No part selected.')).toBeVisible();
  });

  test('material edit -> save -> survives a page reload', async ({ studio }) => {
    await studio.getByRole('button', { name: 'Arm' }).click();
    await studio.getByRole('slider').first().fill('0.9');
    await expect(studio.getByText('0.90')).toBeVisible();

    await studio.getByRole('button', { name: 'Save to API' }).click();
    await expect(studio.getByRole('button', { name: 'Saved' })).toBeVisible();

    await studio.reload();
    await studio.getByRole('button', { name: 'Arm' }).click();
    await expect(studio.getByText('0.90')).toBeVisible();
  });

  test('the API rejects invalid data and the scene is unchanged', async ({ studio }) => {
    const res = await studio.request.put('/api/parts', { data: { parts: [{ id: 'evil', color: 'javascript:alert(1)' }] } });
    expect(res.status()).toBe(422);
    await studio.reload();
    for (const p of DEFAULT_PARTS) await expect(studio.getByRole('button', { name: p.name })).toBeVisible();
  });
});

test.describe('rendering behaviour', () => {
  test('with the heatmap off, an idle scene stops rendering (frameloop="demand")', async ({ studio }) => {
    await studio.getByRole('checkbox', { name: 'Live sensor heatmap' }).uncheck();
    // settles within a couple of seconds (camera damping, shadow re-bake), then renders nothing
    await expect.poll(() => renderStats(studio, 1000).then((s) => s.frames), { timeout: 10_000 }).toBe(0);
    await studio.waitForTimeout(1000);
    expect((await renderStats(studio, 1000)).frames).toBe(0);

    // ...and wakes up for an interaction
    await studio.getByRole('button', { name: 'Arm' }).click();
    await expect.poll(() => renderStats(studio, 1000).then((s) => s.frames)).toBeGreaterThan(0);
  });

  test('draw calls per frame stay within budget', async ({ studio }) => {
    await studio.waitForTimeout(1500);
    const { maxCalls } = await renderStats(studio, 1000);
    // 6 parts + heatmap (1, instanced) + grid + shadow-map pass; was 33 before optimisation
    expect(maxCalls).toBeLessThanOrEqual(20);
  });
});
