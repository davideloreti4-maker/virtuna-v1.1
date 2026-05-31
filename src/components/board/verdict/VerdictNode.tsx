'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAnalysisStream, type AnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { useBoardStore } from '@/stores/board-store';
import { FrameHero, StatTileRow, FrameTabs, FrameTabPanel } from '../_kit';
import { AntiViralityHeader } from './AntiViralityHeader';
import { ScoreDistribution, type NicheCohort } from './ScoreDistribution';
import { FactorBars } from './FactorBars';
import { SignalTiles } from './SignalTiles';
import { VsHistoryCollapsible } from './VsHistoryCollapsible';
import { useComparisons } from './use-comparisons';
import { COPY, TELEMETRY } from './verdict-constants';
import {
  bandLabel,
  bandTone,
  confidenceRange,
  deriveBehavioralTiles,
  deriveGatedHero,
  deriveSignalTiles,
  nicheDelta,
} from './verdict-derive';
import type { VerdictNodeProps } from './verdict-types';
import type { PredictionResult } from '@/lib/engine/types';
import { logger } from '@/lib/logger';

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[11px] uppercase tracking-[0.08em] text-white/45">{children}</div>
  );
}

export function VerdictNode({ camera: _camera, layout: _layout }: VerdictNodeProps) {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream: AnalysisStream = useAnalysisStream({ initialData: permalinkData ?? null });
  const analysisId = stream.analysisId ?? '';
  const result = stream.result ?? null;
  const phase = stream.phase;

  const boardMachineState = useBoardStore((s) => s.boardState);
  const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';
  const isComplete = boardMachineState === 'complete' || boardMachineState === 'anti-virality';

  const { data: comparisons } = useComparisons(analysisId || null);
  const niche: NicheCohort | null = comparisons?.niche ?? null;
  const hasHistory = (comparisons?.history?.length ?? 0) > 0;

  // Debounced aria-live announcement (single polite region — root no longer
  // carries aria-live, killing the 3-overlapping-region announcement storm).
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

  useEffect(() => {
    if (boardMachineState !== 'anti-virality') return;
    const handle = window.setTimeout(() => setAriaText(COPY.ARIA_ANTI_VIRALITY), 0);
    return () => window.clearTimeout(handle);
  }, [boardMachineState]);

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

  const signalTiles = useMemo(() => (result ? deriveSignalTiles(result) : []), [result]);
  const behavioralTiles = useMemo(
    () => (result ? deriveBehavioralTiles(result) : []),
    [result],
  );

  return (
    <div
      aria-busy={isStreaming}
      className="relative flex w-full flex-col gap-4"
      data-testid="verdict-node"
    >
      <span aria-live="polite" className="sr-only" data-testid="verdict-aria-live">
        {ariaText}
      </span>

      {/* Gated override band — folded lead lives in the hero; this thin band
          keeps the "Post anyway →" escape hatch + the role="status" announcement. */}
      <AntiViralityHeader result={result} analysisId={analysisId} />

      {/* ── Hero: the single dominant number ── */}
      {!result ? <VerdictSkeleton /> : <VerdictHero result={result} niche={niche} />}

      {/* ── Tiles: behavioral percentiles (new row, not the engine signals) ── */}
      {result && behavioralTiles.length > 0 && <StatTileRow tiles={behavioralTiles} />}

      {/* ── Tabs: progressive depth ── */}
      {result && (
        <FrameTabs
          tabs={[
            { value: 'breakdown', label: 'Breakdown' },
            { value: 'distribution', label: 'Distribution' },
            ...(analysisId && hasHistory
              ? [{ value: 'history', label: 'History' }]
              : []),
          ]}
          defaultValue="breakdown"
        >
          <FrameTabPanel value="breakdown" className="flex flex-col gap-5">
            {result.factors.length > 0 && (
              <div>
                <SectionHead>What drives it</SectionHead>
                <FactorBars factors={result.factors} />
              </div>
            )}
            {signalTiles.length > 0 && (
              <div>
                <SectionHead>Engine signals</SectionHead>
                <SignalTiles tiles={signalTiles} />
              </div>
            )}
          </FrameTabPanel>

          <FrameTabPanel value="distribution">
            <VerdictDistribution result={result} niche={niche} />
          </FrameTabPanel>

          {analysisId && hasHistory && (
            <FrameTabPanel value="history">
              <VsHistoryCollapsible
                analysisId={analysisId}
                currentScore={result.overall_score}
              />
            </FrameTabPanel>
          )}
        </FrameTabs>
      )}
    </div>
  );
}

/** Hero — folds healthy + gated states into one dominant block. */
function VerdictHero({ result, niche }: { result: PredictionResult; niche: NicheCohort | null }) {
  const score = Math.round(result.overall_score);
  const gated = result.anti_virality_gated;
  const delta = nicheDelta(score, niche);
  const gatedHero = gated ? deriveGatedHero(result) : null;

  return (
    <FrameHero
      label="VIRALITY SCORE"
      status={
        gated
          ? { word: gatedHero!.word, tone: 'crit' }
          : { word: bandLabel(score), tone: bandTone(score) }
      }
      insight={
        gated ? (
          gatedHero!.insight ? (
            <span>
              Top fix — <b className="font-semibold text-white/85">{gatedHero!.insight}</b>
            </span>
          ) : (
            'Review the breakdown before posting.'
          )
        ) : undefined
      }
    >
      {/* Custom hero number row: the kit value block + a niche-median delta whose
          suffix the generic <Delta> can't carry. Single verdict-score testid. */}
      <div className="flex items-end gap-2">
        <span className="text-[44px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-white">
          <span data-testid="verdict-score">{score}</span>
          <span className="ml-1 text-[16px] font-medium text-white/40">/100</span>
        </span>
        {delta != null && delta !== 0 && (
          <span
            className={`mb-[6px] inline-flex items-center gap-[3px] text-[11px] font-medium tabular-nums ${
              delta > 0 ? 'text-success' : 'text-error'
            }`}
          >
            <span aria-hidden className="text-[7px] leading-none">
              {delta > 0 ? '▲' : '▼'}
            </span>
            {Math.abs(delta)} vs median
          </span>
        )}
      </div>
    </FrameHero>
  );
}

/** Distribution tab — the existing histogram/lane, plus the band label + the
 *  honest confidence caption that used to live beside the hero number. */
function VerdictDistribution({
  result,
  niche,
}: {
  result: PredictionResult;
  niche: NicheCohort | null;
}) {
  const score = Math.round(result.overall_score);
  const label = result.confidence_label;
  const range = confidenceRange(score, result.confidence);
  const showRangeText = label !== 'HIGH';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[14px] font-semibold tracking-[-0.01em]" data-testid="band-label">
          {bandLabel(score)}
        </span>
        {label && (
          <span className="text-[11px] text-white/55">
            <span
              className="mr-[5px] inline-block h-[5px] w-[5px] rounded-full align-middle"
              style={{
                background: CONFIDENCE_DOT[label],
                boxShadow: `0 0 6px ${CONFIDENCE_DOT[label]}`,
              }}
              data-testid="confidence-dot"
              data-confidence={label}
              aria-hidden
            />
            Confidence <span className="font-semibold text-white/75">{label}</span>
            {showRangeText && ` · likely ${Math.round(range.lo)}–${Math.round(range.hi)}`}
          </span>
        )}
      </div>
      <ScoreDistribution score={score} niche={niche} range={range} showRangeText={showRangeText} />
    </div>
  );
}

const CONFIDENCE_DOT: Record<'HIGH' | 'MEDIUM' | 'LOW', string> = {
  HIGH: 'var(--color-success)',
  MEDIUM: 'var(--color-warning)',
  LOW: 'var(--color-error)', // coral is reserved for "you"/the fix
};

function VerdictSkeleton() {
  return (
    <div data-testid="verdict-skeleton" className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-[0.1em] text-white/45">VIRALITY SCORE</span>
      <div className="flex items-end gap-2">
        <span className="text-[44px] font-semibold leading-none tabular-nums text-white/25 motion-safe:animate-skeleton-breathe">
          --
        </span>
      </div>
      <span className="text-[13px] font-semibold text-white/30 motion-safe:animate-skeleton-breathe">
        {COPY.SKELETON_CONFIDENCE}
      </span>
    </div>
  );
}
