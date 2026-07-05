"use client";

/**
 * DailyIdeas — pre-tested idea cards (Seams 1/2). Single column on mobile, 2-col grid on desktop.
 *
 * The cards are REAL (the `ideas` skill generate→sim→ranks; each carries its own Flash reaction).
 * On the first /start visit of the day the run happens lazily (owner cadence) → a `warming`
 * skeleton until the ideas land; a genuinely empty result shows an honest empty state.
 */

import type { LiveIdeaCard } from "@/lib/surfaces/live-cards";
import { SectionHeader } from "./section-header";
import { IdeaCard } from "./idea-card";

export type IdeasStatus = "warming" | "ready";

export function DailyIdeas({
  ideas,
  status,
  focusedCardId,
  onOpen,
  onRefresh,
}: {
  ideas: LiveIdeaCard[];
  status: IdeasStatus;
  focusedCardId: string | null;
  onOpen: (cardId: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="pt-[18px]">
      <SectionHeader title="Daily ideas" action={{ label: "Refresh", onClick: onRefresh }} />

      {status === "warming" ? (
        <WarmingGrid />
      ) : ideas.length === 0 ? (
        <p className="px-1 py-6 text-[12.5px] leading-[1.5] text-foreground-muted">
          No ideas yet. Once your audience is calibrated, fresh ideas — pre-tested on
          how <span className="text-foreground-secondary">your</span> people would react —
          land here each day.
        </p>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.contentId}
              idea={idea}
              focused={focusedCardId === idea.contentId}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Skeleton grid while the ideas generate + sim against your audience (first-visit-of-the-day warm). */
function WarmingGrid() {
  return (
    <div>
      <p className="mb-2 px-1 font-mono text-[10.5px] text-foreground-muted">
        Making today’s ideas and testing them on your people…
      </p>
      <div className="grid gap-2.5 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="elev-lift animate-pulse rounded-xl border border-border bg-surface-elevated p-3.5"
          >
            <div className="mb-[11px] flex items-center gap-2">
              <div className="h-5 w-16 rounded-md bg-white/[0.05]" />
              <div className="ml-auto h-3 w-14 rounded bg-white/[0.04]" />
            </div>
            <div className="space-y-2">
              <div className="h-3.5 w-full rounded bg-white/[0.06]" />
              <div className="h-3.5 w-2/3 rounded bg-white/[0.05]" />
            </div>
            <div className="mt-3 border-t border-border pt-[11px]">
              <div className="h-3 w-3/4 rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
