"use client";

/**
 * GreetingRings — the streak / planned / accuracy rings, sat beside the greeting.
 *
 * Moved here from the top-center bar in the 2026-07-05 elevation: at-a-glance
 * progress reads better anchored to the human welcome than floating as top chrome.
 * Monochrome cream EXCEPT the accuracy arc — the ONE sanctioned terracotta signal
 * (DESIGN-SYSTEM accent dosage). Arcs draw in on mount; reduced-motion lands at rest.
 */

import { useEffect, useState } from "react";
import type { RingStat } from "@/lib/room-contract/mock-room";
import { SurfaceIcon } from "../icons";

const R = 15;
const C = 2 * Math.PI * R;

function Ring({ ring, mounted }: { ring: RingStat; mounted: boolean }) {
  const offset = mounted ? C * (1 - ring.pct) : C;
  return (
    <div className="flex flex-col items-center gap-[5px]" title={ring.label}>
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

export function GreetingRings({ rings }: { rings: RingStat[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex shrink-0 items-start gap-4">
      {rings.map((r) => (
        <Ring key={r.icon} ring={r} mounted={mounted} />
      ))}
    </div>
  );
}
