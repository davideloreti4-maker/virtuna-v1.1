import { landStyle } from "@/lib/thread-next/landing";
import { leadOf, leadSentence } from "@/lib/thread-next/pack-lead";
import { pickLine } from "@/lib/thread-next/pick-line";

import { packLastLand, type PackRow } from "./pack-answer";

/** The line's type: the measured line's, which the pick shares so the swap moves nothing. */
const LINE = "text-pretty text-ui leading-[22px] text-foreground proportional-nums";

/**
 * The one sentence under a hook or idea pack (spec 2026-11-21 §3 rule 6; drawing
 * `.scratch/next-look/part3/answers/answers.html`, `axLine`): computed from the rows' numbers,
 * "Hook 3 leads by 15 points.", "It's close. Hook 1 is ahead by 7 points." or "It's a tie.", and nothing until every row (of 2 or more)
 * has one (`leadSentence`).
 *
 * Before that, under a pack of hooks, Maven's pick (spec 2026-11-25-maven-pick-design.md §3.1): "Maven
 * would post hook 1." and the writer's plain reason for its first-ranked hook (`pickLine`), until every
 * row is simulated; then the measured line takes the place, also when it names another hook. Ideas
 * have none. In a landing the pick comes in after the card's button and before the chips (the measured
 * line never shows at a landing: its numbers come later).
 *
 * Drawn 15.5 / 22 in the ink: 15 / 22 here (the type roles have no half pixel), in proportional
 * figures like the cards' prose. Its place in the answer (12 under the card, 14 from md) is the
 * turn's gap.
 *
 * Shared by the thread's turn (`thread-turn-next.tsx`) and `/dev/answers`.
 */
export function PackSentence({ kind, rows }: { kind: "hook" | "idea"; rows: readonly PackRow[] }) {
  const pick =
    kind === "hook" ? pickLine(rows.map((r) => ({ rank: r.rank, why: r.why, text: r.text, simulated: r.state.kind === "done" }))) : null;
  if (pick) {
    return (
      <p data-part="pack-pick" className={`land ${LINE}`} style={landStyle(packLastLand(rows.length) + 1)}>
        {pick}
      </p>
    );
  }
  const sentence = leadSentence(kind, leadOf(rows.map((r) => (r.state.kind === "done" ? r.state.value : null))));
  if (!sentence) return null;
  return <p className={LINE}>{sentence}</p>;
}
