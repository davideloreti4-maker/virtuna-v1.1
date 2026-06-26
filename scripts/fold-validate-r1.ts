/**
 * R1′ live validation — drive the REAL production fold (runFold) on one video.
 *
 * Unlike the stale scripts/fold-audio-ab.ts (which reimplements the call inline and tests
 * the RETIRED omni-plus/omni-flash variants at 4000 tokens), this exercises the ACTUAL
 * shipped path after R1′ Part A:
 *   - one omni-flash Wave 0 read (the shared sensor input)
 *   - the real exported runFold(...) → FOLD_MODEL=qwen3.7-plus, sighted/deaf, max_tokens 8000,
 *     enable_thinking:false, independence directive, 2×45s bounded retry with the
 *     temperature-perturbing diversity nudge (FOLD_DIVERSITY_RETRY_TEMP=0.7).
 *
 * Answers the #1 verification debt (HANDOFF-R1-engine.md §1):
 *   1. latency — does the fold fit the 90s ceiling (2×45s) on 3.7-plus?
 *   2. diversity — does avgCurveRange clear DIVERSITY_FLOOR (0.10; healthy 0.27–0.41)?
 *   3. score sanity — are the audience intents/blend plausible?
 *   4. cost — ¢ per fold (the fold logs costCents).
 *
 * Usage: pnpm tsx scripts/fold-validate-r1.ts ["<video.mp4>"]
 * Evidence-only: edits NO engine file. Uploads the video to Supabase storage, deletes after.
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
const { runFold, computeAvgCurveRange, DIVERSITY_FLOOR } = require("../src/lib/engine/wave3/fold");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { selectPersonaSlots } = require("../src/lib/engine/wave3/persona-registry");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { QWEN_REASONING_MODEL } = require("../src/lib/engine/qwen/client");

const videoPath = process.argv[2] || `${process.env.HOME}/Downloads/TikTok Video Downloader.mp4`;
const FOLD_CEILING_MS = 90_000; // PER_CALL_TIMEOUT_MS hard ceiling (2×45s attempts)

function toMp4(p: string): Buffer {
  if (extname(p).toLowerCase() === ".mp4") return readFileSync(p);
  const out = resolve(tmpdir(), `fold-r1-${process.pid}.mp4`);
  execFileSync("ffmpeg", ["-y", "-i", p, "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", out], { stdio: "ignore" });
  return readFileSync(out);
}

const num = (x: unknown) => (typeof x === "number" ? x : 0);

async function main() {
  console.log(`\n████ R1′ FOLD LIVE VALIDATION ████`);
  console.log(`  video : ${basename(videoPath)}`);
  console.log(`  fold  : runFold() · model=${process.env.FOLD_MODEL ?? QWEN_REASONING_MODEL} · ceiling=${FOLD_CEILING_MS / 1000}s\n`);

  const supabase = createServiceClient();
  const bytes = toMp4(videoPath);
  const path = `fold-r1/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const up = await supabase.storage.from("videos").upload(path, bytes, { contentType: "video/mp4", upsert: true });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);
  const signed = await supabase.storage.from("videos").createSignedUrl(path, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`signed URL failed: ${signed.error?.message}`);
  const videoUrl = signed.data.signedUrl;

  try {
    // ── Shared Wave 0 sensor read (omni-flash) ──────────────────────────────
    console.log("  [1/2] Wave 0 omni read (shared input) …");
    const t0 = Date.now();
    const omni = await analyzeVideoWithOmni(videoUrl);
    const omniMs = Date.now() - t0;
    if (!omni.geminiResult?.analysis) throw new Error("Omni null analysis");
    const a = omni.geminiResult.analysis;
    const segments = omni.segments ?? [];
    const hookRaw = (a as any)?.hook_verbatim;
    const verbatim = hookRaw ? [hookRaw.spoken_words, hookRaw.on_screen_text].filter(Boolean).join(" ") : "";
    const emotionArc = Array.isArray((a as any)?.emotion_arc) ? (a as any).emotion_arc : [];
    const slots = selectPersonaSlots(omni.wave0Result?.content_type?.type ?? null, omni.wave0Result?.niche?.primary_slug ?? null);
    console.log(`        ${(omniMs / 1000).toFixed(1)}s · segments=${segments.length} · slots=${slots.length} · verbatim="${verbatim.slice(0, 60)}…"`);

    if (segments.length === 0) throw new Error("no segments from omni read — fold is skipped in prod for this input (text/url mode)");

    // ── The REAL production fold ────────────────────────────────────────────
    console.log(`\n  [2/2] runFold() — the real shipped path …`);
    const t1 = Date.now();
    const outcome = await runFold(slots, segments, verbatim, emotionArc, videoUrl);
    const foldMs = Date.now() - t1;

    const personas = outcome.personaSimResults ?? [];
    const pass2 = outcome.pass2Results ?? [];
    const avgRange = computeAvgCurveRange(pass2);
    const diverse = avgRange >= DIVERSITY_FLOOR;
    const fitsCeiling = foldMs <= FOLD_CEILING_MS;

    // audience-score proxy — the fold blend (PLAN: 0.50·completion + 0.25·share + 0.15·save + 0.10·comment)
    const mean = (f: (p: any) => number) => personas.length ? +(personas.reduce((s: number, p: any) => s + f(p), 0) / personas.length).toFixed(1) : 0;
    const mWatch = mean((p) => num(p.watch_through_pct));
    const mShare = mean((p) => num(p.share_intent));
    const mSave = mean((p) => num(p.save_intent));
    const mComment = mean((p) => num(p.comment_intent));
    const mRewatch = mean((p) => num(p.rewatch_intent));
    const blend = +(0.5 * mWatch + 0.25 * mShare + 0.15 * mSave + 0.1 * mComment).toFixed(1);

    // per-segment mean attention curve (across personas)
    const nSeg = segments.length;
    const curve: number[] = [];
    for (let i = 0; i < nSeg; i++) {
      const vals = pass2.map((p: any) => p.segment_reactions[i]?.attention).filter((x: any) => typeof x === "number");
      curve.push(vals.length ? +(vals.reduce((x: number, y: number) => x + y, 0) / vals.length).toFixed(2) : 0);
    }

    console.log(`        ${(foldMs / 1000).toFixed(1)}s · fold_success=${outcome.fold_success} · personas=${personas.length}\n`);

    console.log("  ═══════════════════ R1′ FOLD RESULT ═══════════════════");
    console.log(`  fold_success      : ${outcome.fold_success ? "✅ true" : "❌ false"}`);
    console.log(`  LATENCY           : ${(foldMs / 1000).toFixed(1)}s   ${fitsCeiling ? "✅ fits 90s ceiling" : "❌ OVER 90s ceiling"}`);
    console.log(`  DIVERSITY (range) : ${avgRange}   ${diverse ? "✅ ≥ floor" : "❌ < floor"} ${DIVERSITY_FLOOR} (healthy 0.27–0.41)`);
    console.log(`  COST              : ${outcome.cost_cents}¢`);
    console.log(`  ── audience-score proxy (0–100) ──`);
    console.log(`  mean watch_through: ${mWatch}%`);
    console.log(`  mean share/save/comment/rewatch: ${mShare} / ${mSave} / ${mComment} / ${mRewatch}`);
    console.log(`  blended score     : ${blend}  (0.50·watch + 0.25·share + 0.15·save + 0.10·comment)`);
    console.log(`  ── per-segment mean attention curve ──`);
    console.log(`  [${curve.join(", ")}]`);
    console.log(`  ── per-persona watch% (eyeball spread) ──`);
    for (const p of personas) console.log(`    ${String(p.archetype).padEnd(26)} watch=${num(p.watch_through_pct)}% share=${num(p.share_intent)} scroll@${num(p.scroll_past_second)}s`);
    if (outcome.warnings?.length) {
      console.log(`  ── warnings (${outcome.warnings.length}) — retry/diversity telemetry ──`);
      for (const w of outcome.warnings) console.log(`    • ${w}`);
    } else {
      console.log(`  warnings          : none (clean first-attempt parse, no diversity retry)`);
    }
    console.log("  ════════════════════════════════════════════════════════\n");

    const verdict = outcome.fold_success && fitsCeiling && diverse;
    console.log(`R1_VALIDATE_RESULT success=${outcome.fold_success} latency=${(foldMs / 1000).toFixed(0)}s/${FOLD_CEILING_MS / 1000}s fits=${fitsCeiling} diversity=${avgRange}/${DIVERSITY_FLOOR} pass=${diverse} cost=${outcome.cost_cents}c blend=${blend} VERDICT=${verdict ? "PASS" : "REVIEW"}`);
  } finally {
    await supabase.storage.from("videos").remove([path]).catch(() => {});
  }
}

main().catch((e) => { console.error("\n[fold-validate-r1] FATAL:", e?.stack ?? e?.message ?? e); process.exit(1); });
