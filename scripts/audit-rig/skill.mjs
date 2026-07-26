/**
 * Act C — run ONE skill in-thread and report what actually came back.
 *
 *   node skill.mjs <skillLabel> "<prompt>" [waitMs]
 *
 * Captures: the POST payload, the block types the run persisted, any degraded/
 * error surface, and the visible follow-up CTAs. A skill that 200s but persists
 * nothing is the failure mode this station exists to catch.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/Users/davideloreti/virtuna-e2e-audit/");
const { chromium } = require("@playwright/test");

const [skillLabel, prompt, waitArg] = process.argv.slice(2);
const WAIT = Number(waitArg || 45000);
const B = "http://localhost:3040";
const OUT = "/private/tmp/claude-501/-Users-davideloreti-virtuna-v1-1/4d48ffc0-95c8-4345-894e-b6e39e476f1/scratchpad/shots".replace("e476f1", "e476f1");
const SHOTS = "/Users/davideloreti/virtuna-e2e-audit/.scratch/audit/shots";

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts()[0].pages()[0];
await page.setViewportSize({ width: 1440, height: 900 });

const calls = [];
page.on("request", (req) => {
  const u = req.url();
  if (!u.includes("/api/") || req.method() === "GET") return;
  let b = null; try { b = req.postData(); } catch {}
  calls.push({ url: u.replace(B, ""), body: b });
});
const responses = [];
page.on("response", (res) => {
  const u = res.url();
  if (u.includes("/api/tools/")) responses.push({ url: u.replace(B, ""), status: res.status() });
});

await page.goto(B + "/home", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
await page.locator('button:has-text("New Thread")').first().click().catch(() => {});
await page.waitForTimeout(3500);

// arm the skill
const pill = page.locator('button[aria-label^="Skill:"]').first();
await pill.click().catch(() => {});
await page.waitForTimeout(1200);
// The menu rows read "IdeasConcepts worth making" — match on the row STARTING
// with the label, not merely containing it (":has-text" matched the wrong node
// and silently left Chat armed on the first attempt).
// Match the EXACT menu row (label+description). Matching on "starts with the
// label" hit a sidebar THREAD TITLE that began with "ideas" and silently left
// Chat armed — twice. The rows carry their description, so use it as the key.
// Match the skill-MENU row by its DESCRIPTION, never the label. The Start-view
// artifact tile renders nearly the same string ("IdeasConcepts worth making" vs
// the menu's "IdeasFunnel-top idea cards"), and a sidebar thread title starting
// "ideas…" outranks both on a label match. The two doors are NOT equivalent —
// the tile is F-017-broken for Ideas — so the driver must pick deliberately.
const ROW = {
  Ideas: "Funnel-top idea cards",
  Hooks: "Ranked scroll-stoppers",
  Script: "Beats + retention markers",
  Remix: "Decode a winner",
  Explore: "Find what's working",
  "Account teardown": "A Read on your posts",
  "Video test": "Watch-through + full Read",
};
const picked = await page.evaluate((desc) => {
  const rows = [...document.querySelectorAll('button,[role="menuitem"],[role="option"]')];
  const norm = (s) => (s || "").trim().replace(/\s+/g, " ").replace(/[’']/g, "'");
  const hit = rows.find((el) => norm(el.textContent).includes(norm(desc)));
  if (!hit) return null;
  hit.click();
  return norm(hit.textContent).slice(0, 60);
}, ROW[skillLabel] || skillLabel);
await page.waitForTimeout(1800);
const armed = (await pill.textContent().catch(() => ""))?.trim();
console.log(`skill row clicked: ${JSON.stringify(picked)}`);
console.log(`skill armed: "${armed}" (asked for "${skillLabel}")`);
if ((armed || "").toLowerCase() !== skillLabel.toLowerCase()) {
  console.log(`  ⚠ ARMING FAILED — results below are NOT ${skillLabel}`);
}

// send
const ta = page.locator("textarea").first();
await ta.click().catch(() => {});
await ta.fill(prompt).catch(() => {});
await page.waitForTimeout(600);
// Scope send to the COMPOSER ROW, not the whole page: a bare aria-label match
// grabbed the "Test a video" artifact tile and fired nothing. The send disc is
// the button sharing the model pill's row (same y band), furthest right.
// A y-band around the model pill caught a card's disabled "Simulate" CTA at the
// same height. Use DOM CONTAINMENT instead: walk up from the model pill until
// the ancestor also contains the textarea — that ancestor IS the composer — then
// take its rightmost non-⚙ button.
const sendInfo = await page.evaluate(() => {
  // Walk a FIXED number of levels up from the skill pill. The earlier
  // "walk until it contains the textarea" version silently short-circuited
  // when the textarea was absent and reported an unrelated card CTA.
  const pill = [...document.querySelectorAll("button")].find((el) => (el.getAttribute("aria-label") || "").startsWith("Skill:"));
  const ta = document.querySelector("textarea");
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
  return {
    label: send.getAttribute("aria-label"),
    text: (send.textContent || "").trim().slice(0, 30),
    disabled: send.hasAttribute("disabled"),
    textareaValue: ta ? ta.value.slice(0, 60) : "(no textarea)",
  };
});
console.log(`send button: ${JSON.stringify(sendInfo)}`);
const t0 = Date.now();
await page.locator('[data-audit-send="1"]').first().click().catch(() => {});
await page.waitForTimeout(WAIT);
const elapsed = Math.round((Date.now() - t0) / 1000);

// what rendered
const state = await page.evaluate(() => {
  const txt = document.body.innerText || "";
  return {
    chars: txt.replace(/\s+/g, " ").trim().length,
    // Tightened: the first pass flagged "Prediction Error" — a legitimate
    // mechanism name in hook copy — as a degraded run. Match failure PHRASES,
    // never a bare "error"/"failed" that generated copy can legally contain.
    degraded: /(is unavailable|went wrong|please try again|couldn'?t (generate|load|fetch|complete)|unable to (generate|load|fetch)|no results found|failed to (generate|load|fetch)|we hit an error|scrape (failed|unavailable))/i.test(txt),
    degradedSnippets: (txt.match(/[^\n]*(is unavailable|went wrong|please try again|couldn'?t (generate|load|fetch|complete)|unable to (generate|load|fetch)|no results found|failed to (generate|load|fetch)|we hit an error|scrape (failed|unavailable))[^\n]*/gi) || []).slice(0, 4),
    ctas: [...document.querySelectorAll("button")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.height; })
      .map((el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 45))
      .filter((t) => /→|Save|Copy|Simulate|Write|Open|View|Retry/i.test(t))
      .slice(0, 12),
  };
});

await page.addStyleTag({ content: `*{caret-color:transparent!important}` }).catch(() => {});
const slug = `c-${skillLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
await page.screenshot({ path: `${SHOTS}/${slug}.png`, animations: "disabled", caret: "hide", scale: "css" }).catch(() => {});

const toolCalls = calls.filter((c) => c.url.includes("/tools/"));
console.log(`\nelapsed ~${elapsed}s`);
console.log("payloads:"); toolCalls.forEach((c) => console.log(`   ${c.url}  ${(c.body || "").slice(0, 300)}`));
console.log("responses:"); responses.forEach((r) => console.log(`   ${r.status} ${r.url}`));
console.log(`degraded surface: ${state.degraded}`);
state.degradedSnippets.forEach((s) => console.log(`   ! ${s.trim().slice(0, 120)}`));
console.log("CTAs:", JSON.stringify(state.ctas));
fs.writeFileSync(`${SHOTS}/${slug}.json`, JSON.stringify({ skillLabel, armed, prompt, elapsed, toolCalls, responses, state }, null, 2));
await browser.close();
