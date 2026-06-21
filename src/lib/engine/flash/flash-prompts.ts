/**
 * SIM-1 Flash — System prompt + user content builder (Plan 01-03 Task 2).
 *
 * Exports:
 * - `STABLE_FLASH_SYSTEM_PROMPT` — byte-stable cache prefix (D-03/D-17).
 *   Contains ALL 10 ARCHETYPE_DEFINITIONS verbatim + the output schema.
 *   TEXT input only — no video, no segments.
 *   NEVER interpolates Date.now() / Math.random() / request IDs.
 * - `buildNicheAwareSystemPrompt(panel)` — niche-instantiated system prompt (D-05, Plan 03-01).
 *   When panel.niche is non-null, folds selectPersonaSlots output into ONE system prompt's
 *   archetype block. Duplicate-archetype slots encode the FYP/tough_crowd weighting by
 *   repetition (~30% weighting for free, per D-05). Returns STABLE_FLASH_SYSTEM_PROMPT when
 *   panel.niche is null (back-compat fallback). Byte-stable per {niche × contentType} tuple.
 * - `buildFlashUserContent(text, framing)` — assembles the volatile user message.
 *   `framing: "hook" | "idea" | "chat"` swaps ONLY the persona QUESTION + band VERBIAGE (D-04).
 *   Persona data comes from persona-registry.ts (D-05 — data-driven, NOT hardcoded).
 *
 * Forked from wave3/fold-prompts.ts — TEXT input, no video, no segments.
 * Isolation: imports ONLY from wave3/persona-registry.ts. No fold/pipeline/aggregator/version.
 */

import {
  ARCHETYPE_DEFINITIONS,
  ARCHETYPE_TRIGGERS,
  ARCHETYPES,
  selectPersonaSlots,
} from "../wave3/persona-registry";
import type { Archetype, PersonaSlot } from "../wave3/persona-registry";
import type { ContentTypeSlug } from "../types";

// ─── Framing types (D-04) ──────────────────────────────────────────────────────
// "hook"  → "scrolling feed, first 2s, do you stop or scroll past?"
// "idea"  → "in your niche, would this content idea make you stop or scroll?"
// "chat"  → "in a conversation context, does this make you engage or disengage?"
// One engine path — framing swaps only the question + band verbiage (D-04).

export type FlashFraming = "hook" | "idea" | "chat";

// ─── Per-framing question text ─────────────────────────────────────────────────

const FRAMING_QUESTION: Record<FlashFraming, string> = {
  hook:
    "You are scrolling your TikTok FYP. You see this content in the first 2 seconds. " +
    "Do you STOP and watch, or SCROLL past? Your verdict: stop or scroll.",
  idea:
    "A creator in your niche turned this idea into a video and it just landed on your FYP. " +
    "Judge the idea's real pull AS THE FINISHED VIDEO it describes — not the wording of the pitch. " +
    "Would the video this concept describes make you stop and watch (stop), or scroll past (scroll)? " +
    "Your verdict: stop or scroll.",
  chat:
    "This content is presented in a conversational context. " +
    "Does this make you engage and want more (stop), or disengage and move on (scroll)? " +
    "Your verdict: stop or scroll.",
};

// ─── Per-framing band verbiage ─────────────────────────────────────────────────

const FRAMING_BAND_VERBIAGE: Record<FlashFraming, string> = {
  hook:
    "The band reflects RELATIVE hook pull — how many of the 10 archetypes would stop in the first 2 seconds. " +
    "Strong = high stop rate, Mixed = moderate, Weak = most scroll past.",
  idea:
    "The band reflects RELATIVE idea viability — how many of the 10 archetypes find this idea worth pursuing. " +
    "Strong = compelling idea across the audience, Mixed = niche appeal, Weak = low resonance.",
  chat:
    "The band reflects RELATIVE conversational pull — how many of the 10 archetypes would engage with this. " +
    "Strong = high engagement pull, Mixed = moderate interest, Weak = low engagement signal.",
};

// ─── STABLE system prompt (D-17 cache discipline) ────────────────────────────
// Byte-stable across every TEXT request — never interpolates volatile data.
// All 10 ARCHETYPE_DEFINITIONS verbatim (the byte-stable cache prefix).
// All volatile data (content text, framing question) goes in the USER message.
//
// Forked from STABLE_FOLD_SYSTEM_PROMPT — TEXT input, no video, no segments.
// No `scroll_past_second`, `watch_through_pct`, `segment_reactions` — those are video fields.

function buildSystemPrompt(): string {
  const archetypeBlock = ARCHETYPES.map((a: Archetype) => {
    const def = ARCHETYPE_DEFINITIONS[a];
    const triggers = ARCHETYPE_TRIGGERS[a];
    return `### ${a}\n${def}\n\nScrolls past when: ${triggers.scroll_past.join(", ")}.\nStops for: ${triggers.stop.join(", ")}.`;
  }).join("\n\n");

  return `You are simulating TEN TikTok viewer archetypes reacting to TEXT content.

Your task: for each of the 10 archetypes defined below, produce:
- A verdict: "stop" (would stop and engage) or "scroll" (would scroll past)
- A one-line first-person voice quote (max 160 characters) capturing WHY — the audience texture the creator needs to hear

## Archetype Definitions (feed ALL 10 — verdicts MUST diverge based on their profiles)

${archetypeBlock}

## Critical Divergence Requirement

These 10 archetypes have FUNDAMENTALLY different tolerances. Near-identical verdicts across all archetypes is a FAILURE — tough_crowd is the hardest to stop; loyalist is the easiest.

## Output Schema

Return ONLY a JSON object matching this EXACT shape:

{
  "personas": [
    {
      "archetype": "tough_crowd",
      "verdict": "scroll",
      "quote": "The hook was weak, I'm not stopping for this."
    },
    {
      "archetype": "loyalist",
      "verdict": "stop",
      "quote": "I'd watch anything from this creator."
    }
    // ... exactly 10 entries total, one per archetype above, IN THE SAME ORDER ...
  ]
}

TYPE RULES (STRICT):
- "verdict" MUST be exactly "stop" or "scroll" — no other values, no null, no mixed case
- "quote" MUST be a non-empty string, max 160 characters, first-person voice
- "archetype" MUST match the archetype slug exactly
- EXACTLY 10 persona entries — one per archetype listed above
- Output strict JSON only — no markdown, no code fences, no explanatory text`;
}

// Build once at module load — byte-stable across every call (D-17 cache prefix).
export const STABLE_FLASH_SYSTEM_PROMPT: string = buildSystemPrompt();

// ─── Niche panel type (D-05, Plan 03-01) ─────────────────────────────────────

export interface NichePanel {
  niche: string | null;
  contentType: ContentTypeSlug | null;
}

// ─── Niche-aware system prompt builder (D-05, Plan 03-01) ────────────────────
// Folds selectPersonaSlots output into ONE Flash system prompt's archetype block.
// Same prompt skeleton (task framing, Output Schema, TYPE RULES, Critical Divergence Requirement)
// — only the archetype-definition block differs: niche-instantiated persona text + triggers.
//
// Per D-05 and RESEARCH §"two persona engines": ONE multi-persona call, NOT N calls.
// Repetition of duplicate-archetype slots (FYP rotation + loyalist etc.) ENCODES the
// ~30% FYP/tough_crowd weighting by frequency, exactly mirroring how the video path does it.
//
// Byte-stability guarantee: selectPersonaSlots is deterministic for identical {niche × contentType}
// inputs (no Math.random / Date.now / per-call salting). Same panel → same prompt string.
// Different niches → different prompts (per-niche cache prefix, stable per creator session).
//
// NEVER interpolate per-request data (ask text, framing question) into the system prompt.
// Volatile data lives in the user message via buildFlashUserContent (cache discipline D-17).

/**
 * Build a niche-instantiated Flash system prompt (D-05).
 *
 * @param panel           { niche: string | null, contentType: ContentTypeSlug | null }
 *   - niche: null → returns STABLE_FLASH_SYSTEM_PROMPT (generic back-compat, same as no panel)
 *   - niche: <slug> → archetype block built from selectPersonaSlots(contentType, niche);
 *     each slot contributes its niche_instantiation + scroll_past_triggers + stop_triggers.
 *     Duplicate-archetype slots (the allocation weighting) appear as repeated entries.
 * @param audienceRepaint Optional per-audience archetype description overrides (07-04 / AUD-04).
 *   - When undefined (default) → BYTE-IDENTICAL to the pre-P7 output (regression-critical no-op).
 *   - When provided → substitutes the stored per-audience description for each slot's
 *     niche_instantiation, keeping the skeleton (task framing, Output Schema, TYPE RULES) stable.
 *
 * PITFALL 2 (07-RESEARCH): the repaint must be the STORED, deterministic text from the
 * audience row — never generated per-request. Same audience → same prompt string (D-17 cache).
 *
 * MUTATION GUARD: ARCHETYPE_DEFINITIONS is never mutated by this function.
 * The repaint substitutes only the description fragment in the built string, not the source data.
 */
export function buildNicheAwareSystemPrompt(
  panel: NichePanel,
  audienceRepaint?: Record<string, string>,
): string {
  if (panel.niche === null) {
    return STABLE_FLASH_SYSTEM_PROMPT;
  }

  const slots: PersonaSlot[] = selectPersonaSlots(panel.contentType, panel.niche);

  // Build the archetype block from niche-instantiated slots.
  // Each slot: ### {archetype} + description text + scroll_past_triggers + stop_triggers.
  // Duplicate-archetype slots appear as separate entries — repetition encodes the weighting.
  //
  // Audience repaint: when audienceRepaint is provided, substitute the per-audience description
  // for the slot's niche_instantiation — skeleton (triggers, schema, rules) stays byte-stable.
  // When undefined → unchanged path, byte-identical to pre-P7 output.
  const archetypeBlock = slots
    .map((s) => {
      // Repaint: use stored audience description if available, else fall back to niche_instantiation.
      // audienceRepaint[s.archetype] is the deterministic stored text (never per-request LLM output).
      const descriptionText =
        audienceRepaint && audienceRepaint[s.archetype] != null
          ? audienceRepaint[s.archetype]
          : s.niche_instantiation;
      return (
        `### ${s.archetype}\n${descriptionText}\n\n` +
        `Scrolls past when: ${s.scroll_past_triggers.join(", ")}.\n` +
        `Stops for: ${s.stop_triggers.join(", ")}.`
      );
    })
    .join("\n\n");

  return `You are simulating TEN TikTok viewer archetypes reacting to TEXT content.

Your task: for each of the 10 archetypes defined below, produce:
- A verdict: "stop" (would stop and engage) or "scroll" (would scroll past)
- A one-line first-person voice quote (max 160 characters) capturing WHY — the audience texture the creator needs to hear

## Archetype Definitions (feed ALL 10 — verdicts MUST diverge based on their profiles)

${archetypeBlock}

## Critical Divergence Requirement

These 10 archetypes have FUNDAMENTALLY different tolerances. Near-identical verdicts across all archetypes is a FAILURE — tough_crowd is the hardest to stop; loyalist is the easiest.

## Output Schema

Return ONLY a JSON object matching this EXACT shape:

{
  "personas": [
    {
      "archetype": "tough_crowd",
      "verdict": "scroll",
      "quote": "The hook was weak, I'm not stopping for this."
    },
    {
      "archetype": "loyalist",
      "verdict": "stop",
      "quote": "I'd watch anything from this creator."
    }
    // ... exactly 10 entries total, one per archetype above, IN THE SAME ORDER ...
  ]
}

TYPE RULES (STRICT):
- "verdict" MUST be exactly "stop" or "scroll" — no other values, no null, no mixed case
- "quote" MUST be a non-empty string, max 160 characters, first-person voice
- "archetype" MUST match the archetype slug exactly
- EXACTLY 10 persona entries — one per archetype listed above
- Output strict JSON only — no markdown, no code fences, no explanatory text`;
}

// ─── Volatile per-request user content builder ───────────────────────────────
// `framing` swaps ONLY the persona question + band verbiage — NOT the personas (D-04).
// Persona data comes from persona-registry.ts ARCHETYPE_DEFINITIONS (D-05).
// Volatile data lives here in the user message, NOT in the system prompt.

/**
 * Builds the user message text for a Flash call.
 *
 * @param text     The content text to react to (hook copy, idea, chat prompt, etc.)
 * @param framing  Mode framing — swaps only the question + band verbiage (D-04)
 */
export function buildFlashUserContent(text: string, framing: FlashFraming): string {
  const lines: string[] = [];

  lines.push("## Content to React To");
  lines.push(text || "(no content provided)");
  lines.push("");

  lines.push("## Your Task");
  lines.push(FRAMING_QUESTION[framing]);
  lines.push("");

  lines.push("## Band Context");
  lines.push(FRAMING_BAND_VERBIAGE[framing]);
  lines.push("");

  lines.push(
    "Return a JSON object with EXACTLY 10 personas, one per archetype, in the order listed in the system prompt.",
  );

  return lines.join("\n");
}
