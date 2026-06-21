'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * PersonaGraph — Artificial-Societies-style persona node cloud, the Audience
 * hero visual. Deterministic golden-angle layout (seeded — stable across
 * renders / SSR), faint nearest-neighbour links, 200 viewer dots distributed
 * proportionally around persona anchors. Node size ∝ weight; fill ∝
 * watch-through; the worst cluster reads coral.
 *
 * Flat-warm matte (THEME-06): cream-alpha dots/links/nodes (never pure white),
 * a flat `--color-surface` detail card (no glass, no heavy drop shadow), and the
 * calm `<animate>` pulse is gated on `reducedMotion`. The detail card is shown by
 * hover on desktop AND by TAP on touch (a tapped node pins its card; a tap
 * elsewhere dismisses) — no hover-only affordance on touch.
 * An sr-only list mirrors the data for assistive tech.
 */
export interface PersonaNode {
  id: string;
  label: string;
  /** Relative weight 0..1 → node radius. */
  weight: number;
  /** Watch-through 0..1 → fill opacity. */
  watchThrough: number;
  segment?: string;
  /** e.g. "0:08" — where this persona drops. */
  dropAt?: string;
  /** 'accent' paints the node coral (the weak / worst cluster). */
  tone?: 'accent' | 'default';
  /** Verbatim reaction to THIS concept — surfaced in the detail card (LIVE-02). */
  quote?: string;
  /**
   * The persona-registry archetype enum (e.g. "tough_crowd") backing this node, when known.
   * Powers the "Ask them why →" persona chat grounding (P9 / D-03). Additive + default-undefined
   * — existing call sites stay byte-identical.
   */
  archetype?: string;
}

export interface PersonaGraphProps {
  personas: PersonaNode[];
  height?: number;
  reducedMotion?: boolean;
  className?: string;
  /**
   * Optional replay-driven per-node attention override (AudienceLens, P9). When
   * present (length === personas.length), each node's fill opacity reflects the
   * REPLAYED segment's attention instead of its aggregate watch-through, so the
   * room "lights up" segment-by-segment. Additive + default-undefined — existing
   * call sites are byte-identical (reading-panels passes nothing).
   */
  attentionOverride?: number[];
}

const VB_W = 320;
const VB_H = 200;

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function PersonaGraph({
  personas,
  height = 220,
  reducedMotion = false,
  className,
  attentionOverride,
}: PersonaGraphProps) {
  // `hover` = desktop pointer-over preview; `pinned` = a tapped node (touch, or a
  // deliberate click). The card shows the pinned node when one is pinned, else the
  // hovered node — so touch (which has no hover) reveals via tap, and a tap on the
  // empty canvas dismisses. `active` is the node the card renders for.
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = pinned ?? hover;

  const nodes = useMemo(() => {
    const cx = VB_W / 2;
    const cy = VB_H / 2;
    const n = Math.max(personas.length, 1);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const maxR = Math.min(VB_W, VB_H) * 0.42;
    return personas.map((p, i) => {
      const t = (i + 0.5) / n;
      const r = Math.sqrt(t) * maxR;
      const a = i * golden;
      return {
        ...p,
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        rad: 6 + Math.max(0, Math.min(1, p.weight)) * 13,
      };
    });
  }, [personas]);

  // 200 viewer dots — distributed across persona clusters proportional to weight.
  // Gaussian scatter around each anchor; seeded per-persona for stability.
  const viewerDots = useMemo(() => {
    if (nodes.length === 0) return [];
    const TOTAL = 200;
    const totalW = nodes.reduce((s, nd) => s + Math.max(0.01, nd.weight), 0);
    const out: Array<{ x: number; y: number; fill: string; opacity: number }> = [];
    nodes.forEach((nd, i) => {
      const count = Math.max(1, Math.round((Math.max(0.01, nd.weight) / totalW) * TOTAL));
      const rnd = mulberry32(9173 + i * 31337);
      const spread = 10 + (nd.rad - 6) * 1.4;
      const accent = nd.tone === 'accent';
      const wt = Math.max(0, Math.min(1, nd.watchThrough));
      for (let j = 0; j < count; j++) {
        const u1 = Math.max(0.0001, rnd());
        const u2 = rnd();
        const mag = Math.sqrt(-2 * Math.log(u1)) * spread;
        const angle = u2 * 2 * Math.PI;
        out.push({
          x: nd.x + Math.cos(angle) * mag,
          y: nd.y + Math.sin(angle) * mag,
          // Cream-alpha (matches persona-cloud), coral for the worst cluster.
          fill: accent ? 'var(--color-accent)' : `rgba(236, 231, 222, ${(0.2 + wt * 0.5).toFixed(2)})`,
          opacity: 0.35 + rnd() * 0.5,
        });
      }
    });
    return out;
  }, [nodes]);

  const links = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (!a) continue;
      let best = -1;
      let bd = Infinity;
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const b = nodes[j];
        if (!b) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      const b = nodes[best];
      if (b) out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return out;
  }, [nodes]);

  return (
    <div
      className={cn('relative w-full', className)}
      style={{ height }}
      data-testid="persona-graph"
      // Tap on empty canvas dismisses a pinned card (node taps stopPropagation).
      onClick={() => setPinned(null)}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="img"
        aria-label={`200 test viewers across ${personas.length} audience personas`}
      >
        {viewerDots.map((d, i) => (
          <circle key={`v${i}`} cx={d.x} cy={d.y} r={1.5} fill={d.fill} opacity={d.opacity} />
        ))}
        {links.map((l, i) => (
          <line
            key={`l${i}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="rgba(236, 231, 222, 0.06)"
            strokeWidth={0.5}
          />
        ))}
        {nodes.map((nd, i) => {
          const accent = nd.tone === 'accent';
          // Replay override (P9): when a per-segment attention vector is supplied the
          // node opacity reflects the REPLAYED segment, so the room lights/dims
          // segment-by-segment. Falls back to the aggregate watch-through otherwise.
          const intensity =
            attentionOverride && attentionOverride.length === nodes.length
              ? Math.max(0, Math.min(1, attentionOverride[i] ?? 0))
              : Math.max(0, Math.min(1, nd.watchThrough));
          const fill = accent
            ? 'var(--color-accent)'
            : `rgba(236, 231, 222, ${(0.28 + intensity * 0.5).toFixed(2)})`;
          return (
            <g
              key={nd.id}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              // Touch/click: pin this node's card (toggle off if already pinned);
              // stopPropagation so the container's dismiss handler doesn't clear it.
              onClick={(e) => {
                e.stopPropagation();
                setPinned((p) => (p === i ? null : i));
              }}
              className="cursor-pointer"
            >
              {active === i && (
                <circle
                  cx={nd.x}
                  cy={nd.y}
                  r={nd.rad + 4}
                  fill="none"
                  stroke={accent ? 'var(--color-accent)' : 'rgba(236, 231, 222, 0.4)'}
                  strokeWidth={1}
                />
              )}
              <circle
                cx={nd.x}
                cy={nd.y}
                r={nd.rad}
                fill={fill}
                stroke={accent ? 'var(--color-accent)' : 'rgba(236, 231, 222, 0.12)'}
                strokeOpacity={accent ? 0.6 : 1}
                strokeWidth={accent ? 1.2 : 0.6}
              >
                {!reducedMotion && (
                  <animate
                    attributeName="opacity"
                    values="0.85;1;0.85"
                    dur={`${3 + (i % 4)}s`}
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            </g>
          );
        })}
      </svg>

      {active !== null &&
        nodes[active] &&
        (() => {
          const nd = nodes[active];
          return (
            <div
              // Flat matte card: solid --color-surface + hairline border, the ONE
              // allowed float shadow (no glass, no heavy drop shadow).
              className="pointer-events-none absolute z-10 w-[152px] rounded-[10px] border border-[var(--color-border)] bg-surface p-2.5 shadow-float"
              style={{
                left: `${(nd.x / VB_W) * 100}%`,
                top: `${(nd.y / VB_H) * 100}%`,
                transform: 'translate(-50%, calc(-100% - 12px))',
              }}
            >
              <div className="text-[12px] font-semibold text-foreground">{nd.label}</div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-foreground-muted">Watch-through</span>
                <span className="tabular-nums text-foreground">
                  {Math.round(nd.watchThrough * 100)}%
                </span>
              </div>
              {nd.dropAt && (
                <div className="mt-0.5 flex items-center justify-between text-[11px]">
                  <span className="text-foreground-muted">Drops at</span>
                  <span className="tabular-nums text-foreground">{nd.dropAt}</span>
                </div>
              )}
              {nd.segment && (
                <div className="mt-1 text-[10px] uppercase tracking-[0.06em] text-foreground-muted">
                  {nd.segment}
                </div>
              )}
              {nd.quote && (
                <p className="mt-1.5 text-[11px] italic leading-snug text-foreground-secondary">
                  &ldquo;{nd.quote}&rdquo;
                </p>
              )}
            </div>
          );
        })()}

      <ul className="sr-only">
        {personas.map((p) => (
          <li key={p.id}>
            {p.label}: {Math.round(p.watchThrough * 100)}% watch-through
            {p.segment ? `, ${p.segment}` : ''}
            {p.dropAt ? `, drops at ${p.dropAt}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
