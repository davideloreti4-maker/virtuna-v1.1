'use client';

/**
 * PopulationSwarm — the Population·1,000 side of the AudienceLens scale toggle (P9 W4).
 *
 * An HONEST, lean v1 (D-01): NOT 1,000 model calls. It is a deterministic 1,000-dot
 * swarm INSTANTIATED from the 10 calibrated archetypes via `instantiatePopulation`
 * (lens-derive, 09-01) — presentation over the 10's REAL verdicts, never a fabricated
 * crowd. The live counters are literally `weightedRollup(nodes)` — the SAME aggregate
 * numbers Panel·10 reports, just at a denser resolution (D-02). It makes ZERO scoring
 * calls and imports NOTHING from the engine prediction path (STATE same-video
 * score-identity is protected — Population never touches scoring).
 *
 * Determinism (D-02, Pitfall 3): every dot's x/y comes from a seeded `mulberry32`
 * Box-Muller scatter around its archetype anchor — NO `Math.random`, NO `Date.now`,
 * so the swarm is byte-identical across renders (SSR hydration + engine-determinism
 * gate safe).
 *
 * Perf (Pitfall 2): the 1,000 dots render as ONE batched SVG layer — never 1,000
 * per-circle `<animate>` SMIL elements. The cascade-on-play (driven by the parent
 * AudienceLens via the `cascadeProgress` prop) is a single batched opacity timeline
 * over the dot layer, gated on `reducedMotion`.
 *
 * Drill (D-01): per-dot tap-to-drill is DEFERRED. The v1 drill path is the archetype
 * breakdown — rows per archetype with a representative verbatim. The sr-only aggregate
 * + breakdown mirror is ALWAYS present (independent of motion state).
 *
 * Color (UI-SPEC): cream-alpha dots; coral reserved for the worst cluster ONLY. The
 * honesty label is `--color-cream-muted`. Display 30px for the big live counters.
 */

import { useMemo } from 'react';
import type { PersonaNode } from '@/components/board/_kit';
import type { PopulationAggregate } from '@/lib/audience/population';
import {
  instantiatePopulation,
  weightedRollup,
  type PopulationDot,
} from './lens-derive';

export interface PopulationSwarmProps {
  /** The 10 calibrated archetypes — the single source of truth (same nodes Panel uses). */
  nodes: PersonaNode[];
  /**
   * Audience Sim v2 (Stage 2): the REAL N-individual projection for this concept. When present
   * (and `total > 0`), the live counters, the honesty label, and the per-segment breakdown come
   * from this genuine distribution (the honest-lean `weightedRollup` of the 10 CANNOT produce a
   * per-segment stop split). Absent ⇒ byte-identical fallback to the rollup. The dot scatter is
   * ambient sentiment texture either way — a different axis, so no count/dot mismatch is implied.
   */
  population?: PopulationAggregate;
  /** Deterministic seed — same nodes+seed ⇒ byte-identical swarm (D-02). */
  seed?: number;
  /** Total dots to instantiate (default 1,000 — the Population·1,000 scale). */
  total?: number;
  /** Honors the OS motion preference; gates the batched cascade timeline. */
  reducedMotion?: boolean;
  /**
   * Cascade-on-play progress 0..1, driven by the parent AudienceLens as ONE batched
   * motion timeline (NOT 1,000 SMIL elements — Pitfall 2). undefined / 1 ⇒ all dots
   * present (static). A fraction dims dots whose cascade rank exceeds the progress.
   */
  cascadeProgress?: number;
}

/** SVG viewBox — matches PersonaGraph's coordinate space so the swarm reads at the same scale. */
const VB_W = 320;
const VB_H = 200;
/** Default population size — the Population·1,000 scale (D-02 / LIVE-05). */
const DEFAULT_TOTAL = 1000;
/** Honesty label — always visible under the swarm (UI-SPEC copy, verbatim). */
const HONESTY_LABEL = '1,000 viewers instantiated from your 10 calibrated archetypes.';

/**
 * mulberry32 — seeded PRNG for the dot x/y scatter. Copied verbatim from
 * `PersonaGraph`/`lens-derive` (deterministic, no global state, no nondeterministic
 * randomness). Geometry-only here; verdicts/counts come from lens-derive.
 */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PlacedDot {
  x: number;
  y: number;
  fill: string;
  /** Cascade rank 0..1 — reveal order (stops first, by archetype anchor order). */
  rank: number;
}

export function PopulationSwarm({
  nodes,
  population,
  seed = 1337,
  total = DEFAULT_TOTAL,
  reducedMotion = false,
  cascadeProgress,
}: PopulationSwarmProps) {
  // The REAL projection when it rode in (and actually scored someone), else the honest-lean
  // rollup. Mirrors AmbientRoom.PopulationView's `real` guard so the two renderers agree.
  const real = population && population.total > 0 ? population : null;
  // The deterministic dots from the pure math core (09-01). Verdict + sentiment come
  // from the REAL archetypes; this component only adds x/y geometry. No re-derivation.
  const dots = useMemo<PopulationDot[]>(
    () => instantiatePopulation(nodes, { total, seed }),
    [nodes, total, seed],
  );

  // Live counters — literally the weighted rollup of the 10 (the SAME numbers Panel
  // shows). NEVER counted off the dots (D-02 honesty: same signal, denser resolution).
  const roll = useMemo(() => weightedRollup(nodes), [nodes]);

  // Anchor each archetype in the viewBox (golden-angle spiral — same layout as
  // PersonaGraph's persona anchors), then scatter that archetype's dots around it via
  // a seeded Box-Muller Gaussian. Pure + deterministic (mulberry32 only).
  const placed = useMemo<PlacedDot[]>(() => {
    if (dots.length === 0 || nodes.length === 0) return [];
    const cx = VB_W / 2;
    const cy = VB_H / 2;
    const n = nodes.length;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const maxR = Math.min(VB_W, VB_H) * 0.42;

    // Archetype anchor positions + the worst (accent) archetype, keyed by id.
    const anchors = new Map<string, { ax: number; ay: number; accent: boolean }>();
    nodes.forEach((p, i) => {
      const t = (i + 0.5) / n;
      const r = Math.sqrt(t) * maxR;
      const a = i * golden;
      anchors.set(p.id, {
        ax: cx + Math.cos(a) * r,
        ay: cy + Math.sin(a) * r,
        accent: p.tone === 'accent',
      });
    });

    // One PRNG per archetype (seeded off the global seed + a stable index) so the
    // scatter is deterministic and stable across renders.
    const rngFor = new Map<string, () => number>();
    nodes.forEach((p, i) => rngFor.set(p.id, mulberry32(seed + 9173 + i * 31337)));

    const out: PlacedDot[] = [];
    const len = dots.length;
    dots.forEach((dot, idx) => {
      const anchor = anchors.get(dot.archetype);
      const rnd = rngFor.get(dot.archetype);
      if (!anchor || !rnd) return;
      const spread = 8 + dot.sentiment * 10;
      const u1 = Math.max(0.0001, rnd());
      const u2 = rnd();
      const mag = Math.sqrt(-2 * Math.log(u1)) * spread;
      const angle = u2 * 2 * Math.PI;
      const wt = dot.sentiment;
      out.push({
        x: anchor.ax + Math.cos(angle) * mag,
        y: anchor.ay + Math.sin(angle) * mag,
        // Cream-alpha for all; coral ONLY for the worst cluster's dots (UI-SPEC).
        fill: anchor.accent
          ? 'rgba(236, 231, 222, 0.35)'
          : `rgba(236, 231, 222, ${(0.2 + wt * 0.5).toFixed(2)})`,
        // Cascade reveal rank 0..1 by dot index (stable, deterministic order).
        rank: idx / len,
      });
    });
    return out;
  }, [dots, nodes, seed]);

  // Cascade gate: when reduced-motion OFF and a progress fraction is supplied, dim dots
  // whose rank exceeds the progress. ONE batched opacity decision over the layer — never
  // per-dot SMIL (Pitfall 2). Reduced-motion / no-progress ⇒ all present (static).
  const cascadeOn = !reducedMotion && typeof cascadeProgress === 'number' && cascadeProgress < 1;

  // Archetype breakdown rows (the v1 drill path — D-01; per-dot drill deferred). When the REAL
  // projection is present it drives the rows — genuine per-segment stop % across the named
  // segments (the rollup can only weight the 10's single verdict). Else the honest-lean rollup.
  // Quotes still come from the nodes (the aggregate carries counts, never verbatims); a segment
  // with no matching node quote simply shows no quote — never a fabricated one.
  const breakdown = useMemo(() => {
    const quoteById = new Map(nodes.map((nd) => [nd.id, nd.quote ?? '']));
    const labelById = new Map(nodes.map((nd) => [nd.id, nd.label]));
    if (real) {
      return real.segments.map((s) => ({
        id: s.archetype,
        label: s.displayName,
        valueLabel: `${s.stopPct}% stopped`,
        quote: quoteById.get(s.archetype) ?? '',
      }));
    }
    return roll.byArchetype
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .map((row) => ({
        id: row.archetype,
        label: labelById.get(row.archetype) ?? row.archetype,
        valueLabel: `${row.stop} stop`,
        quote: quoteById.get(row.archetype) ?? '',
      }));
  }, [roll, nodes, real]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[11px] text-[var(--color-cream-muted)]">{HONESTY_LABEL}</p>
      </div>
    );
  }

  // Headline counts — from the REAL projection when present, else the honest-lean rollup.
  const stopCount = real ? real.stop : roll.stop;
  const scrollCount = real ? real.scroll : roll.scroll;
  const totalCount = real ? real.total : roll.total;
  const stopPct = real ? real.stopPct : roll.total > 0 ? Math.round((roll.stop / roll.total) * 100) : 0;
  // Honesty label — the "a projection" framing when the real aggregate is present (mirrors
  // AmbientRoom.PopulationView copy), else the rollup's "instantiated from your 10" line.
  const honestyLabel = real
    ? `${totalCount.toLocaleString()} sampled from your audience · a projection`
    : HONESTY_LABEL;

  return (
    <div className="flex flex-col gap-3" data-testid="population-swarm">
      {/* Live counters — Display 30px; the real projection's stop/scroll split, else the rollup. */}
      <div className="flex items-baseline gap-6">
        <div className="flex flex-col">
          <span
            data-testid="population-stop-count"
            className="text-[30px] font-semibold leading-tight tabular-nums text-foreground"
          >
            {stopCount}
          </span>
          <span className="text-[12px] text-foreground-muted">stopped</span>
        </div>
        <div className="flex flex-col">
          <span
            data-testid="population-scroll-count"
            className="text-[30px] font-semibold leading-tight tabular-nums text-[var(--color-cream-muted)]"
          >
            {scrollCount}
          </span>
          <span className="text-[12px] text-foreground-muted">scrolled</span>
        </div>
      </div>

      {/* The swarm — ONE batched SVG layer of ~1,000 dots (Pitfall 2: no per-dot SMIL).
          The whole layer cross-fades on cascade via a single style transition. */}
      <div className="overflow-hidden rounded-[8px] border border-[var(--color-border)] bg-surface">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-[200px] w-full"
          role="img"
          aria-label={
            real
              ? `${totalCount} individuals sampled from your audience (a projection); ${stopCount} stopped`
              : `${roll.total} viewers instantiated from ${nodes.length} calibrated archetypes; ${roll.stop} stopped`
          }
        >
          {placed.map((d, i) => (
            <circle
              key={i}
              data-dot
              cx={d.x.toFixed(2)}
              cy={d.y.toFixed(2)}
              r={1.3}
              fill={d.fill}
              // Cascade: dim dots not yet revealed. Single batched decision per dot,
              // no SMIL <animate> element. Static (opacity 1) when cascade is off.
              opacity={cascadeOn && d.rank > (cascadeProgress ?? 1) ? 0.04 : 1}
              style={{ transition: reducedMotion ? undefined : 'opacity 200ms linear' }}
            />
          ))}
        </svg>
      </div>

      {/* Honesty label — always visible, --color-cream-muted (never coral). "a projection"
          framing when the real aggregate is present; the rollup line otherwise. */}
      <p className="text-[11px] text-[var(--color-cream-muted)]">{honestyLabel}</p>

      {/* Archetype breakdown — the v1 drill path (D-01; per-dot drill deferred). Rows
          per archetype with a representative verbatim. */}
      <ul data-testid="population-breakdown" className="flex flex-col gap-1">
        {breakdown.map((row) => (
          <li
            key={row.id}
            className="flex flex-col rounded-[8px] px-2 py-1.5 text-[13px] text-foreground"
          >
            <div className="flex items-center justify-between">
              <span>{row.label}</span>
              <span className="tabular-nums text-foreground-muted">{row.valueLabel}</span>
            </div>
            {row.quote && (
              <p className="mt-0.5 text-[11px] italic leading-snug text-foreground-secondary">
                &ldquo;{row.quote}&rdquo;
              </p>
            )}
          </li>
        ))}
      </ul>

      {/* sr-only aggregate + archetype-breakdown mirror — ALWAYS present, independent of
          motion state (UI-SPEC reduced-motion mirror copy). */}
      <div data-testid="population-sr-mirror" className="sr-only" role="status">
        {real
          ? `Population reaction projection: ${stopCount} of ${totalCount} sampled individuals stopped (${stopPct}%).`
          : `Population reaction summary: ${stopCount} of ${totalCount} viewers stopped (${stopPct}%), instantiated from ${nodes.length} calibrated archetypes.`}
        <ul>
          {breakdown.map((row) => (
            <li key={row.id}>
              {row.label}: {row.valueLabel}{row.quote ? ` — “${row.quote}”` : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
