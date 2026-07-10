"use client";

/**
 * OutlierCard — a feed outlier simmed for YOUR people (Seams 1/2, now REAL).
 *
 * Video preview (handle · caption · ↗mult · 👁views — real scraped_videos data), the inline
 * CardReaction DERIVED from the card's real Flash personas (`personasToCardFace` — honest,
 * never fabricated), and a Remix action that launches a thread (Seam 4). Tapping the card body
 * opens the Room anchored on this outlier (its real personas); Remix stops propagation.
 */

import { useMemo, useState } from "react";
import type { LiveOutlierCard } from "@/lib/surfaces/live-cards";
import { personasToCardFace } from "@/lib/surfaces/live-cards";
import type { CardReaction as CardReactionData } from "@/lib/room-contract/types";
import { CardReaction } from "../card-reaction";
import { SurfaceIcon } from "../icons";

export function OutlierCard({
  outlier,
  onOpen,
  onRemix,
}: {
  outlier: LiveOutlierCard;
  onOpen: (cardId: string) => void;
  onRemix: (outlier: LiveOutlierCard) => void;
}) {
  // The glance-tier face — derived from the REAL per-audience personas (honesty spine).
  const reaction = useMemo<CardReactionData>(() => {
    const face = personasToCardFace(outlier.personas);
    return { cardId: outlier.contentId, tone: face.tone, stop: face.stop, lead: face.lead };
  }, [outlier.personas, outlier.contentId]);

  // Real video cover (rehosted → durable). An expired/absent cover falls through to the designed
  // gradient+caption poster (never a broken-image glyph) — same graceful degrade as the feed tile.
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover = Boolean(outlier.coverUrl) && !coverFailed;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(outlier.contentId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(outlier.contentId);
        }
      }}
      className="elev-lift group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-[#1c1b19] hover:border-border-hover"
    >
      <div className="relative flex aspect-[9/16] flex-col bg-[linear-gradient(165deg,#312f2b,#181715)]">
        {showCover && (
          // eslint-disable-next-line @next/next/no-img-element -- rehosted cover; onError → poster
          <img
            src={outlier.coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setCoverFailed(true)}
          />
        )}
        {/* Top scrim so the handle stays legible over a real cover. */}
        {showCover && (
          <div className="absolute inset-x-0 top-0 h-[64px] bg-[linear-gradient(180deg,rgba(0,0,0,0.5),transparent)]" />
        )}
        <div className="relative flex items-center gap-2 p-3">
          <span className="size-[28px] shrink-0 rounded-full border border-white/20 bg-[linear-gradient(135deg,#6a8f7a,#3a4a58)]" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
            {outlier.handle}
          </span>
          <SurfaceIcon name="play" size={14} className="text-white/85" />
        </div>
        {/* Caption poster — only when there's no real cover (echoes the feed tile's poster rule). */}
        {!showCover && (
          <div className="mx-3 my-auto rounded-md bg-[#f4f1ea] px-[11px] py-[9px] text-center font-serif text-[12px] font-bold leading-[1.3] text-[#17150f]">
            {outlier.caption}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-[70px] bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.55))]" />
        <div className="absolute bottom-[10px] left-[11px] flex gap-3 font-mono text-[11px] text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          <span className="inline-flex items-center gap-1">
            <SurfaceIcon name="upright" size={12} strokeWidth={1.8} />
            {outlier.mult}
          </span>
          <span className="inline-flex items-center gap-1">
            <SurfaceIcon name="eye" size={12} strokeWidth={1.6} />
            {outlier.views}
          </span>
        </div>
      </div>
      <div className="p-[11px]">
        <CardReaction reaction={reaction} metric="for your people" hideOpen />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemix(outlier);
          }}
          className="mt-[11px] flex w-full items-center justify-center gap-[7px] rounded-[10px] bg-[color:var(--color-action)] px-3 py-[9px] text-[12px] font-semibold text-[color:var(--color-action-foreground)] transition-colors hover:brightness-105"
        >
          <SurfaceIcon name="sparkle" size={13} strokeWidth={1.7} />
          Remix
        </button>
      </div>
    </div>
  );
}
