'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAnalysisStream, type AnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { useBoardStore } from '@/stores/board-store';
import { AntiViralityHeader } from './AntiViralityHeader';
import { TopFixesList } from './TopFixesList';
import { ScoreDistribution, type NicheCohort } from './ScoreDistribution';
import { FactorBars } from './FactorBars';
import { SignalTiles } from './SignalTiles';
import { VsHistoryCollapsible } from './VsHistoryCollapsible';
import { useComparisons } from './use-comparisons';
import { COPY, TELEMETRY } from './verdict-constants';
import {
  bandLabel,
  comparativeLine,
  confidenceRange,
  deriveOneMove,
  deriveSignalTiles,
  formatTimestamp,
} from './verdict-derive';
import type { VerdictNodeProps } from './verdict-types';
import type { PredictionResult } from '@/lib/engine/types';
import { logger } from '@/lib/logger';

const CONFIDENCE_DOT: Record<'HIGH' | 'MEDIUM' | 'LOW', string> = {
  HIGH: 'var(--color-success)',
  MEDIUM: 'var(--color-warning)',
  LOW: 'var(--color-error)', // was bg-accent (coral) — coral is reserved for "you"/the fix
};

function Bolt() {
  return (
    <svg width="13" height="15" viewBox="0 0 13 15" fill="none" aria-hidden className="shrink-0">
      <path d="M7 0L0 8.5h4.5L5 15 13 6H8L7 0z" fill="var(--color-accent)" />
    </svg>
  );
}

function ZoneTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-[14px] flex items-baseline justify-between">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        {children}
      </span>
      {right && (
        <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-white/40">
          {right}
        </span>
      )}
    </div>
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

  const oneMove = useMemo(() => (result ? deriveOneMove(result) : null), [result]);
  const tiles = useMemo(() => (result ? deriveSignalTiles(result) : []), [result]);

  return (
    <div
      aria-busy={isStreaming}
      className="relative flex w-full flex-col"
      data-testid="verdict-node"
    >
      <span aria-live="polite" className="sr-only" data-testid="verdict-aria-live">
        {ariaText}
      </span>

      <AntiViralityHeader result={result} analysisId={analysisId} />

      {/* AV-gated: surface the specific fixes (replaces the one-move banner) */}
      {result && result.anti_virality_gated && (
        <div className="mb-[18px]" data-testid="verdict-av-fixes">
          <TopFixesList
            suggestions={result.counterfactuals?.suggestions ?? []}
            hasVideo={result.has_video}
          />
        </div>
      )}

      {/* ⚡ one move — only in the healthy state (AV header owns the gated state) */}
      {result && !result.anti_virality_gated && oneMove && (
        <div
          className="mb-[18px] flex items-center gap-[10px] rounded-[10px] px-[13px] py-[10px]"
          style={{
            background: 'linear-gradient(90deg, rgba(255,127,80,0.085), rgba(255,127,80,0) 70%)',
          }}
          data-testid="one-move-banner"
        >
          <Bolt />
          <span className="text-[12.5px] leading-[1.4] text-white/70">
            One move — <b className="font-semibold text-white">{oneMove.headline}</b>
            {oneMove.timestampMs != null && (
              <span className="text-white/50"> · at {formatTimestamp(oneMove.timestampMs)}</span>
            )}
          </span>
        </div>
      )}

      {/* ── Zone ①: the verdict ── */}
      {!result ? (
        <VerdictSkeleton />
      ) : (
        <VerdictHero result={result} niche={niche} />
      )}

      {/* ── Zone ②: what drives it ── */}
      {result && result.factors.length > 0 && (
        <div className="mt-[26px]">
          <ZoneTitle>What drives it</ZoneTitle>
          <FactorBars factors={result.factors} />
        </div>
      )}

      {/* ── Zone ③: signals ── */}
      {result && (tiles.length > 0 || analysisId) && (
        <div className="mt-[26px] flex flex-col gap-[15px]">
          {tiles.length > 0 && (
            <div>
              <ZoneTitle>Signals</ZoneTitle>
              <SignalTiles tiles={tiles} />
            </div>
          )}
          {analysisId && (
            <VsHistoryCollapsible analysisId={analysisId} currentScore={result.overall_score} />
          )}
        </div>
      )}
    </div>
  );
}

function VerdictHero({ result, niche }: { result: PredictionResult; niche: NicheCohort | null }) {
  const score = Math.round(result.overall_score);
  const label = result.confidence_label;
  const range = confidenceRange(score, result.confidence);
  const showRangeText = label !== 'HIGH';

  return (
    <div>
      <ZoneTitle right="vs your niche">The verdict</ZoneTitle>
      <div className="flex items-baseline gap-4">
        <div
          className="text-[62px] font-semibold leading-[0.78] tracking-[-0.04em] tabular-nums text-white/95"
          data-testid="verdict-score"
        >
          {score}
          <span className="align-super text-[0.3em] font-semibold text-white/40">/100</span>
        </div>
        <div className="flex-1 pb-0.5">
          <div className="text-[17px] font-semibold tracking-[-0.015em]" data-testid="band-label">
            {bandLabel(score)}
          </div>
          <div className="mt-[7px] text-[11.5px] leading-[1.5] text-white/55">
            <span className="font-semibold text-white/75">{comparativeLine(score, niche)}</span>
            <br />
            {label && (
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
            )}
            Confidence <span className="font-semibold text-white/75">{label}</span>
            {showRangeText && ` · likely ${Math.round(range.lo)}–${Math.round(range.hi)}`}
          </div>
        </div>
      </div>

      <ScoreDistribution
        score={score}
        niche={niche}
        range={range}
        showRangeText={showRangeText}
      />
    </div>
  );
}

function VerdictSkeleton() {
  return (
    <div data-testid="verdict-skeleton">
      <ZoneTitle right="vs your niche">The verdict</ZoneTitle>
      <div className="flex items-baseline gap-4">
        <div className="text-[62px] font-semibold leading-[0.78] tabular-nums text-white/25 motion-safe:animate-skeleton-breathe">
          --
        </div>
        <div className="flex-1 pb-0.5">
          <div className="text-[17px] font-semibold text-white/30 motion-safe:animate-skeleton-breathe">
            {COPY.SKELETON_CONFIDENCE}
          </div>
        </div>
      </div>
      <div
        className="mt-[18px] h-[114px] rounded-[12px] border border-white/[0.06] motion-safe:animate-skeleton-breathe"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0) 72%)',
        }}
      />
    </div>
  );
}
