'use client';

import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import type { ImpactLabel } from '@/types/test';

interface ImpactScoreProps {
  score: number;
  label: ImpactLabel;
}

const LABEL_COLORS: Record<ImpactLabel, string> = {
  Excellent: 'text-emerald-400',
  Good: 'text-emerald-400',
  Average: 'text-blue-400',
  'Below Average': 'text-amber-400',
  Poor: 'text-red-400',
};

/**
 * ImpactScore - Displays the overall impact score with a rating label
 *
 * Matches societies.io layout:
 * - Header with info icon
 * - Label (e.g., "Average") shown first
 * - Large score number with /100 suffix
 */
export function ImpactScore({ score, label }: ImpactScoreProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-zinc-400">Impact Score</h3>
        <Info className="h-4 w-4 text-zinc-500" />
      </div>
      <p className={cn('text-sm font-medium', LABEL_COLORS[label])}>{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-5xl font-bold', LABEL_COLORS[label])}>
          {score}
        </span>
        <span className="text-lg text-zinc-500">/100</span>
      </div>
    </div>
  );
}
