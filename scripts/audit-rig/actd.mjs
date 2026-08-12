/**
 * Act D — in-thread UX. One pass, no new paid runs.
 *
 *   node actd.mjs
 *
 * D6a open a rich thread from the sidebar · D2/D3 card + CTA dump ·
 * D4 reload + order re-dump · D5 draft survival on skill switch ·
 * D6b delete a throwaway thread.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/Users/davideloreti/virtuna-e2e-audit/");
const { chromium } = require("@playwright/test");

const B = "http://localhost:3040";
const SHOTS = "/Users/davideloreti/virtuna-e2e-audit/.scratch/audit/shots";
const out = { steps: [] };

const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts()[0].pages()[0];
await page.setViewportSize({ width: 1440, height: 900 });

const snap = async (slug) => {
  await page.addStyleTag({ content: `*{caret-color:transparent!important}` }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/${slug}.png`, animations: "disabled", caret: "hide", scale: "css" }).catch(() => {});
};
const dumpThread = () =>
  page.evaluate(() => {
    const txt = document.body.innerText || "";
    // visible cards in DOM order: any element with a data-block or article/section card shape is
    // too loose — walk headings + known card copy instead. Keep it factual: text landmarks.
    const landmarks = txt.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 60);
    const ctas = [...document.querySelectorAll("button,a")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.height; })
      .map((el) => ({ t: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 45), tag: el.tagName, href: el.getAttribute("href") }))
      .filter((x) => /→|Save|Copy|Simulate|Write|Open|View|Retry|Test|Develop|Remix/i.test(x.t) && x.t.length < 45);
    return { chars: txt.length, landmarks: landmarks.slice(0, 40), ctas: ctas.slice(0, 16) };
  });

// ── D6a: open "indie hackers" (explore thread) from the sidebar ─────────────
await page.goto(B + "/home", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(5000);
const opened = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("aside button, nav button, [class*=sidebar] button")];
  const hit = rows.find((el) => (el.textContent || "").trim().startsWith("indie hackers"));
  if (!hit) return null;
  hit.click();
  return (hit.textContent || "").trim().slice(0, 40);
});
await page.waitForTimeout(6000);
out.steps.push({ step: "D6a-open", opened, ...(await dumpThread()) });
await snap("d6-open-explore");

// ── D4: reload the same thread, re-dump ─────────────────────────────────────
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
out.steps.push({ step: "D4-reload", url: page.url().replace(B, ""), ...(await dumpThread()) });
await snap("d4-reload-explore");

// ── D6a2 + D4 on a MIXED/script thread ──────────────────────────────────────
const opened2 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("aside button, nav button, [class*=sidebar] button")];
  const hit = rows.find((el) => (el.textContent || "").trim().startsWith("a 30 second script"));
  if (!hit) return null;
  hit.click();
  return (hit.textContent || "").trim().slice(0, 40);
});
await page.waitForTimeout(6000);
out.steps.push({ step: "D6a-open-script", opened: opened2, ...(await dumpThread()) });
await snap("d6-open-script");
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
out.steps.push({ step: "D4-reload-script", ...(await dumpThread()) });
await snap("d4-reload-script");

// ── D3: free CTAs on the script card — Copy script (clipboard) + Test this script → (arms) ──
const d3 = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")].filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.height; });
  const find = (re) => btns.find((el) => re.test((el.textContent || "").trim()));
  const copy = find(/^Copy script/);
  const test = find(/^Test this script/);
  return { copyPresent: !!copy, testPresent: !!test };
});
const testCta = page.locator('button:has-text("Test this script")').first();
let d3After = null;
if (await testCta.count()) {
  await testCta.click().catch(() => {});
  await page.waitForTimeout(2500);
  d3After = await page.evaluate(() => {
    const pill = [...document.querySelectorAll("button")].find((el) => (el.getAttribute("aria-label") || "").startsWith("Skill:"));
    const txt = document.body.innerText || "";
    const brief = (txt.match(/[^\n]*(Testing|brief|from your script)[^\n]*/i) || [null])[0];
    return { armed: pill ? pill.textContent.trim() : null, brief: brief ? brief.trim().slice(0, 90) : null, url: location.pathname };
  });
}
out.steps.push({ step: "D3-script-ctas", ...d3, afterTestCta: d3After });
await snap("d3-script-test-cta");

// ── D5: draft survival — type, switch skill, read back ──────────────────────
const ta = page.locator("textarea").first();
await ta.click().catch(() => {});
await ta.fill("draft that must survive a skill switch").catch(() => {});
await page.waitForTimeout(500);
const pill = page.locator('button[aria-label^="Skill:"]').first();
await pill.click().catch(() => {});
await page.waitForTimeout(1000);
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('button,[role="menuitem"],[role="option"]')];
  const norm = (s) => (s || "").trim().replace(/\s+/g, " ");
  const hit = rows.find((el) => norm(el.textContent).includes("Ranked scroll-stoppers"));
  if (hit) hit.click();
});
await page.waitForTimeout(1500);
const d5 = await page.evaluate(() => {
  const ta = document.querySelector("textarea");
  const pill = [...document.querySelectorAll("button")].find((el) => (el.getAttribute("aria-label") || "").startsWith("Skill:"));
  return { armed: pill ? pill.textContent.trim() : null, draft: ta ? ta.value : "(no textarea)" };
});
out.steps.push({ step: "D5-draft-survival", ...d5 });

// ── D6b: delete a throwaway thread (the "give me 3 hooks" one) ──────────────
const del = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("aside button, nav button, [class*=sidebar] button")];
  const row = rows.find((el) => (el.textContent || "").trim().startsWith("give me 3 hooks"));
  if (!row) return { found: false };
  // surface the row's hover affordance: look for a kebab/trash INSIDE the row or its parent
  const scope = row.closest("li") || row.parentElement;
  const buttons = [...(scope?.querySelectorAll("button") ?? [])].map((b) => ({
    label: b.getAttribute("aria-label"), text: (b.textContent || "").trim().slice(0, 20),
  }));
  return { found: true, rowButtons: buttons };
});
out.steps.push({ step: "D6b-delete-probe", ...del });

console.log(JSON.stringify(out, null, 2));
fs.writeFileSync(`${SHOTS}/actd.json`, JSON.stringify(out, null, 2));
await browser.close();
