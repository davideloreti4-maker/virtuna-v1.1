'use client';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * PersonaGraph — Artificial-Societies-style persona node cloud, the Audience
 * hero visual. Deterministic golden-angle layout (seeded — stable across
 * renders / SSR), faint nearest-neighbour links, decorative starfield for the
 * "population" feel. Node size ∝ weight; fill ∝ watch-through; the worst
 * cluster reads coral. Hover → glass detail card. An sr-only list mirrors the
 * data for assistive tech.
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
}

export interface PersonaGraphProps {
  personas: PersonaNode[];
  height?: number;
  reducedMotion?: boolean;
  className?: string;
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
}: PersonaGraphProps) {
  const [hover, setHover] = useState<number | null>(null);

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

  const stars = useMemo(() => {
    const rnd = mulberry32(9173);
    return Array.from({ length: 70 }, () => ({
      x: rnd() * VB_W,
      y: rnd() * VB_H,
      r: 0.6 + rnd() * 1.3,
      o: 0.04 + rnd() * 0.1,
    }));
  }, []);

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
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="img"
        aria-label={`${personas.length} predicted audience personas`}
      >
        {stars.map((s, i) => (
          <circle key={`s${i}`} cx={s.x} cy={s.y} r={s.r} fill="white" opacity={s.o} />
        ))}
        {links.map((l, i) => (
          <line
            key={`l${i}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="white"
            strokeOpacity={0.06}
            strokeWidth={0.5}
          />
        ))}
        {nodes.map((nd, i) => {
          const accent = nd.tone === 'accent';
          const fill = accent
            ? 'var(--color-accent)'
            : `rgba(255,255,255,${(0.28 + Math.max(0, Math.min(1, nd.watchThrough)) * 0.5).toFixed(2)})`;
          return (
            <g
              key={nd.id}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              className="cursor-pointer"
            >
              {hover === i && (
                <circle
                  cx={nd.x}
                  cy={nd.y}
                  r={nd.rad + 4}
                  fill="none"
                  stroke={accent ? 'var(--color-accent)' : 'white'}
                  strokeOpacity={0.4}
                  strokeWidth={1}
                />
              )}
              <circle
                cx={nd.x}
                cy={nd.y}
                r={nd.rad}
                fill={fill}
                stroke={accent ? 'var(--color-accent)' : 'white'}
                strokeOpacity={accent ? 0.6 : 0.12}
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

      {hover !== null &&
        nodes[hover] &&
        (() => {
          const nd = nodes[hover];
          return (
            <div
              className="pointer-events-none absolute z-10 w-[152px] rounded-[10px] border border-white/10 bg-[#18191a]/95 p-2.5 shadow-xl"
              style={{
                left: `${(nd.x / VB_W) * 100}%`,
                top: `${(nd.y / VB_H) * 100}%`,
                transform: 'translate(-50%, calc(-100% - 12px))',
              }}
            >
              <div className="text-[12px] font-semibold text-white">{nd.label}</div>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-white/45">Watch-through</span>
                <span className="tabular-nums text-white/90">
                  {Math.round(nd.watchThrough * 100)}%
                </span>
              </div>
              {nd.dropAt && (
                <div className="mt-0.5 flex items-center justify-between text-[11px]">
                  <span className="text-white/45">Drops at</span>
                  <span className="tabular-nums text-white/90">{nd.dropAt}</span>
                </div>
              )}
              {nd.segment && (
                <div className="mt-1 text-[10px] uppercase tracking-[0.06em] text-white/40">
                  {nd.segment}
                </div>
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
