/**
 * The modality split's merge is the one piece with no model in it — pure arithmetic over two
 * reads — so it is the piece that CAN be pinned down offline. Everything these tests protect
 * is a way the split could quietly lie:
 *
 *   - alignment mis-attributing speech to the scene next door
 *   - a CTA claimed by one leg being handed a strength nobody measured
 *   - two different sensors' emotion curves being averaged into one that belongs to neither
 *   - the merged object drifting away from the shape the unified read produces
 *
 * The last one is the load-bearing test: `merges into something OmniAnalysisZodSchema accepts`.
 * If that passes, no consumer downstream can tell which path produced the read — which is the
 * entire safety argument for the split.
 */
import { describe, it, expect } from "vitest";
import {
  alignAudioOntoGrid, chooseEmotionArc, mergeCtaObservations, mergeModalityLegs,
  overlapSeconds, renderAudioSummary, renderVisualSummary, NO_AUDIO_EVENT,
} from "../merge";
import { detectAudioLegDrift } from "../run";
import { AudioLegZodSchema, VideoLegZodSchema } from "../schemas";
import type { AudioLegResult, VideoLegResult } from "../schemas";
import { OmniAnalysisZodSchema } from "../../schemas";

// ---------------------------------------------------------------------------
// Fixtures — deliberately built through the leg schemas so a fixture can never
// encode a shape the real parse would have rejected.
// ---------------------------------------------------------------------------

function videoLeg(over: Partial<VideoLegResult> = {}): VideoLegResult {
  return VideoLegZodSchema.parse({
    content_type: "talking_head",
    niche_primary_slug: "comedy",
    niche_micro_slug: "skit",
    hook_visual_impact: 7,
    visual_stop_power: 8,
    text_overlay_score: 6,
    cognitive_load: 3,
    watermark_detected: { tiktok: true },
    video_signals: { visual_production_quality: 7, pacing_score: 8, transition_quality: 6 },
    visual_cta: { cta_present: false, strength: null, type: null, rationale: "no visible CTA" },
    hook_on_screen_text: "WAIT FOR IT",
    segments: [
      { t_start: 0, t_end: 3, visual_event: "close-up, subject turns to camera", on_screen_text: "WAIT FOR IT" },
      { t_start: 3, t_end: 8, visual_event: "cut to wide shot of the kitchen", scene_boundary_reason: "hard cut" },
      { t_start: 8, t_end: 12, visual_event: "product held up to lens" },
    ],
    ...over,
  });
}

function audioLeg(over: Partial<AudioLegResult> = {}): AudioLegResult {
  return AudioLegZodSchema.parse({
    audio_hook_quality: 7,
    first_words_speech_score: 8,
    audio_signals: {
      voice_clarity_0_10: 8,
      audio_hook_first_2s_0_10: 7,
      silence_ratio: 0.1,
      voiceover_ratio: 0.7,
      music_ratio: 0.2,
      audio_description: "clear male voiceover over light background music",
    },
    audio_perceptual_score: 74,
    hook_spoken_words: "My best friend is Emily Rose Johnson",
    emotion_arc: [
      { timestamp_ms: 0, intensity_0_1: 0.3, label: "low" },
      { timestamp_ms: 5000, intensity_0_1: 0.8, label: "high" },
      { timestamp_ms: 10000, intensity_0_1: 0.5, label: "mid" },
    ],
    spoken_cta: { cta_present: false, strength: null, type: null, rationale: "no spoken ask" },
    audio_events: [
      { t_start: 0, t_end: 4, audio_event: "speech, upbeat", spoken_text: "My best friend is Emily Rose Johnson" },
      { t_start: 4, t_end: 9, audio_event: "speech continues over music", spoken_text: "What's his last name?" },
      { t_start: 9, t_end: 12, audio_event: "music only", spoken_text: null },
    ],
    ...over,
  });
}

// ---------------------------------------------------------------------------
// overlap + alignment
// ---------------------------------------------------------------------------

describe("overlapSeconds", () => {
  it("measures a real overlap", () => {
    expect(overlapSeconds({ t_start: 0, t_end: 5 }, { t_start: 3, t_end: 9 })).toBe(2);
  });

  it("returns 0 for windows that merely TOUCH — a boundary is not an overlap", () => {
    // This is what stops the segment ending at 3.0 from absorbing the audio event starting
    // at 3.0, which would put the next scene's first word in the hook segment.
    expect(overlapSeconds({ t_start: 0, t_end: 3 }, { t_start: 3, t_end: 6 })).toBe(0);
  });

  it("returns 0 for disjoint windows", () => {
    expect(overlapSeconds({ t_start: 0, t_end: 2 }, { t_start: 8, t_end: 9 })).toBe(0);
  });
});

describe("alignAudioOntoGrid", () => {
  it("gives each segment the audio event it overlaps MOST, not the first one it touches", () => {
    const { segments } = alignAudioOntoGrid(videoLeg().segments, audioLeg().audio_events);
    // 3-8s overlaps "speech, upbeat" by 1s (3→4) and "speech continues" by 4s (4→8).
    expect(segments[1]!.audio_event).toBe("speech continues over music");
  });

  it("keeps every word when a sentence straddles a cut", () => {
    const { segments } = alignAudioOntoGrid(videoLeg().segments, audioLeg().audio_events);
    // The 3-8s segment overlaps both speech events, so both transcripts must survive.
    expect(segments[1]!.spoken_text).toBe("My best friend is Emily Rose Johnson What's his last name?");
  });

  it("does not repeat identical verbatim reported by two overlapping events", () => {
    const audio = audioLeg({
      audio_events: [
        { t_start: 0, t_end: 2, audio_event: "speech", spoken_text: "same line" },
        { t_start: 2, t_end: 4, audio_event: "speech", spoken_text: "same line" },
      ],
    });
    const { segments } = alignAudioOntoGrid(
      [{ t_start: 0, t_end: 4, visual_event: "one shot" }],
      audio.audio_events,
    );
    expect(segments[0]!.spoken_text).toBe("same line");
  });

  it("marks a segment the listener reported NOTHING for, and never borrows a neighbour's audio", () => {
    const { segments, segments_without_audio } = alignAudioOntoGrid(
      [
        { t_start: 0, t_end: 3, visual_event: "opening" },
        { t_start: 30, t_end: 34, visual_event: "a scene past the end of the audio" },
      ],
      audioLeg().audio_events,
    );
    expect(segments[1]!.audio_event).toBe(NO_AUDIO_EVENT);
    expect(segments[1]!.spoken_text).toBeNull();
    expect(segments_without_audio).toBe(1);
  });

  it("truncates joined verbatim at the D-04.4 cap instead of failing the whole read", () => {
    const long = "x".repeat(400);
    const { segments, verbatim_truncated } = alignAudioOntoGrid(
      [{ t_start: 0, t_end: 10, visual_event: "one long shot" }],
      [
        { t_start: 0, t_end: 5, audio_event: "speech", spoken_text: long },
        { t_start: 5, t_end: 10, audio_event: "speech", spoken_text: `${long}!` },
      ],
    );
    expect(segments[0]!.spoken_text!.length).toBe(500);
    expect(verbatim_truncated).toBe(1);
  });

  it("survives a leg that reported no events at all", () => {
    const { segments, segments_without_audio } = alignAudioOntoGrid(videoLeg().segments, []);
    expect(segments).toHaveLength(3);
    expect(segments.every((s) => s.audio_event === NO_AUDIO_EVENT)).toBe(true);
    expect(segments_without_audio).toBe(3);
  });

  it("preserves the video leg's grid exactly — the audio never moves a boundary", () => {
    const grid = videoLeg().segments!;
    const { segments } = alignAudioOntoGrid(grid, audioLeg().audio_events);
    expect(segments.map((s) => [s.t_start, s.t_end])).toEqual(grid.map((s) => [s.t_start, s.t_end]));
  });
});

// ---------------------------------------------------------------------------
// CTA union
// ---------------------------------------------------------------------------

describe("mergeCtaObservations", () => {
  it("carries a CTA only one leg could perceive (on-screen)", () => {
    const merged = mergeCtaObservations(
      { cta_present: true, strength: 7, type: "link_in_bio", rationale: "link in bio overlay at 11s" },
      { cta_present: false, strength: null, type: null, rationale: "no spoken ask" },
    );
    expect(merged).toMatchObject({ cta_present: true, strength: 7, type: "link_in_bio", source: "visual" });
  });

  it("carries a CTA only one leg could perceive (spoken)", () => {
    const merged = mergeCtaObservations(
      { cta_present: false, strength: null, type: null, rationale: "nothing visible" },
      { cta_present: true, strength: 6, type: "follow", rationale: "asks for a follow at 21s" },
    );
    expect(merged).toMatchObject({ cta_present: true, strength: 6, type: "follow", source: "spoken" });
  });

  it("takes the stronger reading when both legs graded one, and keeps both rationales", () => {
    const merged = mergeCtaObservations(
      { cta_present: true, strength: 4, type: "link_in_bio", rationale: "small overlay" },
      { cta_present: true, strength: 9, type: "follow", rationale: "direct spoken ask" },
    );
    expect(merged).toMatchObject({ cta_present: true, strength: 9, type: "follow", source: "both" });
    expect(merged.rationale).toContain("small overlay");
    expect(merged.rationale).toContain("direct spoken ask");
  });

  it("resolves an equal-strength tie to the VISIBLE CTA (the more explicit artefact)", () => {
    const merged = mergeCtaObservations(
      { cta_present: true, strength: 7, type: "link_in_bio", rationale: "overlay" },
      { cta_present: true, strength: 7, type: "follow", rationale: "spoken" },
    );
    expect(merged.type).toBe("link_in_bio");
  });

  it("REFUSES to invent a strength for a CTA claimed without one", () => {
    // The failure this guards: a leg says cta_present:true and omits strength/type. Filling in
    // a plausible 5 would push a number no model measured into Apollo's prompt and onto the board.
    const merged = mergeCtaObservations(
      { cta_present: true, strength: null, type: null, rationale: "there is some kind of end card" },
      { cta_present: false, strength: null, type: null, rationale: "no spoken ask" },
    );
    expect(merged.cta_present).toBe(false);
    expect(merged.strength).toBeNull();
    expect(merged.type).toBeNull();
    expect(merged.source).toBe("ungradeable");
    expect(merged.rationale).toContain("no gradeable strength");
  });

  it("reports a clean absence when neither leg saw or heard one", () => {
    const merged = mergeCtaObservations(
      { cta_present: false, strength: null, type: null, rationale: "no visible CTA" },
      { cta_present: false, strength: null, type: null, rationale: "no spoken ask" },
    );
    expect(merged).toMatchObject({ cta_present: false, strength: null, type: null, source: "none" });
    expect(merged.rationale.length).toBeGreaterThan(0);
  });

  it("always produces a rationale the strict schema will accept (non-empty, ≤400)", () => {
    const merged = mergeCtaObservations(
      { cta_present: true, strength: 5, type: "follow", rationale: "a".repeat(600) },
      { cta_present: true, strength: 5, type: "comment", rationale: "b".repeat(600) },
    );
    expect(merged.rationale.length).toBeGreaterThan(0);
    expect(merged.rationale.length).toBeLessThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// Emotion arc
// ---------------------------------------------------------------------------

describe("chooseEmotionArc", () => {
  it("prefers the listener's arc — affect is carried mostly by voice and music", () => {
    const audio = [{ timestamp_ms: 0, intensity_0_1: 0.4 }];
    const video = [{ timestamp_ms: 0, intensity_0_1: 0.9 }];
    expect(chooseEmotionArc(audio, video)).toEqual({ arc: audio, source: "audio" });
  });

  it("falls back to the watcher's arc on silent footage", () => {
    const video = [{ timestamp_ms: 0, intensity_0_1: 0.9 }];
    expect(chooseEmotionArc([], video)).toEqual({ arc: video, source: "video" });
    expect(chooseEmotionArc(undefined, video)).toEqual({ arc: video, source: "video" });
  });

  it("never blends the two — a mixed curve would belong to neither sensor", () => {
    const audio = [{ timestamp_ms: 0, intensity_0_1: 0.2 }];
    const video = [{ timestamp_ms: 0, intensity_0_1: 0.8 }];
    expect(chooseEmotionArc(audio, video).arc).toBe(audio);
  });

  it("reports absence rather than fabricating a flat curve", () => {
    expect(chooseEmotionArc(undefined, undefined)).toEqual({ arc: undefined, source: "none" });
  });
});

// ---------------------------------------------------------------------------
// Whole merge — the shape contract
// ---------------------------------------------------------------------------

describe("mergeModalityLegs", () => {
  it("merges into something OmniAnalysisZodSchema accepts (the split's whole safety argument)", () => {
    const { merged } = mergeModalityLegs({ video: videoLeg(), audio: audioLeg(), visual_audio_coherence: 8 });
    const parsed = OmniAnalysisZodSchema.safeParse(merged);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("routes every field to the leg that could actually perceive it", () => {
    const { merged } = mergeModalityLegs({ video: videoLeg(), audio: audioLeg(), visual_audio_coherence: 8 });
    const data = OmniAnalysisZodSchema.parse(merged);

    // sighted leg
    expect(data.hook_decomposition.visual_stop_power).toBe(8);
    expect(data.hook_decomposition.text_overlay_score).toBe(6);
    expect(data.hook_decomposition.cognitive_load).toBe(3);
    expect(data.content_type).toBe("talking_head");
    expect(data.hook_verbatim?.on_screen_text).toBe("WAIT FOR IT");
    // hearing leg
    expect(data.hook_decomposition.audio_hook_quality).toBe(7);
    expect(data.hook_decomposition.first_words_speech_score).toBe(8);
    expect(data.audio_perceptual_score).toBe(74);
    expect(data.hook_verbatim?.spoken_words).toBe("My best friend is Emily Rose Johnson");
    // neither leg
    expect(data.hook_decomposition.visual_audio_coherence).toBe(8);
  });

  it("lets the schema DERIVE weakest_modality instead of computing it a second time", () => {
    const { merged } = mergeModalityLegs({
      video: videoLeg({ visual_stop_power: 9, text_overlay_score: 9 }),
      audio: audioLeg({ audio_hook_quality: 2, first_words_speech_score: 9 }),
      visual_audio_coherence: 7,
    });
    expect((merged.hook_decomposition as Record<string, unknown>).weakest_modality).toBeUndefined();
    const data = OmniAnalysisZodSchema.parse(merged);
    expect(data.hook_decomposition.weakest_modality).toBe("audio_hook_quality");
  });

  it("keeps a no-speech read's nulls as nulls — 0 would mean 'present and terrible'", () => {
    const silent = audioLeg({
      audio_hook_quality: null,
      first_words_speech_score: null,
      hook_spoken_words: null,
      audio_signals: {
        voice_clarity_0_10: null, audio_hook_first_2s_0_10: null,
        silence_ratio: 0.2, voiceover_ratio: 0, music_ratio: 0.8,
        audio_description: "music only, no speech",
      },
    });
    const data = OmniAnalysisZodSchema.parse(
      mergeModalityLegs({ video: videoLeg(), audio: silent, visual_audio_coherence: 6 }).merged,
    );
    expect(data.hook_decomposition.audio_hook_quality).toBeNull();
    expect(data.hook_decomposition.first_words_speech_score).toBeNull();
    expect(data.hook_verbatim?.spoken_words).toBeNull();
    // still derivable from the two never-nullable visual modalities
    expect(data.hook_decomposition.weakest_modality).toBe("text_overlay_score");
  });

  it("reports what the alignment could not do", () => {
    const { diagnostics } = mergeModalityLegs({
      video: videoLeg(), audio: audioLeg({ audio_events: [] }), visual_audio_coherence: 5,
    });
    expect(diagnostics).toMatchObject({
      video_segments: 3, audio_events: 0, segments_without_audio: 3, emotion_arc_source: "audio", cta_source: "none",
    });
  });

  it("still parses when the watcher returned no grid at all", () => {
    const { merged } = mergeModalityLegs({
      video: videoLeg({ segments: undefined }), audio: audioLeg(), visual_audio_coherence: 5,
    });
    expect(merged.segments).toBeUndefined();
    expect(OmniAnalysisZodSchema.safeParse(merged).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Coherence inputs
// ---------------------------------------------------------------------------

describe("coherence summaries", () => {
  it("renders both modalities with their timings so the judge can reason about sync", () => {
    const v = renderVisualSummary(videoLeg());
    const a = renderAudioSummary(audioLeg());
    expect(v).toContain("0.0-3.0s");
    expect(v).toContain("close-up, subject turns to camera");
    expect(a).toContain("first words:");
    expect(a).toContain("speech 70%");
  });

  it("bounds the rendering so a long video cannot blow up the cheap third call", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      t_start: i, t_end: i + 1, visual_event: `scene ${i}`,
    }));
    const rendered = renderVisualSummary(videoLeg({ segments: many }));
    expect(rendered).toContain("scene 11");
    expect(rendered).not.toContain("scene 12");
  });

  it("says so plainly when a leg reported nothing", () => {
    expect(renderAudioSummary(audioLeg({ audio_events: [], hook_spoken_words: null })))
      .toContain("first words: no speech");
  });
});

// ---------------------------------------------------------------------------
// Drift
// ---------------------------------------------------------------------------

describe("detectAudioLegDrift", () => {
  it("passes a healthy pair", () => {
    expect(detectAudioLegDrift(videoLeg(), audioLeg())).toEqual([]);
  });

  it("flags a missing emotion arc on affect-carrying content", () => {
    expect(detectAudioLegDrift(videoLeg(), audioLeg({ emotion_arc: [] })))
      .toContain("emotion_arc");
  });

  it("does NOT flag a missing arc when the watcher supplied one (silent footage path)", () => {
    const video = videoLeg({ emotion_arc: [{ timestamp_ms: 0, intensity_0_1: 0.5 }] });
    expect(detectAudioLegDrift(video, audioLeg({ emotion_arc: [] }))).toEqual([]);
  });

  it("does NOT flag slideshow / b_roll, which legitimately have no arc", () => {
    expect(detectAudioLegDrift(videoLeg({ content_type: "slideshow" }), audioLeg({ emotion_arc: [] }))).toEqual([]);
    expect(detectAudioLegDrift(videoLeg({ content_type: "b_roll" }), audioLeg({ emotion_arc: [] }))).toEqual([]);
  });

  it("flags verbatim missing when there IS speech", () => {
    expect(detectAudioLegDrift(videoLeg(), audioLeg({ hook_spoken_words: null })))
      .toContain("hook_spoken_words");
  });

  it("does NOT flag null verbatim on a genuinely speechless track (F46 parity)", () => {
    const noSpeech = audioLeg({
      hook_spoken_words: null,
      first_words_speech_score: null,
      audio_signals: {
        voice_clarity_0_10: null, audio_hook_first_2s_0_10: null,
        silence_ratio: 0.3, voiceover_ratio: 0, music_ratio: 0.7,
        audio_description: "instrumental only",
      },
    });
    expect(detectAudioLegDrift(videoLeg(), noSpeech)).toEqual([]);
  });
});
