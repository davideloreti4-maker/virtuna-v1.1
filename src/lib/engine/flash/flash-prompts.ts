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

// ─── Intent lens (GAP-C2 / §P.10) ──────────────────────────────────────────────
// Per-run reaction LENS layered onto the volatile user message (NOT the cache-stable
// system prompt). `grow` is the engine's existing default → byte-identical no-op.
// `sell` re-frames the SAME stop/scroll verdict as a buying decision (no schema change,
// no weight/engine change). Lives in the user message so the system-prompt cache prefix
// (D-17) and ENGINE_VERSION stay untouched. Only fires for a calibrated audience (runner-gated).

export type IntentLens = "grow" | "sell";

// Appended to the user message ONLY when intent === "sell". Verdict tokens stay "stop"/"scroll"
// (no schema/coercion impact) — the lens only re-aims what they MEAN + what the quote voices.
const SELL_LENS_DIRECTIVE =
  "## Buying Lens (this run)\n" +
  "Judge this AS A POTENTIAL BUYER, not just a viewer. Re-aim the same verdict: " +
  '"stop" = this makes you want to BUY or seriously consider the offer; ' +
  '"scroll" = you would not buy. In your quote, voice the BUYING reaction — desire, ' +
  "the objection holding you back, or your price/value gut-check — not just watch-time.";

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

// Pure archetype-block builders, shared by the single AND batched system prompts so
// the population definition (socials Pack #1) is byte-identical across both output shapes.
function buildGenericArchetypeBlock(): string {
  return ARCHETYPES.map((a: Archetype) => {
    const def = ARCHETYPE_DEFINITIONS[a];
    const triggers = ARCHETYPE_TRIGGERS[a];
    return `### ${a}\n${def}\n\nScrolls past when: ${triggers.scroll_past.join(", ")}.\nStops for: ${triggers.stop.join(", ")}.`;
  }).join("\n\n");
}

function buildSystemPrompt(): string {
  const archetypeBlock = buildGenericArchetypeBlock();

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
// Niche-instantiated archetype block (slots + optional per-audience repaint). Shared by
// the single AND batched niche system prompts. Byte-identical to the pre-extraction inline
// expression (regression-critical no-op for the single/react path).
function buildNicheArchetypeBlock(
  panel: NichePanel,
  audienceRepaint?: Record<string, string>,
): string {
  const slots: PersonaSlot[] = selectPersonaSlots(panel.contentType, panel.niche);

  // Build the archetype block from niche-instantiated slots.
  // Each slot: ### {archetype} + description text + scroll_past_triggers + stop_triggers.
  // Duplicate-archetype slots appear as separate entries — repetition encodes the weighting.
  //
  // Audience repaint: when audienceRepaint is provided, substitute the per-audience description
  // for the slot's niche_instantiation — skeleton (triggers, schema, rules) stays byte-stable.
  // When undefined → unchanged path, byte-identical to pre-P7 output.
  return slots
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
}

export function buildNicheAwareSystemPrompt(
  panel: NichePanel,
  audienceRepaint?: Record<string, string>,
): string {
  if (panel.niche === null) {
    return STABLE_FLASH_SYSTEM_PROMPT;
  }

  const archetypeBlock = buildNicheArchetypeBlock(panel, audienceRepaint);

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
 * @param intent   Optional per-run reaction lens (GAP-C2). `sell` appends the buying-lens
 *                 directive; `grow`/undefined → byte-identical to the pre-intent output
 *                 (regression-critical no-op — the General gate exercises this path).
 */
export function buildFlashUserContent(
  text: string,
  framing: FlashFraming,
  intent?: IntentLens,
): string {
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

  // Sell lens: re-aim the verdict toward purchase intent (calibrated audiences only).
  // grow/undefined → this block is omitted → byte-identical to the pre-intent message.
  if (intent === "sell") {
    lines.push(SELL_LENS_DIRECTIVE);
    lines.push("");
  }

  lines.push(
    "Return a JSON object with EXACTLY 10 personas, one per archetype, in the order listed in the system prompt.",
  );

  return lines.join("\n");
}

// ─── BATCHED system prompt (S3′ — generate-rate-rank) ────────────────────────────
// Reuses the SAME archetype block builders (population definition byte-identical to the
// single path) and swaps ONLY the output-schema section → batched. This is a SEPARATE
// byte-stable cache prefix from the single-candidate prompts (hooks/ideas/remix use it;
// script/react keep the single prompt) — D-17 holds: no per-request data interpolated.
// Validated live in scripts/s3-batch-spike.ts (N=8: parses, 10/candidate, independence held).

const BATCH_OUTPUT_SCHEMA_BLOCK = `## Output Schema (BATCHED — multiple candidates)

You will be given N unrelated candidate drafts, each with an "id". For EACH candidate,
feed all 10 archetypes and return their verdicts. Return ONLY a JSON object of this EXACT shape:

{
  "candidates": [
    {
      "id": "<echo the candidate id exactly>",
      "personas": [
        { "archetype": "tough_crowd", "verdict": "scroll", "quote": "The hook was weak, I'm not stopping." },
        { "archetype": "loyalist", "verdict": "stop", "quote": "I'd watch anything from this creator." }
        // ... exactly 10 entries, one per archetype, IN THE SAME ORDER ...
      ]
    }
    // ... one object per candidate id provided ...
  ]
}

TYPE RULES (STRICT):
- One candidates entry per input id; echo the "id" exactly.
- EXACTLY 10 persona entries per candidate — one per archetype listed above, same order.
- "verdict" MUST be exactly "stop" or "scroll" — lowercase, no other values, no null.
- "quote" MUST be a non-empty string, max 160 characters, first-person voice.
- Output strict JSON only — no markdown, no code fences, no explanatory text.`;

function wrapBatchSystemPrompt(archetypeBlock: string): string {
  return `You are simulating TEN TikTok viewer archetypes reacting to TEXT content.

Your task: for EACH candidate draft provided, and for each of the 10 archetypes defined below, produce:
- A verdict: "stop" (would stop and engage) or "scroll" (would scroll past)
- A one-line first-person voice quote (max 160 characters) capturing WHY — the audience texture the creator needs to hear

## Archetype Definitions (feed ALL 10 per candidate — verdicts MUST diverge based on their profiles)

${archetypeBlock}

## Critical Divergence Requirement

These 10 archetypes have FUNDAMENTALLY different tolerances. Near-identical verdicts across all archetypes is a FAILURE — tough_crowd is the hardest to stop; loyalist is the easiest. Apply this per candidate.

${BATCH_OUTPUT_SCHEMA_BLOCK}`;
}

/**
 * Build the BATCHED Flash system prompt (S3′).
 * - No panel / panel.niche === null → generic archetype block (General path).
 * - panel.niche set → niche-instantiated block (+ optional per-audience repaint),
 *   identical population bytes to buildNicheAwareSystemPrompt.
 */
export function buildFlashBatchSystemPrompt(
  panel?: NichePanel,
  audienceRepaint?: Record<string, string>,
): string {
  const archetypeBlock =
    panel && panel.niche !== null
      ? buildNicheArchetypeBlock(panel, audienceRepaint)
      : buildGenericArchetypeBlock();
  return wrapBatchSystemPrompt(archetypeBlock);
}

// The independence directive — the single most important quality lever for the batched
// call (proven in the spike). Keeps candidate-level verdicts honest + un-normalized.
const BATCH_INDEPENDENCE_DIRECTIVE =
  "## Independence (critical)\n" +
  "Judge each candidate strictly on its own merits. These are unrelated drafts — do NOT let " +
  "one bias another, do NOT rank them against each other, do NOT normalize across them. A weak " +
  "candidate sitting next to a strong one must still receive its own honest verdicts.";

/**
 * Build the volatile BATCHED user message (S3′).
 *
 * @param candidates  The drafts to react to, each with a stable id (echoed back by the model).
 * @param framing     Mode framing — swaps the per-candidate question + band verbiage (D-04).
 * @param intent      Optional per-run lens (`sell` appends the buying directive; grow/undefined no-op).
 */
export function buildFlashBatchUserContent(
  candidates: { id: string; text: string }[],
  framing: FlashFraming,
  intent?: IntentLens,
): string {
  const lines: string[] = [];

  lines.push(`## Candidates to React To (${candidates.length} unrelated drafts)`);
  lines.push("");
  for (const c of candidates) {
    lines.push(`### id: ${c.id}`);
    lines.push(c.text || "(no content provided)");
    lines.push("");
  }

  lines.push("## Your Task");
  lines.push(`For EACH candidate above, judged on its own: ${FRAMING_QUESTION[framing]}`);
  lines.push("");

  lines.push(BATCH_INDEPENDENCE_DIRECTIVE);
  lines.push("");

  lines.push("## Band Context");
  lines.push(FRAMING_BAND_VERBIAGE[framing]);
  lines.push("");

  // Sell lens: re-aim verdicts toward purchase intent (calibrated audiences only).
  // grow/undefined → omitted → byte-identical to the pre-intent message.
  if (intent === "sell") {
    lines.push(SELL_LENS_DIRECTIVE);
    lines.push("");
  }

  lines.push(
    "Return a JSON object with a \"candidates\" array — one entry per id above, each echoing its id " +
      "and carrying EXACTLY 10 personas in the system-prompt archetype order.",
  );

  return lines.join("\n");
}
