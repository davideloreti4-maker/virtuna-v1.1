'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';
import { useAudienceChoreography } from './use-audience-choreography';
import { useClientWeights } from './use-client-weights';
import { HeadlineChips } from './HeadlineChips';
import { Filmstrip } from './Filmstrip';
import { RetentionCurve } from './RetentionCurve';
import { HeatmapDrawer } from './HeatmapDrawer';
import { TapPopover } from './TapPopover';
import { PersonaDetailInline } from './PersonaDetailInline';
import { WeightOverrideDrawer } from './WeightOverrideDrawer';
import { AntiViralityOverlay } from './AntiViralityOverlay';
import { AUDIENCE_FRAME_TITLE_BAR_H, derivePersonaInsight } from './audience-constants';
import { TITLE_BAR_HEIGHT } from '../board-constants';
import { useBoardStore } from '@/stores/board-store';
import type { Camera, GroupFrameLayout } from '../board-types';
import type { TapPopoverPayload } from './audience-types';
import { DEFAULT_PERSONA_WEIGHT_CONFIG } from '@/lib/engine/persona-weights';

// Suppress unused var — both AUDIENCE_FRAME_TITLE_BAR_H and TITLE_BAR_HEIGHT are the same value (36).
// Using TITLE_BAR_HEIGHT here per plan spec (synthetic NodeSpec derivation).
void AUDIENCE_FRAME_TITLE_BAR_H;

export interface AudienceNodeProps {
  camera: Camera;
  layout: GroupFrameLayout;
}

/**
 * AudienceNode — top-level Audience node composition shell.
 *
 * Owns all local UI state (popover / inspector / heatmap drawer / weight override drawer)
 * and routes events between leaf components (HeadlineChips → WeightOverrideDrawer,
 * HeatmapDrawer → TapPopover / PersonaInspector, RetentionCurve → TapPopover, etc.)
 *
 * D-01 stack order: HeadlineChips → Filmstrip → RetentionCurve → HeatmapDrawer → AntiViralityOverlay
 *
 * Mounted inside the Audience GroupFrameOverlay via Board.tsx children prop.
 */
export function AudienceNode({ camera: _camera, layout }: AudienceNodeProps) {
  // ── Data layer ──────────────────────────────────────────────────────────────
  // Hydrate from the /analyze/[id] permalink cache so the audience renders the
  // persisted result on direct nav. Without initialData useAnalysisStream
  // would start in 'idle' with result=null and the frame would stay blank.
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const { result, partial: _partial, phase, filmstrips, analysisId } = stream;
  // Persisted keyframes for permalink replay (live runs use stream.filmstrips).
  const permalinkFilmstrips = usePermalinkFilmstrips();

  // Choreography hook — drives row + curve state machine
  // Pass injected stream so it doesn't double-subscribe
  const { rowStates, curveState } = useAudienceChoreography(stream);

  // Client-side weight recompute
  const initialWeights = result?.heatmap?.weights ?? DEFAULT_PERSONA_WEIGHT_CONFIG.default;
  const { weights, setWeights, recomputedCurve, recomputedMetrics, antiViralityState } =
    useClientWeights(result?.heatmap ?? null, initialWeights, result?.confidence ?? 1);

  // ── Board store (for camera pan on jumpToSegment + pending video preview) ───
  const setActivePreset = useBoardStore((s) => s.setActivePreset);
  const pendingVideo = useBoardStore((s) => s.pendingVideo);

  // ── Local UI state ─────────────────────────────────────────────────────────
  // Heatmap personas visible by default — the persona grid is core value, not an
  // opt-in drawer (board UX overhaul). The toggle is kept for power users.
  const [heatmapOpen, setHeatmapOpen] = useState(true);

  // Selected persona for the INLINE detail panel (replaces the old Sheet popup).
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  const [overrideDrawerOpen, setOverrideDrawerOpen] = useState(false);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPayload, setPopoverPayload] = useState<TapPopoverPayload | null>(null);
  const [popoverAnchorPos, setPopoverAnchorPos] = useState<{ x: number; y: number } | null>(null);

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalDurationSec = useMemo(() => {
    const segs = result?.heatmap?.segments;
    if (!segs || segs.length === 0) return pendingVideo?.duration ?? 30;
    return segs[segs.length - 1]!.t_end;
  }, [result?.heatmap?.segments, pendingVideo?.duration]);

  // fixTextBySegment: maps dropoff_segment_indices → fix text from counterfactuals.
  // TODO(OQ-2): resolve exact counterfactual field name once Phase 5 Verdict node ships.
  // For now, use a graceful fallback for each affected segment index.
  const fixTextBySegment = useMemo<Record<number, string>>(() => {
    const dropoffIndices = antiViralityState.dropoff_segment_indices;
    if (dropoffIndices.length === 0) return {};

    // If counterfactuals has suggestions, try to map them to segment indices
    const counterfactuals = result?.counterfactuals;
    if (counterfactuals && Array.isArray((counterfactuals as { suggestions?: unknown[] }).suggestions)) {
      const suggestions = (counterfactuals as { suggestions: Array<{ text?: string; fix?: string }> }).suggestions;
      return dropoffIndices.reduce<Record<number, string>>((acc, idx, i) => {
        const suggestion = suggestions[i];
        acc[idx] = suggestion?.text ?? suggestion?.fix ?? 'rework segment';
        return acc;
      }, {});
    }

    // Fallback: generic fix text per segment
    return dropoffIndices.reduce<Record<number, string>>((acc, idx) => {
      acc[idx] = 'rework segment';
      return acc;
    }, {});
  }, [antiViralityState.dropoff_segment_indices, result?.counterfactuals]);

  // Derive anti-virality x-range for RetentionCurve orange band
  const antiViralityXRange = useMemo((): [number, number] | null => {
    const idxs = antiViralityState.dropoff_segment_indices;
    const segs = result?.heatmap?.segments;
    if (!idxs.length || !segs) return null;
    const minIdx = Math.min(...idxs);
    const maxIdx = Math.max(...idxs);
    const startSeg = segs[minIdx];
    const endSeg = segs[maxIdx];
    if (!startSeg || !endSeg) return null;
    return [startSeg.t_start, endSeg.t_end];
  }, [antiViralityState.dropoff_segment_indices, result?.heatmap?.segments]);

  // HeadlineChips: fallback to persona_behavioral_aggregate when heatmap not ready
  const agg = result?.persona_behavioral_aggregate;

  // ── Event handlers ─────────────────────────────────────────────────────────

  const handleCellTap = useCallback(
    (personaId: string, segmentIdx: number, clientX: number, clientY: number) => {
      const hm = result?.heatmap;
      const persona = hm?.personas.find((p) => p.id === personaId);
      const reason = persona?.segment_reasons?.[segmentIdx];
      const attention = persona?.attentions?.[segmentIdx] ?? 0;

      setPopoverPayload({
        kind: 'cell',
        personaId,
        segmentIdx,
        attention,
        reason,
      });
      setPopoverAnchorPos({ x: clientX, y: clientY });
      setPopoverOpen(true);
    },
    [result?.heatmap],
  );

  const handleRowLabelTap = useCallback((personaId: string) => {
    // Toggle the inline detail panel — click the same row again to collapse.
    setSelectedPersonaId((prev) => (prev === personaId ? null : personaId));
  }, []);

  const handleCurveTap = useCallback((payload: TapPopoverPayload) => {
    // Anchor to center of viewport as a fallback (curve canvas taps provide real coords)
    setPopoverPayload(payload);
    setPopoverAnchorPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setPopoverOpen(true);
  }, []);

  const handleFixChipTap = useCallback((segIdx: number, fixText: string) => {
    setPopoverPayload({ kind: 'fix-chip', segmentIdx: segIdx, fixText });
    setPopoverAnchorPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setPopoverOpen(true);
  }, []);

  const handleSeeFullFromPopover = useCallback(() => {
    setPopoverOpen(false);
    if (popoverPayload?.kind === 'cell' || popoverPayload?.kind === 'marker') {
      // Open the INLINE persona detail (no Sheet) for the tapped persona.
      setSelectedPersonaId(popoverPayload.personaId);
    }
    // fix-chip → navigate to verdict panel (future: setActivePreset('verdict'))
  }, [popoverPayload]);

  const handleWeightsBadgeClick = useCallback(() => {
    setOverrideDrawerOpen(true);
  }, []);

  const handleOverrideApply = useCallback(
    async (newWeights: typeof weights, saveAsDefault: boolean) => {
      if (!analysisId) return;
      // POST /api/analyze/[analysisId]/override to persist per-analysis weights
      // T-04-22: analysisId is non-secret URL component; RLS gates DB access
      await fetch(`/api/analyze/${analysisId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weights: newWeights, save_as_default: saveAsDefault }),
      });
      setOverrideDrawerOpen(false);
      setWeights(newWeights);
    },
    [analysisId, setWeights],
  );

  const handleJumpToSegment = useCallback(
    (_segIdx: number) => {
      // Pan camera to audience frame; future: scroll heatmap column into view
      setActivePreset('audience');
    },
    [setActivePreset],
  );

  // ── Heatmap CellTap adapter (HeatmapDrawer doesn't pass mouse coords) ─────
  // HeatmapDrawer passes (personaId, segmentIdx) without coords — anchor popover
  // to a fixed position within the node body.
  const handleHeatmapCellTap = useCallback(
    (personaId: string, segmentIdx: number) => {
      handleCellTap(personaId, segmentIdx, window.innerWidth / 2, window.innerHeight * 0.4);
    },
    [handleCellTap],
  );

  // ── Synthetic NodeSpec for NodeOverlay ─────────────────────────────────────
  const audienceSpec = useMemo(
    () => ({
      id: 'audience',
      groupId: 'audience' as const,
      bounds: {
        x: layout.bounds.x,
        y: layout.bounds.y + TITLE_BAR_HEIGHT,
        width: layout.bounds.width,
        height: layout.bounds.height - TITLE_BAR_HEIGHT,
      },
      ariaLabel: 'Audience analysis node',
    }),
    [layout],
  );

  const isStreaming = phase === 'analyzing' || phase === 'reconnecting' || phase === 'polling';

  // Always-on persona insight — the key audience takeaway (drop spread + earliest
  // outlier) surfaced above the heatmap, no row click required.
  const personaInsight = useMemo(
    () => {
      const personas = result?.heatmap?.personas;
      return personas?.length ? derivePersonaInsight(personas) : null;
    },
    [result?.heatmap?.personas],
  );

  // Retention (survival) curve — % of the weighted audience still watching at each
  // segment, derived from each persona's swipe_predicted_at. Monotonically decays
  // from ~100% → completion, so it reads like a real watch-time curve instead of
  // the near-flat mean-attention line. Weighted by the current slot weights.
  const survivalCurve = useMemo<number[] | null>(() => {
    const hm = result?.heatmap;
    if (!hm?.segments?.length || !hm.personas?.length) return null;
    const wf = weights as unknown as Record<string, number>;
    return hm.segments.map((seg) => {
      let num = 0;
      let den = 0;
      for (const p of hm.personas) {
        const w = wf[p.slot_type] ?? 0;
        den += w;
        const stillWatching =
          p.swipe_predicted_at == null || p.swipe_predicted_at >= seg.t_end;
        if (stillWatching) num += w;
      }
      return den > 0 ? num / den : 0;
    });
  }, [result?.heatmap, weights]);

  // Curve shown: survival (preferred) → recomputed attention → persisted curve.
  const weightedCurve =
    survivalCurve ??
    (recomputedCurve.length > 0
      ? recomputedCurve
      : result?.heatmap?.weighted_curve ?? null);

  // Baseline curve derived from persona_behavioral_aggregate.completion_pct (Pass 1)
  // Flat line at completion_pct across all segments (D-07: Pass 1 flat baseline).
  // Plain computed value — React Compiler memoizes it; a manual useMemo here had
  // deps the compiler couldn't preserve (preserve-manual-memoization).
  const baselineCurve: number[] | null = (() => {
    const pct = agg?.completion_pct;
    if (pct == null || !result?.heatmap?.segments) return null;
    const normalized = pct / 100;
    return result.heatmap.segments.map(() => normalized);
  })();

  // ── Render ─────────────────────────────────────────────────────────────────

  // NodeOverlay positions absolutely via layout.bounds.x. AudienceNode is mounted
  // INSIDE GroupFrameOverlay (Board.tsx:303), which already provides the absolute
  // positioning for the Audience frame. Rendering NodeOverlay here would double-apply
  // the bounds offset (visible as content shifted to the right of the frame).
  // Use the synthetic spec only for child positioning math (popover anchors, etc.).
  void audienceSpec;
  // Unit contract: weighted-aggregator emits *_pct as 0-1 floats; the Pass-1
  // fallback (persona_behavioral_aggregate.completion_pct) is already 0-100.
  // Scale weighted values to 0-100 here so HeadlineChips treats every numeric
  // prop uniformly. Use ?? (not ||) so a real 0 isn't coerced to undefined.
  // Guard recomputedMetrics with heatmap presence: the RAF in useClientWeights
  // exits early when heatmap=null, leaving stale numbers from the previous
  // analysis. Without this guard, Watch/Hook/Drop show old values after reset.
  const hasHeatmap = result?.heatmap != null;
  const rawCompletion =
    (hasHeatmap ? recomputedMetrics.weighted_completion_pct : null) ??
    result?.weighted_completion_pct ??
    null;
  const rawHook =
    (hasHeatmap ? recomputedMetrics.weighted_hook_score : null) ??
    result?.weighted_hook_score ??
    null;
  const scaledCompletion = rawCompletion == null ? null : rawCompletion * 100;
  const scaledHook = rawHook == null ? null : rawHook * 100;
  const scaledDropoff =
    (hasHeatmap ? recomputedMetrics.weighted_top_dropoff_t : null) ??
    result?.weighted_top_dropoff_t ??
    null;
  // LOOP — replay/loop rate. Lives on the (now-persisted) Pass-1 aggregate as a
  // 0-100 intent, so it's passed straight through (no *100 scaling). Independent
  // of the weight slider, so no recompute fallback.
  const loopPct = agg?.loop_pct ?? null;
  // VS NICHE — niche-only vs overall weighted completion (0-1 diff on heatmap),
  // scaled to a 0-100 percentage-point delta. HeadlineChips colors by sign.
  const rawVsNiche = result?.heatmap?.vs_niche_diff_pct ?? null;
  const scaledVsNiche = rawVsNiche == null ? null : rawVsNiche * 100;

  return (
    <>
      <div
          aria-live="polite"
          aria-busy={isStreaming}
          className="relative flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto"
        >
          {/* D-01: HeadlineChips — top of stack */}
          <HeadlineChips
            weighted_completion_pct={scaledCompletion}
            weighted_top_dropoff_t={scaledDropoff}
            weighted_hook_score={scaledHook}
            fallback={
              agg
                ? {
                    completion_pct: agg.completion_pct,
                    // Pass 1 agg doesn't have top_dropoff_t / hook_score — use 0 as sentinel
                    top_dropoff_t: 0,
                    hook_score: 0,
                  }
                : undefined
            }
            loop_pct={loopPct}
            vs_niche_diff_pct={scaledVsNiche}
            weights={weights}
            isStreaming={isStreaming}
            onWeightsBadgeClick={handleWeightsBadgeClick}
          />

          {/* Inline audience-mix override — expands in-frame under the chips when
              the "Weighted: …" badge is tapped (replaces the former right Sheet). */}
          <WeightOverrideDrawer
            open={overrideDrawerOpen}
            onOpenChange={setOverrideDrawerOpen}
            analysisId={analysisId ?? ''}
            currentWeights={weights}
            onWeightsChange={setWeights}
            onApply={handleOverrideApply}
          />

          {/* D-01: Filmstrip + shared time axis — directly below chips, acts as x-axis */}
          <div className="flex flex-col gap-1">
            <Filmstrip
              segments={result?.heatmap?.segments ?? null}
              filmstrips={
                filmstrips && Object.keys(filmstrips).length > 0
                  ? filmstrips
                  : Object.keys(permalinkFilmstrips).length > 0
                    ? permalinkFilmstrips
                    : (pendingVideo?.frames ?? {})
              }
              totalDurationSec={totalDurationSec}
              antiViralitySegmentIndices={antiViralityState.dropoff_segment_indices}
            />
            <div
              className="flex justify-between text-[9px] uppercase tracking-[0.06em] tabular-nums opacity-40"
              aria-hidden="true"
            >
              <span>0s</span>
              <span>{Math.round(totalDurationSec / 2)}s</span>
              <span>{Math.round(totalDurationSec)}s</span>
            </div>
          </div>

          {/* D-01: RetentionCurve — hidden when idle/reset (no data, not streaming) */}
          {(isStreaming || weightedCurve !== null || baselineCurve !== null) && (
            <RetentionCurve
              weightedCurve={weightedCurve}
              baselineCurve={baselineCurve}
              heatmap={result?.heatmap ?? null}
              totalDurationSec={totalDurationSec}
              morphRequested={curveState === 'morphing'}
              antiViralityXRange={antiViralityXRange}
              onTap={handleCurveTap}
              weightedCompletionPct={recomputedMetrics.weighted_completion_pct || (result?.weighted_completion_pct ?? 0)}
            />
          )}

          {/* Empty-state: shown when no persona data available (heatmap absent or no personas) */}
          {!isStreaming && (!result?.heatmap?.personas?.length) && (
            <div
              className="flex items-center justify-center py-3"
              data-testid="audience-empty-state"
              aria-live="polite"
            >
              <p className="text-center text-xs italic text-foreground-muted">
                Persona data isn&apos;t available for this analysis
              </p>
            </div>
          )}

          {/* Always-on persona insight headline — the audience takeaway in words. */}
          {!isStreaming && personaInsight && (
            <p
              className="px-1 text-[11px] leading-snug text-white/65"
              data-testid="persona-insight"
            >
              {personaInsight}
            </p>
          )}

          {/* D-01: HeatmapDrawer — collapsed by default (D-03) — hidden when no personas */}
          <HeatmapDrawer
            heatmap={result?.heatmap ?? null}
            rowStates={rowStates}
            totalDurationSec={totalDurationSec}
            isOpen={heatmapOpen}
            onOpenChange={setHeatmapOpen}
            onCellTap={handleHeatmapCellTap}
            onRowLabelTap={handleRowLabelTap}
          />

          {/* Inline persona detail — replaces the former PersonaInspector Sheet.
              Shown in-frame directly below the heatmap when a persona is selected
              (click a row label, or "See full" in a tap popover). */}
          {selectedPersonaId && (
            <PersonaDetailInline
              personaId={selectedPersonaId}
              heatmap={result?.heatmap ?? null}
              pass1Confidence={result?.confidence}
              onJumpToSegment={handleJumpToSegment}
              onClose={() => setSelectedPersonaId(null)}
            />
          )}

          {/* D-15: AntiViralityOverlay — conditional, quiet treatment */}
          <AntiViralityOverlay
            result={result ? { confidence: result.confidence, heatmap: result.heatmap ?? null } : null}
            onFixChipTap={handleFixChipTap}
            fixTextBySegment={fixTextBySegment}
          />
        </div>

      {/* Portals — rendered outside the audience section, above board */}
      <TapPopover
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        payload={popoverPayload}
        anchorPos={popoverAnchorPos}
        onSeeFull={handleSeeFullFromPopover}
      />
    </>
  );
}
