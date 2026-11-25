"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { watchingAt } from "@/lib/result/curve";
import type { VideoModel } from "@/lib/result/types";
import { Curve, lineY } from "./curve";
import { Player } from "./player";
import { useContentWidth } from "./use-content-width";

/** The plot's height in the compact player (the mock's `scr2(243, 50)` with `SC`). */
const PLOT = 50;
/** The room above the plot for the readout. */
const ABOVE = 30;
/** The line's width before it is measured: a 393-wide phone. */
const FALLBACK_WIDTH = 263;

/**
 * Phone, once the hero has scrolled away (the mock's `.pn-c`, `scr` with `SC`): a small frame (62
 * wide) and the line (plot 50 tall, no strip) with the playhead, and the number at the line's end,
 * above the line just before the dot. The layout (video-result.tsx) pins it under the header.
 */
export function CompactPlayer({ model }: { model: VideoModel }) {
  const [lineRef, width] = useContentWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const end = useMemo(() => {
    const { points, clipS } = model.audience;
    const last = points[points.length - 1]![1];
    // Clear of the line both at its end and a little before it (the mock's `endL`).
    const before = watchingAt(points, (Math.max(0, width - 36) / width) * clipS);
    return { x: width - 9, y: Math.min(lineY(last, PLOT), lineY(before, PLOT)) - 9 };
  }, [model, width]);

  return (
    <Card data-result="compact" data-id={model.id} className="flex items-start gap-3.5 rounded-3xl py-2 pl-2 pr-3.5">
      <Player model={model} size="compact" />
      <div ref={lineRef} className="relative min-w-0 flex-1" style={{ paddingTop: ABOVE }}>
        {/* A copy of the hero's line, which stays the one slider. */}
        <Curve model={model} width={width} height={PLOT} strip={false} mirror />
        <svg
          width={width}
          height={PLOT}
          viewBox={`0 0 ${width} ${PLOT}`}
          className="pointer-events-none absolute left-0 overflow-visible"
          style={{ top: ABOVE }}
          aria-hidden
        >
          <text
            data-part="end"
            x={end.x.toFixed(1)}
            y={end.y.toFixed(1)}
            textAnchor="end"
            fontSize={12}
            fontWeight={650}
            fill="var(--color-foreground)"
            className="tabular-nums"
          >
            {model.headline.value}%
          </text>
        </svg>
      </div>
    </Card>
  );
}
