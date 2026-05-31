'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';
import type { KeyframeSegmentLike } from '@/components/board/_kit';
import { useBoardStore } from '@/stores/board-store';
import { getFrameAntiViralityState } from '../cross-group-state';
import { useScript } from './script/use-script';
import { ActionsContent } from './ActionsContent';
import { deriveActionsView } from './actions-derive';
import { TELEMETRY } from './actions-constants';
import type { ActionsNodeProps } from './actions-types';
import type { OptimalPostOverride } from './optimal-post/OptimalPostCard';
import type { OptimalPostWindow } from '@/lib/engine/optimal-post';
import type { CounterfactualResult, HookDecomposition, Suggestion } from '@/lib/engine/types';
import { logger } from '@/lib/logger';

export function ActionsNode({ camera: _camera, layout: _layout }: ActionsNodeProps) {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const permalinkFilmstrips = usePermalinkFilmstrips();
  const phase = stream.phase;
  const result = stream.result ?? null;
  // Derive the id from the row first, then the stream's own id (a freshly streamed
  // complete result may not carry `id`).
  const analysisId = (result as { id?: string } | null)?.id ?? stream.analysisId ?? null;
  // Gate on data presence, not phase — sibling node instances hydrate `result` via
  // the shared permalink cache while their `phase` lags at 'idle'.
  const ready = phase === 'complete' || result != null;

  // The frame owns "what to do": band-adaptive counterfactual fixes (+ top-level
  // advice fallback) and when-to-post. Score/verdict/breakdown belong to the
  // Score frame directly above — nothing here repeats a number.
  const counterfactuals =
    (result as { counterfactuals?: CounterfactualResult | null } | null)?.counterfactuals ?? null;
  const advice = (result as { suggestions?: Suggestion[] } | null)?.suggestions ?? undefined;
  const hook = (result as { hook_decomposition?: HookDecomposition | null } | null)
    ?.hook_decomposition ?? null;
  // weakest_modality steers which fix leads (the previously-dead signal, now wired).
  const weakest = (hook as { weakest_modality?: string } | null)?.weakest_modality ?? null;
  const postWindow =
    (result as { optimal_post_window?: OptimalPostWindow } | null)?.optimal_post_window ?? null;
  const postOverride =
    (result as { optimal_post_override?: OptimalPostOverride } | null)?.optimal_post_override ??
    null;
  // overall_score (0-100) — fallback band when Stage-11 counterfactuals are absent,
  // so a strong video gets the ship-led "Post it" hero, not a wall of generic advice.
  const score = (result as { overall_score?: number } | null)?.overall_score ?? null;

  // Real video keyframes for the per-fix thumbs (ContentAnalysisFrame pattern).
  // Merged URLs — live SSE stream wins, else permalink replay. Guard against an
  // undefined `filmstrips` (test mocks of useAnalysisStream may omit it).
  const streamFilmstrips = (stream as { filmstrips?: Record<number, string> }).filmstrips;
  const mergedFilmstrips = useMemo<Record<number, string>>(() => {
    if (streamFilmstrips && Object.keys(streamFilmstrips).length > 0) return streamFilmstrips;
    if (permalinkFilmstrips && Object.keys(permalinkFilmstrips).length > 0) return permalinkFilmstrips;
    return {};
  }, [streamFilmstrips, permalinkFilmstrips]);

  // Heatmap segments carry the time ranges (seconds) a fix's timestamp maps onto.
  const heatmapSegments =
    (result as { heatmap?: { segments?: KeyframeSegmentLike[] | null } | null } | null)?.heatmap
      ?.segments ?? null;
  const segments = useMemo<ReadonlyArray<KeyframeSegmentLike>>(
    () =>
      (heatmapSegments ?? []).map((s, i) => ({
        idx: s.idx ?? i,
        t_start: s.t_start ?? 0,
        t_end: s.t_end ?? 0,
        keyframe_uri: s.keyframe_uri ?? null,
      })),
    [heatmapSegments],
  );

  // Gate the per-row thumb on a REAL timeline — i.e. resolvable keyframe URLs are
  // present (mergedFilmstrips non-empty). Mirrors TopFixesList's "only anchor when
  // there's a real video timeline": in text / tiktok_url modes with no filmstrip
  // the rows render exactly as before (no thumb, no empty-gradient fallback, no
  // layout shift). has_video alone (no keyframes) would render broken fallbacks,
  // so it is NOT a sufficient gate here.
  const hasVideo = Object.keys(mergedFilmstrips).length > 0;

  const boardMachineState = useBoardStore((s) => s.boardState);
  const isAV = getFrameAntiViralityState('actions', boardMachineState) === 'anti-virality';

  // The hero rewrite (engine-derived hook opening line). Only fetched once
  // complete; falls back to the fix text inside ActionsContent when absent.
  const script = useScript(analysisId, phase);
  const openingLine =
    script.data && !script.data.is_empty_state ? script.data.script.opening_line : null;

  const view = deriveActionsView({ ready, counterfactuals, advice, weakest, isAV, score });

  // Telemetry: fire once per analysis on first complete render.
  const renderedRef = useRef(false);
  useEffect(() => {
    if (!result || renderedRef.current) return;
    if (boardMachineState !== 'complete' && boardMachineState !== 'anti-virality') return;
    renderedRef.current = true;
    logger.info(TELEMETRY.ACTIONS_VIEW_RENDERED, {
      analysis_id: analysisId,
      kind: view.kind,
      band: counterfactuals?.band ?? null,
    });
  }, [result, boardMachineState, view.kind, analysisId, counterfactuals]);

  const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';

  return (
    <div
      aria-live="polite"
      aria-busy={isStreaming}
      className="relative w-full"
      data-testid="actions-node"
    >
      <div
        className="flex w-full flex-col"
        data-testid="actions-grid"
        data-av={isAV ? 'true' : 'false'}
        data-view={view.kind}
      >
        <ActionsContent
          view={view}
          openingLine={openingLine}
          analysisId={analysisId}
          bestTime={{ window: postWindow, override: postOverride, analysisId }}
          filmstrips={mergedFilmstrips}
          segments={segments}
          hasVideo={hasVideo}
        />
      </div>
    </div>
  );
}
