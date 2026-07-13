"use client";

/**
 * AudienceCompositionBar — the audience's mark, made of its own data.
 *
 * One segment per persona: width = that persona's share, tone = their temperature
 * (cold → quiet cream, warm → cream, hot → accent). Replaces the retired
 * `AudienceConstellationThumb`, whose dot-scatter carried no information on any row
 * without personas — and rendered an identical static placeholder on all of them.
 *
 * An audience with nothing behind it renders an explicitly empty (dashed) track.
 * We never decorate an absence.
 */

import { getCompositionSegments } from "./audience-display";
import type { Audience, Temperature } from "@/lib/audience/audience-types";
import { cn } from "@/lib/utils";

/**
 * Temperature is encoded as BRIGHTNESS, not hue. An earlier cut tinted every hot persona
 * with the accent, which put several accent blocks on every row of the index — the exact
 * opposite of the locked near-zero dosage rule (accent = liveness only, and on this surface
 * that budget is already spent on the default radio).
 */
const TEMP_FILL: Record<Temperature, string> = {
  cold: "rgba(236,231,222,0.22)",
  warm: "rgba(236,231,222,0.46)",
  hot: "rgba(236,231,222,0.82)",
};

export interface AudienceCompositionBarProps {
  audience: Audience;
  className?: string;
}

export function AudienceCompositionBar({ audience, className }: AudienceCompositionBarProps) {
  const segments = getCompositionSegments(audience);

  if (segments.length === 0) {
    return (
      <div
        className={cn(
          "h-[7px] w-full rounded-sm border border-dashed border-white/[0.10]",
          className,
        )}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className={cn("flex h-[7px] w-full gap-[2px]", className)} aria-hidden="true">
      {segments.map((seg, i) => (
        <span
          key={`${seg.temperature}-${i}`}
          className="rounded-[1px]"
          style={{
            flex: Math.max(seg.share, 0.01),
            background: TEMP_FILL[seg.temperature],
          }}
        />
      ))}
    </div>
  );
}
