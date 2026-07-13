const { chromium } = await import('/Users/davideloreti/virtuna-brain/node_modules/playwright/index.mjs');

const BASE = 'http://localhost:3400';
const OUT = '/private/tmp/claude-501/-Users-davideloreti-virtuna-v1-1/80152fa8-db41-47b6-9642-def7e406879d/scratchpad';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
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
await page.waitForTimeout(3500); // let the simulated encounter run into the Hold

const brains = page.locator('[data-testid="brain-view"]');
console.log('brain views on page:', await brains.count());
console.log('modes:', await brains.evaluateAll((els) => els.map((e) => e.dataset.mode)));
console.log('parcels in first brain:', await brains.first().locator('polygon').count());

await room.screenshot({ path: `${OUT}/brain2-room.png`, animations: 'disabled', caret: 'hide' });
await brains.first().screenshot({ path: `${OUT}/brain2-sim.png`, animations: 'disabled', caret: 'hide' });

// The GROUNDED one: play the real video and confirm the brain clock follows the playhead.
const grounded = brains.nth(1);
const video = grounded.locator('[data-testid="brain-stimulus-video"]');
await video.waitFor({ timeout: 15000 });
const meta = await video.evaluate(async (v) => {
  if (v.readyState < 1) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
  return { duration: v.duration, w: v.videoWidth, h: v.videoHeight };
});
console.log('video metadata:', JSON.stringify(meta));

await grounded.getByRole('button', { name: /play the stimulus/i }).click();
await page.waitForTimeout(2600);
const playState = await video.evaluate((v) => ({ paused: v.paused, currentTime: +v.currentTime.toFixed(2) }));
console.log('after play:', JSON.stringify(playState));
// The brain's clock must be reading the VIDEO's playhead, not its own loop.
const clock = await grounded.locator('p.font-mono').first().innerText().catch(() => '');
const clockLine = await grounded.evaluate((el) => el.innerText.split('\n').find((l) => l.includes('TR')) ?? '');
console.log('brain clock:', JSON.stringify(clockLine), '| header:', JSON.stringify(clock));

await grounded.screenshot({ path: `${OUT}/brain2-grounded.png`, animations: 'disabled', caret: 'hide' });
console.log('console errors:', errors.length ? errors.slice(0, 4) : 'none');
await browser.close();
