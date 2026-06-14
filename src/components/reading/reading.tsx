'use client';

import { useState } from 'react';
import type {
  PredictionResult,
  ApolloDimension,
  HeatmapPayload,
  HookDecomposition,
} from '@/lib/engine/types';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import {
  buildPersonaNodes,
  buildSegmentGroups,
  worstBadGroupKey,
  averageWatchThrough,
  formatTime,
} from '@/components/board/audience/audience-derive';

import { ThumbnailStrip } from './thumbnail-strip';
import { AntiViralityHeader } from './anti-virality-header';
import { ScoreGauge } from './score-gauge';
import { PersonaCloud } from './persona-cloud';
import { DriverRows } from './driver-rows';
import { FixFirstList } from './fix-first-list';
import { DeeperRead } from './deeper-read';
import { DrillSheet } from './drill-sheet';

// ─────────────────────────────────────────────────────────────────────────────
// Reading — the container that makes the thread real on /analyze/[id] (02-05).
//
// THE BRAIN of the Reading (everything upstream is a prop-driven leaf):
//
//   1. SINGLE SOURCE (Landmine 1) — subscribes to the permalink analysis hook
//      ONCE (the only such call in the namespace). Children receive `data` as
//      PROPS; none of them re-subscribe (the InsightHeroFrame per-leaf
//      re-subscribe anti-pattern is severed). The data source stays abstracted
//      so Phase 4 can swap in the live-stream hook without touching composition.
//
//   2. D-13 HONESTY GATE, FIRST (correctness — hits on permalink reload + real
//      failures). BEFORE composing any block: loading → calm state; !data →
//      ReadingError; analysis_unavailable → CouldNotAnalyze. The fabricated 0
//      NEVER reaches ScoreGauge. partial_analysis → a small "Partial read"
//      annotation; the rest still renders.
//
//   3. LOCKED VERTICAL IA (READ-01): thumbnail → gate banner (above the gauge,
//      D-04) → hero (gauge | cloud + watch%) → 3 driver rows → Fix First →
//      Deeper read. The composer is the Phase-1 shell around this column.
//
//   4. WATCH% HERO-OWNED, RENDERED EXACTLY ONCE (READ-04). The container computes
//      averageWatchThrough (fallback heatmap.weighted_completion_pct ×100) and
//      renders "{n}% watch" beside the cloud — OUTSIDE PersonaCloud, which omits
//      itself on the empty-personas path. So watch% survives that degraded path.
//
//   5. ONE DrillSheet, panel state owned here (READ-07). A driver row / the cloud
//      sets `panel`; a single DrillSheet renders the D-12 native content. panelId
//      is a CLOSED union mapped through an allow-list — never a reflected value
//      (threat T-02-12).
//
//   6. READ-10 — only WHITELISTED fields are read; the raw PredictionResult is
//      NEVER spread into JSX. Cut/jargon data (feature_vector, dead *_score,
//      cost_cents/latency_ms, model names, critique, predicted_engagement) never
//      renders. NO verdict/horoscope prose (D-15).
// ─────────────────────────────────────────────────────────────────────────────

/** Closed allow-list for the drill panel (Security V5 — never reflect a raw key). */
type PanelId = 'hook' | 'retention' | 'shareability' | 'personas';

const PANEL_TITLE: Record<PanelId, string> = {
  hook: 'Hook',
  retention: 'Retention',
  shareability: 'Shareability',
  personas: 'Audience',
};

/** Whitelisted dual-read: Apollo lives at variants.apollo on permalink reload,
 *  at apollo_reasoning on live SSE (Pitfall 2 — permalink blank WPk976kozfWs). */
function readApollo(data: PredictionResult): PredictionResult['apollo_reasoning'] {
  const v = (data as { variants?: { apollo?: PredictionResult['apollo_reasoning'] } }).variants
    ?.apollo;
  return v ?? data.apollo_reasoning ?? null;
}

/** Hero-owned watch% (READ-04). Container-computed so it survives the empty-
 *  personas degraded path (PersonaCloud returns null there). averageWatchThrough
 *  is already a 0–100 int; the fallback ×100s the heatmap completion fraction. */
function heroWatchPct(heatmap: HeatmapPayload | null | undefined): number {
  const hm = heatmap ?? null;
  const badKey = worstBadGroupKey(buildSegmentGroups(hm, undefined));
  const nodes = buildPersonaNodes(hm, undefined, badKey);
  const avg = averageWatchThrough(nodes);
  if (avg != null) return avg;
  return Math.round((hm?.weighted_completion_pct ?? 0) * 100);
}

export function Reading() {
  const { id, data, isLoading } = usePermalinkAnalysis();
  const [panel, setPanel] = useState<PanelId | null>(null);

  // ── D-13 honesty gate, FIRST (before any block composes) ───────────────────
  // No id → the no-id /analyze route: stay inert so the Phase-1 composer shell
  // owns the screen (the layout mounts this above the page; nothing to read yet).
  if (!id && !data) return null;
  if (isLoading) return <ReadingLoading />;
  // id present but the fetch returned nothing → a real load failure (permalink).
  if (!data) return <ReadingError />;

  // Dual-read BEFORE deriving rows/rewrites/dims.
  const apollo = readApollo(data);

  if (data.analysis_unavailable) return <CouldNotAnalyze />;

  const watch = heroWatchPct(data.heatmap);
  const dims: ApolloDimension[] | null | undefined = apollo?.dimensions;
  // Canonical drop-time path the existing DriverRows test reads (top-level,
  // SECONDS — types.ts L483), with the heatmap mirror as a fallback.
  const dropT = data.weighted_top_dropoff_t ?? data.heatmap?.weighted_top_dropoff_t ?? null;

  return (
    <div data-testid="reading" className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 py-8">
      {/* 1 — thumbnail poster (omits itself when there's no real keyframe) */}
      <ThumbnailStrip heatmap={data.heatmap ?? null} />

      {/* 2 — gate banner ABOVE the gauge (D-04); renders null when not gated */}
      <AntiViralityHeader result={data} analysisId={id ?? ''} />

      {/* 3 — HERO: gauge | (cloud + hero-owned watch%). CSS-responsive stack→row,
              NOT a useIsMobile switch (the gauge + cloud both render either way). */}
      <section
        data-testid="reading-hero"
        className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-10"
      >
        <div className="flex flex-col items-center gap-2">
          <ScoreGauge score={data.overall_score} />
          {data.partial_analysis && (
            <p data-testid="reading-partial" className="text-xs text-foreground-muted">
              Partial read — based on half the usual signals.
            </p>
          )}
        </div>

        <div className="flex w-full flex-1 flex-col items-center gap-2">
          {/* cloud (dots only) — may be null on the empty-personas path */}
          <PersonaCloud
            heatmap={data.heatmap ?? null}
            simResults={data.persona_simulation_results}
            onOpen={() => setPanel('personas')}
          />
          {/* watch% — hero-owned, rendered EXACTLY ONCE, OUTSIDE the cloud so it
              survives the empty-personas degraded path (READ-04). */}
          <p data-testid="reading-watch" className="text-sm text-foreground-secondary">
            <span className="font-semibold tabular-nums text-foreground">{watch}%</span> watch
          </p>
        </div>
      </section>

      {/* 4 — the three always-visible levers (tap → DrillSheet) */}
      <DriverRows dimensions={dims} dropT={dropT} onRowTap={setPanel} />

      {/* 5 — actionable fixes + copyable hook rewrites */}
      <FixFirstList fixes={data.counterfactuals?.suggestions} rewrites={apollo?.rewrites} />

      {/* 6 — light inline expand of the remaining 3 dimensions */}
      <DeeperRead dimensions={dims} />

      {/* ONE DrillSheet, driven by panel state; native D-12 content per panel */}
      <DrillSheet
        open={!!panel}
        onOpenChange={(open) => !open && setPanel(null)}
        title={panel ? PANEL_TITLE[panel] : ''}
      >
        {panel && <PanelContent panel={panel} data={data} dims={dims} />}
      </DrillSheet>
    </div>
  );
}

Reading.displayName = 'Reading';

// ─────────────────────────────────────────────────────────────────────────────
// Native drill-down content (D-12) — real engine data in a simple form. NOT the
// Phase-3 rich charts (those mount here later), NOT stubs. Reads ONLY whitelisted
// fields. panel is the closed union (already allow-list-validated by the caller).
// ─────────────────────────────────────────────────────────────────────────────

function PanelContent({
  panel,
  data,
  dims,
}: {
  panel: PanelId;
  data: PredictionResult;
  dims: ApolloDimension[] | null | undefined;
}) {
  switch (panel) {
    case 'hook':
      return <HookPanel hook={data.hook_decomposition ?? null} dims={dims} />;
    case 'retention':
      return (
        <RetentionPanel
          heatmap={data.heatmap ?? null}
          dropIndices={data.dropoff_segment_indices}
        />
      );
    case 'shareability':
      return <DimensionPanel dim={dims?.find((d) => d.name === 'share_pull')} />;
    case 'personas':
      return <PersonasPanel heatmap={data.heatmap ?? null} />;
  }
}

/** Modality labels for the hook decomposition rows. */
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
  // 0–10 modality sub-scores as plain rows; the weakest modality is flagged.
  const rows: Array<{ key: string; score: number | null }> = [
    { key: 'visual_stop_power', score: hook.visual_stop_power },
    { key: 'audio_hook_quality', score: hook.audio_hook_quality },
    { key: 'text_overlay_score', score: hook.text_overlay_score },
    { key: 'first_words_speech_score', score: hook.first_words_speech_score },
    { key: 'visual_audio_coherence', score: hook.visual_audio_coherence },
  ];
  return (
    <div data-testid="panel-hook" className="flex flex-col gap-1 pt-2">
      {rows.map(({ key, score }) => {
        const weakest = key === hook.weakest_modality;
        return (
          <div key={key} className="flex items-center justify-between gap-3 py-1">
            <span className="text-[13px] text-foreground-secondary">
              {HOOK_MODALITY_LABEL[key] ?? key}
              {weakest && (
                <span className="ml-1 text-foreground-muted">— weakest</span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <span className="block h-[5px] w-24 rounded-full bg-[var(--color-border)]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(10, score ?? 0)) * 10}%`,
                    background: weakest
                      ? 'var(--color-warning)'
                      : 'linear-gradient(90deg, rgba(236,231,222,0.22), rgba(236,231,222,0.38))',
                  }}
                />
              </span>
              <span className="w-8 text-right text-[13px] tabular-nums text-foreground-muted">
                {score == null ? '—' : `${score}`}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RetentionPanel({
  heatmap,
  dropIndices,
}: {
  heatmap: HeatmapPayload | null;
  dropIndices: number[] | undefined;
}) {
  const segments = heatmap?.segments ?? [];
  // Drop segments as a plain text list (where attention falls across the video).
  const drops = (dropIndices ?? [])
    .map((i) => segments[i])
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const list = drops.length > 0 ? drops : segments;
  if (list.length === 0) return <PanelEmpty />;
  return (
    <ul data-testid="panel-retention" className="flex flex-col gap-1 pt-2">
      {list.map((seg) => (
        <li
          key={seg.idx}
          className="flex items-center justify-between gap-3 py-1 text-[13px]"
        >
          <span className="tabular-nums text-foreground-muted">
            {formatTime(seg.t_start)}
          </span>
          <span className="flex-1 truncate text-foreground-secondary">
            {seg.label || `Segment ${seg.idx + 1}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DimensionPanel({ dim }: { dim: ApolloDimension | undefined }) {
  if (!dim) return <PanelEmpty />;
  // Plain lever + evidence text (the §2 lever the score came from).
  return (
    <div data-testid="panel-dimension" className="flex flex-col gap-2 pt-2">
      <p className="text-[13px] font-medium text-foreground">{dim.lever}</p>
      <p className="text-[13px] text-foreground-secondary">{dim.evidence}</p>
    </div>
  );
}

function PersonasPanel({ heatmap }: { heatmap: HeatmapPayload | null }) {
  const personas = heatmap?.personas ?? [];
  if (personas.length === 0) return <PanelEmpty />;
  // Native persona list (the Phase-3 PersonaGraph seam — P3 mounts the Canvas here).
  return (
    <ul data-testid="panel-personas" className="flex flex-col gap-1 pt-2">
      {personas.map((p) => {
        const mean =
          p.attentions.length > 0
            ? p.attentions.reduce((a, b) => a + b, 0) / p.attentions.length
            : 0;
        return (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 py-1 text-[13px]"
          >
            <span className="text-foreground-secondary">{p.archetype ?? p.slot_type}</span>
            <span className="tabular-nums text-foreground-muted">
              {Math.round(mean * 100)}% watch
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function PanelEmpty() {
  return <p className="pt-2 text-[13px] text-foreground-muted">Not available for this read.</p>;
}

// ─────────────────────────────────────────────────────────────────────────────
// D-13 states — never present a fabricated 0 as a real score; never a blank.
// Calm, plain copy (no prose verdict, D-15). Copy strings from 02-UI-SPEC.
// ─────────────────────────────────────────────────────────────────────────────

function ReadingLoading() {
  return (
    <div
      data-testid="reading-loading"
      className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-2 px-4 py-16 text-center"
    >
      <p className="text-sm text-foreground-muted">Reading your simulation…</p>
    </div>
  );
}

function CouldNotAnalyze() {
  return (
    <div
      data-testid="reading-unavailable"
      className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-2 px-4 py-16 text-center"
    >
      <p className="text-base font-medium text-foreground">We couldn&apos;t analyze this video</p>
      <p className="text-sm text-foreground-muted">
        The read didn&apos;t come back. Try another video or re-upload.
      </p>
    </div>
  );
}

function ReadingError() {
  return (
    <div
      data-testid="reading-error"
      className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-2 px-4 py-16 text-center"
    >
      <p className="text-base font-medium text-foreground">This Simulation didn&apos;t load</p>
      <p className="text-sm text-foreground-muted">Refresh, or open another from the sidebar.</p>
    </div>
  );
}
