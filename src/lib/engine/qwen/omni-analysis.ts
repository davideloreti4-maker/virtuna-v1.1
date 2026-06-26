/**
 * Wave 0 + Wave 1 unified analysis via qwen3.5-omni-plus.
 *
 * Single call replaces:
 *   - Gemini segmented (hook/body/CTA — 3 parallel calls via Files API)
 *   - Wave 0 content-type + niche detector
 *   - Audio signals extraction
 *
 * Video is passed as a Supabase signed URL — no upload, no polling, no cleanup.
 */

import * as Sentry from "@sentry/nextjs";
import { createLogger } from "@/lib/logger";
import type { GeminiVideoAnalysis, Wave0Result } from "../types";
import type { StageEventCallback } from "../events";
import { getQwenClient, QWEN_OMNI_MODEL, QWEN_SEED } from "./client";
import { calculateCost } from "./cost";
import { OmniAnalysisZodSchema } from "./schemas";
import type { SegmentGrid, OmniAnalysisResult } from "./schemas";
import { normalizeSegments } from "./normalize-segments";
import { stripModelOutput } from "../utils/strip";

const log = createLogger({ module: "engine.qwen.omni" });

const MAX_RETRIES = 1; // 2 total attempts
const TIMEOUT_MS  = 60_000;
// Omni output cap. F47 (2026-06-11): was UNSET (0 = uncapped) → DashScope's low default
// output limit TRUNCATED long/dense videos' larger output mid-JSON (more segments + longer
// transcript/emotion_arc) → SyntaxError → silent read failure (Ashton Hall 79s clip repro;
// stripModelOutput can't salvage a mid-JSON cut). Default to a sane 8000-token cap that fits
// a long video's full read while bounding tail generation. Env-overridable (OMNI_MAX_TOKENS).
// Size carefully: too low truncates JSON → Zod fail → 60s retry. Do NOT raise TIMEOUT_MS to
// buy headroom — bound output here instead (PITFALL 2).
const OMNI_MAX_TOKENS = Number(process.env.OMNI_MAX_TOKENS) || 8000;

export interface OmniAnalysisOptions {
  niche?:        string;
  content_type?: string;
  onEvent?:      StageEventCallback;
}

export interface OmniAnalysisOutput {
  geminiResult: { analysis: GeminiVideoAnalysis; cost_cents: number } | null;
  wave0Result:  Wave0Result;
  audio_perceptual_score: number | null;
  signalAvailability: {
    gemini_hook: boolean;
    gemini_body: boolean;
    gemini_cta:  boolean;
  };
  /** Phase 3 (D-07) — Normalized segment grid from Wave 0. Undefined when omni skips
   *  segments or normalizer falls back gracefully (normalizer always returns non-empty
   *  after normalization; undefined only when the full omni call failed). */
  segments?: SegmentGrid[];
}

const CONTENT_TYPE_VALUES = [
  "talking_head", "b_roll", "slideshow", "action",
  "tutorial", "vlog", "comedy", "other",
] as const;

// F9/D-11: the system nudge re-sent on a malformed-JSON retry. Appended to the END of the
// system content so the cached prefix (buildSystemPrompt) stays byte-stable (prefix-cache hits).
const JSON_RETRY_NUDGE =
  "\nIMPORTANT: Your previous response was not valid JSON. Return ONLY the raw JSON object, no explanation.";

/**
 * Coerce model TYPE sloppiness before Zod. The omni read sometimes emits `null` (or "") for a
 * required non-empty rationale/description string — e.g. `cta_segment.rationale` on a no-CTA
 * video (the observed 2026-06-26 live failure: a clean read hard-FAILED the WHOLE parse, twice,
 * on one prose field → the entire Read errored). Fills ONLY those required-`.min(1)` prose
 * strings with a neutral placeholder; fabricates NO score/perception (D-R1: rationale is
 * secondary prose, Apollo is the sole judge). No-op on clean output. Critical-field drift
 * detection still runs after, so a genuinely-empty PERCEPTION field still triggers a retry.
 */
function coerceOmniRead(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const fillStr = (parent: unknown, key: string, fallback: string) => {
    if (parent && typeof parent === "object") {
      const o = parent as Record<string, unknown>;
      if (o[key] == null || o[key] === "") o[key] = fallback;
    }
  };
  fillStr(r.cta_segment, "rationale", "n/a");
  fillStr(r.hook_decomposition, "rationale", "n/a");
  fillStr(r.audio_signals, "audio_description", "n/a");
  return r;
}

/**
 * F9/D-11 — critical-field drift detection. The Zod parse can SUCCEED yet a perception-critical
 * field be empty/absent on content that should have it (the gap MAX_RETRIES never covered — it
 * fired only on whole-response JSON/Zod failure). Returns the drifted field names so the caller
 * can fire ONE bounded retry, then (if still drifted) emit a read_drift log instead of silently
 * dropping to undefined. Gated to avoid false retries on legitimately-empty content:
 *   - emotion_arc: required 3-8 points for video WITH affect; legit-absent for slideshow/b_roll.
 *   - hook_verbatim.spoken_words: expected only when speech is present (F46 nulls speech-derived
 *     fields on no-speech videos — a no-speech video's null verbatim is correct, not drift).
 *   - weakest_modality is intentionally NOT checked: F46's derive guarantees it (visual_stop_power
 *     + text_overlay_score are never nullable), so it can never be underivable.
 */
function detectCriticalFieldDrift(data: OmniAnalysisResult): string[] {
  const drift: string[] = [];

  const isSlideshowLike = data.content_type === "slideshow" || data.content_type === "b_roll";
  if (!isSlideshowLike && (!data.emotion_arc || data.emotion_arc.length === 0)) {
    drift.push("emotion_arc");
  }

  const hasSpeech =
    data.hook_decomposition.first_words_speech_score != null ||
    (data.audio_signals.voiceover_ratio ?? 0) > 0.05;
  const verbatimEmpty = !data.hook_verbatim || data.hook_verbatim.spoken_words == null;
  if (hasSpeech && verbatimEmpty) {
    drift.push("hook_verbatim");
  }

  return drift;
}

// T3.4 (2026-06-07): the niche/content-type hints were interpolated INTO this system
// prompt, busting the DashScope omni prefix-cache once per niche/content-type combo (the
// system prefix is the cache key; any per-request variance = a fresh miss). They moved to
// the VOLATILE user message (buildUserHints) so the system prefix is byte-stable across all
// runs. `opts` is accepted (signature compat) but no longer read here.
export function buildSystemPrompt(_opts: OmniAnalysisOptions = {}): string {
  return `You are an expert TikTok content analyst operating as a pure PERCEPTION sensor. Watch the provided video and return a single JSON object describing WHAT YOU PERCEIVE — the objective sensor reading. You do NOT grade, score holistically, or give improvement advice; a separate expert judge interprets your perception. All scores are 0-10 unless noted otherwise and are PERCEPTUAL measurements (e.g. how loud/clear/fast), not quality verdicts.

IMPORTANT: cognitive_load uses INVERTED polarity — higher score means MORE cognitive load and WORSE viewer retention.

Return ONLY valid JSON matching this exact structure:

{
  "content_type": "<one of: talking_head|b_roll|slideshow|action|tutorial|vlog|comedy|other>",
  "niche_primary_slug": "<primary niche slug e.g. fitness, cooking, comedy, education>",
  "niche_micro_slug": "<specific sub-niche or null>",

  "hook_visual_impact": 0-10,
  "hook_decomposition": {
    "visual_stop_power":        0-10,
    "audio_hook_quality":       0-10,
    "text_overlay_score":       0-10,
    "first_words_speech_score": 0-10,
    "weakest_modality": "<one of: visual_stop_power|audio_hook_quality|text_overlay_score|first_words_speech_score>",
    "visual_audio_coherence":   0-10,
    "cognitive_load":           0-10,
    "watermark_detected": { "tiktok": bool, "ig": bool, "yt": bool }
  },

  "video_signals": {
    "visual_production_quality": 0-10,
    "pacing_score":              0-10,
    "transition_quality":        0-10
  },

  "cta_segment": {
    "cta_present": true|false,
    "strength":    0-10 or null,
    "type":        "follow"|"comment"|"link_in_bio"|"watch_next"|"engage_question"|"other" or null,
    "rationale":   "..."
  },

  "audio_signals": {
    "voice_clarity_0_10":       0-10 or null,
    "audio_hook_first_2s_0_10": 0-10 or null,
    "silence_ratio":   0-1,
    "voiceover_ratio": 0-1,
    "music_ratio":     0-1,
    "audio_description": "<50-150 char audio description>"
  },
  "audio_perceptual_score": 0-100,

  "emotion_arc": [
    { "timestamp_ms": 0,    "intensity_0_1": 0.3, "label": "low" },
    { "timestamp_ms": 5000, "intensity_0_1": 0.8, "label": "high" }
  ],

  "hook_verbatim": {
    "spoken_words": "<verbatim speech from first ~3s, or null if no speech>",
    "on_screen_text": "<verbatim overlay text visible in first ~3s, or null if none>"
  },

  "segments": [
    {
      "t_start": 0.0,
      "t_end": 2.8,
      "visual_event": "<brief description of dominant visual change>",
      "audio_event": "<brief description of dominant audio/speech change>",
      "scene_boundary_reason": "<why this is a scene boundary, optional>",
      "spoken_text": "<verbatim speech in this segment, [inaudible] for unclear speech, or null for silence>",
      "on_screen_text": "<verbatim overlay text visible in this segment, or null if none>"
    }
  ]
}

Rules:
- cta_present=true requires strength and type non-null; cta_present=false requires both null.
- silence_ratio + voiceover_ratio + music_ratio must sum to ~1.0 (±0.1).
- voice_clarity and audio_hook are null only for slideshow or silent content.
- watermark_detected fields are optional (omit if none detected).
- emotion_arc is REQUIRED whenever video is present: you MUST emit 3-8 points across
  the timeline at emotional inflection points (or evenly spaced if the affect is flat —
  never return an empty array for video). Use intensity_0_1 in [0,1]; label is a
  categorical helper ("low"|"mid"|"high"). ONLY omit the emotion_arc field entirely for
  non-video / silent / slideshow content where no temporal affect signal exists.

Rules for segments:
- Detect natural scene boundaries (cut, transition, topic shift, pacing change).
- Hook zone 0-3s MUST be its own segment even if no boundary detected.
- Minimum segment duration: 1s (merge shorter cuts into adjacent segment).
- If fewer than 4 boundaries detected: return 2s fixed buckets (1s for <8s videos).
- Sort by t_start ascending. No overlap. t_end of segment[i] = t_start of segment[i+1].

Rules for verbatim (hook_verbatim + per-segment spoken_text/on_screen_text):
- Transcribe in the spoken language; do NOT translate to English or any other language (D-04.1).
- Use [inaudible] ONLY for speech that is present but unintelligible; use null when there is no speech or no on-screen text — NEVER describe sound, NEVER write a music description like "[music plays]" (D-02 / D-04.2).
- Preserve exact casing, punctuation, and emoji in on_screen_text — do not normalise or paraphrase (D-04.3).
- Cap hook_verbatim fields at ~280 chars; per-segment spoken_text and on_screen_text at ~500 chars (D-04.4).`;
}

/**
 * T3.4 — per-request niche/content-type hints for the VOLATILE user message.
 * Kept OUT of the system prefix (buildSystemPrompt) so the omni prefix-cache stays
 * warm across niches. Empty string when neither hint is present (byte-identical to
 * the pre-T3.4 no-hint path).
 */
export function buildUserHints(opts: OmniAnalysisOptions): string {
  const nicheHint = opts.niche        ? `\nCreator niche hint: ${opts.niche}` : "";
  const ctypeHint = opts.content_type ? `\nContent-type hint: ${opts.content_type}` : "";
  return nicheHint + ctypeHint;
}

export async function analyzeVideoWithOmni(
  videoUrl: string,
  opts: OmniAnalysisOptions = {},
): Promise<OmniAnalysisOutput> {
  const ai    = getQwenClient();
  const model = QWEN_OMNI_MODEL;

  const nullAvailability = { gemini_hook: false, gemini_body: false, gemini_cta: false };
  const nullWave0: Wave0Result = { content_type: null, niche: null };

  let lastError: unknown;
  // F9/D-11: the nudge appended to the next attempt's system content. Set on failure
  // (malformed JSON / Zod fail / critical-field drift) and consumed on the retry. Appended
  // at the END so the cached system prefix stays byte-stable. "" on attempt 0 (cache-warm path).
  let retryHint = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      log.info("omni analysis start", { model, attempt, videoUrl: videoUrl.slice(0, 80) });

      const extraInstruction = attempt > 0 ? retryHint : "";

      const completion = await ai.chat.completions.create(
        {
          model,
          messages: [
            {
              role: "system",
              content: buildSystemPrompt(opts) + extraInstruction,
            },
            {
              role: "user",
              content: [
                {
                  type: "video_url" as never,
                  video_url: { url: videoUrl },
                } as never,
                {
                  type: "text",
                  text: `Analyze this TikTok video and return the JSON object as specified.${buildUserHints(opts)}`,
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0, // reproducible factors/hook/segments — same video → same score
          seed: QWEN_SEED,
          ...(OMNI_MAX_TOKENS ? { max_tokens: OMNI_MAX_TOKENS } : {}),
        },
        { signal: controller.signal },
      );

      clearTimeout(timer);

      const raw     = completion.choices[0]?.message?.content ?? "";
      const cleaned = stripModelOutput(raw);
      const parsed  = JSON.parse(cleaned);
      // Salvage null'd required rationale/description prose before Zod (the observed no-CTA
      // read failure) — a single prose field can no longer hard-fail the whole Read.
      const coerced = coerceOmniRead(parsed);
      const result  = OmniAnalysisZodSchema.safeParse(coerced);

      if (!result.success) {
        log.warn("Omni Zod validation failed", { attempt, error: result.error.message });
        lastError = result.error;
        retryHint = JSON_RETRY_NUDGE;
        continue;
      }

      const data       = result.data;

      // F9/D-11: critical-field drift — the parse succeeded but a perception-critical field is
      // empty on content that should have it. Fire ONE bounded retry (within MAX_RETRIES; re-sends
      // the volatile user message, keeps the cached system prefix). On persistent drift after the
      // retry, accept the read but emit a read_drift log — no longer a silent drop-to-undefined.
      const drift = detectCriticalFieldDrift(data);
      if (drift.length > 0 && attempt < MAX_RETRIES) {
        log.warn("omni critical-field drift — retrying", { attempt, model, drifted_fields: drift });
        lastError = new Error(`omni critical-field drift: ${drift.join(",")}`);
        retryHint =
          `\nIMPORTANT: Your previous response omitted required perception fields: ${drift.join(", ")}. ` +
          "Re-analyze the video and INCLUDE them — emotion_arc: 3-8 points across the timeline for any video with affect; " +
          "hook_verbatim.spoken_words: the verbatim speech from the first ~3s (null only if there is genuinely no speech).";
        continue;
      }
      if (drift.length > 0) {
        log.warn("read_drift", { attempt, model, drifted_fields: drift });
      }

      const cost_cents = calculateCost(model, completion.usage ?? undefined);

      // D-07 + D-08: normalize segments after Zod parse, before returning to consumers.
      // Derive video duration from highest t_end as defensive fallback when not passed in opts.
      const rawDuration = data.segments?.reduce((max, s) => Math.max(max, s.t_end), 0) ?? 0;
      const videoDurationSeconds = rawDuration > 0 ? rawDuration : 30; // 30s fallback if no segments
      const normalizedSegments: SegmentGrid[] = normalizeSegments(data.segments as SegmentGrid[] | undefined, videoDurationSeconds);

      const ctypeSlug = CONTENT_TYPE_VALUES.includes(data.content_type as never)
        ? (data.content_type as (typeof CONTENT_TYPE_VALUES)[number])
        : "other";

      // F12 (01-05): `confidence: 1.0` here is a DEAD placeholder, NOT a model output — the Omni read
      // never emits a content-type/niche confidence, so 1.0 is fabricated certainty. No consumer
      // trusts it (grep-confirmed: nothing reads content_type.confidence / niche.confidence). Left at
      // 1.0 only because Wave0Result's shape requires the field; treat as meaningless (do not surface).
      const wave0Result: Wave0Result = {
        content_type: { type: ctypeSlug, confidence: 1.0 }, // DEAD placeholder (F12) — not a real confidence
        niche: {
          primary_slug: data.niche_primary_slug,
          micro_slug:   data.niche_micro_slug ?? null,
          confidence:   1.0, // DEAD placeholder (F12) — not a real confidence
        },
      };

      // D-R1 (2026-06-11): the Read is a PURE SENSOR. It no longer emits generic JUDGMENT
      // (factors[] scores/rationale, overall_impression, content_summary) — Apollo is the sole
      // judge. gemini_score (the factor-mean) dies with them. Perception (hook_decomposition,
      // video_signals, audio, emotion_arc, verbatim, segments, content_type, niche) is preserved.
      const analysis = {
        video_signals: {
          visual_production_quality: data.video_signals.visual_production_quality,
          hook_visual_impact:        data.hook_visual_impact,
          pacing_score:              data.video_signals.pacing_score,
          transition_quality:        data.video_signals.transition_quality,
        },
        audio_signals:      data.audio_signals,
        hook_decomposition: data.hook_decomposition,
        cta_segment:        data.cta_segment,
        // emotion_arc MUST be threaded here. The aggregator plucks it off
        // geminiResult.analysis.emotion_arc (aggregator.ts ~692). Omitting it
        // — the original bug — silently dropped a Zod-parsed field on EVERY run,
        // so emotion_arc was null on 100% of persisted rows despite the prompt
        // marking it REQUIRED (26/26 rows null, confirmed in prod). GeminiVideoAnalysis
        // doesn't declare the field (Omni-only extension), so it rides through the
        // `as` cast and the aggregator's matching `as unknown as { emotion_arc? }` read.
        // Do NOT "clean up" by removing it — that re-introduces the drop.
        emotion_arc:        data.emotion_arc,
        // Phase 2 (R1) — hook_verbatim MUST be threaded here via the same pattern as
        // emotion_arc above. The aggregator plucks it off geminiResult.analysis.hook_verbatim
        // via `as unknown as { hook_verbatim? }`. Omitting it would silently drop all
        // verbatim on every run — the segment-axis version of the emotion_arc bug.
        // GeminiVideoAnalysis doesn't declare this field; it rides the `as` cast.
        // Do NOT remove — that re-introduces the drop.
        hook_verbatim:      data.hook_verbatim,
      } as GeminiVideoAnalysis;

      // emotion_arc_points surfaces whether the MODEL actually emitted the field
      // (vs the assembly dropping it). After this fix, a run logging 0 points means
      // the model genuinely returned none — a prompt problem, not a plumbing one.
      log.info("omni analysis complete", { model, cost_cents, attempt, emotion_arc_points: data.emotion_arc?.length ?? 0, verbatim_present: data.hook_verbatim != null });

      return {
        geminiResult: { analysis, cost_cents },
        wave0Result,
        audio_perceptual_score: data.audio_perceptual_score,
        signalAvailability: { gemini_hook: true, gemini_body: true, gemini_cta: true },
        segments: normalizedSegments,
      };

    } catch (err: unknown) {
      clearTimeout(timer);
      lastError = err;
      // A thrown error here is most often a JSON.parse SyntaxError (truncation/fence) — nudge
      // the retry toward clean JSON, mirroring the !result.success path.
      retryHint = JSON_RETRY_NUDGE;
      const isAbort = err instanceof Error && err.name === "AbortError";
      log.warn("Omni analysis attempt failed", { attempt, error: String(err), isAbort });
      if (attempt >= MAX_RETRIES) break;
    }
  }

  Sentry.captureException(lastError, { tags: { stage: "omni_analysis" } });
  log.error("Omni analysis failed after all retries", { error: String(lastError) });

  return {
    geminiResult:           null,
    wave0Result:            nullWave0,
    audio_perceptual_score: null,
    signalAvailability:     nullAvailability,
  };
}
