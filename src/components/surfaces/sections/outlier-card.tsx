"use client";

/**
 * OutlierCard — a feed outlier scored for YOUR people. Video preview (handle · caption ·
 * ↗mult · 👁views), the inline CardReaction, and a Remix action that launches a thread
 * (Seam 4). Tapping the card body opens the Room; Remix stops propagation.
 */

import type { OutlierCard as OutlierCardData } from "@/lib/room-contract/mock-room";
import { CardReaction } from "../card-reaction";
import { SurfaceIcon } from "../icons";
import { cn } from "@/lib/utils";

export function OutlierCard({
  outlier,
  onOpen,
  onRemix,
}: {
  outlier: OutlierCardData;
  onOpen: (cardId: string) => void;
  onRemix: (outlier: OutlierCardData) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(outlier.cardId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(outlier.cardId);
        }
      }}
      className="elev-lift group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-[#1c1b19] hover:border-border-hover"
    >
      <div
        className={cn(
          "relative flex h-[238px] flex-col",
          outlier.light
            ? "bg-[linear-gradient(165deg,#54524b,#20303f)]"
            : "bg-[linear-gradient(165deg,#312f2b,#181715)]",
        )}
      >
        <div className="flex items-center gap-2 p-[11px]">
          <span className="size-[26px] shrink-0 rounded-full border border-white/20 bg-[linear-gradient(135deg,#6a8f7a,#3a4a58)]" />
          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white">
            {outlier.handle}
          </span>
          <SurfaceIcon name="play" size={13} className="text-white/85" />
        </div>
        <div className="mx-3 my-auto rounded-md bg-[#f4f1ea] px-[9px] py-[7px] text-center font-serif text-[10px] font-bold leading-[1.28] text-[#17150f]">
          {outlier.caption}
        </div>
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
        <CardReaction reaction={outlier.reaction} metric={outlier.metric} hideOpen />
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
