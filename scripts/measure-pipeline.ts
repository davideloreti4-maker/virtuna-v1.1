/**
 * E2E pipeline latency probe (throwaway — measurement only).
 *
 * Uploads a local video to Supabase `videos` bucket, runs the REAL engine
 * (runPredictionPipeline + aggregateScores) exactly as /api/analyze does,
 * and reconstructs a wall-clock timeline from StageEvents.
 *
 * Answers the two questions the whole optimization plan branches on:
 *   1. Are the 10 Pass-2 personas actually parallel, or does DashScope serialize?
 *   2. Do Stage 10 (critique) + Stage 11 (counterfactuals) overlap, or serialize?
 *
 * Run: npx tsx scripts/measure-pipeline.ts ["/path/to/video.mp4"]
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { register } from "tsconfig-paths";
import { readFileSync } from "fs";
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

import { createClient } from "@supabase/supabase-js";
import { runPredictionPipeline } from "../src/lib/engine/pipeline";
import { aggregateScores } from "../src/lib/engine/aggregator";
import type { StageEvent } from "../src/lib/engine/events";
import type { AnalysisInput } from "../src/lib/engine/types";

const VIDEO_PATH = process.argv[2] ?? "/Users/davideloreti/Downloads/TikTok Video Downloader.mp4";

const s = (ms: number) => (ms / 1000).toFixed(1).padStart(6) + "s";

interface Rec { t: number; e: StageEvent }

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase env missing");
  if (!process.env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY missing");
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const buf = readFileSync(VIDEO_PATH);
  const storagePath = `smoke-measure/${Date.now()}.mp4`;
  console.log(`[measure] video=${VIDEO_PATH} (${(buf.length / 1e6).toFixed(1)}MB)`);
  console.log(`[measure] uploading → videos/${storagePath}`);
  const up = await supabase.storage.from("videos").upload(storagePath, buf, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (up.error) throw new Error("upload failed: " + up.error.message);

  const input: AnalysisInput = {
    input_mode: "video_upload",
    video_storage_path: storagePath,
    content_type: "video",
    niche: "fitness",
  };

  const t0 = performance.now();
  const recs: Rec[] = [];
  const onEvent = (e: StageEvent) => {
    const t = performance.now() - t0;
    recs.push({ t, e });
    if (e.type === "stage_end")
      console.log(`  [${s(t)}] END    ${e.stage.padEnd(30)} ${String(e.duration_ms).padStart(6)}ms  $${e.cost_cents.toFixed(4)}${e.ok ? "" : "  !!FAIL " + (e.warning ?? "")}`);
    else if (e.type === "stage_start")
      console.log(`  [${s(t)}] start  ${e.stage}`);
    else if (e.type === "pass2_persona_start")
      console.log(`  [${s(t)}] p2 →   ${e.archetype}`);
    else if (e.type === "pass2_persona_end")
      console.log(`  [${s(t)}] p2 END ${e.archetype.padEnd(24)} ${String(e.latency_ms).padStart(6)}ms${e.ok ? "" : "  !!FAIL"}`);
    else if (e.type === "pipeline_warning")
      console.log(`  [${s(t)}] WARN   ${e.message}`);
  };

  console.log("\n========== PIPELINE ==========");
  const tPipe = performance.now();
  const pipelineResult = await runPredictionPipeline(input, {
    requestId: "measure-" + Date.now(),
    bypassCache: true,
    onStageEvent: onEvent,
  });
  const pipeMs = performance.now() - tPipe;

  console.log("\n========== AGGREGATE (post-pipeline tail) ==========");
  const tAgg = performance.now();
  const result = await aggregateScores(pipelineResult, onEvent);
  const aggMs = performance.now() - tAgg;

  const totalMs = performance.now() - t0;

  // ---- Pass-2 concurrency ----
  const p2Starts = recs.filter((r) => r.e.type === "pass2_persona_start");
  const p2Ends = recs.filter((r) => r.e.type === "pass2_persona_end") as Array<{ t: number; e: Extract<StageEvent, { type: "pass2_persona_end" }> }>;
  let p2Verdict = "n/a (no pass2 events)";
  if (p2Ends.length) {
    const sumLat = p2Ends.reduce((a, r) => a + r.e.latency_ms, 0);
    const spanStart = Math.min(...p2Starts.map((r) => r.t));
    const spanEnd = Math.max(...p2Ends.map((r) => r.t));
    const wall = spanEnd - spanStart;
    const ratio = sumLat / wall; // ~N => parallel, ~1 => serial
    p2Verdict = `${p2Ends.length} personas | sum(latency)=${(sumLat / 1000).toFixed(1)}s | wall=${(wall / 1000).toFixed(1)}s | ratio=${ratio.toFixed(1)}x  → ${ratio > 4 ? "PARALLEL" : ratio < 1.6 ? "SERIALIZED" : "PARTIAL"}`;
  }

  // ---- Stage10 vs Stage11 overlap ----
  const find = (type: "stage_start" | "stage_end", stage: string) =>
    recs.find((r) => r.e.type === type && (r.e as { stage: string }).stage === stage)?.t;
  const s10s = find("stage_start", "stage_10_critique");
  const s10e = find("stage_end", "stage_10_critique");
  const s11s = find("stage_start", "stage_11_counterfactuals");
  const s11e = find("stage_end", "stage_11_counterfactuals");
  let critVerdict = "n/a";
  if (s10s != null && s10e != null && s11s != null && s11e != null) {
    const overlap = Math.min(s10e, s11e) - Math.max(s10s, s11s);
    const wall = Math.max(s10e, s11e) - Math.min(s10s, s11s);
    critVerdict = `stage10=${((s10e - s10s) / 1000).toFixed(1)}s stage11=${((s11e - s11s) / 1000).toFixed(1)}s | wall=${(wall / 1000).toFixed(1)}s | overlap=${(overlap / 1000).toFixed(1)}s → ${overlap > 2000 ? "PARALLEL" : "SERIALIZED"}`;
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`pipeline wall      : ${(pipeMs / 1000).toFixed(1)}s`);
  console.log(`aggregate tail     : ${(aggMs / 1000).toFixed(1)}s`);
  console.log(`TOTAL_LATENCY_MS   : ${Math.round(totalMs)}`);
  console.log(`TOTAL              : ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`engine latency_ms  : ${(result.latency_ms ?? 0) / 1000}s   cost_cents=${result.cost_cents}`);
  // Greppable score line — used by Plan 06 pre/post diff (D3.2 anchor)
  console.log(`OVERALL_SCORE=${result.overall_score} CONFIDENCE=${result.confidence} LABEL=${result.confidence_label}`);
  // Behavioral driver (40% weight) — the field most exposed to the deepseek-overlap
  // (Pass 1 grounding) change. Watch this across the A/B.
  const pba = result.persona_behavioral_aggregate as Record<string, unknown> | null;
  console.log(`behavioral_score   : ${(result as Record<string, unknown>).behavioral_score ?? "—"} | gemini_score=${(result as Record<string, unknown>).gemini_score ?? "—"}`);
  if (pba) console.log(`persona_aggregate  : watch=${pba.avg_watch_through_pct ?? pba.watch_through_pct ?? "?"} scroll=${pba.avg_scroll_past_second ?? "?"} share=${pba.avg_share_intent ?? "?"}`);
  console.log(`counterfactuals    : ${result.counterfactuals ? "PRESENT band=" + result.counterfactuals.band : "NULL (schema fail / timeout)"}`);
  if (result.counterfactuals) {
    for (const sug of result.counterfactuals.suggestions)
      console.log(`    · [${sug.type}] ${sug.headline} — ${sug.detail.slice(0, 120)}`);
  }
  console.log(`critique           : ${result.critique ? "PRESENT" : "NULL"}`);
  console.log(`emotion_arc        : ${result.emotion_arc ? result.emotion_arc.length + " pts" : "NULL"}`);
  console.log(`factors            : ${result.factors?.length ?? 0}`);
  console.log(`personas (heatmap) : ${result.heatmap?.personas?.length ?? 0}`);
  console.log(`\nPASS-2 CONCURRENCY : ${p2Verdict}`);
  console.log(`STAGE10/11         : ${critVerdict}`);

  // ---- Pass-2 CURVE QUALITY (heatmap A/B: does a lower thinking budget flatten it?) ----
  console.log(`\nPASS-2 CURVE QUALITY (thinking_budget=${process.env.PASS2_THINKING_BUDGET ?? "8000 default"}):`);
  let nSwipe = 0;
  const ranges: number[] = [];
  for (const r of p2Ends) {
    const att = r.e.attentions ?? [];
    if (!att.length) continue;
    const min = Math.min(...att), max = Math.max(...att);
    const range = +(max - min).toFixed(2);
    ranges.push(range);
    const swipe = r.e.swipe_predicted_at;
    if (swipe != null) nSwipe++;
    const curve = att.map((a) => a.toFixed(2)).join(" ");
    console.log(`  ${r.e.archetype.padEnd(22)} range=${range.toFixed(2)} swipe@${swipe ?? "—"}  [${curve}]`);
  }
  const avgRange = ranges.length ? +(ranges.reduce((a, b) => a + b, 0) / ranges.length).toFixed(2) : 0;
  console.log(`  AGGREGATE: avg curve range=${avgRange} (higher=more varied, ~0=flat) | personas w/ real swipe=${nSwipe}/${p2Ends.length}`);

  // Top stages by duration
  const ends = recs
    .filter((r) => r.e.type === "stage_end")
    .map((r) => ({ stage: (r.e as { stage: string }).stage, ms: (r.e as { duration_ms: number }).duration_ms }))
    .sort((a, b) => b.ms - a.ms);
  console.log(`\nSTAGES BY DURATION (stage_end events):`);
  for (const e of ends) console.log(`  ${String(e.ms).padStart(7)}ms  ${e.stage}`);

  await supabase.storage.from("videos").remove([storagePath]);
  console.log(`\n[measure] cleaned up videos/${storagePath}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[measure] FATAL:", e);
  process.exit(1);
});
