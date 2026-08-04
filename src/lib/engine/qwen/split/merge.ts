/**
 * Fold the two modality legs back into the ONE shape the engine already understands.
 *
 * The output of `mergeModalityLegs` is fed straight into `OmniAnalysisZodSchema` — the same
 * parse the unified read goes through. That is deliberate and is the safety property of this
 * whole design: if the merge produces something the existing schema rejects, the split fails
 * loudly at the same gate the unified read fails at, rather than leaking a novel shape into
 * the aggregator, the fold, Apollo, decode and the filmstrip queue.
 *
 * Everything here is PURE — no network, no clock, no env. The alignment maths and the CTA
 * union are the parts most likely to be subtly wrong, so they are directly unit-testable.
 *
 * 🔑 The rule the whole file obeys: an absent perception stays absent. Nothing in here
 * computes a score, splits the difference between two legs, or fills a gap with a default.
 * The merge only ever COPIES what a model reported or records that nothing was reported.
 */

import { createLogger } from "@/lib/logger";
import { joinVerbatim } from "../normalize-segments";
import type { AudioLegResult, CtaObservation, VideoLegResult } from "./schemas";

const log = createLogger({ module: "engine.qwen.split.merge" });

/** Written into `audio_event` for a video segment no audio event overlaps. It is a record of
 *  SILENCE IN THE REPORTING, not a claim that the video was silent — the two are different and
 *  the aggregator should never see them conflated. */
export const NO_AUDIO_EVENT = "(no audio event reported for this window)";

/** D-04.4 verbatim caps, restated here because the merge can CONCATENATE past them. */
const MAX_SEGMENT_VERBATIM = 500;

export interface MergedSegment {
  t_start: number;
  t_end: number;
  visual_event: string;
  audio_event: string;
  scene_boundary_reason?: string;
  spoken_text?: string | null;
  on_screen_text?: string | null;
}

export interface MergeDiagnostics {
  video_segments: number;
  audio_events: number;
  /** Segments the audio leg reported nothing for — the alignment's honest failure count. */
  segments_without_audio: number;
  /** Segments whose joined verbatim had to be truncated at the D-04.4 cap. */
  verbatim_truncated: number;
  emotion_arc_source: "audio" | "video" | "none";
  cta_source: "visual" | "spoken" | "both" | "none" | "ungradeable";
}

// ---------------------------------------------------------------------------
// Alignment — audio events onto the video grid
// ---------------------------------------------------------------------------

interface Window { t_start: number; t_end: number }

/** Seconds of overlap between two time windows; 0 when they merely touch or are disjoint. */
export function overlapSeconds(a: Window, b: Window): number {
  return Math.max(0, Math.min(a.t_end, b.t_end) - Math.max(a.t_start, b.t_start));
}

/**
 * Project the audio leg's own timeline onto the video leg's authoritative grid.
 *
 * For each video segment: the audio event with the GREATEST overlap wins the `audio_event`
 * slot (ties resolve to the earlier event), and every overlapping event's verbatim is joined
 * in time order so no spoken word is dropped just because a sentence straddled a cut.
 *
 * A segment with no overlapping audio event gets NO_AUDIO_EVENT — never a borrowed
 * description from a neighbouring segment, which would attribute sound to the wrong scene.
 */
export function alignAudioOntoGrid(
  videoSegments: VideoLegResult["segments"],
  audioEvents: AudioLegResult["audio_events"],
): { segments: MergedSegment[]; segments_without_audio: number; verbatim_truncated: number } {
  const grid = videoSegments ?? [];
  const events = [...(audioEvents ?? [])].sort((a, b) => a.t_start - b.t_start);

  let segments_without_audio = 0;
  let verbatim_truncated = 0;

  const segments = grid.map((seg) => {
    const overlapping = events
      .map((e) => ({ e, overlap: overlapSeconds(seg, e) }))
      .filter((x) => x.overlap > 0);

    let audio_event = NO_AUDIO_EVENT;
    if (overlapping.length === 0) {
      segments_without_audio++;
    } else {
      // Greatest overlap wins. `events` is already time-sorted and reduce keeps the incumbent
      // on a tie, so ties resolve to the EARLIER event deterministically.
      audio_event = overlapping.reduce((best, x) => (x.overlap > best.overlap ? x : best)).e.audio_event;
    }

    // Join every overlapping event's speech in time order. joinVerbatim is the same helper
    // the sub-1s segment merge uses, so "said twice" de-duplication behaves identically.
    let spoken_text = overlapping.reduce<string | null>(
      (acc, x) => joinVerbatim(acc, x.e.spoken_text),
      null,
    );
    if (spoken_text !== null && spoken_text.length > MAX_SEGMENT_VERBATIM) {
      spoken_text = spoken_text.slice(0, MAX_SEGMENT_VERBATIM);
      verbatim_truncated++;
    }

    return {
      t_start: seg.t_start,
      t_end: seg.t_end,
      visual_event: seg.visual_event,
      audio_event,
      ...(seg.scene_boundary_reason !== undefined ? { scene_boundary_reason: seg.scene_boundary_reason } : {}),
      spoken_text,
      on_screen_text: seg.on_screen_text ?? null,
    } satisfies MergedSegment;
  });

  return { segments, segments_without_audio, verbatim_truncated };
}

// ---------------------------------------------------------------------------
// CTA union
// ---------------------------------------------------------------------------

/** A CTA observation is usable only if the leg both claimed it AND graded it. */
function isGradeable(c: CtaObservation): c is CtaObservation & { strength: number; type: NonNullable<CtaObservation["type"]> } {
  return c.cta_present === true && typeof c.strength === "number" && c.type != null;
}

function clampRationale(s: string): string {
  const trimmed = s.trim();
  return (trimmed.length > 0 ? trimmed : "n/a").slice(0, 400);
}

/**
 * Resolve the two half-observations into the strict paired shape CtaSegmentZodSchema demands.
 *
 * A CTA can be purely visual ("link in bio" on screen) or purely spoken ("smash that follow"),
 * so either leg alone can carry it — the union is `present if EITHER saw it`. When both graded
 * one, the stronger reading wins and both rationales survive.
 *
 * ⚠️ The awkward case is a leg that says `cta_present: true` but gives no strength or type.
 * There is no honest number to put there, so the merge does NOT invent one: it records the
 * claim in the rationale and reports `cta_present: false`. Inventing a strength would push a
 * fabricated 0-10 into Apollo's prompt and onto the board.
 */
export function mergeCtaObservations(
  visual: CtaObservation,
  spoken: CtaObservation,
): { cta_present: boolean; strength: number | null; type: string | null; rationale: string; source: MergeDiagnostics["cta_source"] } {
  const visualOk = isGradeable(visual);
  const spokenOk = isGradeable(spoken);

  if (visualOk || spokenOk) {
    // Strict `>` keeps the incumbent on a tie, and visual is the incumbent — an on-screen CTA
    // is the more explicit artefact when both read equally strong.
    const winner = visualOk && spokenOk
      ? (spoken.strength! > visual.strength! ? spoken : visual)
      : (visualOk ? visual : spoken);

    const rationale = visualOk && spokenOk
      ? `Seen: ${visual.rationale ?? "on-screen CTA"} | Heard: ${spoken.rationale ?? "spoken CTA"}`
      : (winner.rationale ?? (visualOk ? "on-screen CTA" : "spoken CTA"));

    return {
      cta_present: true,
      strength: winner.strength!,
      type: winner.type!,
      rationale: clampRationale(rationale),
      source: visualOk && spokenOk ? "both" : visualOk ? "visual" : "spoken",
    };
  }

  const claimedUngradeable = visual.cta_present === true || spoken.cta_present === true;
  if (claimedUngradeable) {
    const who = visual.cta_present ? "the watcher" : "the listener";
    log.warn("split: CTA claimed without a gradeable strength/type — recorded, not scored", { who });
    return {
      cta_present: false,
      strength: null,
      type: null,
      rationale: clampRationale(
        `${who} reported a CTA but gave no gradeable strength or type, so it is not scored: ` +
        `${visual.rationale ?? spoken.rationale ?? "no detail given"}`,
      ),
      source: "ungradeable",
    };
  }

  return {
    cta_present: false,
    strength: null,
    type: null,
    rationale: clampRationale(visual.rationale ?? spoken.rationale ?? "no CTA detected"),
    source: "none",
  };
}

// ---------------------------------------------------------------------------
// Emotion arc
// ---------------------------------------------------------------------------

/**
 * The audio leg owns the arc — affect in short-form video is carried mostly by voice and
 * music, and the audio leg is the one that hears both. The video leg's arc is a FALLBACK for
 * genuinely silent footage, where the unified read would otherwise have produced a curve from
 * facial expression and motion alone. The two are never averaged: they are different sensors
 * measuring different things and a blended curve would belong to neither.
 */
export function chooseEmotionArc(
  audioArc: AudioLegResult["emotion_arc"],
  videoArc: VideoLegResult["emotion_arc"],
): { arc: AudioLegResult["emotion_arc"]; source: MergeDiagnostics["emotion_arc_source"] } {
  if (audioArc && audioArc.length > 0) return { arc: audioArc, source: "audio" };
  if (videoArc && videoArc.length > 0) return { arc: videoArc, source: "video" };
  return { arc: undefined, source: "none" };
}

// ---------------------------------------------------------------------------
// Top-level merge
// ---------------------------------------------------------------------------

export interface MergeInput {
  video: VideoLegResult;
  audio: AudioLegResult;
  /** From the third, text-only call. Required: it is the one field neither leg can produce. */
  visual_audio_coherence: number;
}

/**
 * Assemble the unified-read shape. The return value is intentionally `unknown`-ish (a plain
 * object) because its only legitimate consumer is `OmniAnalysisZodSchema.safeParse` — typing it
 * as OmniAnalysisResult here would assert a validity this function does not itself guarantee.
 *
 * `weakest_modality` is deliberately NOT set: HookDecompositionZodSchema derives it from the
 * four modality scores in a transform, skipping nulls. Setting it here would duplicate that
 * logic in a second place and let the two drift.
 */
export function mergeModalityLegs(input: MergeInput): { merged: Record<string, unknown>; diagnostics: MergeDiagnostics } {
  const { video, audio, visual_audio_coherence } = input;

  const aligned = alignAudioOntoGrid(video.segments, audio.audio_events);
  const cta = mergeCtaObservations(video.visual_cta, audio.spoken_cta);
  const { arc, source: emotion_arc_source } = chooseEmotionArc(audio.emotion_arc, video.emotion_arc);

  const diagnostics: MergeDiagnostics = {
    video_segments: video.segments?.length ?? 0,
    audio_events: audio.audio_events?.length ?? 0,
    segments_without_audio: aligned.segments_without_audio,
    verbatim_truncated: aligned.verbatim_truncated,
    emotion_arc_source,
    cta_source: cta.source,
  };

  const merged: Record<string, unknown> = {
    content_type:       video.content_type,
    niche_primary_slug: video.niche_primary_slug,
    niche_micro_slug:   video.niche_micro_slug ?? null,

    hook_visual_impact: video.hook_visual_impact,

    hook_decomposition: {
      // sighted leg
      visual_stop_power:  video.visual_stop_power,
      text_overlay_score: video.text_overlay_score,
      cognitive_load:     video.cognitive_load,
      ...(video.watermark_detected ? { watermark_detected: video.watermark_detected } : {}),
      // hearing leg
      audio_hook_quality:       audio.audio_hook_quality,
      first_words_speech_score: audio.first_words_speech_score,
      // neither leg — the third call
      visual_audio_coherence,
      // weakest_modality omitted on purpose (derived by the schema transform)
    },

    video_signals: video.video_signals,

    cta_segment: {
      cta_present: cta.cta_present,
      strength:    cta.strength,
      type:        cta.type,
      rationale:   cta.rationale,
    },

    audio_signals:          audio.audio_signals,
    audio_perceptual_score: audio.audio_perceptual_score,

    ...(arc ? { emotion_arc: arc } : {}),

    hook_verbatim: {
      spoken_words:   audio.hook_spoken_words ?? null,
      on_screen_text: video.hook_on_screen_text ?? null,
    },

    ...(aligned.segments.length > 0 ? { segments: aligned.segments } : {}),
  };

  return { merged, diagnostics };
}

// ---------------------------------------------------------------------------
// Coherence call inputs
// ---------------------------------------------------------------------------

/** Compact text rendering of the visual leg, for the coherence judge. Bounded so a long video
 *  cannot blow the third call's context out (it is supposed to be the cheap one). */
export function renderVisualSummary(video: VideoLegResult, maxSegments = 12): string {
  const segs = (video.segments ?? []).slice(0, maxSegments)
    .map((s) => `  ${s.t_start.toFixed(1)}-${s.t_end.toFixed(1)}s: ${s.visual_event}` +
      (s.on_screen_text ? ` [text: ${s.on_screen_text}]` : ""))
    .join("\n");
  return [
    `content_type: ${video.content_type} (niche ${video.niche_primary_slug})`,
    `visual_stop_power ${video.visual_stop_power}/10, pacing ${video.video_signals.pacing_score}/10, transitions ${video.video_signals.transition_quality}/10`,
    video.hook_on_screen_text ? `hook overlay text: "${video.hook_on_screen_text}"` : "hook overlay text: none",
    segs ? `scenes:\n${segs}` : "scenes: none reported",
  ].join("\n");
}

/** Compact text rendering of the audio leg, for the coherence judge. */
export function renderAudioSummary(audio: AudioLegResult, maxEvents = 12): string {
  const evs = (audio.audio_events ?? []).slice(0, maxEvents)
    .map((e) => `  ${e.t_start.toFixed(1)}-${e.t_end.toFixed(1)}s: ${e.audio_event}` +
      (e.spoken_text ? ` [speech: ${e.spoken_text}]` : ""))
    .join("\n");
  const a = audio.audio_signals;
  return [
    `audio: ${a.audio_description}`,
    `mix — speech ${(a.voiceover_ratio * 100).toFixed(0)}%, music ${(a.music_ratio * 100).toFixed(0)}%, silence ${(a.silence_ratio * 100).toFixed(0)}%`,
    audio.hook_spoken_words ? `first words: "${audio.hook_spoken_words}"` : "first words: no speech",
    evs ? `audio timeline:\n${evs}` : "audio timeline: none reported",
  ].join("\n");
}
