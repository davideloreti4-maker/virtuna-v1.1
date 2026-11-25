"use client";

import type { RunEvidence } from "@/lib/tools/evidence";

import { AnswerCard } from "./answer-card";
import { SourceRowView } from "./remix-answer";
import { EvidenceRow, RunStatus } from "./run-status";

/**
 * The outline (thread feel §4.3; film `ghostRow`, `ghostBeat`): while a run that ends in a card of its
 * own waits, that card is drawn at once with what is known and grey bars for what is not. The line
 * (§4.2) is its header. A slow light passes over the bars (`.ghost-bar`, one sweep in 1.6 s; still
 * under reduced motion). The bars and rings are hidden from a screen reader; what is read is the
 * line, the evidence headline, and a remix's source row once it holds the real post.
 *
 * - A pack (hooks, ideas): the evidence row when the run sent one, then three rows, each a pale ring
 *   where the gauge will be and three bars. No bar where the button will be (§9.3).
 * - A script: the evidence row when the run sent one, then five beats on the time rail, each a short
 *   bar where its name will be (thread depth §3.1) and bars for its words in the film's rhythm
 *   (1, 3, 3, 2, 2).
 * - A remix: the source row (a grey tile and two bars until the post is fetched, then the real cover,
 *   handle and views: `SourceRowView`, the card's own markup), then two bars for the hook. Its one
 *   post is not drawn as the evidence row.
 *
 * Geometry: the bars 11 tall on the text's lines (a hook's 20, a beat's 21, the remix hook's 26),
 * widths as filmed; a beat's name bar 9 tall on the name's 16 line, a fifth of the line wide. A ghost
 * beat is as tall as a named beat of as many lines (35 + 21 a line: the name's 16 and 1 on top of
 * today's 18); the beats' total is within a line of a five-beat script's (the opening's slot
 * against the longer beats). A ghost row is 93 on a phone and 85 from md, against 81 and 67 for a
 * real row of the same hooks at three lines (phone) and two (desk): the real card also brings its
 * button (58 / 70), so a three-row pack of hooks without a proven video changes height by at most 24
 * on landing, with or without the evidence row (which goes): on a phone +22 without it, -23 with a
 * two-line headline (45); on a desk +16, and -15 with a one-line headline (31).
 *
 * A hook with a proven video (thread depth §3.3) is taller by its line: 6 and the 22 of its cover
 * (6 and 18 without one), so +28 (+24) on a phone, and +22 (+18) on a desk, where the line takes the
 * two-line hook's 40 past the 46 gauge. Three such hooks with covers: +106 on a phone and +82 on a
 * desk without the evidence row; with it (a run that cites videos is one that read them, so it
 * normally has one) +61 and +51. The ghost rows do not hold that room: whether a hook has a proven
 * video is not known until it lands, and many rows of a real pack have none, so a ghost row sized
 * for it would make the common landing shrink instead.
 */

/** One bar, on a line of text. */
function Bar({ width, className = "h-[11px]", part }: { width: string; className?: string; part?: string }) {
  return <span aria-hidden="true" data-part={part} className={`ghost-bar block rounded-full ${className}`} style={{ width }} />;
}

const ROW_BARS = ["94%", "86%", "52%"];
const BEAT_BARS = ["96%", "88%", "93%", "58%"];
const BEAT_LINES = [1, 3, 3, 2, 2];

function PackGhosts() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          data-part="ghost-row"
          className="flex min-h-[93px] items-center gap-[13px] border-t border-border px-0.5 py-2.5 md:min-h-[85px]"
        >
          <span className="flex w-[46px] shrink-0 justify-center">
            <span aria-hidden="true" data-part="ghost-ring" className="block size-[46px] rounded-full border-[4.5px] border-gauge-track" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[9px]">
            {ROW_BARS.map((width) => (
              <Bar key={width} width={width} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScriptGhosts() {
  return (
    <div aria-hidden="true">
      {BEAT_LINES.map((lines, i) => (
        // The beat's grid as drawn (28 · 3 · 1fr, 10 apart); the times are not known, so none.
        <div key={i} data-part="ghost-beat" className="grid grid-cols-[28px_3px_minmax(0,1fr)] gap-x-2.5 p-0.5">
          <span />
          <i data-part="rail" className="block rounded-full bg-foreground/13" />
          {/* The beat's text box (6 above, the name's 16 and 1, then 21 a line and 8 under), its bars
              centred on the lines: the name's 9 starts 9 down (9.5 rounded), 10 to the words' first. */}
          <span className="flex min-w-0 flex-col gap-2.5 pb-[13px] pt-[9px]">
            <Bar width="20%" className="h-[9px]" part="ghost-name" />
            {Array.from({ length: lines }, (_, k) => (
              <Bar key={k} width={BEAT_BARS[k % BEAT_BARS.length]!} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

function RemixGhosts({ evidence }: { evidence: RunEvidence | null | undefined }) {
  const post = evidence?.items[0] ?? null;
  return (
    <>
      {post ? (
        <SourceRowView cover={post.image ?? null} handle={post.label ?? null} stats={post.metric ?? null} />
      ) : (
        <div aria-hidden="true" data-part="ghost-source" className="mt-2.5 flex items-center gap-[11px] rounded-xl bg-foreground/5 p-2.5">
          <span aria-hidden="true" data-part="ghost-tile" className="ghost-bar block h-14 w-10 shrink-0 rounded-md" />
          {/* The handle's and the stats' 21 lines. */}
          <span className="flex min-w-0 flex-1 flex-col gap-2.5">
            <Bar width="38%" />
            <Bar width="62%" />
          </span>
        </div>
      )}
      {/* The hook's two 26 lines, 14 above and 4 under, as the headline sits. */}
      <div aria-hidden="true" data-part="ghost-hook" className="flex flex-col gap-3.5 px-0.5 pb-[11px] pt-[21px]">
        <Bar width="92%" className="h-3" />
        <Bar width="64%" className="h-3" />
      </div>
    </>
  );
}

export function AnswerOutline({
  kind,
  words,
  note,
  evidence,
}: {
  kind: "pack" | "script" | "remix";
  words: string;
  note: string | null;
  evidence: RunEvidence | null | undefined;
}) {
  return (
    <div data-outline={kind} className="contents">
      <AnswerCard>
        <RunStatus words={words} note={note} inCard />
        {kind !== "remix" && <EvidenceRow evidence={evidence} inCard />}
        {kind === "pack" ? <PackGhosts /> : kind === "script" ? <ScriptGhosts /> : <RemixGhosts evidence={evidence} />}
      </AnswerCard>
    </div>
  );
}
