/**
 * chat-prior-turns.ts — the open-chat context anchor, with each past skill run attached to the turn
 * that announced it.
 *
 * THE DEFECT THIS EXISTS TO FIX. A dispatching chat turn persists as two-or-three message rows: the
 * cards, then the model's closing line stamped `origin:"chat-agent"`. Only `markdown` crossed into
 * the anchor, so what the model saw of its own best turn was the bare sentence "Five hooks are on
 * screen." — a claim with no visible cause anywhere in the transcript. Asked for hooks again in that
 * same thread, it did the only thing that transcript supports: reproduced the sentence and called
 * nothing. Zero cards, under a UI insisting five were on screen (confirmed live 2026-08-04).
 *
 * The sentence was the only precedent the model had, and precedent beats instruction — a prompt
 * clause was tried and failed (1/3 on the target, and it destabilised sibling chips). So the runs
 * travel with the turn instead, and `chat-agent-loop.ts` replays them as the tool-call exchange they
 * actually were.
 *
 * Lives here rather than in the route because a Next.js `route.ts` may only export HTTP methods —
 * and because this is the piece worth testing directly.
 */

import type { HydratedMessage } from "@/lib/threads/messages";
import type { ChatAgentPriorTurn } from "@/lib/tools/chat-agent-loop";

/**
 * Max prior turns to carry as context anchor.
 * D-01a soft context cap: full running context is the default; this bounds the anchor size to avoid
 * excessive token spend on very long threads.
 */
export const MAX_PRIOR_TURNS = 20;

/**
 * Which tool produced a given card — the inverse of the skill registry, used to reconstruct a past
 * turn's tool calls from the cards it left behind. Deliberately limited to what a GENERATOR emits: a
 * `corpus-references` citation or an `input-request` field is not a skill run and must never replay
 * as one. Names match `SkillTool.name` (skill-dispatch.ts); the loop ignores any that is not bound.
 */
const CARD_BLOCK_TOOL: Record<string, string> = {
  "idea-card": "generate_ideas",
  "hook-card": "generate_hooks",
  "script-card": "write_script",
};

/**
 * Hydrated thread messages → the prior turns the chat agent replays, oldest→newest.
 *
 * Cards land in their own assistant row(s) immediately BEFORE the text row that announces them, so
 * walking in order and holding the cards seen since the last text/user row attributes them without a
 * join. `origin:"chat-agent"` is the confirmation, not the signal — the stamp exists for thread
 * rehydration, and is only trusted here alongside cards actually found in the rows just passed.
 *
 * WR-05 INVARIANT (unchanged): exactly ONE `markdown` block per message row, role attributed from
 * `msg.role`, so a conversational "turn" === a message and the `.slice(-MAX_PRIOR_TURNS)` cap counts
 * turns. If multi-block markdown messages are ever introduced, carry the role on the BLOCK before
 * relying on this anchor.
 */
export function openChatPriorTurns(hydratedMessages: HydratedMessage[]): ChatAgentPriorTurn[] {
  const turns: ChatAgentPriorTurn[] = [];
  // Cards seen since the last text turn — the runs the NEXT assistant text turn is announcing.
  let pendingRuns: Array<{ name: string; cards: number }> = [];
  // The creator's last ask, replayed as the reconstructed tool arguments (the real args were never
  // persisted; this is what the run was actually about).
  let lastUserText = "";

  for (const msg of hydratedMessages) {
    for (const block of msg.blocks) {
      const tool = CARD_BLOCK_TOOL[block.type];
      if (tool && msg.role === "assistant") {
        // Cards persist one block per card, in run order — collapse a consecutive same-tool run.
        const open = pendingRuns[pendingRuns.length - 1];
        if (open && open.name === tool) open.cards++;
        else pendingRuns.push({ name: tool, cards: 1 });
        continue;
      }
      if (block.type !== "markdown") continue;
      const props = block.props as { text?: unknown; origin?: unknown };
      if (typeof props.text !== "string") continue;
      const role = msg.role === "assistant" ? "assistant" : "user";
      const dispatched = role === "assistant" && props.origin === "chat-agent" && pendingRuns.length > 0;
      turns.push({
        role,
        text: props.text,
        ...(dispatched ? { toolRuns: pendingRuns.map((r) => ({ ...r, topic: lastUserText })) } : {}),
      });
      pendingRuns = [];
      if (role === "user") lastUserText = props.text;
    }
  }

  return turns.slice(-MAX_PRIOR_TURNS);
}
