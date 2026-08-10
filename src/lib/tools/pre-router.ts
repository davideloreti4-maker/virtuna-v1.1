/**
 * pre-router.ts — the cheap guess that fills the router's dead zone (Stage B, B3).
 *
 * The agent loop takes ~4.8s to commit to a skill (the first streamed round must finish
 * accumulating a tool_call before `dispatch` fires), and until then the thread shows bare
 * "Thinking…" dots. This module is the zero-cost half of the fix: a bounded heuristic the
 * route runs on the raw ask BEFORE the loop starts, so it can stream an honest
 * `predispatch` frame immediately. The client renders it as a HINT ("looks like a hooks
 * run"), never as a claim — the loop's real `dispatch` frame confirms or replaces it.
 *
 * Deliberately a heuristic, not a tiny LLM call: a wrong guess costs one soft hint line
 * that the real dispatch corrects seconds later, while a pre-flight model call would tax
 * every turn (including plain chat) to sharpen a transient label. Structure of the rules:
 *
 *   1. A QUESTION OPENER disqualifies the whole sentence — "how do my hooks compare" asks
 *      ABOUT work that exists; guessing a run there hints at work that never starts.
 *   2. A GENERATION VERB must appear — an artefact noun alone is a topic, not a request.
 *   3. The first ARTIFACT NOUN by position wins — "write hooks for this script" is a hooks
 *      ask that mentions a script, and the requested artifact is what follows the verb —
 *      EXCEPT after "into", which names a destination ("turn the best idea into a script").
 *
 * Pure, no I/O; unit-tested in __tests__/pre-router.test.ts.
 */

export type PreRouteGuess = "ideas" | "hooks" | "script";

/**
 * Openers that make the sentence a question ABOUT existing work rather than a request to make
 * new work. Checked FIRST because the verb rule alone cannot see it: "what should I write, hooks
 * or a script?" carries a real generation verb and a real artefact noun, and is still a strategy
 * question the creator wants answered, not a run they want started.
 *
 * `can`/`could`/`would`/`will` are deliberately absent — "can you write me hooks" is a polite
 * request, and refusing to guess on it would give up the most common phrasing there is.
 */
const QUESTION_OPENER =
  /^\s*(how|what|which|why|when|who|whose|where|is|are|was|were|does|do|did|should)\b/i;

/**
 * A verb that signals the creator wants something MADE (not discussed).
 *
 * ⚠️ `do` is NOT in this list, and the omission is load-bearing: it matched the "how do my hooks
 * compare" case this module was written to reject (measured — the rule above was documented and
 * the regex contradicted it). The asks it gives up ("do a script for me") fall through to no
 * hint, which is the honest default; the ones it was letting through were false claims.
 */
const GENERATION_VERB =
  /\b(write|make|give|gimme|draft|generate|create|turn|rewrite|redo|punch|sharpen|tighten|need|want)\b/i;

/** Artifact nouns, each mapped to the generator it names. Order irrelevant — position decides. */
const ARTIFACT_NOUNS: Array<{ pattern: RegExp; skill: PreRouteGuess }> = [
  { pattern: /\b(scripts?|outlines?)\b/i, skill: "script" },
  { pattern: /\b(hooks?|openers?|opening lines?)\b/i, skill: "hooks" },
  { pattern: /\b(ideas?|angles?|concepts?)\b/i, skill: "ideas" },
];

/** The earliest artefact noun in a stretch of text, or null when it names none. */
function firstArtefact(text: string): PreRouteGuess | null {
  let best: { skill: PreRouteGuess; index: number } | null = null;
  for (const { pattern, skill } of ARTIFACT_NOUNS) {
    const match = pattern.exec(text);
    if (match && (best === null || match.index < best.index)) {
      best = { skill, index: match.index };
    }
  }
  return best?.skill ?? null;
}

/**
 * Guess which generator a typed ask is heading for, or null when it reads as conversation.
 * Null is the honest default: no hint beats a wrong hint on a strategy question.
 */
export function guessSkill(ask: string): PreRouteGuess | null {
  if (QUESTION_OPENER.test(ask)) return null;
  if (!GENERATION_VERB.test(ask)) return null;
  // "X into Y" names a DESTINATION, and the destination is what gets made — so the plain
  // first-by-position rule reads "turn the best idea into a script" as an ideas run, which is the
  // one thing the creator did not ask for (the idea already exists; that is why it is being
  // turned). The product's own chip copy is phrased this way, so it is not a rare shape.
  const into = /\binto\b/i.exec(ask);
  if (into) {
    const destination = firstArtefact(ask.slice(into.index + into[0].length));
    if (destination) return destination;
  }
  return firstArtefact(ask);
}
