'use client';

import { useMemo, useState, useCallback } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';
import { useAudienceChoreography } from './use-audience-choreography';
import { useClientWeights } from './use-client-weights';
import { AudienceHero } from './AudienceHero';
import { RetentionChart } from './RetentionChart';
import { SegmentTable } from './SegmentTable';
import { MixFooter } from './MixFooter';
import { WeightOverrideDrawer } from './WeightOverrideDrawer';
import { useBoardStore } from '@/stores/board-store';
import { DEFAULT_PERSONA_WEIGHT_CONFIG } from '@/lib/engine/persona-weights';
import type { Camera, GroupFrameLayout } from '../board-types';
import {
  buildInsight,
  buildSegmentGroups,
  findBiggestDrop,
  mixLabel,
  normalizeCurve,
  statusWord,
  totalDuration,
  worstBadGroupKey,
} from './audience-derive';

export interface AudienceNodeProps {
  camera: Camera;
  layout: GroupFrameLayout;
}

/**
 * AudienceNode — wiring container for the redesigned Audience frame (v7).
 *
 * Owns the data layer (streaming, permalink hydration, client weight state) and
 * the pure derivations, then composes four presentational zones:
 *   AudienceHero → RetentionChart → SegmentTable → MixFooter (+ inline drawer).
 *
 * The frame chrome (title bar "Audience" + caret) is provided by the parent
 * GroupFrameOverlay / MobileFrameCard — this node renders only the body. Widths
 * are fluid (w-full) so it fits both the board GroupFrame and the mobile card.
 */
export function AudienceNode(props: AudienceNodeProps) {
  // camera + layout are part of the board node contract but this frame derives no
  // geometry from them (the parent GroupFrameOverlay handles positioning).
  void props.camera;
  void props.layout;
  // ── Data layer ──────────────────────────────────────────────────────────────
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const { result, phase, filmstrips, analysisId } = stream;
  const permalinkFilmstrips = usePermalinkFilmstrips();

  // Choreography hook — kept so the streaming state machine + aria announcements
  // still run. Its row/curve states aren't consumed by the new visual zones, but
  // the hook must always be called (Rules of Hooks) and drives a11y side effects.
  useAudienceChoreography(stream);

  // Client-side weight recompute.
  const heatmap = result?.heatmap ?? null;
  const initialWeights = heatmap?.weights ?? DEFAULT_PERSONA_WEIGHT_CONFIG.default;
  const { weights, setWeights, recomputedCurve, recomputedMetrics, isDirty } = useClientWeights(
    heatmap,
    initialWeights,
    result?.confidence ?? 1,
  );

  const pendingVideo = useBoardStore((s) => s.pendingVideo);

  // ── Local UI state ───────────────────────────────────────────────────────────
  const [overrideDrawerOpen, setOverrideDrawerOpen] = useState(false);

  // ── Phase flags ────────────────────────────────────────────────────────────
  const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';
  const hasPersonas = (heatmap?.personas?.length ?? 0) > 0;
  // Loading skeletons while streaming with no heatmap yet (progressive reveal).
  const isLoading = isStreaming && !heatmap;

  // ── Derivations ──────────────────────────────────────────────────────────────
  const totalDurationSec = useMemo(
    () => totalDuration(heatmap?.segments, pendingVideo?.duration ?? 30),
    [heatmap?.segments, pendingVideo?.duration],
  );

  // Hero number = watch-through %. Use recomputed completion when the drawer is
  // dirty (0-1 → ×100), else the Pass-1 behavioral completion (already 0-100).
  // Plain computed value — the React Compiler memoizes it; a manual useMemo had
  // deps the compiler couldn't preserve (preserve-manual-memoization), mirroring
  // the baselineCurve pattern in the previous AudienceNode.
  const behavioral = result?.behavioral_predictions ?? null;
  const recomputedCompletion = recomputedMetrics.weighted_completion_pct;
  const watchThroughPct: number | null = (() => {
    if (isDirty && heatmap) return Math.round(recomputedCompletion * 100);
    if (behavioral?.completion_pct != null) return Math.round(behavioral.completion_pct);
    if (heatmap) return Math.round(recomputedCompletion * 100);
    return null;
  })();

  const status = watchThroughPct != null ? statusWord(watchThroughPct) : '';

  const sub = useMemo(() => {
    const percentile = behavioral?.completion_percentile;
    return percentile ? `watch-through · ${percentile} of niche` : 'watch-through';
  }, [behavioral?.completion_percentile]);

  // Survival curve: recomputed (when available) else persisted weighted_curve.
  const survivalCurve = useMemo<number[] | null>(() => {
    if (recomputedCurve.length > 0) return recomputedCurve;
    return heatmap?.weighted_curve ?? null;
  }, [recomputedCurve, heatmap?.weighted_curve]);

  const drop = useMemo(
    () => (survivalCurve ? findBiggestDrop(normalizeCurve(survivalCurve)) : null),
    [survivalCurve],
  );

  const segmentGroups = useMemo(
    () => buildSegmentGroups(heatmap, result?.persona_simulation_results),
    [heatmap, result?.persona_simulation_results],
  );

  const badKey = useMemo(() => worstBadGroupKey(segmentGroups), [segmentGroups]);

  const insight = useMemo(
    () => buildInsight(heatmap?.segments, drop, segmentGroups),
    [heatmap?.segments, drop, segmentGroups],
  );

  const mergedFilmstrips = useMemo<Record<number, string>>(() => {
    if (filmstrips && Object.keys(filmstrips).length > 0) return filmstrips;
    if (Object.keys(permalinkFilmstrips).length > 0) return permalinkFilmstrips;
    return (pendingVideo?.frames as Record<number, string> | undefined) ?? {};
  }, [filmstrips, permalinkFilmstrips, pendingVideo?.frames]);

  const nicheCompletion = useMemo<number | null>(() => {
    const raw = heatmap?.niche_completion_pct;
    if (raw == null) return null;
    return raw > 1.5 ? raw / 100 : raw;
  }, [heatmap?.niche_completion_pct]);

  const mixFooterLabel = useMemo(() => mixLabel(weights), [weights]);

  // ── Override drawer apply (persist per-analysis weights) ─────────────────────
  const handleOverrideApply = useCallback(
    async (newWeights: typeof weights, saveAsDefault: boolean) => {
      if (analysisId) {
        await fetch(`/api/analyze/${analysisId}/override`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weights: newWeights, save_as_default: saveAsDefault }),
        });
      }
      setOverrideDrawerOpen(false);
      setWeights(newWeights);
    },
    [analysisId, setWeights],
  );

  // ── Empty state: post-analysis with no persona data ──────────────────────────
  const showEmptyState = !isStreaming && !hasPersonas;

  return (
    <div aria-live="polite" aria-busy={isStreaming} className="flex w-full flex-col">
      <AudienceHero
        watchThroughPct={watchThroughPct}
        status={status}
        sub={sub}
        insight={insight}
        isLoading={isLoading}
      />

      {showEmptyState ? (
        <div
          className="flex items-center justify-center py-8"
          data-testid="audience-empty-state"
          aria-live="polite"
        >
          <p className="text-center text-xs italic" style={{ color: 'rgba(255,255,255,0.34)' }}>
            Persona data isn&apos;t available for this analysis
          </p>
        </div>
      ) : (
        <>
          <RetentionChart
            curve={survivalCurve}
            heatmap={heatmap}
            drop={drop}
            totalDurationSec={totalDurationSec}
            filmstrips={mergedFilmstrips}
            nicheCompletionPct={nicheCompletion}
            isLoading={isLoading}
          />

          <SegmentTable groups={segmentGroups} badKey={badKey} isLoading={isLoading} />

          {!isLoading && (
            <>
              <MixFooter
                label={mixFooterLabel}
                open={overrideDrawerOpen}
                onToggle={() => setOverrideDrawerOpen((v) => !v)}
              />
              {overrideDrawerOpen && (
                <div className="mt-3">
                  <WeightOverrideDrawer
                    open={overrideDrawerOpen}
                    onOpenChange={setOverrideDrawerOpen}
                    analysisId={analysisId ?? ''}
                    currentWeights={weights}
                    onWeightsChange={setWeights}
                    onApply={handleOverrideApply}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
