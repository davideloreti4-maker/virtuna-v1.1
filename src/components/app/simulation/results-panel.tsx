'use client';

import { cn } from '@/lib/utils';
import type { TestResult } from '@/types/test';
import { ImpactScore } from './impact-score';
import { AttentionBreakdown } from './attention-breakdown';
import { VariantsSection } from './variants-section';
import { InsightsSection } from './insights-section';
import { ThemesSection } from './themes-section';
import { ShareButton } from './share-button';

interface ResultsPanelProps {
  result: TestResult;
  onRunAnother: () => void;
}

/**
 * ResultsPanel - Assembled results display panel
 *
 * Features:
 * - Sticky header with share button
 * - Scrollable content area with all result sections
 * - Sticky footer with "Run another test" button
 * - Max height with overflow scroll
 */
export function ResultsPanel({ result, onRunAnother }: ResultsPanelProps) {
  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl">
      {/* Header with share button */}
      <div className="sticky top-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 p-4 backdrop-blur">
        <h2 className="text-sm font-medium text-zinc-400">Simulation Results</h2>
        <ShareButton resultId={result.id} />
      </div>

      {/* Content */}
      <div className="space-y-8 p-6">
        {/* Impact Score */}
        <ImpactScore score={result.impactScore} label={result.impactLabel} />

        {/* Attention Breakdown */}
        <AttentionBreakdown attention={result.attention} />

        {/* Variants */}
        <VariantsSection variants={result.variants} />

        {/* Insights */}
        <InsightsSection insights={result.insights} />

        {/* Conversation Themes */}
        <ThemesSection themes={result.conversationThemes} />
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 border-t border-zinc-800 bg-zinc-900/95 p-4 backdrop-blur">
        <button
          type="button"
          onClick={onRunAnother}
          className={cn(
            'w-full rounded-xl px-6 py-3',
            'bg-orange-500 text-white',
            'text-sm font-medium',
            'transition-colors hover:bg-orange-600'
          )}
        >
          Run another test
        </button>
      </div>
    </div>
  );
}
