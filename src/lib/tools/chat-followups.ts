/**
 * chat-followups.ts — context-aware follow-up suggestions for EVERY skill in the thread.
 *
 * After a turn completes, the thread offers a few tappable chips proposing the natural next move.
 * Unlike the retired chain-handoff CTAs (which switched the active tool and re-ran it BLANK, losing
 * the conversation), these send a NEW CHAT MESSAGE into the SAME thread — the agent then routes it
 * (a generator, an analysis answer, whatever fits). The suggestions are keyed off WHAT ACTUALLY RAN
 * this turn, read from the turn's rendered block types, so a Test turn never offers "give me ideas"
 * and a script turn offers tightening + re-angling.
 *
 * COMPLEMENTS the per-card forward CTA (idea→"Write hooks for this", hook→"Write the script",
 * test→"Simulate with your audience"), never duplicates it: the card owns the SINGLE forward step
 * (a solid tonal button); these chips own the ALTERNATIVES — "more / a sharper shape / jump ahead /
 * fix a weakness / ask about it" — and render as a DISTINCT type (ghost pills), so the two never
 * read as the same control. Every skill is covered (2026-07-22): the analysis skills (test /
 * account / explore / predict / profile) used to fall through to the generic chat set.
 *
 * Pure data + a classifier — no React, no fetch.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ChatFollowup {
  /** Chip label shown in the thread (short, imperative). */
  label: string;
  /** The message sent into the chat thread on tap; the agent routes it. */
  prompt: string;
}

/** The kind of turn we just completed, derived from its rendered blocks (or passed explicitly). */
export type ChatTurnKind =
  | "chat"
  | "ideas"
  | "hooks"
  | "script"
  | "remix"
  | "explore"
  | "account"
  | "test"
  | "predict"
  | "profile";

// ─── Classifier ────────────────────────────────────────────────────────────────

/**
 * Classify a completed turn from the block types it rendered. The ANALYSIS reads (test / account /
 * explore / predict / profile) are distinct terminal outputs and win first; then the generative
 * content chain, furthest-along first (script > hooks > ideas > remix) — if a turn carried more than
 * one card type, the furthest-along card is what the creator is looking at, so its follow-ups win.
 * A turn with only markdown (or nothing) is a plain chat answer.
 */
export function classifyTurn(blockTypes: readonly string[]): ChatTurnKind {
  const has = (t: string) => blockTypes.includes(t);
  if (has("video-test-card")) return "test";
  if (has("account-read")) return "account";
  if (has("outlier-grid")) return "explore";
  if (has("reaction-distribution") || has("prediction-gauge")) return "predict";
  if (has("profile-read")) return "profile";
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
  // Ideas ran → each idea card already offers "Write hooks for this →". Chips add "more", a jump
  // straight to a script (skipping ahead), and a sharpen — never the per-card hooks step.
  ideas: [
    { label: "More ideas", prompt: "Give me a few more ideas along these lines." },
    { label: "Script the best one", prompt: "Turn the strongest idea into a full script." },
    { label: "Sharper angles", prompt: "Give me punchier, more specific angles on these ideas." },
  ],
  // Hooks ran → each hook card already offers "Write the script →". Chips add "more", a conversational
  // compare (the agent answers in prose — judgement, not just generation), and a punch-up pass.
  hooks: [
    { label: "More hooks", prompt: "Give me a few more hook options." },
    { label: "Which is strongest?", prompt: "Which of these hooks is strongest for my audience, and why?" },
    { label: "Punch them up", prompt: "Rewrite these hooks tighter and more specific." },
  ],
  // Script ran → the card offers "Test this script →". Chips own tightening, re-angling, and stepping
  // back to hooks for the same script.
  script: [
    { label: "Make it punchier", prompt: "Rewrite the script tighter and punchier." },
    { label: "Different angle", prompt: "Give me the same idea as a script from a completely different angle." },
    { label: "Hooks for this", prompt: "Write a few hooks for this script." },
  ],
  // Remix ran → the card offers "Write hooks for this →". Chips own finding more to adapt and pushing
  // the adapted concept forward.
  remix: [
    { label: "More like this", prompt: "Find me a few more outliers I could adapt like this." },
    { label: "Write hooks", prompt: "Write a few hooks from this adapted concept." },
    { label: "Draft a script", prompt: "Turn this adapted concept into a full script." },
  ],
  // Explore ran (outlier discovery) → the grid tiles already remix a specific outlier. Chips own the
  // pattern-level moves: adapt the best, pull ideas from what's working, widen the net.
  explore: [
    { label: "Remix the best one", prompt: "Remix the strongest of these outliers for my audience." },
    { label: "Ideas from this", prompt: "Turn what's working in these outliers into content ideas for me." },
    { label: "Find more", prompt: "Find me a few more outliers like these." },
  ],
  // Account read ran (strengths/weaknesses) → the card offers "Write to my strengths →". Chips own the
  // adjacent moves: fitting ideas, the weak spot, hooks in my voice.
  account: [
    { label: "Ideas that fit me", prompt: "Give me content ideas that lean into what's already working for me." },
    { label: "Where am I weakest?", prompt: "What's the biggest weakness in my content, and how do I fix it?" },
    { label: "Hooks in my voice", prompt: "Write a few hooks that sound like me." },
  ],
  // Test ran (video craft teardown) → the card offers "Simulate with your audience →". Chips own the
  // CRAFT next-moves: fix the flagged weaknesses, then reshoot a better cut.
  test: [
    { label: "Rewrite the hook", prompt: "Rewrite the opening hook of this video to be stronger." },
    { label: "Fix the pacing", prompt: "How do I fix the pacing and the weak beat in this video?" },
    { label: "Script a better cut", prompt: "Write a tighter script for a stronger version of this video." },
  ],
  // Predict ran (outcome / reaction distribution) → the card offers "Predict an outcome →". Chips own
  // running another, asking why, and improving the odds.
  predict: [
    { label: "Predict another", prompt: "Predict a different outcome with the same audience." },
    { label: "Why this result?", prompt: "Why did it land this way with my audience?" },
    { label: "Improve the odds", prompt: "What would make this more likely to land?" },
  ],
  // Profile read ran (a person / audience) → the card offers "Test this message →". Chips own drafting,
  // digging into what they want, and testing an alternative.
  profile: [
    { label: "Draft a message", prompt: "Draft a message to this person that would actually land." },
    { label: "What do they want?", prompt: "What does this person care about most right now?" },
    { label: "Test another", prompt: "Let me test a different message on them." },
  ],
};

// ─── Public API ──────────────────────────────────────────────────────────────────

/** The curated follow-up chips for a turn kind (used by the standalone skill views, which know their kind). */
export function followupsForKind(kind: ChatTurnKind): ChatFollowup[] {
  return FOLLOWUPS[kind];
}

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
