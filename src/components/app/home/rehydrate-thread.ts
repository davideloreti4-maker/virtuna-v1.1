/**
 * rehydrate-thread.ts — pure reload helpers for the composer's `loadPersistedBlocks`.
 *
 * Extracted from composer.tsx so the "was this thread produced by chat-as-agent?" decision is a
 * pure, unit-tested function rather than more logic inlined into the 2600-line composer.
 *
 * The reload-fidelity problem: a chat-agent turn (CHAT_AGENT_DISPATCH) runs a skill and its cards
 * persist as the same idea/hook/script blocks any selector run produces — there is NO structural
 * difference between "ideas dispatched from chat" and "ideas run from the selector". So the composer
 * cannot tell, on reload, that a thread belongs to the unified chat view. The chat route stamps the
 * co-pilot closing markdown with `props.origin === "chat-agent"` (server-side, ONLY when the flag is
 * on); this module reads that stamp back. Absent stamp → a normal/selector thread, unchanged reload.
 */

/** A persisted block as it comes back from GET /api/threads/open (props are loosely typed). */
export interface RehydrateBlock {
  type?: string;
  props?: unknown;
}

/** A persisted message row: role + its blocks. */
export interface RehydrateMessage {
  role?: string;
  blocks?: RehydrateBlock[];
}

const CHAT_AGENT_ORIGIN = "chat-agent";

/**
 * True when any ASSISTANT block carries the chat-agent origin marker. The marker is written only by
 * the chat route's flag-on dispatch branch, so it is the flag's shadow on the client: flag-off (and
 * every pre-existing thread) never has it → this returns false → reload behaviour is byte-identical.
 */
export function isChatAgentThread(messages: RehydrateMessage[]): boolean {
  return messages.some(
    (m) =>
      m.role !== "user" &&
      (m.blocks ?? []).some(
        (b) =>
          b.type === "markdown" &&
          (b.props as { origin?: string } | undefined)?.origin === CHAT_AGENT_ORIGIN,
      ),
  );
}

/**
 * The full ordered assistant block stream — every non-user block in message order. Still used by the
 * composer's per-tool bucket split (idea/hook/script/…), where the user's question is surfaced
 * separately and never shown beside the cards, so flattening across turns is harmless there.
 *
 * For the unified chat-agent reload use `orderedTurns` instead: flattening the whole thread into one
 * stream collapses every question but the last and reattaches all answers under it, so a multi-turn
 * chat thread reloads with lost questions and misattributed answers.
 */
export function orderedAssistantBlocks(messages: RehydrateMessage[]): RehydrateBlock[] {
  return messages.filter((m) => m.role !== "user").flatMap((m) => m.blocks ?? []);
}

/** A reconstructed conversation turn: the user's question plus the assistant blocks it produced. */
export interface RehydrateTurn {
  /**
   * The user's question text for this turn, or null for a leading assistant turn with no preceding
   * user message (unusual). Read from the first markdown block of the user message.
   */
  userTurn: string | null;
  /** Assistant/tool blocks produced in this turn, in message order (cards + co-pilot line interleaved). */
  blocks: RehydrateBlock[];
}

/**
 * Group persisted messages into ordered turns — one per user message, carrying every assistant block
 * that followed it up to the next user message (consecutive assistant messages merge into the same
 * turn). This preserves turn boundaries on reload so a multi-turn chat-agent thread rehydrates as
 * [Q1 → its answer/cards] [Q2 → its answer/cards], instead of the single flattened stream
 * `orderedAssistantBlocks` produces (which the chat view rendered under one question — the reload bug).
 */
export function orderedTurns(messages: RehydrateMessage[]): RehydrateTurn[] {
  const turns: RehydrateTurn[] = [];
  let current: RehydrateTurn | null = null;
  for (const m of messages) {
    if (m.role === "user") {
      const props = (m.blocks ?? []).find((b) => b.type === "markdown")?.props as
        | { text?: string }
        | undefined;
      current = { userTurn: typeof props?.text === "string" ? props.text : null, blocks: [] };
      turns.push(current);
    } else {
      if (!current) {
        // A leading assistant block with no preceding user message — open an anonymous turn so its
        // blocks are not dropped (the view renders no user bubble for a null userTurn).
        current = { userTurn: null, blocks: [] };
        turns.push(current);
      }
      current.blocks.push(...(m.blocks ?? []));
    }
  }
  return turns;
}
