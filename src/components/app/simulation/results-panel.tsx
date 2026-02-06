'use client';

import type { TestResult } from '@/types/test';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
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
 * - Plain div container (NOT GlassPanel) to avoid double glass with child GlassCards
 */
export function ResultsPanel({ result, onRunAnother }: ResultsPanelProps) {
  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface shadow-xl">
      {/* Header with share button */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 p-4 backdrop-blur">
        <Text size="sm" muted>Simulation Results</Text>
        <ShareButton resultId={result.id} />
      </div>

      {/* Content */}
      <div className="space-y-4 p-4">
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
      <div className="sticky bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
        <Button variant="primary" className="w-full" onClick={onRunAnother}>
          Run another test
        </Button>
      </div>
    </div>
  );
}
