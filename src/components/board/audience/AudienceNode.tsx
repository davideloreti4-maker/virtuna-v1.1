'use client';

import { useMemo, useState, useCallback } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { usePerfStore } from '@/lib/perf-tier';
import { useAudienceChoreography } from './use-audience-choreography';
import { useClientWeights } from './use-client-weights';
import { AudienceHero } from './AudienceHero';
import { DropStrip } from './DropStrip';
import { RetentionChart } from './RetentionChart';
import { SegmentTable } from './SegmentTable';
import { MixFooter } from './MixFooter';
import { WeightOverrideDrawer } from './WeightOverrideDrawer';
import { useBoardStore } from '@/stores/board-store';
import { DEFAULT_PERSONA_WEIGHT_CONFIG } from '@/lib/engine/persona-weights';
import type { Camera, GroupFrameLayout } from '../board-types';
import { FrameTabs, FrameTabPanel, StatTileRow, type StatTileData } from '../_kit';
import {
  averageWatchThrough,
  buildDropMoments,
  buildInsight,
  buildPersonaNodes,
  buildSegmentGroups,
  cohortDropFrame,
  findBiggestDrop,
  heroVerdict,
  mixLabel,
  normalizeCurve,
  personasFinishing,
  SLOT_GROUPS,
  totalDuration,
  worstBadGroupKey,
  type CohortDropFrame,
  type SlotKey,
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

  // Reduced-motion source mirrors the choreography hook (OS preference OR a
  // low perf tier) so the persona-graph float matches the rest of the frame.
  const prefersReducedMotion = usePrefersReducedMotion();
  const perfTier = usePerfStore((st) => st.tier);
  const reducedMotion = prefersReducedMotion || perfTier === 'low';

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

  const insightParts = useMemo(
    () => buildInsight(heatmap?.segments, drop, segmentGroups),
    [heatmap?.segments, drop, segmentGroups],
  );

  // Hero insight as JSX — keep the coral time mark (the only accent in the line).
  const heroInsight = (
    <>
      {insightParts.lead}
      {insightParts.time != null && (
        <span className="font-semibold text-accent">{insightParts.time}</span>
      )}
      {insightParts.tail}
      {insightParts.addendum}
    </>
  );

  // Persona node-graph (hero visual): 10 personas → PersonaNode[]. The worst
  // slot group (badKey) is painted coral, matching the "Who leaves" tab.
  const personaNodes = useMemo(
    () => buildPersonaNodes(heatmap, result?.persona_simulation_results, badKey),
    [heatmap, result?.persona_simulation_results, badKey],
  );

  const verdict = useMemo(
    () => (watchThroughPct != null ? heroVerdict(watchThroughPct) : null),
    [watchThroughPct],
  );

  const mergedFilmstrips = useMemo<Record<number, string>>(() => {
    if (filmstrips && Object.keys(filmstrips).length > 0) return filmstrips;
    if (Object.keys(permalinkFilmstrips).length > 0) return permalinkFilmstrips;
    return (pendingVideo?.frames as Record<number, string> | undefined) ?? {};
  }, [filmstrips, permalinkFilmstrips, pendingVideo?.frames]);

  // Real-video gate: only surface keyframes when a real timeline exists. In
  // text/url/no-video modes this is false, so the "where they drop" strip and the
  // "who leaves" cohort thumbs never render (no empty state, no layout shift).
  const hasVideo = Object.keys(mergedFilmstrips).length > 0;

  // "Where they drop" — the biggest drop + next-worst moments, each resolved to a
  // real keyframe. Empty (so the strip is omitted) unless real frames exist.
  const dropMoments = useMemo(
    () => (hasVideo ? buildDropMoments(survivalCurve, heatmap?.segments, mergedFilmstrips, 3) : []),
    [hasVideo, survivalCurve, heatmap?.segments, mergedFilmstrips],
  );

  // "Who leaves" cohort thumbs — each slot's drop frame + timecode, keyed by slot.
  // Empty object when there's no real video (rows render exactly as before).
  const cohortFrames = useMemo<Partial<Record<SlotKey, CohortDropFrame>>>(() => {
    if (!hasVideo) return {};
    const out: Partial<Record<SlotKey, CohortDropFrame>> = {};
    for (const { key } of SLOT_GROUPS) {
      const frame = cohortDropFrame(heatmap, key, mergedFilmstrips);
      if (frame) out[key] = frame;
    }
    return out;
  }, [hasVideo, heatmap, mergedFilmstrips]);

  const nicheCompletion = useMemo<number | null>(() => {
    const raw = heatmap?.niche_completion_pct;
    if (raw == null) return null;
    return raw > 1.5 ? raw / 100 : raw;
  }, [heatmap?.niche_completion_pct]);

  const mixFooterLabel = useMemo(() => mixLabel(weights), [weights]);

  // ── Stat tiles (3): Avg watch-through · Niche completion % · Finishing n/10 ──
  const tiles = useMemo<StatTileData[]>(() => {
    const avg = averageWatchThrough(personaNodes);
    const { finishing, total } = personasFinishing(personaNodes);
    const nichePct = nicheCompletion != null ? Math.round(nicheCompletion * 100) : null;
    const out: StatTileData[] = [];
    // Provenance sub-labels: these are different lenses on completion, not the hero
    // number disagreeing with itself. Hero = predicted watch-through (canonical);
    // these are the persona-panel mean and the niche-slot cohort.
    out.push({ k: 'Avg watch-through', v: avg != null ? String(avg) : '—', u: avg != null ? '%' : undefined, s: 'persona avg' });
    out.push({ k: 'Niche completion', v: nichePct != null ? String(nichePct) : '—', u: nichePct != null ? '%' : undefined, s: 'niche slots' });
    out.push({ k: 'Finishing', v: total > 0 ? String(finishing) : '—', u: total > 0 ? `/${total}` : undefined, s: 'reach 90%+' });
    return out;
  }, [personaNodes, nicheCompletion]);

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

  // Root carries aria-busy only — deliberate announcements go through the
  // choreography hook's announce() global live region. A root aria-live here
  // re-announced every dynamic child (the storm VerdictNode already removed).
  return (
    <div aria-busy={isStreaming} className="flex w-full flex-col gap-4 p-4">
      <AudienceHero
        nodes={personaNodes}
        watchThroughPct={watchThroughPct}
        verdict={verdict ?? { word: 'Reading…', tone: 'neutral' }}
        insight={heroInsight}
        reducedMotion={reducedMotion}
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
          {dropMoments.length > 0 && <DropStrip moments={dropMoments} />}

          <StatTileRow tiles={tiles} />

          <FrameTabs
            tabs={[
              { value: 'retention', label: 'Retention' },
              { value: 'who-leaves', label: 'Who leaves' },
              { value: 'mix', label: 'Mix' },
            ]}
          >
            <FrameTabPanel value="retention">
              <RetentionChart
                curve={survivalCurve}
                heatmap={heatmap}
                drop={drop}
                totalDurationSec={totalDurationSec}
                filmstrips={mergedFilmstrips}
                nicheCompletionPct={nicheCompletion}
                isLoading={isLoading}
              />
            </FrameTabPanel>

            <FrameTabPanel value="who-leaves">
              <SegmentTable
                groups={segmentGroups}
                badKey={badKey}
                cohortFrames={cohortFrames}
                isLoading={isLoading}
              />
            </FrameTabPanel>

            <FrameTabPanel value="mix">
              <div className="flex flex-col gap-3">
                <MixFooter
                  label={mixFooterLabel}
                  open={overrideDrawerOpen}
                  onToggle={() => setOverrideDrawerOpen((v) => !v)}
                />
                {overrideDrawerOpen && (
                  <WeightOverrideDrawer
                    open={overrideDrawerOpen}
                    onOpenChange={setOverrideDrawerOpen}
                    analysisId={analysisId ?? ''}
                    currentWeights={weights}
                    onWeightsChange={setWeights}
                    onApply={handleOverrideApply}
                  />
                )}
              </div>
            </FrameTabPanel>
          </FrameTabs>
        </>
      )}
    </div>
  );
}
