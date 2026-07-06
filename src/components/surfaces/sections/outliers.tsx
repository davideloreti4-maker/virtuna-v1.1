"use client";

/**
 * Outliers — feed winners simmed for your people, each Remixable into a thread (Seams 1/2).
 * Horizontal snap-rail on mobile (as in v3); 3-across grid on desktop (handoff §3).
 *
 * The cards are REAL (competitor videos simmed against the user's audience). On the first
 * /start visit of the day the sim runs lazily (owner cadence) → the section shows a `warming`
 * skeleton until the reaction lands; a genuinely empty corpus shows an honest empty state
 * (never a fabricated card).
 */

import type { LiveOutlierCard } from "@/lib/surfaces/live-cards";
import { SectionHeader } from "./section-header";
import { OutlierCard } from "./outlier-card";

export type OutliersStatus = "warming" | "ready";

export function Outliers({
  outliers,
  status,
  onOpen,
  onRemix,
  onViewAll,
}: {
  outliers: LiveOutlierCard[];
  status: OutliersStatus;
  onOpen: (cardId: string) => void;
  onRemix: (outlier: LiveOutlierCard) => void;
  onViewAll: () => void;
}) {
  return (
    <section className="pt-[18px]">
      <SectionHeader
        title="Outliers to remix"
        action={{ label: "View all", onClick: onViewAll, withChevron: true }}
      />

      {status === "warming" ? (
        <WarmingRail />
      ) : outliers.length === 0 ? (
        <p className="px-1 py-6 text-[12.5px] leading-[1.5] text-foreground-muted">
          No outliers to remix yet. As we track more creators in your space, their
          winners — scored for how <span className="text-foreground-secondary">your</span> people
          would react — show up here.
        </p>
      ) : (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] lg:grid lg:grid-cols-3 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {outliers.map((o) => (
            <div key={o.contentId} className="w-[240px] shrink-0 snap-start lg:w-auto">
              <OutlierCard outlier={o} onOpen={onOpen} onRemix={onRemix} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Skeleton rail while the outliers sim against your audience (first-visit-of-the-day warm). */
function WarmingRail() {
  return (
    <div>
      <p className="mb-2 px-1 font-mono text-[10.5px] text-foreground-muted">
        Testing today’s outliers on your people…
      </p>
      <div className="flex gap-3 px-1 pb-1.5 lg:grid lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="elev-lift w-[240px] shrink-0 animate-pulse overflow-hidden rounded-xl border border-border bg-[#1c1b19] lg:w-auto"
          >
            <div className="aspect-[9/16] bg-[linear-gradient(165deg,#2a2825,#1a1917)]" />
            <div className="space-y-2 p-[11px]">
              <div className="h-3 w-3/4 rounded bg-white/[0.06]" />
              <div className="h-8 w-full rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
