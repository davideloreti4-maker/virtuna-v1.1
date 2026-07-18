/**
 * chat-followups.ts — context-aware follow-up suggestions for the chat-as-agent thread.
 *
 * After a chat turn completes, the thread offers a few tappable chips proposing the natural next
 * move. Unlike the retired chain-handoff CTAs (which switched the active tool and re-ran it BLANK,
 * losing the conversation), these send a NEW CHAT MESSAGE into the SAME thread — the agent then
 * routes it (a generator, an analysis answer, whatever fits). The suggestions are keyed off WHAT
 * ACTUALLY RAN this turn, read from the turn's rendered block types, so a script turn never offers
 * "turn this into hooks" and a plain strategy answer offers the generative entry points.
 *
 * COMPLEMENTS the per-card forward CTAs (idea→"Develop into hooks", hook→"Write script"), never
 * duplicates them: the card owns the single forward step; the thread chips own "more / a sharper
 * shape / jump ahead / ask about it". Pure data + a classifier — no React, no fetch.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChatFollowup {
  /** Chip label shown in the thread (short, imperative). */
  label: string;
  /** The message sent into the chat thread on tap; the agent routes it. */
  prompt: string;
}

/** The kind of turn we just completed, derived from its rendered blocks. */
export type ChatTurnKind = "ideas" | "hooks" | "script" | "remix" | "chat";

// ─── Classifier ────────────────────────────────────────────────────────────────

/**
 * Classify a completed turn from the block types it rendered. A turn that produced a skill's cards
 * IS that skill's turn; a turn with only markdown (or nothing) is a plain chat answer. Precedence
 * follows the content chain end→start (script > hooks > ideas > remix): if a turn carried more than
 * one card type, the furthest-along card is what the creator is looking at, so its follow-ups win.
 */
export function classifyTurn(blockTypes: readonly string[]): ChatTurnKind {
  const has = (t: string) => blockTypes.includes(t);
  if (has("script-card")) return "script";
  if (has("hook-card")) return "hooks";
  if (has("idea-card")) return "ideas";
  if (has("remix-card")) return "remix";
  return "chat";
}

// ─── The registry ────────────────────────────────────────────────────────────────

const FOLLOWUPS: Record<ChatTurnKind, ChatFollowup[]> = {
  // Plain answer (strategy / thinking out loud) → the generative entry points, so the creator can
  // turn the conversation into something concrete without hunting for the skill selector.
  chat: [
    { label: "Give me ideas", prompt: "Give me a few content ideas for what we just talked about." },
    { label: "Write hooks", prompt: "Write some scroll-stopping hooks for this." },
    { label: "Draft a script", prompt: "Draft a short-form script for this." },
  ],
  // Ideas ran → each idea card already offers "Develop into hooks →". Thread chips add "more" and a
  // jump straight to a script (skipping ahead), never the per-card hooks step.
  ideas: [
    { label: "More ideas", prompt: "Give me a few more ideas along these lines." },
    { label: "Script the best one", prompt: "Turn the strongest idea into a full script." },
  ],
  // Hooks ran → each hook card already offers "Write script →". Thread chips add "more" and a
  // conversational compare (the agent answers in prose — shows its judgement, not just generation).
  hooks: [
    { label: "More hooks", prompt: "Give me a few more hook options." },
    { label: "Which is strongest?", prompt: "Which of these hooks is strongest for my audience, and why?" },
  ],
  // Script ran → the card offers "Rewrite for this audience →". Thread chips own tightening,
  // re-angling, and stepping back to hooks for the same script.
  script: [
    { label: "Make it punchier", prompt: "Rewrite the script tighter and punchier." },
    { label: "Different angle", prompt: "Give me the same idea as a script from a completely different angle." },
    { label: "Hooks for this", prompt: "Write a few hooks for this script." },
  ],
  // Remix ran → the card offers "Develop into hooks →". Thread chips own finding more to adapt and
  // pushing the adapted concept forward into a script.
  remix: [
    { label: "More like this", prompt: "Find me a few more outliers I could adapt like this." },
    { label: "Write a script", prompt: "Turn this adapted hook into a full script." },
  ],
};

// ─── Public API ──────────────────────────────────────────────────────────────────

/**
 * The follow-up chips for a just-completed turn, keyed off the block types it rendered.
 * Returns 2–3 curated suggestions; never empty (a plain answer still gets the generative entries).
 */
export function followupsForTurn(blockTypes: readonly string[]): ChatFollowup[] {
  return FOLLOWUPS[classifyTurn(blockTypes)];
}

/**
 * Extract the `type` string off each raw block in a turn's body (defensive — blocks are loosely
 * typed until MessageBlocks re-validates them). Non-object / typeless entries are dropped.
 */
export function blockTypesOf(blocks: readonly unknown[]): string[] {
  const types: string[] = [];
  for (const b of blocks) {
    if (b && typeof b === "object" && "type" in b) {
      const t = (b as { type: unknown }).type;
      if (typeof t === "string" && t) types.push(t);
    }
  }
  return types;
}
