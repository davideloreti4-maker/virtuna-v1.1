'use client';
import { useEffect, useRef, useState } from 'react';
// W5: typed import — AnalysisStream alias added to use-analysis-stream in this plan.
// analysisId field is string | null (confirmed from AnalysisStreamReturn interface).
import { useAnalysisStream, type AnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { useBoardStore } from '@/stores/board-store';
import { getFrameAntiViralityState } from '../cross-group-state';
import { PercentileChip } from './PercentileChip';
import { AntiViralityHeader } from './AntiViralityHeader';
import { WhyVerdictCollapsible } from './WhyVerdictCollapsible';
import { VsHistoryCollapsible } from './VsHistoryCollapsible';
import { COPY, TELEMETRY } from './verdict-constants';
import type { VerdictNodeProps } from './verdict-types';
import { logger } from '@/lib/logger';

export function VerdictNode({ camera: _camera, layout: _layout }: VerdictNodeProps) {
  const stream: AnalysisStream = useAnalysisStream();
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

  // AV-specific announcement
  useEffect(() => {
    if (boardMachineState === 'anti-virality') {
      setAriaText(COPY.ARIA_ANTI_VIRALITY);
    }
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
          isCalibrated={result?.is_calibrated ?? true}
        />
      </div>

      <div data-testid="verdict-collapsibles-slot" className="flex flex-col gap-2 px-1 mt-2">
        {result && <WhyVerdictCollapsible result={result} />}
        {result && analysisId && (
          <VsHistoryCollapsible analysisId={analysisId} currentScore={result.overall_score} />
        )}
      </div>
    </div>
  );
}
