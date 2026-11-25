"use client";

import { useState } from "react";

import type { EvidenceItem, RunEvidence } from "@/lib/tools/evidence";
import { cn } from "@/lib/utils";

/**
 * The wait (thread feel §4.2; film `.st`, `.ch`, `.ev`). Replaces the waiting row's three dots.
 *
 * - `RunStatus`: one line that says what the run is doing ("Writing hooks"; "Thinking" before the
 *   run is named), with a slow light passing over its words (`.run-words`; still under reduced
 *   motion), and at its right end, in the muted ink, how long such a run takes ("about 20 s", then
 *   "taking longer"). A polite status, so it is read when its words change. Outside a card it is the
 *   answer's text line (15 / 21); inside an outline (`inCard`) it takes the card header's place with
 *   the header's geometry (`CardHeader`: 10 / 2 / 8 around a 21 line, 13 / 540).
 * - `EvidenceRow`: what the run reads, as it sends it. Up to five small covers, overlapping, then the
 *   run's own headline word for word ("Reading 3 real videos matched to this subject"). No handle, no
 *   number, no link: the row says that real videos are being read, the cards say which (rulings 5).
 *   The covers are hidden from a screen reader; a missing or failed picture is a plain tile.
 *
 * Geometry as filmed: covers 16 × 22 at the scale's 4 (filmed 4.5; the radius scale has no half
 * pixel), 4 over the one before, a 1.5 ring in the surface they sit on (the card's inside a card,
 * the thread's outside), 9 to the headline (13 / 18, the secondary ink, two lines at most). In a
 * card the row sits 9 above the first row; under a line alone, 2 further down than the column's gap.
 */

/** `CardHeader`'s row (answer-card.tsx), so a card's header does not move when its words change. */
const IN_CARD = "flex items-center justify-between gap-3 px-0.5 pb-2 pt-2.5 text-meta font-[540] leading-[21px]";
/** The answer's text line. */
const OUTSIDE = "flex items-center justify-between gap-3 text-ui leading-[21px]";

export function RunStatus({ words, note, inCard = false }: { words: string; note?: string | null; inCard?: boolean }) {
  return (
    <div role="status" aria-live="polite" data-part="run-status" className={inCard ? IN_CARD : OUTSIDE}>
      <span className="run-words min-w-0 truncate">{words}</span>
      {note ? <span className="shrink-0 whitespace-nowrap text-meta font-[430] text-foreground-muted tabular-nums">{note}</span> : null}
    </div>
  );
}

/** A row shows at most this many covers: a wall of thumbnails stops saying anything. */
const MAX_COVERS = 5;

/** The items drawn as covers: posts and accounts (a frame of the creator's own video is not read). */
function coversOf(evidence: RunEvidence | null | undefined): EvidenceItem[] {
  return (evidence?.items ?? []).filter((item) => item.kind === "video" || item.kind === "profile").slice(0, MAX_COVERS);
}

function Cover({ src, first, inCard }: { src: string | null; first: boolean; inCard: boolean }) {
  // The address that failed, so a later address is tried again (as `ProofCover`).
  const [failed, setFailed] = useState<string | null>(null);
  const show = !!src && failed !== src;
  return (
    <span
      data-part="evidence-cover"
      className={cn(
        "relative block h-[22px] w-4 shrink-0 overflow-hidden rounded-xs bg-surface-sunken ring-[1.5px]",
        inCard ? "ring-surface" : "ring-background",
        !first && "-ml-1",
      )}
    >
      {show && (
        // eslint-disable-next-line @next/next/no-img-element -- a cover address the run sent (it can expire); next/image has nothing to optimise
        <img src={src} alt="" onError={() => setFailed(src)} className="block size-full object-cover" />
      )}
    </span>
  );
}

export function EvidenceRow({ evidence, inCard = false }: { evidence: RunEvidence | null | undefined; inCard?: boolean }) {
  const covers = coversOf(evidence);
  if (!evidence || covers.length === 0) return null;
  return (
    <div data-part="evidence" className={cn("flex items-center gap-[9px]", inCard ? "px-0.5 pb-[9px]" : "pt-0.5")}>
      <span aria-hidden="true" className="flex shrink-0">
        {covers.map((item, i) => (
          <Cover key={i} src={item.image ?? null} first={i === 0} inCard={inCard} />
        ))}
      </span>
      <span className="line-clamp-2 min-w-0 text-meta leading-[18px] text-foreground-secondary">{evidence.headline}</span>
    </div>
  );
}
