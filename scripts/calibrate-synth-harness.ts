/**
 * CALIBRATE synth live harness — the third model-flip gate (plus → flash).
 *
 * WHY THIS EXISTS
 * The plus→flash swap shipped with two live gates: `fold-validate-r1.ts` (PASSED) and
 * `apollo-cite-harness.ts` (FAILED → Apollo reverted). The CALIBRATE synth was left
 * "still unvalidated" — it is the third and last call whose OUTPUT IS THE PRODUCT rather
 * than a score: it bakes the frozen AudienceSignature every downstream surface reads.
 *
 * ⚠️ MODEL-POLICY.md called CALIBRATE "the OTHER thinking-ON call site". That was WRONG —
 * `enrich-signature.ts:391` sets `enable_thinking: false` explicitly (D-01), and Apollo is
 * the ONLY thinking-ON call in the codebase (`engine/deepseek.ts:554`, the single
 * `enable_thinking: true` in non-test source). So Apollo's failure mode — a thinking_budget
 * that stops being spent — never applied here. (Doc corrected 2026-08-04.)
 *
 * WHAT THIS MEASURED (2026-08-04): plus 3/3 PASS · flash 0/7. The expected risk was multi-output
 * DIVERSITY COLLAPSE (the reason qwen3.6-flash was retired in 2026-06-25) and it did NOT recur —
 * flash produced 10 distinct, creator-specific personas with genuine axis spread. It failed on
 * ARITHMETIC instead: persona shares summed to 0.75-0.85, never 1.0, in all 7 runs, and in 2 of
 * those it also flattened the shape (`personas`/`persona_weights` at top level). Both trip a HARD
 * zod invariant, `defaultSynthesize` has no retry, and `calibration.ts:375` converts the throw into
 * `{ error: "scrape_failed" }` — an outage, mislabelled, after the Apify scrape is already paid for.
 * CALIBRATE is therefore held on plus via `QWEN_CALIBRATE_MODEL`, mirroring the Apollo holdout.
 *
 * THE SILENT-FAILURE SURFACE (why a green suite proves nothing here)
 * `SynthSchema` is deliberately tolerant so a sloppy model can never fail a bake:
 *   - `display_name` / `blurb` are `.optional()` → a model that drops them still validates,
 *     and `enrich-signature.ts:512` then OMITS the key, so the UI silently falls back to the
 *     raw archetype. Nothing throws, nothing logs.
 *   - every reaction/behavior axis `.default(0.5)` → a model that omits the axes yields TEN
 *     IDENTICAL personas at 0.5 across the board. Perfectly valid, completely flat.
 *   - `interests` `.default({})`, and the "keys ⊆ topic_vocab" rule is PROMPT-ONLY.
 * So the checks below are exactly the ones zod cannot make. Flat axes are detected as
 * zero spread across the 10 personas; a dropped display_name as a missing key.
 *
 * Usage:
 *   npx tsx scripts/calibrate-synth-harness.ts                      # the shipped default (plus)
 *   QWEN_CALIBRATE_MODEL=qwen3.7-flash npx tsx scripts/calibrate-synth-harness.ts   # re-test flash
 *   npx tsx scripts/calibrate-synth-harness.ts --baseline   # score the PROD signature only
 *
 * INPUT IS REAL, NOT A FIXTURE: 32 real @zachking posts (`account_posts` — real views/likes/
 * comments/shares/SAVES/captions) + the real 2026-07-17 `account_snapshots` profile, the same
 * scrape generation as the production audience row (`calibration.scraped_at` 2026-07-17).
 * Both models get the byte-identical payload.
 *
 * KNOWN LIMITATION (stated, not papered over): the raw Apify bundle is not persisted, so
 * there are no `mediaUrl`s and no subtitle URLs to replay → `watchNotes: []` and
 * `subCoverage 0/32`. The omni WATCH layer is therefore absent for BOTH models (it is a
 * different model, `QWEN_OMNI_MODEL`, untouched by this swap). The prod baseline printed for
 * reference DID have watchNotes, so treat it as a reference, not a control.
 *
 * Evidence-only: edits NO engine file. Costs one synth call per run (~1¢ on plus, ~0.1¢ on flash).
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServiceClient } = require("../src/lib/supabase/service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { enrichSignature } = require("../src/lib/audience/enrich-signature");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { QWEN_CALIBRATE_MODEL, QWEN_REASONING_MODEL, getQwenClient } = require("../src/lib/engine/qwen/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { calculateCost } = require("../src/lib/engine/qwen/cost");

// ── Raw tee ──────────────────────────────────────────────────────────────────────
// getQwenClient() memoizes a single OpenAI instance, so wrapping `create` here is seen by
// enrich-signature's own call. Read-only: the response is passed through untouched. This
// exists because `defaultSynthesize` THROWS on a zod miss and the raw body is otherwise
// lost — without it a failure is indistinguishable from a truncation.
const captured: Array<{ model: string; raw: string; usage: any; ms: number }> = [];
{
  const c = getQwenClient();
  const orig = c.chat.completions.create.bind(c.chat.completions);
  c.chat.completions.create = async (params: any, opts: any) => {
    const t = Date.now();
    const r = await orig(params, opts);
    captured.push({
      model: params?.model, ms: Date.now() - t,
      raw: r?.choices?.[0]?.message?.content ?? "", usage: r?.usage ?? null,
    });
    return r;
  };
}

function dumpCapture() {
  const out = process.env.CALIBRATE_RAW_OUT;
  if (out && captured.length) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("fs").writeFileSync(out, captured[captured.length - 1].raw);
    console.log(`  [raw written to ${out}]`);
  }
  for (const c of captured) {
    const cost = (() => { try { return calculateCost(c.model, c.usage ?? undefined); } catch { return null; } })();
    console.log(`\n  ── RAW RESPONSE (${c.model}, ${(c.ms / 1000).toFixed(1)}s${cost !== null ? `, ${cost}¢` : ""}) ──`);
    console.log(`  usage: ${JSON.stringify(c.usage)}`);
    let keys = "(unparseable)";
    try {
      // Use the PRODUCTION chain verbatim so this cannot disagree with defaultSynthesize.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { stripModelOutput } = require("../src/lib/engine/utils/strip");
      const o = JSON.parse(stripModelOutput(c.raw));
      keys = JSON.stringify(Object.keys(o));
      const a = o.audience;
      keys += a ? ` · audience keys: ${JSON.stringify(Object.keys(a))}` : " · NO audience key";
      const pw = a?.persona_weights ?? o.persona_weights;
      const pp = a?.personas ?? o.personas;
      keys += `\n  persona_weights: ${pw ? (a?.persona_weights ? "audience.persona_weights ✅" : "TOP-LEVEL ❌ (schema wants it under audience)") : "MISSING ❌"}`;
      keys += `\n  personas       : ${Array.isArray(pp) ? `${pp.length} @ ${a?.personas ? "audience.personas ✅" : "TOP-LEVEL ❌"}` : "MISSING ❌"}`;
    } catch (e: any) { keys = `(unparseable: ${String(e?.message).slice(0, 80)})`; }
    console.log(`  top-level keys: ${keys}`);
    console.log(`  finish/length: ${c.raw.length} chars`);
    console.log(c.raw.slice(0, 2600));
    if (c.raw.length > 2600) console.log(`  … [${c.raw.length - 2600} more chars]`);
  }
}

const ACCOUNT_ID = "bc2f36d7-ce81-498d-b49f-23306b69a542"; // @zachking / tiktok
const BASELINE_ONLY = process.argv.includes("--baseline");

const ARCHETYPES = [
  "tough_crowd", "lurker", "high_engager", "saver", "sharer",
  "purposeful_viewer", "niche_deep_buyer", "niche_deep_scout", "loyalist", "cross_niche_curiosity",
] as const;
const REACTION_AXES = ["hookSensitivity", "noveltyBias", "skepticism", "attentionSpan"] as const;
const BEHAVIOR_AXES = ["watchThrough", "sharePropensity", "commentPropensity", "savePropensity"] as const;

/** An axis whose 10 values span less than this is flat — the zod-default collapse signature. */
const FLAT_RANGE = 0.05;
/** topic_vocab contract from SYNTH_SYSTEM: "8-14 lowercase_snake tags". */
const VOCAB_MIN = 8, VOCAB_MAX = 14;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
/** display_name that is just the archetype word — SYNTH_SYSTEM: "never the raw archetype word". */
function echoesArchetype(displayName: string, archetype: string): boolean {
  const d = norm(displayName), a = norm(archetype);
  return d === a || d === `${a}s` || d.includes(a);
}

function spread(vals: number[]): { min: number; max: number; range: number } {
  if (!vals.length) return { min: 0, max: 0, range: 0 };
  const min = Math.min(...vals), max = Math.max(...vals);
  return { min: +min.toFixed(3), max: +max.toFixed(3), range: +(max - min).toFixed(3) };
}

interface Scored {
  label: string;
  ms: number | null;
  nPersonas: number;
  slugsExact: boolean;
  withDisplayName: number;
  distinctDisplayName: number;
  archetypeEchoes: string[];
  withBlurb: number;
  distinctBlurb: number;
  vocabSize: number;
  foreignInterestKeys: string[];
  personasWithNoInterests: number;
  allDefault: number;
  flatAxes: string[];
  axisTable: Array<{ axis: string; min: number; max: number; range: number }>;
  shareSpread: { min: number; max: number; range: number };
  sums: { share: number; weights: number; temp: number };
  samples: Array<{ archetype: string; display_name: string; blurb: string }>;
}

function score(label: string, sig: any, ms: number | null): Scored {
  const ps: any[] = sig?.audience?.personas ?? [];
  const vocab: string[] = sig?.audience?.topic_vocab ?? [];
  const vocabSet = new Set(vocab);

  const displayNames = ps.map((p) => p.display_name).filter(Boolean) as string[];
  const blurbs = ps.map((p) => p.blurb).filter(Boolean) as string[];

  const archetypeEchoes = ps
    .filter((p) => p.display_name && echoesArchetype(p.display_name, p.archetype))
    .map((p) => `${p.archetype} → "${p.display_name}"`);

  const foreign = new Set<string>();
  let noInterests = 0;
  for (const p of ps) {
    const keys = Object.keys(p.reaction?.interests ?? {});
    if (!keys.length) noInterests++;
    for (const k of keys) if (!vocabSet.has(k)) foreign.add(`${p.archetype}:${k}`);
  }

  const axisTable: Scored["axisTable"] = [];
  const flatAxes: string[] = [];
  for (const a of REACTION_AXES) {
    const s = spread(ps.map((p) => p.reaction?.[a]).filter((v) => typeof v === "number"));
    axisTable.push({ axis: `reaction.${a}`, ...s });
    if (s.range < FLAT_RANGE) flatAxes.push(`reaction.${a}`);
  }
  for (const a of BEHAVIOR_AXES) {
    const s = spread(ps.map((p) => p.behavior?.[a]).filter((v) => typeof v === "number"));
    axisTable.push({ axis: `behavior.${a}`, ...s });
    if (s.range < FLAT_RANGE) flatAxes.push(`behavior.${a}`);
  }

  // A persona sitting at exactly 0.5 on all eight axes is the pure zod-default fingerprint.
  const allDefault = ps.filter((p) =>
    [...REACTION_AXES.map((a) => p.reaction?.[a]), ...BEHAVIOR_AXES.map((a) => p.behavior?.[a])]
      .every((v) => v === 0.5),
  ).length;

  const w = sig?.audience?.persona_weights ?? {};
  const t = sig?.audience?.temperature_mix ?? {};
  const sum = (o: any) => +Object.values(o).reduce((a: any, b: any) => a + (typeof b === "number" ? b : 0), 0).toFixed(3);

  return {
    label, ms,
    nPersonas: ps.length,
    slugsExact: new Set(ps.map((p) => p.archetype)).size === 10 && ps.every((p) => (ARCHETYPES as readonly string[]).includes(p.archetype)),
    withDisplayName: displayNames.length,
    distinctDisplayName: new Set(displayNames.map(norm)).size,
    archetypeEchoes,
    withBlurb: blurbs.length,
    distinctBlurb: new Set(blurbs.map(norm)).size,
    vocabSize: vocab.length,
    foreignInterestKeys: [...foreign],
    personasWithNoInterests: noInterests,
    allDefault,
    flatAxes,
    axisTable,
    shareSpread: spread(ps.map((p) => p.share).filter((v) => typeof v === "number")),
    sums: { share: sum(Object.fromEntries(ps.map((p, i) => [i, p.share]))), weights: sum(w), temp: sum(t) },
    samples: ps.map((p) => ({ archetype: p.archetype, display_name: p.display_name ?? "(DROPPED)", blurb: p.blurb ?? "(DROPPED)" })),
  };
}

function report(s: Scored) {
  const ok = (b: boolean) => (b ? "✅" : "❌");
  console.log(`\n  ═════════ ${s.label} ═════════`);
  if (s.ms !== null) console.log(`  latency            : ${(s.ms / 1000).toFixed(1)}s`);
  console.log(`  personas           : ${s.nPersonas}  slugs-exact ${ok(s.slugsExact)}`);
  console.log(`  display_name       : ${s.withDisplayName}/10 present, ${s.distinctDisplayName} distinct  ${ok(s.withDisplayName === 10 && s.distinctDisplayName === 10)}`);
  console.log(`  archetype echoes   : ${s.archetypeEchoes.length}  ${ok(s.archetypeEchoes.length === 0)}${s.archetypeEchoes.length ? "  ← prompt says NEVER the raw archetype word" : ""}`);
  for (const e of s.archetypeEchoes) console.log(`      • ${e}`);
  console.log(`  blurb              : ${s.withBlurb}/10 present, ${s.distinctBlurb} distinct  ${ok(s.withBlurb === 10 && s.distinctBlurb === 10)}`);
  console.log(`  topic_vocab        : ${s.vocabSize} tags (spec ${VOCAB_MIN}-${VOCAB_MAX})  ${ok(s.vocabSize >= VOCAB_MIN && s.vocabSize <= VOCAB_MAX)}`);
  // NOTE: "keys outside topic_vocab" is INFORMATIONAL, not a gate. The shipped production
  // baseline itself scores 3 (pop_culture ×2, storytelling), so gating on zero would fail the
  // very output this harness treats as the bar. Reported for comparison; excluded from PASS.
  console.log(`  interests          : ${s.personasWithNoInterests}/10 personas EMPTY  ${ok(s.personasWithNoInterests === 0)} · ${s.foreignInterestKeys.length} keys outside topic_vocab (informational — prod baseline = 3)`);
  for (const f of s.foreignInterestKeys.slice(0, 8)) console.log(`      • ${f}`);
  console.log(`  all-0.5 personas   : ${s.allDefault}/10 (pure zod-default fingerprint)  ${ok(s.allDefault === 0)}`);
  console.log(`  FLAT axes          : ${s.flatAxes.length}/8 span < ${FLAT_RANGE}  ${ok(s.flatAxes.length === 0)}${s.flatAxes.length ? " ← DIVERSITY COLLAPSE" : ""}`);
  console.log(`  ── axis spread across the 10 reactors ──`);
  for (const a of s.axisTable) console.log(`      ${a.axis.padEnd(26)} ${String(a.min).padStart(5)} … ${String(a.max).padStart(5)}   range ${String(a.range).padStart(5)}${a.range < FLAT_RANGE ? "  ❌ flat" : ""}`);
  console.log(`  share spread       : ${s.shareSpread.min} … ${s.shareSpread.max} (range ${s.shareSpread.range})  ${ok(s.shareSpread.range > 0)}`);
  console.log(`  invariants         : shares=${s.sums.share} weights=${s.sums.weights} temp_mix=${s.sums.temp}  ${ok([s.sums.share, s.sums.weights, s.sums.temp].every((v) => Math.abs(v - 1) < 0.02))}`);
  console.log(`  ── the cast ──`);
  for (const p of s.samples) console.log(`      ${p.archetype.padEnd(22)} ${String(p.display_name).padEnd(28)} ${String(p.blurb).slice(0, 52)}`);

  const pass =
    s.nPersonas === 10 && s.slugsExact &&
    s.withDisplayName === 10 && s.distinctDisplayName === 10 &&
    s.archetypeEchoes.length === 0 &&
    s.withBlurb === 10 && s.distinctBlurb === 10 &&
    s.vocabSize >= VOCAB_MIN && s.vocabSize <= VOCAB_MAX &&
    s.personasWithNoInterests === 0 &&
    s.allDefault === 0 && s.flatAxes.length === 0 && s.shareSpread.range > 0;
  console.log(`\n  CALIBRATE_RESULT model=${s.label} personas=${s.nPersonas} names=${s.withDisplayName}/10 distinct=${s.distinctDisplayName} echoes=${s.archetypeEchoes.length} vocab=${s.vocabSize} foreign=${s.foreignInterestKeys.length} flat_axes=${s.flatAxes.length}/8 all_default=${s.allDefault} VERDICT=${pass ? "PASS" : "REVIEW"}`);
  return pass;
}

async function main() {
  const supabase = createServiceClient();

  // ── The production signature (built on PLUS, 2026-07-14) — reference bar ──────────
  const { data: aud, error: audErr } = await supabase
    .from("audiences").select("name,goal_intent,signature").eq("source_account_id", ACCOUNT_ID).not("signature", "is", null).limit(1);
  if (audErr) throw new Error(`audiences read failed: ${audErr.message}`);
  const prod = aud?.[0];

  console.log(`\n████ CALIBRATE SYNTH — plus vs flash ████`);
  console.log(`  model under test : ${QWEN_CALIBRATE_MODEL}   (QWEN_CALIBRATE_MODEL — scoped holdout)`);
  console.log(`  platform default : ${QWEN_REASONING_MODEL}   (QWEN_REASONING_MODEL — everything else)`);
  console.log(`  input            : REAL @zachking — 32 account_posts + 2026-07-17 snapshot`);

  if (prod?.signature) report(score("PROD BASELINE (plus, 2026-07-14, watchNotes present)", prod.signature, null));
  if (BASELINE_ONLY) return;

  // ── Real profile + real posts → the byte-identical payload both models see ────────
  const { data: snap, error: snapErr } = await supabase
    .from("account_snapshots").select("*").eq("account_id", ACCOUNT_ID).order("snapshot_date", { ascending: false }).limit(1);
  if (snapErr) throw new Error(`account_snapshots read failed: ${snapErr.message}`);
  const s = snap?.[0];
  if (!s) throw new Error("no account_snapshots row for the account");

  const { data: posts, error: postsErr } = await supabase
    .from("account_posts").select("*").eq("account_id", ACCOUNT_ID).order("views", { ascending: false });
  if (postsErr) throw new Error(`account_posts read failed: ${postsErr.message}`);
  if (!posts?.length) throw new Error("no account_posts rows for the account");

  const profile = {
    handle: s.handle, displayName: s.handle, bio: "", avatarUrl: "", verified: true,
    followerCount: s.follower_count ?? 0, followingCount: s.following_count ?? 0,
    heartCount: s.heart_count ?? 0, videoCount: s.video_count ?? 0,
  };
  const videos = posts.map((p: any) => ({
    platformVideoId: p.post_id, videoUrl: "", caption: p.caption ?? "",
    views: Number(p.views ?? 0), likes: Number(p.likes ?? 0), comments: Number(p.comments ?? 0),
    shares: Number(p.shares ?? 0), saves: Number(p.saves ?? 0),
    hashtags: p.hashtags ?? [], durationSeconds: 0, postedAt: new Date(p.posted_at ?? Date.now()),
  }));

  console.log(`  payload          : ${videos.length} videos · fans=${profile.followerCount.toLocaleString()} · hearts=${profile.heartCount.toLocaleString()} · goal=${prod?.goal_intent ?? "grow"}`);
  console.log(`  watchNotes       : [] (raw scrape not persisted — same absence for BOTH models)\n`);

  const t0 = Date.now();
  const sig = await enrichSignature(
    { handle: profile.handle, profile, videos, subCoverage: `0/${videos.length}`, goalIntent: prod?.goal_intent ?? "grow" },
    { watchVideo: async () => null, fetchSubtitle: async () => null },
  );
  const ms = Date.now() - t0;

  const c = captured[captured.length - 1];
  const cost = c ? (() => { try { return calculateCost(c.model, c.usage ?? undefined); } catch { return null; } })() : null;
  const pass = report(score(QWEN_CALIBRATE_MODEL, sig, ms));
  console.log(`  cost               : ${cost !== null ? `${cost}¢` : "n/a"} · usage ${JSON.stringify(c?.usage ?? null)}`);
  if (process.argv.includes("--raw")) dumpCapture();
  if (!pass) process.exitCode = 1;
}

main().catch((e) => {
  console.error("\n[calibrate-synth-harness] SYNTH FAILED:", e?.message ?? e);
  // The throw IS the finding — surface what the model actually returned.
  dumpCapture();
  process.exit(1);
});
