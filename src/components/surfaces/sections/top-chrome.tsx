"use client";

/**
 * TopChrome — the top bar: a layout toggle (left), the three gamification rings
 * centered (streak · planned · accuracy), and the theme toggle (right).
 *
 * Rings are monochrome cream EXCEPT the accuracy ring — the ONE sanctioned terracotta
 * arc on the page (the single live signal, DESIGN-SYSTEM accent dosage). The arc draws
 * in on mount.
 */

import { useEffect, useState } from "react";
import type { RingStat } from "@/lib/room-contract/mock-room";
import { SurfaceIcon } from "../icons";
import { cn } from "@/lib/utils";

const R = 15;
const C = 2 * Math.PI * R;

function Ring({ ring, mounted }: { ring: RingStat; mounted: boolean }) {
  const offset = mounted ? C * (1 - ring.pct) : C;
  return (
    <div className="flex cursor-pointer flex-col items-center gap-[5px]" title={ring.label}>
      <div className="relative size-9">
        <svg width={36} height={36} className="-rotate-90">
          <circle cx={18} cy={18} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={2.6} />
          <circle
            cx={18}
            cy={18}
            r={R}
            fill="none"
            stroke={ring.accent ? "var(--color-accent)" : "var(--color-foreground-secondary)"}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.22,0.61,0.36,1)" }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-foreground">
          <SurfaceIcon name={ring.icon} size={15} />
        </span>
      </div>
      <span className="whitespace-nowrap font-mono text-[8.5px] tracking-[0.02em] text-foreground-muted">
        {ring.value}
      </span>
    </div>
  );
}

export function TopChrome({
  rings,
  onLayout,
  onTheme,
}: {
  rings: RingStat[];
  onLayout?: () => void;
  onTheme?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const btn = "grid size-[30px] place-items-center rounded-[9px] text-foreground-secondary transition-colors hover:bg-surface-elevated";

  return (
    <div className="flex items-start justify-between px-1 pb-2.5 pt-1">
      <button type="button" onClick={onLayout} className={cn(btn)} aria-label="Layout options">
        <SurfaceIcon name="layout" size={18} />
      </button>
      <div className="flex gap-4 pt-px">
        {rings.map((r) => (
          <Ring key={r.icon} ring={r} mounted={mounted} />
        ))}
      </div>
      <button type="button" onClick={onTheme} className={cn(btn)} aria-label="Toggle theme">
        <SurfaceIcon name="sun" size={17} />
      </button>
    </div>
  );
}
