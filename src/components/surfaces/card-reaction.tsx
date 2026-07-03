"use client";

/**
 * CardReaction — STUB of the shared inline verdict chip (Seam 1, THE-CONTRACT.md §3).
 *
 * The "Glance" tier: every card wears the room's verdict inline — dot + one blended
 * `stop`/10 + a lead quote in a Person's voice + an open affordance. Identical on a
 * thread card, feed tile, calendar slot, saved card, briefing item. Tapping the host
 * card opens The Room anchored on `cardId` (the host wires the tap; this is display-only).
 *
 * ⚠️ STUB: The Room owns the REAL shared component. This renders the contract shape so
 * the Surfaces build fully around it; swap stub → real at the graft (a swap, not a rebuild).
 */

import { ChevronRight } from "lucide-react";
import type { CardReaction as CardReactionData } from "@/lib/room-contract/types";
import { toneDot } from "./tone";
import { cn } from "@/lib/utils";

export interface CardReactionProps {
  reaction: CardReactionData;
  /** Metric suffix after the number → "7/10 would watch". Omit for the bare "7/10". */
  metric?: string;
  /** Hide the trailing chevron (e.g. inside a footer that already signals openness). */
  hideOpen?: boolean;
  className?: string;
}

export function CardReaction({ reaction, metric, hideOpen, className }: CardReactionProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-[7px] text-[11px] text-foreground-muted",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ background: toneDot[reaction.tone] }}
      />
      <b className="whitespace-nowrap font-semibold text-foreground">
        {reaction.stop}/10{metric ? ` ${metric}` : ""}
      </b>
      <span className="min-w-0 truncate text-foreground-muted">
        · “{reaction.lead}”
      </span>
      {!hideOpen && (
        <ChevronRight
          aria-hidden
          className="ml-auto size-[13px] shrink-0 text-[color:var(--color-foreground-muted)] opacity-70"
        />
      )}
    </div>
  );
}
