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
import {
  cardLineOf,
  recordLineOf,
  isRecordedBlock,
  MAX_LINES_PER_RUN,
  MAX_RECORDS,
} from "@/lib/tools/on-screen";

/**
 * Re-exported so the reachability drift test keeps its import path. The maps themselves live in
 * `on-screen.ts` because the LIVE tool result needs the identical describers — the live path being
 * blind while this one could see is the exact split that let the model narrate a pack, and then a
 * verdict, it had never read.
 */
export { RECORDED_BLOCKS, NON_RECORD_BLOCKS } from "@/lib/tools/on-screen";

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
 * The identifying line per card, the caps, and the reason both exist now live in `card-lines.ts`
 * (imported at the top of this file as `cardLineOf` / `MAX_LINES_PER_RUN`).
 *
 * Moved there 2026-08-11 because the LIVE tool result (`chat-agent-loop.ts`) needed the identical
 * extraction and had been shipping without it — so the model could discuss a pack it made last
 * turn but not the one it had just made. Two copies of this map is exactly how that happens again.
 */

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
  let pendingRuns: Array<{ name: string; cards: number; lines: string[] }> = [];
  // Non-generator skill results seen since the last text turn (see SKILL_BLOCK_RECORD). They are
  // flushed as their OWN turn immediately before the next conversational turn, which puts them in
  // the transcript at the moment they actually happened — and, crucially, still emits them when no
  // text turn ever follows (a skill run from the pill persists only its card).
  let pendingRecords: string[] = [];
  // Addresses of remix sheets recorded alongside `pendingRecords` in the SAME loop below — the
  // model's only channel to `blueprintId` + `variant` (phase 5's `revise_remix` tool). Flushed onto
  // the identical turn as the record lines, never as a turn of its own.
  let pendingSheets: Array<{ blueprintId: string; variant: number; hook: string }> = [];
  // The creator's last ask, replayed as the reconstructed tool arguments (the real args were never
  // persisted; this is what the run was actually about).
  let lastUserText = "";

  const flushRecords = () => {
    if (pendingRecords.length === 0) return;
    turns.push({
      role: "assistant",
      text: "",
      skillRecords: pendingRecords.slice(0, MAX_RECORDS),
      ...(pendingSheets.length > 0 ? { remixSheets: pendingSheets } : {}),
    });
    pendingRecords = [];
    pendingSheets = [];
  };

  for (const msg of hydratedMessages) {
    for (const block of msg.blocks) {
      if (isRecordedBlock(block.type) && msg.role === "assistant") {
        // A skill the creator ran in this thread. Not a tool call — a record of what is on screen.
        // `recordLineOf` owns the clip AND the try/catch (a thread predating a field must never
        // take the anchor down with it), so both this path and the live tool result degrade alike.
        const line = recordLineOf(block.type, block.props);
        if (line) pendingRecords.push(line);
        // A remix card ALSO carries an address, when its blueprint row actually persisted. A card
        // whose write failed had its `blueprintId`/`blueprintVariant` stripped by the run route
        // (api/tools/remix/run/route.ts:259-262) — that is a normal card, not an error, and simply
        // contributes no address here.
        if (block.type === "remix-card") {
          const props = (block.props ?? {}) as {
            blueprintId?: unknown;
            blueprintVariant?: unknown;
            adaptedHook?: unknown;
          };
          const blueprintId =
            typeof props.blueprintId === "string" && props.blueprintId.trim() ? props.blueprintId : null;
          const variant =
            typeof props.blueprintVariant === "number" &&
            Number.isInteger(props.blueprintVariant) &&
            props.blueprintVariant >= 0
              ? props.blueprintVariant
              : null;
          if (blueprintId !== null && variant !== null) {
            const hook =
              typeof props.adaptedHook === "string" && props.adaptedHook.trim()
                ? props.adaptedHook.trim().slice(0, 120)
                : "";
            pendingSheets.push({ blueprintId, variant, hook });
          }
        }
        continue;
      }
      const tool = CARD_BLOCK_TOOL[block.type];
      if (tool && msg.role === "assistant") {
        // Cards persist one block per card, in run order — collapse a consecutive same-tool run.
        const open = pendingRuns[pendingRuns.length - 1];
        const run = open && open.name === tool ? open : null;
        if (run) run.cards++;
        else pendingRuns.push({ name: tool, cards: 1, lines: [] });
        const current = run ?? pendingRuns[pendingRuns.length - 1]!;
        // The identifying line, capped in count and length. A card whose line is missing or not a
        // string is simply counted and not quoted — never a placeholder, which would read to the
        // model as a card whose text is literally "undefined". `cardLineOf` owns that rule for
        // both this path and the live one.
        const line =
          current.lines.length < MAX_LINES_PER_RUN ? cardLineOf(block.type, block.props) : null;
        if (line) current.lines.push(line);
        continue;
      }
      if (block.type !== "markdown") continue;
      const props = block.props as { text?: unknown; origin?: unknown };
      if (typeof props.text !== "string") continue;
      const role = msg.role === "assistant" ? "assistant" : "user";
      const dispatched = role === "assistant" && props.origin === "chat-agent" && pendingRuns.length > 0;
      // Records belong BEFORE the turn that follows them — they describe work already on screen.
      flushRecords();
      turns.push({
        role,
        text: props.text,
        // `lines` is OMITTED when nothing was extractable, rather than sent as an empty array: the
        // loop then replays the byte-identical tool result it always did, so a card type with no
        // identifying line (or a pre-existing thread whose props differ) degrades to the old shape
        // instead of announcing an empty card list.
        ...(dispatched
          ? {
              toolRuns: pendingRuns.map(({ lines, ...r }) => ({
                ...r,
                topic: lastUserText,
                ...(lines.length > 0 ? { lines } : {}),
              })),
            }
          : {}),
      });
      pendingRuns = [];
      if (role === "user") lastUserText = props.text;
    }
  }
  // A skill run at the very END of the thread — the commonest shape of all, because the creator
  // taps a skill and then asks about it. Without this flush that run is the one the model cannot see.
  flushRecords();

  return turns.slice(-MAX_PRIOR_TURNS);
}
