'use client';
import { useEffect, useRef } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { useBoardStore } from '@/stores/board-store';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { getFrameAntiViralityState } from '../cross-group-state';
import { ActionsReshootHeroSlot } from './ActionsReshootHeroSlot';
import { ActionsOptimalPostSlot } from './ActionsOptimalPostSlot';
import { ActionsShareSlot } from './ActionsShareSlot';
import { SimilarVideosCard } from './SimilarVideosCard';
import { TELEMETRY, ACTIONS_GRID_DEFAULT_ROWS, ACTIONS_GRID_AV_ROWS } from './actions-constants';
import type { ActionsNodeProps } from './actions-types';
import { logger } from '@/lib/logger';

export function ActionsNode({ camera: _camera, layout: _layout }: ActionsNodeProps) {
  const stream = useAnalysisStream();
  const phase = stream.phase;
  const result = stream.result ?? null;
  const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';

  const boardMachineState = useBoardStore((s) => s.boardState);
  const avState = getFrameAntiViralityState('actions', boardMachineState);
  const isAV = avState === 'anti-virality';

  const prefersReducedMotion = usePrefersReducedMotion();

  // Telemetry: fire once per analysis on first complete render.
  const renderedRef = useRef(false);
  useEffect(() => {
    if (!result || renderedRef.current) return;
    if (boardMachineState !== 'complete' && boardMachineState !== 'anti-virality') return;
    renderedRef.current = true;
    logger.info(TELEMETRY.ACTIONS_RESHOOT_PLACEHOLDER_VISIBLE, {});
  }, [result, boardMachineState]);

  return (
    <div
      aria-live="polite"
      aria-busy={isStreaming}
      className="relative h-full w-full"
      data-testid="actions-node"
    >
      <div
        className="grid grid-cols-2 grid-rows-2 auto-rows-fr gap-2 p-2 h-full"
        style={{
          gridTemplateRows: isAV ? ACTIONS_GRID_AV_ROWS : ACTIONS_GRID_DEFAULT_ROWS,
          transition: prefersReducedMotion ? 'none' : 'grid-template-rows 200ms ease-out',
        }}
        data-testid="actions-grid"
        data-av={isAV ? 'true' : 'false'}
      >
        {isAV ? (
          <>
            {/* TOP: Reshoot hero spans both columns per D-10. */}
            <ActionsReshootHeroSlot className="col-span-2 min-h-[88px]" />
            {/* BOTTOM (B2 fix): three cells = Optimal + Similar slot + Share.
                Wrapped in a single col-span-2 container that lays the three cells out as a 3-col grid. */}
            <div
              className="col-span-2 grid grid-cols-3 gap-2"
              data-testid="actions-av-bottom-row"
            >
              <div className="min-h-[88px]"><ActionsOptimalPostSlot /></div>
              {/* SimilarVideosCard (Plan 5.6) — AV state bottom row slot.
                  Sits between OptimalPostSlot and ShareSlot per B2 / D-10. Share placeholder remains untouched. */}
              <div className="min-h-[88px]">
                <SimilarVideosCard
                  items={result?.retrieval_evidence}
                  signalAvailable={result?.signal_availability?.retrieval ?? false}
                />
              </div>
              <div className="min-h-[88px]"><ActionsShareSlot /></div>
            </div>
          </>
        ) : (
          <>
            {/* DEFAULT 2x2: Reshoot | OptimalPost | SimilarVideos | Share — all min-h-[88px] */}
            <div className="min-h-[88px]"><ActionsReshootHeroSlot /></div>
            <div className="min-h-[88px]"><ActionsOptimalPostSlot /></div>
            {/* SimilarVideosCard (Plan 5.6) — default 2x2 slot */}
            <div className="min-h-[88px]">
              <SimilarVideosCard
                items={result?.retrieval_evidence}
                signalAvailable={result?.signal_availability?.retrieval ?? false}
              />
            </div>
            <div className="min-h-[88px]"><ActionsShareSlot /></div>
          </>
        )}
      </div>
    </div>
  );
}
