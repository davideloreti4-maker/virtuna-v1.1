"use client";

import { Fragment } from "react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface PostingHeatmapProps {
  grid: number[][];
}

/**
 * 7x24 CSS grid heatmap for posting time analysis.
 *
 * Uses inline styles with dynamic opacity values based on post count.
 * Grid layout: day labels on left, hour labels on top (0-23), UTC.
 */
export function PostingHeatmap({ grid }: PostingHeatmapProps) {
  const maxCount = Math.max(...grid.flat(), 1);

  return (
    <div>
      <div className="relative">
        <div className="overflow-x-auto">
          <div
            className="gap-[2px] min-w-[600px]"
            style={{
              display: "grid",
              gridTemplateColumns: "40px repeat(24, 1fr)",
            }}
          >
            {/* Header row: empty corner + hour labels */}
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={`h-${h}`}
                className="text-[10px] text-foreground-muted text-center"
              >
                {h}
              </div>
            ))}

            {/* Day rows */}
            {DAYS.map((day, dayIndex) => (
              <Fragment key={day}>
                <div className="text-xs text-foreground-muted flex items-center">
                  {day}
                </div>
                {Array.from({ length: 24 }, (_, hour) => {
                  const count = grid[dayIndex]?.[hour] ?? 0;
                  const opacity =
                    count > 0 ? 0.15 + (count / maxCount) * 0.85 : 0.03;

                  return (
                    <div
                      key={`${day}-${hour}`}
                      className="aspect-square rounded-sm"
                      style={{
                        backgroundColor: `oklch(0.72 0.16 40 / ${opacity})`,
                      }}
                      title={`${day} ${hour}:00 - ${count} post${count !== 1 ? "s" : ""}`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        {/* Mobile scroll hint */}
        <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[var(--color-background)] to-transparent pointer-events-none md:hidden" />
      </div>
      <p className="text-[10px] text-foreground-muted italic mt-1">(UTC)</p>
    </div>
  );
}
