// Real Chromium, real canvas, real WebGL, real WebAudio. happy-dom cannot
// produce those, so this is the only place the probes are exercised for
// content rather than for not throwing.
//
// Values are asserted by shape, never by literal: they differ per GPU, OS and
// driver, which is the entire premise of fingerprinting.

import { expect, test } from '@playwright/test';

const HEX32 = /^[0-9a-f]{32}$/;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body[data-ready="true"]')).toBeVisible({ timeout: 15_000 });
});

test('produces a visitor id', async ({ page }) => {
  const id = (await page.getByTestId('visitor-id').innerText()).replace(/\s/g, '');
  expect(id).toMatch(HEX32);
});

test('reports a usable confidence', async ({ page }) => {
  const confidence = Number(await page.getByTestId('confidence').innerText());
  expect(confidence).toBeGreaterThan(0.5);
  expect(confidence).toBeLessThanOrEqual(1);
});

test('the expensive probes actually returned something', async ({ page }) => {
  const components = await page.evaluate(async () => {
    const { load } = await import('/whorl.v1.esm.js');
    const agent = await load();
    const result = await agent.get();
    return result.components;
  });

  expect(String(components.canvas.value)).toMatch(/^data:image\/png;base64,.{100,}/);
  expect(components.webgl.value).toBeTruthy();
  expect(String((components.webgl.value as Record<string, unknown>).renderer)).not.toHaveLength(0);
  expect(String(components.audio.value)).toMatch(/^[\d.]+$/);
  expect(Object.keys(components.math.value as object).length).toBeGreaterThan(5);
  expect(components.userAgent.value).toContain('Chrome');
});

test('the same browser gets the same id on reload', async ({ page }) => {
  const first = (await page.getByTestId('visitor-id').innerText()).replace(/\s/g, '');
  await page.reload();
  await expect(page.locator('body[data-ready="true"]')).toBeVisible({ timeout: 15_000 });
  const second = (await page.getByTestId('visitor-id').innerText()).replace(/\s/g, '');
  expect(second).toBe(first);
});

test('offline mode issues no requests to anywhere', async ({ page, context }) => {
  const external: string[] = [];
  await context.route('**', (route) => {
    const url = route.request().url();
    if (!url.startsWith('http://localhost:4173')) external.push(url);
    return route.continue();
  });

  await page.reload();
  await expect(page.locator('body[data-ready="true"]')).toBeVisible({ timeout: 15_000 });

  expect(external).toEqual([]);
});

test('draws a whorl from the id', async ({ page }) => {
  await expect(page.locator('#whorl path').first()).toBeVisible();
  expect(await page.locator('#whorl path').count()).toBe(22);
});

test('lists every signal with the hashed ones marked', async ({ page }) => {
  await expect(page.locator('#signal-rows tr')).toHaveCount(33);
  await expect(page.locator('tr[data-component="canvas"] .chip-hash')).toBeVisible();
  // Reported, but deliberately not part of the id.
  await expect(page.locator('tr[data-component="userAgent"] .chip-hash')).toHaveCount(0);
});
