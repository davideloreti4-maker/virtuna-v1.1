import { shownThreadTitle } from "@/components/shell/use-thread-title";
import { measureWords } from "@/lib/library/piece-words";
import type { LibraryChat, LibraryStage } from "@/lib/library/library-page";
import type { Posted } from "@/lib/posted/posted";
import { POSTED_STRINGS, cellWords } from "@/lib/posted/posted-words";
import { resultHref } from "@/lib/result/href";
import { textResultHref } from "@/lib/result/text-result";

import type { ChatRowData, RowPosted } from "./chat-row";
import { fallbackTitle, postedLine, rowLine } from "./row-line";

/**
 * A chat of the Library endpoint as its row (plan 2026-11-23-library): the one
 * mapping Library's list and Home's Recent both draw from. Pure: no React, no request.
 */

/** A chat's title as the headers and Home show one (a cap-long one cut at a word); an untitled
 *  chat that holds something is named for it. */
export function titleOf(chat: LibraryChat): string {
  const title = chat.title?.trim();
  return title ? shownThreadTitle(title) : fallbackTitle(chat.summary.lead);
}

const STAGE_WORD: Record<LibraryStage, ChatRowData["stageWord"]> = {
  draft: "Draft",
  simulated: "Simulated",
  posted: POSTED_STRINGS.stage,
  chat: null,
};

/**
 * A posted piece's part of its row (plan 2026-11-24-after-posting): the phone's line in parts (and
 * Home's), and the desktop column "After posting" (`cellWords`), whose under line carries the usual's
 * tone only when it is the usual.
 */
function rowPostedOf(posted: Posted): RowPosted {
  const cell = cellWords(posted);
  const usual = posted.state === "final" && posted.usual !== null && cell.under !== null ? posted.usual.tone : null;
  const { lead, rest, numbers, mark } = postedLine(posted);
  return { phone: { lead, rest, numbers, mark }, cell: { top: cell.top, under: cell.under, tone: usual } };
}

/** One chat as its row: the endpoint's summary in the screen's words. The gauge is always what Maven
 *  said, posted or not. */
export function rowOf(chat: LibraryChat): ChatRowData {
  const { summary } = chat;
  const { sim } = summary;
  return {
    id: chat.id,
    title: titleOf(chat),
    pinned: chat.pinned,
    line: rowLine(summary, chat.updatedAt),
    lead: summary.lead,
    stageWord: STAGE_WORD[summary.stage],
    frame: summary.frame,
    still: summary.videoPath,
    gauge: sim
      ? {
          number: sim.number,
          describes: `${sim.number}% ${measureWords(sim.measure)}`,
          href: sim.link.type === "video" ? resultHref(sim.link.analysisId) : textResultHref(chat.id, sim.link.key, sim.link.as),
        }
      : null,
    posted: summary.posted ? rowPostedOf(summary.posted) : null,
  };
}
