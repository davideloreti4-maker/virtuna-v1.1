"use client";

/**
 * IdeaCard — a pre-tested idea. Type pill (Carousel/Reel) + "pre-tested" tag, the
 * title, and the inline CardReaction (Seam 1). The whole card is a door: tap → opens
 * the Room anchored on this card.
 *
 * Title-forward (2026-07-05 elevation): an idea is a concept, not a made video, so the
 * old fake video-thumbnail was dropped — the type pill already carries the format, and
 * the outliers below (real videos) keep the cover-forward treatment. Depth via .elev-lift.
 */

import { useMemo } from "react";
import type { LiveIdeaCard } from "@/lib/surfaces/live-cards";
import { personasToCardFace } from "@/lib/surfaces/live-cards";
import type { CardReaction as CardReactionData } from "@/lib/room-contract/types";
import { CardReaction } from "../card-reaction";
import { SurfaceIcon } from "../icons";
import { ProofLine } from "@/components/thread/proof-receipt";
import { cn } from "@/lib/utils";

export function IdeaCard({
  idea,
  focused,
  onOpen,
}: {
  idea: LiveIdeaCard;
  focused?: boolean;
  onOpen: (cardId: string) => void;
}) {
  // The glance-tier face — derived from the REAL per-audience personas (honesty spine).
  const reaction = useMemo<CardReactionData>(() => {
    const face = personasToCardFace(idea.personas);
    return { cardId: idea.contentId, tone: face.tone, stop: face.stop, lead: face.lead };
  }, [idea.personas, idea.contentId]);

  return (
    <button
      type="button"
      onClick={() => onOpen(idea.contentId)}
      className={cn(
        // `min-w-0`: a grid item defaults to `min-width: auto`, so the card could not shrink below
        // its own min-content. That floored it at 513px inside a 358px mobile column and gave the
        // page a horizontal scroll — and it starved CardReaction's `truncate` of any shrink
        // pressure, so the quote never ellipsized. Without this the `w-full` above is a lie.
        "elev-lift group w-full min-w-0 rounded-xl border border-border bg-surface-elevated p-3.5 text-left",
        "hover:border-border-hover hover:bg-white/[0.02]",
        focused && "border-accent",
      )}
    >
      <div className="mb-[11px] flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-[color:var(--color-surface-thread)] px-[9px] py-1 text-[11px] text-foreground-secondary">
          <SurfaceIcon name={idea.type === "Carousel" ? "layers" : "film"} size={12} strokeWidth={1.6} className="text-foreground-muted" />
          {idea.type}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[8.5px] tracking-[0.05em]" style={{ color: "var(--color-positive)" }}>
          <SurfaceIcon name="sparkle" size={10} strokeWidth={1.7} />
          pre-tested
        </span>
      </div>
      <div className="text-[14px] font-medium leading-[1.42] text-foreground">{idea.title}</div>
      {/* GROUNDING (§11f): a compact "grounded in a real winner" cue — rendered only when the
          pipeline attributed this idea to a real source with a nameable handle (honesty spine;
          absent on ungrounded/flag-off runs → the card looks exactly as before). */}
      {idea.proof?.handle && <ProofLine proof={idea.proof} className="mt-2" />}
      <div className="mt-3 border-t border-border pt-[11px]">
        <CardReaction reaction={reaction} metric="would watch" />
      </div>
    </button>
  );
}
