"use client";

import { EngagementBarChart } from "@/components/competitors/charts/engagement-bar-chart";
import { computeVideoEngagementRate, formatCount } from "@/lib/competitors-utils";

interface EngagementVideoData {
  caption: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number | null;
}

interface EngagementSectionProps {
  chartData: EngagementVideoData[];
  averageEngagementRate: number | null;
}

/**
 * Engagement analytics section with per-video bar chart, stat card,
 * and a scrollable per-video engagement table.
 *
 * Shows top 10 videos in the chart and up to 20 in the table,
 * sorted by views descending.
 */
export function EngagementSection({
  chartData,
  averageEngagementRate,
}: EngagementSectionProps) {
  const chartSlice = chartData.slice(0, 10);
  const tableSlice = chartData.slice(0, 20);

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Engagement
      </h2>
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Left: Engagement bar chart */}
        <div className="border border-white/[0.06] rounded-xl p-4">
          <EngagementBarChart data={chartSlice} />
        </div>

        {/* Right: Avg engagement rate stat */}
        <div className="flex flex-col gap-4">
          <div className="border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-foreground-muted">Avg Engagement Rate</p>
            <p className="text-xl font-semibold text-foreground">
              {averageEngagementRate !== null
                ? `${averageEngagementRate}%`
                : "--"}
            </p>
          </div>
        </div>
      </div>

      {/* Per-video engagement table */}
      {tableSlice.length > 0 && (
        <div className="border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="py-3 px-4 text-left font-medium text-foreground-muted text-xs">
                    Video
                  </th>
                  <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
                    Views
                  </th>
                  <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
                    Likes
                  </th>
                  <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
                    Comments
                  </th>
                  <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
                    Shares
                  </th>
                  <th className="py-3 px-4 text-right font-medium text-foreground-muted text-xs">
                    Eng. Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableSlice.map((video, i) => {
                  const rate = computeVideoEngagementRate({
                    views: video.views,
                    likes: video.likes,
                    comments: video.comments,
                    shares: video.shares,
                  });
                  return (
                    <tr
                      key={i}
                      className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="py-3 px-4 text-foreground max-w-[200px] truncate">
                        {video.caption || "Untitled"}
                      </td>
                      <td className="py-3 px-4 text-right text-foreground">
                        {formatCount(video.views)}
                      </td>
                      <td className="py-3 px-4 text-right text-foreground">
                        {formatCount(video.likes)}
                      </td>
                      <td className="py-3 px-4 text-right text-foreground">
                        {formatCount(video.comments)}
                      </td>
                      <td className="py-3 px-4 text-right text-foreground">
                        {formatCount(video.shares)}
                      </td>
                      <td className="py-3 px-4 text-right text-foreground">
                        {rate !== null ? `${rate}%` : "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
