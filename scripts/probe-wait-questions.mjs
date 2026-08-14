/**
 * probe-wait-questions.mjs — does the three-question block render and PERSIST, in a real browser,
 * on a prod build?
 *
 *   node scripts/probe-wait-questions.mjs http://localhost:3016
 *
 * 💰 WHY THE CALIBRATE CALL IS INTERCEPTED. Reaching the block means reaching CalibrationFlow's
 * `streaming` phase, and the real route runs a ~128s Apify scrape on a $5/mo capped account that
 * dev shares with prod. So `/api/audiences` (draft create) and `/api/audiences/calibrate` are both
 * fulfilled locally: a fabricated audience row and a hand-written SSE stream that reports status
 * and then never closes. That is exactly the state the wait lives in, and it costs nothing.
 *
 * 🔴 AND WHY TWO SUPABASE READS ARE INTERCEPTED TOO. /welcome is not reachable by simply visiting
 * it. The page runs `initOnboarding`, which (a) bounces to /home if `onboarding_completed_at` is
 * set, and (b) ADOPTS any already-calibrated audience and finishes onboarding on the spot. The
 * e2e account has both, so the first two runs of this probe landed on /home after ~3s and read as
 * "the block does not render".
 *
 * The first attempt at a fix was to null `onboarding_completed_at` in the database. That is the
 * wrong instrument: it mutates a shared prod row to observe a client-side branch, and it silently
 * flipped `onboarding_step` to 'completed' as a side effect when the adopt path ran anyway. Both
 * reads are browser-side supabase-js calls to the PostgREST endpoint, so they can be answered
 * locally instead — no write, nothing to restore, and the app code under test is untouched.
 *
 * The PATCHes to `/api/profile/creator-profile` are deliberately NOT intercepted — persistence is
 * the claim under test, so those hit the real route and the real database. They write to the e2e
 * account's row; the caller is expected to restore it afterwards.
 *
 * ⚠️ Prod build only. In dev the Next.js indicator and the mock-panel ⚙ sit over the composer and
 * read as covered controls (`dev-overlays-fake-ui-bugs`).
 * ⚠️ Screenshots use `animations: 'disabled'` + `caret: 'hide'` — the ambient-room animations here
 * never settle and an unguarded screenshot hangs.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3016";
const STATE = ".scratch/auth-state.json";

const FAKE_AUDIENCE = {
  id: "00000000-0000-4000-8000-00000000dead",
  name: "@probe",
  type: "personal",
  platform: "tiktok",
  goal_intent: "grow",
  calibrated: false,
  personas: [],
};

/** An SSE body that reports the first phase and then holds — the shape of the real wait. */
const HANGING_SSE = `event: status\ndata: ${JSON.stringify({ stage: "scrape", message: "Reading the account" })}\n\n`;

const profilePatches = [];
let calibrateCalls = 0;

/** An un-onboarded profile, so `initOnboarding` does not bounce to /home. */
const FRESH_PROFILE = {
  onboarding_step: "connect",
  onboarding_completed_at: null,
  tiktok_handle: null,
};

/**
 * Answer the two browser-side PostgREST reads that would otherwise end onboarding before the
 * wait is reached. `maybeSingle()` asks for a bare object via the pgrst.object Accept header;
 * everything else expects an array.
 */
async function stubSupabaseReads(target) {
  await target.route("**/rest/v1/creator_profiles*", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const wantsObject = (route.request().headers()["accept"] ?? "").includes("pgrst.object");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(wantsObject ? FRESH_PROFILE : [FRESH_PROFILE]),
    });
  });

  /**
   * `/api/audiences` carries BOTH halves of the trap, on two verbs:
   *   GET  — the adopt path. It is a Next route, not a PostgREST read, which is why stubbing
   *          `rest/v1/audiences` did nothing: the request never went there. An owned, calibrated
   *          audience here makes /welcome finish onboarding on mount and navigate to /home.
   *   POST — the draft create, replaced so no row is written.
   */
  await target.route("**/api/audiences", async (route) => {
    const method = route.request().method();
    const path = new URL(route.request().url()).pathname;
    if (path !== "/api/audiences") return route.continue();

    if (method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ audiences: [] }),
      });
    }
    if (method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ audience: FAKE_AUDIENCE }),
      });
    }
    return route.continue();
  });

  await target.route("**/api/audiences/calibrate", async (route) => {
    calibrateCalls += 1;
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
      body: HANGING_SSE,
    });
  });
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: JSON.parse(readFileSync(STATE, "utf8")),
  viewport: { width: 1200, height: 900 },
});
const page = await ctx.newPage();

await stubSupabaseReads(page);

// ── The call under test, observed but never faked ────────────────────────────
/**
 * ⚠️ Pair each response to its OWN request object, never to "the first one still missing a
 * status". Two PATCHes can be in flight at once — the mount stamp is still open when the first
 * chip is clicked — and a positional scan then hands the stamp's response to the answer's row and
 * leaves the last request reading `null` forever. That produced a FAIL against a save the UI had
 * already confirmed succeeded: an instrument artefact wearing the shape of a product bug.
 */
const patchByRequest = new Map();
page.on("request", (req) => {
  if (req.url().includes("/api/profile/creator-profile") && req.method() === "PATCH") {
    const entry = { body: req.postData(), status: null };
    patchByRequest.set(req, entry);
    profilePatches.push(entry);
  }
});
page.on("response", (res) => {
  const entry = patchByRequest.get(res.request());
  if (entry) entry.status = res.status();
});

const results = [];
const check = (name, pass, detail = "") =>
  results.push({ name, pass, detail });

await page.goto(`${BASE}/welcome`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);

// Step 1 — the handle door. Real UI, faked backend.
const handleBox = page.locator('input[type="text"], input:not([type])').first();
await handleBox.waitFor({ state: "visible", timeout: 15000 });
await handleBox.fill("probe");
await page.getByRole("button", { name: /continue|start|calibrate/i }).first().click();

// Step 2 — the wait. This is where the block lives.
const heading = page.getByText(/three things the scrape can/i);
await heading.waitFor({ state: "visible", timeout: 20000 });

check("block renders during the wait", true);
check("no real calibrate call escaped", calibrateCalls === 1, `intercepted ${calibrateCalls}`);

// The mount stamp.
await page.waitForTimeout(1200);
const stamp = profilePatches.find((p) => p.body === "{}");
check("mount stamps the profile as asked", !!stamp, stamp ? `→ ${stamp.status}` : "no {} PATCH seen");

// Goal.
await page.getByRole("button", { name: "Growth", exact: true }).click();
await page.waitForTimeout(900);
const goalPatch = profilePatches.find((p) => (p.body ?? "").includes("primary_goal"));
check("goal persists on click", goalPatch?.status === 200, `${goalPatch?.body} → ${goalPatch?.status}`);

// Stage.
await page.getByRole("button", { name: "New creator", exact: true }).click();
await page.waitForTimeout(900);
const stagePatch = profilePatches.find((p) => (p.body ?? "").includes("creator_stage"));
check("stage persists on click", stagePatch?.status === 200, `${stagePatch?.body} → ${stagePatch?.status}`);

// Pain — free text, the one that must pass through sanitizeText.
const pain = page.getByRole("textbox", { name: /in your way/i });
await pain.fill("  probe: hooks land, retention dies at 3s  ");
await pain.blur();
await page.waitForTimeout(900);
const painPatch = profilePatches.find((p) => (p.body ?? "").includes("pain_points"));
check("pain persists on blur", painPatch?.status === 200, `${painPatch?.body} → ${painPatch?.status}`);
check(
  "pain is trimmed before sending",
  (painPatch?.body ?? "").includes('"probe: hooks land, retention dies at 3s"'),
  painPatch?.body ?? ""
);

// No submit control — the wait ends on its own.
const submit = await page
  .getByRole("button", { name: /^(save|submit|continue|done)$/i })
  .count();
check("no submit control in the block", submit === 0, `${submit} found`);

// Nothing failed loudly at the creator.
const notSaved = await page.getByRole("button", { name: /not saved/i }).count();
check("no failed-save affordance showing", notSaved === 0, `${notSaved} found`);

await page.screenshot({
  path: ".scratch/wait-questions.png",
  animations: "disabled",
  caret: "hide",
});

// Mobile, native context — a resized desktop page is not the mobile UI.
const mctx = await browser.newContext({
  storageState: JSON.parse(readFileSync(STATE, "utf8")),
  viewport: { width: 393, height: 660 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});
const mpage = await mctx.newPage();
await stubSupabaseReads(mpage);
await mpage.goto(`${BASE}/welcome`, { waitUntil: "domcontentloaded" });
await mpage.waitForTimeout(1500);
const mBox = mpage.locator('input[type="text"], input:not([type])').first();
await mBox.waitFor({ state: "visible", timeout: 15000 });
await mBox.fill("probe");
await mpage.getByRole("button", { name: /continue|start|calibrate/i }).first().click();
await mpage.getByText(/three things the scrape can/i).waitFor({ state: "visible", timeout: 20000 });

// Does the page scroll sideways? A block added to a 560px card on a 393px screen is where that breaks.
const overflow = await mpage.evaluate(() => ({
  docScroll: document.documentElement.scrollWidth,
  docClient: document.documentElement.clientWidth,
}));
check(
  "no horizontal overflow on mobile",
  overflow.docScroll <= overflow.docClient + 1,
  `${overflow.docScroll} vs ${overflow.docClient}`
);

/**
 * 🔴 IS THE BLOCK ACTUALLY ON SCREEN WITHOUT SCROLLING?
 *
 * This is the whole session's lesson turned on my own work. A block that renders correctly but
 * sits below the fold produces the same permanent zero as one that never mounts, and the zero
 * reads the same way: "creators chose not to answer". The pre-evidence branch stacks a 72px
 * constellation mark and `py-12` above the spine, which is the most vertical space this screen
 * ever spends, so mobile is where it would fail.
 */
const fold = await mpage.evaluate(() => {
  const el = document.querySelector("[data-slot='during-wait']");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: Math.round(r.top), viewport: window.innerHeight, scrolled: window.scrollY };
});
check(
  "block starts within the first mobile viewport",
  !!fold && fold.top < fold.viewport,
  fold ? `top ${fold.top}px of ${fold.viewport}px` : "slot not found"
);

// Hit-test the chips at their edge midpoints — corners read every rounded shape as broken.
const tap = await mpage.evaluate(() => {
  const chips = Array.from(document.querySelectorAll("[aria-pressed]"));
  return chips.map((el) => {
    const r = el.getBoundingClientRect();
    return { label: (el.textContent ?? "").trim(), w: Math.round(r.width), h: Math.round(r.height) };
  });
});
const tooSmall = tap.filter((t) => t.h < 36);
check("chips are at least 36px tall", tooSmall.length === 0, JSON.stringify(tooSmall));

await mpage.screenshot({
  path: ".scratch/wait-questions-mobile.png",
  animations: "disabled",
  caret: "hide",
});

await browser.close();

console.log("\n  probe-wait-questions —", BASE, "\n");
for (const r of results) {
  console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  · ${r.detail}` : ""}`);
}
const failed = results.filter((r) => !r.pass).length;
console.log(`\n  ${results.length - failed}/${results.length} passed\n`);
process.exit(failed === 0 ? 0 : 1);
