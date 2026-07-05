"use client";

/**
 * RoomDrawer — "tap a card → the Room opens anchored on it" (Seam 1 → Seam 2).
 *
 * A bottom sheet whose body is the actual Room: `<AmbientRoom>` fed the card's REAL Flash
 * personas (`flatPersonas`) — named voices + The people ⇄ Population·1,000 + the weak-spot +
 * the real "ask them why →" persona chat — the SAME Room the video Read embeds, so the start
 * page and a thread read as one product. "Develop / Remix in a thread →" is the Seam 4 handoff.
 *
 * Every /start card (daily-ideas + outliers) now carries a real per-audience reaction, so this
 * is personas-only — the earlier mock-`Read` layout is retired.
 */

import { useEffect } from "react";
import { X } from "lucide-react";
import type { ReactionPersona } from "@/lib/tools/blocks";
import { personasToCardFace } from "@/lib/surfaces/live-cards";
import { AmbientRoom } from "@/components/audience-lens/AmbientRoom";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { SurfaceIcon } from "./icons";

export interface RoomFocus {
  /** The anchored card's id (drives the section's focused-card highlight). */
  cardId?: string;
  title: string;
  kind: "Idea" | "Outlier";
  metric: string;
  /** The card's real per-audience Flash personas → the actual `AmbientRoom`. */
  personas: ReactionPersona[];
  /** The concept the room reacted to (grounds the persona chat) — the outlier caption / idea title. */
  conceptText?: string;
}

export function RoomDrawer({
  focus,
  onClose,
  onDevelop,
  onOpenFull,
}: {
  focus: RoomFocus | null;
  onClose: () => void;
  onDevelop: (focus: RoomFocus) => void;
  onOpenFull: () => void;
}) {
  const open = Boolean(focus);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!focus) return null;
  const { personas, title, kind, metric } = focus;

  // Headline "N of 10 …" + the "N/T stop" the ambient Room's score header parses — both from the
  // real personas (honesty spine), so the sheet header and the opened Room agree.
  const face = personasToCardFace(personas);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close the room"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`The room · ${title}`}
        className="rv-in relative flex max-h-[82vh] w-full max-w-[640px] flex-col rounded-t-[20px] border border-b-0 border-border-hover bg-background shadow-[0_-18px_44px_rgba(0,0,0,0.42)]"
      >
        <div className="flex justify-center pb-0.5 pt-2">
          <span className="h-1 w-[34px] rounded-full bg-white/20" />
        </div>

        <div className="flex items-start justify-between gap-2 px-3 pb-1.5 pr-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-h-6 items-center gap-2">
              <span className="font-mono text-[11px] text-foreground">
                <span className="text-foreground-muted">{kind} · your people</span>
              </span>
              <button
                type="button"
                onClick={onOpenFull}
                className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[7px] border border-border px-2 py-[3px] font-mono text-[10.5px] text-foreground-muted transition-colors hover:text-foreground-secondary"
              >
                open full room
                <SurfaceIcon name="chevron" size={11} />
              </button>
            </div>
            <div className="mt-[5px] font-serif text-[21px] leading-[1.1] text-foreground">
              {face.stop} of 10 {metric}
              <small className="mt-[3px] block font-sans text-[10.5px] leading-[1.35] text-foreground-muted">
                {title}
              </small>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-0.5 grid size-[26px] shrink-0 place-items-center rounded-md bg-surface text-foreground-muted transition-colors hover:text-foreground-secondary"
          >
            <X className="size-[13px]" />
          </button>
        </div>

        {/* Body — the REAL Room (named voices · People ⇄ Population · weak-spot · ask →). */}
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <AmbientRoom
            embedded
            flatPersonas={personas}
            conceptText={focus.conceptText ?? title}
            fraction={face.fraction}
            platform="tiktok"
            reducedMotion={reducedMotion}
            canRewrite={false}
          />
        </div>

        <button
          type="button"
          onClick={() => onDevelop(focus)}
          className="mx-3 mb-3 mt-2 shrink-0 rounded-[10px] bg-accent px-3 py-[11px] text-center text-[12.5px] font-semibold text-[color:var(--color-accent-foreground)] transition-colors hover:bg-accent-hover"
        >
          {kind === "Outlier" ? "Remix this in a thread →" : "Develop this in a thread →"}
        </button>
      </div>
    </div>
  );
}
