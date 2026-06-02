/**
 * Phase 03 Plan 01 — Omni structural fixtures for decode engine tests.
 *
 * Built from spike §6 real-world Omni fidelity sample values (2026-06-01).
 * Both fixtures use verbatim field values from the spike §6 + §7 differential table.
 *
 * comedyFixture: Mr Bean POV impersonation (comedy, 16.8s, 6 short cuts)
 *   → drives PRESENT verdicts on hook_pattern, structure_pacing
 *   → narrative twist (the_turn) PRESENT (pivot at segment 4 — visible scene change)
 *   → emotional_beat PRESENT (high intensity arc)
 *
 * tutorialFlatFixture: Splice TikTok editing tutorial (tutorial, 59s, 7 long blocks)
 *   → hook_pattern PRESENT (strong first-words + text overlay)
 *   → structure_pacing WEAK (very long segment blocks, low pacing_score)
 *   → the_turn ABSENT (no scene-boundary pivot across 7 segments, continuous instructional flow)
 *   → emotional_beat ABSENT (flat emotion arc — all intensity_0_1 <= 0.4)
 */
import type { OmniStructuralInput } from "../../decode-types";

// =====================================================
// Comedy fixture — Mr Bean POV impersonation
// Source: spike §6 comedy sample + §7 differential
// =====================================================

export const comedyFixture: OmniStructuralInput = {
  hook_decomposition: {
    // spike §6 verbatim: visual_stop_power:9, audio_hook_quality:10
    visual_stop_power: 9,
    audio_hook_quality: 10,
    text_overlay_score: 9,
    first_words_speech_score: 10,
    weakest_modality: "text_overlay_score",
    visual_audio_coherence: 10,
    cognitive_load: 2,
  },
  factors: [
    {
      name: "Scroll-Stop Power",
      score: 9,
      rationale: "Wide-angle driveway setup with Mr. Bean POV framing creates immediate visual curiosity.",
      improvement_tip: "Consider adding a text hook in the first frame.",
    },
    {
      name: "Completion Pull",
      score: 8,
      rationale: "The character impersonation premise creates a strong pull to see the full bit play out.",
      improvement_tip: "Tighten the mid-section to maintain momentum.",
    },
    {
      name: "Rewatch Potential",
      score: 7,
      rationale: "Physical comedy beats reward re-watching to catch missed gags.",
    },
    {
      name: "Share Trigger",
      score: 8,
      rationale: "High relatability and character recognition drive share intent.",
    },
    {
      name: "Emotional Charge",
      score: 9,
      rationale: "Joy and nostalgia around the Mr. Bean persona generate strong emotional response.",
    },
  ],
  // spike §6 verbatim: 6 segments [0–3, 3–5.5, 5.5–8, 8–11, 11–14, 14–16.8]
  segments: [
    {
      t_start: 0,
      t_end: 3,
      visual_event: "Wide-angle driveway shot, creator in position, 'Pov: Mr Bean' text overlay",
      audio_event: "Silence then character voice begins",
      scene_boundary_reason: "Opening scene establishment",
      is_hook_zone: true,
    },
    {
      t_start: 3,
      t_end: 5.5,
      visual_event: "First physical comedy beat — exaggerated walk",
      audio_event: "Mr Bean-style humming",
      is_hook_zone: true,
    },
    {
      t_start: 5.5,
      t_end: 8,
      visual_event: "Close-up reaction shot, comedic expression",
      audio_event: "Physical comedy sounds",
    },
    {
      t_start: 8,
      t_end: 11,
      visual_event: "Scene pivot — new location angle, unexpected prop reveal",
      audio_event: "Comedic timing beat",
      scene_boundary_reason: "Location change with unexpected prop — comedy pivot",
    },
    {
      t_start: 11,
      t_end: 14,
      visual_event: "Payoff bit — climax of the impersonation",
      audio_event: "Peak comedic moment, character catchphrase",
    },
    {
      t_start: 14,
      t_end: 16.8,
      visual_event: "Reaction hold + text overlay ending",
      audio_event: "Fade out, comedic stinger",
    },
  ],
  video_signals: {
    visual_production_quality: 8,
    pacing_score: 9,
    transition_quality: 8,
  },
  emotion_arc: [
    { timestamp_ms: 0,     intensity_0_1: 0.5, label: "mid" },
    { timestamp_ms: 3000,  intensity_0_1: 0.7, label: "high" },
    { timestamp_ms: 6000,  intensity_0_1: 0.8, label: "high" },
    { timestamp_ms: 9000,  intensity_0_1: 0.9, label: "high" },
    { timestamp_ms: 12000, intensity_0_1: 0.95, label: "high" },
    { timestamp_ms: 15000, intensity_0_1: 0.85, label: "high" },
  ],
  content_summary:
    "Mr. Bean POV impersonation filmed in a driveway setting with wide-angle lens. Creator uses character voice and exaggerated physical comedy to recreate iconic Mr. Bean mannerisms, building to a comedic payoff.",
  overall_impression:
    "High-energy comedy with strong character work. The consistent impersonation quality and well-timed physical gags create compelling watch-through momentum.",
  content_type: "comedy",
  niche_primary_slug: "comedy",
};

// =====================================================
// Tutorial flat fixture — Splice TikTok editing tutorial
// Source: spike §6 talking-head sample + §7 differential
// NOTE: emotion_arc is all low/mid (no high intensity) → emotional_beat ABSENT
//       No scene_boundary_reason pivot across segments → the_turn ABSENT
// =====================================================

export const tutorialFlatFixture: OmniStructuralInput = {
  hook_decomposition: {
    // spike §6 verbatim for tutorial: text_overlay_score:10, weakest_modality:visual_stop_power
    visual_stop_power: 9,
    audio_hook_quality: 9,
    text_overlay_score: 10,
    first_words_speech_score: 10,
    weakest_modality: "visual_stop_power",
    visual_audio_coherence: 10,
    cognitive_load: 2,
  },
  factors: [
    {
      name: "Scroll-Stop Power",
      score: 6,
      rationale: "Static screen recording of Splice app lacks visual dynamism; low motion contrast.",
      improvement_tip: "Add a B-roll hook of a finished video before the tutorial.",
    },
    {
      name: "Completion Pull",
      score: 7,
      rationale: "Clear step-by-step structure creates task-completion motivation to watch through.",
    },
    {
      name: "Rewatch Potential",
      score: 8,
      rationale: "Tutorial content is rewatched to follow steps — high reference utility.",
    },
    {
      name: "Share Trigger",
      score: 6,
      rationale: "Niche utility content has moderate shareability within the editing community.",
    },
    {
      name: "Emotional Charge",
      score: 4,
      rationale: "Instructional tone keeps emotional engagement consistently flat throughout.",
    },
  ],
  // spike §6 verbatim: 7 segments [0–3, 3–6, 6–19, 19–26, 26–35, 35–47, 47–59]
  // NOTE: No scene_boundary_reason pivot — continuous instructional flow, no narrative turn
  segments: [
    {
      t_start: 0,
      t_end: 3,
      visual_event: "Screen recording of TikTok app, title card: 'How to edit to a beat in Splice'",
      audio_event: "Direct verbal hook: 'Here is how to edit your TikTok to a beat'",
      is_hook_zone: true,
    },
    {
      t_start: 3,
      t_end: 6,
      visual_event: "Splice app homepage, Step 1 label",
      audio_event: "Step 1 narration: grab the sound from TikTok first",
      is_hook_zone: true,
    },
    {
      t_start: 6,
      t_end: 19,
      visual_event: "Screen recording of importing video into Splice, Step 2 label",
      audio_event: "Step 2 narration: import your video, explain the workflow",
    },
    {
      t_start: 19,
      t_end: 26,
      visual_event: "Audio extraction workflow in Splice, Step 3 label",
      audio_event: "Step 3 narration: extract audio and align beats",
    },
    {
      t_start: 26,
      t_end: 35,
      visual_event: "Beat alignment timeline view in Splice, Step 4 label",
      audio_event: "Step 4 narration: how to cut clips to beat markers",
    },
    {
      t_start: 35,
      t_end: 47,
      visual_event: "Export settings screen, Step 5 label",
      audio_event: "Step 5 narration: export settings for TikTok",
    },
    {
      t_start: 47,
      t_end: 59,
      visual_event: "Completed edited video playback, outro",
      audio_event: "Closing summary and call to action",
    },
  ],
  video_signals: {
    visual_production_quality: 6,
    pacing_score: 4,
    transition_quality: 5,
  },
  // All low/mid intensity — no emotional arc peak → emotional_beat ABSENT
  emotion_arc: [
    { timestamp_ms: 0,     intensity_0_1: 0.3, label: "low" },
    { timestamp_ms: 8000,  intensity_0_1: 0.35, label: "low" },
    { timestamp_ms: 16000, intensity_0_1: 0.4, label: "low" },
    { timestamp_ms: 24000, intensity_0_1: 0.35, label: "low" },
    { timestamp_ms: 32000, intensity_0_1: 0.38, label: "low" },
    { timestamp_ms: 45000, intensity_0_1: 0.32, label: "low" },
    { timestamp_ms: 55000, intensity_0_1: 0.28, label: "low" },
  ],
  content_summary:
    "TikTok editing tutorial via Splice app: grab sound → import → extract audio → edit to beat → re-upload. Step-by-step screen recording walkthrough with verbal narration throughout all 5 steps.",
  overall_impression:
    "Clear, instructional tutorial content. Well-structured steps but lacks visual dynamism. Flat emotional tone maintained throughout — no narrative pivots or surprise elements.",
  content_type: "tutorial",
  niche_primary_slug: "education",
};
