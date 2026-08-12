/**
 * Orchestration for the modality split — extract, two legs in parallel, coherence, merge.
 *
 *   ffmpeg -vn ─▶ mp3 ─▶ private bucket ─▶ signed url
 *                                            │
 *        ┌───────────────────────────────────┴──────────────┐
 *        ▼                                                  ▼
 *   VIDEO leg (flash, sighted+deaf)                AUDIO leg (omni, hearing+blind)
 *   owns the time grid                             owns transcript + audio scores
 *        └───────────────────┬──────────────────────────────┘
 *                            ▼
 *                 drift check ─▶ (retry the AUDIO leg only)
 *                            ▼
 *                 coherence call (text only, both summaries)
 *                            ▼
 *              merge ─▶ OmniAnalysisZodSchema.safeParse
 *
 * The legs run in PARALLEL rather than feeding one into the other, and that is a latency
 * decision: production omni is ~17s today, and serialising two calls would land the Read
 * SLOWER than the thing it replaces. Coherence is the price of parallelism — neither leg
 * holds both modalities, so the one genuinely cross-modal field gets its own cheap call.
 *
 * EVERY failure path returns null, and null means "fall back to the unified omni read".
 * A dearer, slower read is always better than a wrong one, so nothing in here degrades into
 * a partial result: either all three calls landed and the merge parsed, or the split did not
 * happen. That is also what makes the flag safe to leave on — the worst case is today's cost.
 */

import * as Sentry from "@sentry/nextjs";
import type { z } from "zod";
import { createLogger } from "@/lib/logger";
import { getQwenClient, QWEN_OMNI_MODEL, QWEN_REASONING_MODEL, QWEN_SEED } from "../client";
import { calculateCost } from "../cost";
import { OmniAnalysisZodSchema } from "../schemas";
import type { OmniAnalysisResult } from "../schemas";
import { stripModelOutput } from "../../utils/strip";
import { audioMixViolation, blankAudioMix } from "../audio-mix";
import { extractAudioTrack, parkAudioAndSign, dropParkedAudio } from "./audio-track";
import {
  AudioLegZodSchema, CoherenceZodSchema, VideoLegZodSchema,
  type AudioLegResult, type VideoLegResult,
} from "./schemas";
import {
  buildAudioLegSystemPrompt, buildCoherenceUserMessage, buildSplitUserHints,
  buildVideoLegSystemPrompt, COHERENCE_SYSTEM_PROMPT,
} from "./prompts";
import { mergeModalityLegs, renderAudioSummary, renderVisualSummary, type MergeDiagnostics } from "./merge";

const log = createLogger({ module: "engine.qwen.split.run" });

/**
 * Default ON (owner call 2026-08-04, behind live harness runs on four clips — a talking-head
 * skit, a short speech clip, a music-only vlog, and a video with no audio stream at all).
 * Rollback is one env var: `ENGINE_AUDIO_SPLIT=false`.
 *
 * ⚠️ ENGINE_VERSION reads this same flag (see version.ts), so the prediction cache partitions
 * automatically in BOTH directions — split-era rows can never be served from unified-era rows,
 * and rolling back does not need a second deploy to be correct.
 */
export const AUDIO_SPLIT_ENABLED = process.env.ENGINE_AUDIO_SPLIT !== "false";

const LEG_TIMEOUT_MS       = 60_000;
const COHERENCE_TIMEOUT_MS = 30_000;
/** Generous on purpose. F47: an under-sized cap truncates JSON mid-object → parse failure →
 *  a full 60s retry, which is far dearer than the unused headroom (output is billed as
 *  generated, not as capped). */
const LEG_MAX_TOKENS       = Number(process.env.SPLIT_LEG_MAX_TOKENS) || 8000;
const COHERENCE_MAX_TOKENS = 500;

const JSON_RETRY_NUDGE =
  "\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON object, no explanation.";

export interface SplitOutcome {
  data: OmniAnalysisResult;
  cost_cents: number;
  diagnostics: MergeDiagnostics & {
    video_cost_cents: number;
    audio_cost_cents: number;
    coherence_cost_cents: number;
    audio_bytes: number;
    extract_ms: number;
    legs_ms: number;
    audio_leg_retried: boolean;
  };
}

// ---------------------------------------------------------------------------
// Generic leg call
// ---------------------------------------------------------------------------

interface LegCallArgs<T> {
  label: string;
  model: string;
  systemPrompt: string;
  userContent: Array<Record<string, unknown>> | string;
  schema: z.ZodType<T>;
  maxTokens: number;
  timeoutMs: number;
  /** Extra system-suffix text on the FIRST attempt (drift nudge on a re-run). Kept as a
   *  suffix so the cached system prefix stays byte-stable and keeps hitting. */
  initialHint?: string;
  retries?: number;
}

async function callLeg<T>(args: LegCallArgs<T>): Promise<{ data: T; cost_cents: number } | null> {
  const { label, model, systemPrompt, userContent, schema, maxTokens, timeoutMs } = args;
  const maxRetries = args.retries ?? 1;
  const ai = getQwenClient();
  let hint = args.initialHint ?? "";
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const params: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: systemPrompt + hint },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" as const },
        temperature: 0, // reproducible perception — same media → same read
        max_tokens: maxTokens,
      };
      // DashScope extensions, absent from the OpenAI types — hence the Record<string, unknown>
      // param bag and the `as never` at the call site.
      params.seed = QWEN_SEED;
      // Thinking-off. 3.7-flash defaults thinking ON, and these are perception calls, not
      // reasoning ones (Apollo is the only stage that runs thinking).
      params.enable_thinking = false;

      const completion = await ai.chat.completions.create(params as never, { signal: controller.signal });
      clearTimeout(timer);

      const raw = completion.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(stripModelOutput(raw));
      const result = schema.safeParse(parsed);
      if (!result.success) {
        log.warn("split leg: Zod validation failed", { label, model, attempt, error: result.error.message.slice(0, 400) });
        lastError = result.error;
        hint = JSON_RETRY_NUDGE;
        continue;
      }

      return { data: result.data, cost_cents: calculateCost(model, completion.usage ?? undefined) };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      hint = JSON_RETRY_NUDGE;
      const isAbort = err instanceof Error && err.name === "AbortError";
      log.warn("split leg attempt failed", { label, model, attempt, isAbort, error: String(err).slice(0, 300) });
    }
  }

  log.error("split leg failed after retries", { label, model, error: String(lastError).slice(0, 300) });
  return null;
}

// ---------------------------------------------------------------------------
// The three calls
// ---------------------------------------------------------------------------

export interface SplitOptions {
  niche?: string;
  content_type?: string;
}

function runVideoLeg(videoUrl: string, opts: SplitOptions) {
  return callLeg<VideoLegResult>({
    label: "video",
    model: QWEN_REASONING_MODEL,
    systemPrompt: buildVideoLegSystemPrompt(),
    userContent: [
      { type: "video_url", video_url: { url: videoUrl } },
      { type: "text", text: `Watch this TikTok video and return the JSON object as specified.${buildSplitUserHints(opts)}` },
    ],
    schema: VideoLegZodSchema,
    maxTokens: LEG_MAX_TOKENS,
    timeoutMs: LEG_TIMEOUT_MS,
  });
}

function runAudioLeg(audioUrl: string, opts: SplitOptions, initialHint = "") {
  return callLeg<AudioLegResult>({
    label: "audio",
    model: QWEN_OMNI_MODEL,
    systemPrompt: buildAudioLegSystemPrompt(),
    userContent: [
      // The shape the spike proved on qwen3.5-omni-flash: `input_audio` carrying a signed URL.
      { type: "input_audio", input_audio: { data: audioUrl, format: "mp3" } },
      { type: "text", text: `Listen to this TikTok audio track and return the JSON object as specified.${buildSplitUserHints(opts)}` },
    ],
    schema: AudioLegZodSchema,
    maxTokens: LEG_MAX_TOKENS,
    timeoutMs: LEG_TIMEOUT_MS,
    initialHint,
  });
}

function runCoherence(video: VideoLegResult, audio: AudioLegResult) {
  return callLeg({
    label: "coherence",
    model: QWEN_REASONING_MODEL,
    systemPrompt: COHERENCE_SYSTEM_PROMPT,
    userContent: buildCoherenceUserMessage(renderVisualSummary(video), renderAudioSummary(audio)),
    schema: CoherenceZodSchema,
    maxTokens: COHERENCE_MAX_TOKENS,
    timeoutMs: COHERENCE_TIMEOUT_MS,
  });
}

// ---------------------------------------------------------------------------
// Drift — the audio leg's half of detectCriticalFieldDrift
// ---------------------------------------------------------------------------

/**
 * Mirrors `detectCriticalFieldDrift` in omni-analysis.ts, but on the LEG shapes and before the
 * merge — so the bounded retry re-runs only the cheap audio call (~350 input tokens) instead
 * of the whole split, and the coherence grade is always computed against the FINAL audio read
 * rather than a superseded one.
 *
 * Both fields it guards are audio-derived, which is why only the audio leg is ever re-run:
 * emotion_arc's primary source is the audio leg (the video arc is only a silent-footage
 * fallback, so it is consulted before declaring drift), and hook_spoken_words is speech.
 */
export function detectAudioLegDrift(video: VideoLegResult, audio: AudioLegResult): string[] {
  const drift: string[] = [];

  const isSlideshowLike = video.content_type === "slideshow" || video.content_type === "b_roll";
  const noArcAnywhere = !(audio.emotion_arc?.length) && !(video.emotion_arc?.length);
  if (!isSlideshowLike && noArcAnywhere) drift.push("emotion_arc");

  // F46 parity: a no-speech video's null verbatim is CORRECT, not drift.
  const hasSpeech =
    audio.first_words_speech_score != null ||
    (audio.audio_signals.voiceover_ratio ?? 0) > 0.05;
  if (hasSpeech && audio.hook_spoken_words == null) drift.push("hook_spoken_words");

  // The mix has to partition the track and agree with the leg's own transcript — see audio-mix.ts.
  // Evidence is read from THIS response's speech fields, never from the ratios being checked.
  if (audioMixViolation(audio.audio_signals, {
    first_words_speech_score: audio.first_words_speech_score,
    spoken_words: audio.hook_spoken_words,
  })) {
    drift.push("audio_mix");
  }

  return drift;
}

const DRIFT_NUDGE =
  "\nIMPORTANT: Your previous response omitted or contradicted required perception fields: %FIELDS%. " +
  "Re-analyse the audio and CORRECT them — emotion_arc: 3-8 points across the timeline whenever " +
  "there is any audio; hook_spoken_words: the verbatim speech from the first ~3s (null ONLY if " +
  "there is genuinely no speech); audio_mix: silence_ratio + voiceover_ratio + music_ratio must " +
  "sum to 1.0 (±0.1) AND voiceover_ratio must reflect the share of the track that is speech — if " +
  "you transcribed words, voiceover_ratio cannot be 0.";

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Run the split. Returns null on ANY failure so the caller falls back to the unified read.
 * Cleans up the parked mp3 on every path.
 */
export async function runModalitySplit(
  videoUrl: string,
  opts: SplitOptions = {},
): Promise<SplitOutcome | null> {
  const tExtract = Date.now();
  const audioBuffer = await extractAudioTrack(videoUrl);
  if (!audioBuffer) {
    log.warn("split: audio extraction produced nothing — falling back to the unified read");
    return null;
  }
  const parked = await parkAudioAndSign(audioBuffer);
  if (!parked) {
    log.warn("split: could not park the audio — falling back to the unified read");
    return null;
  }
  const extract_ms = Date.now() - tExtract;

  try {
    const tLegs = Date.now();
    const [videoOut, audioOut] = await Promise.all([
      runVideoLeg(videoUrl, opts),
      runAudioLeg(parked.signedUrl, opts),
    ]);
    if (!videoOut || !audioOut) {
      log.warn("split: a leg failed — falling back to the unified read", {
        video_ok: !!videoOut, audio_ok: !!audioOut,
      });
      return null;
    }

    // ---- bounded audio-leg drift retry (before coherence, so coherence sees the final read)
    let audio = audioOut.data;
    let audioCost = audioOut.cost_cents;
    let audio_leg_retried = false;
    const drift = detectAudioLegDrift(videoOut.data, audio);
    if (drift.length > 0) {
      log.warn("split: audio-leg critical-field drift — retrying the audio leg only", { drifted_fields: drift });
      const retry = await runAudioLeg(parked.signedUrl, opts, DRIFT_NUDGE.replace("%FIELDS%", drift.join(", ")));
      audio_leg_retried = true;
      if (retry) {
        audio = retry.data;
        audioCost += retry.cost_cents;
        const stillDrifted = detectAudioLegDrift(videoOut.data, audio);
        if (stillDrifted.length > 0) log.warn("read_drift", { source: "split_audio_leg", drifted_fields: stillDrifted });
      } else {
        log.warn("split: audio-leg drift retry failed — keeping the first read");
      }
    }

    // Last word on the mix: the retry has had its chance. A partition that still contradicts the
    // leg's own transcript is not passed on — it is DROPPED, so Apollo's prompt loses its "Mix:"
    // line instead of gaining a false one, and the perceptual formula redistributes the weight.
    // Blanking happens here, after the retry, and never in place of one.
    const mixFault = audioMixViolation(audio.audio_signals, {
      first_words_speech_score: audio.first_words_speech_score,
      spoken_words: audio.hook_spoken_words,
    });
    if (mixFault) {
      log.warn("read_drift", { source: "split_audio_leg", field: "audio_mix", reason: mixFault, action: "blanked" });
      audio = { ...audio, audio_signals: blankAudioMix(audio.audio_signals) };
    }
    const legs_ms = Date.now() - tLegs;

    // ---- the one field neither leg can produce
    const coherenceOut = await runCoherence(videoOut.data, audio);
    if (!coherenceOut) {
      // Deliberate: visual_audio_coherence is a REQUIRED, user-visible hook modality
      // (reading-panels.tsx renders it). Rather than null it out or invent a midpoint, the
      // split stands down and the unified read produces it the way it always has.
      log.warn("split: coherence call failed — falling back to the unified read");
      return null;
    }

    // ---- merge, then face the SAME parse the unified read faces
    const { merged, diagnostics } = mergeModalityLegs({
      video: videoOut.data,
      audio,
      visual_audio_coherence: coherenceOut.data.visual_audio_coherence,
    });

    const result = OmniAnalysisZodSchema.safeParse(merged);
    if (!result.success) {
      log.error("split: merged read failed OmniAnalysisZodSchema — falling back to the unified read", {
        error: result.error.message.slice(0, 600),
      });
      Sentry.captureException(result.error, { tags: { stage: "omni_split_merge" } });
      return null;
    }

    const cost_cents = videoOut.cost_cents + audioCost + coherenceOut.cost_cents;
    log.info("split: complete", {
      cost_cents, extract_ms, legs_ms, audio_bytes: audioBuffer.length, audio_leg_retried,
      ...diagnostics,
    });

    return {
      data: result.data,
      cost_cents,
      diagnostics: {
        ...diagnostics,
        video_cost_cents: videoOut.cost_cents,
        audio_cost_cents: audioCost,
        coherence_cost_cents: coherenceOut.cost_cents,
        audio_bytes: audioBuffer.length,
        extract_ms,
        legs_ms,
        audio_leg_retried,
      },
    };
  } catch (err) {
    log.error("split: threw — falling back to the unified read", {
      error: err instanceof Error ? err.message : String(err),
    });
    Sentry.captureException(err, { tags: { stage: "omni_split" } });
    return null;
  } finally {
    dropParkedAudio(parked.path);
  }
}
