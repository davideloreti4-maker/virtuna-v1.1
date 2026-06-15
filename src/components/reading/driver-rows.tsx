'use client';

import type { ApolloDimension } from '@/lib/engine/types';
import { formatTime } from '@/components/board/audience/audience-derive';
import { bandTone, type ScoreTone } from '@/components/board/verdict/verdict-derive';
import { cn } from '@/lib/utils';

// DriverRows — the three always-visible levers (READ-05/06, D-05/06/07/08).
//
// This is a NEW component, NOT a FactorBars reuse (RESEARCH correction #1):
// FactorBars consumes Factor[] on a 0-10 scale with a /max suffix, sorts
// strongest-first, tags the top "keep", and paints the weakest with the legacy
// coral gradient + a shadow glow. The Reading wants the OPPOSITE: 3 FIXED-ORDER
// ApolloDimensions on 0-100, neutral cream bars, ONLY the single weakest in its
// score-ZONE color (amber/red, NOT coral) + ⚠, and the Retention readout shows
// the drop TIMESTAMP (where it breaks) while its bar still fills by the score.
//
// We borrow ONLY FactorBars' grid + 5px bar geometry (L25-52). Everything else is
// rebuilt to the Apollo contract. The hero gauge owns the verdict color; the rows
// stay calm so the eye lands on the one lever to fix next time.

/** The closed union the container maps to a DrillSheet panel — never a reflected
 *  value (threat T-02-07). */
export type DriverPanelId = 'hook' | 'retention' | 'shareability';

/** Zone color tokens, keyed by bandTone (mirrors score-gauge's ZONE_VAR SSOT). */
const ZONE_VAR: Record<ScoreTone, string> = {
  good: 'var(--color-success)',
  warn: 'var(--color-warning)',
  crit: 'var(--color-error)',
  neutral: 'var(--color-warning)',
};

/** Neutral cream fill for the non-weakest bars — cream/white-alpha, NO coral,
 *  NO glow (D-07). Matte. */
const NEUTRAL_FILL =
  'linear-gradient(90deg, rgba(236,231,222,0.22), rgba(236,231,222,0.38))';

const clampPct = (n: number) => Math.max(0, Math.min(100, n));

interface RowSpec {
  panelId: DriverPanelId;
  label: string;
  /** 0-100 dimension score driving the bar fill. */
  score: number;
  /** What the value column prints (score, or the Retention drop timestamp). */
  value: string;
}

export interface DriverRowsProps {
  /** Apollo dimensions (length-6, 0-100). Null/undefined when the reasoner is
   *  unavailable (DeepSeek circuit-breaker open) — the rows then degrade. */
  dimensions: ApolloDimension[] | null | undefined;
  /** heatmap.weighted_top_dropoff_t in SECONDS — the Retention drop readout. */
  dropT: number | null | undefined;
  /** Open the DrillSheet for this lever (Phase-3 mount point). */
  onRowTap: (panelId: DriverPanelId) => void;
}

export function DriverRows({ dimensions, dropT, onRowTap }: DriverRowsProps) {
  const hook = dimensions?.find((d) => d.name === 'hook');
  const retention = dimensions?.find((d) => d.name === 'retention');
  const share = dimensions?.find((d) => d.name === 'share_pull');

  // D-13 degrade: no dimensions → render the three labels but NO bars/values, and
  // NEVER fabricate a 0 score. The thread shows the levers exist, not fake numbers.
  const degraded = !hook || !retention || !share;

  if (degraded) {
    return (
      <div data-testid="driver-rows" className="space-y-px">
        {(['Hook', 'Retention', 'Shareability'] as const).map((label) => (
          <div
            key={label}
            data-testid="driver-row"
            className="grid min-h-[44px] items-center gap-[15px] py-[8.5px]
                       grid-cols-[130px_1fr_42px] sm:grid-cols-[152px_1fr_42px]"
          >
            <span
              data-testid="driver-row-label"
              className="whitespace-nowrap text-[14px] font-medium text-foreground-secondary"
            >
              {label}
            </span>
            <span className="text-[13px] text-foreground-muted">Not available</span>
            <span aria-hidden="true" />
          </div>
        ))}
      </div>
    );
  }

  // Retention value = the drop timestamp (where it breaks); its bar still fills by
  // the retention SCORE (how good). The drop time is SECONDS → audience-derive's
  // formatTime (NOT the TopFixesList ms variant — correction #4 / Landmine 6).
  const retentionDropValue =
    dropT != null ? `⚠ ${formatTime(dropT)}` : `${retention.score}`;

  const rows: RowSpec[] = [
    { panelId: 'hook', label: 'Hook', score: hook.score, value: `${hook.score}` },
    {
      panelId: 'retention',
      label: 'Retention',
      score: retention.score,
      value: retentionDropValue,
    },
    {
      panelId: 'shareability',
      label: 'Shareability',
      score: share.score,
      value: `${share.score}`,
    },
  ];

  // Weakest = the single lowest score across the three (the one lever to fix).
  const weakestScore = Math.min(hook.score, retention.score, share.score);
  const weakestIdx = rows.findIndex((r) => r.score === weakestScore);
  const weakestZone = ZONE_VAR[bandTone(weakestScore)];

  return (
    <div data-testid="driver-rows" className="space-y-px">
      {rows.map((row, i) => {
        const isWeakest = i === weakestIdx;
        const pct = clampPct(row.score);
        // The weakest value already carries a ⚠ if it's the Retention row (drop
        // marker); otherwise prepend ⚠ to flag the lever-to-fix in non-Retention
        // weakest rows.
        const valueText =
          isWeakest && !row.value.startsWith('⚠') ? `⚠ ${row.value}` : row.value;

        return (
          <button
            key={row.panelId}
            type="button"
            data-testid={`driver-row-${row.panelId}`}
            onClick={() => onRowTap(row.panelId)}
            aria-label={`${row.label} — open detail`}
            className={cn(
              'grid w-full min-h-[44px] items-center gap-[15px] py-[8.5px] text-left',
              'grid-cols-[130px_1fr_42px] sm:grid-cols-[152px_1fr_42px]',
              'rounded-[8px] transition-colors hover:bg-white/[0.02]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50',
            )}
          >
            <span
              data-testid="driver-row-label"
              className="whitespace-nowrap text-[14px] font-medium text-foreground-secondary"
            >
              {row.label}
            </span>

            {/* track (6% border) > fill (neutral cream, or weakest = zone color). */}
            <span className="block h-[5px] w-full rounded-full bg-[var(--color-border)]">
              <span
                data-testid={`driver-row-fill-${row.panelId}`}
                className="block h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: isWeakest ? weakestZone : NEUTRAL_FILL,
                }}
              />
            </span>

            <span
              data-testid="driver-row-value"
              className={cn(
                'whitespace-nowrap text-right text-[14px] font-semibold tabular-nums',
                isWeakest ? 'text-foreground' : 'text-foreground-secondary',
              )}
              style={isWeakest ? { color: weakestZone } : undefined}
            >
              {valueText}
            </span>
          </button>
        );
      })}
    </div>
  );
}

DriverRows.displayName = 'DriverRows';
