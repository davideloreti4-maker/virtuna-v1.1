'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, RotateCcw, Brain } from 'lucide-react';
import type { PredictionResult } from '@/lib/engine/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Text, Caption } from '@/components/ui/typography';
import { HeroScore } from './impact-score';
import { FactorBreakdown } from './attention-breakdown';
import { BehavioralPredictionsSection } from './behavioral-predictions';
import { SuggestionsSection } from './insights-section';
import { ShareButton } from './share-button';

interface ResultsPanelProps {
  result: PredictionResult;
  onRunAnother: () => void;
}

function GlassSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-lg border border-white/[0.06] p-5', className)}
      style={{
        background: 'linear-gradient(137deg, rgba(17,18,20,0.75) 4.87%, rgba(12,13,15,0.9) 75.88%)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        boxShadow: 'rgba(255,255,255,0.15) 0px 1px 1px 0px inset, 0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      {children}
    </div>
  );
}

function WarningsBanner({ warnings }: { warnings: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (warnings.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
        <Text size="sm" className="flex-1 text-amber-400">
          {warnings.length} warning{warnings.length > 1 ? 's' : ''} detected
        </Text>
        <ChevronDown
          className={`h-4 w-4 text-amber-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-1.5 pt-2">
          {warnings.map((warning, idx) => (
            <Text key={idx} size="sm" className="text-amber-400/80 pl-6">
              {warning}
            </Text>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReasoningSection({ reasoning }: { reasoning: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!reasoning) return null;

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 py-1 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <Brain className="h-4 w-4 text-foreground-muted" />
        <Text as="span" size="sm" muted className="flex-1">
          AI Reasoning
        </Text>
        <ChevronDown
          className={`h-4 w-4 text-foreground-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <Text size="sm" muted className="pt-2 leading-relaxed whitespace-pre-wrap">
          {reasoning}
        </Text>
      </div>
    </div>
  );
}

function BottomBar({
  onRunAnother,
  latencyMs,
  engineVersion,
}: {
  onRunAnother: () => void;
  latencyMs: number;
  engineVersion: string;
}) {
  const latencySec = (latencyMs / 1000).toFixed(1);

  return (
    <div className="flex items-center gap-2 pt-1">
      <Button variant="secondary" size="sm" onClick={onRunAnother}>
        <RotateCcw className="h-3.5 w-3.5" />
        New test
      </Button>
      <ShareButton />
      <Caption className="ml-auto">
        {latencySec}s · {engineVersion}
      </Caption>
    </div>
  );
}

export function ResultsPanel({ result, onRunAnother }: ResultsPanelProps) {
  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto">
      {/* Warnings */}
      {result.warnings.length > 0 && (
        <GlassSection>
          <WarningsBanner warnings={result.warnings} />
        </GlassSection>
      )}

      {/* Hero Score with signal breakdown */}
      <GlassSection>
        <HeroScore
          overall_score={result.overall_score}
          confidence_label={result.confidence_label}
          behavioral_score={result.behavioral_score}
          gemini_score={result.gemini_score}
          rule_score={result.rule_score}
          trend_score={result.trend_score}
          score_weights={result.score_weights}
        />
      </GlassSection>

      {/* Factor Breakdown */}
      <GlassSection>
        <FactorBreakdown factors={result.factors} />
      </GlassSection>

      {/* Behavioral Predictions */}
      <GlassSection>
        <BehavioralPredictionsSection predictions={result.behavioral_predictions} />
      </GlassSection>

      {/* Suggestions */}
      <GlassSection>
        <SuggestionsSection suggestions={result.suggestions} />
      </GlassSection>

      {/* AI Reasoning */}
      {result.reasoning && (
        <GlassSection>
          <ReasoningSection reasoning={result.reasoning} />
        </GlassSection>
      )}

      {/* Bottom Bar */}
      <GlassSection>
        <BottomBar
          onRunAnother={onRunAnother}
          latencyMs={result.latency_ms}
          engineVersion={result.engine_version}
        />
      </GlassSection>
    </div>
  );
}
