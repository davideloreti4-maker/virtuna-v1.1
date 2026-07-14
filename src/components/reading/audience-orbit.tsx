'use client';

import type { HeatmapPayload, PersonaSimulationResult } from '@/lib/engine/types';
import {
  buildSegmentGroups,
  worstBadGroupKey,
  cohortDropFrame,
  formatTime,
  type SlotKey,
  type SegmentGroup,
} from '@/components/board/audience/audience-derive';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ReadingSection } from './reading-section';

/**
 * The READING_LABEL stack for SVG <text>, which cannot take the Tailwind class. Same 11px /
 * 0.05em / muted-cream the rest of /analyze uses — these three in-chart labels ran 9.5px/0.1em
 * and 10px/0.06em, two more rungs on the ladder (2026-07-14). Keep in lockstep with
 * READING_LABEL; `reading-labels.test.ts` pins both.
 */
const SVG_LABEL = {
  fontSize: 11,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  fill: 'var(--color-foreground-muted)',
} as const;

// AudienceOrbit — the labeled retention orbit (audience-viz-v2, LOCKED 2026-06-15).
// Replaces the dead random dot-cloud. The video sits at the center; the audience
// archetypes orbit it by HOW LONG THEY STAY (close = watches to the end, far =
// bounces early). Size = reach (how many segments fold into the cohort). Coral +
// pulse = the cohort that drops first. A one-line takeaway states who leaves when.
//
// The value is in the encoding: positions MEAN retention, nodes are LABELED, there
// is a center subject, and a plain takeaway — so it reads in one glance (a random,
// unlabeled cloud was pretty but valueless, rejected twice).
//
// Pure-derived from the SAME heatmap the rest of the Reading reads (buildSegmentGroups
// → the 4 archetype slots). Returns null when no cohort is derivable (degraded path).
// NO verdict/advice prose (D-15): the takeaway is an observation, never a directive.

const CX = 290;
const CY = 150;
const VIEW_W = 600;
const VIEW_H = 300;

/** Fixed direction per archetype slot — stable, legible positions (the sketch's
 *  4 quadrants). Retention sets the DISTANCE along each spoke; the slot sets the
 *  ANGLE. `side` drives label anchoring (text reads outward from the node). */
const SLOT_DIR: Record<SlotKey, { dx: number; dy: number; side: 'left' | 'right' }> = {
  loyalist: { dx: -0.82, dy: -0.57, side: 'left' }, // up-left  (loyal fans stay)
  cross_niche: { dx: 0.82, dy: -0.57, side: 'right' }, // up-right
  fyp: { dx: -0.82, dy: 0.57, side: 'left' }, // down-left (new viewers)
  niche: { dx: 0.82, dy: 0.57, side: 'right' }, // down-right (your niche)
};

const R_NEAR = 72; // 100% retention → close to the core
const R_FAR = 150; // 0% retention → near the rim
const STRETCH = 1.32; // horizontal stretch → an ellipse, not a circle
const NODE_MIN = 13;
const NODE_MAX = 24;

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

interface OrbitNode {
  group: SegmentGroup;
  x: number;
  y: number;
  r: number;
  bad: boolean;
  side: 'left' | 'right';
  /** Second-line stat ("62% · holds through", or "leaves at 0:08" for the bad cohort). */
  stat: string;
}

function layout(
  groups: SegmentGroup[],
  badKey: SlotKey | null,
  badDropTime: string | null,
): OrbitNode[] {
  const visible = groups.filter((g) => g.count > 0);
  const maxCount = Math.max(1, ...visible.map((g) => g.count));
  return visible.map((group) => {
    const dir = SLOT_DIR[group.key];
    const rBase = lerp(R_NEAR, R_FAR, 1 - group.pct / 100);
    const bad = group.key === badKey;
    const stat =
      bad && badDropTime ? `leaves at ${badDropTime}` : `${Math.round(group.pct)}% · ${group.desc}`;
    return {
      group,
      x: CX + dir.dx * rBase * STRETCH,
      y: CY + dir.dy * rBase,
      r: lerp(NODE_MIN, NODE_MAX, group.count / maxCount),
      bad,
      side: dir.side,
      stat,
    };
  });
}

export interface AudienceOrbitProps {
  heatmap: HeatmapPayload | null;
  simResults: PersonaSimulationResult[] | undefined;
  /** Global biggest-drop time (seconds) — the bad-cohort fallback when the cohort
   *  has no per-persona swipe time. */
  dropT: number | null;
}

export function AudienceOrbit({ heatmap, simResults, dropT }: AudienceOrbitProps) {
  const reduced = usePrefersReducedMotion();

  const groups = buildSegmentGroups(heatmap, simResults);
  const visible = groups.filter((g) => g.count > 0);
  if (visible.length === 0) return null;

  const badKey = worstBadGroupKey(groups);
  const badDropTime =
    badKey != null
      ? (cohortDropFrame(heatmap, badKey, {})?.timecode ?? (dropT != null ? formatTime(dropT) : null))
      : null;

  const nodes = layout(groups, badKey, badDropTime);
  const segCount = visible.reduce((a, g) => a + g.count, 0);
  const best = visible.reduce((a, b) => (b.pct > a.pct ? b : a));
  const bad = badKey != null ? visible.find((g) => g.key === badKey) : undefined;

  // Takeaway — a plain observation (D-15: who leaves when, never advice).
  const bestStays = best.pct >= 70;
  const takeaway =
    bad && badDropTime ? (
      <>
        <b className="font-semibold text-foreground">
          {bad.label} drops first — at {badDropTime}
        </b>
        {bestStays ? `, while ${best.label.toLowerCase()} stay to the end.` : '.'}
      </>
    ) : (
      <>Your audience holds fairly evenly — no single cohort bails early.</>
    );

  const ariaLabel = `Audience retention orbit: ${visible
    .map((g) => `${g.label} ${Math.round(g.pct)} percent`)
    .join(', ')}`;

  return (
    <ReadingSection label="Your audience">
      <div className="p-[18px]" data-testid="audience-orbit">
        <div className="mb-0.5">
          <p className="text-[15px] font-semibold text-foreground">Who stays, who leaves</p>
          <p className="mt-0.5 text-[12px] text-foreground-muted">
            {visible.length} archetypes across {segCount} simulated segments · sized by reach
          </p>
        </div>

        <svg
          className="block h-auto w-full"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={ariaLabel}
        >
          {/* faint retention rings (decorative depth cue) */}
          <g fill="none" stroke="rgba(236,231,222,0.05)">
            <ellipse cx={CX} cy={CY} rx={92} ry={58} />
            <ellipse cx={CX} cy={CY} rx={158} ry={98} />
            <ellipse cx={CX} cy={CY} rx={220} ry={135} />
          </g>

          {/* radial meaning */}
          <text x={CX} y={26} textAnchor="middle" style={SVG_LABEL}>
            watches to the end
          </text>
          <text x={VIEW_W - 34} y={VIEW_H - 16} textAnchor="end" style={SVG_LABEL}>
            leaves early
          </text>

          {/* spokes */}
          <g stroke="rgba(236,231,222,0.10)" strokeWidth={1}>
            {nodes.map((n) => (
              <line key={n.group.key} x1={CX} y1={CY} x2={n.x} y2={n.y} />
            ))}
          </g>

          {/* center: the video */}
          <circle cx={CX} cy={CY} r={22} fill="#2a2926" stroke="rgba(255,255,255,0.10)" />
          <path d={`M${CX - 5} ${CY - 8} l11 8 -11 8 z`} fill="var(--color-foreground)" />
          <text x={CX} y={CY + 42} textAnchor="middle" style={SVG_LABEL}>
            your video
          </text>

          {/* archetype nodes */}
          {nodes.map((n) => {
            const labelX = n.side === 'left' ? n.x - n.r - 8 : n.x + n.r + 8;
            const anchor = n.side === 'left' ? 'end' : 'start';
            // n.bad marks the archetype that bounced. It was rgba(217,119,87,0.95) — the RETIRED
            // terracotta — doing exactly the same semantic job (the negative marker) that the
            // persona list twenty pixels above does with the LIVE --color-accent. Same meaning,
            // two different reds, one screen. The literal tracked no token, so it survived the
            // accent migration untouched.
            const fill = n.bad
              ? 'color-mix(in srgb, var(--color-accent) 95%, transparent)'
              : `rgba(236,231,222,${lerp(0.42, 0.85, n.group.pct / 100).toFixed(2)})`;
            return (
              <g key={n.group.key}>
                {n.bad && (
                  reduced ? (
                    <circle cx={n.x} cy={n.y} r={n.r + 6} fill="none" stroke="var(--color-cream-secondary)"
                      strokeWidth={1.5} opacity={0.4} />
                  ) : (
                    <circle cx={n.x} cy={n.y} fill="none" stroke="var(--color-cream-secondary)" strokeWidth={1.5}>
                      <animate attributeName="r" values={`${n.r};${n.r + 12};${n.r}`} dur="2.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0;0.5" dur="2.6s" repeatCount="indefinite" />
                    </circle>
                  )
                )}
                <circle cx={n.x} cy={n.y} r={n.r} fill={fill} />
                <text x={labelX} y={n.y - 4} textAnchor={anchor}
                  style={{ fontSize: 12.5, fontWeight: 600, fill: n.bad ? 'var(--color-cream-secondary)' : 'var(--color-foreground)' }}>
                  {n.group.label}
                </text>
                <text x={labelX} y={n.y + 12} textAnchor={anchor}
                  style={{ fontSize: 11, fill: 'var(--color-foreground-muted)' }}>
                  {n.stat}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-3.5 flex items-start gap-2.5 border-t border-[var(--color-border)] pt-3.5 text-[13px] leading-snug text-foreground-secondary">
          <span className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--color-cream-secondary)' }} />
          <span data-testid="audience-orbit-takeaway">{takeaway}</span>
        </div>
      </div>
    </ReadingSection>
  );
}

AudienceOrbit.displayName = 'AudienceOrbit';
