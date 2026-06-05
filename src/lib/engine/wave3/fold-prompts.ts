/**
 * Phase 4 Audience-Sim Fold — Prompt Builders (Plan 04-02 Task 1).
 *
 * Pure module exporting:
 * - `STABLE_FOLD_SYSTEM_PROMPT` — byte-identical across every video (cache prefix, D-17 + D-03).
 *   Contains ALL 10 ARCHETYPE_DEFINITIONS verbatim + the Critical Divergence Requirement (D-06).
 *   Never interpolates Date.now() / Math.random() / request IDs.
 * - `buildFoldUserContent(slots, segments, keyframeUris, verbatim, emotionArc)` — OpenAI content
 *   array with image_url items FIRST + text block LAST (mirrors buildPass2UserContent ordering).
 * - `FoldResponseSchema` — Zod validates the 20→1 fold output at the model boundary:
 *   exactly 10 archetypes (.length(10), D-01), attention clamped [0,1]. Per-segment
 *   `reason` was dropped 2026-06-05 (dead weight) — any stray reason is Zod-stripped.
 *
 * This fold emits BOTH Pass-1 behavioral intents AND Pass-2 segment_reactions in ONE call (R7).
 * The adapters that split these into engine-compatible shapes live in Plan 03 (fold.ts exports).
 *
 * Pattern source: `wave3/persona-prompts-pass2.ts` (STABLE_PASS2_SYSTEM_PROMPT pattern, exact).
 */

import { z } from "zod";
import { ARCHETYPE_DEFINITIONS } from "./persona-registry";
import type { PersonaSlot } from "./persona-registry";
import type { SegmentGrid, EmotionArcPoint } from "../types";

// =====================================================
// STABLE system prompt (D-17 + D-03 cache discipline).
// Same inputs → byte-identical output.
// NEVER interpolate Date.now() / Math.random() / request IDs here.
// The 10 ARCHETYPE_DEFINITIONS block is the cache prefix — byte-identical across every video.
// All volatile data (verbatim, segments, keyframes, emotion arc) goes in the USER message.
// =====================================================

export const STABLE_FOLD_SYSTEM_PROMPT = `You are simulating TEN TikTok viewer archetypes watching a video.

Your task: for each of the 10 archetypes defined below, produce BOTH:
1. Pass-1 behavioral intents (watch_through_pct, share_intent, comment_intent, save_intent, rewatch_intent, scroll_past_second)
2. Pass-2 segment reactions (attention timeline with per-segment attention [0,1], swipe_predicted)

## Archetype Definitions (feed ALL 10 — these MUST produce divergent curves)

### high_engager
${ARCHETYPE_DEFINITIONS.high_engager}

### saver
${ARCHETYPE_DEFINITIONS.saver}

### lurker
${ARCHETYPE_DEFINITIONS.lurker}

### sharer
${ARCHETYPE_DEFINITIONS.sharer}

### tough_crowd
${ARCHETYPE_DEFINITIONS.tough_crowd}

### purposeful_viewer
${ARCHETYPE_DEFINITIONS.purposeful_viewer}

### niche_deep_buyer
${ARCHETYPE_DEFINITIONS.niche_deep_buyer}

### niche_deep_scout
${ARCHETYPE_DEFINITIONS.niche_deep_scout}

### loyalist
${ARCHETYPE_DEFINITIONS.loyalist}

### cross_niche_curiosity
${ARCHETYPE_DEFINITIONS.cross_niche_curiosity}

## Critical Divergence Requirement (D-06)

These 10 archetypes have FUNDAMENTALLY different tolerances. Near-identical attention curves across archetypes is a FAILURE.

Require relative drop-point ordering grounded in the definitions above:
- tough_crowd MUST drop earliest (swipes away first, unless the hook is exceptional)
- loyalist stays latest (gives the creator benefit of the doubt, watches longer)
- All other archetypes fall between these extremes according to their definitions

Do NOT homogenize curves. Each archetype MUST behave distinctly per its profile.

## Output Schema

Return a JSON object with EXACTLY this shape:

{
  "personas": [
    {
      "archetype": "<one of the 10 archetype names above>",
      "persona_id": "<archetype>_01",
      "watch_through_pct": 0-100,
      "share_intent": 0-100,
      "comment_intent": 0-100,
      "save_intent": 0-100,
      "rewatch_intent": 0-100,
      "scroll_past_second": <seconds into video when this archetype scrolls away, 0 if watches fully>,
      "segment_reactions": [
        {
          "t_start": <segment start seconds>,
          "t_end": <segment end seconds>,
          "attention": <0.0-1.0>,
          "swipe_predicted": <boolean — true at swipe moment, stays true for all subsequent segments>
        }
      ]
    },
    ... exactly 10 entries, one per archetype ...
  ]
}

Rules:
- attention MUST be in [0.0, 1.0] — no exceptions
- swipe_predicted becomes true at the scroll-away moment and stays true for all subsequent segments
- Return EXACTLY 10 persona entries — one per archetype
- Return EXACTLY N segment_reactions per persona matching the input segment grid
- Output strict JSON only — no markdown, no code fences, no explanatory text`;

// =====================================================
// Volatile per-request user content builder.
// Returns OpenAI content array: image_url items (non-null URIs) FIRST + text block LAST.
// =====================================================

type ContentItem =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };

/**
 * Builds the OpenAI-compatible content array for the fold call.
 * - One image_url item per non-null entry in keyframeUris (in order).
 * - One text item at the end (always present).
 * Mirrors buildPass2UserContent ordering (image_url first, text last).
 */
export function buildFoldUserContent(
  slots: PersonaSlot[],
  segments: SegmentGrid[],
  keyframeUris: (string | null)[],
  verbatim: string,
  emotionArc: EmotionArcPoint[],
): ContentItem[] {
  const items: ContentItem[] = [];

  // Push image_url items for non-null keyframes (in order) — FIRST
  for (const uri of keyframeUris) {
    if (uri !== null && uri !== undefined) {
      items.push({ type: "image_url", image_url: { url: uri } });
    }
  }

  // Always push the text block LAST
  items.push({
    type: "text",
    text: buildFoldTextBlock(slots, segments, verbatim, emotionArc),
  });

  return items;
}

/**
 * Builds the text block containing:
 * - Verbatim transcript/hook content
 * - Segment grid JSON (the video timeline)
 * - Emotion arc data
 * - Per-slot archetype + niche context (the 10 persona assignments)
 * All volatile data lives here — NOT in the system prompt.
 */
function buildFoldTextBlock(
  slots: PersonaSlot[],
  segments: SegmentGrid[],
  verbatim: string,
  emotionArc: EmotionArcPoint[],
): string {
  const lines: string[] = [];

  // Verbatim transcript content
  lines.push(`## Verbatim Content`);
  lines.push(verbatim || "(no transcript available)");
  lines.push("");

  // Segment grid JSON
  lines.push(`## Segment Grid`);
  const segmentData = segments.map((s) => ({
    idx: s.idx,
    t_start: s.t_start,
    t_end: s.t_end,
    visual_event: s.visual_event,
    audio_event: s.audio_event,
    is_hook_zone: s.is_hook_zone,
  }));
  lines.push(JSON.stringify(segmentData));
  lines.push("");

  // Emotion arc
  lines.push(`## Emotion Arc`);
  lines.push(JSON.stringify(emotionArc));
  lines.push("");

  // Persona slot assignments (niche context per archetype)
  lines.push(`## Persona Slot Assignments (niche context)`);
  for (const slot of slots) {
    lines.push(
      `- ${slot.archetype} | slot_type: ${slot.slot_type} | persona_id: ${slot.persona_id} | niche: ${slot.niche ?? "general"}`,
    );
  }
  lines.push("");

  lines.push(
    `Return a JSON object with EXACTLY 10 personas and EXACTLY ${segments.length} segment_reactions per persona.`,
  );

  return lines.join("\n");
}

// =====================================================
// Zod response schema — model boundary validation.
// attention clamped [0,1] — T-04-01 mitigation.
// exactly 10 archetypes — D-01.
// NOTE: per-segment `reason` REMOVED (2026-06-05) — it was packed at
// weighted-aggregator.ts then hardcoded `{}` at the serving boundary and rendered
// nowhere. Dropping it removes the dominant variable-length output (the 25↔62s fold
// jitter) at zero user-visible cost. Any `reason` the model still emits is stripped
// by Zod (.object default strip). See quick/20260605-engine-latency-quality-spine-ab.
// =====================================================

/**
 * Per-archetype entry in the fold response.
 * Carries BOTH Pass-1 behavioral intents AND Pass-2 segment_reactions.
 * This dual payload is the core of the 20→1 fold (R7).
 */
const FoldArchetypeSchema = z.object({
  archetype: z.string(),                         // accept any string — the test fixture uses its own set
  persona_id: z.string(),
  // Pass-1 behavioral intents (source for behavioral_score, 40% of the blend)
  watch_through_pct: z.number().min(0).max(100),
  share_intent: z.number().min(0).max(100),
  comment_intent: z.number().min(0).max(100),
  save_intent: z.number().min(0).max(100),
  rewatch_intent: z.number().min(0).max(100),
  scroll_past_second: z.number().min(0),
  // Pass-2 segment reactions (source for heatmap)
  segment_reactions: z.array(
    z.object({
      t_start: z.number().min(0),
      t_end: z.number().min(0),
      attention: z.number().min(0).max(1),       // clamped [0,1] — T-04-01
      swipe_predicted: z.boolean(),
    }),
  ),
});

export const FoldResponseSchema = z.object({
  personas: z.array(FoldArchetypeSchema).length(10), // exactly 10 — D-01
});

export type FoldResponse = z.infer<typeof FoldResponseSchema>;
