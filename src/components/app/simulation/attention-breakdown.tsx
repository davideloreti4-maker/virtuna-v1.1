'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import type { Factor } from '@/lib/engine/types';
import { GlassProgress } from '@/components/primitives';
import type { ProgressVariant } from '@/components/primitives/GlassProgress';
import { Text } from '@/components/ui/typography';

interface FactorBreakdownProps {
  factors: Factor[];
}

/** Fixed display order for consistency (muscle memory) */
const FACTOR_ORDER = [
  'Scroll-Stop Power',
  'Completion Pull',
  'Rewatch Potential',
  'Share Trigger',
  'Emotional Charge',
];

function getFactorColor(score: number): ProgressVariant {
  if (score >= 7) return 'coral';
  if (score >= 4) return 'default';
  return 'purple';
}

/**
 * Sort factors in the fixed display order.
 * If a factor name doesn't match the predefined order, it appears at the end
 * in its original position from the API response.
 */
function sortFactors(factors: Factor[]): Factor[] {
  const ordered: Factor[] = [];
  const remaining: Factor[] = [];

  // Build lookup by name
  const byName = new Map(factors.map((f) => [f.name, f]));

  for (const name of FACTOR_ORDER) {
    const factor = byName.get(name);
    if (factor) {
      ordered.push(factor);
      byName.delete(name);
    }
  }

  // Add any unmatched factors in their original order
  for (const factor of factors) {
    if (byName.has(factor.name)) {
      remaining.push(factor);
    }
  }

  return [...ordered, ...remaining];
}

/**
 * FactorBreakdown - Displays v2 TikTok factor breakdown with expand-on-click
 *
 * Shows 5 factors (Scroll-Stop Power, Completion Pull, Rewatch Potential,
 * Share Trigger, Emotional Charge) with horizontal progress bars.
 * Clicking a factor row reveals its improvement tip with smooth animation.
 */
export function FactorBreakdown({ factors }: FactorBreakdownProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sortedFactors = sortFactors(factors);

  return (
    <div className="py-1">
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-center gap-2">
          <Text as="span" size="sm" muted>
            Factor Breakdown
          </Text>
          <Info className="h-4 w-4 text-foreground-muted" />
        </div>

        {/* Factor rows */}
        <div className="space-y-3">
          {sortedFactors.map((factor) => {
            const isExpanded = expandedId === factor.id;
            const color = getFactorColor(factor.score);

            return (
              <div
                key={factor.id}
                className="cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : factor.id)}
              >
                <div className="space-y-1.5">
                  {/* Name + score row */}
                  <div className="flex items-center justify-between">
                    <Text as="span" size="sm" className="font-medium">
                      {factor.name}
                    </Text>
                    <Text as="span" size="sm" className="font-bold">
                      {factor.score.toFixed(1)} / 10
                    </Text>
                  </div>

                  {/* Progress bar */}
                  <GlassProgress
                    value={factor.score * 10}
                    color={color}
                    size="md"
                  />

                  {/* Expandable improvement tip */}
                  <div
                    className={`overflow-hidden transition-all duration-200 ${
                      isExpanded ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <Text
                      as="p"
                      size="sm"
                      muted
                      className="border-l-2 border-accent/30 pl-3 pt-1"
                    >
                      {factor.improvement_tip}
                    </Text>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Re-export with old name for backward compatibility during migration
export { FactorBreakdown as AttentionBreakdown };
