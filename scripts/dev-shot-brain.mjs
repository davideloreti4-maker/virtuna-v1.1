/**
 * dev-shot-brain — DEV TOOL ONLY. Drives a real browser at /dev/cards#room and shoots the brain.
 *
 * Playwright MCP hangs on this app (the ambient-room animations never settle), and the cortex is
 * WebGL, so a jsdom/happy-dom test pass cannot see it at all. This is the only way to check the
 * thing the owner actually looks at.
 *
 *   node scripts/dev-shot-brain.mjs      (dev server must be up on :3400)
 */
const { chromium } = await import('/Users/davideloreti/virtuna-brain/node_modules/playwright/index.mjs');

const BASE = 'http://localhost:3400';
const OUT = process.env.OUT ?? '/tmp';

const browser = await chromium.launch();
// ⚠️ reducedMotion PINS THE CLOCK, and without it this tool cannot be used to compare two builds.
// The response animates, so every capture lands at a different `t` with a different map — two runs of
// the SAME code produce different colour statistics, and a change measured across them is measuring
// the clock. BrainView holds the response at the stimulus midpoint under reduced motion, which makes
// the capture a pure function of the code. (Learned the hard way: a "regression" in the cold half of
// the map turned out to be two shots taken 3 seconds apart.)
const ctx = await browser.newContext({
  viewport: { width: 1400, height: 1000 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
});
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.fill('input[type="email"]', 'e2e-test@virtuna.local');
await page.fill('input[type="password"]', 'e2e-test-password-2026');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });

await page.goto(`${BASE}/dev/cards`, { waitUntil: 'domcontentloaded' });
const room = page.locator('#room');
await room.scrollIntoViewIfNeeded();
await page.waitForSelector('[data-testid="brain-view"]', { timeout: 30000 });

// The cortex is lazy-loaded (three is a heavy chunk) and builds a 40k-vertex mesh on mount.
await page.waitForSelector('[data-testid="cortex-canvas"] canvas', { timeout: 45000 });
await page.waitForTimeout(4000);

const brains = page.locator('[data-testid="brain-view"]');
console.log('brain views:', await brains.count(), '| modes:', await brains.evaluateAll((els) => els.map((e) => e.dataset.mode)));

// Is WebGL actually PAINTING, or is the canvas blank? An empty canvas passes every DOM assertion.
const painted = await page.locator('[data-testid="cortex-canvas"] canvas').first().evaluate((c) => {
  const gl = c.getContext('webgl2') ?? c.getContext('webgl');
  if (!gl) return { ok: false, why: 'no GL context' };
  const px = new Uint8Array(c.width * c.height * 4);
  gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let lit = 0;
  const tones = new Set();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] > 8) {
      lit++;
      tones.add(`${px[i] >> 5},${px[i + 1] >> 5},${px[i + 2] >> 5}`);
    }
  }
  return {
    ok: lit > 0,
    coverage: +(lit / (c.width * c.height)).toFixed(3),
    distinctTones: tones.size,
    size: `${c.width}x${c.height}`,
  };
});
console.log('cortex pixels:', JSON.stringify(painted));

await room.screenshot({ path: `${OUT}/app-room.png`, animations: 'disabled', caret: 'hide' });
await brains.first().screenshot({ path: `${OUT}/app-brain-sim.png`, animations: 'disabled', caret: 'hide' });
await brains
  .first()
  .locator('[data-testid="brain-surface"]')
  .screenshot({ path: `${OUT}/app-cortex.png`, animations: 'disabled', caret: 'hide' });

// The GROUNDED one: the real video drives the scan clock.
const grounded = brains.nth(1);
await grounded.getByRole('button', { name: /play the stimulus/i }).click().catch(() => {});
await page.waitForTimeout(2600);
const clockLine = await grounded.evaluate((el) => el.innerText.split('\n').find((l) => l.includes('TR')) ?? '');
console.log('grounded clock:', JSON.stringify(clockLine));
await grounded.screenshot({ path: `${OUT}/app-brain-grounded.png`, animations: 'disabled', caret: 'hide' });

console.log('console errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
