/**
 * Phase 03 Plan 01 — Decode Engine Prompts.
 *
 * Mirrors src/lib/engine/stage11-counterfactuals-prompts.ts structure.
 *
 * Exports:
 *   - DECODE_SYSTEM_PROMPT — cache-stable constant (never interpolate dynamic content here)
 *   - buildDecodeContext(omni) — user message builder (MUST omit improvement_tip — D-06)
 *   - DecodeResultZodSchema — re-exported from decode-types.ts
 *
 * Invariants enforced in prompt:
 *   D-06: 4 beats in fixed order, declarative third-person, no advice verbs
 *   D-07: third-person about source video ("the hook", "this structure"), NEVER "you"
 *   D-02: absent beats carry an honest body line, never fabricated content
 *   D-04: luck array MUST contain >= 1 entry
 *   SC#4: improvement_tip is OMITTED from context (advice-voiced)
 */

import type { OmniStructuralInput } from "./decode-types";

export { DecodeResultZodSchema } from "./decode-types";

// =====================================================
// Cache-stable system prompt (byte-stable — never interpolate here).
// =====================================================

export const DECODE_SYSTEM_PROMPT = `You are a structural decoder for short-form video. Your job is to analyze WHY a video worked — its structural mechanics, not what the creator should fix.

## Voice Contract (STRICT)

- Write in DECLARATIVE THIRD-PERSON about the source video: "the hook", "this structure", "the creator", "the video". NEVER use second-person "you" or "your".
- ANALYSIS ONLY. Forbidden advice verbs: fix, improve, should, try, consider, add, remove, change. These are analysis notes, not coaching notes.
- Each beat body must be 1-2 honest declarative sentences explaining WHY the structural element worked, was weak, or was absent.

## Beat Requirements (MANDATORY)

Return EXACTLY 4 beats in this FIXED order:
1. hook_pattern — the opening mechanism (visual/audio/text hook strategy)
2. structure_pacing — the temporal rhythm and segment architecture
3. the_turn — the narrative pivot or scene-boundary inflection point
4. emotional_beat — the affective trajectory and peak moment

For each beat:
- "present": analyze the structural mechanism concretely — what it was and why it produced engagement
- "weak": identify the partial element and what made it incomplete
- "absent": NAME THE ABSENCE HONESTLY with a specific observation. Example: "No distinct turn — this content rides one continuous instructional flow without a narrative pivot." NEVER fabricate a turn that isn't there. NEVER write a body that implies presence when verdict is absent.

## Repeatable Lane

List the structural moves this creator can reproduce: opening strategies, timing patterns, segment architecture, platform-specific mechanics. Only list moves that actually appeared in this video.

## Luck Lane (MANDATORY — NON-EMPTY)

Every viral video has at least one unrepeatable factor — identify it. Do NOT collapse everything into repeatable.

The luck array MUST contain at least 1 entry from this FIXED taxonomy (use exactly these strings):
- "timing_trend_moment" — the video caught a trend at peak velocity
- "existing_audience_reach" — creator's existing audience provided initial distribution momentum
- "algorithmic_outlier" — algorithm distribution spike, not predictable from content alone
- "topic_zeitgeist" — the topic matched a cultural moment independent of creator's timing decision

If none clearly apply, identify the closest fit and explain in the note. DO NOT return an empty luck array.

## JSON Output Schema

Return a JSON object with exactly these fields:

{
  "beats": [
    { "id": "hook_pattern", "body": "...", "verdict": "present|weak|absent" },
    { "id": "structure_pacing", "body": "...", "verdict": "present|weak|absent" },
    { "id": "the_turn", "body": "...", "verdict": "present|weak|absent" },
    { "id": "emotional_beat", "body": "...", "verdict": "present|weak|absent" }
  ],
  "repeatable": ["...", "..."],
  "luck": [
    { "category": "timing_trend_moment|existing_audience_reach|algorithmic_outlier|topic_zeitgeist", "note": "..." }
  ]
}

Return ONLY raw JSON. No markdown fences, no explanation.`;

// =====================================================
// User message builder — serializes Omni fields for the decode call
// CRITICAL: MUST omit factors[].improvement_tip (advice-voiced, violates D-06)
// =====================================================

/**
 * Build the decode context user message from Omni structural output.
 *
 * Serializes: hook_decomposition, factors (name+score+rationale ONLY — NO improvement_tip),
 * segments (compact), video_signals, emotion_arc, content_summary, overall_impression,
 * content_type, niche.
 *
 * D-06 compliance: improvement_tip is never included.
 */
export function buildDecodeContext(omni: OmniStructuralInput): string {
  // Hook decomposition
  const hookLines = [
    `  visual_stop_power: ${omni.hook_decomposition.visual_stop_power}`,
    `  audio_hook_quality: ${omni.hook_decomposition.audio_hook_quality}`,
    `  text_overlay_score: ${omni.hook_decomposition.text_overlay_score}`,
    `  first_words_speech_score: ${omni.hook_decomposition.first_words_speech_score}`,
    `  weakest_modality: ${omni.hook_decomposition.weakest_modality}`,
    `  visual_audio_coherence: ${omni.hook_decomposition.visual_audio_coherence}`,
    `  cognitive_load: ${omni.hook_decomposition.cognitive_load}`,
  ].join("\n");

  // Factors — MUST omit improvement_tip (D-06)
  // improvement_tip is advice-voiced and would contaminate the honest-voice analysis contract
  const factorsText = omni.factors
    .map((f) => `  - ${f.name}: ${f.score}/10 — ${f.rationale}`)
    .join("\n");

  // Segments (compact: t_start/t_end/visual_event/audio_event/scene_boundary_reason/is_hook_zone)
  const segmentsText = omni.segments && omni.segments.length > 0
    ? omni.segments
        .map((s) => {
          const parts = [
            `    [${s.t_start.toFixed(1)}–${s.t_end.toFixed(1)}s]`,
            `visual: ${s.visual_event}`,
            `audio: ${s.audio_event}`,
          ];
          if (s.scene_boundary_reason) {
            parts.push(`pivot: ${s.scene_boundary_reason}`);
          }
          if (s.is_hook_zone) {
            parts.push("hook_zone: true");
          }
          return parts.join(" | ");
        })
        .join("\n")
    : "  (none)";

  // Video signals
  const signalsText = [
    `  visual_production_quality: ${omni.video_signals.visual_production_quality}`,
    `  pacing_score: ${omni.video_signals.pacing_score}`,
    `  transition_quality: ${omni.video_signals.transition_quality}`,
  ].join("\n");

  // Emotion arc
  const emotionText = omni.emotion_arc && omni.emotion_arc.length > 0
    ? omni.emotion_arc
        .map((p) => `  t=${p.timestamp_ms}ms intensity=${p.intensity_0_1.toFixed(2)}${p.label ? ` (${p.label})` : ""}`)
        .join("\n")
    : "  (none)";

  return `## Content Type: ${omni.content_type}
## Niche: ${omni.niche_primary_slug}

## Hook Decomposition
${hookLines}

## Engagement Factors (rationale only — no tips)
${factorsText}

## Segments
${segmentsText}

## Video Signals
${signalsText}

## Emotion Arc
${emotionText}

## Content Summary
${omni.content_summary}

## Overall Impression
${omni.overall_impression}

Decode the structural mechanics of this video. Return ONLY raw JSON matching the schema above.`;
}
