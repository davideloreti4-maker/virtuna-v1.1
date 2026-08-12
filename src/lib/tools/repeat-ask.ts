/**
 * repeat-ask.ts — the creator asked for the same thing twice, so run it again.
 *
 * THE DEFECT (measured live, session 6, reproducible). In a thread that already held a hooks pack
 * about "morning focus", the ask *"write me 5 hooks about morning focus"* produced
 * `meta → predispatch → done` in 3.5s — no dispatch, no cards — with the answer *"Here are 5
 * hooks for 'morning focus' tailored to your comedy storytelling niche…"*. The identical ask on a
 * fresh topic dispatched normally and produced 5 real cards in 19.7s.
 *
 * The model treated a repeat ask as already satisfied and then narrated delivery. It ran nothing
 * and claimed hooks. That is the honesty spine breaking, and — importantly — it is caused by
 * context, not by a missing one: the transcript replay is working exactly as designed, and the
 * model is drawing the wrong conclusion from it.
 *
 * WHY NOT A PROMPT CLAUSE. The loop's directive already says, in the strongest words available,
 * "NEVER tell the creator a card is 'on screen', 'generated', or 'ready' … UNLESS you actually
 * called the tool THIS turn". It is being ignored, in the presence of a transcript that shows the
 * pack existing. Precedent beats instruction — the same finding chat-prior-turns.ts records, and
 * the same reason B1/B2 carry their data as riders rather than asking the model to copy lines.
 * So this is structure: detect the shape, pin the tool, let the existing round-1 pin do the rest.
 *
 * ─── THE TRIGGER, AND WHY IT IS THREE CONDITIONS AND NOT TWO ─────────────────────────────────
 *
 * The obvious trigger — "the pre-router guessed a skill AND the thread already ran that skill" —
 * is wrong, and wrong in the worst direction. Re-running the 82-real-ask probe shows the
 * pre-router's ONE harmful case is:
 *
 *     FALSE ALARM   want null   got hooks
 *     "Yes, run the simulate tool on that hook — I want the reaction card."
 *
 * It guesses `hooks` because the word "hook" is in it — and it says "that hook", so it
 * necessarily occurs in a thread that already has a hooks run. That trigger would make the single
 * measured false alarm MORE likely to fire, converting it into a forced, billed, WRONG paid run.
 *
 * So the third condition is the defect itself rather than a proxy for it: the ask must be a near
 * DUPLICATE of what that earlier run was actually about. The false alarm shares almost no
 * vocabulary with "write me 5 hooks about morning focus" and dies on it.
 *
 * Pure, no I/O, no LLM. Deterministic.
 */

import { guessSkill, type PreRouteGuess } from "@/lib/tools/pre-router";
import type { ChatAgentPriorTurn } from "@/lib/tools/chat-agent-loop";

/**
 * Server flag — ships dark. Server-side (no `NEXT_PUBLIC_`): the decision is made in the route
 * and reaches the client only as behaviour, so flipping it needs no redeploy.
 */
export function isRepeatAskPinEnabled(): boolean {
  return process.env.ENGINE_REPEAT_ASK_PIN === "true";
}

/**
 * Generator tool name → the pre-router's skill key. The INVERSE of the registry's `skillKey`,
 * kept local for the same reason chat-prior-turns.ts keeps `CARD_BLOCK_TOOL` local: this module
 * must not depend on the live registry to read a replayed transcript, and a name it does not
 * recognise must simply not match rather than throw.
 */
const TOOL_TO_SKILL: Record<string, PreRouteGuess> = {
  generate_ideas: "ideas",
  generate_hooks: "hooks",
  write_script: "script",
};

/**
 * Words carrying no subject. Stripped before comparison so the phrasing a creator varies between
 * two asks for the same thing ("give me" / "write me", "about" / "on", "another"/"more") does not
 * count as a difference. Deliberately short: every word removed makes two DIFFERENT asks look
 * more alike, so this list stops at function words and the request verbs themselves.
 */
const STOP_WORDS = new Set([
  "a", "an", "the", "some", "more", "another", "again", "please", "can", "could", "would", "you",
  "i", "me", "my", "we", "us", "give", "gimme", "write", "make", "create", "generate", "draft",
  "get", "want", "need", "for", "about", "on", "of", "to", "in", "with", "and", "or", "that",
  "this", "these", "those", "it", "is", "are", "do", "does", "just", "now", "new", "other",
]);

/**
 * Ask → comparable token set. Lowercased, punctuation dropped, stop-words removed, and a naive
 * trailing-"s" strip so "hook" and "hooks" are the same token (the commonest way two asks for one
 * thing differ). Short tokens are kept — a "5" in "5 hooks" is real signal.
 */
function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0 && !STOP_WORDS.has(t))
      .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t)),
  );
}

/**
 * Jaccard similarity of two asks: |A ∩ B| / |A ∪ B|. Set overlap rather than sequence distance,
 * because word ORDER is exactly what varies between two asks for the same thing — "give me 5 more
 * hooks on morning focus" and "write me 5 hooks about morning focus" describe one request.
 *
 * Exported for the tuning probe.
 */
export function askSimilarity(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return shared / (A.size + B.size - shared);
}

/**
 * How alike two asks must be to count as the same request.
 *
 * MEASURED, not guessed — `.scratch/probe-repeat-ask.ts`, over the app's own real asks. Scoring
 * every same-skill pair the detector could actually reach (151 of them) against a set of hand-
 * labelled genuine re-asks:
 *
 *   genuine re-asks bottom out at   0.75   ("hooks about morning focus again")
 *   same-skill cross pairs top out at 0.67
 *   → any threshold in (0.67, 0.75] separates them. 0.7 is the midpoint.
 *
 * The 0.67 pair is a judgement call worth recording, because a future re-tune will hit it again:
 * *"give me 5 hooks for my student budgeting app"* vs *"i launched a budgeting app for students.
 * give me hooks for it"* is arguably the SAME request, so 0.7 is the conservative reading of it,
 * not a clean separation of two obviously different things.
 *
 * THE ASYMMETRY THAT DECIDES THE ROUNDING. A miss costs nothing — the turn behaves exactly as it
 * does today, and the model dispatches correctly on its own whenever the subject is fresh. A
 * false pin spends a credit on a run the creator did not quite ask for. So when in doubt, do not
 * pin: this threshold rounds UP.
 *
 * ⚠️ The probe's first version reported "no clear air" (cross topping out at 0.75) because it
 * compared EVERY pair, including hooks-vs-ideas asks about one topic. `detectRepeatAsk` requires
 * the prior run's skill to match the guess, so those can never pin — the probe was measuring a
 * boundary the code does not have. Keep the same-skill filter if you re-tune.
 */
export const REPEAT_ASK_THRESHOLD = 0.7;

/**
 * Should this turn's round-1 tool call be PINNED to a generator?
 *
 * @param rawAsk      The creator's typed message — NOT the assembled bundle.
 * @param priorTurns  The replayed thread, as `openChatPriorTurns` produced it.
 * @returns the pre-router skill key to pin (`SkillTool.skillKey`), or null to leave the turn alone.
 *
 * Returns null for anything that is not the measured defect, which is most turns:
 *   · a first ask (no prior run) — so "too vague → push back ONCE" is untouched;
 *   · a question about existing work — the pre-router's own QUESTION_OPENER guard;
 *   · an ask about a DIFFERENT subject — the model dispatches those correctly on its own;
 *   · an ask naming a different skill — it fails the duplicate check.
 */
export function detectRepeatAsk(
  rawAsk: string,
  priorTurns: ChatAgentPriorTurn[],
): PreRouteGuess | null {
  // (1) It has to read as a request for an artefact at all.
  const guess = guessSkill(rawAsk);
  if (!guess) return null;

  // (2) + (3) The thread must already hold a run OF THAT SKILL whose own subject this ask
  //     repeats. Walk newest-first: the most recent matching run is the one "again" means.
  for (let i = priorTurns.length - 1; i >= 0; i--) {
    for (const run of priorTurns[i]!.toolRuns ?? []) {
      if (TOOL_TO_SKILL[run.name] !== guess) continue;
      if (askSimilarity(rawAsk, run.topic ?? "") >= REPEAT_ASK_THRESHOLD) return guess;
    }
  }
  return null;
}
