/**
 * Phase 6 Wave 0 smoke test — Gemini 2.5 Flash audio signal reliability.
 *
 * Purpose: Validate that extending the existing gemini_video_analysis prompt
 * with an audio_signals schema block reliably emits:
 *   - voice_clarity_0_10 (0-10, nullable per D-A2 content-type gating)
 *   - audio_hook_first_2s_0_10 (0-10, nullable per D-A2)
 *   - silence_ratio + voiceover_ratio + music_ratio summing to ~1.0 (±0.1)
 *   - audio_description (50-150 char natural language string)
 *
 * Run BEFORE writing Phase 6 production code. If reliability is poor
 * (<90% emission rate or malformed fields), STOP and return to /gsd-discuss-phase 6
 * to revisit D-A1.
 *
 * Usage:
 *   pnpm tsx scripts/smoke-test-gemini-audio.ts
 *
 * Required fixtures (drop in tests/fixtures/audio-smoke/):
 *   - talking_head.mp4   (~10s, creator speaking on-camera)
 *   - slideshow.mp4      (~10s, static images + music, NO speech)
 *   - music_heavy.mp4    (~10s, prominent music + minimal speech)
 *
 * Output: tests/fixtures/audio-smoke/smoke-test-results.json (gitignored).
 */
import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import { GoogleGenAI, Type } from "@google/genai";

// Load env (Next.js convention — same as scripts/import-apify-data.ts)
config({ path: resolve(__dirname, "../.env.local") });

const FIXTURE_DIR = resolve(__dirname, "../tests/fixtures/audio-smoke");
const OUTPUT_FILE = resolve(FIXTURE_DIR, "smoke-test-results.json");
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

// Polling for Gemini Files API (mirrors src/lib/engine/gemini.ts:444-455)
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 60_000;

// Validation tolerances (per VALIDATION.md Critical Sample Points + PATTERNS.md)
const RATIO_SUM_TOLERANCE = 0.1; // ±0.1 around 1.0 per D-A3
const DESCRIPTION_MIN_LEN = 10;
const DESCRIPTION_MAX_LEN = 300;

/**
 * Extended VIDEO_RESPONSE_SCHEMA — copies the existing properties from
 * src/lib/engine/gemini.ts:274-314 and appends audio_signals per
 * 06-PATTERNS.md "MODIFIED: gemini.ts" section.
 *
 * One-off; do NOT export — Plan 03 lands the production schema in gemini.ts.
 */
const EXTENDED_VIDEO_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    factors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          score: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
          improvement_tip: { type: Type.STRING },
        },
        required: ["name", "score", "rationale", "improvement_tip"],
      },
    },
    overall_impression: { type: Type.STRING },
    content_summary: { type: Type.STRING },
    video_signals: {
      type: Type.OBJECT,
      properties: {
        visual_production_quality: { type: Type.NUMBER },
        hook_visual_impact: { type: Type.NUMBER },
        pacing_score: { type: Type.NUMBER },
        transition_quality: { type: Type.NUMBER },
      },
      required: [
        "visual_production_quality",
        "hook_visual_impact",
        "pacing_score",
        "transition_quality",
      ],
    },
    // Phase 6 — NEW audio_signals block per D-A1 + 06-PATTERNS.md
    audio_signals: {
      type: Type.OBJECT,
      properties: {
        voice_clarity_0_10: { type: Type.NUMBER, nullable: true },
        audio_hook_first_2s_0_10: { type: Type.NUMBER, nullable: true },
        silence_ratio: { type: Type.NUMBER },
        voiceover_ratio: { type: Type.NUMBER },
        music_ratio: { type: Type.NUMBER },
        audio_description: { type: Type.STRING },
      },
      required: [
        "silence_ratio",
        "voiceover_ratio",
        "music_ratio",
        "audio_description",
      ],
    },
  },
  required: [
    "factors",
    "overall_impression",
    "content_summary",
    "video_signals",
    "audio_signals",
  ],
};

/**
 * Smoke-test prompt — mirrors the existing buildVideoPrompt shape from
 * src/lib/engine/gemini.ts:203-248 (stripped of calibration / niche context;
 * not needed for a reliability check) and appends the Audio Signals section
 * per 06-PATTERNS.md "MODIFIED: gemini.ts" prompt extension.
 */
const SMOKE_PROMPT = `You are a TikTok video content analysis expert. Your job is to evaluate video content quality across 5 specific factors, 4 video production signals, and 6 audio signals.

## The 5 Factors (evaluate based on visual AND audio content)

1. **Scroll-Stop Power**: Would a user stop scrolling? Measures hook strength in the first 1-3 seconds, curiosity gap, visual pattern interrupt, opening frame impact.
2. **Completion Pull**: Would a user watch to the end? Measures narrative tension, visual pacing, payoff anticipation, information drip through visuals and audio.
3. **Rewatch Potential**: Would a user watch again? Measures layered visual meaning, satisfying loops, "wait what" moments, rewatchable visual reveals.
4. **Share Trigger**: Would a user share this? Measures visual relatability, identity signaling, emotional visual provocation, "tag someone" energy.
5. **Emotional Charge**: Does this make the user FEEL something? Measures intensity of visual/audio emotion (joy, outrage, awe, nostalgia, humor), not which emotion.

## Video Signals (additional video-specific evaluation)

- **visual_production_quality**: Lighting, framing, resolution, overall visual polish (0-10)
- **hook_visual_impact**: First 3 seconds visual hook effectiveness (0-10)
- **pacing_score**: Cut frequency, rhythm, dead air avoidance (0-10)
- **transition_quality**: Smooth cuts, creative transitions, visual flow (0-10)

## Audio Signals (in addition to video — Gemini natively processes the audio track)

- **voice_clarity_0_10**: Speech intelligibility, SNR, articulation quality (0-10). Return null if no human speech is present.
- **audio_hook_first_2s_0_10**: Audio impact in first 2 seconds — would the user keep sound on? (0-10). Return null if no audio/silence in first 2s.
- **silence_ratio**, **voiceover_ratio**, **music_ratio**: Three fractions summing to EXACTLY 1.0. Rebalance internally before emitting.
- **audio_description**: 50-150 char natural language description of the audio (genre, mood, tempo, vocal/instrumental, lyrical hooks). Example: "upbeat hip-hop track, 90 BPM, sampled female vocal hook 'oh la la'"

## Scoring Rules

- Score each factor and video signal 0.0-10.0 with one decimal precision (e.g. 7.3).
- Use ABSOLUTE scoring — universal quality standards, NOT niche-relative.
- Most content should score 4-7; scores above 8 are exceptional.
- For each factor provide: score + rationale (1-2 sentences WHY) + improvement_tip (actionable suggestion).

Return JSON matching the schema exactly. The factors array must contain exactly 5 objects with names: "Scroll-Stop Power", "Completion Pull", "Rewatch Potential", "Share Trigger", "Emotional Charge". Include the video_signals object with all 4 fields AND the audio_signals object with all 6 fields.`;

interface AudioSignals {
  voice_clarity_0_10: number | null;
  audio_hook_first_2s_0_10: number | null;
  silence_ratio: number;
  voiceover_ratio: number;
  music_ratio: number;
  audio_description: string;
}

interface ValidationReport {
  voice_clarity_ok: boolean;
  audio_hook_ok: boolean;
  ratios_ok: boolean;
  ratios_sum: number;
  description_ok: boolean;
  all_ok: boolean;
}

interface FixtureResult {
  filename: string;
  audio_signals: AudioSignals | null;
  validation: ValidationReport | null;
  raw_text_preview: string;
  error: string | null;
}

function validateAudioSignals(signals: AudioSignals): ValidationReport {
  // voice_clarity: null OR in [0,10] (D-A2 allows null for slideshow/b_roll/action)
  const voice_clarity_ok =
    signals.voice_clarity_0_10 === null ||
    (typeof signals.voice_clarity_0_10 === "number" &&
      signals.voice_clarity_0_10 >= 0 &&
      signals.voice_clarity_0_10 <= 10);

  // audio_hook: null OR in [0,10]
  const audio_hook_ok =
    signals.audio_hook_first_2s_0_10 === null ||
    (typeof signals.audio_hook_first_2s_0_10 === "number" &&
      signals.audio_hook_first_2s_0_10 >= 0 &&
      signals.audio_hook_first_2s_0_10 <= 10);

  // ratios sum within ±0.1 of 1.0 per D-A3
  const ratios_sum =
    signals.silence_ratio + signals.voiceover_ratio + signals.music_ratio;
  const ratios_ok = Math.abs(ratios_sum - 1.0) <= RATIO_SUM_TOLERANCE;

  // description length in [10, 300]
  const description_ok =
    typeof signals.audio_description === "string" &&
    signals.audio_description.length >= DESCRIPTION_MIN_LEN &&
    signals.audio_description.length <= DESCRIPTION_MAX_LEN;

  const all_ok =
    voice_clarity_ok && audio_hook_ok && ratios_ok && description_ok;

  return {
    voice_clarity_ok,
    audio_hook_ok,
    ratios_ok,
    ratios_sum: +ratios_sum.toFixed(3),
    description_ok,
    all_ok,
  };
}

async function processFixture(
  ai: GoogleGenAI,
  filename: string,
  fullPath: string,
): Promise<FixtureResult> {
  let uploadedFileName: string | undefined;
  try {
    console.log(`[smoke] Uploading ${filename}...`);
    const fileBuffer = readFileSync(fullPath);
    const mimeType = "video/mp4";
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });

    const uploadResult = await ai.files.upload({ file: blob, config: { mimeType } });
    if (!uploadResult.name) {
      throw new Error("Gemini Files API upload returned no file name");
    }
    uploadedFileName = uploadResult.name;

    // Poll for ACTIVE state (mirror gemini.ts:444-455)
    let fileState = uploadResult.state;
    let fileUri = uploadResult.uri;
    const pollStart = Date.now();
    while (fileState === "PROCESSING") {
      if (Date.now() - pollStart > POLL_TIMEOUT_MS) {
        throw new Error(
          `Gemini Files API processing timed out after ${POLL_TIMEOUT_MS / 1000}s`,
        );
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const info = await ai.files.get({ name: uploadedFileName });
      fileState = info.state;
      fileUri = info.uri;
    }
    if (fileState === "FAILED" || !fileUri) {
      throw new Error(`Gemini Files API processing failed (state=${fileState})`);
    }

    console.log(`[smoke] Analyzing ${filename}...`);
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: SMOKE_PROMPT },
            { fileData: { fileUri, mimeType } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: EXTENDED_VIDEO_SCHEMA,
      },
    });

    const rawText = response.text ?? "";
    const parsed = JSON.parse(rawText) as { audio_signals?: AudioSignals };
    const audio_signals = parsed.audio_signals ?? null;

    if (!audio_signals) {
      return {
        filename,
        audio_signals: null,
        validation: null,
        raw_text_preview: rawText.slice(0, 200),
        error: "Response missing audio_signals object",
      };
    }

    const validation = validateAudioSignals(audio_signals);
    const vc =
      audio_signals.voice_clarity_0_10 === null
        ? "null"
        : audio_signals.voice_clarity_0_10.toFixed(1);
    const ah =
      audio_signals.audio_hook_first_2s_0_10 === null
        ? "null"
        : audio_signals.audio_hook_first_2s_0_10.toFixed(1);
    const s = audio_signals.silence_ratio.toFixed(2);
    const v = audio_signals.voiceover_ratio.toFixed(2);
    const m = audio_signals.music_ratio.toFixed(2);
    console.log(
      `[smoke] ${filename}: voice_clarity=${vc}, audio_hook=${ah}, ratios=${s}|${v}|${m}=${validation.ratios_sum}, desc="${audio_signals.audio_description.slice(0, 60)}..."`,
    );

    return {
      filename,
      audio_signals,
      validation,
      raw_text_preview: rawText.slice(0, 200),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[smoke] Error processing ${filename}:`, message);
    return {
      filename,
      audio_signals: null,
      validation: null,
      raw_text_preview: "",
      error: message,
    };
  } finally {
    // Best-effort cleanup of uploaded file (mirrors gemini.ts:533-539)
    if (uploadedFileName) {
      try {
        await ai.files.delete({ name: uploadedFileName });
      } catch {
        // ignore — file expires automatically anyway
      }
    }
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[smoke] Missing GEMINI_API_KEY in .env.local");
    process.exit(1);
  }

  if (!existsSync(FIXTURE_DIR)) {
    console.error(
      `[smoke] Fixture directory not found: ${FIXTURE_DIR}\n` +
        `[smoke] See tests/fixtures/audio-smoke/README.md for instructions.`,
    );
    process.exit(1);
  }

  const allFiles = readdirSync(FIXTURE_DIR);
  const mp4Files = allFiles.filter((f) => f.toLowerCase().endsWith(".mp4"));
  if (mp4Files.length === 0) {
    console.error(
      `[smoke] No .mp4 fixtures found in ${FIXTURE_DIR}.\n` +
        `[smoke] Drop talking_head.mp4, slideshow.mp4, music_heavy.mp4 per README.md.`,
    );
    process.exit(1);
  }

  console.log(`[smoke] Using model: ${GEMINI_MODEL}`);
  console.log(`[smoke] Found ${mp4Files.length} fixture(s): ${mp4Files.join(", ")}`);

  const ai = new GoogleGenAI({ apiKey });
  const results: FixtureResult[] = [];

  for (const filename of mp4Files) {
    const fullPath = resolve(FIXTURE_DIR, filename);
    const result = await processFixture(ai, filename, fullPath);
    results.push(result);
  }

  // Write results
  writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  const passing = results.filter((r) => r.validation?.all_ok === true).length;
  const total = results.length;
  console.log(
    `\n[smoke] ${passing}/${total} fixtures passed all 4 validation gates.`,
  );
  console.log(`[smoke] Full output written to: ${OUTPUT_FILE}`);

  if (passing < total) {
    console.log(
      `[smoke] FAIL — at least one fixture failed validation. ` +
        `Review smoke-test-results.json. If reliability is poor, return to /gsd-discuss-phase 6 to revisit D-A1.`,
    );
    process.exit(2);
  }
  console.log(`[smoke] PASS — Phase 6 D-A1 reliability assumption validated.`);
}

main().catch((err) => {
  console.error("[smoke] Fatal:", err);
  process.exit(1);
});
