/**
 * C5 — the video Test, upload path. The one skill skill.mjs cannot drive
 * because the input is a FILE, not a prompt.
 *
 *   node c5-test.mjs <absolute-path-to-video> [maxWaitMs]
 *
 * Verifies the D-05 contract: stage to storage → stream (~83s pipeline) →
 * on complete POST /api/tools/test/card → card lands IN-THREAD, no
 * navigate-out. A router.push to /analyze/[id] is the degrade fallback and
 * gets recorded as such, not as success.
 *
 * Polls instead of one long sleep: the dev server has died on video-bearing
 * runs before (2GB heap), and Chrome's ERR_CONNECTION_REFUSED shell reads
 * exactly like an empty UI — so every tick also probes :3040 from Node.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/Users/davideloreti/virtuna-e2e-audit/");
const { chromium } = require("@playwright/test");

const [videoPath, waitArg] = process.argv.slice(2);
const MAX_WAIT = Number(waitArg || 300000);
const B = "http://localhost:3040";
const SHOTS = "/Users/davideloreti/virtuna-e2e-audit/.scratch/audit/shots";

if (!videoPath || !fs.existsSync(videoPath)) {
  console.error("usage: node c5-test.mjs <video> [maxWaitMs]");
  process.exit(1);
}

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts()[0].pages()[0];
await page.setViewportSize({ width: 1440, height: 900 });

const calls = [];
page.on("request", (req) => {
  const u = req.url();
  const api = u.includes("/api/") && req.method() !== "GET";
  const storage = u.includes("supabase") && u.includes("/storage/") && req.method() !== "GET";
  if (!api && !storage) return;
  let b = null; try { b = req.postData(); } catch {}
  calls.push({ t: Date.now(), url: u.replace(B, ""), method: req.method(), body: b ? b.slice(0, 200) : null });
});
const responses = [];
page.on("response", (res) => {
  const u = res.url();
  if (u.includes("/api/analyze") || u.includes("/api/tools/") || (u.includes("supabase") && u.includes("/storage/") && res.request().method() !== "GET")) {
    responses.push({ t: Date.now(), url: u.replace(B, ""), status: res.status() });
  }
});

await page.goto(B + "/home", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
await page.locator('button:has-text("New Thread")').first().click().catch(() => {});
await page.waitForTimeout(3500);

// arm Video test — by DESCRIPTION (the Start-view tile trap, F-017)
const pill = page.locator('button[aria-label^="Skill:"]').first();
await pill.click().catch(() => {});
await page.waitForTimeout(1200);
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('button,[role="menuitem"],[role="option"]')];
  const norm = (s) => (s || "").trim().replace(/\s+/g, " ").replace(/[’']/g, "'");
  const hit = rows.find((el) => norm(el.textContent).includes("Watch-through + full Read"));
  if (!hit) return null;
  hit.click();
  return norm(hit.textContent).slice(0, 60);
});
await page.waitForTimeout(1800);
const armed = (await pill.textContent().catch(() => ""))?.trim();
console.log(`skill row clicked: ${JSON.stringify(picked)}`);
console.log(`skill armed: "${armed}"`);
// Label renamed on main (2026-07-2x): "Video test" → "A real video"
// (composer-controls.tsx: id "test", desc "Watch-through + full Read", model Max).
if ((armed || "").toLowerCase() !== "a real video") {
  console.log("  ⚠ ARMING FAILED — aborting before staging a file");
  await browser.close();
  process.exit(1);
}

// stage the file on the VideoUpload input (accept="video/*"; the evidence
// input accepts .txt/.md/image/* too — match the exact accept attr)
const fileInput = page.locator('input[type="file"][accept="video/*"]');
console.log(`video inputs mounted: ${await fileInput.count()}`);
await fileInput.first().setInputFiles(videoPath);
await page.waitForTimeout(2500);
const staged = await page.evaluate(() => {
  const t = document.body.innerText;
  const m = t.match(/[^\n]*\.(mp4|mov)[^\n]*/i);
  return m ? m[0].trim().slice(0, 80) : null;
});
console.log(`staged chip: ${JSON.stringify(staged)}`);

// send — same fixed-6-up walk as skill.mjs
const sendInfo = await page.evaluate(() => {
  const pill = [...document.querySelectorAll("button")].find((el) => (el.getAttribute("aria-label") || "").startsWith("Skill:"));
  if (!pill) return null;
  let box = pill;
  for (let i = 0; i < 6 && box.parentElement; i++) box = box.parentElement;
  const send = [...box.querySelectorAll("button")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && !/dev mock/i.test(el.getAttribute("aria-label") || "") && (el.textContent || "").trim() !== "⚙";
    })
    .sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left)[0];
  if (!send) return null;
  send.setAttribute("data-audit-send", "1");
  return { label: send.getAttribute("aria-label"), text: (send.textContent || "").trim().slice(0, 30), disabled: send.hasAttribute("disabled") };
});
console.log(`send button: ${JSON.stringify(sendInfo)}`);
const t0 = Date.now();
await page.locator('[data-audit-send="1"]').first().click().catch(() => {});

// poll: seal POST seen? navigated out? server dead? failure copy?
const timeline = [];
let outcome = "timeout";
while (Date.now() - t0 < MAX_WAIT) {
  await page.waitForTimeout(5000);
  const alive = await fetch(B + "/api/health").then((r) => true).catch(() =>
    fetch(B).then(() => true).catch(() => false));
  const url = page.url();
  const sealResp = responses.find((r) => r.url.includes("/api/tools/test/card"));
  const snap = await page.evaluate(() => {
    const txt = document.body.innerText || "";
    return {
      phase: (txt.match(/(Reading the video|Watching|Scoring|Building|Analyzing|Uploading)[^\n]{0,60}/i) || [null])[0],
      failure: (txt.match(/[^\n]*(couldn'?t read that video|is unavailable|went wrong|please try again|we hit an error)[^\n]*/i) || [null])[0],
    };
  }).catch(() => ({ phase: "(page gone)", failure: null }));
  timeline.push({ s: Math.round((Date.now() - t0) / 1000), alive, url: url.replace(B, ""), seal: sealResp?.status ?? null, ...snap });
  if (!alive) { outcome = "SERVER DIED"; break; }
  if (url.includes("/analyze/")) { outcome = "NAVIGATED OUT (degrade fallback)"; break; }
  if (sealResp) {
    outcome = `sealed (card POST → ${sealResp.status})`;
    await page.waitForTimeout(8000); // let reloadChatThread surface the card
    break;
  }
  if (snap.failure) { outcome = `failure copy: ${snap.failure.trim().slice(0, 80)}`; break; }
}
const elapsed = Math.round((Date.now() - t0) / 1000);

// what rendered
const state = await page.evaluate(() => {
  const txt = document.body.innerText || "";
  return {
    url: location.pathname,
    chars: txt.replace(/\s+/g, " ").trim().length,
    cardHints: (txt.match(/[^\n]*(verdict|watch-through|retention|director|fix|hook strength|scroll-stop)[^\n]*/gi) || []).slice(0, 8).map((s) => s.trim().slice(0, 100)),
    degraded: /(is unavailable|went wrong|please try again|couldn'?t (generate|load|fetch|complete|read)|unable to (generate|load|fetch)|failed to (generate|load|fetch)|we hit an error)/i.test(txt),
    ctas: [...document.querySelectorAll("button")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.height; })
      .map((el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 45))
      .filter((t) => /→|Save|Copy|Simulate|Write|Open|View|Retry/i.test(t))
      .slice(0, 12),
  };
}).catch(() => null);

await page.addStyleTag({ content: `*{caret-color:transparent!important}` }).catch(() => {});
await page.screenshot({ path: `${SHOTS}/c5-video-test.png`, animations: "disabled", caret: "hide", scale: "css" }).catch(() => {});

console.log(`\noutcome: ${outcome}  (~${elapsed}s)`);
console.log("timeline:"); timeline.forEach((x) => console.log(`   ${String(x.s).padStart(3)}s alive=${x.alive} seal=${x.seal ?? "-"} ${x.url} ${x.phase ? "| " + x.phase.trim().slice(0, 50) : ""}${x.failure ? " | FAIL: " + x.failure.trim().slice(0, 60) : ""}`));
console.log("api calls:"); calls.filter((c) => c.url.includes("/api/") || c.url.includes("storage")).forEach((c) => console.log(`   +${Math.round((c.t - t0) / 1000)}s ${c.method} ${c.url.slice(0, 110)}`));
console.log("responses:"); responses.forEach((r) => console.log(`   +${Math.round((r.t - t0) / 1000)}s ${r.status} ${r.url.slice(0, 110)}`));
console.log("state:", JSON.stringify(state, null, 2));
fs.writeFileSync(`${SHOTS}/c5-video-test.json`, JSON.stringify({ videoPath, outcome, elapsed, timeline, calls, responses, state }, null, 2));
await browser.close();
