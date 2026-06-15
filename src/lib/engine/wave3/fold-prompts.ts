/**
 * Phase 4 Audience-Sim Fold — Prompt Builders (Plan 04-02 Task 1).
 *
 * Pure module exporting:
 * - `STABLE_FOLD_SYSTEM_PROMPT` — byte-identical across every video (cache prefix, D-17 + D-03).
 *   Contains ALL 10 ARCHETYPE_DEFINITIONS verbatim + the Critical Divergence Requirement (D-06).
 *   Never interpolates Date.now() / Math.random() / request IDs.
 * - `buildFoldUserContent(slots, segments, verbatim, emotionArc)` — OpenAI content array with a
 *   single text block. Fold reasons over Omni's TEXT (verbatim + segments + emotion arc); it does
 *   NOT consume video frames (the keyframe-read path was dead — filmstrip lands async, after fold).
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
// All volatile data (verbatim, segments, emotion arc) goes in the USER message.
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

Return ONLY a JSON object matching this EXACT shape and types. This is a worked example for a
2-segment video — copy the TYPES exactly (numbers are bare numbers, never strings, never null):

{
  "personas": [
    {
      "archetype": "tough_crowd",
      "persona_id": "tough_crowd_01",
      "watch_through_pct": 30,
      "share_intent": 5,
      "comment_intent": 8,
      "save_intent": 0,
      "rewatch_intent": 0,
      "scroll_past_second": 2.5,
      "segment_reactions": [
        { "attention": 0.75, "swipe_predicted": false },
        { "attention": 0.15, "swipe_predicted": true }
      ]
    },
    {
      "archetype": "loyalist",
      "persona_id": "loyalist_01",
      "watch_through_pct": 95,
      "share_intent": 40,
      "comment_intent": 35,
      "save_intent": 20,
      "rewatch_intent": 30,
      "scroll_past_second": 0,
      "segment_reactions": [
        { "attention": 0.9, "swipe_predicted": false },
        { "attention": 0.95, "swipe_predicted": false }
      ]
    }
    // ... exactly 10 entries total, one per archetype above ...
  ]
}

TYPE RULES (STRICT — a wrong type breaks parsing and discards the whole result):
- EVERY numeric field is a bare JSON number. NEVER a string ("30"), NEVER null. If a value is
  genuinely none, use 0 — do not write null and do not write units like "2s".
- watch_through_pct, share_intent, comment_intent, save_intent, rewatch_intent: number 0-100
- scroll_past_second: number >= 0 (0 means the archetype watches fully, never scrolls away)
- attention: number between 0.0 and 1.0 — no exceptions
- swipe_predicted: boolean true/false (not "true"); becomes true at the scroll-away moment and
  stays true for all subsequent segments
- EXACTLY 10 persona entries — one per archetype listed above
- EXACTLY N segment_reactions per persona, ONE PER INPUT SEGMENT, IN THE SAME ORDER as the
  segment grid (index i = segment i). Do NOT include timestamps — timing comes from the input grid.
- Output strict JSON only — no markdown, no code fences, no explanatory text`;

// =====================================================
// Volatile per-request user content builder.
// Returns OpenAI content array: an optional video item + one text block. The fold now
// runs on a sense-complete omni model (qwen3.5-omni-plus) and WATCHES the video directly
// (video+audio) — the text block (verbatim + segments + emotion arc) is the shared
// skeleton from the read that keeps the fold's curves aligned to the canonical timeline.
// =====================================================

type ContentItem =
  | { type: "text"; text: string }
  | { type: "video_url"; video_url: { url: string } };

/**
 * Builds the OpenAI-compatible content array for the fold call. When `videoUrl` is
 * present, the video is prepended so the omni model sees+hears the actual timeline;
 * the text block always carries the shared skeleton (verbatim + segment grid + emotion
 * arc) so the model's per-segment reactions align to the read's canonical segments.
 * `videoUrl` is null in text/tiktok_url mode (no upload) — then the fold is text-only.
 */
export function buildFoldUserContent(
  slots: PersonaSlot[],
  segments: SegmentGrid[],
  verbatim: string,
  emotionArc: EmotionArcPoint[],
  videoUrl?: string | null,
): ContentItem[] {
  const textItem: ContentItem = {
    type: "text",
    text: buildFoldTextBlock(slots, segments, verbatim, emotionArc),
  };
  return videoUrl
    ? [{ type: "video_url", video_url: { url: videoUrl } }, textItem]
    : [textItem];
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
  // Pass-2 segment reactions (source for heatmap). One per input segment, IN GRID
  // ORDER — t_start/t_end are NOT requested (they'd just echo the input grid 10×);
  // the adapter re-attaches timing from segments[i] by index. (2026-06-05 trim.)
  segment_reactions: z.array(
    z.object({
      attention: z.number().min(0).max(1),       // clamped [0,1] — T-04-01
      swipe_predicted: z.boolean(),
    }),
  ),
});

export const FoldResponseSchema = z.object({
  personas: z.array(FoldArchetypeSchema).length(10), // exactly 10 — D-01
});

export type FoldResponse = z.infer<typeof FoldResponseSchema>;

// =====================================================
// Coercion layer — salvage small-model (omni-flash) TYPE sloppiness before Zod.
// Flash fails the fold not on the simulation TASK but on FORMAT: it emits a string/null
// where a number is required (scroll_past_second), or returns a bare top-level array
// instead of {personas:[...]}. `response_format: json_object` does NOT constrain types,
// and `json_schema` strict is NOT honored by DashScope on omni-flash (returns an array).
// This coerces types/shape WITHOUT fabricating signal: missing numbers default low,
// out-of-range values clamp, missing reactions → [] (drops that persona's diversity, never
// inflates it). Zod still enforces the hard contract (exactly 10 personas) afterward.
// Verified: omni-flash + coercion held avgRange 0.48 @ 10s where raw flash hard-failed.
// (.planning/quick/20260614-engine-pipeline-audit/)
// =====================================================
function coerceNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}
const clampRange = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Coerce a raw parsed fold response into FoldResponseSchema-compatible shape (types only). */
export function coerceFoldResponse(raw: unknown): unknown {
  // Flash sometimes returns a bare array of personas instead of {personas:[...]}.
  const obj = Array.isArray(raw) ? { personas: raw } : (raw as { personas?: unknown });
  const personas = Array.isArray(obj?.personas) ? obj.personas : [];
  return {
    personas: personas.map((p) => {
      const pp = (p ?? {}) as Record<string, unknown>;
      const reactions = Array.isArray(pp.segment_reactions) ? pp.segment_reactions : [];
      return {
        archetype: String(pp.archetype ?? ""),
        persona_id: String(pp.persona_id ?? ""),
        watch_through_pct: clampRange(coerceNumber(pp.watch_through_pct), 0, 100),
        share_intent: clampRange(coerceNumber(pp.share_intent), 0, 100),
        comment_intent: clampRange(coerceNumber(pp.comment_intent), 0, 100),
        save_intent: clampRange(coerceNumber(pp.save_intent), 0, 100),
        rewatch_intent: clampRange(coerceNumber(pp.rewatch_intent), 0, 100),
        scroll_past_second: Math.max(0, coerceNumber(pp.scroll_past_second)),
        segment_reactions: reactions.map((r) => {
          const rr = (r ?? {}) as Record<string, unknown>;
          return {
            attention: clampRange(coerceNumber(rr.attention), 0, 1),
            swipe_predicted: rr.swipe_predicted === true || rr.swipe_predicted === "true",
          };
        }),
      };
    }),
  };
}
