/**
 * A/B Fold Referee — real-API skeleton (Wave 0).
 *
 * Runs the prediction pipeline on fixed referee videos twice via each path:
 *   Path A: behavioralSource="personas"  (current 10-pass Wave-3)
 *   Path B: behavioralSource="fold"      (1-call Audience-Sim fold — Plan 03)
 * × 2 runs each (R8 band — provider-noise tolerance), per video.
 *
 * NOTE: This is NOT corpus/eval-harness.ts. The corpus harness is a
 * bucket-classifier benchmark (macro-F1 over training_corpus →
 * benchmark_results) — structurally wrong for a fold-vs-10-pass
 * retention-curve A/B (RESEARCH Pitfall 2 / Don't-Hand-Roll). It stays
 * dormant. CONTEXT D-04 said 'revive eval-harness'; RESEARCH overrides
 * with evidence — build fresh on the measure-pipeline.ts scaffold.
 *
 * 3-metric composite (D-03.2) is TODO Plan 04 — this skeleton collects the
 * raw per-video/per-path results and leaves the scoring stub marked.
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

// ==========================================================================
// Cost cap — T-04-COST mitigation (self-inflicted DoS guard)
// 6 videos × 2 paths × 2 runs = 24 pipeline invocations.
// Each run ~ 4 LLM calls (~$0.08) → upper bound ~$2 = 200 cents.
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
// ==========================================================================
const VIDEO_SET: { id: string; path: string }[] = [
  { id: "gwxLeHphZCxK", path: "/Users/davideloreti/Downloads/TikTok Video Downloader.mp4" },
  { id: "IMG_0012",     path: "/Users/davideloreti/Downloads/IMG_0012.mov" },
];

// ==========================================================================
// Types
// ==========================================================================
interface RunResult {
  videoId: string;
  run: number; // 1 or 2
  source: "personas" | "fold";
  overall_score: number | null;
  cost_cents: number;
  latency_ms: number | null;
  avgCurveRange: number | null; // D-03.2 / D-07 — computed after fold path lands
  error?: string;
}

interface RefereeVerdict {
  videoId: string;
  // TODO Plan 04: 3-metric composite (D-03.2)
  // Metrics: avgCurveRange parity, drop-point agreement, intent-score correlation
  verdict: "PENDING_COMPOSITE"; // placeholder — Plan 04 fills this
}

// ==========================================================================
// Helpers
// ==========================================================================

function makeOnEvent(videoId: string, run: number, source: string) {
  return (e: StageEvent) => {
    if (e.type === "stage_end") {
      console.log(`  [${videoId}][run${run}][${source}] END ${e.stage.padEnd(28)} ${e.duration_ms}ms  $${e.cost_cents.toFixed(4)}${e.ok ? "" : " !!FAIL"}`);
    }
  };
}

async function runPath(
  pipelineResult: Awaited<ReturnType<typeof runPredictionPipeline>>,
  source: "personas" | "fold",
  onEvent: (e: StageEvent) => void,
): Promise<{ overall_score: number | null; cost_cents: number }> {
  const opts: AggregateScoresOptions = {
    behavioralSource: source === "personas" ? "personas" : (
      // @ts-expect-error — "fold" not yet in the union; Plan 03 adds it and removes this comment
      "fold"
    ),
  };
  const result = await aggregateScores(pipelineResult, onEvent, opts);
  return {
    overall_score: result.overall_score ?? null,
    cost_cents: result.cost_cents ?? 0,
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

  const allRuns: RunResult[] = [];

  for (const video of VIDEO_SET) {
    console.log(`\n========== VIDEO: ${video.id} ==========`);

    // Upload once; run both paths on the same pipelineResult (D-10 — same run, no upload variance)
    // Use the file's actual extension (.mp4 or .mov etc.) — do NOT transcode.
    const buf = readFileSync(video.path);
    const extMatch = video.path.match(/\.([^.]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : "mp4";
    const contentType = ext === "mov" ? "video/quicktime" : "video/mp4";
    const storagePath = `ab-referee/${video.id}-${Date.now()}.${ext}`;
    console.log(`[referee] uploading ${video.path} (${(buf.length / 1e6).toFixed(1)}MB, ${contentType}) → videos/${storagePath}`);

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

    try {
      // × 2 runs (R8 band — provider-noise measurement)
      for (let run = 1; run <= 2; run++) {
        console.log(`\n-- run ${run}/2 --`);

        const t0 = performance.now();
        const onEvent = makeOnEvent(video.id, run, "pipeline");
        const pipelineResult = await runPredictionPipeline(input, {
          requestId: `ab-referee-${video.id}-r${run}-${Date.now()}`,
          bypassCache: true,
          onStageEvent: onEvent,
        });
        const pipeLatencyMs = performance.now() - t0;

        // Path A: personas
        const personasResult = await runPath(pipelineResult, "personas", makeOnEvent(video.id, run, "personas"));
        totalCostCents += personasResult.cost_cents;
        if (totalCostCents > COST_CAP_CENTS) {
          console.warn(`[referee] COST CAP EXCEEDED: ${totalCostCents.toFixed(0)}c > ${COST_CAP_CENTS}c — stopping`);
          throw new Error(`Cost cap exceeded: ${totalCostCents.toFixed(0)}c`);
        }

        allRuns.push({
          videoId: video.id,
          run,
          source: "personas",
          overall_score: personasResult.overall_score,
          cost_cents: personasResult.cost_cents,
          latency_ms: pipeLatencyMs,
          avgCurveRange: null, // populated post-fold in Plan 03 when heatmap is available
        });

        // Path B: fold
        const foldResult = await runPath(pipelineResult, "fold", makeOnEvent(video.id, run, "fold"));
        totalCostCents += foldResult.cost_cents;
        if (totalCostCents > COST_CAP_CENTS) {
          console.warn(`[referee] COST CAP EXCEEDED: ${totalCostCents.toFixed(0)}c > ${COST_CAP_CENTS}c — stopping`);
          throw new Error(`Cost cap exceeded: ${totalCostCents.toFixed(0)}c`);
        }

        allRuns.push({
          videoId: video.id,
          run,
          source: "fold",
          overall_score: foldResult.overall_score,
          cost_cents: foldResult.cost_cents,
          latency_ms: null,
          avgCurveRange: null, // TODO Plan 03: extract from foldOutcome.pass2Results
        });

        console.log(`  [run ${run}] personas score=${personasResult.overall_score}  fold score=${foldResult.overall_score}  totalCost=${totalCostCents.toFixed(0)}c`);
      }
    } finally {
      // Cleanup — mirror measure-pipeline.ts:170
      await supabase.storage.from("videos").remove([storagePath]);
      console.log(`[referee] cleaned up videos/${storagePath}`);
    }
  }

  // ==========================================================================
  // Per-video verdicts
  // TODO Plan 04: 3-metric composite (D-03.2)
  // Metrics:
  //   1. avgCurveRange parity:   foldAvgRange >= 0.8 × tenPassAvgRange
  //   2. Drop-point agreement:   fold and 10-pass agree on scroll_past_second band ±X%
  //   3. Intent-score correlation: Pearson r(fold_intents, personas_intents) >= threshold
  // Verdict per video: PASS / FAIL / DEGRADE (graceful — see D-03)
  // ==========================================================================
  const verdicts: RefereeVerdict[] = VIDEO_SET.map((v) => ({
    videoId: v.id,
    verdict: "PENDING_COMPOSITE", // TODO Plan 04: compute from allRuns
  }));

  console.log("\n========== REFEREE RESULTS ==========");
  console.log("Raw runs:");
  for (const r of allRuns) {
    console.log(`  ${r.videoId}  run${r.run}  ${r.source.padEnd(10)}  score=${String(r.overall_score).padStart(3)}  cost=${r.cost_cents.toFixed(4)}c`);
  }
  console.log("\nVerdicts (pending Plan 04 composite):");
  for (const v of verdicts) {
    console.log(`  ${v.videoId}  ${v.verdict}`);
  }
  console.log(`\nTotal cost: ${totalCostCents.toFixed(0)}c / cap ${COST_CAP_CENTS}c`);

  process.exit(0);
}

main().catch((e) => {
  console.error("[ab-referee] FATAL:", e);
  process.exit(1);
});
