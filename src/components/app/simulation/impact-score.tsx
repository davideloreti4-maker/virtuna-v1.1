'use client';

import { Info } from 'lucide-react';
import type { ImpactLabel } from '@/types/test';
import { GlassCard } from '@/components/ui/card';
import { Text } from '@/components/ui/typography';

interface ImpactScoreProps {
  score: number;
  label: ImpactLabel;
}

/**
 * ImpactScore - Displays the overall impact score with a rating label
 *
 * Uses GlassCard with coral accent for the score and label.
 * - Header with info icon
 * - Label (e.g., "Average") shown first in coral accent
 * - Large score number with /100 suffix
 */
export function ImpactScore({ score, label }: ImpactScoreProps) {
  return (
    <GlassCard className="p-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Text as="span" size="sm" muted>
            Impact Score
          </Text>
          <Info className="h-4 w-4 text-foreground-muted" />
        </div>
        <Text as="p" size="sm" className="font-medium text-accent">
          {label}
        </Text>
        <div className="flex items-baseline gap-1">
          <span className="text-6xl font-bold text-accent">{score}</span>
          <Text as="span" size="lg" muted>
            /100
          </Text>
        </div>
      </div>
    </GlassCard>
  );
}
