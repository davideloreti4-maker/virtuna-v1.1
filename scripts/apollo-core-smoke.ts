/**
 * Apollo KNOWLEDGE-CORE — validation smoke test (A/B), batch.
 *
 * For each video:
 *   1. Host the mp4 → Supabase signed URL (transcode non-mp4 via ffmpeg first).
 *   2. Qwen-Omni watches it → structured sensor signals + its OWN generic
 *      "expert analyst" factor scores (the baseline).
 *   3. Reasoning Qwen reads the SAME signals with KNOWLEDGE-CORE.md as system
 *      prompt → grounded, framework-cited assessment (the interpreter under test).
 *   4. Print both side by side.
 *
 * Usage: pnpm tsx scripts/apollo-core-smoke.ts "<a.mp4>" "<b.mov>" ...
 */
import { config } from "dotenv";
import { resolve, basename, extname } from "path";
import { readFileSync } from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
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

const videoPaths = process.argv.slice(2);
if (videoPaths.length === 0) {
  console.error('Usage: pnpm tsx scripts/apollo-core-smoke.ts "<a.mp4>" "<b.mov>" ...');
  process.exit(1);
}

const CORE_PATH = resolve(__dirname, "../.planning/corpus/KNOWLEDGE-CORE.md");

const APOLLO_INSTRUCTION = `You are Apollo, the expert short-form content assessor defined by the Knowledge Core above. It is your ONLY rubric — do not invent criteria outside it.

You are handed the structured SENSOR signals for one TikTok video (JSON below), produced by a multimodal model that watched it. Using strictly the Knowledge Core frameworks, produce your assessment:

Follow the §4 OUTPUT CONTRACT exactly:
1. PER-DIMENSION (§4): grade each dimension **Strong / Mid / Weak** (not letters, not 0–100 per dim). Name the §2 lever that fired/failed + quote the sensor signal as evidence. No vibes.
2. ANTI-PATTERNS (§3): flag any present.
3. COMPOSITE: ONE 0–100 holistic, hook-weighted judgment (§2.0a ~80%). Name the single ceiling-capper. No per-dimension numbers; it is a judgment, not arithmetic.
4. CONFIDENCE: scope down for any §2 signal the sensor did NOT provide; say which you couldn't observe.
5. HIGHEST-LEVERAGE FIX: the single change, tied to a §2/§3 lever, quoting the relevant signal.

Cite section numbers (e.g. §2.1, §2.0a) so the reasoning is auditable. Be specific and concrete.`;

/** Omni/DashScope wants mp4; transcode anything else (e.g. .mov) first. */
function toMp4(path: string): Buffer {
  if (extname(path).toLowerCase() === ".mp4") return readFileSync(path);
  const out = resolve(tmpdir(), `apollo-${Date.now()}.mp4`);
  console.log(`  [transcode] ${extname(path)} → mp4 …`);
  execFileSync("ffmpeg", ["-y", "-i", path, "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", out], { stdio: "ignore" });
  return readFileSync(out);
}

async function runOne(supabase: any, ai: any, core: string, videoPath: string) {
  console.log(`\n\n████████████████████████████████████████████████████████████`);
  console.log(`█ VIDEO: ${basename(videoPath)}`);
  console.log(`████████████████████████████████████████████████████████████`);

  const bytes = toMp4(videoPath);
  const path = `apollo-smoke/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const up = await supabase.storage.from("videos").upload(path, bytes, { contentType: "video/mp4", upsert: true });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);
  const signed = await supabase.storage.from("videos").createSignedUrl(path, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`signed URL failed: ${signed.error?.message}`);

  console.log("  [smoke] Omni watching …");
  const t0 = Date.now();
  const omni = await analyzeVideoWithOmni(signed.data.signedUrl);
  console.log(`  [smoke] Omni ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const analysis = omni.geminiResult?.analysis ?? null;
  // Fattened bundle: pass the FULL omni output (minus cost) so §2.0a / §2.1 checks see everything Omni emits.
  const signalBundle = {
    content_type: omni.wave0Result?.content_type,
    niche: omni.wave0Result?.niche,
    audio_perceptual_score: omni.audio_perceptual_score,
    signalAvailability: omni.signalAvailability,
    analysis,
    segments: omni.segments,
  };

  console.log("\n  ── BASELINE (Omni generic factors) ──");
  if (analysis?.factors) for (const f of analysis.factors) console.log(`     ${f.name.padEnd(20)} ${f.score}/10`);
  console.log(`     overall: ${analysis?.overall_impression ?? "n/a"}`);

  console.log("\n  [smoke] Apollo reasoner (core) …");
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
  console.log(`  [smoke] reasoner ${((Date.now() - t1) / 1000).toFixed(1)}s\n`);
  console.log("  ── UNDER TEST (KNOWLEDGE-CORE assessment) ──\n");
  console.log(completion.choices[0]?.message?.content ?? "(no output)");

  await supabase.storage.from("videos").remove([path]).catch(() => {});
}

async function main() {
  const core = readFileSync(CORE_PATH, "utf-8");
  console.log(`[smoke] core: ${(core.length / 4) | 0} ~tokens · ${videoPaths.length} video(s)`);
  const supabase = createServiceClient();
  const ai = getQwenClient();
  for (const v of videoPaths) {
    try { await runOne(supabase, ai, core, v); }
    catch (e: any) { console.error(`\n  [smoke] FAILED on ${basename(v)}: ${e?.message ?? e}`); }
  }
  console.log("\n[smoke] all done.");
}

main().catch((e) => { console.error("[smoke] FATAL:", e?.message ?? e); process.exit(1); });
