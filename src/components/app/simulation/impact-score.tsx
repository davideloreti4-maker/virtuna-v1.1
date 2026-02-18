'use client';

import type { ConfidenceLevel } from '@/lib/engine/types';
import { Badge } from '@/components/ui/badge';
import { Text, Caption } from '@/components/ui/typography';
import { GlassProgress } from '@/components/primitives';

interface HeroScoreProps {
  overall_score: number;
  confidence_label: ConfidenceLevel;
  behavioral_score: number;
  gemini_score: number;
  rule_score: number;
  trend_score: number;
  score_weights: {
    behavioral: number;
    gemini: number;
    rules: number;
    trends: number;
  };
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

const SIGNALS = [
  { key: 'behavioral' as const, label: 'Behavioral' },
  { key: 'gemini' as const, label: 'Gemini' },
  { key: 'rules' as const, label: 'Rules' },
  { key: 'trends' as const, label: 'Trends' },
] as const;

export function HeroScore({
  overall_score,
  confidence_label,
  behavioral_score,
  gemini_score,
  rule_score,
  trend_score,
  score_weights,
}: HeroScoreProps) {
  const { variant, text } = confidenceBadgeConfig[confidence_label];

  const scoreMap = {
    behavioral: behavioral_score,
    gemini: gemini_score,
    rules: rule_score,
    trends: trend_score,
  };

  return (
    <div className="py-1">
      {/* Top row: score + label + confidence */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-bold text-accent">{overall_score}</span>
            <Text as="span" size="lg" muted>/100</Text>
          </div>
          <Text as="p" size="sm" className="font-medium text-accent mt-1">
            {getScoreLabel(overall_score)}
          </Text>
        </div>
        <Badge variant={variant} size="sm">
          {text}
        </Badge>
      </div>

      {/* Signal breakdown 2×2 grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4">
        {SIGNALS.map(({ key, label }) => {
          const weightPct = Math.round(score_weights[key] * 100);
          const score = scoreMap[key];

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <Caption>{label} ({weightPct}%)</Caption>
                <Caption>{score}</Caption>
              </div>
              <GlassProgress value={score} size="sm" color="coral" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** @deprecated Use HeroScore. Kept for backward compatibility. */
export function ImpactScore({
  overall_score,
  confidence_label,
}: {
  overall_score: number;
  confidence_label: ConfidenceLevel;
}) {
  return (
    <HeroScore
      overall_score={overall_score}
      confidence_label={confidence_label}
      behavioral_score={0}
      gemini_score={0}
      rule_score={0}
      trend_score={0}
      score_weights={{ behavioral: 0.45, gemini: 0.25, rules: 0.20, trends: 0.10 }}
    />
  );
}
