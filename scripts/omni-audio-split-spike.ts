/**
 * SPIKE — can omni take AUDIO ONLY, and what does the video/audio split actually save?
 *
 * The ask: stop paying omni to WATCH. omni is the only audio-capable model, so it should
 * ingest the audio track alone; qwen3.7-flash is sighted and should take the video.
 *
 * This measures the three legs before any pipeline is reworked, because the saving is the
 * whole justification and it has never been measured:
 *   A. CURRENT — one omni call on the full mp4 (what production does today).
 *   B. omni on the EXTRACTED AUDIO only (ffmpeg -vn, uploaded + signed).
 *   C. flash on the video (the visual half that would replace omni's eyes).
 * Reports input/output tokens and cost for each, then B+C against A.
 *
 * It also answers the blocking feasibility question: DashScope's OpenAI-compatible endpoint
 * has to accept an audio URL for qwen3.5-omni-flash at all. If leg B errors, the whole
 * split is off the table and nothing downstream matters.
 *
 * ═══ MEASURED 2026-08-04 (27s TikTok skit, `TikTok Video Downloader.mp4`) ═══
 *   A. omni on full video : prompt 17,598 = video 17,228 + audio 198 + text 172 · 11.5s · 0.1955¢
 *   B. omni on AUDIO only : prompt    351 =              audio 198 + text 153 ·  3.5s · 0.0240¢
 *   C. flash on the video : prompt 17,403 = video 17,228 + text 175           ·  6.8s · 0.0573¢
 *   → B + C = 0.0813¢ against A's 0.1955¢ — a 58.4% SAVING, and omni's input drops 50×.
 *
 * ✅ FEASIBLE. `input_audio` with a signed URL works on qwen3.5-omni-flash, and omni really
 * heard it: the transcript came back verbatim and correct ("My best friend is Emily Rose
 * Johnson…" against "What's his last name? I have no idea."), timestamps spanning 0–27.4s.
 * Note B carries the SAME 198 audio_tokens as A — identical audio ingested, 17,228 video
 * tokens gone. `prompt_tokens` INCLUDES audio_tokens, so there is no hidden audio billing.
 *
 * 🔑 The saving is 58%, NOT ~100%, and the reason matters: the video tokens do not disappear,
 * they MOVE to flash, which bills them ~3× cheaper ($0.03/M at ≤32K vs omni's $0.10/M). The
 * figure is conservative — `calculateCost` bills flat, ignoring the 15,616 cached_tokens
 * DashScope reported on leg C.
 *
 * ⚠️ What this spike does NOT prove — the real work still to do:
 *   - The production schema INTERLEAVES the modalities: every `SegmentSchema` entry carries
 *     `visual_event` AND `audio_event` on ONE time grid, and `visual_audio_coherence` needs
 *     both. Two independent calls will not agree on segment boundaries, so the split needs
 *     flash to OWN the grid and omni's audio events to be aligned onto it.
 *   - Storage: the `videos` bucket allows video mime types only. This spike parks the mp3 in
 *     `covers` (the one unrestricted bucket, and it is PUBLIC). Production needs its own
 *     private `audio` bucket.
 *   - Extraction cost: ffmpeg -vn must run somewhere. `ffmpeg-static` already ships and runs
 *     on Vercel nodejs (see api/filmstrip/extract), so the pattern exists — but it adds a
 *     download + transcode + upload to the critical path, which is latency this has not measured.
 *
 * Usage: npx tsx scripts/omni-audio-split-spike.ts ["<video.mp4>"]
 * Evidence-only: edits NO engine file. Uploads video + audio, deletes both after.
 */
import { config } from "dotenv";
import { resolve, basename } from "path";
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
const { getQwenClient, QWEN_OMNI_MODEL, QWEN_REASONING_MODEL, QWEN_SEED } = require("../src/lib/engine/qwen/client");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { calculateCost } = require("../src/lib/engine/qwen/cost");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath = require("ffmpeg-static");

const videoPath = process.argv[2] || `${process.env.HOME}/Downloads/TikTok Video Downloader.mp4`;

/** The audio half of the read — what omni would own once it stops watching. */
const AUDIO_PROMPT = `You are LISTENING to the audio track of one short-form video (you cannot see it).
Return ONLY JSON: {"transcript":"<verbatim speech, or empty>","audio_events":[{"t_start":<s>,"t_end":<s>,"audio_event":"<speech/music/sfx>"}],"emotion_arc":[{"timestamp_ms":<int>,"intensity_0_1":<0-1>,"label":"low"|"mid"|"high"}],"audio_hook_quality":<0-10>,"first_words_speech_score":<0-10>,"voice_clarity":<0-10>,"has_speech":<bool>}`;

/** The visual half — what flash would take over. */
const VIDEO_PROMPT = `You are WATCHING one short-form video (assume you cannot hear it).
Return ONLY JSON: {"content_type":"<talking_head|b_roll|slideshow|action|tutorial|vlog|comedy|other>","niche":"<slug>","segments":[{"t_start":<s>,"t_end":<s>,"visual_event":"<what is on screen>","scene_boundary_reason":"<why the cut>"}],"on_screen_text":"<all visible text>","visual_stop_power":<0-10>,"text_overlay_score":<0-10>,"cognitive_load":<0-10>,"watermark_detected":{"tiktok":<bool>,"ig":<bool>,"yt":<bool>}}`;

interface Leg { name: string; model: string; ms: number; usage: any; cost: number | null; ok: boolean; note: string }

function fmt(l: Leg): string {
  const u = l.usage ?? {};
  return `  ${l.ok ? "✅" : "❌"} ${l.name.padEnd(34)} ${String(l.model).padEnd(19)} ` +
    `in ${String(u.prompt_tokens ?? "—").padStart(7)}  out ${String(u.completion_tokens ?? "—").padStart(5)}  ` +
    `${(l.ms / 1000).toFixed(1).padStart(5)}s  ${l.cost !== null ? `${l.cost.toFixed(5)}¢` : "—"}${l.note ? `  ${l.note}` : ""}`;
}

async function call(name: string, model: string, content: unknown[]): Promise<Leg> {
  const ai = getQwenClient();
  const t = Date.now();
  try {
    const r = await ai.chat.completions.create({
      model,
      messages: [{ role: "user", content: content as never }],
      temperature: 0,
      seed: QWEN_SEED,
      max_tokens: 4000,
      // @ts-expect-error DashScope extension
      enable_thinking: false,
    } as never);
    const usage = r?.usage ?? null;
    const raw = r?.choices?.[0]?.message?.content ?? "";
    let note = "";
    try { JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")); note = "parsed ✓"; }
    catch { note = `unparseable (${raw.length}c)`; }
    // Print the body. A valid-looking JSON proves NOTHING about whether the model actually
    // ingested the media — the only check that counts is reading what it says.
    console.log(`\n  ── ${name} raw ──\n${raw.slice(0, 300)}\n  FULL USAGE: ${JSON.stringify(usage)}\n`);
    return { name, model, ms: Date.now() - t, usage, cost: usage ? calculateCost(model, usage) : null, ok: true, note };
  } catch (e: any) {
    return { name, model, ms: Date.now() - t, usage: null, cost: null, ok: false, note: String(e?.message ?? e).slice(0, 120) };
  }
}

async function main() {
  console.log(`\n████ OMNI AUDIO-SPLIT SPIKE ████\n  video: ${basename(videoPath)}`);
  const supabase = createServiceClient();
  const stamp = `${process.pid}-${process.hrtime.bigint()}`;

  // ── Extract the audio track. -vn drops video entirely; this is the whole point. ──
  const audioLocal = resolve(tmpdir(), `omni-split-${stamp}.mp3`);
  execFileSync(ffmpegPath, ["-y", "-i", videoPath, "-vn", "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1", audioLocal], { stdio: "ignore" });
  const videoBytes = readFileSync(videoPath);
  const audioBytes = readFileSync(audioLocal);
  console.log(`  video: ${(videoBytes.length / 1e6).toFixed(2)} MB → audio: ${(audioBytes.length / 1e6).toFixed(2)} MB ` +
    `(${((1 - audioBytes.length / videoBytes.length) * 100).toFixed(1)}% smaller on the wire)`);

  // SPIKE ONLY: `videos` allows video mime types exclusively, so the audio goes to `covers`
  // (the one bucket with no mime restriction). Production would add a dedicated `audio` bucket.
  const vPath = `omni-split/${stamp}.mp4`;
  const aPath = `omni-split/${stamp}.mp3`;
  const upV = await supabase.storage.from("videos").upload(vPath, videoBytes, { contentType: "video/mp4", upsert: true });
  if (upV.error) throw new Error(`upload video failed: ${upV.error.message}`);
  const upA = await supabase.storage.from("covers").upload(aPath, audioBytes, { contentType: "audio/mpeg", upsert: true });
  if (upA.error) throw new Error(`upload audio failed: ${upA.error.message}`);
  const sv = await supabase.storage.from("videos").createSignedUrl(vPath, 3600);
  if (sv.error || !sv.data?.signedUrl) throw new Error(`sign video failed: ${sv.error?.message}`);
  const sa = await supabase.storage.from("covers").createSignedUrl(aPath, 3600);
  if (sa.error || !sa.data?.signedUrl) throw new Error(`sign audio failed: ${sa.error?.message}`);
  const videoUrl = sv.data.signedUrl, audioUrl = sa.data.signedUrl;

  try {
    const legs: Leg[] = [];
    // A — what production pays today.
    legs.push(await call("A. CURRENT omni on full video", QWEN_OMNI_MODEL,
      [{ type: "video_url", video_url: { url: videoUrl } }, { type: "text", text: VIDEO_PROMPT }]));
    // B — omni on audio only. Two shapes; DashScope has accepted either historically.
    const b1 = await call("B. omni on AUDIO (input_audio)", QWEN_OMNI_MODEL,
      [{ type: "input_audio", input_audio: { data: audioUrl, format: "mp3" } }, { type: "text", text: AUDIO_PROMPT }]);
    legs.push(b1);
    if (!b1.ok) {
      legs.push(await call("B2. omni on AUDIO (audio_url)", QWEN_OMNI_MODEL,
        [{ type: "audio_url", audio_url: { url: audioUrl } }, { type: "text", text: AUDIO_PROMPT }]));
    }
    // C — flash takes the eyes.
    legs.push(await call("C. flash on VIDEO (the new eyes)", QWEN_REASONING_MODEL,
      [{ type: "video_url", video_url: { url: videoUrl } }, { type: "text", text: VIDEO_PROMPT }]));

    console.log(`\n  ${"".padEnd(34)} ${"model".padEnd(19)} ${"input".padStart(10)} ${"output".padStart(9)}  ${"time".padStart(5)}  cost`);
    for (const l of legs) console.log(fmt(l));

    const A = legs.find((l) => l.name.startsWith("A."));
    const B = legs.find((l) => l.name.startsWith("B") && l.ok);
    const C = legs.find((l) => l.name.startsWith("C."));
    console.log(`\n  ═══════════════ VERDICT ═══════════════`);
    if (!B) {
      console.log(`  ❌ omni REFUSED audio-only input — the split is NOT possible as specified.`);
      for (const l of legs.filter((x) => x.name.startsWith("B"))) console.log(`     ${l.name}: ${l.note}`);
    } else if (A?.cost != null && C?.cost != null && B.cost != null) {
      const split = B.cost + C.cost;
      const delta = ((1 - split / A.cost) * 100);
      console.log(`  omni audio-only WORKS (${B.name.trim()}).`);
      console.log(`  A (today, omni watches)     : ${A.cost.toFixed(5)}¢`);
      console.log(`  B + C (omni hears, flash sees): ${split.toFixed(5)}¢  (${B.cost.toFixed(5)} + ${C.cost.toFixed(5)})`);
      console.log(`  ${delta >= 0 ? "SAVING" : "MORE EXPENSIVE"}: ${Math.abs(delta).toFixed(1)}%`);
      console.log(`  omni input tokens: ${A.usage?.prompt_tokens} (video) → ${B.usage?.prompt_tokens} (audio)`);
    }
    console.log(`  ═══════════════════════════════════════\n`);
  } finally {
    await supabase.storage.from("videos").remove([vPath]).catch(() => {});
    await supabase.storage.from("covers").remove([aPath]).catch(() => {});
  }
}

main().catch((e) => { console.error("\n[omni-audio-split-spike] FATAL:", e?.stack ?? e?.message ?? e); process.exit(1); });
