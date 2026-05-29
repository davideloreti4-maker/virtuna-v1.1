'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
// W5: typed import — AnalysisStream alias added to use-analysis-stream in this plan.
// analysisId field is string | null (confirmed from AnalysisStreamReturn interface).
import { useAnalysisStream, type AnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { useBoardStore } from '@/stores/board-store';
import { getFrameAntiViralityState } from '../cross-group-state';
import { PercentileChip } from './PercentileChip';
import { AntiViralityHeader } from './AntiViralityHeader';
import { WhyVerdictCollapsible } from './WhyVerdictCollapsible';
import { VsHistoryCollapsible } from './VsHistoryCollapsible';
import { COPY, TELEMETRY, deriveVerdictSummary } from './verdict-constants';
import type { VerdictNodeProps } from './verdict-types';
import { logger } from '@/lib/logger';

export function VerdictNode({ camera: _camera, layout: _layout }: VerdictNodeProps) {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream: AnalysisStream = useAnalysisStream({ initialData: permalinkData ?? null });
  // Direct typed read from AnalysisStream — no cast needed (W5 fix).
  // analysisId is string | null per AnalysisStreamReturn interface.
  const analysisId = stream.analysisId ?? '';
  const result = stream.result ?? null;
  const phase = stream.phase;

  const boardMachineState = useBoardStore((s) => s.boardState);
  // avState consumed by future plans 5.3/5.4 collapsibles (pre-target counterfactual sub-section).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void getFrameAntiViralityState('verdict', boardMachineState);

  const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';
  const isComplete = boardMachineState === 'complete' || boardMachineState === 'anti-virality';

  // Always-on driver/risk summary — surfaces the verdict's "why" even when the
  // reasoning accordion is collapsed (the full factor breakdown stays inside it).
  const summary = useMemo(
    () => (result ? deriveVerdictSummary(result.factors) : null),
    [result],
  );

  // Debounced aria-live announcement (500ms after complete).
  const [ariaText, setAriaText] = useState<string>('');
  const announcedRef = useRef(false);
  useEffect(() => {
    if (!isComplete || !result || announcedRef.current) return;
    announcedRef.current = true;
    const handle = window.setTimeout(() => {
      setAriaText(COPY.ARIA_VERDICT_READY(result.overall_score, result.confidence_label));
    }, 500);
    return () => window.clearTimeout(handle);
  }, [isComplete, result]);

  // AV-specific announcement. Deferred via timeout (mirrors the debounced
  // announce effect above) so the setState isn't synchronous in the effect
  // body — avoids the cascading-render path React Compiler flags.
  useEffect(() => {
    if (boardMachineState !== 'anti-virality') return;
    const handle = window.setTimeout(() => setAriaText(COPY.ARIA_ANTI_VIRALITY), 0);
    return () => window.clearTimeout(handle);
  }, [boardMachineState]);

  // verdict_node_rendered telemetry (one-shot on first complete).
  const renderedRef = useRef(false);
  useEffect(() => {
    if (!isComplete || !result || renderedRef.current) return;
    renderedRef.current = true;
    logger.info(TELEMETRY.VERDICT_NODE_RENDERED, {
      score: result.overall_score,
      confidence_label: result.confidence_label,
      anti_virality_gated: result.anti_virality_gated,
    });
  }, [isComplete, result]);

  return (
    <div
      aria-live="polite"
      aria-busy={isStreaming}
      className="relative flex h-full w-full flex-col gap-3 overflow-y-auto"
      data-testid="verdict-node"
    >
      {/* Sr-only announcement region — content is read on update */}
      <span className="sr-only" data-testid="verdict-aria-live">
        {ariaText}
      </span>

      <AntiViralityHeader result={result} analysisId={analysisId} />

      <div className="pb-2" data-testid="verdict-percentile-container">
        <PercentileChip
          score={result?.overall_score ?? null}
          confidenceLabel={result?.confidence_label ?? null}
          isCalibrated={true}
        />
      </div>

      {summary && (summary.driver || summary.risk) && (
        <div data-testid="verdict-summary" className="flex flex-col gap-2 px-1">
          {summary.driver && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-normal uppercase tracking-[0.04em] text-[var(--color-success)]/80">
                Driving it
              </span>
              <p className="text-xs leading-[1.45] text-white/75">
                <span className="font-medium text-white/90">{summary.driver.name}</span>
                {summary.driver.rationale ? ` — ${summary.driver.rationale}` : ''}
              </p>
            </div>
          )}
          {summary.risk && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-normal uppercase tracking-[0.04em] text-accent/80">
                Watch out
              </span>
              <p className="text-xs leading-[1.45] text-white/75">
                <span className="font-medium text-white/90">{summary.risk.name}</span>
                {summary.risk.tip ? ` — ${summary.risk.tip}` : ''}
              </p>
            </div>
          )}
        </div>
      )}

      <div data-testid="verdict-collapsibles-slot" className="flex flex-col gap-2 px-1 mt-2">
        {result && <WhyVerdictCollapsible result={result} />}
        {result && analysisId && (
          <VsHistoryCollapsible analysisId={analysisId} currentScore={result.overall_score} />
        )}
      </div>
    </div>
  );
}
