/**
 * LIVE HARNESS — the unified omni read against the modality split, same video, back to back.
 *
 * The spike (`scripts/omni-audio-split-spike.ts`) proved the split is POSSIBLE and priced it at
 * 58.4% cheaper on stripped prompts. It could not answer the two questions that decide whether
 * the flag should ever be flipped, because neither is visible offline:
 *
 *   1. LATENCY. The split adds ffmpeg (download + transcode + upload) to the critical path and
 *      then runs three calls where there was one. §6.3 of the handoff called this UNMEASURED.
 *      Production omni is ~17s today; the split has to come in near that or the saving is being
 *      paid for out of the user's waiting time.
 *   2. PARITY. Two models now perceive what one model perceived. Every number below feeds the
 *      fold and Apollo, so a systematic shift here moves the score on the board — exactly the
 *      way Apollo's move to flash graded ~30 composite points harsher.
 *
 * ⚠️ This prints the FULL read of both paths, not just the deltas, and that is the point. A
 * valid-looking JSON with plausible numbers proves nothing: the failure mode this whole design
 * guards against is a deaf model confidently scoring audio. Read the verbatim and the segment
 * alignment yourself — if the transcript is generic or the audio events do not match the scenes
 * they are attached to, the split is broken no matter how good the table looks.
 *
 * Usage:
 *   npx tsx scripts/omni-split-harness.ts <local-video.mp4>          # uploads, runs, cleans up
 *   npx tsx scripts/omni-split-harness.ts --path <videos/bucket/key> # uses an existing object
 *   npx tsx scripts/omni-split-harness.ts <video> --runs 3           # repeat for jitter
 *
 * Spends real money on DashScope. No Apify spend.
 */
import { config } from "dotenv";
import { resolve, basename } from "path";
import { readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { register } from "tsconfig-paths";

config({ path: resolve(__dirname, "../.env.local") });
const tsconfig = JSON.parse(readFileSync(resolve(__dirname, "../tsconfig.json"), "utf-8"));
register({ baseUrl: resolve(__dirname, ".."), paths: tsconfig.compilerOptions.paths });

// The unified path must run with the split OFF regardless of what .env.local says — the two
// legs are invoked directly below, so this only guards analyzeVideoWithOmni's own branch.
process.env.ENGINE_AUDIO_SPLIT = "false";

/* eslint-disable @typescript-eslint/no-require-imports */
const { createServiceClient } = require("../src/lib/supabase/service");
const { analyzeVideoWithOmni, assembleOmniOutput } = require("../src/lib/engine/qwen/omni-analysis");
const { runModalitySplit } = require("../src/lib/engine/qwen/split/run");
const { QWEN_OMNI_MODEL, QWEN_REASONING_MODEL } = require("../src/lib/engine/qwen/client");
/* eslint-enable @typescript-eslint/no-require-imports */

type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const argv = process.argv.slice(2);
const runsIdx = argv.indexOf("--runs");
const RUNS = runsIdx >= 0 ? Number(argv[runsIdx + 1]) : 1;
const pathIdx = argv.indexOf("--path");
const EXISTING_PATH = pathIdx >= 0 ? argv[pathIdx + 1] : null;
const videoPath = argv.find((a) => !a.startsWith("--") && a !== String(RUNS) && a !== EXISTING_PATH)
  ?? `${process.env.HOME}/Downloads/TikTok Video Downloader.mp4`;

const n = (v: unknown) => (v === null || v === undefined ? "—" : String(v));
const pad = (v: unknown, w: number) => n(v).padStart(w);

/** Pull the comparable view out of an assembled OmniAnalysisOutput, whichever path built it. */
function view(out: Any) {
  const a = out.geminiResult?.analysis ?? {};
  return {
    cost: out.geminiResult?.cost_cents ?? null,
    content_type: out.wave0Result?.content_type?.type ?? null,
    niche: out.wave0Result?.niche?.primary_slug ?? null,
    hook: a.hook_decomposition ?? {},
    video_signals: a.video_signals ?? {},
    audio_signals: a.audio_signals ?? {},
    cta: a.cta_segment ?? {},
    emotion_arc: a.emotion_arc ?? [],
    verbatim: a.hook_verbatim ?? {},
    aps: out.audio_perceptual_score ?? null,
    segments: out.segments ?? [],
  };
}

function row(label: string, u: unknown, s: unknown): string {
  const same = JSON.stringify(u) === JSON.stringify(s);
  const delta = typeof u === "number" && typeof s === "number" && u !== s
    ? `  ${s > u ? "+" : ""}${(s - u).toFixed(1)}`
    : "";
  return `  ${label.padEnd(28)} ${pad(u, 9)} ${pad(s, 9)}  ${same ? "=" : "≠"}${delta}`;
}

async function once(runIdx: number, signedUrl: string) {
  console.log(`\n${"═".repeat(78)}\n  RUN ${runIdx + 1} of ${RUNS}\n${"═".repeat(78)}`);

  // ── A. the unified read (what production does today) ──
  const tU = Date.now();
  const unified = await analyzeVideoWithOmni(signedUrl);
  const unifiedMs = Date.now() - tU;
  if (!unified.geminiResult) {
    console.log("  ❌ UNIFIED read FAILED — no baseline to compare against this run.");
    return null;
  }

  // ── B. the split (invoked at its real entry point) ──
  const tS = Date.now();
  const split = await runModalitySplit(signedUrl, {});
  const splitMs = Date.now() - tS;
  if (!split) {
    console.log(`  ❌ SPLIT returned null — it stood down and production would have fallen back.`);
    console.log(`     That is the DESIGNED degradation, not a crash. Check the logs above for which`);
    console.log(`     stage bailed (ffmpeg / a leg / coherence / the merge parse).`);
    return { unifiedMs, splitMs, failed: true };
  }
  const splitOut = assembleOmniOutput(split.data, split.cost_cents);

  const U = view(unified);
  const S = view(splitOut);

  console.log(`\n  ── LATENCY + COST ──`);
  console.log(`  ${"".padEnd(28)} ${"unified".padStart(9)} ${"split".padStart(9)}`);
  console.log(`  ${"wall clock (s)".padEnd(28)} ${pad((unifiedMs / 1000).toFixed(1), 9)} ${pad((splitMs / 1000).toFixed(1), 9)}` +
    `   ${splitMs <= unifiedMs ? "✅ no regression" : `⚠️ +${((splitMs - unifiedMs) / 1000).toFixed(1)}s SLOWER`}`);
  console.log(`  ${"cost (¢)".padEnd(28)} ${pad(U.cost?.toFixed(5), 9)} ${pad(S.cost?.toFixed(5), 9)}` +
    `   ${U.cost ? `${(((U.cost - S.cost) / U.cost) * 100).toFixed(1)}% saved` : ""}`);
  console.log(`     split breakdown — ffmpeg ${split.diagnostics.extract_ms}ms · legs ${split.diagnostics.legs_ms}ms · ` +
    `video ${split.diagnostics.video_cost_cents.toFixed(5)}¢ · audio ${split.diagnostics.audio_cost_cents.toFixed(5)}¢ · ` +
    `coherence ${split.diagnostics.coherence_cost_cents.toFixed(5)}¢`);
  console.log(`     mp3 ${(split.diagnostics.audio_bytes / 1024).toFixed(0)}KB · audio-leg retried: ${split.diagnostics.audio_leg_retried}`);

  console.log(`\n  ── PERCEPTION PARITY (every one of these feeds the fold and Apollo) ──`);
  console.log(`  ${"".padEnd(28)} ${"unified".padStart(9)} ${"split".padStart(9)}`);
  console.log(row("content_type", U.content_type, S.content_type));
  console.log(row("niche", U.niche, S.niche));
  console.log(row("hook.visual_stop_power", U.hook.visual_stop_power, S.hook.visual_stop_power));
  console.log(row("hook.audio_hook_quality", U.hook.audio_hook_quality, S.hook.audio_hook_quality));
  console.log(row("hook.text_overlay_score", U.hook.text_overlay_score, S.hook.text_overlay_score));
  console.log(row("hook.first_words_speech", U.hook.first_words_speech_score, S.hook.first_words_speech_score));
  console.log(row("hook.visual_audio_coherence", U.hook.visual_audio_coherence, S.hook.visual_audio_coherence));
  console.log(row("hook.cognitive_load", U.hook.cognitive_load, S.hook.cognitive_load));
  console.log(row("hook.weakest_modality", U.hook.weakest_modality, S.hook.weakest_modality));
  console.log(row("visual_production_quality", U.video_signals.visual_production_quality, S.video_signals.visual_production_quality));
  console.log(row("pacing_score", U.video_signals.pacing_score, S.video_signals.pacing_score));
  console.log(row("audio_perceptual_score", U.aps, S.aps));
  console.log(row("voice_clarity_0_10", U.audio_signals.voice_clarity_0_10, S.audio_signals.voice_clarity_0_10));
  console.log(row("voiceover_ratio", U.audio_signals.voiceover_ratio, S.audio_signals.voiceover_ratio));
  console.log(row("cta_present", U.cta.cta_present, S.cta.cta_present));
  console.log(row("cta_strength", U.cta.strength, S.cta.strength));
  console.log(row("emotion_arc points", U.emotion_arc.length, S.emotion_arc.length));
  console.log(row("segments", U.segments.length, S.segments.length));

  console.log(`\n  ── THE HONESTY CHECK: read these, do not scan them ──`);
  console.log(`  unified spoken : ${JSON.stringify(U.verbatim.spoken_words)}`);
  console.log(`  split   spoken : ${JSON.stringify(S.verbatim.spoken_words)}`);
  console.log(`  unified overlay: ${JSON.stringify(U.verbatim.on_screen_text)}`);
  console.log(`  split   overlay: ${JSON.stringify(S.verbatim.on_screen_text)}`);
  console.log(`  unified audio  : ${JSON.stringify(U.audio_signals.audio_description)}`);
  console.log(`  split   audio  : ${JSON.stringify(S.audio_signals.audio_description)}`);

  console.log(`\n  ── ALIGNMENT: does the audio attached to each scene actually belong to it? ──`);
  console.log(`     ${split.diagnostics.segments_without_audio} of ${S.segments.length} segments got NO audio event; ` +
    `${split.diagnostics.verbatim_truncated} had verbatim truncated; arc from ${split.diagnostics.emotion_arc_source}; ` +
    `cta from ${split.diagnostics.cta_source}`);
  for (const s of S.segments.slice(0, 10)) {
    console.log(`     ${String(s.t_start).padStart(5)}-${String(s.t_end).padEnd(5)}s  V: ${String(s.visual_event).slice(0, 44).padEnd(44)} A: ${String(s.audio_event).slice(0, 44)}`);
    if (s.spoken_text) console.log(`     ${" ".repeat(11)}  “${String(s.spoken_text).slice(0, 96)}”`);
  }

  const dump = resolve(tmpdir(), `omni-split-harness-${randomUUID().slice(0, 8)}.json`);
  writeFileSync(dump, JSON.stringify({ unified, split: splitOut, diagnostics: split.diagnostics }, null, 2));
  console.log(`\n  full JSON of both reads → ${dump}`);

  return {
    unifiedMs, splitMs, failed: false,
    unifiedCost: U.cost, splitCost: S.cost,
    coherence: [U.hook.visual_audio_coherence, S.hook.visual_audio_coherence] as const,
  };
}

async function main() {
  console.log(`\n████ OMNI MODALITY-SPLIT HARNESS ████`);
  console.log(`  unified : ${QWEN_OMNI_MODEL} watches + hears`);
  console.log(`  split   : ${QWEN_REASONING_MODEL} watches · ${QWEN_OMNI_MODEL} hears · ${QWEN_REASONING_MODEL} grades coherence`);

  const supabase = createServiceClient();
  let storagePath = EXISTING_PATH;
  let uploaded = false;

  if (!storagePath) {
    const bytes = readFileSync(videoPath);
    storagePath = `split-harness/${randomUUID()}.mp4`;
    console.log(`  video   : ${basename(videoPath)} (${(bytes.length / 1e6).toFixed(2)} MB) → ${storagePath}`);
    const up = await supabase.storage.from("videos").upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
    if (up.error) throw new Error(`video upload failed: ${up.error.message}`);
    uploaded = true;
  } else {
    console.log(`  video   : existing object ${storagePath}`);
  }

  const signed = await supabase.storage.from("videos").createSignedUrl(storagePath, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`sign failed: ${signed.error?.message}`);

  try {
    const results = [];
    for (let i = 0; i < RUNS; i++) results.push(await once(i, signed.data.signedUrl));

    const ok = results.filter((r): r is NonNullable<typeof r> => !!r && !r.failed);
    console.log(`\n${"═".repeat(78)}\n  VERDICT over ${ok.length}/${RUNS} comparable runs\n${"═".repeat(78)}`);
    if (ok.length === 0) {
      console.log(`  ❌ nothing to compare — see the per-run output above.`);
      return;
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const uMs = avg(ok.map((r) => r.unifiedMs)), sMs = avg(ok.map((r) => r.splitMs));
    const uC = avg(ok.map((r) => r.unifiedCost ?? 0)), sC = avg(ok.map((r) => r.splitCost ?? 0));
    console.log(`  latency : unified ${(uMs / 1000).toFixed(1)}s → split ${(sMs / 1000).toFixed(1)}s ` +
      `(${sMs <= uMs ? `${(((uMs - sMs) / uMs) * 100).toFixed(0)}% FASTER` : `${(((sMs - uMs) / uMs) * 100).toFixed(0)}% SLOWER`})`);
    console.log(`  cost    : unified ${uC.toFixed(5)}¢ → split ${sC.toFixed(5)}¢ ` +
      `(${uC ? (((uC - sC) / uC) * 100).toFixed(1) : "—"}% saved)`);
    console.log(`  coherence (unified vs split): ${ok.map((r) => r.coherence.join("/")).join("  ")}`);
    console.log(`\n  ⚠️ Cost and latency are the EASY half. Before flipping ENGINE_AUDIO_SPLIT, read the`);
    console.log(`     verbatim and the segment alignment above and satisfy yourself the split heard and`);
    console.log(`     saw the same video the unified read did.\n`);
  } finally {
    if (uploaded) await supabase.storage.from("videos").remove([storagePath]).catch(() => {});
  }
}

main().catch((e) => { console.error("\n[omni-split-harness] FATAL:", e?.stack ?? e?.message ?? e); process.exit(1); });
