'use client';

import type {
  PredictionResult,
  ApolloDimension,
  HookDecomposition,
  GeminiAudioSignals,
  CtaSegmentResult,
} from '@/lib/engine/types';
import type { EmotionArcPoint } from '@/lib/engine/qwen/schemas';
import {
  buildPersonaNodes,
  buildSegmentGroups,
  worstBadGroupKey,
  toRetentionCurve,
  normalizeCurve,
  findBiggestDrop,
  totalDuration,
  cohortDropFrame,
  type SlotKey,
  type CohortDropFrame,
} from '@/components/board/audience/audience-derive';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { usePermalinkFilmstrips } from '@/hooks/queries/use-permalink-filmstrips';
import { ScoreDistribution } from '@/components/board/verdict/ScoreDistribution';
import { confidenceRange, deriveBehavioralTiles } from '@/components/board/verdict/verdict-derive';
import { useComparisons } from '@/components/board/verdict/use-comparisons';
import { PersonaGraph, type PersonaNode } from '@/components/board/_kit/PersonaGraph';
import { StatTileRow, type StatTileData } from '@/components/board/_kit/StatTile';
import { RetentionChart } from '@/components/board/audience/RetentionChart';
import { SegmentTable } from '@/components/board/audience/SegmentTable';
import { CraftFilmstrip } from '@/components/board/content-analysis/CraftFilmstrip';
import { buildCells, audioMixCaption } from '@/components/board/content-analysis/content-analysis-derive';

import { PanelShell, LegendKey, PanelSection } from './panel-shell';

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
export type PanelId = 'hook' | 'retention' | 'shareability' | 'personas' | 'score';

const NEUTRAL_FILL =
  'linear-gradient(90deg, rgba(236,231,222,0.22), rgba(236,231,222,0.38))';

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Whitelisted dual-read for the CraftFilmstrip's craft signals (audio + cta).
 *  LIVE SSE puts them top-level; the persisted permalink row nests them under
 *  variants.craft (mirrors ContentAnalysisFrame). All degrade cleanly when absent. */
type CraftVariants = {
  variants?: {
    craft?: {
      audio_signals?: GeminiAudioSignals | null;
      cta_segment?: CtaSegmentResult | null;
    } | null;
  } | null;
};
function readCraftSignals(data: PredictionResult): {
  arc: EmotionArcPoint[];
  audio: GeminiAudioSignals | null;
  ctaPresent: boolean;
} {
  const craft = (data as CraftVariants).variants?.craft ?? null;
  const audio = craft?.audio_signals ?? data.audio_signals ?? null;
  const cta = craft?.cta_segment ?? data.cta_segment ?? null;
  return {
    arc: data.emotion_arc ?? [],
    audio,
    ctaPresent: cta?.cta_present ?? false,
  };
}

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
      return <RetentionPanel data={data} />;
    case 'shareability':
      return (
        <ShareabilityPanel data={data} dim={dims?.find((d) => d.name === 'share_pull')} />
      );
    case 'personas':
      return <PersonasPanel data={data} />;
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

// ── Retention ─────────────────────────────────────────────────────────────────

/** RetentionPanel (D-03/D-04/D-06) — the SIGNATURE drill-down: the composed "watch
 *  journey" on ONE aligned timeline. Now each of the three visuals carries a caps
 *  section label so the relationship reads at a glance:
 *    Watch curve (survival + niche ghost + drop) · On screen (frames + audio) ·
 *    Who leaves (cohort breakdown + drop frames).
 *  All three consume the SAME heatmap.segments + filmstrips map → aligned by
 *  construction (D-06). Store-free; NEVER imports a *Node/*Frame. */
function RetentionPanel({ data }: { data: PredictionResult }) {
  const filmstrips = usePermalinkFilmstrips();

  const heatmap = data.heatmap ?? null;
  const segments = heatmap?.segments ?? [];

  const raw = heatmap?.weighted_curve ?? null;
  const curve = raw && raw.length > 0 ? toRetentionCurve(normalizeCurve(raw)) : null;
  const drop = curve ? findBiggestDrop(normalizeCurve(curve)) : null;
  const total = totalDuration(heatmap?.segments, 30); // SECONDS

  // D-13 honesty gate FIRST: no timeline (no segments) or no attention story (no
  // curve) → PanelEmpty, never an empty SVG / table / fabricated 0.
  if (segments.length === 0 || curve == null) return <PanelEmpty />;

  const ncp = heatmap?.niche_completion_pct;
  const nicheCompletionPct = ncp != null ? (ncp > 1.5 ? ncp / 100 : ncp) : null;

  const { arc, audio, ctaPresent } = readCraftSignals(data);
  const cells = buildCells(segments, filmstrips, arc, total);

  const groups = buildSegmentGroups(heatmap, data.persona_simulation_results);
  const badKey = worstBadGroupKey(groups);
  const slotKeys: SlotKey[] = ['fyp', 'niche', 'loyalist', 'cross_niche'];
  const cohortFrames: Partial<Record<SlotKey, CohortDropFrame>> = {};
  for (const key of slotKeys) {
    const frame = cohortDropFrame(heatmap, key, filmstrips);
    if (frame) cohortFrames[key] = frame;
  }

  return (
    <PanelShell
      subtitle="Where viewers leave — and what's on screen when they do."
      legend={<LegendKey tone="accent">biggest drop</LegendKey>}
    >
      <div data-testid="panel-retention-cluster" className="flex flex-col gap-6">
        <PanelSection label="Watch curve">
          <RetentionChart
            curve={curve}
            heatmap={heatmap}
            drop={drop}
            totalDurationSec={total}
            filmstrips={filmstrips}
            nicheCompletionPct={nicheCompletionPct}
            isLoading={false}
          />
        </PanelSection>
        <PanelSection label="On screen">
          <CraftFilmstrip
            cells={cells}
            durationSec={total}
            arc={arc}
            audio={audio}
            audioCaption={audio ? audioMixCaption(audio) : ''}
            ctaPresent={ctaPresent}
            isLoading={false}
          />
        </PanelSection>
        <PanelSection label="Who leaves">
          <SegmentTable groups={groups} badKey={badKey} cohortFrames={cohortFrames} isLoading={false} />
        </PanelSection>
      </div>
    </PanelShell>
  );
}

// ── Audience ──────────────────────────────────────────────────────────────────

/** Build the persona nodes the cloud + list share (same call PersonaCloud makes). */
export function buildAudienceNodes(data: PredictionResult): PersonaNode[] {
  const heatmap = data.heatmap ?? null;
  const badKey = worstBadGroupKey(buildSegmentGroups(heatmap, data.persona_simulation_results));
  return buildPersonaNodes(heatmap, data.persona_simulation_results, badKey);
}

/** PersonasPanel (D-03) — list-led (UX rework): the ranked persona list IS the
 *  content; the graph is demoted to a small header strip. Empty nodes → PanelEmpty. */
function PersonasPanel({ data }: { data: PredictionResult }) {
  const reducedMotion = usePrefersReducedMotion();
  const nodes = buildAudienceNodes(data);
  if (nodes.length === 0) return <PanelEmpty />;
  return <AudienceList nodes={nodes} reducedMotion={reducedMotion} />;
}

function AudienceList({
  nodes,
  reducedMotion,
}: {
  nodes: PersonaNode[];
  reducedMotion: boolean;
}) {
  // Rank best watch-through → worst, so the coral "drops first" cluster sinks to
  // the bottom where it reads as the thing to fix.
  const sorted = [...nodes].sort((a, b) => b.watchThrough - a.watchThrough);
  return (
    <PanelShell
      subtitle="Who watches — and who drops first."
      legend={<LegendKey tone="accent">drops first</LegendKey>}
    >
      {/* demoted graph: a small textured header, not the load-bearing visual */}
      <div className="overflow-hidden rounded-[8px] border border-[var(--color-border)]">
        <PersonaGraph personas={nodes} height={120} reducedMotion={reducedMotion} />
      </div>
      {/* the readable instrument: segment · drop time · watch-through */}
      <ul data-testid="panel-personas-list" className="flex flex-col">
        {sorted.map((n) => {
          const accent = n.tone === 'accent';
          const pct = Math.round(clamp01(n.watchThrough) * 100);
          const dotFill = accent
            ? 'var(--color-accent)'
            : `rgba(236, 231, 222, ${(0.3 + clamp01(n.watchThrough) * 0.5).toFixed(2)})`;
          return (
            <li
              key={n.id}
              className="flex items-center gap-3 border-t border-[var(--color-border)] py-2 first:border-t-0"
            >
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: dotFill }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {n.segment || n.label}
              </span>
              {n.dropAt && (
                <span className="shrink-0 text-[12px] tabular-nums text-foreground-muted">
                  ↓ {n.dropAt}
                </span>
              )}
              <span className="hidden h-[5px] w-20 shrink-0 rounded-full bg-[var(--color-border)] sm:block">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: accent ? 'var(--color-accent)' : 'rgba(236,231,222,0.35)',
                  }}
                />
              </span>
              <span
                className="w-10 shrink-0 text-right text-[13px] font-semibold tabular-nums text-foreground"
                style={accent ? { color: 'var(--color-accent)' } : undefined}
              >
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </PanelShell>
  );
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

export function PanelEmpty() {
  return <p className="pt-2 text-[13px] text-foreground-muted">Not available for this read.</p>;
}
