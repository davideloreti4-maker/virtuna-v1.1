/**
 * LIVE PROBE — does APOLLO drift? This is the call the eval score is actually made of.
 *
 * Correcting probe-scorer-determinism.ts's implied conclusion. That probe measured
 * pipeline.ts:675-715 and found real drift (24 runs, 6 distinct score vectors), but tracing the
 * arithmetic afterwards showed where that lands:
 *
 *   aggregator.ts:88   SCORE_WEIGHT_KEYS = ["behavioral", "apollo"]   ← `gemini` is a DEAD key
 *   aggregator.ts:868  gemini_score = round(avg(factors)*10)          ← computed, then NOT blended
 *   aggregator.ts:920  raw_overall_score = f(apollo_score, behavioral_score, fold_audience_score)
 *
 * `gemini_score` is stored for legacy/text back-compat and never enters the number
 * `bucketFromScore` reads. So the measured factor drift moves a SUB-SIGNAL, not the score.
 *
 * What DOES make the score, in eval's text mode (no fold → aggregator.ts:928):
 *
 *   overall_score = behavioral_score·w.behavioral + apollo_score·w.apollo
 *   behavioral_score = round(avg(7 Apollo component_scores)*10)   (aggregator.ts:846-859)
 *   apollo_score     = Apollo composite_score                      (aggregator.ts:879)
 *
 * BOTH terms come from ONE Apollo call. Its jitter is therefore the ENTIRE jitter of the eval
 * score, and it has never been measured.
 *
 * Prior belief worth stating before the numbers land: Apollo may well hold where the read did
 * not. F26 (deepseek.ts:229) makes composite_score a deterministic rubric-sum rather than a
 * model-emitted number, and the dimension scores are quantized to fixed band anchors —
 * strong→85, mid→50, weak→20 (deepseek.ts:458). A quantized score has to flip a whole BAND to
 * move, where a free-form 0-10 factor only has to waver. If Apollo is stable, that design is why.
 *
 * This probe calls the REAL exported `reasonWithDeepSeek` — no mirrored parameters, nothing to go
 * stale. `gemini_analysis` is frozen (it is Apollo's input, and it is exactly what the read's
 * drift perturbs in production), so the only thing that can vary here is Apollo itself.
 *
 * Usage:
 *   node node_modules/tsx/dist/cli.mjs scripts/probe-apollo-determinism.ts [--runs 8]
 *   (never npx — it wraps and swallows output)
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

/* eslint-disable @typescript-eslint/no-require-imports */
const { reasonWithDeepSeek } = require("../src/lib/engine/deepseek");

const argv = process.argv.slice(2);
const runsArg = argv.indexOf("--runs");
const RUNS = runsArg >= 0 ? Number(argv[runsArg + 1]) : 8;

/** The same frozen caption probe-scorer-determinism.ts uses, so the two are comparable. */
const CAPTION =
  "I stopped counting macros for 30 days and trained the exact same program. " +
  "Day 1 I felt fine. Day 9 my lifts fell off a cliff. What actually fixed it wasn't food — " +
  "it was sleep, and I have the numbers to prove it.";

/**
 * Frozen read output. In production this is what the drifting call emits; freezing it is the
 * whole point — it isolates Apollo's own jitter from the jitter it inherits. Scores are the
 * MODAL vector measured over 24 runs (12/24), so this is the read Apollo most often sees.
 */
const GEMINI_ANALYSIS = {
  factors: [
    { name: "Scroll-Stop Power",  score: 8, rationale: "Opens on a 30-day abstinence claim with a concrete before/after promise.", improvement_tip: "Name the number sooner." },
    { name: "Completion Pull",    score: 9, rationale: "Withholds the cause until the final clause — an explicit open loop.",       improvement_tip: "Keep the reveal past the midpoint." },
    { name: "Rewatch Potential",  score: 6, rationale: "The payoff is a single fact; little rewards a second pass.",                improvement_tip: "Add a detail that only reads on rewatch." },
    { name: "Share Trigger",      score: 7, rationale: "Counter-intuitive conclusion that indicts a common belief about diet.",     improvement_tip: "Make the claim more quotable." },
    { name: "Emotional Charge",   score: 5, rationale: "Frustration then relief, but stated rather than dramatised.",               improvement_tip: "Show the day-9 low." },
  ],
  overall_impression:
    "A results-driven fitness experiment post with a delayed causal reveal. Strong retention shape, moderate emotional range.",
  content_summary:
    "Creator drops macro tracking for 30 days on an unchanged training program, sees performance collapse by day 9, and attributes the fix to sleep rather than diet.",
  video_signals: null,
};

const ANALYSIS_INPUT = {
  input_mode: "text",
  content_text: CAPTION,
  content_type: "video",
  mode: "score",
  niche: "fitness",
};

/** Mirrors pipeline.ts:791-800 — the placeholders production hands Apollo in this mode. */
const RULE_RESULT  = { rule_score: 50, matched_rules: [] };
const TREND_ENRICH = {
  trend_score: 0,
  matched_trends: [],
  trend_context: "Trend analysis running in parallel — results available in pipeline output.",
  hashtag_relevance: 0,
};

/** The exact seven aggregator.ts:850-856 averages, in its order. Names copied from there. */
const COMPONENTS = [
  "hook_effectiveness", "retention_strength", "shareability", "comment_provocation",
  "save_worthiness", "trend_alignment", "originality",
] as const;

interface Run { composite: number; behavioral: number; components: number[]; costCents: number }

async function reasonOnce(): Promise<Run | null> {
  const out = await reasonWithDeepSeek({
    input:            ANALYSIS_INPUT,
    gemini_analysis:  GEMINI_ANALYSIS,
    rule_result:      RULE_RESULT,
    trend_enrichment: TREND_ENRICH,
    creator_context:  "",
    verbatim:         null,
    videoUrl:         null, // text mode — the eval path never has a signed URL
  });
  if (!out?.reasoning) return null;

  const cs = out.reasoning.component_scores ?? {};
  const components = COMPONENTS.map((k) => Number((cs as Record<string, number>)[k] ?? NaN));
  // aggregator.ts:846-859 — behavioral_score is round(avg of these seven * 10).
  const behavioral = Math.round((components.reduce((a, b) => a + b, 0) / 7) * 10);
  return {
    composite:  Number(out.reasoning.composite_score ?? NaN),
    behavioral,
    components,
    costCents:  out.cost_cents ?? 0,
  };
}

async function main() {
  console.log(`${"═".repeat(78)}\n  PROBE — Apollo determinism (the call the eval score is MADE of)\n${"═".repeat(78)}`);
  console.log(`  input : ONE frozen caption + ONE frozen read, byte-identical across ${RUNS} runs.`);
  console.log(`  \x1b[2moverall_score = behavioral_score·w + apollo_score·w — both from this one call.\x1b[0m\n`);

  const runs: Run[] = [];
  for (let r = 0; r < RUNS; r++) {
    try {
      const out = await reasonOnce();
      if (!out) { console.log(`  run ${r + 1}: \x1b[31mnull (circuit open or all retries failed)\x1b[0m`); continue; }
      runs.push(out);
      console.log(
        `  run ${r + 1}: composite ${String(out.composite).padStart(3)} · behavioral ${String(out.behavioral).padStart(3)}` +
        ` · components [${out.components.map((c) => String(c).padStart(2)).join(", ")}] \x1b[2m${out.costCents.toFixed(4)}¢\x1b[0m`,
      );
    } catch (e) {
      console.log(`  run ${r + 1}: \x1b[31mfailed\x1b[0m ${String(e)}`);
    }
  }

  if (runs.length < 2) { console.log("\n  Not enough successful runs to compare."); return; }

  const comps  = runs.map((r) => r.composite);
  const behavs = runs.map((r) => r.behavioral);
  const compSpan  = Math.max(...comps)  - Math.min(...comps);
  const behavSpan = Math.max(...behavs) - Math.min(...behavs);
  const cost = runs.reduce((a, r) => a + r.costCents, 0);

  console.log(`\n${"─".repeat(78)}`);
  console.log(`  composite_score   ${Math.min(...comps)}–${Math.max(...comps)}   Δ${compSpan}`);
  console.log(`  behavioral_score  ${Math.min(...behavs)}–${Math.max(...behavs)}   Δ${behavSpan}`);
  for (const [i, name] of COMPONENTS.entries()) {
    const col = runs.map((r) => r.components[i]!);
    const d = Math.max(...col) - Math.min(...col);
    console.log(`    ${name.padEnd(18)} ${Math.min(...col)}–${Math.max(...col)}  Δ${d}${d ? "  \x1b[31m" + "█".repeat(d) + "\x1b[0m" : "  \x1b[2m·\x1b[0m"}`);
  }
  console.log(`\n  ${runs.length} runs · total ${cost.toFixed(3)}¢`);

  // Both weight terms move together, so the worst case for overall_score is bounded by the
  // larger span — stated as a BOUND, not as a measured overall_score, because the weights come
  // from selectWeights(availability) and are not exercised here.
  const bound = Math.max(compSpan, behavSpan);
  console.log(`\n${"═".repeat(78)}`);
  if (compSpan === 0 && behavSpan === 0) {
    console.log(`  ✅ APOLLO HOLDS — ${runs.length} runs, identical composite AND behavioral.`);
    console.log(`     The read drifts; the SCORE does not. The fixed band anchors (85/50/20) plus`);
    console.log(`     the post-parse rubric-sum are doing exactly what they were built for.`);
    console.log(`     Eval deltas are NOT swamped by scorer jitter from this source.`);
  } else {
    console.log(`  ❌ APOLLO DRIFTS — composite Δ${compSpan}, behavioral Δ${behavSpan} on identical input.`);
    console.log(`     Both weight terms of overall_score come from this one call, so an eval delta`);
    console.log(`     under ~${bound} points on the 0-100 scale is sampling jitter, not signal.`);
    console.log(`     Bucket cuts are 70/30 — a row near either cut can flip between runs.`);
  }
  console.log(`${"═".repeat(78)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
