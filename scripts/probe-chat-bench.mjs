/**
 * probe-chat-bench.mjs — measure how OTHER chat products render a thread, so "make it feel like
 * Claude" is a number and not a vibe.
 *
 * Written for the 2026-08-09 in-thread chat audit (docs/HANDOFF-2026-08-09-in-thread-chat-audit.md §3).
 *
 * WHAT IT REPORTS, per product: content-column width, characters per line, font size / line-height,
 * the distinct text roles in one answer, and the body colour. Those five explain most of the
 * perceived quality gap — Virtuna renders body at 14px/75ch where the benchmarks sit at 16px/~66-71ch.
 *
 * ⚠️ BOT WALLS — read before believing an empty result:
 *  - A fresh HEADLESS desktop context gets a Cloudflare "Performing security verification" page on
 *    both perplexity.ai and claude.ai. The screenshot looks like a real page; it is not.
 *  - A MOBILE device context passes (mobile UA + touch). That is why --mobile works headless.
 *  - For desktop, run with --headed, or drive it through the Playwright MCP browser, which passes.
 *  - claude.ai/new REDIRECTS TO /logout without a session and cannot be measured at all. Use a
 *    read-only share page instead: Share -> Create link on any chat, then pass --claude <url>.
 *    That renders the real thread UI with no auth.
 *
 *   node scripts/probe-chat-bench.mjs [--headed] [--mobile] [--claude https://claude.ai/share/...]
 *                                     [--query "why do most morning routines fail"]
 *                                     [--local http://localhost:3005/home]
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const has = (f) => process.argv.includes(f);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };

const HEADED = has('--headed');
const MOBILE = has('--mobile');
const QUERY = arg('--query', 'why do most morning routines fail');
const CLAUDE_SHARE = arg('--claude', null);
const LOCAL = arg('--local', null);
const OUT = path.join(process.cwd(), '.playwright-mcp/shots');
fs.mkdirSync(OUT, { recursive: true });

/**
 * Runs in the page. `ch` is the real payload: column width divided by the rendered width of a
 * character in that exact font, which is what "measure" means in typography.
 */
const MEASURE = () => {
  const px = (v) => Math.round(parseFloat(v) * 100) / 100;
  const cv = document.createElement('canvas').getContext('2d');
  const info = (el) => {
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    cv.font = `${cs.fontSize} ${cs.fontFamily}`;
    return {
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50),
      w: Math.round(b.width), x: Math.round(b.x),
      font: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      size: px(cs.fontSize),
      lh: cs.lineHeight === 'normal' ? 'normal' : px(cs.lineHeight),
      weight: cs.fontWeight,
      ch: Math.round(b.width / cv.measureText('0').width),
      color: cs.color,
    };
  };
  const isProse = (el) => (el.textContent || '').trim().length > 110 && el.getBoundingClientRect().width > 150;
  const prose = [...document.querySelectorAll('p, li')].filter(isProse).slice(0, 4).map(info);
  const heads = [...document.querySelectorAll('h1,h2,h3,h4')]
    .filter((el) => el.getBoundingClientRect().width > 50).slice(0, 6).map(info);

  // Distinct text roles = size|colour|weight combinations on leaf nodes. Six-plus in one answer is
  // the measurable form of "cluttered".
  const roles = new Set();
  document.querySelectorAll('main *, article *, body *').forEach((el) => {
    if (el.children.length) return;
    const t = (el.textContent || '').trim();
    if (t.length < 2) return;
    const b = el.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return;
    const cs = getComputedStyle(el);
    roles.add(`${px(cs.fontSize)}|${cs.color}|${cs.fontWeight}`);
  });

  return {
    url: location.href, title: document.title,
    vw: innerWidth, vh: innerHeight,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    prose, heads,
    textRoleCount: roles.size,
    textRoles: [...roles].sort((a, b) => parseFloat(a) - parseFloat(b)),
  };
};

const results = {};
const CHALLENGE = /Performing security verification|Just a moment|Verify you are human/i;

async function visit(name, url, { type, submit } = {}) {
  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext(MOBILE ? { ...devices['iPhone 14 Pro'] } : { viewport: { width: 1200, height: 729 } });
  const page = await ctx.newPage();
  const challenged = async () => CHALLENGE.test(await page.evaluate(() => document.body.innerText.slice(0, 400)));
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(10000);
    // The challenge is stochastic — a single reload clears it more often than not. Two tries, then
    // report `blocked` rather than measuring the interstitial and calling it a product.
    for (let i = 0; i < 2 && (await challenged()); i++) {
      await page.waitForTimeout(6000);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(10000);
    }
    if (type) {
      const box = page.locator('div.ProseMirror, [contenteditable="true"], textarea:visible').first();
      await box.click({ timeout: 20000 });
      await page.keyboard.type(type);
      if (submit !== false) await page.keyboard.press('Enter');
      await page.waitForTimeout(20000);
    }
    const shot = `${OUT}/bench-${name}${MOBILE ? '-mobile' : '-desktop'}.png`;
    await page.screenshot({ path: shot, animations: 'disabled', caret: 'hide' });
    const m = await page.evaluate(MEASURE);
    results[name] = (await challenged())
      ? {
          blocked: true,
          note: 'Cloudflare challenge survived 3 attempts. It is stochastic — just rerun. '
            + 'If it persists, try --headed, or drive the URL through the Playwright MCP browser, which passes. '
            + 'Measurement discarded rather than reporting the interstitial as a product.',
          shot,
        }
      : { ...m, shot };
  } catch (e) {
    results[name] = { error: String(e).slice(0, 300) };
  }
  await browser.close();
}

await visit('perplexity', `https://www.perplexity.ai/search?q=${encodeURIComponent(QUERY)}`);

if (CLAUDE_SHARE) {
  await visit('claude', CLAUDE_SHARE);
} else {
  results.claude = {
    skipped: true,
    note: 'No --claude <share url>. claude.ai/new redirects to /logout without a session; a read-only '
      + 'claude.ai/share/... page renders the real thread UI with no auth. Pass one to fill this row.',
  };
}

if (LOCAL) {
  // Local needs the signed-in cookie; reuse the e2e storage state if it is there.
  const STATE = path.join(process.cwd(), 'e2e/auth/state.json');
  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext({
    ...(MOBILE ? devices['iPhone 14 Pro'] : { viewport: { width: 1200, height: 729 } }),
    ...(fs.existsSync(STATE) ? { storageState: STATE } : {}),
  });
  const page = await ctx.newPage();
  await page.goto(LOCAL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  // A thread here is not URL-addressable — it is /home plus state. A fresh context lands on the
  // EMPTY home, which has no prose to measure, so open a persisted thread the way a creator would.
  const drawer = page.locator('[aria-label*="sidebar" i], [aria-label*="menu" i]').first();
  if (await drawer.count()) { await drawer.click(); await page.waitForTimeout(1200); }
  const row = page.locator('nav button').filter({ hasText: /hooks/i }).first();
  if (await row.count()) { await row.click(); await page.waitForTimeout(7000); }
  await page.screenshot({ path: `${OUT}/bench-virtuna${MOBILE ? '-mobile' : '-desktop'}.png`, animations: 'disabled', caret: 'hide' });
  results.virtuna = await page.evaluate(MEASURE);
  await browser.close();
}

const dest = path.join(OUT, `bench${MOBILE ? '-mobile' : '-desktop'}.json`);
fs.writeFileSync(dest, JSON.stringify(results, null, 2));

console.log(`\n${MOBILE ? 'MOBILE' : 'DESKTOP'} — body prose, first sample per product\n`);
for (const [name, r] of Object.entries(results)) {
  if (r.blocked || r.skipped || r.error) { console.log(`${name.padEnd(11)} — ${r.note || r.error}`); continue; }
  const p = r.prose?.[0];
  console.log(
    `${name.padEnd(11)} ${p ? `${p.size}px/${p.lh}  ${p.ch}ch  col ${p.w}px  ${p.font}` : 'no prose found'}`
    + `   textRoles:${r.textRoleCount}`,
  );
}
console.log(`\nfull: ${dest}\n`);
