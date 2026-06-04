/**
 * Apollo KNOWLEDGE-CORE — validation smoke test (A/B).
 *
 * Proves the distilled scoring brain works on a REAL video, inside the real
 * Qwen pipeline, isolating the core's delta vs the engine's generic judging:
 *
 *   1. Host the local mp4 → Supabase signed URL (same path the engine uses).
 *   2. Qwen-Omni (qwen3.5-omni-plus) watches it → structured sensor signals
 *      + its OWN generic "expert TikTok analyst" factor scores (the baseline).
 *   3. Reasoning Qwen (qwen3.6-plus) reads the SAME signals but with
 *      KNOWLEDGE-CORE.md as its system prompt → grounded, framework-cited
 *      assessment (the interpreter under test).
 *   4. Print both side by side so we can judge sharpness + band calibration.
 *
 * Usage: pnpm tsx scripts/apollo-core-smoke.ts "<path-to.mp4>"
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
const { analyzeVideoWithOmni } = require("../src/lib/engine/qwen/omni-analysis");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getQwenClient, QWEN_REASONING_MODEL, QWEN_SEED } = require("../src/lib/engine/qwen/client");

const videoPath = process.argv[2];
if (!videoPath) {
  console.error("Usage: pnpm tsx scripts/apollo-core-smoke.ts \"<path-to.mp4>\"");
  process.exit(1);
}

const CORE_PATH = resolve(__dirname, "../.planning/corpus/KNOWLEDGE-CORE.md");

const APOLLO_INSTRUCTION = `You are Apollo, the expert short-form content assessor defined by the Knowledge Core above. It is your ONLY rubric — do not invent criteria outside it.

You are handed the structured SENSOR signals for one TikTok video (JSON below), produced by a multimodal model that watched it. Using strictly the Knowledge Core frameworks, produce your assessment:

1. PER-DIMENSION (§4): for each scoring dimension, give a grade, name the specific §2 lever that fired or failed, and cite the evidence from the sensor signals. No vibes — point to the signal.
2. ANTI-PATTERNS (§3): flag any present.
3. COMPOSITE: a 0–100 score, weighted per §4 (hook ~80%). One line on what caps the ceiling.
4. CONFIDENCE: scope it down for any §2 signal the sensor did NOT provide; say which you couldn't observe.
5. HIGHEST-LEVERAGE FIX: the single change, tied to a §2/§3 lever, quoting the relevant signal.

Cite section numbers (e.g. §2.1, §2.0a) so the reasoning is auditable. Be specific and concrete.`;

async function main() {
  const core = readFileSync(CORE_PATH, "utf-8");
  const bytes = readFileSync(videoPath);
  console.log(`[smoke] video: ${videoPath} (${(bytes.length / 1e6).toFixed(1)} MB)`);
  console.log(`[smoke] core:  ${(core.length / 4) | 0} ~tokens\n`);

  const supabase = createServiceClient();
  const path = `apollo-smoke/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;

  console.log("[smoke] uploading → videos bucket …");
  const up = await supabase.storage.from("videos").upload(path, bytes, { contentType: "video/mp4", upsert: true });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);
  const signed = await supabase.storage.from("videos").createSignedUrl(path, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`signed URL failed: ${signed.error?.message}`);

  console.log("[smoke] Omni (qwen3.5-omni-plus) watching video …");
  const t0 = Date.now();
  const omni = await analyzeVideoWithOmni(signed.data.signedUrl);
  console.log(`[smoke] Omni done in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  const analysis = omni.geminiResult?.analysis ?? null;
  const signalBundle = {
    content_type: omni.wave0Result?.content_type,
    niche: omni.wave0Result?.niche,
    audio_perceptual_score: omni.audio_perceptual_score,
    analysis,
    segments: omni.segments,
  };

  // ---- BASELINE: Omni's own generic factor scores ----
  console.log("══════════════════════════════════════════════════════════");
  console.log(" BASELINE — Omni's generic 'expert analyst' judgment");
  console.log("══════════════════════════════════════════════════════════");
  if (analysis?.factors) {
    for (const f of analysis.factors) console.log(`  ${f.name.padEnd(20)} ${f.score}/10  — ${f.rationale}`);
  }
  console.log(`  overall: ${analysis?.overall_impression ?? "n/a"}\n`);

  // ---- UNDER TEST: KNOWLEDGE-CORE-grounded interpreter ----
  console.log("[smoke] Apollo reasoner (qwen3.6-plus + KNOWLEDGE-CORE) …");
  const ai = getQwenClient();
  const t1 = Date.now();
  const completion = await ai.chat.completions.create({
    model: QWEN_REASONING_MODEL,
    messages: [
      { role: "system", content: `${core}\n\n---\n\n${APOLLO_INSTRUCTION}` },
      { role: "user", content: `SENSOR SIGNALS (JSON):\n\n${JSON.stringify(signalBundle, null, 2)}` },
    ],
    temperature: 0,
    seed: QWEN_SEED,
  });
  console.log(`[smoke] reasoner done in ${((Date.now() - t1) / 1000).toFixed(1)}s\n`);

  console.log("══════════════════════════════════════════════════════════");
  console.log(" UNDER TEST — KNOWLEDGE-CORE grounded assessment");
  console.log("══════════════════════════════════════════════════════════\n");
  console.log(completion.choices[0]?.message?.content ?? "(no output)");

  // cleanup
  await supabase.storage.from("videos").remove([path]).catch(() => {});
  console.log(`\n[smoke] cleaned up temp upload. done.`);
}

main().catch((e) => {
  console.error("[smoke] FAILED:", e?.message ?? e);
  process.exit(1);
});
