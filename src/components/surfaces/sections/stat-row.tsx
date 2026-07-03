"use client";

/**
 * StatRow — the L7D analytics tiles (Followers / New followers / Likes / Posts, plus
 * an optional 5th "Views" tile once the daily cron has scraped recent posts), each
 * with an area-fill sparkline + delta. 2-col on mobile, N-across on desktop (4 or 5,
 * matching the tile count). Numbers are REAL — derived from the connected account's
 * account_snapshots time-series (`buildAccountStats`). Point-in-time values land on
 * connect; weekly deltas + sparklines fill in as the daily cron accumulates snapshots.
 * When there are no snapshots yet, the shell renders `StatRowEmpty` — never fake data.
 */

import type { StatCard } from "@/lib/room-contract/mock-room";
import { SurfaceIcon } from "../icons";

function Sparkline({ points, up }: { points: string; up: boolean }) {
  const arr = points.split(" ").map((p) => p.split(",").map(Number));
  const first = arr[0] ?? [0, 18];
  const last = arr[arr.length - 1] ?? [72, 18];
  const color = up ? "#8ea68a" : "var(--color-foreground-muted)";
  const area = `M${first[0]},18 L${arr.map((p) => `${p[0]},${p[1]}`).join(" L")} L${last[0]},18 Z`;
  return (
    <svg viewBox="0 0 72 18" preserveAspectRatio="none" className="mt-[9px] h-[18px] w-full">
      <path d={area} fill={color} opacity={0.09} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function StatRow({ stats }: { stats: StatCard[] }) {
  // Desktop columns track the tile count so the row stays gapless when the optional
  // 5th (Views) tile is present. Mobile stays 2-col (a 5th tile flows to a 3rd row).
  const lgCols = stats.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";
  return (
    <div className={`grid grid-cols-2 gap-[9px] px-1 ${lgCols}`}>
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex flex-col rounded-xl border border-border bg-surface-elevated px-[13px] py-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-medium text-foreground-secondary">{s.label}</span>
            <span className="font-mono text-[8px] tracking-[0.08em] text-foreground-muted">L7D</span>
          </div>
          <div className="mt-[7px] text-[23px] font-semibold leading-none tracking-[-0.02em] text-foreground [font-variant-numeric:tabular-nums]">
            {s.value}
          </div>
          <Sparkline points={s.spark} up={s.up} />
          <div
            className="mt-[7px] flex items-center gap-1 font-mono text-[9px]"
            style={{ color: s.up ? "#8ea68a" : "var(--color-foreground-muted)" }}
          >
            {s.up && <SurfaceIcon name="up" size={9} strokeWidth={2} />}
            {s.delta}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Honest empty state — a connected account with no snapshots captured yet.
 * We never fabricate analytics, so this stands in until the first scrape lands
 * (calibration capture) and the daily cron starts building the series.
 */
export function StatRowEmpty() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-surface-elevated px-4 py-3.5">
      <span className="text-foreground-muted" aria-hidden>
        <SurfaceIcon name="up" size={15} strokeWidth={1.6} />
      </span>
      <p className="m-0 text-[11.5px] leading-[1.45] text-foreground-muted">
        Gathering your account numbers — followers, likes, and posts land here as they come in.
      </p>
    </div>
  );
}
