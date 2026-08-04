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
import { Eye, Heart } from "@phosphor-icons/react";
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

/**
 * Engagement, fraction → percent, in the ONE place that is allowed to do it.
 *
 * `CorpusVideo.engagement` is a fraction (0.041 = 4.1%) and every control and label around
 * it is a percent. Multiplying at the call site is the exact defect `discover-filters` has
 * its own test for: the mistake is off by 100× and still renders a plausible screen, so
 * nothing about the result says it is wrong. One decimal because the corpus runs 0 → 0.24
 * — whole percents would collapse the bottom of that range onto "0%".
 */
export function fmtEngagement(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
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
        tone === "proven"
          ? "bg-[color:var(--color-positive)]/15 text-[color:var(--color-positive)]"
          : "bg-white/[0.06] text-foreground-muted",
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
 *   • baselined and ≥3× under the thin-baseline ceiling → proven green;
 *   • baselined but extreme → the source's own number, flagged, never in proven green.
 */
export function MultiplierChip({
  video,
  className,
}: {
  video: CorpusVideo;
  className?: string;
}) {
  if (video.multiplier === null) {
    return (
      <Chip className={className} title="No baseline recorded — no claim made">
        curated
      </Chip>
    );
  }
  if (video.extreme) {
    return (
      <Chip
        className={className}
        title="Measured against a very thin baseline — shown, but not treated as proof"
      >
        {fmtMultiplier(video.multiplier)} ⚠
      </Chip>
    );
  }
  return (
    <Chip
      tone="proven"
      className={className}
      title={`${fmtMultiplier(video.multiplier)} ${video.baselineLabel ?? ""}`}
    >
      ▲ {fmtMultiplier(video.multiplier)}
    </Chip>
  );
}

/**
 * The three measured facts about a post, as discrete chips — the receipt, the reach, the
 * engagement rate.
 *
 * Why a component and not three chips at each call site: the card, the collection row and
 * the detail all state the same three numbers, and the last time this surface let each
 * caller compose its own metrics it grew two different tiles for one object (FeedCard vs
 * OutlierTile) with two different meanings for the same green ▲. The multiplier keeps its
 * honesty rules by delegating to MultiplierChip; the engagement conversion happens once, in
 * fmtEngagement. Nothing here decides what is true — it only decides how it is set.
 *
 * Only the multiplier is tinted. It is the one number that is a CLAIM (this post beat its
 * own creator's usual by N×) and the one the honesty rules gate; views and engagement are
 * plain description and read as such. A row of three equally coloured chips would say all
 * three had been vouched for.
 *
 * Wraps on purpose: at the 2-column phone grid a card is 171px wide and three chips do not
 * fit a line. The grid stretches cards to a common row height, so a second chip line costs
 * alignment nothing.
 */
export function MetricChips({
  video,
  /** `card` steps the row up a size from `lg` — see GROWS below. */
  scale = "row",
}: {
  video: CorpusVideo;
  scale?: "row" | "card";
}) {
  // GROWS WITH ITS CONTAINER. In a collection's list row the chips sit beside a Remix
  // button in 74px of height and micro is correct. On an outliers card they are the whole
  // bottom band of a 438px-wide tile, where micro reads as fine print — but that same card
  // is 171px wide on the 2-column phone grid, so the step up is gated to `lg` rather than
  // taken outright. Passed as a class, not a second Chip variant: one chip, two densities.
  const grow = scale === "card" ? "lg:px-2.5 lg:py-1 lg:text-label" : undefined;
  const icon = scale === "card" ? 11 : 10;
  return (
    <div className="flex flex-wrap items-center gap-1 lg:gap-1.5">
      <MultiplierChip video={video} className={grow} />
      <Chip className={grow} title={`${video.views.toLocaleString("en-US")} views`}>
        <Eye size={icon} weight="fill" aria-hidden="true" />
        {fmtViews(video.views)}
        <span className="sr-only"> views</span>
      </Chip>
      {video.engagement !== null ? (
        <Chip className={grow} title="Engagement rate recorded for this post">
          <Heart size={icon} weight="fill" aria-hidden="true" />
          {fmtEngagement(video.engagement)}
          <span className="sr-only"> engagement</span>
        </Chip>
      ) : null}
    </div>
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
