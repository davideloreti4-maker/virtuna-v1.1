'use client';

import { Info } from 'lucide-react';
import { GlassCard } from '@/components/ui/card';
import { Text } from '@/components/ui/typography';
import {
  AccordionRoot,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

interface InsightsSectionProps {
  insights: string[];
}

/**
 * Extract the first sentence from a string (up to first `. ` or first 80 chars).
 */
function getInsightSummary(insight: string): string {
  const dotIndex = insight.indexOf('. ');
  if (dotIndex !== -1 && dotIndex < 80) {
    return insight.slice(0, dotIndex + 1);
  }
  if (insight.length <= 80) {
    return insight;
  }
  return insight.slice(0, 80) + '...';
}

/**
 * InsightsSection - Displays AI-generated insights about the content
 *
 * Uses GlassCard with Accordion for expandable insight items.
 * Short insights (< 100 chars) render as plain text without accordion.
 * Longer insights show a summary trigger that expands to full text.
 */
export function InsightsSection({ insights }: InsightsSectionProps) {
  const shortInsights = insights.filter((i) => i.length < 100);
  const longInsights = insights.filter((i) => i.length >= 100);

  return (
    <GlassCard padding="md" hover="lift" blur="none">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Text as="span" size="sm" muted>
            Insights
          </Text>
          <Info className="h-4 w-4 text-foreground-muted" />
        </div>

        {/* Short insights rendered as plain text */}
        {shortInsights.length > 0 && (
          <div className="space-y-2">
            {shortInsights.map((insight, index) => (
              <Text key={index} size="sm" className="leading-relaxed text-foreground-secondary">
                {insight}
              </Text>
            ))}
          </div>
        )}

        {/* Long insights as expandable accordion items */}
        {longInsights.length > 0 && (
          <AccordionRoot type="single" collapsible>
            {longInsights.map((insight, index) => (
              <AccordionItem key={index} value={`insight-${index}`}>
                <AccordionTrigger className="text-sm">
                  {getInsightSummary(insight)}
                </AccordionTrigger>
                <AccordionContent>
                  <Text size="sm" muted className="leading-relaxed">
                    {insight}
                  </Text>
                </AccordionContent>
              </AccordionItem>
            ))}
          </AccordionRoot>
        )}
      </div>
    </GlassCard>
  );
}
