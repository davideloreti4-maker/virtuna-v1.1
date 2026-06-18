/**
 * refine.ts — NL refine-intent detection + scoped re-run anchor (Plan 05-05, Task 1).
 *
 * Exports:
 *   detectRefineIntent(text) — bounded heuristic: refine verb + card noun + ordinal → scoped re-run
 *   buildRefineAnchor(cardProps, instruction) — compact fenced anchor for the scoped re-run
 *
 * Design decisions (D-04 / D-05):
 *   - detectRefineIntent is a BOUNDED heuristic — it recognizes an explicit refine verb
 *     ("make", "tighten", "punch", "sharpen", "rewrite", "redo") AND a card noun ("hook",
 *     "idea") AND an ordinal/number reference ("1", "2", "the first"). A plain question
 *     ("what should I post this week?") MUST NOT classify as a refine (Test 3 — cost
 *     honesty + predictability per D-05). No full-NL auto-launch router.
 *   - buildRefineAnchor produces a compact fenced markdown block carrying the original
 *     card content + the user instruction. The route feeds this as the anchor to the
 *     scoped re-run pipeline call so the model can specifically improve on the original.
 *   - Pure module — no React import, no fetch(). Tree-shakeable on the client.
 *
 * Security: detectRefineIntent only reads text; it does NOT execute or dispatch anything.
 *   The caller (composer.tsx) POSTs to /api/tools/refine after the intent is confirmed.
 */

import type { HookCardBlock, IdeaCardBlock } from "./blocks";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Result of detectRefineIntent.
 *
 * @field isRefine    True when the text is a bounded refine request.
 * @field skill       Which skill to re-run ("hooks" | "idea"); present when isRefine.
 * @field cardRef     1-based card ordinal reference; present when isRefine.
 * @field instruction The original text, preserved as the user's refine instruction.
 */
export interface RefineIntent {
  isRefine: boolean;
  skill?: "hooks" | "idea";
  cardRef?: number;
  instruction?: string;
}

/**
 * Props accepted by buildRefineAnchor.
 * Accepts either HookCardBlock["props"] or IdeaCardBlock["props"].
 */
export type RefineCardProps =
  | HookCardBlock["props"]
  | IdeaCardBlock["props"];

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Bounded set of refine verbs (D-05: explicit refine signal, no generic chatbot).
 * These are the verbs that, combined with a card noun + number, signal a scoped re-run.
 */
const REFINE_VERBS = [
  "make",
  "tighten",
  "punch",
  "punchier",
  "sharpen",
  "rewrite",
  "redo",
  "rework",
  "improve",
  "edit",
  "fix",
  "change",
  "update",
  "adjust",
  "refine",
  "revise",
  "rephrase",
  "reframe",
  "strengthen",
  "tweak",
];

/**
 * Card noun patterns — must appear in the text to qualify as a refine request.
 * Each entry maps to a skill id.
 */
const CARD_NOUNS: Array<{ pattern: RegExp; skill: "hooks" | "idea" }> = [
  { pattern: /\bhooks?\b/i, skill: "hooks" },
  { pattern: /\bideas?\b/i, skill: "idea" },
];

/**
 * Ordinal word → number mapping.
 */
const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  "1st": 1,
  "2nd": 2,
  "3rd": 3,
  "4th": 4,
  "5th": 5,
};

// ─── detectRefineIntent ───────────────────────────────────────────────────────

/**
 * Detect whether `text` is a bounded refine request targeting a specific card.
 *
 * Criteria (ALL must be satisfied for isRefine = true):
 *  1. At least one refine verb appears in the text.
 *  2. A card noun ("hook" or "idea") appears in the text.
 *  3. An ordinal/number reference appears in the text ("1", "2", "the first", etc.).
 *
 * A plain question without all three signals returns isRefine = false — this prevents
 * a silent skill fire on generic chat messages (D-05 cost honesty + predictability).
 */
export function detectRefineIntent(text: string): RefineIntent {
  const lower = text.toLowerCase().trim();

  // ── Step 1: Check for at least one refine verb ─────────────────────────────
  const hasRefineVerb = REFINE_VERBS.some((verb) => {
    // Match as a word boundary (not inside another word)
    const pattern = new RegExp(`\\b${verb}\\b`, "i");
    return pattern.test(lower);
  });

  if (!hasRefineVerb) {
    return { isRefine: false };
  }

  // ── Step 2: Check for a card noun ─────────────────────────────────────────
  let detectedSkill: "hooks" | "idea" | undefined;
  for (const { pattern, skill } of CARD_NOUNS) {
    if (pattern.test(lower)) {
      detectedSkill = skill;
      break;
    }
  }

  if (!detectedSkill) {
    return { isRefine: false };
  }

  // ── Step 3: Check for an ordinal/number reference ─────────────────────────
  // Try numeric digits first: "hook 1", "idea 2", etc.
  const digitMatch = lower.match(/\b([1-9][0-9]?)\b/);
  let cardRef: number | undefined;

  if (digitMatch) {
    cardRef = parseInt(digitMatch[1]!, 10);
  } else {
    // Try ordinal words: "the first hook", "second idea", etc.
    for (const [word, num] of Object.entries(ORDINAL_WORDS)) {
      const wordPattern = new RegExp(`\\b${word}\\b`, "i");
      if (wordPattern.test(lower)) {
        cardRef = num;
        break;
      }
    }
  }

  if (cardRef === undefined) {
    return { isRefine: false };
  }

  // ── All three criteria met — this is a refine request ─────────────────────
  return {
    isRefine: true,
    skill: detectedSkill,
    cardRef,
    instruction: text.trim(),
  };
}

// ─── buildRefineAnchor ────────────────────────────────────────────────────────

/**
 * Build a compact fenced anchor string for a scoped re-run.
 *
 * Embeds the original card's key content (hookLine for hooks; title+angle for ideas)
 * plus the user's refine instruction. The route passes this as the anchor to the
 * runHooksPipeline / runIdeasPipeline call so the model improves on the specific original.
 *
 * The anchor is intentionally compact — it carries only what the pipeline needs to
 * understand the specific card and the instruction (cost awareness; D-01a).
 */
export function buildRefineAnchor(card: RefineCardProps, instruction: string): string {
  // Detect card type by checking for hookLine (hook-card exclusive field)
  if ("hookLine" in card) {
    // Hook card
    const hook = card as HookCardBlock["props"];
    return [
      "```refine-anchor",
      `type: hook-card`,
      `rank: ${hook.rank}`,
      `hookLine: ${hook.hookLine}`,
      `audienceArchetype: ${hook.audienceArchetype}`,
      `mechanism: ${hook.mechanism}`,
      `band: ${hook.band} (${hook.fraction})`,
      `---`,
      `instruction: ${instruction}`,
      "```",
    ].join("\n");
  }

  // Idea card
  const idea = card as IdeaCardBlock["props"];
  return [
    "```refine-anchor",
    `type: idea-card`,
    `title: ${idea.title}`,
    `angle: ${idea.angle}`,
    `mechanism: ${idea.mechanism}`,
    `seedHook: ${idea.seedHook}`,
    `band: ${idea.band} (${idea.fraction})`,
    `---`,
    `instruction: ${instruction}`,
    "```",
  ].join("\n");
}
