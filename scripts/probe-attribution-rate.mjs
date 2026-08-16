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

const state = JSON.parse(readFileSync(".scratch/auth-state.json", "utf8"));
const authCookie = state.cookies.map((c) => `${c.name}=${c.value}`).join("; ");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

function* walk(node) {
  if (node && typeof node === "object") {
    if (node.type === "hook-card" && node.props) yield node.props;
    for (const v of Object.values(node)) yield* walk(v);
  }
}

function extractHookCards(sse) {
  const out = [];
  for (const line of sse.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      for (const p of walk(JSON.parse(line.slice(5)))) out.push(p);
    } catch {
      /* non-JSON data line */
    }
  }
  return out;
}

const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** → {ok:true,row}|{ok:true,row:null} (no such video) | {ok:false,error} (the QUERY broke). */
async function teardownByUrl(videoUrl) {
  const q = `${SB}/rest/v1/outlier_teardowns?video_url=eq.${encodeURIComponent(videoUrl)}&select=id,creator_handle,hook_template,spoken_hook,video_url`;
  const r = await fetch(q, { headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) return { ok: false, error: `${r.status} ${(await r.text()).slice(0, 200)}` };
  return { ok: true, row: (await r.json())[0] ?? null };
}

const runs = [];
for (const [i, ask] of ASKS.entries()) {
  process.stdout.write(`\n[${i + 1}/${ASKS.length}] ${ask.slice(0, 60)}…\n`);
  const res = await fetch(`${base}/api/tools/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${authCookie}; maven_active_thread=__new__`,
    },
    body: JSON.stringify({ ask, platform: "tiktok" }),
  });
  if (res.status === 401) {
    console.error("401 — auth state is stale. Run: node scripts/mint-auth-state.mjs, then re-run.");
    process.exit(1);
  }
  const sse = await res.text();
  const cards = extractHookCards(sse);
  if (cards.length === 0) {
    writeFileSync(`.scratch/attribution-raw-${i + 1}.sse`, sse);
    console.warn(`  0 hook-cards parsed (status ${res.status}) — raw SSE dumped for inspection`);
  }
  const perCard = [];
  for (const c of cards) {
    const kept = Boolean(c.proof && c.proof.handle);
    const seedDup = Boolean(c.seedHook) && norm(c.seedHook) === norm(c.hookLine);
    let fidelity = null;
    if (kept && c.proof.videoUrl) {
      const q = await teardownByUrl(c.proof.videoUrl);
      if (!q.ok) {
        // A broken query is NOT evidence about the row. Say so, loudly, instead of scoring it.
        fidelity = { queryError: q.error, rowId: null, templateMatchesRow: null, rowSpokenHook: null };
        console.warn(`  ⚠ teardown lookup failed: ${q.error}`);
      } else if (q.row) {
        fidelity = {
          rowId: q.row.id,
          templateMatchesRow: norm(c.proof.hookTemplate) === norm(q.row.hook_template),
          rowSpokenHook: q.row.spoken_hook, // print for HUMAN check vs the real video
        };
      } else {
        // fresh-scrape row not (yet) written back
        fidelity = { rowId: null, templateMatchesRow: null, rowSpokenHook: null };
      }
    }
    perCard.push({ hookLine: c.hookLine, seedHook: c.seedHook, kept, seedDup, proof: c.proof ?? null, fidelity });
    console.log(`  ${kept ? "✓ receipt" : "· original"}  ${String(c.hookLine).slice(0, 70)}`);
  }
  runs.push({ ask, cards: perCard });
}

const all = runs.flatMap((r) => r.cards);
const kept = all.filter((c) => c.kept).length;
const rate = all.length ? kept / all.length : 0;
const seedDups = all.filter((c) => c.seedDup).length;
const mismatches = all.filter((c) => c.fidelity && c.fidelity.templateMatchesRow === false);
const lookupErrors = all.filter((c) => c.fidelity && c.fidelity.queryError);

console.log(`\n══ receipts: ${kept}/${all.length} (${(rate * 100).toFixed(0)}%) — gate ≥70%: ${rate >= 0.7 ? "PASS" : "FAIL"}`);
console.log(`══ seedHook≈hookLine duplicates: ${seedDups}/${all.length}`);
console.log(`══ receipt/row template mismatches: ${mismatches.length} (mapping bug if >0)`);
if (lookupErrors.length) {
  console.log(`══ 🔴 teardown lookups that FAILED: ${lookupErrors.length} — fidelity is UNMEASURED for those cards`);
}
console.log(`\nCheck the DEV SERVER log for the per-run [attribution] and [grounding] lines.`);
console.log(`(that line counts attribution decisions over ranked candidates — not the shipped cards counted here)`);
writeFileSync(".scratch/attribution-report.json", JSON.stringify({ rate, kept, total: all.length, seedDups, runs }, null, 2));
console.log("report → .scratch/attribution-report.json");
