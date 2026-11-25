import type { ChatSummary, PieceKind } from "@/lib/library/chat-summary";
import { insideLabel } from "@/lib/library/piece-words";
import type { Posted } from "@/lib/posted/posted";
import { rowLine as postedRowLine, type RowLine as PostedLine } from "@/lib/posted/posted-words";
import { whenLabel } from "@/lib/time-ago";

/**
 * A Library row's words (spec 2026-11-23 §3.1): the quiet line under the title, and the title a
 * chat without one of its own is given. Pure, so the container and the screen read the same.
 */

/** What the line reads of a chat's summary: the endpoint's summary carries more (its link), and
 *  the line needs only what is inside, when it was simulated, and its posted piece. */
export interface RowLineSummary {
  counts: ChatSummary["counts"];
  lead: PieceKind;
  sim: { at: string } | null;
  /** The chat's posted piece (after posting); null or absent for none. */
  posted?: Posted | null;
}

/**
 * A posted chat's line as a phone (and Home's Recent, at every width) draws it, in parts (plan
 * 2026-11-24-after-posting, ruling 30): "Posted 4d ago" · "31K views" and, on its own line, the mark
 * "1.8× your usual" with its tone (`rowLine` of `posted-words`). The time word is the one every row's
 * line uses (`whenLabel`, in the viewer's time zone: rows are drawn in the browser), on the post's own
 * time; none when that time is unknown ("Posted · 31K views").
 */
export function postedLine(posted: Posted): PostedLine {
  return postedRowLine(posted, posted.postedAt === null ? null : whenLabel(posted.postedAt));
}

/**
 * "3 hooks · simulated 2h ago" | "3 hooks · simulated" (a simulation with no usable time) |
 * "Script · 2h ago" (the chat's last message) | "Script" (no time at all) | "Chat · Oct 24".
 * A posted chat, as the table from 768 draws it (its column "After posting" carries the numbers,
 * ruling 30): "3 hooks · posted 4d ago", "Video · posted Nov 12", "3 hooks · posted" (no known post
 * time). The phone's line is `postedLine`.
 */
export function rowLine(summary: RowLineSummary, updatedAt: string): string {
  const inside = insideLabel({ counts: summary.counts, lead: summary.lead });
  if (summary.posted) {
    const { postedAt } = summary.posted;
    const when = postedAt === null ? null : whenLabel(postedAt);
    return when ? `${inside} · posted ${when}` : `${inside} · posted`;
  }
  if (summary.sim) {
    const when = whenLabel(summary.sim.at);
    return when ? `${inside} · simulated ${when}` : `${inside} · simulated`;
  }
  const when = whenLabel(updatedAt);
  return when ? `${inside} · ${when}` : inside;
}

const FALLBACK_TITLE: Record<PieceKind, string> = {
  video: "Video simulation",
  hooks: "Hooks",
  ideas: "Ideas",
  script: "Script",
  remix: "Remix",
  text: "Text simulation",
  chat: "Chat",
};

/** The title of a chat with none of its own (a video brought in and simulated often has none). */
export function fallbackTitle(lead: PieceKind): string {
  return FALLBACK_TITLE[lead];
}
