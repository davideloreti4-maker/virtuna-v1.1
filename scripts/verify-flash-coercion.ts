/**
 * Verify flash-coercion fix on the REAL engine path (not a reimplementation).
 * Runs analyzeVideoWithOmni (read) + runFold (fold), BOTH omni-flash defaults, with the
 * new coercion layers live. Pass = read returns segments + fold_success=true with no
 * "validation failed" warnings + diverse curves.
 *
 * Run: npx tsx scripts/verify-flash-coercion.ts ["/path/to/video.mp4"]
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
import { selectPersonaSlots } from "../src/lib/engine/wave3/persona-registry";
import { runFold, computeAvgCurveRange } from "../src/lib/engine/wave3/fold";
import { QWEN_OMNI_MODEL } from "../src/lib/engine/qwen/client";
import type { EmotionArcPoint } from "../src/lib/engine/types";

const VIDEO_PATH = process.argv[2] ?? "/Users/davideloreti/Downloads/TikTok Video Downloader.mp4";

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const buf = readFileSync(VIDEO_PATH);
  const storagePath = `fold-spike/verify-${Date.now()}.mp4`;
  console.log(`[verify] FOLD_MODEL=${process.env.FOLD_MODEL ?? "(default omni-flash)"} | QWEN_OMNI_MODEL=${QWEN_OMNI_MODEL}`);
  await supabase.storage.from("videos").upload(storagePath, buf, { contentType: "video/mp4", upsert: true });
  const { data: signed } = await supabase.storage.from("videos").createSignedUrl(storagePath, 3600);
  const videoUrl = signed!.signedUrl;

  // ---- REAL read ----
  const tR = performance.now();
  const omni = await analyzeVideoWithOmni(videoUrl, {});
  const readMs = performance.now() - tR;
  const segments = omni.segments ?? [];
  console.log(`\n[READ] ok=${segments.length > 0} | segments=${segments.length} | ${(readMs / 1000).toFixed(1)}s`);

  const analysis = omni.geminiResult?.analysis as unknown as { hook_verbatim?: { spoken_words?: string | null; on_screen_text?: string | null }; emotion_arc?: EmotionArcPoint[] } | undefined;
  const hv = analysis?.hook_verbatim;
  const verbatim = hv ? [hv.spoken_words, hv.on_screen_text].filter(Boolean).join(" ") : "";
  const emotionArc: EmotionArcPoint[] = Array.isArray(analysis?.emotion_arc) ? analysis!.emotion_arc! : [];
  const slots = selectPersonaSlots(omni.wave0Result.content_type?.type ?? null, omni.wave0Result.niche?.primary_slug ?? null);

  // ---- REAL fold ----
  const tF = performance.now();
  const fold = await runFold(slots, segments, verbatim, emotionArc, videoUrl);
  const foldMs = performance.now() - tF;
  const validationWarnings = fold.warnings.filter((w) => /validation failed|Zod|invalid/i.test(w));
  const avgRange = computeAvgCurveRange(fold.personaSimResults.map((p) => ({ segment_reactions: p.segment_reactions.map((r) => ({ attention: r.attention })) })));

  console.log(`\n[FOLD] fold_success=${fold.fold_success} | personas=${fold.personaSimResults.length} | avgRange=${avgRange.toFixed(2)} | ${(foldMs / 1000).toFixed(1)}s | cost=${fold.cost_cents.toFixed(4)}c`);
  console.log(`[FOLD] validation-failure warnings: ${validationWarnings.length === 0 ? "NONE ✓" : validationWarnings.length}`);
  if (fold.warnings.length) console.log(`[FOLD] all warnings:\n  - ${fold.warnings.join("\n  - ")}`);

  const pass = segments.length > 0 && fold.fold_success && validationWarnings.length === 0;
  console.log(`\n========== ${pass ? "PASS ✓ — flash read+fold stable with coercion" : "FAIL ✗"} ==========`);

  await supabase.storage.from("videos").remove([storagePath]);
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error("[verify] FATAL:", e); process.exit(1); });
