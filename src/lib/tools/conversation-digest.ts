/**
 * conversation-digest.ts — what the creator has said this session, as DATA for the generators.
 *
 * THE GAP THIS CLOSES. A generator pipeline (runHooksPipeline / runIdeasPipeline /
 * runScriptPipeline) is called with `ask`, `anchor`, `cards`, the profile and the audience.
 * There is no conversation in that list, and `assembleBundle` was never handed prior turns for a
 * generation mode. So twenty turns of conversation reached the actual generating model ONLY
 * insofar as the chat agent compressed them into the one `topic` string it wrote into the tool
 * call. That is why "given everything I've told you, what angle should I lead with?" works — the
 * chat agent has the turns as real role messages — while the hooks it then generates can feel
 * like they forgot the conversation.
 *
 * ─── Three design rules, each of them measured rather than assumed ───────────────────────────
 *
 * 1. IT IS DATA, NOT AN ARGUMENT THE MODEL WRITES. Session 6 built the opposite and measured it
 *    failing: the `cards` slot was added to the generator tool schemas so a typed "rewrite these"
 *    could carry the pack, and the model never reached for it — a typed rewrite produced no
 *    dispatch at all, flag on or off. B2's measured 7% → 75% subject retention came entirely from
 *    the chip path, where the CLIENT supplies the pack as data. Ground rule of this lane:
 *    structure beats prompt text.
 *
 * 2. THE CREATOR'S OWN WORDS ONLY — never the assistant's prose. chat-prior-turns.ts documents
 *    the defect the whole subsystem exists to fix: the model saw its own sentence "Five hooks are
 *    on screen." with no visible cause and, asked for hooks again, "did the only thing that
 *    transcript supports: reproduced the sentence and called nothing." Replaying assistant prose
 *    into a GENERATOR bundle would import that failure into a second place. The creator's words
 *    are also where the durable signal actually lives — the stated constraints ("under 30s",
 *    "not the 5am angle", "handheld, no b-roll") that a `topic` string cannot carry.
 *
 * 3. NEWEST WINS, BUT ORDER IS OLDEST-FIRST. The budget is spent from the most recent turn
 *    backwards (recency is what a creator means by "this conversation"), and what survives is
 *    then emitted in chronological order, because a transcript reads that way.
 *
 *    ⚠️ An earlier version of this comment also justified the ordering as "the property the prefix
 *    cache needs". That argument was measured and does NOT hold — cache hits here are quantised to
 *    256-token blocks and the whole digest is smaller than one block, so its placement and ordering
 *    cannot move the number wherever they sit (session 7 §1.3; assembleBundle's header records the
 *    retraction and the two probe designs that failed before it was clear). Chronology stands on
 *    readability alone. Do not re-derive a caching argument from it.
 *
 * ─── 🔴 WHY THERE IS NO `cardsOnScreen` (removed 2026-08-10, session 8) ──────────────────────
 *
 * The digest used to carry the last run's card lines under the instruction *"do NOT reproduce,
 * rephrase or re-deliver these; make something new that does not overlap them"*. Measured, it
 * did the opposite:
 *
 *   arm            constraint violations   grounded w/ proof   copied a card
 *   corpus only              5/10                 4/10              0/10
 *   digest + cardsOnScreen   2/10                 0/10              3/10   ← 1 VERBATIM
 *   digest, turns only       1/10                 3/10              0/10
 *
 * One hook came back word for word off the do-not-reproduce list. This is rule 2 again, from the
 * other side: putting lines in the prompt makes them likelier to be emitted, and a sentence
 * telling the model not to does not reverse it. A negative instruction is not a filter.
 *
 * It also cost more than it looked. `cardsOnScreen` sat OUTSIDE CONVERSATION_CHAR_BUDGET (6 lines
 * x 120 chars), so the emitted block reached 1,844 chars against a documented 700 — enough to push
 * a calibrated-audience bundle over BUNDLE_CHAR_CAP and silently evict the corpus (measured live
 * through /api/tools/chat: 838 + 2,779 = 6,183 > 6,000). Turns-only measures 5,210/6,000 and
 * nothing sheds.
 *
 * Removing it also retires the `cards`/`cardsOnScreen` mutual-exclusion contract that had to be
 * enforced in two places, because the contradiction it guarded can no longer be constructed.
 *
 * Evidence: `docs/HANDOFF-2026-08-10-session-8-live-verification.md` §12.
 *
 * Pure, no I/O, no LLM. Deterministic — the same turns always yield the same digest.
 */

import { CONVERSATION_CHAR_BUDGET, CONVERSATION_BLOCK_OVERHEAD } from "@/lib/kc/assembler";
import type { ChatAgentPriorTurn } from "@/lib/tools/chat-agent-loop";

/**
 * Server flag — the digest ships dark until it has been A/B measured live.
 *
 * Server-side on purpose (no `NEXT_PUBLIC_`): nothing about the digest reaches the client, so
 * flipping it does not need a redeploy to take effect the way the Stage B client half does.
 */
export function isConversationDigestEnabled(): boolean {
  return process.env.ENGINE_GEN_CONVERSATION === "true";
}

/**
 * How many creator turns can ride. Six is a session, not a transcript: past that the marginal
 * turn is almost always restating something already carried, while every extra line costs budget
 * on EVERY later generation in the thread.
 */
export const MAX_DIGEST_TURNS = 6;

/** Per-line cap. Long enough for a real constraint, short enough that one rant cannot eat the budget. */
const MAX_TURN_LENGTH = 160;

export interface ConversationDigest {
  turns?: string[];
}

/** Collapse whitespace and clip — a pasted multi-line block must not become six digest lines. */
function normalise(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/**
 * 🔴 THE CURRENT TURN IS NOT IN `priorTurns` (fixed 2026-08-11, session 9).
 *
 * `/api/tools/chat` loads the thread's prior turns at step (6) and persists the message being
 * answered at step (7), so the turns the loop replays are strictly the ones BEFORE this one. Built
 * from those alone the digest had the two failure modes this whole module exists to prevent:
 *
 *   · *"give me hooks, but keep them under 30s"* — the constraint is in the current turn, so it
 *     reached the generator only insofar as the chat agent chose to fold it into `topic`. That is
 *     precisely the compression the digest was built to stop relying on;
 *   · on a thread's FIRST generating turn there are no prior turns at all, so the builder returned
 *     null and the flag was a total no-op — the case where the creator has seen the product do
 *     nothing yet.
 *
 * The turn is appended as the NEWEST creator turn, which also means the budget (spent newest-first)
 * buys it before anything older. Its content is the creator's raw message — never the assembled
 * bundle the loop sends as `ask`.
 */
function withCurrentTurn(
  priorTurns: ChatAgentPriorTurn[],
  currentAsk: string | undefined,
): ChatAgentPriorTurn[] {
  const text = currentAsk?.trim();
  if (!text) return priorTurns;
  // Order-independence, not a courtesy to a creator who repeats themselves. If a caller ever does
  // hand over a `priorTurns` that ALREADY ends with this turn — the route persisting before it
  // loads, which is one line's difference from today — carrying it twice would spend the newest,
  // most valuable end of the budget printing one sentence to the model twice.
  const newest = priorTurns[priorTurns.length - 1];
  if (newest?.role === "user" && newest.text.trim() === text) return priorTurns;
  return [...priorTurns, { role: "user", text }];
}

/**
 * Build the digest from the turns the chat agent is already replaying, plus the one it is not.
 *
 * @param priorTurns  Oldest→newest, as `openChatPriorTurns` produced them — the turns BEFORE this
 *                    one. The message being answered is not among them; see `withCurrentTurn`.
 * @param currentAsk  The creator's RAW message this turn. ⚠️ Not the loop's `ask`, which is the
 *                    assembled bundle — passing that would clip the bundle header into the digest.
 * @returns A digest, or null when there is nothing worth sending (byte-identical no-op).
 */
export function buildConversationDigest(
  priorTurns: ChatAgentPriorTurn[],
  currentAsk?: string,
): ConversationDigest | null {
  const sourceTurns = withCurrentTurn(priorTurns, currentAsk);
  // ── Creator turns: newest-first while spending the budget, then re-ordered oldest-first ──
  //
  // The budget is on the emitted BLOCK, not on the raw turn text, so the fixed cost of the block
  // is charged UP FRONT and each line is charged with its numbering. Spending it on text alone was
  // the 2026-08-10 defect: 640 chars of text — comfortably "legal" against 700 — emitted a
  // ~960-char block, and that difference was enough to push the worst realistic bundle over
  // BUNDLE_CHAR_CAP and shed the entire corpus. Exactly the failure removing `cardsOnScreen` was
  // meant to end, surviving in the half nobody re-measured.
  const turns: string[] = [];
  let spent = CONVERSATION_BLOCK_OVERHEAD;
  for (let i = sourceTurns.length - 1; i >= 0 && turns.length < MAX_DIGEST_TURNS; i--) {
    const turn = sourceTurns[i]!;
    if (turn.role !== "user") continue;
    const line = normalise(turn.text, MAX_TURN_LENGTH);
    // An empty-text turn is real: `openChatPriorTurns` emits one to carry `skillRecords`.
    if (!line) continue;
    // `${n}. ${line}\n` — the numbering the assembler adds. Two digits + ". " + the join newline.
    const cost = line.length + 5;
    if (spent + cost > CONVERSATION_CHAR_BUDGET) break;
    spent += cost;
    turns.push(line);
  }
  turns.reverse();

  if (turns.length === 0) return null;
  return { turns };
}
