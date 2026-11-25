import { leadOf, leadSentence } from "@/lib/thread-next/pack-lead";

import type { PackRow } from "./pack-answer";

/**
 * The one sentence under a hook or idea pack (spec 2026-11-21 §3 rule 6; drawing
 * `.scratch/next-look/part3/answers/answers.html`, `axLine`): computed from the rows' numbers,
 * "Hook 3 leads by 15 points.", "It's close. Hook 1 is ahead by 7 points." or "It's a tie.", and nothing until every row (of 2 or more)
 * has one (`leadSentence`). The app has no source for a reason, so none is written.
 *
 * Drawn 15.5 / 22 in the ink: 15 / 22 here (the type roles have no half pixel), in proportional
 * figures like the cards' prose. Its place in the answer (12 under the card, 14 from md) is the
 * turn's gap.
 *
 * Shared by the thread's turn (`thread-turn-next.tsx`) and `/dev/answers`.
 */
export function PackSentence({ kind, rows }: { kind: "hook" | "idea"; rows: readonly PackRow[] }) {
  const sentence = leadSentence(kind, leadOf(rows.map((r) => (r.state.kind === "done" ? r.state.value : null))));
  if (!sentence) return null;
  return <p className="text-pretty text-ui leading-[22px] text-foreground proportional-nums">{sentence}</p>;
}
