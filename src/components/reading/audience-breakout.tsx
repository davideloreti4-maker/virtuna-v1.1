'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type { HeatmapPayload, PersonaSimulationResult } from '@/lib/engine/types';
import {
  buildSegmentGroups,
  formatTime,
  type SegmentGroup,
} from '@/components/board/audience/audience-derive';

// AudienceBreakout — "How far it gets pushed" (breakout-levels v10 → folded into
// the hero as v7, LOCKED 2026-06-15). The audience overview now lives INSIDE the
// read card, under the gauge — no separate "Your audience" card, no banner.
//
// The model (Davide locked the framing): TikTok shows the video to progressively
// bigger batches — Stage 1 (~200) → Stage 2 (~1,000) → Stage 3 (~10,000) →
// Viral (100K+). Each batch widens AND cools, so the share who keep watching
// declines as reach grows. The fill of each tube IS that share; a dashed promotion
// line (~55%) is the bar a stage must clear to get pushed on. It caps at the first
// stage whose fill drops below the line (green above, coral below).
//
// FOLDED-IN UI (v7, Davide's calls): quiet "How far it gets pushed" title; the %
// explanation lives behind an info "!" tooltip (not an always-on sub-line); each
// VIEW count carries an eye so it reads as views; bottom-aligned tubes with a
// pillar-to-pillar dotted connector + a faint rising field that show the batch
// scaling up — and the connector/field into the capped pillar turn CORAL to mark
// where the breakout stops. Connector geometry is computed from the MEASURED row
// (not a stretched viewBox) so the dots hit each pillar's top corner exactly.
//
// DERIVATION (Davide: "don't worry about honesty, I'll adjust the engine later"):
// warmest cohort retention → Stage 1, coldest → Viral, the rest interpolate (the
// real cohort spread is the cooling envelope). Falls back to a gentle envelope off
// the overall watch-through, and returns null (renders nothing) when neither is
// derivable. NO verdict/advice prose beyond naming the single lever (D-15).

/** The 4 fixed stages: illustrative reach (Davide: reach #s illustrative OK), stage
 *  subtitle, and a tube height that grows with the batch (folded = smaller, 64→160). */
const STAGE_DEFS = [
  { reach: '200', stage: 'Stage 1', height: 64 },
  { reach: '1,000', stage: 'Stage 2', height: 96 },
  { reach: '10,000', stage: 'Stage 3', height: 128 },
  { reach: '100K+', stage: 'Viral', height: 160 },
] as const;
/** The promotion bar — clear it to get pushed to the next stage. */
const PROMOTION_LINE = 55;
/** Tube max width + the flex gap (gap-5 = 20px) — used by the connector geometry. */
const TUBE_MAX_W = 62;
const ROW_GAP = 20;

export interface ReachStage {
  reach: string;
  stage: string;
  rate: number;
  cleared: boolean;
  height: number;
}

export interface ReachModel {
  stages: ReachStage[];
  line: number;
  clearedCount: number;
  breakoutReach: string | null;
}

const clamp01to100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Derive the 4 reach stages from the cohort spread (pure — unit-tested directly).
 * Warmest cohort → Stage 1, coldest → Viral, the rest interpolate (the real cohort
 * spread is the cooling envelope). Returns null when there's no cohort to read — the
 * honest degraded path (no fabricated cascade off a single overall number).
 */
export function buildReachStages(groups: SegmentGroup[]): ReachModel | null {
  const visible = groups.filter((g) => g.count > 0);
  if (visible.length === 0) return null;

  const pcts = visible.map((g) => g.pct);
  const warm = Math.max(...pcts);
  const cold = Math.min(...pcts);

  const last = STAGE_DEFS.length - 1;
  const stages: ReachStage[] = STAGE_DEFS.map((def, k) => {
    const t = k / last;
    const rate = clamp01to100(warm + (cold - warm) * t);
    return {
      reach: def.reach,
      stage: def.stage,
      rate,
      cleared: rate >= PROMOTION_LINE,
      height: def.height,
    };
  });

  const clearedCount = stages.filter((s) => s.cleared).length;
  const breakoutReach = clearedCount > 0 ? (STAGE_DEFS[clearedCount - 1]?.reach ?? null) : null;

  return { stages, line: PROMOTION_LINE, clearedCount, breakoutReach };
}

/** One dotted pillar-to-pillar connector + its rising field wedge, in measured px. */
interface GapGeom {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Leads into a pillar the video never reaches → the wedge darkens (a shadow, not
   *  coral) and the connector dims, marking where the breakout stops. */
  unreached: boolean;
}

/** Geometry for the connectors/wedges from the measured row box. Pillars sit centred
 *  in equal flex columns (capped at TUBE_MAX_W); connectors run top-corner →
 *  top-corner across each gap. Empty until the row is measured (w=0). */
function gapGeometry(stages: ReachStage[], w: number, h: number): GapGeom[] {
  if (w <= 0 || h <= 0) return [];
  const n = stages.length;
  const colW = (w - ROW_GAP * (n - 1)) / n;
  const half = Math.min(colW, TUBE_MAX_W) / 2;
  const centerX = (i: number) => i * (colW + ROW_GAP) + colW / 2;
  const topY = (i: number) => h - (stages[i]?.height ?? 0);

  const gaps: GapGeom[] = [];
  for (let i = 0; i < n - 1; i++) {
    gaps.push({
      x1: centerX(i) + half,
      y1: topY(i),
      x2: centerX(i + 1) - half,
      y2: topY(i + 1),
      unreached: !stages[i + 1]?.cleared,
    });
  }
  return gaps;
}

export interface AudienceBreakoutProps {
  heatmap: HeatmapPayload | null;
  simResults: PersonaSimulationResult[] | undefined;
  /** Biggest-drop time in SECONDS — the single lever the foot names. null ⇒ omitted. */
  dropT: number | null;
}

export function AudienceBreakout({ heatmap, simResults, dropT }: AudienceBreakoutProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const groups = buildSegmentGroups(heatmap, simResults);
  const model = buildReachStages(groups);
  if (!model) return null;

  const { stages, line, clearedCount, breakoutReach } = model;
  const total = stages.length;
  const dropTime = dropT != null ? formatTime(dropT) : null;
  const gaps = gapGeometry(stages, box.w, box.h);

  const badge =
    clearedCount === 0
      ? 'stalls at Stage 1'
      : clearedCount === total
        ? 'breaks out — goes viral'
        : `breaks out to ~${breakoutReach}`;

  let foot: ReactNode;
  if (clearedCount === total) {
    foot = (
      <>
        It keeps enough viewers watching all the way to <b className="font-semibold text-foreground">100K+ views</b> —
        this one travels.
      </>
    );
  } else if (clearedCount === 0) {
    foot = (
      <>
        It loses too many in the first batch to get pushed past <b className="font-semibold text-foreground">Stage 1</b>.
        {dropTime ? (
          <>
            {' '}
            Lift the{' '}
            <b className="font-semibold" style={{ color: 'var(--color-cream-secondary)' }}>
              {dropTime}
            </b>{' '}
            drop to get it moving.
          </>
        ) : null}
      </>
    );
  } else {
    foot = (
      <>
        It keeps enough viewers watching to reach{' '}
        <b className="font-semibold text-foreground">{breakoutReach} views</b>
        {dropTime ? (
          <>
            {' '}
            — then the{' '}
            <b className="font-semibold" style={{ color: 'var(--color-cream-secondary)' }}>
              {dropTime}
            </b>{' '}
            drop loses too many and it stalls before viral.
          </>
        ) : (
          <> — then it stalls before viral.</>
        )}
      </>
    );
  }

  return (
    <div
      data-testid="audience-breakout"
      className="border-t border-[var(--color-border)] px-[18px] pb-[18px] pt-5 min-[520px]:px-6"
    >
      {/* quiet title + info "!" (explanation behind it) + breakout badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground-secondary">
            How far it gets pushed
          </span>
          <TooltipPrimitive.Provider delayDuration={120}>
            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <button
                  type="button"
                  aria-label="What the percentages mean"
                  className="inline-flex h-[15px] w-[15px] items-center justify-center rounded-full border border-[var(--color-border-hover)] text-[10px] font-extrabold leading-none text-foreground-muted transition-colors hover:text-foreground-secondary"
                >
                  !
                </button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  className="z-50 max-w-[240px] rounded-md border border-[var(--color-border-hover)] bg-[var(--color-surface-elevated)] px-3 py-2 text-[11.5px] leading-[1.5] text-foreground-secondary shadow-[0_10px_26px_rgba(0,0,0,0.45)]"
                >
                  Each bar is the{' '}
                  <span className="font-semibold text-foreground">% who keep watching</span> as the
                  video is shown to a bigger batch of viewers. Clear the dashed line and it&apos;s
                  pushed to the next batch.
                  <TooltipPrimitive.Arrow className="fill-[var(--color-surface-elevated)]" />
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
          </TooltipPrimitive.Provider>
        </div>
        <span
          data-testid="audience-breakout-badge"
          className="text-[11.5px] font-semibold text-foreground-muted"
        >
          {badge}
        </span>
      </div>

      {/* tubes + the scaling overlay (connectors/wedges drawn in measured px) */}
      <div className="relative mt-4">
        <svg
          className="pointer-events-none absolute inset-0"
          width={box.w || undefined}
          height={box.h || undefined}
          viewBox={box.w ? `0 0 ${box.w} ${box.h}` : undefined}
          aria-hidden
        >
          {gaps.map((g, i) => (
            <polygon
              key={`w${i}`}
              points={`${g.x1},${box.h} ${g.x1},${g.y1} ${g.x2},${g.y2} ${g.x2},${box.h}`}
              fill={g.unreached ? 'rgba(0,0,0,0.13)' : 'rgba(236,231,222,0.03)'}
            />
          ))}
          {gaps.map((g, i) => (
            <line
              key={`l${i}`}
              x1={g.x1}
              y1={g.y1}
              x2={g.x2}
              y2={g.y2}
              stroke={g.unreached ? 'rgba(236,231,222,0.18)' : 'rgba(236,231,222,0.42)'}
              strokeWidth={1.6}
              strokeDasharray="0.5 7"
              strokeLinecap="round"
            />
          ))}
        </svg>

        <div ref={rowRef} className="relative z-10 flex items-end justify-between gap-5">
          {stages.map((s) => (
            <div key={s.stage} className="flex flex-1 flex-col items-center justify-end">
              <span
                className={`mb-2 flex items-center gap-1 text-[12px] font-bold tabular-nums ${s.cleared ? 'text-foreground' : 'text-foreground-secondary'}`}
              >
                <Eye className="h-3 w-3 opacity-70" strokeWidth={2.2} aria-hidden />
                {s.reach}
              </span>
              <div
                className="relative w-full max-w-[62px] overflow-hidden rounded-lg border border-[var(--color-border)]"
                style={{ height: s.height, background: '#211f1d' }}
              >
                <div
                  className="absolute inset-x-0 bottom-0"
                  style={{
                    height: `${s.rate}%`,
                    // Was two hardcoded rgba literals. The "not cleared" fill was
                    // rgba(217,119,87,…) — #d97757, the RETIRED terracotta accent — rendering a
                    // second, different red four hundred pixels from the live --color-accent
                    // (#FF6363) dot in the same Reading. Neither literal tracked a token, so
                    // the accent migration silently skipped the flagship surface.
                    background: s.cleared
                      ? 'color-mix(in srgb, var(--color-success) 26%, transparent)'
                      : 'color-mix(in srgb, var(--color-accent) 28%, transparent)',
                  }}
                />
                <div
                  className="absolute -left-1.5 -right-1.5"
                  style={{ bottom: `${line}%`, borderTop: '1px dashed rgba(236,231,222,0.22)' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* under-bar: % (= share watching) + stage subtitle, aligned to the tubes */}
      <div className="mt-3 flex justify-between gap-5">
        {stages.map((s) => (
          <div key={s.stage} className="flex-1 text-center">
            <div
              className="text-[15px] font-bold tabular-nums"
              style={{ color: s.cleared ? 'var(--color-foreground)' : 'var(--color-cream-secondary)' }}
            >
              {s.rate}%
            </div>
            <div className="mt-[2px] text-[10.5px] text-foreground-muted">{s.stage}</div>
          </div>
        ))}
      </div>

      <p
        data-testid="audience-breakout-foot"
        className="mt-4 border-t border-[var(--color-border)] pt-3.5 text-[12.5px] leading-[1.5] text-foreground-secondary"
      >
        {foot}
      </p>
    </div>
  );
}

AudienceBreakout.displayName = 'AudienceBreakout';
