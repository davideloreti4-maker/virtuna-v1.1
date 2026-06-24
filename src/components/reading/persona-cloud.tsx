'use client';
import { useMemo } from 'react';
import type { HeatmapPayload, PersonaSimulationResult } from '@/lib/engine/types';
import {
  buildPersonaNodes,
  buildSegmentGroups,
  worstBadGroupKey,
} from '@/components/board/audience/audience-derive';

/**
 * PersonaCloud — the static hero dot-cloud (READ-04, D-02). A stripped, matte
 * descendant of `board/_kit/PersonaGraph`: the SAME deterministic golden-angle
 * (Fibonacci) layout, but reduced to ONE dot per persona — no Canvas, no 200
 * viewer dots, no nearest-neighbour links, no hover card, no `<animate>` pulse
 * (those belong to the Phase-3 PersonaGraph drill-down this cloud opens).
 *
 * Dots only: each persona is a `<circle>` sized by weight; the single
 * worst-retention cluster reads coral (`var(--color-cream-secondary)`), all others a
 * neutral cream (never pure white). The per-persona watch-through drives fill
 * opacity and the sr-only mirror, but this component renders NO aggregate
 * "{n}% watch" caption — watch% is the hero-owned field rendered ONCE by the
 * container (02-05), so it survives the empty-personas degraded path where this
 * cloud omits itself entirely.
 *
 * Layout math is copied verbatim from PersonaGraph (SSR-safe, hydration-stable,
 * no `Math.random`) so the cloud never mismatches on hydration.
 */
export interface PersonaCloudProps {
  heatmap: HeatmapPayload | null;
  simResults: PersonaSimulationResult[] | undefined;
  /** Phase-3 seam: opens the full PersonaGraph in the DrillSheet. */
  onOpen?: () => void;
}

const VB_W = 320;
const VB_H = 200;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function PersonaCloud({ heatmap, simResults, onOpen }: PersonaCloudProps) {
  // Worst-retention slot (coral) + the persona nodes. Both fall back to the
  // heatmap attention means when there are no sim results. buildPersonaNodes
  // returns [] when heatmap.personas is empty / heatmap is null.
  const nodes = useMemo(() => {
    const badKey = worstBadGroupKey(buildSegmentGroups(heatmap, simResults));
    return buildPersonaNodes(heatmap, simResults, badKey);
  }, [heatmap, simResults]);

  // Golden-angle Fibonacci layout — copied verbatim from PersonaGraph L55-72,
  // with the lighter D-02 radius (4 + weight*9, vs PersonaGraph's 6 + weight*13).
  const laidOut = useMemo(() => {
    const cx = VB_W / 2;
    const cy = VB_H / 2;
    const n = Math.max(nodes.length, 1);
    const golden = Math.PI * (3 - Math.sqrt(5));
    const maxR = Math.min(VB_W, VB_H) * 0.42;
    return nodes.map((p, i) => {
      const t = (i + 0.5) / n;
      const r = Math.sqrt(t) * maxR;
      const a = i * golden;
      return {
        ...p,
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        rad: 4 + clamp01(p.weight) * 9,
      };
    });
  }, [nodes]);

  // Empty / null personas → omit the cloud entirely (NOT an empty box). The hero
  // still shows the gauge + the container's hero-owned watch%.
  if (laidOut.length === 0) return null;

  const interactive = typeof onOpen === 'function';

  return (
    <div
      className="relative w-full"
      onClick={onOpen}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen?.();
              }
            }
          : undefined
      }
      // ≥44px tap target (Phase-3 seam); transparent padding, no visual inflation.
      style={{ minHeight: 44, cursor: interactive ? 'pointer' : undefined }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="img"
        aria-label="Audience watch-through by persona"
      >
        {laidOut.map((nd) => {
          const accent = nd.tone === 'accent';
          // Coral worst cluster; otherwise CREAM (never pure white — D-02).
          const fill = accent
            ? 'var(--color-cream-secondary)'
            : `rgba(236, 231, 222, ${(0.2 + clamp01(nd.watchThrough) * 0.5).toFixed(2)})`;
          return <circle key={nd.id} cx={nd.x} cy={nd.y} r={nd.rad} fill={fill} />;
        })}
      </svg>

      <ul className="sr-only">
        {nodes.map((p) => (
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
