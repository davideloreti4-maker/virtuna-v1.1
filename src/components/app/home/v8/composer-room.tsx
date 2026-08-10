"use client";

/**
 * ComposerRoom — the composer's attached TOP bar + the sim room it opens into
 * (owner ruling 2026-08-10, superseding both "nothing above the field" and the
 * v8 three-tab report).
 *
 * The ruling, verbatim intent: the design and concept return to the shipped
 * MOBILE dock — the @handle bar fused to the composer's top edge — but the room
 * must NOT open as a complete page: "make it feel like the composer is opening
 * up into a card." So:
 *
 *   collapsed · one bar above the field: room glyph · audience name · calibration
 *              chip · live dot · "N ranked" · lens zone ("TikTok ▾" → the audience
 *              sheet) · caret. The bar is the room's door.
 *   open      · the bar is REPLACED by the room card, in flow, inside the same
 *              composer box — the REAL Ambient v2 room (AmbientOverviewRail,
 *              presentation "sheet": minds · calibrated · reads-on-platform ·
 *              Ranked board · sealed reads · "Test something of your own"),
 *              height-capped with its own scroll. No portal, no overlay, no page.
 *              The room header's own caret is the way back down.
 *
 * The sim stays fire-on-demand and COMPLETELY SEPARATE from the drops (same
 * ruling: drops arrive unscored) — this room is the sim's one home.
 * The live-presence dot keeps the single sanctioned accent (spec §8, LOCKED).
 */

import { useEffect } from "react";
import { AmbientOverviewRail } from "@/components/audience-lens/v2/AmbientOverviewRail";
import { audienceToMeta } from "@/lib/surfaces/ambient-v2-audience-meta";
import { cn } from "@/lib/utils";
import type { Audience } from "@/lib/audience/audience-types";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";
import type { WireSimSealMap } from "@/lib/onboarding/verdict-seal";

/** The same calm crowd mark the Overview's room header uses (people, not a sparkline). */
function RoomGlyph() {
  return (
    <svg viewBox="0 0 20 16" className="h-[15px] w-[18px] flex-none" aria-hidden>
      <circle cx="4" cy="11" r="2" fill="#ece7de" opacity=".9" />
      <circle cx="9.5" cy="6" r="2" fill="#ece7de" opacity=".62" />
      <circle cx="14.5" cy="11.5" r="1.9" fill="#ece7de" opacity=".78" />
      <circle cx="16.5" cy="5" r="1.5" fill="#ece7de" opacity=".4" />
    </svg>
  );
}

export function ComposerRoom({
  audience,
  descriptors,
  reducedMotion = false,
  persistedSeals,
  focusVideo,
  onTestVariant,
  open,
  onOpenChange,
  lensLabel,
  onOpenAudience,
  watching = false,
}: {
  audience: Audience;
  descriptors: AmbientCardDescriptor[];
  reducedMotion?: boolean;
  persistedSeals?: WireSimSealMap;
  focusVideo?: { id: string; nonce: number } | null;
  /** The ＋ door, straight through to the rail (SimulateDoorHost handles it). */
  onTestVariant?: () => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** The platform lens label ("TikTok") — its zone opens the audience sheet. */
  lensLabel: string;
  onOpenAudience: () => void;
  /** A run is in flight — the live dot breathes. */
  watching?: boolean;
}) {
  const meta = audienceToMeta(audience);
  const count = descriptors.length;

  // Escape collapses the room. In-flow (no overlay), so no body scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <div data-testid="composer-room" data-open={open || undefined} className="w-full">
      {open ? (
        <div
          data-testid="composer-room-card"
          role="region"
          aria-label="Your audience room"
          className={cn(
            // The composer opening up into a card: a capped column INSIDE the box,
            // above the field. The rail's sheet presentation flexes into this cap.
            // An empty room (nothing ranked yet) takes a shorter card — a 62dvh void
            // around one Test row reads as a broken page, not a room.
            "flex w-full flex-col overflow-hidden border-b border-white/[0.06]",
            count === 0 ? "h-[300px]" : "h-[min(560px,62dvh)]",
            !reducedMotion && "ambient-room-in",
          )}
        >
          <AmbientOverviewRail
            audience={audience}
            descriptors={descriptors}
            reducedMotion={reducedMotion}
            persistedSeals={persistedSeals}
            presentation="sheet"
            focusVideo={focusVideo}
            onTestVariant={onTestVariant}
            // The room header's caret is the way back down into the bar.
            onDismiss={() => onOpenChange(false)}
          />
        </div>
      ) : (
        <div className="flex w-full items-center border-b border-white/[0.06]">
          {/* Main zone — the door. Everything identity is one target. */}
          <button
            type="button"
            data-testid="composer-room-bar"
            aria-expanded={false}
            aria-label="Open your audience room"
            onClick={() => onOpenChange(true)}
            className="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-[11px] text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[color:var(--focus-ring)]"
          >
            <RoomGlyph />
            <span className="min-w-0 truncate text-body font-medium tracking-[-0.012em] text-foreground">
              {meta.name}
            </span>
            <span className="inline-flex flex-none items-center gap-1.5 rounded-full border border-white/[0.08] px-2 py-[3px] font-mono text-micro uppercase tracking-[0.08em] text-foreground-secondary">
              {/* The single sanctioned accent: the live-presence dot (spec §8, LOCKED). */}
              <span
                data-testid="composer-room-live-dot"
                aria-hidden
                className={cn(
                  "inline-block h-[5px] w-[5px] rounded-full bg-accent",
                  watching && "motion-safe:animate-pulse",
                )}
              />
              {meta.calibrationBadge}
            </span>
            {count > 0 ? (
              <span className="ml-auto flex-none font-mono text-micro uppercase tracking-[0.06em] text-foreground-muted">
                {count} ranked
              </span>
            ) : (
              <span className="ml-auto" aria-hidden />
            )}
          </button>
          {/* Lens zone — settings, not the room: audience + platform sheet. */}
          <button
            type="button"
            data-testid="composer-room-lens"
            aria-label="Choose audience and platform"
            onClick={onOpenAudience}
            className="flex flex-none items-center gap-1 px-2.5 py-[11px] text-label text-foreground-secondary transition-colors hover:bg-white/[0.03] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[color:var(--focus-ring)]"
          >
            {lensLabel}
            <span aria-hidden className="text-micro text-foreground-muted">
              ▾
            </span>
          </button>
          {/* The caret sits LAST (the owner's reference anatomy) — its own slim
              target, same act as the main zone: the room. */}
          <button
            type="button"
            aria-label="Open your audience room"
            onClick={() => onOpenChange(true)}
            className="flex flex-none items-center py-[11px] pl-1.5 pr-4 text-foreground-muted transition-colors hover:bg-white/[0.03] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[color:var(--focus-ring)]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="flex-none">
              <path
                d="M2.5 4.5L6 8l3.5-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
