"use client";

/**
 * AudienceLensChip — the composer foot's "who + where" door (owner ruling 2026-08-11).
 *
 * The v8 top bar carried the audience identity AND the platform lens across the composer's
 * whole width. The owner rejected it on live review: at desktop width three small items in a
 * ~1300px strip read as an empty shelf, and its lens caret sat immediately beside the room
 * caret looking like a sibling while doing something else entirely.
 *
 * With the rail restored the ROOM owns identity again — the rail ≥xl, the attached dock <xl —
 * so this is the SETTINGS door only: which audience, which platform, both of which the
 * audience sheet holds. It sits in the foot because the foot is where a run's settings live
 * (it borrows the quiet model-selector grammar: bare text, no box, muted until hover).
 *
 * The live-presence dot is the ONE sanctioned accent (spec §8, LOCKED) and it renders only
 * while a run is actually in flight. Idle — which is nearly always — this chip has none.
 */

import { Ico } from "@/components/app/home/composer-controls";
import { audienceToMeta } from "@/lib/surfaces/ambient-v2-audience-meta";
import { cn } from "@/lib/utils";
import type { Audience } from "@/lib/audience/audience-types";

export function AudienceLensChip({
  audience,
  lensLabel,
  watching = false,
  showName = true,
  onClick,
}: {
  audience: Audience;
  /** The platform lens label ("TikTok") — a run setting, not the audience's provenance. */
  lensLabel: string;
  /** A run is in flight — the live dot breathes. */
  watching?: boolean;
  /**
   * Whether to print the audience name. FALSE wherever the room already states it — the
   * attached dock bar <xl sits directly above this chip, so carrying "@mrbeast" in both
   * put the same word twice in 40px of each other and, on a 393px foot, truncated the
   * chip's copy to a stray bracket (measured). The lens alone is what the foot owes then.
   */
  showName?: boolean;
  onClick: () => void;
}) {
  const name = audienceToMeta(audience).name;

  return (
    <button
      type="button"
      data-testid="composer-audience-chip"
      aria-label={`Creating for ${name} on ${lensLabel} — change audience or platform`}
      aria-haspopup="dialog"
      onClick={onClick}
      className={cn(
        "inline-flex h-[34px] min-w-0 max-w-[210px] shrink items-center gap-1.5 rounded-full px-2.5",
        "text-label text-foreground-muted transition-colors",
        "hover:bg-white/[0.06] hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring)]",
        "pointer-coarse:h-11",
      )}
    >
      {watching && (
        <span
          data-testid="composer-audience-chip-dot"
          aria-hidden
          className="h-[5px] w-[5px] shrink-0 rounded-full bg-accent motion-safe:animate-pulse"
        />
      )}
      {showName && (
        <>
          <span className="truncate">{name}</span>
          <span aria-hidden className="shrink-0 text-foreground-muted/60">
            ·
          </span>
        </>
      )}
      <span className="shrink-0">{lensLabel}</span>
      <Ico name="chev" size={12} className="shrink-0 text-foreground-muted" />
    </button>
  );
}
