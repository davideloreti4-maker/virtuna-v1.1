"use client";

/**
 * discover-primitives — the small shared vocabulary of the reworked Discover hub.
 *
 * One card rhythm, one chip family, one way of stating a multiplier. The old hub had two
 * tile components for the same object inside one surface (FeedCard vs OutlierTile) and a
 * green ▲ pill that meant a measured multiplier on one tab and a hardcoded illustration on
 * another. These are the pieces every panel here shares so that cannot happen again.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CorpusVideo } from "@/lib/discover/corpus-reads";

/** Compact count — 1.2M / 44K / 812. Local to Discover's dense meta lines. */
export function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/** Coarse age — the corpus is evergreen, so precision past a month is noise. */
export function fmtAge(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** One decimal under 100×, whole numbers above — a 3235.4× reads as false precision. */
export function fmtMultiplier(m: number): string {
  return m >= 100 ? `${Math.round(m)}×` : `${m.toFixed(1)}×`;
}

export function Chip({
  children,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  tone?: "neutral" | "proven";
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-micro font-medium tabular-nums",
        // Owner ruling 2026-08-21 (accent-dosage): "proven" is brightness, not hue — the same
        // encoding /audience uses for provenance strength. The ▲/⚠ glyphs carry the claim.
        tone === "proven" ? "bg-white/[0.06] text-foreground" : "bg-white/[0.06] text-foreground-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * The receipt, stated the one honest way — the rule the grounding layer already enforces
 * for the model, now enforced for the eye:
 *   • no baseline recorded → "curated", no number, no claim;
 *   • baselined and ≥3× under the thin-baseline ceiling → proven: bright + ▲;
 *   • baselined but extreme → the source's own number, flagged ⚠, never wearing the ▲.
 */
export function MultiplierChip({ video }: { video: CorpusVideo }) {
  if (video.multiplier === null) {
    return <Chip title="No baseline recorded — no claim made">curated</Chip>;
  }
  if (video.extreme) {
    return (
      <Chip title="Measured against a very thin baseline — shown, but not treated as proof">
        {fmtMultiplier(video.multiplier)} ⚠
      </Chip>
    );
  }
  return (
    <Chip tone="proven" title={`${fmtMultiplier(video.multiplier)} ${video.baselineLabel ?? ""}`}>
      ▲ {fmtMultiplier(video.multiplier)}
    </Chip>
  );
}

/** Section label above a shelf or a group of rows. */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="truncate text-micro font-semibold uppercase tracking-[0.09em] text-foreground-muted">
      {children}
    </span>
  );
}
