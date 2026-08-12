/**
 * count-hint.ts — a count in the ask removes the pushback, instead of overriding it.
 *
 * ─── THE MEASUREMENT ─────────────────────────────────────────────────────────────────────────
 *
 * Session 11, 32 unpinned runs, both failing subject shapes (product and format), real loop:
 *
 *     the creator's words, unchanged    2/12 · 17%    9 pushbacks   1 prose tool-call
 *     the route injects a count        16/20 · 80%    0 pushbacks   3 prose tool-calls
 *
 * **Nine pushbacks to zero.** The model stops arguing that *"'stand-up comedy podcast' is the
 * format, not the hook"* — the exact belief four sessions of prompt work failed to shift. Injecting
 * the count route-side performs identically to the creator typing it (7/10 vs 7/10 on the format
 * cell), and every dispatching run returned 5 cards either way, so the creator receives what they
 * always received.
 *
 * It was found by accident: a probe arm was written as "give me 5 hooks…" against a 23% cell whose
 * real string has no count, and the control came back at ceiling. Session 10 §9 had listed the
 * count as never varied.
 *
 * ─── WHY THIS SHIPS BEFORE THE PIN ───────────────────────────────────────────────────────────
 *
 * `guess-pin.ts` reaches ~100% but pins `tool_choice`, and a pin is a BILLED run — hence its ~3.4%
 * wrong-run exposure on fires. This forces nothing. The model still decides, so there is no wrong
 * run to expose: the worst case is that it declines exactly as it does today. A fix that removes
 * the defect strictly dominates one that overrides the model's judgement about it, and the two
 * compose — what remains after the count is a DIFFERENT bug (the model emits the tool call as prose)
 * which the pin, or a narrow retry, still has to answer.
 *
 * ─── WHAT IT MAY AND MAY NOT TOUCH ───────────────────────────────────────────────────────────
 *
 * Only the assembled bundle — the text the MODEL reads. The route keeps `currentAsk` as the
 * creator's real words, so the conversation digest, the persisted transcript and everything the
 * creator ever sees are unchanged. This module must never be used to build either.
 *
 * ⚠️ It inserts the count the measurement used, where the measurement put it. This lane has four
 * recorded failures of untested wording (session 10 §5.1); a differently-phrased hint is a
 * different stimulus and would need its own runs.
 *
 * Pure, no I/O, no LLM. Deterministic.
 */

import { guessSkill } from "@/lib/tools/pre-router";

/**
 * Server flag — **default-ON**, on the owner's ruling of 2026-08-12, after the live-route
 * verification in `docs/HANDOFF-2026-08-12-session-11-guess-pin.md` §7.7: 0/6 → 6/6 on the real
 * `/api/tools/chat`, p ≈ 0.002. Unlike `ENGINE_GUESS_PIN` — still dark, and still carrying ~3.4%
 * wrong-run exposure — this forces no tool call, so the worst case of a wrong hint is the decline
 * production already serves today.
 *
 * `!== "false"` is the house convention for a shipped default (`on-screen.ts`,
 * `GROUNDING_CHAT_TOOL`, `CHAT_AGENT_DISPATCH`): the exact string "false" is the kill switch, and a
 * half-set flag stays ON rather than silently reverting a shipped fix.
 */
export function isCountHintEnabled(): boolean {
  return process.env.ENGINE_COUNT_HINT !== "false";
}

/** The count the measurement used. Also what a hooks run produces by default, so nothing changes. */
const HINT = 5;

/**
 * Any quantity already in the ask. Broad on purpose: the hint exists to supply evidence of intent
 * that is MISSING, and adding a second number to an ask that has one can only confuse it.
 */
const COUNT_PRESENT =
  /\b(\d+|a few|some|several|a couple|couple|one|two|three|four|five|six|seven|eight|nine|ten|dozen)\b/i;

/**
 * PLURAL artefact nouns only. A singular artefact takes no count — "write a 5 script" is not a
 * sentence, and a script run produces one script whatever the ask says. Kept local rather than
 * imported from the pre-router for the same reason `repeat-ask.ts` keeps `TOOL_TO_SKILL` local:
 * this is a read of the creator's WORDS, and a change to the router's nouns should not silently
 * start rewriting asks.
 */
const PLURAL_ARTEFACT = /\b(hooks|openers|opening lines|ideas|angles|concepts|scripts|outlines)\b/i;

/**
 * Give the model the evidence of intent a count carries — or return the ask untouched.
 *
 * @param rawAsk The creator's typed message.
 * @returns the text to assemble into the BUNDLE. Never what the creator sees.
 *
 * Untouched unless the ask reads as a generation request (`guessSkill`, which carries the question
 * and other-tool guards) AND names a plural artefact AND carries no quantity already.
 */
export function addCountHint(rawAsk: string): string {
  if (!guessSkill(rawAsk)) return rawAsk;
  if (COUNT_PRESENT.test(rawAsk)) return rawAsk;

  // The LAST plural artefact, not the first: the pre-router's own "into" rule says the destination
  // is what gets made ("turn the best idea into hooks"), and the destination is what trails.
  let match: RegExpExecArray | null = null;
  const scan = new RegExp(PLURAL_ARTEFACT.source, "gi");
  for (let m = scan.exec(rawAsk); m !== null; m = scan.exec(rawAsk)) match = m;
  if (!match) return rawAsk;

  return `${rawAsk.slice(0, match.index)}${HINT} ${rawAsk.slice(match.index)}`;
}
