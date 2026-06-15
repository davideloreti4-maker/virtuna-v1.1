'use client';

import type { PredictionResult, ApolloDimension, HeatmapPayload } from '@/lib/engine/types';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import { useComparisons, type ComparisonsResponse } from '@/components/board/verdict/use-comparisons';
import {
  buildPersonaNodes,
  buildSegmentGroups,
  worstBadGroupKey,
  averageWatchThrough,
  personasFinishing,
  findBiggestDrop,
  normalizeCurve,
} from '@/components/board/audience/audience-derive';

import { ReadingHero } from './reading-hero';
import { FixFirstList } from './fix-first-list';
import { DeeperRead } from './deeper-read';
import { ScoreDriversSection, AudienceContextSection } from './reading-accordion';
import { ReadingChat } from './reading-chat';
import { buildAudienceNodes } from './reading-panels';

// ─────────────────────────────────────────────────────────────────────────────
// Reading — the container that makes the thread real on /analyze/[id].
//
// THE BRAIN of the Reading (everything downstream is a prop-driven leaf):
//
//   1. SINGLE SOURCE (Landmine 1) — subscribes to the permalink analysis hook
//      ONCE (the only such call in the namespace). Children receive `data` as
//      PROPS; none of them re-subscribe. The niche cohort is a SECOND, lightweight
//      cached query (useComparisons) shared by the hero stat + the Niche-rank row +
//      the score panel — NOT a second analysis subscription.
//
//   2. D-13 HONESTY GATE, FIRST. BEFORE composing any block: loading → calm state;
//      !data → ReadingError; analysis_unavailable → CouldNotAnalyze. The fabricated
//      0 NEVER reaches the gauge. partial_analysis → a small "Partial read" note.
//
//   3. IA (hero-v6 system) — quiet uppercase section labels over contained
//      flat-warm cards:
//        The read (scorecard: poster + gauge + 3 stats: Watch-through · Biggest
//          drop · Finish rate)
//        Your audience (the audience-overview visual, directly under the read)
//        Score drivers (Hook · Retention · Shareability)
//        Audience & context (Niche rank — the audience DEEP-DIVE returns here in
//          the step-2 panel redesign)
//      then Fix First → Deeper read → persistent follow-up chat.
//
//   4. The hero is DISPLAY-ONLY; every drill-down opens from an accordion row (one
//      consistent inline-expand mechanic). NO verdict/horoscope prose (D-15). Only
//      WHITELISTED fields are read; the raw PredictionResult is NEVER spread.
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
 *  underivable; the hero omits the "Watch-through" stat when null (D-13). */
function heroWatchPct(heatmap: HeatmapPayload | null | undefined): number | null {
  const hm = heatmap ?? null;
  const badKey = worstBadGroupKey(buildSegmentGroups(hm, undefined));
  const nodes = buildPersonaNodes(hm, undefined, badKey);
  const avg = averageWatchThrough(nodes);
  if (avg != null) return avg;
  const wc = hm?.weighted_completion_pct;
  return wc != null ? Math.round(wc * 100) : null;
}

/** Biggest-drop time (seconds) for the hero stat + the weak-Retention subline.
 *  Prefers the engine's authoritative `weighted_top_dropoff_t`; when that's absent
 *  (common on permalink reload) it falls back to the biggest single step in the
 *  weighted survival curve — the SAME drop the Retention panel marks (honest, the
 *  real curve's drop, never fabricated). Returns null when there's no curve. */
function heroDropT(data: PredictionResult): number | null {
  // On permalink reload the drop time lands nested in the heatmap (not typed on
  // HeatmapPayload, but persisted there) — read both the top-level field and the
  // nested mirror, preferring whichever is present.
  const hmDrop = (data.heatmap as { weighted_top_dropoff_t?: number | null } | null | undefined)
    ?.weighted_top_dropoff_t;
  const direct = data.weighted_top_dropoff_t ?? hmDrop;
  if (direct != null) return direct;
  const curve = data.heatmap?.weighted_curve;
  const segs = data.heatmap?.segments;
  if (!curve || curve.length < 2 || !segs || segs.length === 0) return null;
  const drop = findBiggestDrop(normalizeCurve(curve));
  if (!drop) return null;
  return segs[drop.index]?.t_start ?? null;
}

/** "Top X%" niche rank from the cached comparisons cohort. Returns null on a thin /
 *  missing cohort (honest — the hero + row simply omit the stat, never a fake rank).
 *  Percentile is read off the decile histogram, with a linear split inside your bin. */
function nicheTopPercent(score: number, niche: ComparisonsResponse['niche']): string | null {
  if (!niche) return null;
  const hist = niche.histogram ?? [];
  const total = hist.reduce((a, b) => a + b, 0);
  if (total === 0 || niche.count < 5) return null;
  const s = Math.max(0, Math.min(100, score));
  const bin = Math.min(9, Math.floor(s / 10));
  let below = 0;
  for (let i = 0; i < bin; i++) below += hist[i] ?? 0;
  const within = (hist[bin] ?? 0) * ((s - bin * 10) / 10);
  const rankBelow = (below + within) / total;
  const top = Math.max(1, Math.min(99, Math.round((1 - rankBelow) * 100)));
  return `Top ${top}%`;
}

export function Reading() {
  const { id, data, isLoading } = usePermalinkAnalysis();
  const { data: comparisons } = useComparisons(id);

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

  const score = Math.round(Number.isFinite(data.overall_score) ? data.overall_score : 0);
  const watch = heroWatchPct(data.heatmap);
  const dims: ApolloDimension[] | null | undefined = apollo?.dimensions;
  const dropT = heroDropT(data);
  const nicheRank = nicheTopPercent(score, comparisons?.niche ?? null);

  // Finish rate — % of the simulated audience who watch to the end. Always derivable
  // from the persona sim (unlike niche rank, which needs a cross-user cohort), so it
  // is the hero's reliable third stat. null when there are no personas (then omit).
  const audienceNodes = buildAudienceNodes(data);
  const finishRate = (() => {
    if (audienceNodes.length === 0) return null;
    const { finishing, total } = personasFinishing(audienceNodes);
    return total > 0 ? Math.round((finishing / total) * 100) : null;
  })();

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
    <div data-testid="reading" className="mx-auto flex w-full max-w-[600px] flex-col gap-6 px-4 pt-8 pb-36">
      {/* The read — scorecard (poster + gauge + 3 stats) with the audience overview
          ("How far it gets pushed") folded in under the gauge. (The detailed
          10-segment deep-dive returns in the step-2 panel redesign.) */}
      <ReadingHero
        score={score}
        watch={watch}
        dropT={dropT}
        finishRate={finishRate}
        heatmap={data.heatmap ?? null}
        simResults={data.persona_simulation_results}
        partial={data.partial_analysis}
      />

      {/* Score drivers — Hook · Retention · Shareability lever rows. */}
      <ScoreDriversSection data={data} dims={dims} dropT={dropT} id={id} />

      {/* Audience & context — Niche rank distribution (audience deep-dive deferred). */}
      <AudienceContextSection data={data} dims={dims} id={id} nicheRank={nicheRank} />

      {/* Actionable fixes + copyable hook rewrites. */}
      <FixFirstList
        fixes={data.counterfactuals?.suggestions}
        rewrites={apollo?.rewrites}
        score={data.overall_score}
        weakestLever={weakestLever}
      />

      {/* Light inline expand of the remaining 3 dimensions. */}
      <DeeperRead dimensions={dims} />

      {/* Persistent follow-up chat — the result is the top of the thread; the
          composer stays pinned so you can keep talking to the read. */}
      {id && <ReadingChat analysisId={id} />}
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
      className="mx-auto flex w-full max-w-[600px] flex-col items-center gap-2 px-4 py-16 text-center"
    >
      <p className="text-sm text-foreground-muted">Reading your simulation…</p>
    </div>
  );
}

function CouldNotAnalyze() {
  return (
    <div
      data-testid="reading-unavailable"
      className="mx-auto flex w-full max-w-[600px] flex-col items-center gap-2 px-4 py-16 text-center"
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
      className="mx-auto flex w-full max-w-[600px] flex-col items-center gap-2 px-4 py-16 text-center"
    >
      <p className="text-base font-medium text-foreground">This Simulation didn&apos;t load</p>
      <p className="text-sm text-foreground-muted">Refresh, or open another from the sidebar.</p>
    </div>
  );
}
