'use client';

import { Info } from 'lucide-react';
import { Text, Caption } from '@/components/ui/typography';
import { GlassProgress } from '@/components/primitives';
import type { BehavioralPredictions } from '@/lib/engine/types';

interface BehavioralPredictionsProps {
  predictions: BehavioralPredictions;
}

const STAT_CARDS = [
  { label: 'Completion', valueKey: 'completion_pct', percentileKey: 'completion_percentile' },
  { label: 'Share Rate', valueKey: 'share_pct', percentileKey: 'share_percentile' },
  { label: 'Comment Rate', valueKey: 'comment_pct', percentileKey: 'comment_percentile' },
  { label: 'Save Rate', valueKey: 'save_pct', percentileKey: 'save_percentile' },
] as const;

/**
 * BehavioralPredictions — Displays 4 stat cards for predicted behavioral metrics.
 *
 * Shows completion %, share %, comment %, and save % as scannable stat cards
 * with percentile context and progress bars. Responsive: 2x2 on narrow, 4-across on desktop.
 */
export function BehavioralPredictionsSection({ predictions }: BehavioralPredictionsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Text as="span" size="sm" muted>
          Predicted Behavior
        </Text>
        <Info className="h-4 w-4 text-foreground-muted" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {STAT_CARDS.map(({ label, valueKey, percentileKey }) => {
          const pct = predictions[valueKey];
          const percentile = predictions[percentileKey];

          return (
            <div
              key={label}
              className="rounded-[12px] border border-white/[0.06] p-3"
              style={{ boxShadow: 'rgba(255,255,255,0.05) 0px 1px 0px 0px inset' }}
            >
              <div className="flex flex-col gap-1.5">
                <Caption>{label}</Caption>
                <span className="text-2xl font-bold text-foreground">
                  {pct}
                  <span className="text-base font-normal text-foreground-muted">%</span>
                </span>
                <Caption>{percentile}</Caption>
                <GlassProgress value={pct} size="sm" color="coral" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
