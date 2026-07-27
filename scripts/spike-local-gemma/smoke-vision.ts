/**
 * SPIKE de-risk — the go/no-go gate for the whole local-Gemma plan.
 *
 * Proves (or kills) the riskiest assumption before any adapter wiring:
 *   1. Ollama serves an OpenAI-compatible endpoint at :11434/v1.
 *   2. gemma4:e4b-it-qat accepts MULTIPLE base64 image_url items in one request
 *      and actually reasons over them (not just the first/last).
 *   3. It returns valid JSON when asked (response_format json_object).
 *
 * If multi-image vision or JSON output fails here, the frames-based plan for the
 * 3 video stages is not viable and we replan (e.g. single-keyframe, or text-only).
 *
 * Usage: npx tsx scripts/spike-local-gemma/smoke-vision.ts "<path-to-mp4>" [model]
 */
import OpenAI from "openai";
import { videoToFramesAndTranscript } from "../../src/lib/engine/local/perception-adapter";

const videoPath = process.argv[2];
const model = process.argv[3] ?? "gemma4:e4b-it-qat";
if (!videoPath) {
  console.error("pass a video path");
  process.exit(1);
}

const client = new OpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama", // ignored by Ollama, SDK requires a non-empty string
  maxRetries: 0,
});

(async () => {
  console.log(`[smoke] model: ${model}`);
  console.log(`[smoke] sampling frames from: ${videoPath}`);
  const p = await videoToFramesAndTranscript(videoPath, { frameCount: 6, maxWidth: 640 });
  console.log(`[smoke] ${p.images.length} frames, transcript ${p.transcript.length} chars`);

  const sys =
    "You are a video analyst. You are given still frames sampled in time order from " +
    "a short vertical video, plus its audio transcript. Reason over ALL frames as a " +
    "sequence. Reply ONLY with a JSON object, no prose.";

  const userContent = [
    ...p.images,
    {
      type: "text" as const,
      text:
        `These are ${p.images.length} time-ordered frames of a ${p.durationSec.toFixed(0)}s video.\n` +
        `Audio transcript: "${p.transcript}"\n\n` +
        `Return JSON with EXACTLY these keys:\n` +
        `{\n` +
        `  "scene": "<one sentence: setting + who is on screen>",\n` +
        `  "on_screen_text": "<any caption text you can read in the frames, or empty>",\n` +
        `  "frame_count_seen": <integer: how many distinct frames you were given>,\n` +
        `  "topic": "<what the video is about, 1 phrase>",\n` +
        `  "hook_strength": <0-100 integer>\n` +
        `}`,
    },
  ];

  const t0 = performance.now();
  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: userContent as never },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
    seed: 7,
  });
  const ms = Math.round(performance.now() - t0);

  const raw = res.choices[0]?.message?.content ?? "";
  console.log(`\n=== latency: ${ms}ms ===`);
  console.log(`=== usage: ${JSON.stringify(res.usage)} ===`);
  console.log(`\n--- raw response ---\n${raw}`);

  // Verdicts
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.log(`\n❌ JSON PARSE FAILED — json_object not honored`);
    process.exit(1);
  }
  const seen = Number(parsed?.frame_count_seen);
  console.log(`\n=== VERDICTS ===`);
  console.log(`✅ valid JSON`);
  console.log(`${seen >= p.images.length - 1 ? "✅" : "⚠️ "} frame_count_seen=${seen} (sent ${p.images.length}) — multi-image ${seen >= p.images.length - 1 ? "CONFIRMED" : "SUSPECT (may only see some)"}`);
  console.log(`scene: ${parsed?.scene}`);
  console.log(`on_screen_text: ${parsed?.on_screen_text}`);
  console.log(`topic: ${parsed?.topic} | hook_strength: ${parsed?.hook_strength}`);
})().catch((e) => {
  console.error("\n❌ SMOKE FAILED:", e?.message ?? e);
  process.exit(1);
});
