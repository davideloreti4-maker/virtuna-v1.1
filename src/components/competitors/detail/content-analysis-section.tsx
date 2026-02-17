"use client";

import { PostingHeatmap } from "@/components/competitors/charts/posting-heatmap";
import { DurationBreakdownChart } from "@/components/competitors/charts/duration-breakdown-chart";

interface ContentAnalysisSectionProps {
  hashtags: { tag: string; count: number }[];
  heatmapGrid: number[][];
  durationBreakdown: { label: string; count: number; percentage: number }[];
}

/**
 * Content analysis wrapper section with hashtag frequency,
 * duration breakdown chart, and posting time heatmap.
 */
export function ContentAnalysisSection({
  hashtags,
  heatmapGrid,
  durationBreakdown,
}: ContentAnalysisSectionProps) {
  const topHashtags = hashtags.slice(0, 20);
  const maxHashtagCount = topHashtags[0]?.count ?? 1;
  const heatmapEmpty = heatmapGrid.every((row) =>
    row.every((cell) => cell === 0)
  );

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Content Analysis
      </h2>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Sub-section 1: Hashtags (left column) */}
        <div className="border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-3">
            Top Hashtags
          </h3>
          {topHashtags.length === 0 ? (
            <p className="text-foreground-muted text-sm py-8 text-center">
              No hashtag data
            </p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto space-y-0">
              {topHashtags.map((h) => (
                <div
                  key={h.tag}
                  className="relative flex items-center justify-between py-2 px-2 border-b border-white/[0.04] last:border-b-0"
                >
                  {/* Proportional bar indicator */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{
                      width: `${(h.count / maxHashtagCount) * 100}%`,
                      backgroundColor: "oklch(0.72 0.16 40 / 0.1)",
                    }}
                  />
                  <span className="relative text-sm text-foreground">
                    #{h.tag}
                  </span>
                  <span className="relative text-sm text-foreground-muted">
                    {h.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sub-section 2: Duration Breakdown (right column) */}
        <div className="border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-3">
            Video Duration Distribution
          </h3>
          <DurationBreakdownChart data={durationBreakdown} />
        </div>

        {/* Sub-section 3: Posting Time Heatmap (full width) */}
        <div className="lg:col-span-2 border border-white/[0.06] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground-muted uppercase tracking-wide mb-3">
            Best Posting Times
          </h3>
          {heatmapEmpty ? (
            <p className="text-foreground-muted text-sm py-8 text-center">
              No posting time data
            </p>
          ) : (
            <PostingHeatmap grid={heatmapGrid} />
          )}
        </div>
      </div>
    </section>
  );
}
