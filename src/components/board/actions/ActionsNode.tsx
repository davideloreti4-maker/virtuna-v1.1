'use client';
import { useEffect, useRef } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { useBoardStore } from '@/stores/board-store';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { getFrameAntiViralityState } from '../cross-group-state';
import { ActionsReshootHeroSlot } from './ActionsReshootHeroSlot';
import { ActionsOptimalPostSlot } from './ActionsOptimalPostSlot';
import { ActionsShareSlot } from './ActionsShareSlot';
import { TELEMETRY, ACTIONS_GRID_DEFAULT_ROWS, ACTIONS_GRID_AV_ROWS } from './actions-constants';
import type { ActionsNodeProps } from './actions-types';
import type { OptimalPostOverride } from './optimal-post/OptimalPostCard';
import type { OptimalPostWindow } from '@/lib/engine/optimal-post';
import { logger } from '@/lib/logger';

export function ActionsNode({ camera: _camera, layout: _layout }: ActionsNodeProps) {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const phase = stream.phase;
  const result = stream.result ?? null;
  const analysisId = (result as { id?: string } | null)?.id ?? null;
  const postWindow =
    (result as { optimal_post_window?: unknown } | null)?.optimal_post_window
      ? (result as { optimal_post_window: OptimalPostWindow }).optimal_post_window
      : null;
  const postOverride =
    (result as { optimal_post_override?: unknown } | null)?.optimal_post_override
      ? ((result as unknown as { optimal_post_override: OptimalPostOverride }).optimal_post_override)
      : null;
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
            <ActionsReshootHeroSlot
              className="col-span-2 min-h-[88px]"
              analysisId={analysisId}
              phase={phase}
              isAV={isAV}
            />
            {/* BOTTOM: two cells = Optimal + Share. */}
            <div
              className="col-span-2 grid grid-cols-2 gap-2"
              data-testid="actions-av-bottom-row"
            >
              <div className="min-h-[88px]"><ActionsOptimalPostSlot
                analysisId={analysisId}
                phase={phase}
                window={postWindow}
                override={postOverride}
              /></div>
              <div className="min-h-[88px]"><ActionsShareSlot /></div>
            </div>
          </>
        ) : (
          <>
            {/* DEFAULT: Reshoot | OptimalPost | Share — 3 cards */}
            <div className="min-h-[88px]"><ActionsReshootHeroSlot
              analysisId={analysisId}
              phase={phase}
              isAV={isAV}
            /></div>
            <div className="min-h-[88px]"><ActionsOptimalPostSlot
              analysisId={analysisId}
              phase={phase}
              window={postWindow}
              override={postOverride}
            /></div>
            <div className="col-span-2 min-h-[88px]"><ActionsShareSlot /></div>
          </>
        )}
      </div>
    </div>
  );
}
