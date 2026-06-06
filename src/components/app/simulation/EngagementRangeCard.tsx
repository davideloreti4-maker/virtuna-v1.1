'use client';

import type { EngagementRange } from '@/lib/engine/types';
import { Text, Caption } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

interface EngagementRangeCardProps {
  range: EngagementRange;
  className?: string;
}

/**
 * Format a view count to compact notation — e.g. 8000 → "8K", 40000 → "40K", 1200000 → "1.2M".
 */
function formatViews(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return k >= 10 ? `${Math.round(k)}K` : `${k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return n.toString();
}

/**
 * Render confidence as a short label — e.g. 0.75 → "Medium confidence".
 */
function confidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return 'High confidence';
  if (confidence >= 0.4) return 'Medium confidence';
  return 'Low confidence';
}

/**
 * EngagementRangeCard — grounded R11 engagement estimate.
 *
 * Renders the creator-baseline-relative lo–hi view range (never a false-precise point)
 * with confidence and basis label. Only rendered when predicted_engagement is non-null
 * (i.e. a creator baseline exists). On permalink reload the field is null (live-only this
 * phase, D-06) — the "estimate available on fresh run" caption makes that intentional.
 *
 * Raycast card styling: bg-transparent, white/[0.06] border, 12px radius, Inter font.
 * backdrop-filter via inline style (Lightning CSS strips it from CSS classes).
 */
export function EngagementRangeCard({ range, className }: EngagementRangeCardProps) {
  const { lo, hi, confidence, basis } = range;

  const confidenceLevel = confidence >= 0.7 ? 'high' : confidence >= 0.4 ? 'medium' : 'low';
  const confidenceDotColor =
    confidenceLevel === 'high'
      ? '#22c55e'   // green-500
      : confidenceLevel === 'medium'
        ? '#f59e0b' // amber-500
        : '#ef4444'; // red-500

  return (
    <div
      data-testid="engagement-range-card"
      className={cn('rounded-xl border border-white/[0.06] bg-transparent p-4', className)}
      style={{
        boxShadow: 'rgba(255,255,255,0.05) 0px 1px 0px 0px inset',
      }}
    >
      {/* Label row */}
      <div className="mb-3 flex items-center justify-between">
        <Caption className="text-foreground-muted uppercase tracking-wide text-[10px]">
          Estimated views
        </Caption>
        {/* Confidence dot + label */}
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={{ background: confidenceDotColor }}
            className="h-1.5 w-1.5 rounded-full"
          />
          <Caption className="text-foreground-muted">
            {confidenceLabel(confidence)}
          </Caption>
        </div>
      </div>

      {/* Range hero — lo – hi, never a single point */}
      <div className="flex items-baseline gap-1.5">
        <Text
          as="span"
          className="text-2xl font-semibold tabular-nums text-white"
        >
          {formatViews(lo)}
        </Text>
        <Text as="span" className="text-lg text-foreground-muted">
          –
        </Text>
        <Text
          as="span"
          className="text-2xl font-semibold tabular-nums text-white"
        >
          {formatViews(hi)}
        </Text>
      </div>

      {/* Basis label — history-relative framing (D-06) */}
      <Caption className="mt-1 text-foreground-muted">
        {basis}
      </Caption>

      {/* Reload affordance — R11 is LIVE-ONLY this phase; explains null on permalink reload */}
      <Caption className="mt-2 text-foreground-muted/60 text-[10px]">
        Estimate available on fresh run · updates per creator baseline
      </Caption>
    </div>
  );
}
