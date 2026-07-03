"use client";

/**
 * Outliers — feed winners scored for your people, each Remixable into a thread.
 * Horizontal snap-rail on mobile (as in v3); 3-across grid on desktop (handoff §3).
 */

import type { OutlierCard as OutlierCardData } from "@/lib/room-contract/mock-room";
import { SectionHeader } from "./section-header";
import { OutlierCard } from "./outlier-card";

export function Outliers({
  outliers,
  onOpen,
  onRemix,
  onViewAll,
}: {
  outliers: OutlierCardData[];
  onOpen: (cardId: string) => void;
  onRemix: (outlier: OutlierCardData) => void;
  onViewAll: () => void;
}) {
  return (
    <section className="pt-[18px]">
      <SectionHeader
        title="Outliers to remix"
        action={{ label: "View all", onClick: onViewAll, withChevron: true }}
      />
      {/* Mobile: snap-rail. Desktop: 3-col grid. */}
      <div className="flex snap-x snap-mandatory gap-[11px] overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] lg:grid lg:grid-cols-3 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
        {outliers.map((o) => (
          <div key={o.cardId} className="w-[210px] shrink-0 snap-start lg:w-auto">
            <OutlierCard outlier={o} onOpen={onOpen} onRemix={onRemix} />
          </div>
        ))}
      </div>
    </section>
  );
}
