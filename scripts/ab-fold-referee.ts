/**
 * A/B Fold Referee — 3-metric composite (D-03.2 / R10).
 *
 * Runs the prediction pipeline on fixed referee videos twice via each path:
 *   Path A: behavioralSource="personas"  (current 10-pass Wave-3)
 *   Path B: behavioralSource="fold"      (1-call Audience-Sim fold — Plan 03)
 * × 2 runs each (R8 band — provider-noise tolerance), per video.
 *
 * 3-metric composite (D-03.2):
 *   1. Behavioral parity:    |fold.behavioral_score - tenpass.behavioral_score| <= 5
 *   2. Diversity:            fold.avgCurveRange >= 0.8 × tenpass.avgCurveRange
 *   3. Drop-point agreement: >=6/10 archetypes agree on swipe segment (±1)
 * Verdict: "reproduce" = all 3 bands met; "beat" = parity + diversity >=1.0x + comparable drops.
 *
 * R7 assertion:
 *   fold path: exactly 1 audience-sim LLM call (wave_3_fold stage_end)
 *   10-pass:   20 calls (wave_3_persona_* x10 + wave_3_pass2_persona_* x10)
 *
 * NOTE: This is NOT corpus/eval-harness.ts. The corpus harness is a
 * bucket-classifier benchmark (macro-F1 over training_corpus →
 * benchmark_results) — structurally wrong for a fold-vs-10-pass
 * retention-curve A/B (RESEARCH Pitfall 2 / Don't-Hand-Roll). It stays
 * dormant. CONTEXT D-04 said 'revive eval-harness'; RESEARCH overrides
 * with evidence — build fresh on the measure-pipeline.ts scaffold.
 *
 * Advisory (D-05): print numbers + verdict, do NOT process.exit(1) on a
 * metric miss — exit 0 with report so the human makes the final call (Plan 05).
 * process.exit(1) is reserved for infra failures (upload / API error), matching
 * measure-pipeline.ts:175-178.
 *
 * Run: npx tsx scripts/ab-fold-referee.ts
 */

// ==========================================================================
// Bootstrap header — copied verbatim from measure-pipeline.ts:14-21
// (established tsconfig-paths + dotenv pattern for tsx scripts in this repo)
// ==========================================================================
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { register } from "tsconfig-paths";
import { readFileSync } from "fs";
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// ==========================================================================
// Imports (must follow bootstrap — tsconfig-paths must register first)
// ==========================================================================
import { createClient } from "@supabase/supabase-js";
import { runPredictionPipeline } from "../src/lib/engine/pipeline";
import { aggregateScores } from "../src/lib/engine/aggregator";
import type { AggregateScoresOptions } from "../src/lib/engine/aggregator";
import type { StageEvent } from "../src/lib/engine/events";
import type { AnalysisInput } from "../src/lib/engine/types";
import type { PredictionResult } from "../src/lib/engine/types";
import type { HeatmapPayload } from "../src/lib/engine/types";

// ==========================================================================
// Cost cap — T-04-COST mitigation (self-inflicted DoS guard)
// VIDEO_SET.length videos × 2 paths × 2 runs per pipeline invocation.
// Each run ~ 4 LLM calls (~$0.08) → upper bound varies with VIDEO_SET size.
// Cap at 2000 cents ($20) for safety headroom; override via env.
// ==========================================================================
const COST_CAP_CENTS = Number(process.env.AB_REFEREE_COST_CAP_CENTS) || 2000;
let totalCostCents = 0;

// ==========================================================================
// REDUCED referee set (2 of 6) — user decision 2026-06-05.
// D-03 composite degrades gracefully (per-video drop-point agreement).
// The other 4 D-04 slots (hook-strength × niche spread) are deferred.
//
// D-04 coverage with these 2 entries:
//   gwxLeHphZCxK  — good rating, P2 determinism baseline (measure-pipeline.ts default)
//   IMG_0012      — bad rating (.mov), weak hook / low quality
//
// To expand to the full 6-video set: add the missing 4 entries here and re-run.
// Files must be locally accessible with raw bytes (video_upload mode requires
// raw bytes — eval-runner.ts:111 notes corpus does NOT store raw bytes).
//
// Variable-length: composite logic handles any VIDEO_SET size — do not hardcode 6.
// ==========================================================================
const VIDEO_SET: { id: string; path: string }[] = [
  { id: "gwxLeHphZCxK", path: "/Users/davideloreti/Downloads/TikTok Video Downloader.mp4" },
  { id: "IMG_0012",     path: "/Users/davideloreti/Downloads/IMG_0012.mov" },
];

// ==========================================================================
// Types
// ==========================================================================

/** Raw metrics from a single path+run combination. */
interface PathRunMetrics {
  behavioral_score: number;
  avgCurveRange: number;
  /** Per-archetype swipe segment index (index into heatmap.segments).
   *  null when swipe_predicted_at not set or heatmap absent. */
  swipeSegments: (number | null)[];
  cost_cents: number;
  overall_score: number | null;
}

/** Averaged metrics across R8 band (2 runs). */
interface AvgMetrics {
  behavioral_score: number;
  avgCurveRange: number;
  swipeSegments: (number | null)[];  // representative run 1 values for drop comparison
  cost_cents: number;
  overall_score: number | null;
}

/** Per-video 3-metric composite result. */
interface VideoVerdict {
  videoId: string;
  parityDelta: number;         // |fold - tenpass| behavioral_score
  parityOk: boolean;           // <= 5
  diversityRatio: number;      // fold / tenpass avgCurveRange
  diversityOk: boolean;        // >= 0.8
  diversityBeat: boolean;      // >= 1.0
  dropAgreementCount: number;  // archetypes within ±1 swipe segment
  dropAgreementOk: boolean;    // >= 6
  verdict: "reproduce" | "beat" | "miss";
  foldBehavioralScore: number;
  tenpassBehavioralScore: number;
  foldAvgRange: number;
  tenpassAvgRange: number;
  foldCallCount: number;
  tenpassCallCount: number;
  r7Ok: boolean;               // fold=1, tenpass=20
}

// ==========================================================================
// Stage event counter
// R7: fold path issues exactly 1 audience-sim call (wave_3_fold stage_end)
//     10-pass issues 20 (wave_3_persona_* ×10 + wave_3_pass2_persona_* ×10)
// ==========================================================================
function makeEventCounter() {
  const events: StageEvent[] = [];
  const onEvent = (e: StageEvent) => { events.push(e); };
  const getFoldCalls = () =>
    events.filter(
      (e) => e.type === "stage_end" && (e as { stage: string }).stage === "wave_3_fold",
    ).length;
  const getTenpassCalls = () =>
    events.filter(
      (e) =>
        e.type === "stage_end" &&
        typeof (e as { stage?: string }).stage === "string" &&
        (
          /^wave_3_persona_/.test((e as { stage: string }).stage) ||
          /^wave_3_pass2_persona_/.test((e as { stage: string }).stage)
        ),
    ).length;
  const reset = () => { events.length = 0; };
  return { onEvent, getFoldCalls, getTenpassCalls, reset };
}

// ==========================================================================
// avgCurveRange formula — copied VERBATIM from measure-pipeline.ts:146-160
// Per persona: range = max(attentions) - min(attentions). Mean over all personas.
// Measures attention curve variation (higher = more varied, ~0 = flat/homogenized).
// ==========================================================================
function computeAvgCurveRange(heatmap: HeatmapPayload | null | undefined): number {
  if (!heatmap || !heatmap.personas || heatmap.personas.length === 0) return 0;
  const ranges: number[] = [];
  for (const p of heatmap.personas) {
    const att = p.attentions ?? [];
    if (!att.length) continue;
    const min = Math.min(...att);
    const max = Math.max(...att);
    ranges.push(+(max - min).toFixed(2));
  }
  if (!ranges.length) return 0;
  return +(ranges.reduce((a, b) => a + b, 0) / ranges.length).toFixed(2);
}

// ==========================================================================
// swipe_predicted_at (t value) → segment index
// Finds the segment in heatmap.segments whose [t_start, t_end) contains t.
// Falls back to the segment with minimum attention (top dropoff) when t is null.
// ==========================================================================
function swipeSegmentIndex(
  heatmap: HeatmapPayload | null | undefined,
  personaIdx: number,
): number | null {
  if (!heatmap) return null;
  const persona = heatmap.personas[personaIdx];
  if (!persona) return null;

  const swipeAt = persona.swipe_predicted_at;
  if (swipeAt != null) {
    // Find segment whose window contains swipeAt
    const idx = heatmap.segments.findIndex(
      (seg) => swipeAt >= seg.t_start && swipeAt < seg.t_end,
    );
    if (idx !== -1) return idx;
    // t past last segment end → last segment
    if (swipeAt >= (heatmap.segments[heatmap.segments.length - 1]?.t_start ?? 0)) {
      return heatmap.segments.length - 1;
    }
    return null;
  }

  // Fallback: segment with minimum attention (the top dropoff point)
  const att = persona.attentions ?? [];
  if (!att.length) return null;
  let minVal = att[0];
  let minIdx = 0;
  for (let i = 1; i < att.length; i++) {
    if (att[i] < minVal) { minVal = att[i]; minIdx = i; }
  }
  return minIdx;
}

// ==========================================================================
// Extract per-path metrics from an aggregated PredictionResult
// ==========================================================================
function extractMetrics(
  result: PredictionResult,
): PathRunMetrics {
  const behavioral_score = (result as unknown as { behavioral_score?: number }).behavioral_score ?? 0;
  const heatmap = result.heatmap ?? null;
  const avgCurveRange = computeAvgCurveRange(heatmap);

  const personaCount = heatmap?.personas?.length ?? 0;
  const swipeSegments: (number | null)[] = [];
  for (let i = 0; i < personaCount; i++) {
    swipeSegments.push(swipeSegmentIndex(heatmap, i));
  }

  return {
    behavioral_score,
    avgCurveRange,
    swipeSegments,
    cost_cents: result.cost_cents ?? 0,
    overall_score: result.overall_score ?? null,
  };
}

// ==========================================================================
// Average two PathRunMetrics across R8 band (2 runs)
// swipeSegments: use run1 values (representative; segment ordering is stable)
// ==========================================================================
function avgMetrics(run1: PathRunMetrics, run2: PathRunMetrics): AvgMetrics {
  return {
    behavioral_score: (run1.behavioral_score + run2.behavioral_score) / 2,
    avgCurveRange: (run1.avgCurveRange + run2.avgCurveRange) / 2,
    swipeSegments: run1.swipeSegments,  // representative (run1 ordering is stable)
    cost_cents: run1.cost_cents + run2.cost_cents,
    overall_score:
      run1.overall_score !== null && run2.overall_score !== null
        ? (run1.overall_score + run2.overall_score) / 2
        : (run1.overall_score ?? run2.overall_score),
  };
}

// ==========================================================================
// 3-metric composite computation (D-03.2)
// ==========================================================================
function computeComposite(
  videoId: string,
  fold: AvgMetrics,
  tenpass: AvgMetrics,
  foldCallCount: number,
  tenpassCallCount: number,
): VideoVerdict {
  // Metric 1: behavioral parity
  const parityDelta = Math.abs(fold.behavioral_score - tenpass.behavioral_score);
  const parityOk = parityDelta <= 5;

  // Metric 2: diversity (avgCurveRange ratio)
  const diversityRatio = tenpass.avgCurveRange > 0
    ? fold.avgCurveRange / tenpass.avgCurveRange
    : fold.avgCurveRange > 0 ? Infinity : 1;
  const diversityOk = diversityRatio >= 0.8;
  const diversityBeat = diversityRatio >= 1.0;

  // Metric 3: drop-point agreement (>=6/10 archetypes within ±1 segment)
  const n = Math.max(fold.swipeSegments.length, tenpass.swipeSegments.length);
  let agreeCount = 0;
  for (let i = 0; i < n; i++) {
    const fSeg = fold.swipeSegments[i];
    const tSeg = tenpass.swipeSegments[i];
    if (fSeg !== null && tSeg !== null && Math.abs(fSeg - tSeg) <= 1) {
      agreeCount++;
    }
  }
  const dropAgreementOk = agreeCount >= 6;

  // R7 assertion: fold=1, tenpass=20
  const r7Ok = foldCallCount === 1 && tenpassCallCount === 20;

  // Verdict
  let verdict: "reproduce" | "beat" | "miss";
  if (parityOk && diversityOk && dropAgreementOk) {
    verdict = diversityBeat ? "beat" : "reproduce";
  } else {
    verdict = "miss";
  }

  return {
    videoId,
    parityDelta: +parityDelta.toFixed(2),
    parityOk,
    diversityRatio: +diversityRatio.toFixed(3),
    diversityOk,
    diversityBeat,
    dropAgreementCount: agreeCount,
    dropAgreementOk,
    verdict,
    foldBehavioralScore: +fold.behavioral_score.toFixed(1),
    tenpassBehavioralScore: +tenpass.behavioral_score.toFixed(1),
    foldAvgRange: +fold.avgCurveRange.toFixed(3),
    tenpassAvgRange: +tenpass.avgCurveRange.toFixed(3),
    foldCallCount,
    tenpassCallCount,
    r7Ok,
  };
}

// ==========================================================================
// Logging helper — mirrors measure-pipeline.ts stage_end printout
// ==========================================================================
function makeOnEvent(videoId: string, run: number, source: string): (e: StageEvent) => void {
  return (e: StageEvent) => {
    if (e.type === "stage_end") {
      const se = e as { stage: string; duration_ms: number; cost_cents: number; ok: boolean; warning?: string };
      console.log(
        `  [${videoId}][run${run}][${source}] END ${se.stage.padEnd(32)} ${se.duration_ms}ms  $${se.cost_cents.toFixed(4)}${se.ok ? "" : "  !!FAIL " + (se.warning ?? "")}`,
      );
    }
  };
}

// ==========================================================================
// Main
// ==========================================================================

async function main() {
  // Env guard — copied verbatim from measure-pipeline.ts:37-40
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase env missing");
  if (!process.env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY missing");

  // Guard: refuse to run against placeholder paths
  const hasPlaceholders = VIDEO_SET.some((v) => v.path.startsWith("PLACEHOLDER_PATH"));
  if (hasPlaceholders) {
    throw new Error(
      "VIDEO_SET contains placeholder paths — replace with confirmed local file paths before running the referee.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const verdicts: VideoVerdict[] = [];

  for (const video of VIDEO_SET) {
    console.log(`\n========== VIDEO: ${video.id} ==========`);

    // Upload once; run both paths on the same pipelineResult (D-10 — same run, no upload variance)
    // Use the file's actual extension (.mp4 or .mov etc.) — do NOT transcode.
    const buf = readFileSync(video.path);
    const extMatch = video.path.match(/\.([^.]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "mp4";
    const contentType = ext === "mov" ? "video/quicktime" : "video/mp4";
    const storagePath = `ab-referee/${video.id}-${Date.now()}.${ext}`;
    console.log(
      `[referee] uploading ${video.path} (${(buf.length / 1e6).toFixed(1)}MB, ${contentType}) → videos/${storagePath}`,
    );

    const up = await supabase.storage.from("videos").upload(storagePath, buf, {
      contentType,
      upsert: true,
    });
    if (up.error) throw new Error(`upload failed for ${video.id}: ${up.error.message}`);

    const input: AnalysisInput = {
      input_mode: "video_upload",
      video_storage_path: storagePath,
      content_type: "video",
      niche: "fitness", // TODO: per-video niche from VIDEO_SET entry if needed
    };

    // Per-video run accumulators (R8 band: 2 runs each path, averaged)
    const foldRuns: PathRunMetrics[] = [];
    const tenpassRuns: PathRunMetrics[] = [];
    // Per-video call-count accumulators across 2 runs
    let totalFoldCalls = 0;
    let totalTenpassCalls = 0;

    try {
      // × 2 runs (R8 band — provider-noise measurement)
      for (let run = 1; run <= 2; run++) {
        console.log(`\n-- run ${run}/2 --`);

        // ----------------------------------------------------------------
        // Pipeline call with useFold:true so foldOutcome is populated.
        // One pipeline call per run; both aggregateScores paths consume it.
        // Stage events are tracked for R7 call-count assertion.
        // ----------------------------------------------------------------
        const counter = makeEventCounter();
        const logOnEvent = makeOnEvent(video.id, run, "pipeline");
        const combinedOnEvent = (e: StageEvent) => {
          counter.onEvent(e);
          logOnEvent(e);
        };

        const t0 = performance.now();
        // useFold:true — enables foldOutcome in PipelineResult for the fold path.
        // pipeline.ts:880 duck-types this as (opts as {useFold?:boolean})?.useFold
        // (same pattern as ENGINE_USE_FOLD=1) so the flag is safe to pass here
        // without modifying PipelineOptions.
        const pipelineOpts = {
          requestId: `ab-referee-${video.id}-r${run}-${Date.now()}`,
          bypassCache: true,
          useFold: true,
          onStageEvent: combinedOnEvent,
        } as Parameters<typeof runPredictionPipeline>[1];
        const pipelineResult = await runPredictionPipeline(input, pipelineOpts);
        const pipeLatencyMs = +(performance.now() - t0).toFixed(0);

        // R7: count audience-sim LLM calls from stage events
        const foldCalls = counter.getFoldCalls();
        const tenpassCalls = counter.getTenpassCalls();
        totalFoldCalls += foldCalls;
        totalTenpassCalls += tenpassCalls;
        console.log(
          `  [run ${run}] R7 assertion: foldCalls=${foldCalls} (expect 1)  tenpassCalls=${tenpassCalls} (expect 20)  pipelineMs=${pipeLatencyMs}`,
        );

        // ----------------------------------------------------------------
        // Path A: personas (current 10-pass behavioral aggregate)
        // ----------------------------------------------------------------
        const personasOpts: AggregateScoresOptions = { behavioralSource: "personas" };
        const personasResult = await aggregateScores(
          pipelineResult,
          makeOnEvent(video.id, run, "personas"),
          personasOpts,
        );
        const tenpassMetrics = extractMetrics(personasResult);
        tenpassRuns.push(tenpassMetrics);
        totalCostCents += tenpassMetrics.cost_cents;
        if (totalCostCents > COST_CAP_CENTS) {
          console.warn(
            `[referee] COST CAP EXCEEDED: ${totalCostCents.toFixed(0)}c > ${COST_CAP_CENTS}c — stopping`,
          );
          throw new Error(`Cost cap exceeded: ${totalCostCents.toFixed(0)}c`);
        }

        // ----------------------------------------------------------------
        // Path B: fold (single-call Audience-Sim)
        // ----------------------------------------------------------------
        const foldOpts: AggregateScoresOptions = { behavioralSource: "fold" };
        const foldResult = await aggregateScores(
          pipelineResult,
          makeOnEvent(video.id, run, "fold"),
          foldOpts,
        );
        const foldMetrics = extractMetrics(foldResult);
        foldRuns.push(foldMetrics);
        totalCostCents += foldMetrics.cost_cents;
        if (totalCostCents > COST_CAP_CENTS) {
          console.warn(
            `[referee] COST CAP EXCEEDED: ${totalCostCents.toFixed(0)}c > ${COST_CAP_CENTS}c — stopping`,
          );
          throw new Error(`Cost cap exceeded: ${totalCostCents.toFixed(0)}c`);
        }

        console.log(
          `  [run ${run}] behavioral parity: personas=${tenpassMetrics.behavioral_score}  fold=${foldMetrics.behavioral_score}  Δ=${Math.abs(foldMetrics.behavioral_score - tenpassMetrics.behavioral_score).toFixed(1)}`,
        );
        console.log(
          `  [run ${run}] avgCurveRange: personas=${tenpassMetrics.avgCurveRange.toFixed(3)}  fold=${foldMetrics.avgCurveRange.toFixed(3)}  ratio=${tenpassMetrics.avgCurveRange > 0 ? (foldMetrics.avgCurveRange / tenpassMetrics.avgCurveRange).toFixed(3) : "n/a"}`,
        );
        console.log(
          `  [run ${run}] totalCost=${totalCostCents.toFixed(0)}c`,
        );
      }
    } finally {
      // Cleanup — mirror measure-pipeline.ts:170
      await supabase.storage.from("videos").remove([storagePath]);
      console.log(`[referee] cleaned up videos/${storagePath}`);
    }

    // R8 band: average the 2 runs
    const avgFold    = avgMetrics(foldRuns[0],    foldRuns[1]);
    const avgTenpass = avgMetrics(tenpassRuns[0], tenpassRuns[1]);

    // Average call counts over 2 runs (should be consistent: 1 fold, 20 tenpass per run)
    const avgFoldCalls    = Math.round(totalFoldCalls    / 2);
    const avgTenpassCalls = Math.round(totalTenpassCalls / 2);

    // Compute 3-metric composite
    const verdict = computeComposite(video.id, avgFold, avgTenpass, avgFoldCalls, avgTenpassCalls);
    verdicts.push(verdict);
  }

  // ==========================================================================
  // Per-video table (D-03 / R10)
  // ==========================================================================
  console.log("\n========== REFEREE RESULTS — PER-VIDEO TABLE ==========");
  console.log(
    `${"Video ID".padEnd(20)}  ${"Parity Δ".padStart(8)}  ${"OK?".padStart(4)}  ${"DivRatio".padStart(8)}  ${"OK?".padStart(4)}  ${"DropAgr".padStart(7)}  ${"OK?".padStart(4)}  ${"R7 OK?".padStart(6)}  Verdict`,
  );
  console.log("─".repeat(100));

  for (const v of verdicts) {
    const parityStr  = `${v.parityDelta.toFixed(2)} (≤5)`;
    const divStr     = `${v.diversityRatio.toFixed(3)} (≥0.8)`;
    const dropStr    = `${v.dropAgreementCount}/10 (≥6)`;
    console.log(
      `${v.videoId.padEnd(20)}  ${parityStr.padStart(8)}  ${(v.parityOk ? "✓" : "✗").padStart(4)}  ${divStr.padStart(8)}  ${(v.diversityOk ? "✓" : "✗").padStart(4)}  ${dropStr.padStart(7)}  ${(v.dropAgreementOk ? "✓" : "✗").padStart(4)}  ${(v.r7Ok ? "✓" : "✗").padStart(6)}  ${v.verdict.toUpperCase()}`,
    );
    console.log(
      `  fold: behavioral=${v.foldBehavioralScore}  avgRange=${v.foldAvgRange}  calls=${v.foldCallCount}`,
    );
    console.log(
      `  10ps: behavioral=${v.tenpassBehavioralScore}  avgRange=${v.tenpassAvgRange}  calls=${v.tenpassCallCount}`,
    );
  }

  // ==========================================================================
  // Overall advisory verdict (D-05)
  // Advisory only — do NOT process.exit(1) on metric misses.
  // process.exit(1) is reserved for infra failures above (matching measure-pipeline.ts:175-178).
  // ==========================================================================
  const total          = verdicts.length;
  const reproduceCount = verdicts.filter((v) => v.verdict === "reproduce" || v.verdict === "beat").length;
  const beatCount      = verdicts.filter((v) => v.verdict === "beat").length;
  const r7AllOk        = verdicts.every((v) => v.r7Ok);

  const allParityOk    = verdicts.every((v) => v.parityOk);
  const allDiversityOk = verdicts.every((v) => v.diversityOk);
  const allDropOk      = verdicts.every((v) => v.dropAgreementOk);

  let overallVerdict: string;
  if (reproduceCount === total && beatCount === total) {
    overallVerdict = "BEAT (fold outperforms 10-pass on all videos)";
  } else if (reproduceCount === total) {
    overallVerdict = "REPRODUCE (fold within all bands on all videos)";
  } else if (reproduceCount >= Math.ceil(total * 0.67)) {
    overallVerdict = `PARTIAL (${reproduceCount}/${total} videos pass — human judgment needed)`;
  } else {
    overallVerdict = `MISS (${reproduceCount}/${total} videos pass — fold needs improvement)`;
  }

  console.log("\n========== ADVISORY OVERALL VERDICT ==========");
  console.log(`Videos tested:     ${total} (of 6 D-04 set — ${6 - total} deferred)`);
  console.log(`Reproduce/beat:    ${reproduceCount}/${total}`);
  console.log(`Beat:              ${beatCount}/${total}`);
  console.log(`Parity all OK:     ${allParityOk ? "YES" : "NO"}`);
  console.log(`Diversity all OK:  ${allDiversityOk ? "YES" : "NO"}`);
  console.log(`Drop-agree all OK: ${allDropOk ? "YES" : "NO"}`);
  console.log(`R7 call-count OK:  ${r7AllOk ? "YES (fold=1, tenpass=20 on all videos)" : "NO — check per-video R7 column"}`);
  console.log(`Total cost:        ${totalCostCents.toFixed(0)}c / cap ${COST_CAP_CENTS}c`);
  console.log(`\nVERDICT: ${overallVerdict}`);
  console.log("\nNOTE (D-05): This verdict is advisory. The human (Plan 05) makes the final");
  console.log("production-flip decision. If the fold misses on 1 video but curves are");
  console.log("qualitatively good, proceed with D-10 shadow mode.");

  process.exit(0);
}

main().catch((e) => {
  console.error("[ab-referee] FATAL:", e);
  process.exit(1);
});
