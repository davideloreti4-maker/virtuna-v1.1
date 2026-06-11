/**
 * Fold AUDIO A/B harness — does the audience-sim need to HEAR the video?
 *
 * The fold (audience-sim) currently runs on qwen3.5-omni-plus, which WATCHES + HEARS
 * the video (v3.9 "sense-complete"). The proposal is to move it to qwen3.7-plus —
 * cheaper + newer, but DEAF (text/image/video in, NO audio). This rig answers the only
 * question that matters before that swap: does losing audio degrade the audience-sim?
 *
 * Method: ONE omni read (shared input), then fire the REAL fold call (runFold's exact
 * envelope: STABLE_FOLD_SYSTEM_PROMPT + buildFoldUserContent + FoldResponseSchema +
 * segment-count guard + computeAvgCurveRange) against each model variant, same segments/
 * verbatim/emotion-arc/slots. Compare diversity, drop-off moment, intents, latency, cost.
 *
 *   A = qwen3.5-omni-plus  (CURRENT — sighted + AUDIO, no thinking)
 *   B = qwen3.7-plus       (PROPOSED — sighted, DEAF, thinking on)
 *
 * Usage: pnpm tsx scripts/fold-audio-ab.ts "<video.mp4>"
 * Evidence-only: edits NO engine file.
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
const { getQwenClient, QWEN_SEED } = require("../src/lib/engine/qwen/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { STABLE_FOLD_SYSTEM_PROMPT, buildFoldUserContent, FoldResponseSchema } = require("../src/lib/engine/wave3/fold-prompts");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { computeAvgCurveRange, DIVERSITY_FLOOR } = require("../src/lib/engine/wave3/fold");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { selectPersonaSlots } = require("../src/lib/engine/wave3/persona-registry");

const videoPath = process.argv[2] || `${process.env.HOME}/Downloads/TikTok Video Downloader.mp4`;
const FOLD_MAX_TOKENS = 4000;
const FOLD_THINKING_BUDGET = 1000;
const PER_CALL_TIMEOUT_MS = 120_000;

const VARIANTS = [
  { key: "A omni-plus (audio)",  model: "qwen3.5-omni-plus",  thinking: false },
  { key: "B omni-flash (audio)", model: "qwen3.5-omni-flash", thinking: false },
];

function toMp4(p: string): Buffer {
  if (extname(p).toLowerCase() === ".mp4") return readFileSync(p);
  const out = resolve(tmpdir(), `fold-ab-${process.pid}.mp4`);
  execFileSync("ffmpeg", ["-y", "-i", p, "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", out], { stdio: "ignore" });
  return readFileSync(out);
}

async function runVariant(ai: any, v: any, slots: any, segments: any, verbatim: string, emotionArc: any, videoUrl: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
  const params: any = {
    model: v.model,
    messages: [
      { role: "system", content: STABLE_FOLD_SYSTEM_PROMPT },
      { role: "user", content: buildFoldUserContent(slots, segments, verbatim, emotionArc, videoUrl) },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    seed: QWEN_SEED,
    max_tokens: FOLD_MAX_TOKENS,
  };
  if (v.thinking) { params.enable_thinking = true; params.thinking_budget = FOLD_THINKING_BUDGET; }

  const t0 = Date.now();
  let res: any, err: string | null = null;
  try {
    res = await ai.chat.completions.create(params, { signal: controller.signal });
  } catch (e: any) {
    err = e?.message ?? String(e);
  } finally {
    clearTimeout(timer);
  }
  const ms = Date.now() - t0;
  if (err) return { ...v, ms, error: err };

  const usage = res.usage ?? {};
  const inTok = usage.prompt_tokens ?? 0, outTok = usage.completion_tokens ?? 0;
  // omni-plus pricing ~$0.4 in / $2.2? we just report tokens; cost varies by model — report both raw.
  const rawText = res.choices[0]?.message?.content ?? "{}";
  // ROBUST strip: omni-flash emits inconsistent wrappers (full ```json fences, OR a
  // stray trailing ``` with no opener). Remove ALL fence markers, then slice to the
  // outermost { … } so a leading/trailing stray char can't break JSON.parse.
  const wasFenced = /```/.test(rawText);
  let text = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  const lo = text.indexOf("{"), hi = text.lastIndexOf("}");
  if (lo >= 0 && hi > lo) text = text.slice(lo, hi + 1);
  let parsed: any;
  try { parsed = JSON.parse(text); } catch {
    console.log(`\n  [raw dump] ${v.model} output: ${text.length} chars, finish_reason=${res.choices[0]?.finish_reason}`);
    console.log(`  --- first 400 ---\n${text.slice(0, 400)}`);
    console.log(`  --- last 200 ---\n${text.slice(-200)}\n`);
    return { ...v, ms, error: `JSON parse fail (${text.length} chars, finish=${res.choices[0]?.finish_reason})` };
  }
  const val = FoldResponseSchema.safeParse(parsed);
  if (!val.success) return { ...v, ms, inTok, outTok, error: `Zod fail: ${val.error.message.slice(0, 160)}` };

  const personas = val.data.personas;
  const segMismatch = personas.filter((p: any) => p.segment_reactions.length !== segments.length).map((p: any) => p.archetype);
  const avgRange = computeAvgCurveRange(personas);

  // mean attention per segment across personas → biggest drop = "the moment you lose them"
  const nSeg = segments.length;
  const meanAtt: number[] = [];
  for (let i = 0; i < nSeg; i++) {
    const vals = personas.map((p: any) => p.segment_reactions[i]?.attention).filter((x: any) => typeof x === "number");
    meanAtt.push(vals.length ? +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(2) : 0);
  }
  let maxDrop = 0, dropAt = -1;
  for (let i = 1; i < meanAtt.length; i++) {
    const d = meanAtt[i - 1]! - meanAtt[i]!;
    if (d > maxDrop) { maxDrop = +d.toFixed(2); dropAt = i; }
  }
  const avgWatch = +(personas.reduce((a: number, p: any) => a + (p.watch_through_pct ?? 0), 0) / personas.length).toFixed(1);
  const avgShare = +(personas.reduce((a: number, p: any) => a + (p.share_intent ?? 0), 0) / personas.length).toFixed(2);

  return {
    ...v, ms, inTok, outTok, error: null, wasFenced,
    nPersonas: personas.length, segMismatch,
    avgRange, diverse: avgRange >= DIVERSITY_FLOOR,
    avgWatch, avgShare,
    dropAt: dropAt >= 0 ? `seg${dropAt} (${segments[dropAt]?.t_start}-${segments[dropAt]?.t_end}s) Δ${maxDrop}` : "none",
    meanAtt,
  };
}

async function main() {
  console.log(`\n████ Fold AUDIO A/B ████  video: ${basename(videoPath)}`);
  const supabase = createServiceClient();
  const ai = getQwenClient();

  const bytes = toMp4(videoPath);
  const path = `fold-ab/${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
  const up = await supabase.storage.from("videos").upload(path, bytes, { contentType: "video/mp4", upsert: true });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);
  const signed = await supabase.storage.from("videos").createSignedUrl(path, 3600);
  if (signed.error || !signed.data?.signedUrl) throw new Error(`signed URL failed: ${signed.error?.message}`);
  const videoUrl = signed.data.signedUrl;

  try {
    console.log("  [ab] Omni read (shared input) …");
    const omni = await analyzeVideoWithOmni(videoUrl);
    if (!omni.geminiResult?.analysis) throw new Error("Omni null analysis");
    const a = omni.geminiResult.analysis;
    const segments = omni.segments ?? [];
    const hookRaw = (a as any)?.hook_verbatim;
    const verbatim = hookRaw ? [hookRaw.spoken_words, hookRaw.on_screen_text].filter(Boolean).join(" ") : "";
    const emotionArc = Array.isArray((a as any)?.emotion_arc) ? (a as any).emotion_arc : [];
    const slots = selectPersonaSlots(omni.wave0Result?.content_type?.type ?? null, omni.wave0Result?.niche?.primary_slug ?? null);
    console.log(`  [ab] segments=${segments.length} slots=${slots.length} verbatim="${verbatim.slice(0, 50)}…"`);

    const results: any[] = [];
    for (const v of VARIANTS) {
      console.log(`\n  [ab] fold → ${v.key} (${v.model}, thinking=${v.thinking}) …`);
      const r = await runVariant(ai, v, slots, segments, verbatim, emotionArc, videoUrl);
      console.log(`  [ab] ${v.key}: ${r.error ? "ERROR " + r.error : `${(r.ms / 1000).toFixed(1)}s, diversity ${r.avgRange} (${r.diverse ? "PASS" : "FAIL <" + DIVERSITY_FLOOR}), watch ${r.avgWatch}%, drop ${r.dropAt}`}`);
      results.push(r);
    }

    console.log("\n\n  ═══════════════ FOLD A/B COMPARISON ═══════════════");
    const cols = ["metric", ...results.map((r) => r.key)];
    console.log("  " + cols.join("  |  "));
    const row = (label: string, fn: (r: any) => any) => console.log(`  ${label.padEnd(18)}  |  ${results.map((r) => String(r.error ? "—" : fn(r)).padEnd(22)).join("|  ")}`);
    row("latency (s)", (r) => (r.ms / 1000).toFixed(1));
    row("in/out tokens", (r) => `${r.inTok}/${r.outTok}`);
    row("personas", (r) => `${r.nPersonas}${r.segMismatch?.length ? " (mismatch:" + r.segMismatch.length + ")" : ""}`);
    row("diversity (range)", (r) => `${r.avgRange} ${r.diverse ? "PASS" : "FAIL"}`);
    row("avg watch %", (r) => r.avgWatch);
    row("avg share intent", (r) => r.avgShare);
    row("biggest drop", (r) => r.dropAt);
    row("fenced JSON?", (r) => (r.wasFenced ? "YES (needs strip)" : "no"));
    console.log("\n  mean attention curve (per segment, across 10 personas):");
    for (const r of results) if (!r.error) console.log(`    ${r.key.padEnd(22)} [${r.meanAtt.join(", ")}]`);
    for (const r of results) if (r.error) console.log(`    ${r.key}: ERROR — ${r.error}`);
    console.log("  ════════════════════════════════════════════════════\n");

    console.log(`FOLD_AB_RESULT ${results.map((r) => `${r.model}=${r.error ? "ERR" : `div${r.avgRange}/${(r.ms / 1000).toFixed(0)}s`}`).join(" ")}`);
  } finally {
    await supabase.storage.from("videos").remove([path]).catch(() => {});
  }
}

main().catch((e) => { console.error("\n[fold-ab] FATAL:", e?.stack ?? e?.message ?? e); process.exit(1); });
