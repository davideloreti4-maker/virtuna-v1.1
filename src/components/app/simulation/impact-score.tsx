'use client';

import type { ConfidenceLevel } from '@/lib/engine/types';
import { Badge } from '@/components/ui/badge';
import { Text, Caption } from '@/components/ui/typography';
import { GlassProgress } from '@/components/primitives';

interface HeroScoreProps {
  overall_score: number;
  confidence_label: ConfidenceLevel;
  behavioral_score: number;
  gemini_score: number | null; // D-R1: null on video (Read no longer scores). Board re-sources the "Apollo" breakdown off the real Apollo composite in Phase 2 (F32).
  rule_score: number | null; // F43 (01-05): dead signal — emits null; rendered as 0 here (legacy/unmounted view)
  trend_score: number | null; // F43 (01-05): dead signal — emits null; rendered as 0 here (legacy/unmounted view)
  score_weights: {
    behavioral: number;
    apollo?: number; // Plan 03-04 (D-04): apollo replaces gemini as live blend term
    gemini?: number; // RETIRED from blend (Plan 03-04 D-04) — kept optional for back-compat
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

// Plan 03-04 (D-04): apollo replaces gemini as live blend term in the breakdown display.
const SIGNALS = [
  { key: 'behavioral' as const, label: 'Behavioral' },
  { key: 'apollo' as const, label: 'Apollo' },
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
  const { variant, text } = confidenceBadgeConfig[confidence_label] ?? confidenceBadgeConfig["MEDIUM"];

  // Plan 03-04 (D-04): apollo term replaces gemini in the breakdown.
  // gemini_score still surfaced for UI back-compat but labeled as "Apollo" composite here.
  const scoreMap = {
    behavioral: behavioral_score,
    apollo: gemini_score ?? 0, // D-R1: gemini_score null on video → 0 placeholder; Phase 2 (F32) re-sources this off the real Apollo composite
    rules: rule_score ?? 0, // F43: dead signal emits null → 0 for the (legacy/unmounted) breakdown bar
    trends: trend_score ?? 0, // F43: dead signal emits null → 0 for the (legacy/unmounted) breakdown bar
  };

  return (
    <div className="py-1">
      {/* Top row: score + label + confidence */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-bold text-foreground-secondary">{overall_score}</span>
            <Text as="span" size="lg" muted>/100</Text>
          </div>
          <Text as="p" size="sm" className="font-medium text-foreground-secondary mt-1">
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
          const weightPct = Math.round((score_weights[key] ?? 0) * 100);
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
      score_weights={{ behavioral: 0.45, apollo: 0.25, rules: 0.20, trends: 0.10 }}
    />
  );
}
