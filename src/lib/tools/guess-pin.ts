/**
 * guess-pin.ts — pin round 1 to the pre-router's guess, because the model will not dispatch.
 *
 * ─── THE DEFECT, MEASURED ────────────────────────────────────────────────────────────────────
 *
 * Session 10, 183 generations through the real loop. An ask whose SUBJECT is a product, app, show
 * or format dispatches **7/31 · 23%**; the identical ask shape with a scenario subject dispatches
 * **30/30 · 100%**. Fisher exact p = 5.4e-11. The ask's wording is the same across both — only the
 * subject moves. And *"give me hooks for my <the thing I am promoting>"* is the single most common
 * real generation ask there is.
 *
 * The model states the false belief in so many words — *"'Student budgeting app' is the product,
 * not the hook"* — and then offers a menu of angles instead of running. Pinned, the same subjects
 * produce good on-brief packs every time (6/6, quality indistinguishable from the runs the model
 * chose to make).
 *
 * WHY NOT A PROMPT CLAUSE. Four measured attempts, four failures: negative instructions (session 9
 * §10.1), a positive instruction (0/3), `forceSkill`'s own header from session 6, and a clause
 * written against the verbatim false belief — which moved the product cell 3/10 → 7/10 (p = 0.179,
 * not significant) and the format cell 0/10 → 1/10 (p = 1.0), while composing WORSE with a second
 * clause than alone. Treat wording as a dead lever on this surface; this is structure.
 *
 * ─── WHY THE TRIGGER IS THE GUESS, AND NOT "THE MODEL FAILED TO DISPATCH" ────────────────────
 *
 * The obvious alternative is to retry pinned after observing no tool call. It is strictly worse:
 * its trigger is "guessed AND the model called no tool", and a false positive is BY DEFINITION an
 * ask the model is right to decline — so that condition *selects* for false positives rather than
 * filtering them. Identical exposure (~3.4% of fires, the same asks), and it additionally needs
 * round-1 text buffered (~2–3s of delayed first token on every generation ask, unscopable, since 5
 * of 7 successful runs also write prose first) plus a new retry path and a changed streaming
 * contract. This reuses the `forceSkill` seam chip taps already use, and costs no latency.
 *
 * The price it does pay: on turns the model would have dispatched anyway, round-1 framing prose is
 * suppressed (measured at 0 chars under a pin, 6/6). Read, that prose is preamble — *"You're a
 * comedy storyteller, not a fintech explainer"*. Round 2 stays unpinned, so the closing line that
 * earns its place survives.
 *
 * Pure, no I/O, no LLM. Deterministic.
 */

import { guessSkill, type PreRouteGuess } from "@/lib/tools/pre-router";

/**
 * Server flag — ships dark, like `ENGINE_REPEAT_ASK_PIN`. Server-side (no `NEXT_PUBLIC_`): the
 * decision is made in the route and reaches the client only as behaviour, so flipping it needs no
 * redeploy. Exact string "true" only — a half-set flag must read as off.
 */
export function isGuessPinEnabled(): boolean {
  return process.env.ENGINE_GUESS_PIN === "true";
}

/**
 * The non-generator tools a creator can name. Not a registry import on purpose — the same reason
 * `repeat-ask.ts` keeps its `TOOL_TO_SKILL` local: this is a read of the creator's WORDS, and a
 * tool the registry gains should not silently change how an old phrasing is routed.
 *
 * ⚠️ `read` is deliberately absent. The corpus never exercised it, and "read" is an ordinary word
 * in ordinary asks ("read my draft, then give me hooks") where standing the pin down would give
 * back the defect for nothing. Add it with a measurement, not on the strength of the tool list.
 */
const OTHER_TOOL = /\b(simulate|simulation|remix|predict(?:ion|s)?)\b/i;

/** The artefact nouns `guessSkill` itself keys on — mirrored here to compare POSITION, not identity. */
const ARTEFACT_NOUN = /\b(scripts?|outlines?|hooks?|openers?|opening lines?|ideas?|angles?|concepts?)\b/i;

/**
 * Does the ask name a DIFFERENT tool as the thing to run?
 *
 * ⚠️ Position, not mention — and the difference is measured, not stylistic. The naive rule ("stand
 * down whenever another tool is mentioned") suppresses **3 confirmed-correct runs to kill 1 false
 * positive** on the app's own history, because this product's creators describe their subject in
 * exactly this vocabulary:
 *
 *     "3 hooks for my saas software that lets creators simulate how their audience reacts…"   ← subject
 *     "Yes, run the simulate tool on that hook — I want the reaction card."                   ← instruction
 *
 * The tool word lands AFTER the artefact noun when it belongs to the subject, and BEFORE it when
 * it is the ask. That rule kills the false positive at zero measured cost.
 */
function namesOtherToolFirst(ask: string): boolean {
  const tool = OTHER_TOOL.exec(ask);
  if (!tool) return false;
  const artefact = ARTEFACT_NOUN.exec(ask);
  return artefact === null || tool.index < artefact.index;
}

/**
 * Should this turn's round-1 tool call be pinned to a generator?
 *
 * @param rawAsk The creator's typed message — NOT the assembled bundle.
 * @returns the skill key to pin (a `forceSkill` value), or null to leave the turn alone.
 *
 * Null for everything `guessSkill` already reads as conversation — a question about existing work,
 * an ask naming no artefact — plus the one narrowing above. Everything else pins, which is the
 * point: the defect is that the model declines asks it should run, and the guess is a better
 * predictor of the creator's intent than the model's own round-1 decision is.
 */
export function detectGuessPin(rawAsk: string): PreRouteGuess | null {
  const guess = guessSkill(rawAsk);
  if (!guess) return null;
  if (namesOtherToolFirst(rawAsk)) return null;
  return guess;
}
