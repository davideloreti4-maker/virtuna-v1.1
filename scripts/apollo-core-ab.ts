/**
 * apollo-core-ab.ts — §2.6 behavioral-layer A/B validation.
 *
 * For each video: Omni watches ONCE → sensor signals. Then the reasoner runs TWICE on the
 * SAME signals, deterministic (temp:0 + seed):
 *   - CONTROL   = KNOWLEDGE-CORE with the §2.6 behavioral layer stripped out
 *   - TREATMENT = KNOWLEDGE-CORE as-is (with §2.6)
 * Prints both assessments + a diff (composite delta, §2.6 citation count) so we can judge
 * whether §2.6 fires, moves the score sanely, and adds insight without regressions.
 *
 * Usage: pnpm tsx scripts/apollo-core-ab.ts "<video.mp4>" [more...]
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
  console.error('Usage: pnpm tsx scripts/apollo-core-ab.ts "<video.mp4>" ...');
  process.exit(1);
}

const CORE_PATH = resolve(__dirname, "../.planning/corpus/KNOWLEDGE-CORE.md");

const APOLLO_INSTRUCTION = `You are Apollo, the expert short-form content assessor defined by the Knowledge Core above. It is your ONLY rubric — do not invent criteria outside it.

You are handed the structured SENSOR signals for one TikTok video (JSON below), produced by a multimodal model that watched it. Using strictly the Knowledge Core frameworks, produce your assessment:

Follow the §4 OUTPUT CONTRACT exactly:
1. PER-DIMENSION (§4): grade each dimension **Strong / Mid / Weak**. Name the §2 lever that fired/failed + quote the sensor signal as evidence. No vibes.
2. ANTI-PATTERNS (§3): flag any present.
3. COMPOSITE: ONE 0–100 holistic, hook-weighted judgment (§2.0a ~80%). Name the single ceiling-capper. No per-dimension numbers; it is a judgment, not arithmetic.
4. CONFIDENCE: scope down for any §2 signal the sensor did NOT provide; say which you couldn't observe.
5. HIGHEST-LEVERAGE FIX: the single change, tied to a §2/§3 lever, quoting the relevant signal.

Cite section numbers (e.g. §2.1, §2.0a, §2.6.3) so the reasoning is auditable. Be specific and concrete.`;

/** Remove §2.6 Behavioral layer (incl. §2.6.1–§2.6.7) up to the next top-level "## 3." section. */
function stripBehavioralLayer(core: string): string {
  const stripped = core.replace(/### 2\.6 Behavioral layer[\s\S]*?(?=\n## 3\. )/, "");
  if (stripped === core) {
    console.warn("  [ab] WARNING: §2.6 strip matched nothing — control may equal treatment!");
  }
  return stripped;
}

function extractComposite(text: string): string {
  // First "NN/100" after a COMPOSITE mention, else first NN/100 anywhere.
  const near = text.match(/COMPOSITE[\s\S]{0,240}?(\d{1,3})\s*\/\s*100/i);
  if (near) return near[1];
  const any = text.match(/(\d{1,3})\s*\/\s*100/);
  return any ? any[1] : "?";
}

const count = (text: string, re: RegExp) => (text.match(re) || []).length;

function toMp4(path: string): Buffer {
  if (extname(path).toLowerCase() === ".mp4") return readFileSync(path);
  const out = resolve(tmpdir(), `apollo-ab-${Date.now()}.mp4`);
  console.log(`  [transcode] ${extname(path)} → mp4 …`);
  execFileSync("ffmpeg", ["-y", "-i", path, "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", out], { stdio: "ignore" });
  return readFileSync(out);
}

async function reason(ai: any, core: string, signalBundle: unknown): Promise<string> {
  const c = await ai.chat.completions.create({
    model: QWEN_REASONING_MODEL,
    messages: [
      { role: "system", content: `${core}\n\n---\n\n${APOLLO_INSTRUCTION}` },
      { role: "user", content: `SENSOR SIGNALS (JSON):\n\n${JSON.stringify(signalBundle, null, 2)}` },
    ],
    temperature: 0,
    seed: QWEN_SEED,
  });
  return c.choices[0]?.message?.content ?? "(no output)";
}

async function runOne(supabase: any, ai: any, fullCore: string, strippedCore: string, videoPath: string) {
  console.log(`\n\n████████████████████████████████████████████████████████████`);
  console.log(`█ VIDEO: ${basename(videoPath)}`);
  console.log(`████████████████████████████████████████████████████████████`);

  const bytes = toMp4(videoPath);
  const path = `apollo-ab/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const up = await supabase.storage.from("videos").upload(path, bytes, { contentType: "video/mp4", upsert: true });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);
  const signed = await supabase.storage.from("videos").createSignedUrl(path, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`signed URL failed: ${signed.error?.message}`);

  console.log("  [ab] Omni watching …");
  const t0 = Date.now();
  const omni = await analyzeVideoWithOmni(signed.data.signedUrl);
  console.log(`  [ab] Omni ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const signalBundle = {
    content_type: omni.wave0Result?.content_type,
    niche: omni.wave0Result?.niche,
    audio_perceptual_score: omni.audio_perceptual_score,
    signalAvailability: omni.signalAvailability,
    analysis: omni.geminiResult?.analysis ?? null,
    segments: omni.segments,
  };

  console.log("  [ab] reasoner → CONTROL (no §2.6) …");
  const control = await reason(ai, strippedCore, signalBundle);
  console.log("  [ab] reasoner → TREATMENT (with §2.6) …");
  const treatment = await reason(ai, fullCore, signalBundle);

  console.log(`\n──────────── CONTROL (core MINUS §2.6) ────────────\n`);
  console.log(control);
  console.log(`\n──────────── TREATMENT (core WITH §2.6) ────────────\n`);
  console.log(treatment);

  console.log(`\n════════════ A/B DIFF — ${basename(videoPath)} ════════════`);
  console.log(`Composite:   control=${extractComposite(control)}/100   treatment=${extractComposite(treatment)}/100`);
  console.log(`§2.6 cites:  control=${count(control, /§2\.6/g)}   treatment=${count(treatment, /§2\.6/g)}   (does the layer fire?)`);
  console.log(`Behavioral terms (authority/composure/limbic/identity/compliance) — control=${count(control, /\b(authority|composure|limbic|identity|compliance|pre-perception)\b/gi)} treatment=${count(treatment, /\b(authority|composure|limbic|identity|compliance|pre-perception)\b/gi)}`);
  console.log(`Length:      control=${control.length}ch   treatment=${treatment.length}ch`);

  await supabase.storage.from("videos").remove([path]).catch(() => {});
}

async function main() {
  const fullCore = readFileSync(CORE_PATH, "utf-8");
  const strippedCore = stripBehavioralLayer(fullCore);
  console.log(`[ab] full core ${(fullCore.length / 4) | 0}~tok · stripped ${(strippedCore.length / 4) | 0}~tok (Δ ${((fullCore.length - strippedCore.length) / 4) | 0}~tok = §2.6) · ${videoPaths.length} video(s)`);
  const supabase = createServiceClient();
  const ai = getQwenClient();
  for (const v of videoPaths) {
    try { await runOne(supabase, ai, fullCore, strippedCore, v); }
    catch (e: any) { console.error(`\n  [ab] FAILED on ${basename(v)}: ${e?.message ?? e}`); }
  }
  console.log("\n[ab] done.");
}

main().catch((e) => { console.error("[ab] FATAL:", e?.message ?? e); process.exit(1); });
