#!/usr/bin/env node
/**
 * One-shot Playwright probe for the BehavioralCanvas particle render.
 *
 * Used to verify the CR-01 fix (zero-particle bug) on the hydrated client
 * canvas at `/`. Not wired into CI — invoke manually with:
 *
 *   node scripts/verify-canvas.mjs http://localhost:3000
 *
 * Asserts at least one non-transparent pixel in three viewports
 * (desktop, mobile, reduced-motion) after a 4s wait.
 */
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://localhost:3000';

const scenarios = [
  { label: 'desktop 1280x720', viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' },
  { label: 'mobile 390x844', viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' },
  { label: 'desktop reduced-motion', viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' },
];

let allOk = true;

const browser = await chromium.launch();

for (const s of scenarios) {
  const context = await browser.newContext({
    viewport: s.viewport,
    reducedMotion: s.reducedMotion,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 5000 });
  await page.waitForTimeout(4000);

  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { ok: false, reason: 'no canvas in DOM' };
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, reason: 'no 2d context' };
    const w = canvas.width, h = canvas.height;
    if (w === 0 || h === 0) return { ok: false, reason: 'canvas buffer is 0x0' };
    const imageData = ctx.getImageData(0, 0, w, h);
    let nonZeroPixels = 0;
    for (let i = 3; i < imageData.data.length; i += 4) {
      if (imageData.data[i] > 0) nonZeroPixels++;
    }
    return { ok: nonZeroPixels > 0, nonZeroPixels, w, h, totalPixels: w * h };
  });

  console.log(`[${s.label}]`, JSON.stringify(result));
  if (!result.ok) allOk = false;
  await context.close();
}

await browser.close();

if (!allOk) {
  console.error('FAIL: at least one scenario produced 0 non-transparent pixels');
  process.exit(1);
}
console.log('PASS: every scenario rendered particles');
