'use client';

import { AlertTriangle, Info } from 'lucide-react';
import type { PredictionResult } from '@/lib/engine/types';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';
import { GlassCard } from '@/components/ui/card';
import { ImpactScore } from './impact-score';
import { FactorBreakdown } from './attention-breakdown';
import { BehavioralPredictionsSection } from './behavioral-predictions';
import { SuggestionsSection } from './insights-section';
import { ShareButton } from './share-button';
import { TierGate } from '@/components/tier-gate';

interface ResultsPanelProps {
  result: PredictionResult;
  onRunAnother: () => void;
}

/**
 * ResultsPanel - Assembled v2 results display panel
 *
 * Consumes PredictionResult directly (no TestResult shim).
 * Layout: warnings -> hero score -> factor breakdown -> behavioral predictions ->
 * suggestions -> persona reactions placeholder -> run another button.
 *
 * Features:
 * - Sticky header with share button
 * - Scrollable content area with all v2 result sections
 * - Sticky footer with "Run another test" button
 * - Plain div container (NOT GlassPanel) to avoid double glass with child GlassCards
 */
export function ResultsPanel({ result, onRunAnother }: ResultsPanelProps) {
  return (
    <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface shadow-xl">
      {/* Header with share button */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 p-4 backdrop-blur">
        <Text size="sm" muted>Results</Text>
        <ShareButton />
      </div>

      {/* Content */}
      <div className="space-y-4 p-4">
        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="space-y-2">
            {result.warnings.map((warning, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <Text size="sm" className="text-warning">
                  {warning}
                </Text>
              </div>
            ))}
          </div>
        )}

        {/* Impact Score */}
        <ImpactScore
          overall_score={result.overall_score}
          confidence_label={result.confidence_label}
        />

        {/* Factor Breakdown */}
        <FactorBreakdown factors={result.factors} />

        {/* Behavioral Predictions */}
        <BehavioralPredictionsSection predictions={result.behavioral_predictions} />

        {/* Suggestions */}
        <SuggestionsSection suggestions={result.suggestions} />

        {/* Persona Reactions — Placeholder */}
        <GlassCard className="p-4" blur="sm" glow={false}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Text as="span" size="sm" muted>
                Audience Reactions
              </Text>
              <Info className="h-4 w-4 text-foreground-muted" />
            </div>
            <Text size="sm" muted className="italic">
              Persona reactions will appear here once the engine generates them.
            </Text>
          </div>
        </GlassCard>
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
