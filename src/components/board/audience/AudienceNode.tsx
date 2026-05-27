'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { useAudienceChoreography } from './use-audience-choreography';
import { useClientWeights } from './use-client-weights';
import { HeadlineChips } from './HeadlineChips';
import { Filmstrip } from './Filmstrip';
import { RetentionCurve } from './RetentionCurve';
import { HeatmapDrawer } from './HeatmapDrawer';
import { TapPopover } from './TapPopover';
import { PersonaInspector } from './PersonaInspector';
import { WeightOverrideDrawer } from './WeightOverrideDrawer';
import { AntiViralityOverlay } from './AntiViralityOverlay';
import { AUDIENCE_FRAME_TITLE_BAR_H } from './audience-constants';
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
  const stream = useAnalysisStream();
  const { result, partial: _partial, phase, filmstrips, analysisId } = stream;

  // Choreography hook — drives row + curve state machine
  // Pass injected stream so it doesn't double-subscribe
  const { rowStates, curveState } = useAudienceChoreography(stream);

  // Client-side weight recompute
  const initialWeights = result?.heatmap?.weights ?? DEFAULT_PERSONA_WEIGHT_CONFIG.default;
  const { weights, setWeights, recomputedCurve, recomputedMetrics, antiViralityState } =
    useClientWeights(result?.heatmap ?? null, initialWeights, result?.confidence ?? 1);

  // ── Board store (for camera pan on jumpToSegment) ──────────────────────────
  const setActivePreset = useBoardStore((s) => s.setActivePreset);

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [heatmapOpen, setHeatmapOpen] = useState(false);

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorPersonaId, setInspectorPersonaId] = useState<string | null>(null);

  const [overrideDrawerOpen, setOverrideDrawerOpen] = useState(false);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPayload, setPopoverPayload] = useState<TapPopoverPayload | null>(null);
  const [popoverAnchorPos, setPopoverAnchorPos] = useState<{ x: number; y: number } | null>(null);

  // Inspector trigger ref for focus restoration on close
  const inspectorTriggerRef = useRef<HTMLElement | null>(null);

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalDurationSec = useMemo(() => {
    const segs = result?.heatmap?.segments;
    if (!segs || segs.length === 0) return 30;
    return segs[segs.length - 1]!.t_end;
  }, [result?.heatmap?.segments]);

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
    setInspectorPersonaId(personaId);
    setInspectorOpen(true);
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
      const pid =
        popoverPayload.kind === 'cell'
          ? popoverPayload.personaId
          : popoverPayload.personaId;
      setInspectorPersonaId(pid);
      setInspectorOpen(true);
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

  // Weighted curve: prefer live recomputed curve, fall back to result heatmap curve
  const weightedCurve =
    recomputedCurve.length > 0
      ? recomputedCurve
      : result?.heatmap?.weighted_curve ?? null;

  // Baseline curve derived from persona_behavioral_aggregate.completion_pct (Pass 1)
  // Flat line at completion_pct across all segments (D-07: Pass 1 flat baseline)
  const baselineCurve = useMemo<number[] | null>(() => {
    const pct = agg?.completion_pct;
    if (pct == null || !result?.heatmap?.segments) return null;
    const normalized = pct / 100;
    return result.heatmap.segments.map(() => normalized);
  }, [agg?.completion_pct, result?.heatmap?.segments]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // NodeOverlay positions absolutely via layout.bounds.x. AudienceNode is mounted
  // INSIDE GroupFrameOverlay (Board.tsx:303), which already provides the absolute
  // positioning for the Audience frame. Rendering NodeOverlay here would double-apply
  // the bounds offset (visible as content shifted to the right of the frame).
  // Use the synthetic spec only for child positioning math (popover anchors, etc.).
  void audienceSpec;
  return (
    <>
      <section
          aria-label="Audience analysis"
          aria-live="polite"
          aria-busy={isStreaming}
          className="relative flex h-full w-full flex-col gap-3 overflow-y-auto"
        >
          {/* D-01: HeadlineChips — top of stack */}
          <HeadlineChips
            weighted_completion_pct={recomputedMetrics.weighted_completion_pct || result?.weighted_completion_pct}
            weighted_top_dropoff_t={recomputedMetrics.weighted_top_dropoff_t || result?.weighted_top_dropoff_t}
            weighted_hook_score={recomputedMetrics.weighted_hook_score || result?.weighted_hook_score}
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
            loop_pct={null}
            vs_niche_diff_pct={null}
            weights={weights}
            isStreaming={isStreaming}
            onWeightsBadgeClick={handleWeightsBadgeClick}
          />

          {/* D-01: Filmstrip — directly below chips, acts as x-axis */}
          <Filmstrip
            segments={result?.heatmap?.segments ?? null}
            filmstrips={filmstrips}
            totalDurationSec={totalDurationSec}
            antiViralitySegmentIndices={antiViralityState.dropoff_segment_indices}
          />

          {/* D-01: RetentionCurve — segment-aligned below filmstrip */}
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

          {/* D-01: HeatmapDrawer — collapsed by default (D-03) */}
          <HeatmapDrawer
            heatmap={result?.heatmap ?? null}
            rowStates={rowStates}
            totalDurationSec={totalDurationSec}
            isOpen={heatmapOpen}
            onOpenChange={setHeatmapOpen}
            onCellTap={handleHeatmapCellTap}
            onRowLabelTap={handleRowLabelTap}
          />

          {/* D-15: AntiViralityOverlay — conditional, quiet treatment */}
          <AntiViralityOverlay
            result={result ? { confidence: result.confidence, heatmap: result.heatmap ?? null } : null}
            onFixChipTap={handleFixChipTap}
            fixTextBySegment={fixTextBySegment}
          />
        </section>

      {/* Portals — rendered outside the audience section, above board */}
      <TapPopover
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        payload={popoverPayload}
        anchorPos={popoverAnchorPos}
        onSeeFull={handleSeeFullFromPopover}
      />

      <PersonaInspector
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        personaId={inspectorPersonaId}
        heatmap={result?.heatmap ?? null}
        pass1Verdict={undefined}
        pass1Confidence={result?.confidence}
        onJumpToSegment={handleJumpToSegment}
        triggerRef={inspectorTriggerRef}
      />

      <WeightOverrideDrawer
        open={overrideDrawerOpen}
        onOpenChange={setOverrideDrawerOpen}
        analysisId={analysisId ?? ''}
        currentWeights={weights}
        onWeightsChange={setWeights}
        onApply={handleOverrideApply}
      />
    </>
  );
}
