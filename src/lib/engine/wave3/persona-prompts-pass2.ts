/**
 * Phase 3 Pass 2 — Persona Prompt Builders (Plan 06 Task 1).
 *
 * Pure module exporting:
 * - `STABLE_PASS2_SYSTEM_PROMPT` — byte-identical across calls (cache-key prefix preservation,
 *   D-17 + D-04). Inject demographic context + time-of-day scrolling-state as STATIC blocks.
 * - `buildPass2UserContent(slot, pass1, segments, keyframeUris, demo?)` — OpenAI content array
 *   with image_url items (non-null keyframeUris only) + text block always last.
 * - `Pass2ResponseSchema` — Zod validates D-05 output shape; attention in [0,1].
 *
 * Pattern source: `wave3/persona-prompts.ts` (STABLE_SYSTEM_PROMPT + volatile user builder + Zod).
 * Cache discipline: NEVER interpolate Date.now() / Math.random() / request IDs in STABLE_PASS2_SYSTEM_PROMPT.
 */
import { z } from "zod";
import type { PersonaSlot } from "./persona-registry";
import type { SegmentGrid, PersonaSimulationResult } from "../types";

// =====================================================
// D-04: Demographic context type
// =====================================================

/**
 * D-04 demographic + scrolling context injected into Pass 2 user content.
 * All fields optional — fall back to 'unknown' in buildPass2TextBlock.
 */
export interface DemographicContext {
  age_bucket?: "13-17" | "18-24" | "25-34" | "35-44" | "45+";
  geo?: string;
  follower_tier?: "new" | "growing" | "established" | "creator";
  time_of_day?: "morning" | "midday" | "afternoon" | "evening" | "late_night";
  scrolling_state?: "commute" | "work_break" | "leisure" | "pre_sleep";
}

// =====================================================
// STABLE system prompt (D-17 + D-04 cache discipline).
// Same inputs → byte-identical output.
// NEVER interpolate Date.now() / Math.random() / request IDs here.
// All demographic + scrolling context injected as STATIC blocks to preserve cache prefix.
// =====================================================

export const STABLE_PASS2_SYSTEM_PROMPT = `You are simulating a single TikTok viewer watching a video segment by segment.

## Your Task

You receive:
- Your persona archetype and behavioral profile
- Demographic context and scrolling state
- Pass 1 verdict (watch-through, intent signals)
- A segment grid describing the video timeline
- Keyframe images from the video (when available)

React AS THIS PERSONA to each segment in sequence. For each segment, output how your attention level changes from 0.0 (scrolling away immediately) to 1.0 (fully engaged). Predict whether you would swipe away during or before this segment.

## Attention Output Rules

- attention values MUST be in [0.0, 1.0] — no exceptions
- reason is required ONLY at inflection points: first segment, drops of 0.20 or more from prior segment, the swipe moment, and the final segment
- reason MUST be at most 200 characters
- swipe_predicted becomes true at the moment you would swipe and stays true for all subsequent segments
- swipe_predicted must be monotonically true once set (cannot go false after going true)

## Hard Constraints (D-06)

- You MUST return EXACTLY N segment_reactions matching the number of segments in the input
- t_start and t_end values MUST match the segment grid exactly
- attention MUST be a number in [0.0, 1.0] — values outside this range are invalid
- reason is optional but when present must be under 200 characters
- swipe_predicted is boolean — true once triggered, stays true for all remaining segments
- Output strict JSON only — no markdown, no code fences, no explanatory text

## Output Schema

Return a JSON object with EXACTLY this shape:

{
  "persona_id": "<string — your persona identifier>",
  "segment_reactions": [
    {
      "t_start": 0,
      "t_end": 2,
      "attention": 0.85,
      "reason": "hook landed — unusual opener",
      "swipe_predicted": false
    }
  ],
  "pass2_latency_ms": 0,
  "pass2_cost_cents": 0
}

The pass2_latency_ms and pass2_cost_cents fields should be 0 — the orchestrator fills these after parsing.`;

// =====================================================
// Volatile per-request user content builder.
// Returns OpenAI content array: image_url items (non-null URIs) + text block last.
// =====================================================

type ContentItem =
  | { type: "image_url"; image_url: { url: string } }
  | { type: "text"; text: string };

/**
 * Builds the OpenAI-compatible content array for a Pass 2 call.
 * - One image_url item per non-null entry in keyframeUris (preserving order).
 * - One text item at the end (always present).
 */
export function buildPass2UserContent(
  slot: PersonaSlot,
  pass1: PersonaSimulationResult,
  segments: SegmentGrid[],
  keyframeUris: (string | null)[],
  demo?: DemographicContext,
): ContentItem[] {
  const items: ContentItem[] = [];

  // Push image_url items for non-null keyframes (in order)
  for (const uri of keyframeUris) {
    if (uri !== null && uri !== undefined) {
      items.push({ type: "image_url", image_url: { url: uri } });
    }
  }

  // Always push the text block last
  items.push({ type: "text", text: buildPass2TextBlock(slot, pass1, segments, demo) });

  return items;
}

/**
 * Builds the text block containing persona identity, demographic context,
 * Pass 1 verdict signals, and the segment grid JSON.
 */
function buildPass2TextBlock(
  slot: PersonaSlot,
  pass1: PersonaSimulationResult,
  segments: SegmentGrid[],
  demo?: DemographicContext,
): string {
  const lines: string[] = [];

  // Persona identity
  lines.push(`## Your Persona`);
  lines.push(`Archetype: ${slot.archetype}`);
  lines.push(`Slot type: ${slot.slot_type}`);
  lines.push(`Persona ID: ${slot.persona_id}`);
  lines.push("");

  // D-04: Demographic + scrolling context
  const ageBucket = demo?.age_bucket ?? "unknown";
  const geo = demo?.geo ?? "unknown";
  const followerTier = demo?.follower_tier ?? "unknown";
  const timeOfDay = demo?.time_of_day ?? "unknown";
  const scrollingState = demo?.scrolling_state ?? "unknown";

  lines.push(`## Demographic Context`);
  lines.push(
    `Age bucket: ${ageBucket} | Geo: ${geo} | Follower tier: ${followerTier} | Time of day: ${timeOfDay} | Scrolling state: ${scrollingState}`,
  );
  lines.push("");

  // Pass 1 verdict signals
  const watchThrough =
    "watch_through_pct" in pass1 && pass1.watch_through_pct !== undefined
      ? pass1.watch_through_pct
      : "n/a";
  const shareIntent =
    "share_intent" in pass1 && pass1.share_intent !== undefined ? pass1.share_intent : "n/a";
  const saveIntent =
    "save_intent" in pass1 && pass1.save_intent !== undefined ? pass1.save_intent : "n/a";
  const commentIntent =
    "comment_intent" in pass1 && pass1.comment_intent !== undefined
      ? pass1.comment_intent
      : "n/a";

  lines.push(`## Pass 1 Verdict`);
  lines.push(
    `Watch-through: ${watchThrough} | Share intent: ${shareIntent} | Save intent: ${saveIntent} | Comment intent: ${commentIntent}`,
  );
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

  lines.push(
    `Return a JSON object with EXACTLY ${segments.length} segment_reactions. React as your persona.`,
  );

  return lines.join("\n");
}

// =====================================================
// Zod response schema — D-05 output boundary.
// attention in [0,1] per T-03-06-01 mitigation.
// =====================================================

export const Pass2ResponseSchema = z.object({
  persona_id: z.string(),
  segment_reactions: z.array(
    z.object({
      t_start: z.number().min(0),
      t_end: z.number().min(0),
      attention: z.number().min(0).max(1),
      reason: z.string().max(200).optional(), // WR-04: align with system prompt constraint (200 chars)
      swipe_predicted: z.boolean(),
    }),
  ),
  pass2_latency_ms: z.number(),
  pass2_cost_cents: z.number(),
});

export type Pass2Response = z.infer<typeof Pass2ResponseSchema>;
