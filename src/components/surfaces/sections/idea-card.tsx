"use client";

/**
 * IdeaCard — a pre-tested idea. Type pill (Carousel/Reel) + "pre-tested" tag, the
 * title, a thumbnail, and the inline CardReaction (Seam 1). The whole card is a door:
 * tap → opens the Room anchored on this card.
 */

import type { IdeaCard as IdeaCardData } from "@/lib/room-contract/mock-room";
import { CardReaction } from "../card-reaction";
import { SurfaceIcon } from "../icons";
import { cn } from "@/lib/utils";

export function IdeaCard({
  idea,
  focused,
  onOpen,
}: {
  idea: IdeaCardData;
  focused?: boolean;
  onOpen: (cardId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(idea.cardId)}
      className={cn(
        "group w-full rounded-xl border border-border bg-surface-elevated p-3.5 text-left transition-all duration-150",
        "hover:-translate-y-px hover:border-border-hover hover:shadow-[0_8px_22px_rgba(0,0,0,0.28)]",
        focused && "border-accent shadow-[0_0_0_1px_var(--color-accent-soft)]",
      )}
    >
      <div className="mb-[11px] flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[color:var(--color-surface-thread)] px-[9px] py-1 text-[11px] text-foreground-secondary">
          <SurfaceIcon name={idea.type === "Carousel" ? "layers" : "film"} size={12} strokeWidth={1.6} className="text-foreground-muted" />
          {idea.type}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[8.5px] tracking-[0.05em]" style={{ color: "#8ea68a" }}>
          <SurfaceIcon name="sparkle" size={10} strokeWidth={1.7} />
          pre-tested
        </span>
      </div>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium leading-[1.36] text-foreground">{idea.title}</div>
        </div>
        <div className="relative flex h-20 w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-border bg-[linear-gradient(155deg,#3a3832,#232220)]">
          <span className="absolute left-1.5 top-1.5 text-[11px] text-white/50">
            <SurfaceIcon name={idea.type === "Carousel" ? "layers" : "play"} size={11} strokeWidth={1.6} />
          </span>
          <span className="px-[7px] text-center text-[8px] font-semibold leading-[1.3] text-foreground-secondary opacity-85">
            {idea.thumb}
          </span>
        </div>
      </div>
      <div className="mt-3 border-t border-border pt-[11px]">
        <CardReaction reaction={idea.reaction} metric={idea.metric} />
      </div>
    </button>
  );
}
