'use client';

import { Info } from 'lucide-react';
import type { ConfidenceLevel } from '@/lib/engine/types';
import { GlassCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/typography';

interface ImpactScoreProps {
  overall_score: number; // 0-100
  confidence_label: ConfidenceLevel; // "HIGH" | "MEDIUM" | "LOW"
}

const confidenceBadgeConfig: Record<
  ConfidenceLevel,
  { variant: 'success' | 'warning' | 'error'; text: string }
> = {
  HIGH: { variant: 'success', text: 'High confidence' },
  MEDIUM: { variant: 'warning', text: 'Medium confidence' },
  LOW: { variant: 'error', text: 'Low confidence' },
};

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}

/**
 * ImpactScore - Displays the v2 overall impact score with confidence badge
 *
 * Uses GlassCard with coral accent for the hero score display.
 * - Header row: "Impact Score" label + confidence badge
 * - Large score number with /100 suffix
 * - Score label (Excellent/Good/Average/Below Average/Poor)
 */
export function ImpactScore({ overall_score, confidence_label }: ImpactScoreProps) {
  const { variant, text } = confidenceBadgeConfig[confidence_label];

  return (
    <GlassCard className="p-4">
      <div className="space-y-2">
        {/* Header: label + confidence badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Text as="span" size="sm" muted>
              Impact Score
            </Text>
            <Info className="h-4 w-4 text-foreground-muted" />
          </div>
          <Badge variant={variant} size="sm">
            {text}
          </Badge>
        </div>

        {/* Hero score */}
        <div className="flex items-baseline gap-1">
          <span className="text-6xl font-bold text-accent">{overall_score}</span>
          <Text as="span" size="lg" muted>
            /100
          </Text>
        </div>

        {/* Score label */}
        <Text as="p" size="sm" className="font-medium text-accent">
          {getScoreLabel(overall_score)}
        </Text>
      </div>
    </GlassCard>
  );
}
