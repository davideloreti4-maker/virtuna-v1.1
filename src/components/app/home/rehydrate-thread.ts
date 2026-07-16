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
 * The full ordered assistant block stream — every non-user block in message order. This is what the
 * chat view renders for a unified chat-agent thread on reload (via MessageBlocks, which has a renderer
 * per block type), so cards and the co-pilot line appear interleaved exactly as they streamed, instead
 * of being split by type into per-tool buckets.
 */
export function orderedAssistantBlocks(messages: RehydrateMessage[]): RehydrateBlock[] {
  return messages.filter((m) => m.role !== "user").flatMap((m) => m.blocks ?? []);
}
