'use client';

import type {
  PredictionResult,
  ApolloDimension,
  HookDecomposition,
} from '@/lib/engine/types';
import {
  buildPersonaNodes,
  buildSegmentGroups,
  worstBadGroupKey,
} from '@/components/board/audience/audience-derive';
import { ScoreDistribution } from '@/components/board/verdict/ScoreDistribution';
import { confidenceRange, deriveBehavioralTiles } from '@/components/board/verdict/verdict-derive';
import { useComparisons } from '@/components/board/verdict/use-comparisons';
import { type PersonaNode } from '@/components/board/_kit/PersonaGraph';
import { StatTileRow, type StatTileData } from '@/components/board/_kit/StatTile';

import { PanelShell, LegendKey, PanelEmpty } from './panel-shell';
import { RetentionScrubber } from './retention-scrubber';

// Re-exported for back-compat: PanelEmpty now lives in panel-shell (so the
// retention scrubber can import it without a cycle), but existing imports of
// `{ PanelEmpty } from './reading-panels'` keep working.
export { PanelEmpty };

// ─────────────────────────────────────────────────────────────────────────────
// Reading drill-down panels (UX rework 2026-06-15) — every panel now expands
// INLINE inside the accordion (no DrillSheet), each wrapped in PanelShell so the
// five drill-downs share one rhythm: subtitle → instrument → legend.
//
// Extracted out of reading.tsx (which had grown >500 lines). Still reads ONLY
// whitelisted fields (READ-10) and degrades per-block to PanelEmpty — never a
// fabricated 0, never an empty SVG (D-13).
// ─────────────────────────────────────────────────────────────────────────────

/** Closed allow-list for the drill panel (Security V5 — never reflect a raw key). */
export type PanelId = 'hook' | 'retention' | 'shareability' | 'score';

const NEUTRAL_FILL =
  'linear-gradient(90deg, rgba(236,231,222,0.22), rgba(236,231,222,0.38))';

/** Render the body for a drill panel (already allow-list-validated by the caller). */
export function renderPanel(
  panel: PanelId,
  data: PredictionResult,
  dims: ApolloDimension[] | null | undefined,
  id: string | null,
) {
  switch (panel) {
    case 'hook':
      return <HookPanel hook={data.hook_decomposition ?? null} dims={dims} />;
    case 'retention':
      // The signature linked watch-journey (sketch 003-A): one playhead drives the
      // frame + curve + on-screen cell + who-leaves cohort. Replaces the former
      // static 3-section RetentionPanel.
      return <RetentionScrubber data={data} />;
    case 'shareability':
      return (
        <ShareabilityPanel data={data} dim={dims?.find((d) => d.name === 'share_pull')} />
      );
    case 'score':
      return <ScorePanel data={data} id={id} />;
  }
}

// ── Score ────────────────────────────────────────────────────────────────────

/** ScorePanel (D-02) — "where your score sits in your niche, and how sure we are."
 *  Niche cohort fetched panel-local (lazy useComparisons) — NOT a second analysis
 *  subscription. niche null/thin → ScoreDistribution's own honest degrade (D-13). */
function ScorePanel({ data, id }: { data: PredictionResult; id: string | null }) {
  const { data: comparisons } = useComparisons(id);
  const niche = comparisons?.niche ?? null;
  const score = Math.round(data.overall_score);
  const range = confidenceRange(score, data.confidence);
  const showRangeText = data.confidence_label !== 'HIGH';
  return (
    <PanelShell subtitle="Where your score lands against your niche.">
      <ScoreDistribution
        score={score}
        niche={niche}
        range={range}
        showRangeText={showRangeText}
      />
    </PanelShell>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const HOOK_MODALITY_LABEL: Record<string, string> = {
  visual_stop_power: 'Visual stop power',
  audio_hook_quality: 'Audio hook',
  text_overlay_score: 'Text overlay',
  first_words_speech_score: 'First words',
  visual_audio_coherence: 'Visual / audio coherence',
  cognitive_load: 'Cognitive load',
};

function HookPanel({
  hook,
  dims,
}: {
  hook: HookDecomposition | null;
  dims: ApolloDimension[] | null | undefined;
}) {
  if (!hook) {
    const dim = dims?.find((d) => d.name === 'hook');
    if (dim) return <DimensionPanel dim={dim} />;
    return <PanelEmpty />;
  }
  // 0–10 modality sub-scores. Each row = label · value /10 on top, full-width bar
  // beneath (no more label…dead-gap…tiny-bar…number). The weakest is amber.
  const rows: Array<{ key: string; score: number | null }> = [
    { key: 'visual_stop_power', score: hook.visual_stop_power },
    { key: 'audio_hook_quality', score: hook.audio_hook_quality },
    { key: 'text_overlay_score', score: hook.text_overlay_score },
    { key: 'first_words_speech_score', score: hook.first_words_speech_score },
    { key: 'visual_audio_coherence', score: hook.visual_audio_coherence },
  ];
  return (
    <PanelShell
      subtitle="What stops the scroll in the first 3 seconds — each scored out of 10."
      legend={<LegendKey tone="amber">weakest modality</LegendKey>}
    >
      <div data-testid="panel-hook" className="flex flex-col gap-2">
        {rows.map(({ key, score }) => {
          const weakest = key === hook.weakest_modality;
          const pct = Math.max(0, Math.min(10, score ?? 0)) * 10;
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-foreground-secondary">
                  {HOOK_MODALITY_LABEL[key] ?? key}
                  {weakest && (
                    <span className="ml-1.5 text-[11px] font-medium text-warning">weakest</span>
                  )}
                </span>
                <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                  {score == null ? '—' : score}
                  <span className="ml-0.5 text-[11px] font-normal text-foreground-muted">/10</span>
                </span>
              </div>
              <span className="block h-[4px] w-full rounded-full bg-[var(--color-border)]">
                <span
                  data-testid={`hook-fill-${key}`}
                  className="block h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: weakest ? 'var(--color-warning)' : NEUTRAL_FILL,
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}

// ── Audience ──────────────────────────────────────────────────────────────────

/** Build the persona nodes the audience Room renders (same call PersonaCloud makes). */
export function buildAudienceNodes(data: PredictionResult): PersonaNode[] {
  const heatmap = data.heatmap ?? null;
  const badKey = worstBadGroupKey(buildSegmentGroups(heatmap, data.persona_simulation_results));
  return buildPersonaNodes(heatmap, data.persona_simulation_results, badKey);
}

/**
 * The concept text this Reading's audience reacted to — grounds the "Ask them why →"
 * persona chat in the Room (LIVE-03). Sourced HONESTLY from the real engine
 * output (never fabricated): the verbatim hook (spoken + on-screen text from the first
 * ~3s, the thing the room reacted to) is the primary signal; when no hook verbatim is
 * present we fall back to the first segment's verbatim. Returns undefined when no real
 * verbatim exists at all — the Room then correctly gates chat off (no concept to ground).
 */
export function readingConceptText(data: PredictionResult): string | undefined {
  const v = data.verbatim;
  if (!v) return undefined;
  const hookParts = [v.hook?.spoken_words, v.hook?.on_screen_text]
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length > 0);
  if (hookParts.length > 0) return hookParts.join('\n');
  const firstSeg = v.segments?.find(
    (s) =>
      (typeof s.spoken_text === 'string' && s.spoken_text.trim().length > 0) ||
      (typeof s.on_screen_text === 'string' && s.on_screen_text.trim().length > 0),
  );
  if (firstSeg) {
    const segParts = [firstSeg.spoken_text, firstSeg.on_screen_text]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0);
    if (segParts.length > 0) return segParts.join('\n');
  }
  return undefined;
}

// ── Shareability ─────────────────────────────────────────────────────────────

/** ShareabilityPanel (D-03) — behavioral rate tiles (share/completion/comment/save),
 *  weakest marked coral. The off-brief verdict prose paragraph is removed (D-15);
 *  the tiles + intent sub-captions ARE the instrument. */
function ShareabilityPanel({
  data,
  dim,
}: {
  data: PredictionResult;
  dim: ApolloDimension | undefined;
}) {
  const tiles: StatTileData[] = deriveBehavioralTiles(data);
  if (tiles.length > 0) {
    let weakestIdx = 0;
    let weakestVal = Number.POSITIVE_INFINITY;
    tiles.forEach((t, i) => {
      const v = Number.parseFloat(t.v);
      if (Number.isFinite(v) && v < weakestVal) {
        weakestVal = v;
        weakestIdx = i;
      }
    });
    tiles[weakestIdx] = { ...tiles[weakestIdx]!, tone: 'accent' };
  }
  if (tiles.length === 0 && !dim) return <PanelEmpty />;
  return (
    <PanelShell
      subtitle="What viewers do after watching — each shown against your niche."
      legend={tiles.length > 0 ? <LegendKey tone="accent">weakest signal</LegendKey> : undefined}
    >
      <div data-testid="panel-shareability">
        <StatTileRow tiles={tiles} />
      </div>
    </PanelShell>
  );
}

// ── Fallbacks ────────────────────────────────────────────────────────────────

function DimensionPanel({ dim }: { dim: ApolloDimension | undefined }) {
  if (!dim) return <PanelEmpty />;
  return (
    <div data-testid="panel-dimension" className="flex flex-col gap-2 pt-2">
      <p className="text-[13px] font-medium text-foreground">{dim.lever}</p>
      <p className="text-[13px] text-foreground-secondary">{dim.evidence}</p>
    </div>
  );
}
