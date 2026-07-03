"use client";

/**
 * AudienceConstellation — the breathing node-network that visualizes the living room.
 *
 * A small constellation of audience nodes (a couple lit sage/terracotta, the rest cream)
 * that breathe when idle and blink faster while the room is reacting. Matches the v3
 * prototype's presence glyph. Motion is CSS-only and hard-stops under reduce (globals.css).
 */

import { cn } from "@/lib/utils";

const NODES: { cx: number; cy: number; r: number; fill: string; delay: number }[] = [
  { cx: 8, cy: 20, r: 2.6, fill: "#ece7de", delay: 0 },
  { cx: 24, cy: 10, r: 2.6, fill: "#8ea68a", delay: 0.4 },
  { cx: 30, cy: 27, r: 2.2, fill: "#ece7de", delay: 1.2 },
  { cx: 46, cy: 16, r: 2.6, fill: "#ece7de", delay: 0.8 },
  { cx: 58, cy: 8, r: 2.2, fill: "#8ea68a", delay: 1.6 },
  { cx: 64, cy: 24, r: 2.6, fill: "var(--color-accent)", delay: 0.6 },
  { cx: 80, cy: 14, r: 2.6, fill: "#ece7de", delay: 1.9 },
  { cx: 92, cy: 26, r: 2.2, fill: "#8ea68a", delay: 1 },
  { cx: 104, cy: 12, r: 2.6, fill: "#ece7de", delay: 0.2 },
  { cx: 120, cy: 20, r: 2.2, fill: "#ece7de", delay: 1.4 },
];

const EDGES = [
  [8, 20, 24, 10], [24, 10, 46, 16], [46, 16, 64, 24],
  [64, 24, 80, 14], [80, 14, 104, 12], [104, 12, 120, 20],
] as const;

export function AudienceConstellation({
  reacting = false,
  className,
}: {
  reacting?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 132 34"
      aria-hidden
      className={cn("h-[26px] w-[54px]", reacting && "constell-reacting", className)}
    >
      <g stroke="rgba(255,255,255,0.12)" strokeWidth={1}>
        {EDGES.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {NODES.map((n, i) => (
        <circle
          key={i}
          className="constell-dot"
          cx={n.cx}
          cy={n.cy}
          r={n.r}
          fill={n.fill}
          style={{ animationDelay: `${n.delay}s` }}
        />
      ))}
    </svg>
  );
}
