'use client';

import { useRef, useState } from 'react';
import type {
  PredictionResult,
  ApolloDimension,
  HeatmapPayload,
  HookDecomposition,
  GeminiAudioSignals,
  CtaSegmentResult,
} from '@/lib/engine/types';
import type { EmotionArcPoint } from '@/lib/engine/qwen/schemas';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import {
  buildPersonaNodes,
  buildSegmentGroups,
  worstBadGroupKey,
  averageWatchThrough,
  // Retention composed-cluster derives (PURE, store-free — the curve recipe
  // traced from AudienceNode L122–131 minus the client-weight recompute branch).
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
// Phase-3 transplanted LEAF visuals (NEVER a *Node/*Frame/*Hero — those drag
// useBoardStore back, breaking the reading cluster's store-free invariant). Props
// are re-derived here from the already-authorized `data`.
import { ScoreDistribution } from '@/components/board/verdict/ScoreDistribution';
import { confidenceRange, deriveBehavioralTiles } from '@/components/board/verdict/verdict-derive';
import { useComparisons } from '@/components/board/verdict/use-comparisons';
import { PersonaGraph } from '@/components/board/_kit/PersonaGraph';
import { StatTileRow, type StatTileData } from '@/components/board/_kit/StatTile';
import { RetentionChart } from '@/components/board/audience/RetentionChart';
import { SegmentTable } from '@/components/board/audience/SegmentTable';
import { CraftFilmstrip } from '@/components/board/content-analysis/CraftFilmstrip';
import { buildCells, audioMixCaption } from '@/components/board/content-analysis/content-analysis-derive';

import { ThumbnailStrip } from './thumbnail-strip';
import { AntiViralityHeader } from './anti-virality-header';
import { ScoreGauge } from './score-gauge';
import { PersonaCloud } from './persona-cloud';
import { DriverRows } from './driver-rows';
import { FixFirstList } from './fix-first-list';
import { DeeperRead } from './deeper-read';
import { DrillSheet } from './drill-sheet';
import { ReadingSkeleton } from './reading-skeleton';

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

/** Closed allow-list for the drill panel (Security V5 — never reflect a raw key).
 *  P3 (D-02) extends it with `score` — a LITERAL, set only via setPanel('score');
 *  the Record<PanelId,string> below makes a missing/extra key a compile error, so
 *  the title/content switch can never index a reflected key (threat T-02-12). */
type PanelId = 'hook' | 'retention' | 'shareability' | 'personas' | 'score';

const PANEL_TITLE: Record<PanelId, string> = {
  hook: 'Hook',
  retention: 'Retention',
  shareability: 'Shareability',
  personas: 'Audience',
  score: 'Score',
};

/** Whitelisted dual-read: Apollo lives at variants.apollo on permalink reload,
 *  at apollo_reasoning on live SSE (Pitfall 2 — permalink blank WPk976kozfWs). */
function readApollo(data: PredictionResult): PredictionResult['apollo_reasoning'] {
  const v = (data as { variants?: { apollo?: PredictionResult['apollo_reasoning'] } }).variants
    ?.apollo;
  return v ?? data.apollo_reasoning ?? null;
}

/** Whitelisted dual-read for the CraftFilmstrip's craft signals (audio + cta).
 *  On the LIVE SSE PredictionResult they sit at the top level; the persisted
 *  permalink row nests them under variants.craft (mirrors ContentAnalysisFrame
 *  L79–99 — reading variants.craft alone left these blank on a fresh board, and
 *  reading top-level alone leaves them blank on reload). emotion_arc is top-level
 *  on both shapes today (RESEARCH Open-Q1 / A2). All three degrade cleanly when
 *  absent — CraftFilmstrip renders a flat audio band + neutral cells, never throws. */
type CraftVariants = {
  variants?: { craft?: { audio_signals?: GeminiAudioSignals | null; cta_segment?: CtaSegmentResult | null } | null } | null;
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

/** Hero-owned watch% (READ-04). Container-computed so it survives the empty-
 *  personas degraded path (PersonaCloud returns null there). averageWatchThrough
 *  is already a 0–100 int; the fallback ×100s the heatmap completion fraction.
 *
 *  D-13 honesty contract (CR-01): returns null — NOT a fabricated 0 — when
 *  watch-through is genuinely underivable (no personas AND no weighted_completion_pct,
 *  or heatmap absent entirely). The caller omits the "% watch" caption when null,
 *  exactly like the score gate. The field is genuinely absent on text / tiktok-url
 *  reads and on permalink rows where Pass 2 fell below threshold (types.ts:482). */
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
  const [panel, setPanel] = useState<PanelId | null>(null);
  // Phase-4 (REVEAL-01/02): true once we've shown the in-flight skeleton, so the
  // settled thread cascades in (the live build) — but a cold permalink reload of
  // an already-complete Reading just appears at rest (no gratuitous animation).
  const sawSkeleton = useRef(false);

  // ── D-13 honesty gate, FIRST (before any block composes) ───────────────────
  // No id → the no-id /analyze route: stay inert so the Phase-1 composer shell
  // owns the screen (the layout mounts this above the page; nothing to read yet).
  if (!id && !data) return null;
  if (isLoading) {
    sawSkeleton.current = true;
    return <ReadingSkeleton id={id} />;
  }
  // id present but the fetch returned nothing → a real load failure (permalink).
  if (!data) return <ReadingError />;

  // Dual-read BEFORE deriving rows/rewrites/dims.
  const apollo = readApollo(data);

  // In-flight: the composer streamed this run but unmounted on navigation, so the
  // result arrives via usePermalinkAnalysis's poll (not the dead SSE). While the
  // placeholder row is still processing (overall_score:null + engine_version
  // 'pending'), show the calm live state — NOT a fabricated 0-gauge and NOT the
  // "couldn't analyze" copy (which is reserved for a genuinely failed read). The
  // poll flips this to the real Reading the moment the pipeline completes.
  const processing =
    (data as { processing?: boolean }).processing ??
    (data.overall_score == null &&
      (data as { engine_version?: string | null }).engine_version === 'pending');
  if (processing) {
    sawSkeleton.current = true;
    return <ReadingSkeleton id={id} />;
  }

  if (data.analysis_unavailable) return <CouldNotAnalyze />;

  // Phase-4: cascade the core blocks in only after a live wait (REVEAL-01).
  // CSS `.reading-reveal` is reduced-motion-gated; the per-block delay staggers
  // hero → rows → Fix First so the thread reads as building, then settles.
  const revealClass = sawSkeleton.current ? 'reading-reveal' : undefined;

  const watch = heroWatchPct(data.heatmap);
  const dims: ApolloDimension[] | null | undefined = apollo?.dimensions;
  // Canonical drop-time path the existing DriverRows test reads (top-level,
  // SECONDS — types.ts L483), with the heatmap mirror as a fallback.
  const dropT = data.weighted_top_dropoff_t ?? data.heatmap?.weighted_top_dropoff_t ?? null;

  // The single weakest of the three driver levers (same min-score rule DriverRows
  // uses) — feeds FixFirstList's honest empty-state copy so a weak read never
  // claims "This one's solid" (counterfactuals are dormant → fixItems always empty).
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
    <div data-testid="reading" className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-4 py-8">
      {/* 1 — thumbnail poster (omits itself when there's no real keyframe) */}
      <ThumbnailStrip heatmap={data.heatmap ?? null} />

      {/* 2 — gate banner ABOVE the gauge (D-04); renders null when not gated.
              WR-05: only render once a REAL id exists — analysisId='' would
              collapse the per-id localStorage dismissal key to a shared constant,
              bleeding a dismissal across all id-less streaming reads. */}
      {id && <AntiViralityHeader result={data} analysisId={id} />}

      {/* 3 — HERO: gauge | (cloud + hero-owned watch%). CSS-responsive stack→row,
              NOT a useIsMobile switch (the gauge + cloud both render either way). */}
      <section
        data-testid="reading-hero"
        className={`flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-10${revealClass ? ` ${revealClass}` : ''}`}
        style={revealClass ? { animationDelay: '0ms' } : undefined}
      >
        <div className="flex flex-col items-center gap-2">
          {/* D-02: the hero gauge taps open the new `score` drill-down. */}
          <ScoreGauge score={data.overall_score} onOpen={() => setPanel('score')} />
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
              survives the empty-personas degraded path (READ-04). Omitted entirely
              when watch-through is genuinely underivable — never a fabricated 0
              presented as a real figure (D-13 / CR-01). */}
          {watch != null && (
            <p data-testid="reading-watch" className="text-sm text-foreground-secondary">
              <span className="font-semibold tabular-nums text-foreground">{watch}%</span> watch
            </p>
          )}
        </div>
      </section>

      {/* 4 — the three always-visible levers (tap → DrillSheet) */}
      <div className={revealClass} style={revealClass ? { animationDelay: '80ms' } : undefined}>
        <DriverRows dimensions={dims} dropT={dropT} onRowTap={setPanel} />
      </div>

      {/* 5 — actionable fixes + copyable hook rewrites */}
      <div className={revealClass} style={revealClass ? { animationDelay: '160ms' } : undefined}>
        <FixFirstList
          fixes={data.counterfactuals?.suggestions}
          rewrites={apollo?.rewrites}
          score={data.overall_score}
          weakestLever={weakestLever}
        />
      </div>

      {/* 6 — light inline expand of the remaining 3 dimensions */}
      <DeeperRead dimensions={dims} />

      {/* ONE DrillSheet, driven by panel state; native D-12 content per panel */}
      <DrillSheet
        open={!!panel}
        onOpenChange={(open) => !open && setPanel(null)}
        title={panel ? PANEL_TITLE[panel] : ''}
      >
        {panel && <PanelContent panel={panel} data={data} dims={dims} id={id} />}
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
  id,
}: {
  panel: PanelId;
  data: PredictionResult;
  dims: ApolloDimension[] | null | undefined;
  /** Analysis id (from the container's single subscription) — the score panel's
   *  panel-local useComparisons(id) reads the niche cohort from it. */
  id: string | null;
}) {
  switch (panel) {
    case 'hook':
      return <HookPanel hook={data.hook_decomposition ?? null} dims={dims} />;
    case 'retention':
      return <RetentionPanel data={data} />;
    case 'shareability':
      return (
        <ShareabilityPanel
          data={data}
          dim={dims?.find((d) => d.name === 'share_pull')}
        />
      );
    case 'personas':
      return <PersonasPanel data={data} />;
    case 'score':
      return <ScorePanel data={data} id={id} />;
  }
}

/**
 * ScorePanel (D-02) — "where your score sits in your niche, and how sure we are."
 * Mirrors VerdictNode.tsx L244–272 byte-for-byte: round(overall_score), the
 * confidenceRange derived from the numeric confidence, and showRangeText gated off
 * HIGH confidence. The niche cohort is fetched panel-local (lazy useComparisons) —
 * NOT a second analysis subscription. niche null/thin → ScoreDistribution's own
 * lane/absolute mode (the in-panel honest degrade — no throw, no fabricated 0; D-13).
 *
 * READ-10: reads ONLY overall_score / confidence / confidence_label + the derived
 * niche; the raw PredictionResult is never spread into JSX.
 */
function ScorePanel({ data, id }: { data: PredictionResult; id: string | null }) {
  const { data: comparisons } = useComparisons(id);
  const niche = comparisons?.niche ?? null;
  const score = Math.round(data.overall_score);
  const range = confidenceRange(score, data.confidence);
  const showRangeText = data.confidence_label !== 'HIGH';
  return (
    <ScoreDistribution
      score={score}
      niche={niche}
      range={range}
      showRangeText={showRangeText}
    />
  );
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

/**
 * RetentionPanel (D-03/D-04/D-06) — the SIGNATURE drill-down: the composed "watch
 * journey" on ONE aligned, scrollable timeline. Top-to-bottom:
 *   1. RetentionChart  — the survival curve + its built-in niche/ghost overlay +
 *      coral drop mark + the time-aligned keyframe strip (attention across time).
 *   2. CraftFilmstrip  — the energy-graded keyframe cells (what's on screen across
 *      the SAME timeline) + the audio activity band.
 *   3. SegmentTable    — the who-leaves cohort breakdown + per-cohort drop frames.
 * The relationship IS the point: "you lose them at 0:08 → here's the frame + the
 * cohort at 0:08." All three consume the SAME heatmap.segments + the SAME filmstrips
 * map, so the timeline aligns by construction (D-06).
 *
 * Store-free: the curve recipe is traced from AudienceNode L122–131 MINUS the
 * client-weight recompute branch (the board-only override UI). Filmstrips come from
 * usePermalinkFilmstrips() — a separate cached query keyed by the route id, NOT a
 * second analysis subscription (RESEARCH § Mount Mechanics). NEVER imports a
 * *Node/*Frame (Pitfall 1).
 *
 * Units (Pitfall 2 — the 0:08-vs-0:00 trap): `total` is SECONDS (totalDuration →
 * last segment t_end); the drop time the charts render is `seg.t_start` (SECONDS).
 * The charts format internally via audience-derive.formatTime / formatTimeSec — we
 * pass SECONDS values only, never a ms field.
 *
 * D-13 guard FIRST (Pitfall 5): empty curve AND no segments → PanelEmpty (never an
 * empty SVG). Per-block degradation below the guard: the filmstrip self-gates to
 * neutral cells on no-keyframes; SegmentTable hides zero-count cohorts. No throw on
 * null heatmap / null curve / apollo-null.
 *
 * READ-10: reads ONLY the whitelisted derived inputs (curve from weighted_curve,
 * segments, emotion_arc, audio_signals, cta_segment, persona groups) — the raw
 * PredictionResult is never spread into JSX.
 */
function RetentionPanel({ data }: { data: PredictionResult }) {
  // Keyframe map — store-free cached query (reads the route id internally).
  const filmstrips = usePermalinkFilmstrips();

  const heatmap = data.heatmap ?? null;
  const segments = heatmap?.segments ?? [];

  // Survival curve (the recipe, store-free). raw weighted_curve → normalized →
  // monotonic survival; the biggest drop is found on the re-normalized survival.
  // An empty weighted_curve ([]) is treated as no-curve (→ null), not a 0-length
  // SVG path. (toRetentionCurve([]) === [] otherwise leaks past the guard.)
  const raw = heatmap?.weighted_curve ?? null;
  const curve = raw && raw.length > 0 ? toRetentionCurve(normalizeCurve(raw)) : null;
  const drop = curve ? findBiggestDrop(normalizeCurve(curve)) : null;
  const total = totalDuration(heatmap?.segments, 30); // SECONDS

  // D-13 honesty gate FIRST (Pitfall 5): the composed "watch journey" is a
  // timeline — with no segments there is no timeline to align the curve/filmstrip/
  // table to, and with no curve there is no attention story. Either missing →
  // PanelEmpty (the calm copy), NEVER an empty SVG / empty table / fabricated 0.
  // This is what degrades makeEmptySegmentsResult (segments:[]) AND
  // makeEmptyHeatmapResult (heatmap:null → segments:[], curve:null).
  if (segments.length === 0 || curve == null) return <PanelEmpty />;

  // Flat niche-completion fallback (0–1) for the ghost line when no niche personas
  // exist; the >1.5 heuristic distinguishes a 0–100 value from a 0–1 fraction.
  const ncp = heatmap?.niche_completion_pct;
  const nicheCompletionPct =
    ncp != null ? (ncp > 1.5 ? ncp / 100 : ncp) : null;

  // CraftFilmstrip inputs — arc/audio/cta via the whitelisted dual-read (A2: arc/
  // audio MAY be flat on a reloaded upload if they land under variants; degrades
  // to a flat audio band + neutral cells, never a throw — flagged for 03-06 UAT).
  const { arc, audio, ctaPresent } = readCraftSignals(data);
  const cells = buildCells(segments, filmstrips, arc, total);

  // SegmentTable inputs — the who-leaves cohorts + per-cohort drop frames.
  const groups = buildSegmentGroups(heatmap, data.persona_simulation_results);
  const badKey = worstBadGroupKey(groups);
  const slotKeys: SlotKey[] = ['fyp', 'niche', 'loyalist', 'cross_niche'];
  const cohortFrames: Partial<Record<SlotKey, CohortDropFrame>> = {};
  for (const key of slotKeys) {
    const frame = cohortDropFrame(heatmap, key, filmstrips);
    if (frame) cohortFrames[key] = frame;
  }

  // ONE aligned timeline, scrollable in the DrillSheet (its content is already
  // overflow-y-auto). gap-6 (24px) between the three DISTINCT visuals (D-06 rhythm).
  // testid is the cluster's own (the native `panel-retention` list is retired —
  // the 03-05 test asserts that testid is GONE once the rich charts mount).
  return (
    <div data-testid="panel-retention-cluster" className="flex flex-col gap-6 pt-2">
      <RetentionChart
        curve={curve}
        heatmap={heatmap}
        drop={drop}
        totalDurationSec={total}
        filmstrips={filmstrips}
        nicheCompletionPct={nicheCompletionPct}
        isLoading={false}
      />
      <CraftFilmstrip
        cells={cells}
        durationSec={total}
        arc={arc}
        audio={audio}
        audioCaption={audio ? audioMixCaption(audio) : ''}
        ctaPresent={ctaPresent}
        isLoading={false}
      />
      <SegmentTable groups={groups} badKey={badKey} cohortFrames={cohortFrames} isLoading={false} />
    </div>
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

/** Personas panel (D-03) — the full PersonaGraph (the 200-dot SVG cloud, hover→tap
 *  on mobile), swapped in for the P2 native list. Builds PersonaNode[] via the SAME
 *  call PersonaCloud makes (worstBadGroupKey(buildSegmentGroups(...)) → buildPersonaNodes).
 *  Empty nodes → PanelEmpty (mirrors PersonaCloud's null path — no throw, no grey-cell).
 *  reducedMotion gates PersonaGraph's <animate> pulse; the tap-to-reveal is
 *  self-contained in PersonaGraph (03-03), so no extra prop. READ-10: reads only the
 *  derived nodes (from heatmap/sim) — never spreads `data`. */
function PersonasPanel({ data }: { data: PredictionResult }) {
  const reducedMotion = usePrefersReducedMotion();
  const heatmap = data.heatmap ?? null;
  const badKey = worstBadGroupKey(buildSegmentGroups(heatmap, data.persona_simulation_results));
  const nodes = buildPersonaNodes(heatmap, data.persona_simulation_results, badKey);
  if (nodes.length === 0) return <PanelEmpty />;
  return <PersonaGraph personas={nodes} reducedMotion={reducedMotion} />;
}

/** Shareability panel (D-03) — the behavioral rate tiles (deriveBehavioralTiles:
 *  share/completion/comment/save, omitting absent *_pct — never a fabricated 0%)
 *  with the single weakest tile marked coral, followed by the share_pull lever
 *  evidence as supporting text. PanelEmpty only when BOTH tiles and the dim are
 *  absent (no throw, no grey-cell). READ-10: reads only the derived tiles
 *  (behavioral_predictions) + dim.evidence — never spreads `data`. */
function ShareabilityPanel({
  data,
  dim,
}: {
  data: PredictionResult;
  dim: ApolloDimension | undefined;
}) {
  const tiles: StatTileData[] = deriveBehavioralTiles(data);
  // Mark the single weakest tile (lowest numeric value) coral; the rest stay default.
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
    <div data-testid="panel-shareability" className="flex flex-col gap-3 pt-2">
      <StatTileRow tiles={tiles} />
      {dim?.evidence && (
        <p className="text-[13px] text-foreground-secondary">{dim.evidence}</p>
      )}
    </div>
  );
}

function PanelEmpty() {
  return <p className="pt-2 text-[13px] text-foreground-muted">Not available for this read.</p>;
}

// ─────────────────────────────────────────────────────────────────────────────
// D-13 states — never present a fabricated 0 as a real score; never a blank.
// Calm, plain copy (no prose verdict, D-15). Copy strings from 02-UI-SPEC.
// ─────────────────────────────────────────────────────────────────────────────

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
