'use client';

import { Info } from 'lucide-react';

interface InsightsSectionProps {
  insights: string[];
}

/**
 * InsightsSection - Displays AI-generated insights about the content
 *
 * Features:
 * - Header with info icon
 * - List of insight paragraphs with relaxed line height
 */
export function InsightsSection({ insights }: InsightsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-zinc-400">Insights</h3>
        <Info className="h-4 w-4 text-zinc-500" />
      </div>

      <div className="space-y-2">
        {insights.map((insight, index) => (
          <p key={index} className="text-sm leading-relaxed text-zinc-300">
            {insight}
          </p>
        ))}
      </div>
    </div>
  );
}
