/**
 * Phase 7 Wave 3 — Persona Prompt Builders (Plan 07-01 Task 3).
 *
 * Pure module exporting:
 * - `buildPersonaSystemPrompt(slot)` — cache-stable system prompt (D-17 + Pitfall 1).
 *   The 6-block structure (archetype, triggers, motivator, context, niche, output format)
 *   plus the per-niche instantiation lives in the SYSTEM prompt — NEVER the user message.
 * - `buildPersonaUserMessage(payload, deepseekResult, creatorContext, wave0Result, slot)` —
 *   volatile per-request user message. Loyalist-only branch surfaces creator past_wins
 *   HOSTS ONLY (PROFILE-16 + D-03 + Pitfall 3 null fallback).
 * - `PersonaResponseSchema` — Zod boundary validator (Pitfall 5 required non-empty reasoning).
 *
 * Pattern source: `wave0/prompts.ts` (Phase 3/4) — same stable-prefix + volatile-tail discipline.
 * `tryUrlHost` is imported (not redefined) per Plan 07-01 Step 1a reuse mandate.
 */
import { z } from "zod";
import type { ContentPayload, DeepSeekReasoning, Wave0Result } from "../types";
import type { CreatorContext } from "../creator";
import type { PersonaSlot } from "./persona-registry";
import { tryUrlHost } from "../wave0/prompts";

// =====================================================
// Cache-stable system prompt (D-17 + Pitfall 1).
// Same inputs → byte-identical output. NEVER interpolate Date.now() / Math.random()
// / request IDs here — that would drop DeepSeek cache hit rate.
// Per-niche instantiation lives HERE, not in the user message, so the cache prefix
// covers the full {archetype × niche × time-of-day} tuple.
// =====================================================

export function buildPersonaSystemPrompt(slot: PersonaSlot): string {
  return `You are simulating a single TikTok For You Page viewer.

## Your Behavioral Archetype

${slot.archetype_definition.trim()}

## Your Scroll-Past + Stop Triggers

You scroll past when: ${slot.scroll_past_triggers.join("; ")}.
You stop scrolling for: ${slot.stop_triggers.join("; ")}.

## Your Psychographic Motivator

You watch TikTok primarily as a ${slot.motivator}.

## Your Current Context

${slot.time_of_day_label}. ${slot.time_of_day_description}

## Niche Instantiation

You are part of the ${slot.niche_label} cluster on TikTok.

${slot.niche_instantiation.trim()}

## Your Task

You will be shown one video's summary, caption, hashtags, and context. React AS THIS PERSONA — not as a neutral observer. Respond with how YOU specifically would react to scrolling past this on your FYP.

## Output Format

Return a JSON object with this exact shape (NO markdown, NO extra text):
{ "scroll_past_second": <integer or float 0..video_duration_seconds>, "watch_through_pct": <number 0..100>, "comment_intent": <0..100>, "share_intent": <0..100>, "save_intent": <0..100>, "rewatch_intent": <0..100>, "reasoning": "<1-2 sentence reaction in your persona's voice>" }

rewatch_intent = how likely YOU are to replay or re-watch this video (loop it) rather than scroll on after it ends — 0 = never replay, 100 = would loop it repeatedly.

Stay in character. Your reasoning should feel authentic to ${slot.archetype} — not analytical.`;
}

// =====================================================
// Volatile per-request user message.
// PROFILE-16 mitigation: past_wins URLs are HOST-ONLY (Pitfall 3 null fallback below).
// =====================================================

export function buildPersonaUserMessage(
  payload: ContentPayload,
  deepseekResult: DeepSeekReasoning | null,
  creatorContext: CreatorContext,
  wave0Result: Wave0Result,
  slot: PersonaSlot,
): string {
  const sections: string[] = ["## Video to React To"];

  sections.push("Caption:");
  sections.push(payload.content_text || "(no caption)");
  sections.push("");
  sections.push(
    `Hashtags: ${
      payload.hashtags && payload.hashtags.length > 0 ? payload.hashtags.join(", ") : "(none)"
    }`,
  );

  if (payload.duration_hint !== null && payload.duration_hint !== undefined) {
    sections.push(`Duration: ${payload.duration_hint}s`);
  }

  if (wave0Result.content_type) {
    sections.push(
      `Content type: ${wave0Result.content_type.type} (confidence ${wave0Result.content_type.confidence.toFixed(2)})`,
    );
  }

  if (deepseekResult) {
    sections.push("");
    sections.push("## Video Analysis Context (from Wave 2)");
    sections.push(`- Hook effectiveness: ${deepseekResult.component_scores.hook_effectiveness}/10`);
    sections.push(`- Retention strength: ${deepseekResult.component_scores.retention_strength}/10`);
    if (deepseekResult.warnings.length > 0) {
      sections.push(`- Warnings flagged: ${deepseekResult.warnings.join("; ")}`);
    }
  }

  // PROFILE-16 + D-03 + Pitfall 3: loyalist-only branch — host-only past_wins surfacing.
  if (slot.slot_type === "loyalist") {
    if (creatorContext.past_wins && creatorContext.past_wins.length > 0) {
      const hosts = creatorContext.past_wins
        .map((w) => tryUrlHost(w.url))
        .filter(Boolean)
        .join(", ");
      if (hosts) {
        sections.push("");
        sections.push("## Creator's Past Wins (you are a long-time follower)");
        sections.push(`You have engaged before with content hosted at: ${hosts}.`);
      } else {
        // All past_wins URLs failed to parse — fall back to generic loyal framing.
        sections.push("");
        sections.push("## Creator Context");
        sections.push(`You are a loyal follower of ${slot.niche_label} creators generally.`);
      }
    } else {
      // D-03 null fallback.
      sections.push("");
      sections.push("## Creator Context");
      sections.push(`You are a loyal follower of ${slot.niche_label} creators generally.`);
    }
  }

  sections.push("");
  sections.push("React as your persona. Return ONLY the JSON object.");
  return sections.join("\n");
}

// =====================================================
// Zod schema — DeepSeek output boundary (D-19 + Pitfall 5).
// `reasoning` is required + non-empty + bounded to prevent token-budget compression.
// This validates the RAW LLM output; the orchestrator (Plan 07-02) wraps it with
// archetype / slot_type / niche / persona_id to produce a full PersonaSimulationResult.
// =====================================================

export const PersonaResponseSchema = z.object({
  scroll_past_second: z.number().min(0),
  watch_through_pct: z.number().min(0).max(100),
  comment_intent: z.number().min(0).max(100),
  share_intent: z.number().min(0).max(100),
  save_intent: z.number().min(0).max(100),
  /** Replay/loop intent (0-100) — feeds the Audience LOOP headline chip via loop_pct. */
  rewatch_intent: z.number().min(0).max(100),
  /** Pitfall 5: required non-empty + length bound. */
  reasoning: z.string().min(1).max(500),
});
export type PersonaResponse = z.infer<typeof PersonaResponseSchema>;
