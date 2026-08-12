/**
 * LIVE PROBE — does the SCORER drift run-to-run?
 *
 * `QWEN_SEED`'s docstring (qwen/client.ts:20-28) is the tree-wide determinism premise, and it
 * names what depends on it:
 *
 *   "Together these make the engine reproducible: the same input yields the same score
 *    run-to-run. This is the precondition for a trustworthy eval/weight-fit number — you cannot
 *    separate model error from run-to-run sampling jitter if the scorer drifts between runs."
 *
 * That premise is measured FALSE one call over: `generateAdaptConcepts` uses the same model,
 * temperature 0 and seed, and produced 9 distinct outputs from 9 byte-identical inputs
 * (scripts/probe-adapt-determinism.ts, 2026-08-12). Whether the SCORER drifts too was never
 * measured, and it is the one that matters, because:
 *
 *   scripts/eval.ts → corpus/eval-harness → corpus/eval-runner:125 → resolvePack("socials").run
 *     = runPredictionPipeline, called with input_mode "text" (eval-runner.ts:116-123)
 *     → pipeline.ts:675-715, the call below, which emits factors[].score
 *
 * Every eval row goes through it. If those scores move on identical input, an eval delta smaller
 * than the drift is not a result, and no weight fitted on top of it means anything.
 *
 * What varies here: NOTHING but the model. One frozen caption, the pipeline's own parameters.
 * Prose (rationale, summaries) is EXPECTED to vary and is not the finding — the SCORES are.
 *
 * Usage:
 *   node node_modules/tsx/dist/cli.mjs scripts/probe-scorer-determinism.ts [--runs 5]
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
const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("../src/lib/engine/qwen/client");
const { stripModelOutput } = require("../src/lib/engine/utils/strip");
const { calculateCost } = require("../src/lib/engine/qwen/cost");

const argv = process.argv.slice(2);
const runsArg = argv.indexOf("--runs");
const RUNS = runsArg >= 0 ? Number(argv[runsArg + 1]) : 5;

// =============================================================================
// The call under measurement — MIRRORED from pipeline.ts:682-695, verbatim.
// =============================================================================

const SYSTEM_PROMPT =
  "You are a TikTok content analyst. Analyze the provided content and return a JSON object with " +
  "fields: factors (array of 5 with name, score 0-10, rationale, improvement_tip), " +
  "overall_impression (string), content_summary (string). Factor names must be exactly: " +
  "Scroll-Stop Power, Completion Pull, Rewatch Potential, Share Trigger, Emotional Charge.";

/**
 * A mirrored call is a copy, and a copy goes stale silently — it would keep reporting a rate for
 * a call production no longer makes. So read pipeline.ts and refuse to run if the thing being
 * mirrored has moved. A probe that cannot prove it is measuring the real call is worth nothing.
 */
function assertMirrorIsCurrent(): void {
  const src = readFileSync(resolve(__dirname, "../src/lib/engine/pipeline.ts"), "utf-8");
  const required: Array<[string, string]> = [
    ["system prompt",  SYSTEM_PROMPT],
    ["temperature",    "temperature: 0,"],
    ["max_tokens",     "max_tokens: 2000,"],
    ["seed",           "geminiParams.seed = QWEN_SEED"],
    ["thinking off",   "geminiParams.enable_thinking = false"],
    ["model constant", "const model = QWEN_REASONING_MODEL"],
  ];
  const drifted = required.filter(([, needle]) => !src.includes(needle)).map(([name]) => name);
  if (drifted.length > 0) {
    console.error(
      `\n  ❌ STALE PROBE — pipeline.ts no longer matches this mirror: ${drifted.join(", ")}.\n` +
      `     Re-sync the parameters above against pipeline.ts before trusting any number here.\n`,
    );
    process.exit(1);
  }
}

/**
 * A frozen corpus-shaped caption. eval-runner builds `content_text` from `row.caption`
 * (eval-runner.ts:118), so this is the shape every eval row presents to the scorer.
 */
const CAPTION =
  "I stopped counting macros for 30 days and trained the exact same program. " +
  "Day 1 I felt fine. Day 9 my lifts fell off a cliff. What actually fixed it wasn't food — " +
  "it was sleep, and I have the numbers to prove it.";

const FACTORS = [
  "Scroll-Stop Power",
  "Completion Pull",
  "Rewatch Potential",
  "Share Trigger",
  "Emotional Charge",
] as const;

interface Run { scores: number[]; costCents: number }

async function scoreOnce(): Promise<Run | null> {
  const ai = getQwenClient();
  const params = {
    model: QWEN_REASONING_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: `Analyze this TikTok content:\n\n${CAPTION}` },
    ],
    response_format: { type: "json_object" as const },
    temperature: 0,
    max_tokens: 2000,
  };
  // @ts-expect-error — DashScope extensions not in OpenAI types (mirrors pipeline.ts:692-695)
  params.seed = QWEN_SEED;
  // @ts-expect-error — DashScope extension: thinking-off
  params.enable_thinking = false;

  const completion = await ai.chat.completions.create(params as never);
  const parsed = JSON.parse(stripModelOutput(completion.choices[0]?.message?.content ?? "{}"));
  if (!Array.isArray(parsed.factors) || parsed.factors.length !== 5) return null;

  // Order by the fixed factor names rather than by array position — a model that reorders its
  // array is not drifting its scores, and counting that as drift would overstate the finding.
  const byName = new Map<string, number>(
    parsed.factors.map((f: { name?: string; score?: number }) => [String(f.name), Number(f.score)]),
  );
  return {
    scores: FACTORS.map((n) => byName.get(n) ?? NaN),
    costCents: calculateCost(QWEN_REASONING_MODEL, completion.usage ?? undefined),
  };
}

async function main() {
  assertMirrorIsCurrent();

  console.log(`${"═".repeat(78)}\n  PROBE — scorer determinism (pipeline.ts:675-715, the eval path)\n${"═".repeat(78)}`);
  console.log(`  model : ${QWEN_REASONING_MODEL}  ·  temperature 0  ·  seed ${QWEN_SEED}  ·  thinking off`);
  console.log(`  input : ONE frozen caption, byte-identical across all ${RUNS} runs.`);
  console.log(`  \x1b[2mThe scores below are what every eval row's bucket is computed from.\x1b[0m\n`);

  const runs: Run[] = [];
  for (let r = 0; r < RUNS; r++) {
    try {
      const out = await scoreOnce();
      if (!out) { console.log(`  run ${r + 1}: \x1b[31minvalid factors array\x1b[0m`); continue; }
      runs.push(out);
      console.log(`  run ${r + 1}: [${out.scores.map((s) => String(s).padStart(2)).join(", ")}]  ` +
                  `mean ${(out.scores.reduce((a, b) => a + b, 0) / 5).toFixed(2)}  ` +
                  `\x1b[2m${out.costCents.toFixed(4)}¢\x1b[0m`);
    } catch (e) {
      console.log(`  run ${r + 1}: \x1b[31mfailed\x1b[0m ${String(e)}`);
    }
  }

  if (runs.length < 2) { console.log("\n  Not enough successful runs to compare."); return; }

  const vectors = new Set(runs.map((r) => r.scores.join(",")));
  const spreads = FACTORS.map((name, i) => {
    const col = runs.map((r) => r.scores[i]!);
    return { name, min: Math.min(...col), max: Math.max(...col) };
  });
  const means    = runs.map((r) => r.scores.reduce((a, b) => a + b, 0) / 5);
  const meanSpan = Math.max(...means) - Math.min(...means);
  const worst    = Math.max(...spreads.map((s) => s.max - s.min));
  const cost     = runs.reduce((a, r) => a + r.costCents, 0);

  console.log(`\n${"─".repeat(78)}\n  Per-factor spread across ${runs.length} runs on IDENTICAL input:`);
  for (const s of spreads) {
    const d = s.max - s.min;
    const bar = d === 0 ? "\x1b[2m·\x1b[0m" : `\x1b[31m${"█".repeat(d)}\x1b[0m`;
    console.log(`    ${s.name.padEnd(18)} ${String(s.min).padStart(2)}–${String(s.max).padStart(2)}  Δ${d}  ${bar}`);
  }
  console.log(`\n  mean score ranges over ${meanSpan.toFixed(2)} points · total ${cost.toFixed(3)}¢`);

  console.log(`\n${"═".repeat(78)}`);
  if (vectors.size === 1) {
    console.log(`  ✅ STABLE — ${runs.length} runs, 1 distinct score vector.`);
    console.log(`     The scorer holds where the adapt call does not. QWEN_SEED's premise survives`);
    console.log(`     on THIS call; eval deltas have a floor of zero from this source.`);
  } else {
    console.log(`  ❌ THE SCORER DRIFTS — ${runs.length} runs, ${vectors.size} distinct score vectors,`);
    console.log(`     worst single factor moving ${worst} point(s) on byte-identical input.`);
    console.log(`     QWEN_SEED's docstring calls stability "the precondition for a trustworthy`);
    console.log(`     eval/weight-fit number". It does not hold. Any eval delta below this spread`);
    console.log(`     is sampling jitter, not signal — re-read every number fitted on top of it.`);
  }
  console.log(`${"═".repeat(78)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
