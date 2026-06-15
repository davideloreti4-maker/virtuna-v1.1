'use client';

import type { PredictionResult, ApolloDimension, HeatmapPayload } from '@/lib/engine/types';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import {
  buildPersonaNodes,
  buildSegmentGroups,
  worstBadGroupKey,
  averageWatchThrough,
} from '@/components/board/audience/audience-derive';

import { ThumbnailStrip } from './thumbnail-strip';
import { AntiViralityHeader } from './anti-virality-header';
import { ScoreGauge } from './score-gauge';
import { PersonaCloud } from './persona-cloud';
import { FixFirstList } from './fix-first-list';
import { DeeperRead } from './deeper-read';
import { ReadingAccordion } from './reading-accordion';
import { buildAudienceNodes } from './reading-panels';

// ─────────────────────────────────────────────────────────────────────────────
// Reading — the container that makes the thread real on /analyze/[id].
//
// THE BRAIN of the Reading (everything upstream is a prop-driven leaf):
//
//   1. SINGLE SOURCE (Landmine 1) — subscribes to the permalink analysis hook
//      ONCE (the only such call in the namespace). Children receive `data` as
//      PROPS; none of them re-subscribe.
//
//   2. D-13 HONESTY GATE, FIRST. BEFORE composing any block: loading → calm state;
//      !data → ReadingError; analysis_unavailable → CouldNotAnalyze. The fabricated
//      0 NEVER reaches ScoreGauge. partial_analysis → a small "Partial read" note.
//
//   3. LOCKED VERTICAL IA: thumbnail → gate banner (above the gauge) → hero
//      (gauge | cloud + watch%) → accordion drill-downs → Fix First → Deeper read.
//
//   4. UX REWORK (2026-06-15) — the hero is now DISPLAY-ONLY (gauge + cloud + watch%
//      are no longer tap targets); EVERY drill-down opens from the ReadingAccordion
//      as one consistent inline-expand mechanic (replacing the old DriverRows +
//      DrillSheet, whose 5 different invisible affordances read as "unclear"). The
//      five panels live in reading-panels.tsx, each wrapped in a shared PanelShell.
//
//   5. WATCH% HERO-OWNED, RENDERED EXACTLY ONCE. Computed here (fallback
//      heatmap.weighted_completion_pct ×100) and rendered beside the cloud —
//      OUTSIDE PersonaCloud, so it survives the empty-personas degraded path.
//
//   6. Only WHITELISTED fields are read; the raw PredictionResult is NEVER spread
//      into JSX. NO verdict/horoscope prose (D-15).
// ─────────────────────────────────────────────────────────────────────────────

/** Whitelisted dual-read: Apollo lives at variants.apollo on permalink reload,
 *  at apollo_reasoning on live SSE. */
function readApollo(data: PredictionResult): PredictionResult['apollo_reasoning'] {
  const v = (data as { variants?: { apollo?: PredictionResult['apollo_reasoning'] } }).variants
    ?.apollo;
  return v ?? data.apollo_reasoning ?? null;
}

/** Hero-owned watch% — container-computed so it survives the empty-personas degraded
 *  path. Returns null (NOT a fabricated 0) when watch-through is genuinely
 *  underivable; the caller omits the "% watch" caption when null (D-13). */
function heroWatchPct(heatmap: HeatmapPayload | null | undefined): number | null {
  const hm = heatmap ?? null;
  const badKey = worstBadGroupKey(buildSegmentGroups(hm, undefined));
  const nodes = buildPersonaNodes(hm, undefined, badKey);
  const avg = averageWatchThrough(nodes);
  if (avg != null) return avg;
  const wc = hm?.weighted_completion_pct;
  return wc != null ? Math.round(wc * 100) : null;
}

export function Reading() {
  const { id, data, isLoading } = usePermalinkAnalysis();

  // ── D-13 honesty gate, FIRST (before any block composes) ───────────────────
  if (!id && !data) return null;
  if (isLoading) return <ReadingLoading />;
  if (!data) return <ReadingError />;

  const apollo = readApollo(data);

  // In-flight placeholder row (overall_score:null + engine_version 'pending') →
  // the calm live state, NOT a fabricated 0-gauge and NOT "couldn't analyze".
  const processing =
    (data as { processing?: boolean }).processing ??
    (data.overall_score == null &&
      (data as { engine_version?: string | null }).engine_version === 'pending');
  if (processing) return <ReadingLoading />;

  if (data.analysis_unavailable) return <CouldNotAnalyze />;

  const watch = heroWatchPct(data.heatmap);
  const dims: ApolloDimension[] | null | undefined = apollo?.dimensions;
  const dropT = data.weighted_top_dropoff_t ?? data.heatmap?.weighted_top_dropoff_t ?? null;
  const hasPersonas = buildAudienceNodes(data).length > 0;

  // The single weakest lever — feeds FixFirstList's honest empty-state copy.
  const weakestLever = (() => {
    if (!dims) return null;
    const levers = ([
      ['hook', 'Hook'],
      ['retention', 'Retention'],
      ['share_pull', 'Shareability'],
    ] as const)
      .map(([name, label]) => {
        const d = dims.find((x) => x.name === name);
        return d ? { label: label as string, score: d.score } : null;
      })
      .filter((x): x is { label: string; score: number } => x != null);
    if (levers.length === 0) return null;
    return levers.reduce((a, b) => (b.score < a.score ? b : a));
  })();

  return (
    <div data-testid="reading" className="mx-auto flex w-full max-w-[760px] flex-col gap-7 px-4 py-8">
      {/* 1 — thumbnail poster (omits itself when there's no real keyframe) */}
      <ThumbnailStrip heatmap={data.heatmap ?? null} />

      {/* 2 — gate banner ABOVE the gauge; renders null when not gated. */}
      {id && <AntiViralityHeader result={data} analysisId={id} />}

      {/* 3 — HERO (DISPLAY-ONLY): gauge | (cloud + hero-owned watch% + legend).
              No longer tappable — all drill-downs moved to the accordion below. */}
      <section
        data-testid="reading-hero"
        className="flex flex-col items-center gap-5 md:flex-row md:items-center md:justify-center md:gap-10"
      >
        <div className="flex flex-col items-center gap-2">
          <ScoreGauge score={data.overall_score} />
          {data.partial_analysis && (
            <p data-testid="reading-partial" className="text-xs text-foreground-muted">
              Partial read — based on half the usual signals.
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          {/* cloud (dots only) — capped so the hero doesn't eat the first screen;
              may be null on the empty-personas path */}
          <div className="w-full max-w-[260px]">
            <PersonaCloud
              heatmap={data.heatmap ?? null}
              simResults={data.persona_simulation_results}
            />
          </div>
          {/* watch% — hero-owned, rendered EXACTLY ONCE, OUTSIDE the cloud. Omitted
              entirely when underivable — never a fabricated 0 (D-13). */}
          {watch != null && (
            <p data-testid="reading-watch" className="text-sm text-foreground-secondary">
              <span className="font-semibold tabular-nums text-foreground">{watch}%</span> watch
            </p>
          )}
          {hasPersonas && (
            <p className="flex items-center gap-1.5 text-[11px] text-foreground-muted">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--color-accent)' }}
              />
              coral = drops first
            </p>
          )}
        </div>
      </section>

      {/* 4 — the five drill-downs, one consistent inline-expand mechanic */}
      <ReadingAccordion data={data} dims={dims} dropT={dropT} id={id} />

      {/* 5 — actionable fixes + copyable hook rewrites */}
      <FixFirstList
        fixes={data.counterfactuals?.suggestions}
        rewrites={apollo?.rewrites}
        score={data.overall_score}
        weakestLever={weakestLever}
      />

      {/* 6 — light inline expand of the remaining 3 dimensions */}
      <DeeperRead dimensions={dims} />
    </div>
  );
}

Reading.displayName = 'Reading';

// ─────────────────────────────────────────────────────────────────────────────
// D-13 states — never present a fabricated 0 as a real score; never a blank.
// Calm, plain copy (no prose verdict, D-15).
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
