"use client";

import type { Temperature } from "@/lib/audience/audience-types";
import { cn } from "@/lib/utils";

export interface AudienceTempBarProps {
  mix: Record<Temperature, number>;
  className?: string;
}

const SEGMENTS: Temperature[] = ["cold", "warm", "hot"];

/**
 * Three-segment cream-alpha temperature bar — neutral, no accent.
 */
export function AudienceTempBar({ mix, className }: AudienceTempBarProps) {
  const total = mix.cold + mix.warm + mix.hot;
  if (total <= 0) return null;

  return (
    <div
      className={cn("flex h-1 w-full max-w-[140px] gap-px overflow-hidden rounded-full", className)}
      role="img"
      aria-label={`Temperature mix: ${Math.round(mix.cold * 100)}% cold, ${Math.round(mix.warm * 100)}% warm, ${Math.round(mix.hot * 100)}% hot`}
    >
      {SEGMENTS.map((seg) => {
        const pct = (mix[seg] / total) * 100;
        if (pct <= 0) return null;
        const alpha = seg === "warm" ? 0.38 : seg === "cold" ? 0.22 : 0.5;
        return (
          <div
            key={seg}
            className="h-full min-w-[2px] rounded-full"
            style={{
              flexGrow: pct,
              backgroundColor: `rgba(236, 231, 222, ${alpha})`,
            }}
          />
        );
      })}
    </div>
  );
}
