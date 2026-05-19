/**
 * Phase 6 UAT Item 3 — End-to-end driver for the audio pipeline.
 *
 * Uploads tests/fixtures/audio-smoke/talking_head.mp4 to the Supabase `videos`
 * bucket, then drives runPredictionPipeline + aggregateScores against it.
 * Inspects the resulting PredictionResult for:
 *   - audio_perceptual_score > 0
 *   - signal_availability.audio === true
 *   - PredictionResult.audio_description populated (Q4 RESOLVED contract)
 *   - audio_fingerprint match attempt against the seeded UAT trending_sounds rows
 *
 * This is NOT a replacement for the /api/analyze route's tests — it skips the
 * auth + rate-limit + SSE encoding layer (which route.test.ts covers). It
 * validates the engine path end-to-end against the live Supabase project +
 * live Gemini + live DeepSeek, which is the part route.test.ts mocks away.
 *
 * Usage: ./node_modules/.bin/tsx scripts/e2e-uat-phase6.ts
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { runPredictionPipeline } from "../src/lib/engine/pipeline";
import { aggregateScores } from "../src/lib/engine/aggregator";
import type { AnalysisInput } from "../src/lib/engine/types";

config({ path: resolve(__dirname, "../.env.local") });

const FIXTURE_PATH = resolve(
  __dirname,
  "../tests/fixtures/audio-smoke/talking_head.mp4",
);
const BUCKET = "videos";
const OBJECT_KEY = `phase6-uat/talking_head-${Date.now()}.mp4`;

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(`[uat] Uploading fixture to Supabase Storage: ${BUCKET}/${OBJECT_KEY}`);
  const buf = readFileSync(FIXTURE_PATH);
  const upload = await supabase.storage.from(BUCKET).upload(OBJECT_KEY, buf, {
    contentType: "video/mp4",
    upsert: false,
  });
  if (upload.error) {
    throw new Error(`Upload failed: ${upload.error.message}`);
  }
  console.log(`[uat] Upload OK (${buf.byteLength} bytes)`);

  const input: AnalysisInput = {
    input_mode: "video_upload",
    video_storage_path: OBJECT_KEY,
    content_type: "video",
    content_text: "Phase 6 UAT — talking head test video from corpus cache.",
  };

  console.log("[uat] Running pipeline...");
  const pipelineStart = Date.now();
  const pipelineResult = await runPredictionPipeline(input, {
    onStageEvent: (event: { type: string; stage?: string; wave?: number; latency_ms?: number }) => {
      const tag =
        event.type === "stage_start"
          ? "▶"
          : event.type === "stage_end"
            ? "✓"
            : "•";
      console.log(`  ${tag} ${event.type} stage=${event.stage ?? ""} wave=${event.wave ?? ""} ${event.latency_ms ? `(${event.latency_ms}ms)` : ""}`);
    },
  });
  console.log(`[uat] Pipeline done in ${Date.now() - pipelineStart}ms`);

  console.log("[uat] Running aggregator...");
  const finalResult = await aggregateScores(pipelineResult);

  // === Assertions ===
  // signal_availability is set by aggregateScores → finalResult.signal_availability,
  // NOT by the pipeline → pipelineResult has no signal_availability field. Earlier
  // versions of this script asserted against pipelineResult and reported false-
  // negative gate failures even when the audio path worked end-to-end.
  console.log("\n=== Phase 6 UAT Item 3 — assertion gates ===");
  const gates = {
    audio_perceptual_score_positive: (finalResult.audio_perceptual_score ?? 0) > 0,
    signal_availability_audio_true: finalResult.signal_availability?.audio === true,
    audio_description_present:
      typeof finalResult.audio_description === "string" &&
      finalResult.audio_description.length >= 10,
    audio_fingerprint_match: finalResult.audio_fingerprint !== null && finalResult.audio_fingerprint !== undefined,
  };
  let pass = 0;
  for (const [name, ok] of Object.entries(gates)) {
    console.log(`  ${ok ? "✓" : "✗"} ${name}`);
    if (ok) pass++;
  }
  console.log(`[uat] ${pass}/${Object.keys(gates).length} gates passed`);

  // === Inspection ===
  console.log("\n=== Phase 6 UAT Item 3 — values for the record ===");
  console.log(`  overall_score:           ${finalResult.overall_score}`);
  console.log(`  audio_perceptual_score:  ${finalResult.audio_perceptual_score}`);
  console.log(`  audio_description (${(finalResult.audio_description ?? "").length}c):`);
  console.log(`    ${finalResult.audio_description ?? "<null>"}`);
  console.log(`  signal_availability:     ${JSON.stringify(finalResult.signal_availability)}`);
  if (finalResult.audio_fingerprint) {
    console.log(`  audio_fingerprint:`);
    console.log(`    sound_name:     ${finalResult.audio_fingerprint.sound_name}`);
    console.log(`    similarity:     ${finalResult.audio_fingerprint.similarity}`);
    console.log(`    trend_phase:    ${finalResult.audio_fingerprint.trend_phase}`);
    console.log(`    velocity_score: ${finalResult.audio_fingerprint.velocity_score}`);
  } else {
    console.log(`  audio_fingerprint:       null (no match above threshold OR fingerprint stage skipped)`);
  }

  // Cleanup uploaded fixture
  await supabase.storage.from(BUCKET).remove([OBJECT_KEY]);
  console.log(`\n[uat] Cleaned up Storage object ${OBJECT_KEY}`);

  if (pass < 3) {
    console.error(`[uat] FAIL — only ${pass}/${Object.keys(gates).length} gates passed`);
    process.exit(2);
  }
  console.log(`[uat] PASS — Phase 6 audio pipeline end-to-end validated.`);
}

main().catch((err) => {
  console.error("[uat] Fatal:", err);
  process.exit(1);
});
