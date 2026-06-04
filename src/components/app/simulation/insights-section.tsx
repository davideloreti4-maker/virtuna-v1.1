'use client';

import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Text, Caption } from '@/components/ui/typography';
import type { CounterfactualSuggestionItem } from '@/lib/engine/types';

// =====================================================
// Phase 13 Plan 02 — SuggestionsSection rebuild (D-05 + D-06)
// Band-adaptive: low="What to Fix", mid="Improvements + What's Working", high="What's Working"
// Type badges: fix=accent, stretch=info, reinforcement=success
// Badge labels: "Fix" / "Stretch" / "Strength" (NOT "Reinforcement")
// =====================================================

interface SuggestionsSectionProps {
  suggestions: CounterfactualSuggestionItem[];
  band: 'low' | 'mid' | 'high';
}

const HEADER_BY_BAND = {
  low:  'What to Fix',
  mid:  'Improvements + What\'s Working',
  high: 'What\'s Working',
} as const;

function getTypeBadge(type: CounterfactualSuggestionItem['type']) {
  switch (type) {
    case 'fix':
      return { label: 'Fix', variant: 'accent' as const };
    case 'stretch':
      return { label: 'Stretch', variant: 'info' as const };
    case 'reinforcement':
      return { label: 'Strength', variant: 'success' as const };
  }
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * SuggestionsSection — Band-adaptive counterfactual suggestions.
 * Phase 13 D-05 + D-06: consumes result.counterfactuals.suggestions + band.
 * Phase 01 Plan 06 D4.1: empty suggestions → renders nothing (no fabricated fallback advice).
 * Null-guard is at results-panel.tsx (result.counterfactuals && ...) — this component
 * only fires when counterfactuals is non-null; empty suggestions = render nothing.
 *
 * @param suggestions — CounterfactualSuggestionItem[] from result.counterfactuals
 * @param band — 'low' | 'mid' | 'high' from result.counterfactuals.band
 */
export function SuggestionsSection({ suggestions, band }: SuggestionsSectionProps) {
  if (suggestions.length === 0) return null;

  const items = suggestions;

  return (
    <div className="py-1">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Text as="span" size="sm" className="opacity-60">
            {HEADER_BY_BAND[band]}
          </Text>
        </div>

        <div>
          {items.map((item, i) => {
            const badge = getTypeBadge(item.type);

            return (
              <div
                key={i}
                className="border-b border-border last:border-b-0 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant={badge.variant} size="sm">
                    {badge.label}
                  </Badge>
                  {item.signal_anchor && (
                    <Caption className="uppercase tracking-wider opacity-60">
                      {item.signal_anchor}
                    </Caption>
                  )}
                  {item.timestamp_ms > 0 && (
                    <Caption className="opacity-60">
                      <Clock className="h-3 w-3 inline mr-0.5" />
                      {formatTimestamp(item.timestamp_ms)}
                    </Caption>
                  )}
                </div>
                <Text size="sm" className="font-semibold">
                  {item.headline}
                </Text>
                <Text size="sm" className="text-foreground-secondary leading-relaxed">
                  {item.detail}
                </Text>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * @deprecated Use SuggestionsSection with band prop. Kept for backward compatibility.
 */
export const InsightsSection = SuggestionsSection;
