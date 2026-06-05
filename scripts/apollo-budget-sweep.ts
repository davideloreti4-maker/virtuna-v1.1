/**
 * Apollo (deepseek) thinking-budget sweep — latency ↔ insight-quality curve.
 * THROWAWAY measurement harness (quick/20260605-engine-latency-quality-spine-ab).
 *
 * Runs omni ONCE on a test video, caches its analysis, then fires the Apollo
 * reasoner at each thinking_budget against IDENTICAL input — so the only variable
 * is the budget. Dumps latency + the full hero insight (composite + 6 dimensions +
 * rewrites + confidence_scope) at each level for a manual depth eyeball.
 *
 * Run: npx tsx scripts/apollo-budget-sweep.ts ["/path/to/video.mp4"]
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { register } from "tsconfig-paths";
import { readFileSync } from "fs";
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

import { createClient } from "@supabase/supabase-js";
import { analyzeVideoWithOmni } from "../src/lib/engine/qwen/omni-analysis";
import { reasonWithDeepSeek } from "../src/lib/engine/deepseek";
import type { AnalysisInput } from "../src/lib/engine/types";

const VIDEO_PATH = process.argv[2] ?? "/Users/davideloreti/Downloads/TikTok Video Downloader.mp4";
const BUDGETS = [3000, 2000, 1500, 1000];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase env missing");
  if (!process.env.DASHSCOPE_API_KEY) throw new Error("DASHSCOPE_API_KEY missing");
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const buf = readFileSync(VIDEO_PATH);
  const storagePath = `smoke-measure/apollo-sweep-${Date.now()}.mp4`;
  console.log(`[sweep] video=${VIDEO_PATH} (${(buf.length / 1e6).toFixed(1)}MB)`);
  const up = await supabase.storage.from("videos").upload(storagePath, buf, {
    contentType: "video/mp4",
    upsert: true,
  });
  if (up.error) throw new Error("upload failed: " + up.error.message);
  const signed = await supabase.storage.from("videos").createSignedUrl(storagePath, 3600);
  if (signed.error || !signed.data) throw new Error("sign failed");

  // ---- omni ONCE ----
  console.log(`[sweep] running omni once …`);
  const tOmni = performance.now();
  const omni = await analyzeVideoWithOmni(signed.data.signedUrl, {});
  console.log(`[sweep] omni done in ${((performance.now() - tOmni) / 1000).toFixed(1)}s`);
  const analysis = omni.geminiResult?.analysis;
  if (!analysis) throw new Error("omni returned no analysis");

  const hookRaw = (analysis as unknown as {
    hook_verbatim?: { spoken_words?: string | null; on_screen_text?: string | null };
  })?.hook_verbatim;
  const verbatim = hookRaw
    ? { hook: { spoken_words: hookRaw.spoken_words ?? null, on_screen_text: hookRaw.on_screen_text ?? null } }
    : null;

  const input: AnalysisInput = {
    input_mode: "video_upload",
    video_storage_path: storagePath,
    content_type: "video",
    niche: "fitness",
  };
  const baseCtx = {
    input,
    gemini_analysis: analysis,
    rule_result: { rule_score: 50, matched_rules: [] },
    trend_enrichment: { trend_score: 0, matched_trends: [], trend_context: "n/a", hashtag_relevance: 0 },
    creator_context: "",
    verbatim,
  };

  // ---- deepseek at each budget (serial → clean latency) ----
  for (const budget of BUDGETS) {
    const t = performance.now();
    const out = await reasonWithDeepSeek(baseCtx, { thinkingBudgetOverride: budget });
    const ms = performance.now() - t;
    console.log(`\n========== BUDGET=${budget} ==========`);
    if (!out) {
      console.log(`  FAILED (null — circuit open or retries exhausted)`);
      continue;
    }
    const r = out.reasoning;
    console.log(`  latency        : ${(ms / 1000).toFixed(1)}s   cost=${out.cost_cents.toFixed(4)}¢`);
    console.log(`  composite_score: ${r.composite_score}   confidence=${r.confidence}`);
    console.log(`  confidence_scope: ${r.confidence_scope}`);
    console.log(`  dimensions:`);
    for (const d of r.dimensions) {
      console.log(`    · ${d.name.padEnd(12)} ${d.band.padEnd(7)} | ${d.lever}`);
      console.log(`        evidence: ${d.evidence}`);
    }
    console.log(`  rewrites:`);
    for (const rw of r.rewrites) {
      console.log(`    · [${rw.lever_fixed}]`);
      console.log(`        orig: ${rw.original}`);
      console.log(`        var : ${rw.variant}`);
    }
  }

  // cleanup
  await supabase.storage.from("videos").remove([storagePath]);
  console.log(`\n[sweep] done — cleaned up ${storagePath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
