/**
 * probe-attribution-rate.mjs — receipt rate + receipt fidelity through the REAL chat route.
 *
 * Gate for docs/superpowers/specs/2026-08-16-grounded-attribution-design.md: aggregate ≥70%
 * of hook cards carry a receipt across these sends. Counts blocks off the SSE (emit_card can
 * land in a later round than prose — read the stream to completion, never poll the DOM).
 * Each send opens a NEW thread (maven_active_thread=__new__) or N sends are ONE conversation.
 *
 *   node scripts/probe-attribution-rate.mjs "http://localhost:3001"
 *
 * Cost: authorized sends reach Apify (~$0.11 each). Pre-flight the account cap first.
 * ⚠️ Pre-flight auth for FREE first: POST this route with `ask:""` — auth/CSRF/rate-limit all run
 * before body validation, so a 400 proves the session is live without spending a send.
 *
 * ⚠️ The receipt rate this prints is counted off the WIRE — the cards that actually shipped.
 * The server's `[attribution] hooks: kept k/n` line counts attribution DECISIONS over ranked
 * candidates, not shipped cards, so the two denominators legitimately differ. Do not conflate them.
 *
 * ⚠️ `outlier_teardowns` has NO `handle` column — it is `creator_handle` (measured against the
 * live table 2026-08-16). PostgREST answers an unknown column with 400, which a bare `!r.ok →
 * null` would render indistinguishable from "no row for this URL" and quietly report every
 * fidelity check as a not-yet-written-back fresh scrape. teardownByUrl therefore returns a
 * tagged result and the report records a query failure AS a failure.
 *
 * EVERY absence here is tagged, because this probe exists to license a claim and an untagged
 * absence is how a broken measurement passes for a good one:
 *   - a send that fails (HTTP, throw, or an in-stream `error`/`credit-wall` frame under HTTP 200)
 *     is recorded with its reason and does NOT silently shrink the denominator;
 *   - 0 shipped cards overall prints "no measurement — no verdict", never FAIL (a credit-walled
 *     0/0 is an unrun probe, not a failed gate);
 *   - a template comparison with an empty side is `null`/unmeasurable, never a match (two nulls
 *     normalize equal and would otherwise score as fidelity CONFIRMED).
 * The raw SSE of every send is dumped, and the report is rewritten after EVERY ask, so a throw on
 * ask 5 cannot discard four paid sends.
 */
import { readFileSync, writeFileSync } from "node:fs";

const base = process.argv[2] || "http://localhost:3001";
const ASKS = [
  "give me 3 hooks for my new video about an AI platform that simulates how your audience reacts before you post",
  "3 hooks for my video about high protein breakfasts for busy people",
  "give me 3 hooks for a video about why most runners train their easy days too hard",
  "3 hooks for my video on negotiating a raise without threatening to quit",
  "give me 3 hooks about restoring a 1970s film camera I found at a flea market",
  "3 hooks for a video about how I grew a balcony vegetable garden in a rental",
];

/** Run-scoped stamp — a rerun never overwrites a previous run's paid evidence. */
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const REPORT_PATH = `.scratch/attribution-report-${RUN_ID}.json`;

const state = JSON.parse(readFileSync(".scratch/auth-state.json", "utf8"));
const authCookie = state.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      // Strip surrounding quotes, as mint-auth-state.mjs does — a quoted key otherwise
      // travels into the Authorization header with its quotes and 401s.
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Split an SSE body into {event, data} frames. Event-aware on purpose: `error` and `credit-wall`
 * frames arrive under HTTP 200, so a status check alone reports a refused send as a clean 0-card one.
 */
function parseFrames(sse) {
  const frames = [];
  let event = null;
  for (const line of sse.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      let data = null;
      try {
        data = JSON.parse(line.slice(5));
      } catch {
        /* non-JSON data line */
      }
      frames.push({ event, data });
    } else if (line.trim() === "") {
      event = null; // frame boundary
    }
  }
  return frames;
}

function* walk(node) {
  if (node && typeof node === "object") {
    if (node.type === "hook-card" && node.props) yield node.props;
    for (const v of Object.values(node)) yield* walk(v);
  }
}

function extractHookCards(frames) {
  const out = [];
  for (const f of frames) for (const p of walk(f.data)) out.push(p);
  return out;
}

/** In-stream failure frames (HTTP 200) — the reason a send yielded nothing. */
function streamFailure(frames) {
  const err = frames.find((f) => f.event === "error");
  if (err) return `error frame: ${err.data?.message ?? "(no message)"}`;
  const wall = frames.find((f) => f.event === "credit-wall");
  if (wall) return `credit-wall frame: ${JSON.stringify(wall.data?.quota ?? null).slice(0, 200)}`;
  return null;
}

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Compare two hook templates. Returns null — UNMEASURABLE — when either side is empty, because
 * norm(null) === norm("") === "" and two absences would otherwise score as a confirmed match.
 */
function templateMatch(cardTemplate, rowTemplate) {
  const a = norm(cardTemplate);
  const b = norm(rowTemplate);
  if (!a || !b) return null;
  return a === b;
}

/** → {ok:true,row}|{ok:true,row:null} (no such video) | {ok:false,error} (the QUERY broke). */
async function teardownByUrl(videoUrl) {
  const q = `${SB}/rest/v1/outlier_teardowns?video_url=eq.${encodeURIComponent(videoUrl)}&select=id,creator_handle,hook_template,spoken_hook,video_url`;
  const r = await fetch(q, { headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) return { ok: false, error: `${r.status} ${(await r.text()).slice(0, 200)}` };
  return { ok: true, row: (await r.json())[0] ?? null };
}

/** Everything the summary needs, recomputed from whatever has been measured SO FAR. */
function summarize(runs) {
  const all = runs.flatMap((r) => r.cards ?? []);
  const kept = all.filter((c) => c.kept).length;
  const rate = all.length ? kept / all.length : 0;
  return {
    runId: RUN_ID,
    asksAttempted: runs.length,
    asksTotal: ASKS.length,
    asksFailed: runs.filter((r) => r.failure).length,
    asksZeroCards: runs.filter((r) => (r.cards ?? []).length === 0).length,
    total: all.length,
    kept,
    rate,
    // 0 cards = the probe never ran, not a failed gate. Never let a credit wall print FAIL.
    verdict: all.length === 0 ? "NO-MEASUREMENT" : rate >= 0.7 ? "PASS" : "FAIL",
    seedDups: all.filter((c) => c.seedDup).length,
    mismatches: all.filter((c) => c.fidelity?.templateMatchesRow === false).length,
    unmeasurable: all.filter((c) => c.kept && c.fidelity?.templateMatchesRow !== true && c.fidelity?.templateMatchesRow !== false).length,
    lookupErrors: all.filter((c) => c.fidelity?.queryError).length,
  };
}

const runs = [];
const flush = () => writeFileSync(REPORT_PATH, JSON.stringify({ ...summarize(runs), runs }, null, 2));

for (const [i, ask] of ASKS.entries()) {
  process.stdout.write(`\n[${i + 1}/${ASKS.length}] ${ask.slice(0, 60)}…\n`);
  const run = { ask, status: null, cards: [], failure: null, warnings: null };
  runs.push(run);

  try {
    const res = await fetch(`${base}/api/tools/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${authCookie}; maven_active_thread=__new__`,
      },
      body: JSON.stringify({ ask, platform: "tiktok" }),
    });
    run.status = res.status;
    if (res.status === 401) {
      console.error("401 — auth state is stale. Run: node scripts/mint-auth-state.mjs, then re-run.");
      flush();
      process.exit(1);
    }
    const sse = await res.text();

    // Always keep the raw wire — this send cost money and it is the only re-parseable evidence.
    const rawPath = `.scratch/attribution-raw-${RUN_ID}-${i + 1}.sse`;
    writeFileSync(rawPath, sse);

    const frames = parseFrames(sse);
    run.failure = res.ok ? streamFailure(frames) : `HTTP ${res.status}: ${sse.slice(0, 200)}`;
    const warn = frames.find((f) => f.event === "warning");
    if (warn) run.warnings = warn.data?.warnings ?? null;

    const cards = extractHookCards(frames);
    if (run.failure) console.warn(`  ⚠ send failed — ${run.failure}`);
    if (cards.length === 0) {
      console.warn(`  0 hook-cards parsed (status ${res.status}) — raw SSE at ${rawPath}`);
    }

    for (const c of cards) {
      const kept = Boolean(c.proof && c.proof.handle);
      const seedDup = Boolean(c.seedHook) && norm(c.seedHook) === norm(c.hookLine);
      let fidelity = null;
      if (kept && !c.proof.videoUrl) {
        // A receipt with no source URL cannot be cross-checked at all — say so explicitly.
        fidelity = { state: "no-videoUrl", rowId: null, templateMatchesRow: null, rowSpokenHook: null, queryError: null };
      } else if (kept) {
        const q = await teardownByUrl(c.proof.videoUrl);
        if (!q.ok) {
          // A broken query is NOT evidence about the row. Say so, loudly, instead of scoring it.
          fidelity = { state: "query-error", queryError: q.error, rowId: null, templateMatchesRow: null, rowSpokenHook: null };
          console.warn(`  ⚠ teardown lookup failed: ${q.error}`);
        } else if (q.row) {
          fidelity = {
            state: "resolved",
            rowId: q.row.id,
            templateMatchesRow: templateMatch(c.proof.hookTemplate, q.row.hook_template),
            rowSpokenHook: q.row.spoken_hook, // print for HUMAN check vs the real video
            queryError: null,
          };
        } else {
          // fresh-scrape row not (yet) written back
          fidelity = { state: "row-not-found", rowId: null, templateMatchesRow: null, rowSpokenHook: null, queryError: null };
        }
      }
      run.cards.push({ hookLine: c.hookLine, seedHook: c.seedHook, kept, seedDup, proof: c.proof ?? null, fidelity });
      console.log(`  ${kept ? "✓ receipt" : "· original"}  ${String(c.hookLine).slice(0, 70)}`);
    }
  } catch (err) {
    // Never let a throw on ask 5 discard four paid sends.
    run.failure = `threw: ${String(err)}`;
    console.error(`  ⚠ ${run.failure}`);
  }

  flush(); // crash-safe: the report is complete-as-of-now after every ask
}

const s = summarize(runs);

if (s.verdict === "NO-MEASUREMENT") {
  console.log(`\n══ 🔴 no measurement — no verdict: 0 hook cards shipped across ${s.asksAttempted} ask(s)`);
  console.log(`══ this is an UNRUN probe, not a failed gate — read the failures below before reporting anything`);
} else {
  console.log(`\n══ receipts: ${s.kept}/${s.total} (${(s.rate * 100).toFixed(1)}%) — gate ≥70%: ${s.verdict}`);
}
console.log(`══ asks yielding 0 cards: ${s.asksZeroCards}/${ASKS.length}   (sends that failed outright: ${s.asksFailed})`);
for (const r of runs.filter((r) => r.failure)) console.log(`     · "${r.ask.slice(0, 45)}…" → ${r.failure}`);
console.log(`══ seedHook≈hookLine duplicates: ${s.seedDups}/${s.total}`);
console.log(`══ receipt/row template mismatches: ${s.mismatches} (mapping bug if >0)`);
console.log(`══ fidelity UNMEASURABLE (empty template, no row, no URL, or lookup error): ${s.unmeasurable}/${s.kept} kept`);
if (s.lookupErrors) {
  console.log(`══ 🔴 teardown lookups that FAILED: ${s.lookupErrors} — fidelity is UNMEASURED for those cards`);
}
console.log(`\nCheck the DEV SERVER log for the per-run [attribution] and [grounding] lines.`);
console.log(`(that line counts attribution decisions over ranked candidates — not the shipped cards counted here)`);
console.log(`report → ${REPORT_PATH}`);
