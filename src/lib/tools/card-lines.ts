/**
 * card-lines.ts — the one line that IDENTIFIES each card, and the ONE place that decides it.
 *
 * ─── WHY THIS IS ITS OWN MODULE ──────────────────────────────────────────────────────────────
 *
 * The same extraction is needed at two seams that had drifted apart for a week:
 *
 *   · `chat-prior-turns.ts`  — rebuilding a PAST turn's tool result when a thread is replayed.
 *     Added 2026-08-04 because the count alone left the model unable to discuss its own output:
 *     asked "Which of these hooks is strongest?" — a shipped follow-up chip — it answered *"I
 *     don't have the specific hook lines you're referring to in front of me. Paste the 2–3
 *     options you're debating"*, about cards the app had just rendered.
 *
 *   · `chat-agent-loop.ts`   — the LIVE tool result, on the turn the cards are actually made.
 *     This one was never given the lines. Measured consequence, 2/2 walks (2026-08-11): the model
 *     narrated an enumerated pack of 10 and then 5 hooks with ZERO overlap with the cards
 *     rendered beside them. It knows five cards exist, cannot see them, is asked for hooks, and
 *     is told in prose not to restate what it cannot read — so it writes new ones. That is not
 *     misbehaviour; it is the only output available to it.
 *
 * The replayed path being right while the live path was blind is the worst possible split: the
 * model can discuss a pack it made LAST turn and not the one it just made. Keeping the map, the
 * caps and the extraction in one module is what stops a third seam from being added blind.
 *
 * ─── WHY ONE LINE AND NOT THE CARD ───────────────────────────────────────────────────────────
 *
 * The model needs to REFERENCE and COMPARE the cards, not re-render them. Score bands, personas,
 * proof and mechanism stay out: they are on screen already, and every extra field is tokens on
 * every later turn in the thread.
 *
 * ⚠️ Do not read this as licence to hand card lines to a GENERATOR. Handing `cardsOnScreen` to the
 * hooks pipeline under "do not reproduce these" made it reproduce them, one verbatim in ten
 * (session 8 §12.1, removed in `8e27709a`). The consumer here is the NARRATOR, whose job is to
 * talk about lines that already exist — the opposite job, with the opposite failure mode.
 *
 * Pure, no I/O. Deterministic.
 */

/**
 * Server flag for the LIVE half — the replay path has carried these lines since 2026-08-04 and is
 * NOT gated. Dark until the A/B says which way it moves the closing line.
 *
 * The measured risk is specific and it is not "the model says too much": handing card lines to the
 * GENERATOR under a do-not-reproduce instruction made it reproduce them (§12.1). The narrator is a
 * different consumer, but the arm has to be run rather than argued.
 *
 * Server-side (no `NEXT_PUBLIC_`): nothing about it reaches the client.
 */
export function isChatCardsOnScreenEnabled(): boolean {
  return process.env.ENGINE_CHAT_CARDS_ON_SCREEN === "true";
}

/**
 * The identifying line per card type — what the creator is actually looking at.
 *
 * Deliberately limited to what a GENERATOR emits. A `corpus-references` citation, a `run-header`
 * or an `input-request` field is not a card the creator can be pointed at.
 */
export const CARD_LINE: Record<string, (props: Record<string, unknown>) => unknown> = {
  "idea-card": (p) => p.title,
  "hook-card": (p) => p.hookLine,
  "script-card": (p) => p.title,
};

/** Per-run caps on the quoted lines — a reference, never a transcript of the whole pack. */
export const MAX_LINES_PER_RUN = 6;
export const MAX_LINE_LENGTH = 200;

/**
 * The identifying line of ONE card block, or null.
 *
 * Null — never a placeholder — when the card carries no line, or carries a non-string. A
 * placeholder would read to the model as a card whose text is literally "undefined", and a thread
 * predating a field must degrade to "counted, not quoted" rather than announcing a phantom card.
 */
export function cardLineOf(blockType: string, props: unknown): string | null {
  const read = CARD_LINE[blockType];
  if (!read) return null;
  const raw = read((props ?? {}) as Record<string, unknown>);
  if (typeof raw !== "string") return null;
  const line = raw.trim();
  return line ? line.slice(0, MAX_LINE_LENGTH) : null;
}

/**
 * The identifying lines of one run's blocks, in card order, capped in count and length.
 *
 * Returns an EMPTY array when nothing is extractable, and both callers treat that as "omit the
 * field entirely" rather than sending `[]` — an empty card list is a claim, and the wrong one.
 */
export function extractCardLines(blocks: readonly unknown[]): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    if (lines.length >= MAX_LINES_PER_RUN) break;
    const b = block as { type?: unknown; props?: unknown };
    if (typeof b?.type !== "string") continue;
    const line = cardLineOf(b.type, b.props);
    if (line) lines.push(line);
  }
  return lines;
}
