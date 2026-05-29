'use client';
import { useEffect, useRef } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { useBoardStore } from '@/stores/board-store';
import { getFrameAntiViralityState } from '../cross-group-state';
import { ActionsReshootHeroSlot } from './ActionsReshootHeroSlot';
import { ActionsFixesSlot } from './ActionsFixesSlot';
import { ActionsOptimalPostSlot } from './ActionsOptimalPostSlot';
import { TELEMETRY } from './actions-constants';
import type { ActionsNodeProps } from './actions-types';
import type { OptimalPostOverride } from './optimal-post/OptimalPostCard';
import type { OptimalPostWindow } from '@/lib/engine/optimal-post';
import type { CounterfactualResult, Factor, Suggestion } from '@/lib/engine/types';
import { logger } from '@/lib/logger';

export function ActionsNode({ camera: _camera, layout: _layout }: ActionsNodeProps) {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const phase = stream.phase;
  const result = stream.result ?? null;
  // Derive the id from the row first, then fall back to the stream's own id
  // (set from the `started`/permalink frame). A freshly *streamed* complete
  // result may not carry `id`, so relying on result.id alone left analysisId
  // null on fresh runs and tripped the slot placeholders.
  const analysisId = (result as { id?: string } | null)?.id ?? stream.analysisId ?? null;
  // Gate on data presence, not phase. Sibling node instances (Actions/Verdict/…)
  // hydrate `result` via the shared permalink cache but their `phase` can lag at
  // 'idle' — the old `phase !== 'complete'` gate left every Action card stuck on
  // the "Coming in Phase 6" placeholder even though the row was fully loaded
  // (Audience/Content render off `result` and showed data in the same state).
  const ready = phase === 'complete' || result != null;
  const postWindow =
    (result as { optimal_post_window?: unknown } | null)?.optimal_post_window
      ? (result as { optimal_post_window: OptimalPostWindow }).optimal_post_window
      : null;
  const postOverride =
    (result as { optimal_post_override?: unknown } | null)?.optimal_post_override
      ? ((result as unknown as { optimal_post_override: OptimalPostOverride }).optimal_post_override)
      : null;
  // Counterfactual fixes + factor scorecard ride along on the streamed result —
  // no extra fetch (the reshoot script still uses its own cached endpoint).
  const counterfactuals =
    (result as { counterfactuals?: CounterfactualResult | null } | null)?.counterfactuals ?? null;
  const factors = (result as { factors?: Factor[] } | null)?.factors ?? undefined;
  // Top-level engine suggestions (prioritised advice). Surfaced alongside the
  // timestamped counterfactual fixes so What-to-fix is useful even when
  // counterfactuals is null (e.g. Stage 11 degraded).
  const advice = (result as { suggestions?: Suggestion[] } | null)?.suggestions ?? undefined;
  const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';

  const boardMachineState = useBoardStore((s) => s.boardState);
  const avState = getFrameAntiViralityState('actions', boardMachineState);
  const isAV = avState === 'anti-virality';

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
      className="relative w-full"
      data-testid="actions-node"
    >
      {/* Inline section stack — everything lives in-frame, no drawers. Highest
          value first: the reshoot script, then "What to fix" (counterfactual
          fixes + factor scorecard), then "When to post". The frame auto-grows to
          fit the whole stack — no internal scroll. */}
      <div
        className="flex w-full flex-col gap-2 p-2"
        data-testid="actions-grid"
        data-av={isAV ? 'true' : 'false'}
      >
        <div className="overflow-hidden rounded-[8px]">
          <ActionsReshootHeroSlot
            className="overflow-hidden"
            analysisId={analysisId}
            phase={phase}
            ready={ready}
            isAV={isAV}
          />
        </div>
        <ActionsFixesSlot
          analysisId={analysisId}
          ready={ready}
          suggestions={counterfactuals?.suggestions}
          advice={advice}
          factors={factors}
        />
        <ActionsOptimalPostSlot
          analysisId={analysisId}
          ready={ready}
          window={postWindow}
          override={postOverride}
        />
      </div>
    </div>
  );
}
