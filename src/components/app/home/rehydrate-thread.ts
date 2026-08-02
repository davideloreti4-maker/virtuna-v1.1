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
  /**
   * The `messages.id` row. Already on the wire — loadMessages selects it and GET /api/threads/open
   * returns it verbatim — it was simply not declared here, so every consumer dropped it. It is the
   * finest STABLE id a saved output can point at: block sub-items (an individual idea, hook or
   * script beat) have no persisted id of their own.
   */
  id?: string;
  role?: string;
  blocks?: RehydrateBlock[];
}

/** Where a rendered block came from — the seam that lets a save name its own origin. */
export interface BlockOrigin {
  /** The `messages.id` this block was persisted in. Null while a run is still streaming. */
  messageId: string | null;
  /**
   * The block's index within ITS OWN message body — NOT its position in the merged turn. A turn
   * merges consecutive assistant messages, so the two diverge as soon as a turn spans more than one
   * message, and using the merged position would attribute a save to the wrong row.
   */
  index: number;
}

/**
 * The stable save ref for a block: `${messageId}:${index}`.
 *
 * Message bodies are immutable once written, so this survives reload — unlike the render-time card
 * ids (`idea-0`, `hook-3`) minted from array position in ambient-descriptors.ts. Null when the block
 * is not yet persisted, in which case a save simply carries no ref (today's behaviour).
 */
export function blockRefId(origin: BlockOrigin | null | undefined): string | null {
  if (!origin?.messageId) return null;
  return `${origin.messageId}:${origin.index}`;
}

const CHAT_AGENT_ORIGIN = "chat-agent";

/**
 * True when any ASSISTANT block carries the chat-agent origin marker (the co-pilot text stamped by
 * the flag-on dispatch branch) OR is an `input-request` field (only the chat agent emits one). The
 * marker is the flag's shadow on the client: flag-off (and every pre-existing thread) never has it →
 * this returns false → reload behaviour is byte-identical. The input-request fallback keeps a
 * request_link turn in the chat view even if the model streamed no closing text.
 */
export function isChatAgentThread(messages: RehydrateMessage[]): boolean {
  return messages.some(
    (m) =>
      m.role !== "user" &&
      (m.blocks ?? []).some(
        (b) =>
          (b.type === "markdown" &&
            (b.props as { origin?: string } | undefined)?.origin === CHAT_AGENT_ORIGIN) ||
          b.type === "input-request",
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
  /**
   * Per-block provenance, aligned index-for-index with `blocks`. Additive: `blocks` keeps its exact
   * shape and length, so the ambient ledger's positional card ids stay aligned and every existing
   * consumer is untouched.
   *
   * Optional because a turn assembled by hand — a test fixture, the /dev/cards gallery — genuinely
   * has no origin to report, and inventing one would be worse than omitting it. `orderedTurns`
   * always populates it.
   */
  blockOrigins?: BlockOrigin[];
}

/**
 * Group persisted messages into ordered turns — one per user message, carrying every assistant block
 * that followed it up to the next user message (consecutive assistant messages merge into the same
 * turn). This preserves turn boundaries on reload so a multi-turn chat-agent thread rehydrates as
 * [Q1 → its answer/cards] [Q2 → its answer/cards], instead of the single flattened stream
 * `orderedAssistantBlocks` produces (which the chat view rendered under one question — the reload bug).
 */
export function orderedTurns(messages: RehydrateMessage[]): RehydrateTurn[] {
  // Origins are optional on the public type but ALWAYS built here, so the local shape requires them.
  type BuildingTurn = RehydrateTurn & { blockOrigins: BlockOrigin[] };
  const turns: BuildingTurn[] = [];
  let current: BuildingTurn | null = null;
  for (const m of messages) {
    if (m.role === "user") {
      const props = (m.blocks ?? []).find((b) => b.type === "markdown")?.props as
        | { text?: string }
        | undefined;
      current = {
        userTurn: typeof props?.text === "string" ? props.text : null,
        blocks: [],
        blockOrigins: [],
      };
      turns.push(current);
    } else {
      if (!current) {
        // A leading assistant block with no preceding user message — open an anonymous turn so its
        // blocks are not dropped (the view renders no user bubble for a null userTurn).
        current = { userTurn: null, blocks: [], blockOrigins: [] };
        turns.push(current);
      }
      const blocks = m.blocks ?? [];
      current.blocks.push(...blocks);
      // Index is per-MESSAGE, so it restarts at 0 for each merged message — see BlockOrigin.
      current.blockOrigins.push(
        ...blocks.map((_, index) => ({ messageId: m.id ?? null, index })),
      );
    }
  }
  return turns;
}
