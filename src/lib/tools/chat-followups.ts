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
  /**
   * THE GENERATOR THIS CHIP MEANS — declared here, not inferred from the sentence downstream.
   *
   * A chip is a COMMAND the creator pressed under cards that already fix the subject; it is not a
   * question. Its sentence, read alone, is deliberately conversational ("Give me a few more hook
   * options.") and carries no subject — so the agent's own directive read it as "too vague or too
   * generic" and pushed back for a sharper angle instead of running. Measured 0/3, unchanged by the
   * §4 transcript fix, and NOT fixable in prompt text: a continuation clause reached 1/3 and
   * destabilised sibling chips (precedent beats instruction — see chat-prior-turns.ts).
   *
   * So the intent travels as DATA. The chip states which generator it means, the client sends that
   * alongside the message, and the loop pins the first round's `tool_choice` to it — the model still
   * writes the args (it pulls the subject off the transcript) and still writes the closing line, but
   * it no longer gets to re-litigate a decision the creator already made by tapping.
   *
   * ABSENT ON PURPOSE for every conversational chip ("Which is strongest?", "Where am I weakest?").
   * That is what keeps this from being a blanket "dispatch more" change: a chip with no `skill` is
   * byte-identical to before, so the no-dispatch controls cannot move.
   *
   * Only the three BOUND generators are nameable. `remix` / `explore` / `test` chips stay
   * conversational because the loop binds no tool for them — see followupsForKind.
   */
  skill?: FollowupSkill;
}

/**
 * The generators a chip may name — exactly the `skillKey`s the agent loop binds (skill-dispatch.ts
 * SKILL_TOOLS). Deliberately NOT the full ChatTurnKind: naming a kind with no bound tool would be a
 * promise the loop cannot keep, and the loop drops an unresolvable name rather than failing the turn.
 */
export type FollowupSkill = "ideas" | "hooks" | "script";

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
  | "profile"
  // A concept Read (`multi-audience-read`). It was missing from this union while the block type
  // already existed, so every Read turn classified as plain "chat" and drew the generic
  // "Give me ideas / Write hooks / Draft a script" chips under an audience verdict.
  | "read";

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
  if (has("multi-audience-read")) return "read";
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
    { label: "Give me ideas", prompt: "Give me a few content ideas for what we just talked about.", skill: "ideas" },
    { label: "Write hooks", prompt: "Write some scroll-stopping hooks for this.", skill: "hooks" },
    { label: "Draft a script", prompt: "Draft a short-form script for this.", skill: "script" },
  ],
  // Ideas ran → each idea card already offers "Write hooks for this →". Chips add "more", a jump
  // straight to a script (skipping ahead), and a sharpen — never the per-card hooks step.
  ideas: [
    { label: "More ideas", prompt: "Give me a few more ideas along these lines.", skill: "ideas" },
    { label: "Script the best one", prompt: "Turn the strongest idea into a full script.", skill: "script" },
    { label: "Sharper angles", prompt: "Give me punchier, more specific angles on these ideas.", skill: "ideas" },
  ],
  // Hooks ran → each hook card already offers "Write the script →". Chips add "more", a conversational
  // compare (the agent answers in prose — judgement, not just generation), and a punch-up pass.
  //
  // "Punch them up" is a fresh SIM-scored hooks run under a tighter brief — NOT the card-scoped
  // /api/tools/refine path. Refine rewrites ONE named card ("make hook 2 punchier"), needs its
  // `cardRef` + `anchor`, and already has its own live door through the composer's detectRefineIntent.
  // A turn-level chip has no card in hand, so pointing it at refine would mean inventing one.
  hooks: [
    { label: "More hooks", prompt: "Give me a few more hook options.", skill: "hooks" },
    { label: "Which is strongest?", prompt: "Which of these hooks is strongest for my audience, and why?" },
    { label: "Punch them up", prompt: "Rewrite these hooks tighter and more specific.", skill: "hooks" },
  ],
  // Script ran → the card offers "Test this script →". Chips own tightening, re-angling, and stepping
  // back to hooks for the same script. Same reasoning as "Punch them up" above: a re-write at TURN
  // level is a fresh scored script run, not a card-scoped refine.
  script: [
    { label: "Make it punchier", prompt: "Rewrite the script tighter and punchier.", skill: "script" },
    { label: "Different angle", prompt: "Give me the same idea as a script from a completely different angle.", skill: "script" },
    { label: "Hooks for this", prompt: "Write a few hooks for this script.", skill: "hooks" },
  ],
  // Remix ran → the card offers "Write hooks for this →". Chips own finding more to adapt and pushing
  // the adapted concept forward.
  remix: [
    // "More like this" is an EXPLORE pull — the loop binds no tool for it, so it stays conversational.
    { label: "More like this", prompt: "Find me a few more outliers I could adapt like this." },
    { label: "Write hooks", prompt: "Write a few hooks from this adapted concept.", skill: "hooks" },
    { label: "Draft a script", prompt: "Turn this adapted concept into a full script.", skill: "script" },
  ],
  // Explore ran (outlier discovery) → the grid tiles already remix a specific outlier. Chips own the
  // pattern-level moves: adapt the best, pull ideas from what's working, widen the net.
  // "Remix the best one" and "Find more" reach remix/explore, which the loop does not bind — they
  // stay conversational (the agent surfaces an input field or answers in words).
  explore: [
    { label: "Remix the best one", prompt: "Remix the strongest of these outliers for my audience." },
    { label: "Ideas from this", prompt: "Turn what's working in these outliers into content ideas for me.", skill: "ideas" },
    { label: "Find more", prompt: "Find me a few more outliers like these." },
  ],
  // Account read ran (strengths/weaknesses) → the card offers "Write to my strengths →". Chips own the
  // adjacent moves: fitting ideas, the weak spot, hooks in my voice.
  account: [
    { label: "Ideas that fit me", prompt: "Give me content ideas that lean into what's already working for me.", skill: "ideas" },
    { label: "Where am I weakest?", prompt: "What's the biggest weakness in my content, and how do I fix it?" },
    { label: "Hooks in my voice", prompt: "Write a few hooks that sound like me.", skill: "hooks" },
  ],
  // Test ran (video craft teardown) → the card offers "Simulate with your audience →". Chips own the
  // CRAFT next-moves: fix the flagged weaknesses, then reshoot a better cut.
  test: [
    { label: "Rewrite the hook", prompt: "Rewrite the opening hook of this video to be stronger.", skill: "hooks" },
    // A diagnosis, not an artefact — stays conversational.
    { label: "Fix the pacing", prompt: "How do I fix the pacing and the weak beat in this video?" },
    { label: "Script a better cut", prompt: "Write a tighter script for a stronger version of this video.", skill: "script" },
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
  // Concept Read ran (the audience's verdict on something the creator wrote) → the next moves are
  // understanding the verdict, acting on it, and running the next thing past them.
  //
  // "Read another" carries NO `skill` deliberately. A pinned chip forces the tool on round 1, and a
  // Read cannot run without the text to read — a subject-less pin would force the call, trip the
  // loop's "no draft" guard and spend the turn on an error. Left unpinned, the agent surfaces the
  // read FIELD instead, which is the door that actually collects it.
  read: [
    { label: "Why that reaction?", prompt: "Why did my audience react to this the way they did?" },
    { label: "Make it land better", prompt: "Rewrite this so it lands better with my audience.", skill: "hooks" },
    { label: "Read another", prompt: "Let me run something else past my audience." },
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
