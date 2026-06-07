'use client';
/**
 * InsightHeroFrame — D-08 insight-hero surface.
 *
 * Surfaces apollo_reasoning from the engine (Apollo wave_2) as the board hero:
 *   1. Hero read (confidence_scope + ceiling_capper)
 *   2. 3 verbatim-grounded rewrites (original struck-through + copyable variant)
 *      D-07: the retention-lever rewrite is labelled with the heatmap's biggest-drop mm:ss
 *   3. 6 §4-cited dimensions (band + numeric score, defensive on pre-D-01 rows)
 *   4. Score band (D-02, demoted below insight — bandLabel + confidenceRange from verdict-derive)
 *   5. Flop warning (anti_virality_gated)
 *
 * DUAL-READ: reads variants.apollo (permalink) OR apollo_reasoning (live SSE) so the frame
 * never blanks on permalink reload (Pitfall 2 / regression WPk976kozfWs).
 *
 * Progressive reveal: reads panelReady["insight_hero"] from useAnalysisStream.
 * Shows a light loading state when "loading"; renders content when "ready".
 */

import { useMemo, useState } from 'react';
import { useAnalysisStream } from '@/hooks/queries/use-analysis-stream';
import { usePermalinkAnalysis } from '@/hooks/queries/use-permalink-analysis';
import type { ApolloDimension, ApolloRewrite } from '@/lib/engine/types';
import { findBiggestDrop, formatTime } from './audience/audience-derive';
import { bandLabel, bandTone, confidenceRange } from './verdict/verdict-derive';
import type { GroupFrameLayout, Camera } from './board-types';

// ─── Local type helpers ────────────────────────────────────────────────────────

interface ApolloShape {
  rewrites: ApolloRewrite[];
  dimensions: ApolloDimension[];
  composite_score: number;
  confidence_scope: string;
  ceiling_capper?: string;
  platform_note?: string;
}

interface InsightHeroRow {
  overall_score?: number | null;
  confidence?: number | null;
  anti_virality_gated?: boolean;
  apollo_reasoning?: ApolloShape | null;
  variants?: { apollo?: ApolloShape | null } | null;
  // T2.2: computed-but-thrown-away signals now surfaced.
  // verbatim.hook = the exact judged line (grounds the rewrites' struck-through originals).
  verbatim?: { hook?: { spoken_words?: string | null; on_screen_text?: string | null } | null } | null;
  // warnings[] = DeepSeek Step-4 fatal-flaw text (only the derived bool surfaced before).
  warnings?: string[] | null;
  heatmap?: {
    weighted_curve?: number[];
    segments?: Array<{
      idx: number;
      t_start: number;
      t_end: number;
      is_hook_zone: boolean;
      label?: string;
    }>;
  } | null;
}

export interface InsightHeroFrameProps {
  camera: Camera;
  layout: GroupFrameLayout;
}

// ─── Band display helpers ─────────────────────────────────────────────────────

const BAND_LABEL: Record<string, string> = {
  strong: 'Strong',
  mid:    'Mid',
  weak:   'Weak',
};

const BAND_COLOR: Record<string, string> = {
  strong: 'text-emerald-400',
  mid:    'text-amber-400',
  weak:   'text-red-400',
};

const DIM_NAME_LABEL: Record<string, string> = {
  hook:        'Hook',
  retention:   'Retention',
  clarity:     'Clarity',
  share_pull:  'Share pull',
  substance:   'Substance',
  credibility: 'Credibility',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface RewriteItemProps {
  rewrite: ApolloRewrite;
  dropLabel: string | null;
}

function RewriteItem({ rewrite, dropLabel }: RewriteItemProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard
      .writeText(rewrite.variant)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // clipboard unavailable (insecure context / permission denied) — no-op,
        // the visual "copied" affordance simply doesn't fire.
      });
  }

  return (
    <div
      data-testid="insight-rewrite"
      className="flex flex-col gap-1 rounded-[8px] border border-white/[0.06] p-3"
    >
      {/* Struck-through original */}
      <del className="text-[12px] leading-[1.4] text-white/40">
        {rewrite.original}
      </del>

      {/* Variant + copy */}
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 text-[13px] leading-[1.5] text-white">
          {rewrite.variant}
        </p>
        <button
          type="button"
          aria-label="Copy rewrite"
          onClick={handleCopy}
          className="shrink-0 rounded-[6px] border border-white/[0.06] px-2 py-1 text-[11px] text-white/60 hover:bg-white/[0.1] hover:text-white"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* D-07 drop-point label */}
      {dropLabel && (
        <span
          data-testid="insight-rewrite-drop-label"
          className="text-[11px] text-accent"
        >
          {dropLabel}
        </span>
      )}
    </div>
  );
}

interface DimensionRowProps {
  dim: Partial<ApolloDimension> & { name: string; band: string };
}

function DimensionRow({ dim }: DimensionRowProps) {
  const scoreDisplay = typeof (dim as ApolloDimension).score === 'number'
    ? (dim as ApolloDimension).score
    : null;

  const bandColor = BAND_COLOR[dim.band] ?? 'text-white/60';

  return (
    <div
      data-testid="insight-dimension"
      className="flex items-center justify-between gap-2 py-1"
    >
      <span className="text-[12px] text-white/70">
        {DIM_NAME_LABEL[dim.name] ?? dim.name}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {scoreDisplay !== null && (
          <span className="text-[12px] tabular-nums text-white/50">{scoreDisplay}</span>
        )}
        <span className={`text-[12px] font-medium ${bandColor}`}>
          {BAND_LABEL[dim.band] ?? dim.band}
        </span>
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InsightHeroFrame({ camera: _camera, layout: _layout }: InsightHeroFrameProps) {
  const { data: permalinkData } = usePermalinkAnalysis();
  const stream = useAnalysisStream({ initialData: permalinkData ?? null });
  const { result, panelReady } = stream;

  const row = result as unknown as InsightHeroRow | null;

  // DUAL-READ: variants.apollo (permalink reload) ?? apollo_reasoning (live SSE)
  // Prevents permalink blank (Pitfall 2 / WPk976kozfWs).
  const apollo = useMemo<ApolloShape | null>(() => {
    const v = row?.variants?.apollo;
    return v ?? row?.apollo_reasoning ?? null;
  }, [row?.variants?.apollo, row?.apollo_reasoning]);

  // D-07: compute biggest-drop mm:ss from heatmap weighted_curve
  const dropInfo = useMemo<{ dropTime: string; leverHint: 'retention' } | null>(() => {
    const heatmap = row?.heatmap;
    if (!heatmap?.weighted_curve || heatmap.weighted_curve.length < 2) return null;
    const drop = findBiggestDrop(heatmap.weighted_curve);
    if (!drop) return null;
    const seg = heatmap.segments?.[drop.index];
    if (!seg) return null;
    return { dropTime: formatTime(seg.t_start), leverHint: 'retention' };
  }, [row?.heatmap]);

  // T2.2: the exact hook line we judged — grounds the rewrites' struck-through
  // originals. Combine spoken_words + on_screen_text; null when neither present.
  const hookLine = useMemo(() => {
    const h = row?.verbatim?.hook;
    const spoken = h?.spoken_words?.trim() || null;
    const onScreen = h?.on_screen_text?.trim() || null;
    if (!spoken && !onScreen) return null;
    return { spoken, onScreen };
  }, [row?.verbatim?.hook]);

  // T2.2: DeepSeek fatal-flaw warnings. Filter the internal engine-status lines
  // (weight redistribution + the generic low-confidence note, which the gated
  // state itself already conveys) so creators see only real flaws.
  const fatalWarnings = useMemo(() => {
    const w = row?.warnings;
    if (!Array.isArray(w)) return [] as string[];
    return w.filter(
      (s) =>
        typeof s === 'string' &&
        s.trim().length > 0 &&
        !s.startsWith('Weights redistributed') &&
        !s.startsWith('Low confidence'),
    );
  }, [row?.warnings]);

  // D-02: score band from overall_score + confidence (verdict-derive reuse)
  const scoreBand = useMemo(() => {
    const score = row?.overall_score;
    const conf = row?.confidence;
    if (typeof score !== 'number' || !Number.isFinite(score)) return null;
    const confidence = typeof conf === 'number' && Number.isFinite(conf) ? conf : 0.5;
    const range = confidenceRange(score, confidence);
    const label = bandLabel(score);
    const tone = bandTone(score);
    return { score, range, label, tone };
  }, [row?.overall_score, row?.confidence]);

  const isLoading = panelReady?.['insight_hero'] === 'loading';
  const isReady   = panelReady?.['insight_hero'] === 'ready' || (apollo !== null);
  const isIdle    = !isLoading && !isReady;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isIdle && !apollo) {
    return (
      <div data-testid="insight-hero-frame" className="flex w-full flex-col p-2">
        <p className="py-8 text-center text-xs italic text-white/[0.34]">
          Apollo insight will appear here after analysis completes.
        </p>
      </div>
    );
  }

  if (isLoading && !apollo) {
    return (
      <div data-testid="insight-hero-frame" className="flex w-full flex-col gap-3 p-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-white/[0.06]" />
      </div>
    );
  }

  if (!apollo) {
    return (
      <div data-testid="insight-hero-frame" className="flex w-full flex-col p-2">
        <p className="py-8 text-center text-xs italic text-white/[0.34]">
          No insight data available.
        </p>
      </div>
    );
  }

  const toneClass = (tone: string) => {
    if (tone === 'good') return 'text-emerald-400';
    if (tone === 'warn') return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div
      data-testid="insight-hero-frame"
      className="flex w-full flex-col gap-4 p-3"
    >
      {/* ── 1. Hero read (IN-02) ─────────────────────────────────────────────
          Lead with ceiling_capper — the single highest-leverage thing capping the
          score (§4 actionable insight). confidence_scope is a sensor-coverage caveat,
          so it demotes to the secondary line. Falls back to confidence_scope as the
          lead only when ceiling_capper is absent (defensive on pre-D-01 rows), so the
          hero is never empty and the caveat is never duplicated. */}
      <div className="flex flex-col gap-1">
        <p
          data-testid="insight-hero-lead"
          className="text-[15px] font-[500] leading-[1.4] text-white"
        >
          {apollo.ceiling_capper || apollo.confidence_scope}
        </p>
        {apollo.ceiling_capper && apollo.confidence_scope && (
          <p
            data-testid="insight-hero-caveat"
            className="text-[12px] leading-[1.4] text-white/50"
          >
            {apollo.confidence_scope}
          </p>
        )}
        {apollo.platform_note && (
          <p className="text-[11px] leading-[1.4] text-amber-400/70">
            {apollo.platform_note}
          </p>
        )}
      </div>

      {/* ── 1b. Verbatim hook (T2.2) — the exact line we judged, so the
              struck-through rewrite originals below have visible grounding. ── */}
      {hookLine && (
        <div
          data-testid="insight-verbatim-hook"
          className="flex flex-col gap-1 rounded-[8px] border border-white/[0.06] bg-white/[0.016] p-3"
        >
          <p className="text-[11px] font-[500] uppercase tracking-[0.08em] text-white/40">
            Your hook (as we heard it)
          </p>
          {hookLine.spoken && (
            <p className="text-[13px] leading-[1.5] text-white/85">
              &ldquo;{hookLine.spoken}&rdquo;
            </p>
          )}
          {hookLine.onScreen && (
            <p className="text-[11.5px] leading-[1.4] text-white/45">
              <span className="text-white/35">On-screen: </span>
              {hookLine.onScreen}
            </p>
          )}
        </div>
      )}

      {/* ── 2. Rewrites ──────────────────────────────────────────────────── */}
      {apollo.rewrites.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-[500] uppercase tracking-[0.08em] text-white/40">
            Hook rewrites
          </p>
          {apollo.rewrites.map((rw) => {
            // D-07: attach drop label to the rewrite whose lever_fixed references retention
            const isRetentionLever =
              rw.lever_fixed.toLowerCase().includes('retention') ||
              rw.lever_fixed.includes('§2.2');
            const dropLabel =
              isRetentionLever && dropInfo
                ? `targets the ${dropInfo.dropTime} dip`
                : null;
            return (
              <RewriteItem key={rw.lever_fixed} rewrite={rw} dropLabel={dropLabel} />
            );
          })}
        </div>
      )}

      {/* ── 3. Dimensions ────────────────────────────────────────────────── */}
      {apollo.dimensions.length > 0 && (
        <div className="flex flex-col rounded-[12px] border border-white/[0.06] px-3 py-2">
          <p className="mb-1 text-[11px] font-[500] uppercase tracking-[0.08em] text-white/40">
            Dimension scores
          </p>
          <div className="divide-y divide-white/[0.04]">
            {apollo.dimensions.map((dim) => (
              <DimensionRow key={dim.name} dim={dim} />
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Score band (D-02, demoted below insight) ───────────────────── */}
      {scoreBand && (
        <div
          data-testid="insight-score-band"
          className="flex items-center justify-between rounded-[8px] border border-white/[0.06] p-3"
        >
          <span className={`text-[14px] font-[500] ${toneClass(scoreBand.tone)}`}>
            {scoreBand.label}
          </span>
          <span className="text-[12px] tabular-nums text-white/50">
            {scoreBand.range.lo}–{scoreBand.range.hi}
          </span>
        </div>
      )}

      {/* ── 5. Fatal-flaw warnings (T2.2) — surface the actual DeepSeek Step-4
              fatal-flaw text (warnings[]) as explicit red bullets. Shown whenever
              real flaws exist (NOT gated on anti_virality_gated, which is ~never
              set — that would keep these buried on the weak videos that need them
              most). The gate only escalates the headline. ── */}
      {(fatalWarnings.length > 0 || row?.anti_virality_gated) && (
        <div
          data-testid="insight-flaw-warnings"
          className="flex flex-col gap-1.5 rounded-[8px] border border-red-500/30 bg-red-500/10 p-3"
        >
          <p className="text-[12px] font-[500] text-red-400">
            {row?.anti_virality_gated
              ? "Don't post yet — fix these first."
              : 'Fix these before posting.'}
          </p>
          {fatalWarnings.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {fatalWarnings.map((w, i) => (
                <li
                  key={i}
                  data-testid="insight-flaw-bullet"
                  className="flex gap-1.5 text-[12px] leading-[1.4] text-red-300/90"
                >
                  <span aria-hidden className="text-red-400/70">
                    •
                  </span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] leading-[1.4] text-red-300/80">
              Confidence too low for viral potential.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
