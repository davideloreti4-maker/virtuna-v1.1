'use client';

import { Info } from 'lucide-react';
import { GlassCard } from '@/components/ui/card';
import { Text, Caption } from '@/components/ui/typography';
import { Badge } from '@/components/ui/badge';
import type { Suggestion } from '@/lib/engine/types';

interface SuggestionsSectionProps {
  suggestions: Suggestion[];
}

/**
 * Map suggestion priority to effort tag label and Badge variant.
 * - high priority = Quick Win (easy to act on, high impact)
 * - medium priority = Medium effort
 * - low priority = Major effort
 */
function getEffortTag(priority: Suggestion['priority']) {
  switch (priority) {
    case 'high':
      return { label: 'Quick Win', variant: 'success' as const };
    case 'medium':
      return { label: 'Medium', variant: 'warning' as const };
    case 'low':
      return { label: 'Major', variant: 'default' as const };
  }
}

/**
 * SuggestionsSection — Displays AI-generated suggestions with effort tags.
 *
 * After-only format: each suggestion shows the actionable text with category context
 * and an effort tag (Quick Win / Medium / Major). All suggestions are visible — no collapse.
 */
export function SuggestionsSection({ suggestions }: SuggestionsSectionProps) {
  if (suggestions.length === 0) return null;

  return (
    <GlassCard className="p-4" blur="sm" glow={false}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Text as="span" size="sm" muted>
            Suggestions
          </Text>
          <Info className="h-4 w-4 text-foreground-muted" />
        </div>

        <div>
          {suggestions.map((suggestion) => {
            const { label, variant } = getEffortTag(suggestion.priority);

            return (
              <div
                key={suggestion.id}
                className="border-b border-border last:border-b-0 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Caption className="uppercase tracking-wider">
                    {suggestion.category}
                  </Caption>
                  <Badge variant={variant} size="sm">
                    {label}
                  </Badge>
                </div>
                <Text size="sm" className="leading-relaxed text-foreground-secondary">
                  {suggestion.text}
                </Text>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

/**
 * @deprecated Use SuggestionsSection. Kept for backward compatibility until Plan 3 rewires ResultsPanel.
 */
export const InsightsSection = SuggestionsSection;
