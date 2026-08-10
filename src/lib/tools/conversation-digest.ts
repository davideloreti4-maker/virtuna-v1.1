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
 *    then emitted in chronological order — both because a transcript reads that way and because
 *    it is what makes the block append-only across turns, which is the property the prefix cache
 *    needs (see assembleBundle's header doc for why placement follows from this).
 *
 * Pure, no I/O, no LLM. Deterministic — the same turns always yield the same digest.
 */

import { CONVERSATION_CHAR_BUDGET } from "@/lib/kc/assembler";
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

/** Card lines already on screen — a reference, never a re-render. Mirrors MAX_LINES_PER_RUN. */
const MAX_CARD_LINES = 6;
const MAX_CARD_LINE_LENGTH = 120;

export interface ConversationDigest {
  turns?: string[];
  cardsOnScreen?: string[];
}

/** Collapse whitespace and clip — a pasted multi-line block must not become six digest lines. */
function normalise(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/**
 * Build the digest from the turns the chat agent is already replaying.
 *
 * @param priorTurns  Oldest→newest, as `openChatPriorTurns` produced them.
 * @param opts.includeCards  Pass `false` when the run carries a `cards` REWRITE pack. The two
 *   are contradictory instructions over what is usually the same list ("rewrite each of these"
 *   vs "do not reproduce these"), so they are mutually exclusive by contract. The assembler
 *   enforces it as well — belt and braces, because a caller that forgets is otherwise silent.
 * @returns A digest, or null when there is nothing worth sending (byte-identical no-op).
 */
export function buildConversationDigest(
  priorTurns: ChatAgentPriorTurn[],
  opts: { includeCards?: boolean } = {},
): ConversationDigest | null {
  const includeCards = opts.includeCards ?? true;

  // ── Creator turns: newest-first while spending the budget, then re-ordered oldest-first ──
  const turns: string[] = [];
  let spent = 0;
  for (let i = priorTurns.length - 1; i >= 0 && turns.length < MAX_DIGEST_TURNS; i--) {
    const turn = priorTurns[i]!;
    if (turn.role !== "user") continue;
    const line = normalise(turn.text, MAX_TURN_LENGTH);
    // An empty-text turn is real: `openChatPriorTurns` emits one to carry `skillRecords`.
    if (!line) continue;
    if (spent + line.length > CONVERSATION_CHAR_BUDGET) break;
    spent += line.length;
    turns.push(line);
  }
  turns.reverse();

  // ── Cards already on screen: the LAST run's lines only ──
  // The last run is what "these" means to a creator looking at the thread. Carrying every run's
  // lines would both blow the budget on a long thread and tell the model to avoid overlapping
  // with work the creator may well have moved on from.
  let cardsOnScreen: string[] | undefined;
  if (includeCards) {
    for (let i = priorTurns.length - 1; i >= 0 && !cardsOnScreen; i--) {
      const lines = priorTurns[i]!.toolRuns?.flatMap((r) => r.lines ?? []) ?? [];
      if (lines.length > 0) {
        cardsOnScreen = lines
          .slice(0, MAX_CARD_LINES)
          .map((l) => normalise(l, MAX_CARD_LINE_LENGTH))
          .filter(Boolean);
      }
    }
  }

  if (turns.length === 0 && (!cardsOnScreen || cardsOnScreen.length === 0)) return null;
  return {
    ...(turns.length > 0 ? { turns } : {}),
    ...(cardsOnScreen && cardsOnScreen.length > 0 ? { cardsOnScreen } : {}),
  };
}
