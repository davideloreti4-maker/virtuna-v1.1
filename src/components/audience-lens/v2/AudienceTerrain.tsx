"use client";

/**
 * AudienceTerrain — the "society" hero figure for Ambient Audience v2's audience tab.
 *
 * Premium pass: the old force-graph look (a messy edge-web + muddy gray dots + uniform sizes) is gone.
 * The map is now a calm, matte constellation — cream stoppers + the coral ceiling ONLY; the undecided
 * crowd recedes to a near-invisible dust. No connecting lines (they read as a scribble). Nodes are
 * soft-edged (an SVG radial fill, matte — not a glow) and sized in a clean three-tier hierarchy.
 *
 * The animation still carries the value (owner call: "narrative cascade"): the crowd is present but
 * dim, then the stoppers IGNITE district-by-district in rank order — believers first, the coral
 * ceiling last — while the verdict counts up. Then a gentle staggered breathe.
 *
 * Living-cloud pass (owner review): the four districts now bleed together into ONE breathing cloud —
 * looser scatter + more nodes pulled toward the gravity centre so the blobs fill their gaps, and each
 * node drifts on a small seeded oscillation. The old "nodes never move" law is relaxed for this
 * calm drift (amplitude ~1–3px), but districts are preserved: every node keeps its cluster identity,
 * so the ledger hover-spotlight and the builders/skeptics meaning still hold. The drift is seeded
 * (byte-identical SSR) and fully disabled under reduced-motion.
 *
 * The same dot vocabulary reappears in the district ledger below (node-bars), so map + ledger read as
 * ONE system. Hovering a ledger row spotlights its district here (a soft hull).
 */

import { useMemo } from "react";
import { TONE, VerdictChip, type TerrainCluster } from "./AmbientDetail";
import type { DomainTemplate } from "./domain-template";

/** The shared society terrain spec — clusters scattered into one seeded cloud. */
export type TerrainSpec = { clusters: TerrainCluster[]; lossClusterIndex: number };

// ── layout constants ──────────────────────────────────────────────────────────
const TVW = 380;
const TVH = 210;
const GCX = 188; // gravity centre — a few nodes drift toward it, so the cloud reads as one society
const GCY = 118;

// ── cascade constants (the "society decides" reveal) ──────────────────────────
const START_OP = 0.1; // the undecided crowd, before a node ignites
const REVEAL_STEP = 0.22; // seconds added per district rank (believers → ceiling)
const REVEAL_JITTER = 0.3; // intra-district stagger, from each node's seeded u
const INTRO_DUR = 0.45; // the ignite ramp
const BREATHE_DUR = 3.2; // the resting breathe on stopped nodes

// ── living-cloud drift (the whole field breathes; nodes never leave their district) ──
const DRIFT_MIN = 1.2; // px — the calmest node's swing
const DRIFT_VAR = 1.7; // px — extra swing scaled by the node's seeded u
const DRIFT_DUR = 7; // s — base oscillation period
const DRIFT_DUR_VAR = 4; // s — per-node period spread (cx/cy differ → organic Lissajous)

type TerrainNode = { x: number; y: number; c: number; u: number; v: number };

function useTerrain(terrain: TerrainSpec) {
  return useMemo(() => {
    const { clusters, lossClusterIndex } = terrain;
    // Deterministic LCG (seed 42) — same seed ⇒ byte-identical layout on server & client (no
    // hydration drift) and stable across runs (design law: content lights the map, never moves it).
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const nodes: TerrainNode[] = [];
    // Slide each district ~40% toward the shared centre BEFORE scattering, so the four islands
    // collapse into one overlapping cloud (relative bearing kept — builders still upper-right, the
    // coral ceiling still lower-right — so district identity + the ledger spotlight survive). The
    // moved centre feeds the hover-hull too, so the spotlight stays aligned to where the nodes are.
    const kC = 0.4;
    const centers: { x: number; y: number }[] = [];
    clusters.forEach((c, ci) => {
      const ccx = c.cx + (GCX - c.cx) * kC;
      const ccy = c.cy + (GCY - c.cy) * kC;
      centers.push({ x: ccx, y: ccy });
      for (let i = 0; i < c.n; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * c.spread * 1.28; // wider spread ⇒ neighbouring districts interleave
        let x = ccx + Math.cos(a) * r;
        let y = ccy + Math.sin(a) * r * 0.72;
        if (rand() < 0.3) {
          x += (GCX - x) * 0.4;
          y += (GCY - y) * 0.4;
        }
        nodes.push({ x, y, c: ci, u: rand(), v: rand() });
      }
    });
    // Ignite rank — districts light in order of their stop rate (believers first, ceiling last).
    const rank = clusters.map(() => 0);
    clusters
      .map((c, i) => ({ i, lit: c.lit }))
      .sort((p, q) => q.lit - p.lit)
      .forEach((o, idx) => {
        rank[o.i] = idx;
      });
    return { nodes, clusters, centers, lossClusterIndex, rank };
  }, [terrain]);
}

/** The terrain HERO CARD — matched to the cortex card (same rounded-[14px] / #131210 / ~208px) so the
 *  two heroes read as one system. */
export function TerrainMap({
  terrain,
  verdict,
  reducedMotion = false,
  highlightCluster = null,
}: {
  terrain: TerrainSpec;
  verdict?: DomainTemplate["verdict"];
  reducedMotion?: boolean;
  /** Ledger → map link: the district row under the pointer; spotlights that cluster with a soft hull. */
  highlightCluster?: number | null;
}) {
  const { nodes, clusters, centers, lossClusterIndex, rank } = useTerrain(terrain);
  return (
    <div
      className="relative overflow-hidden rounded-[14px]"
      style={{ height: 270, border: `1px solid ${TONE.border}`, background: "#131210" }}
    >
      <svg viewBox={`0 0 ${TVW} ${TVH}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          {/* soft-edged matte dots — solid core, a gentle fade at the rim (not a glow halo) */}
          <radialGradient id="ndCream" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ece7de" stopOpacity="1" />
            <stop offset="70%" stopColor="#ece7de" stopOpacity="1" />
            <stop offset="100%" stopColor="#ece7de" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ndCoral" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FF6363" stopOpacity="1" />
            <stop offset="70%" stopColor="#FF6363" stopOpacity="1" />
            <stop offset="100%" stopColor="#FF6363" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* district hulls — a soft spotlight when its ledger row is hovered (behind everything) */}
        {clusters.map((c, ci) => (
          <ellipse
            key={`hull-${c.name}`}
            cx={centers[ci]!.x}
            cy={centers[ci]!.y}
            rx={c.spread * 1.28 * 1.15}
            ry={c.spread * 0.72 * 1.28 * 1.15}
            fill={ci === lossClusterIndex ? "rgba(255,99,99,.09)" : "rgba(236,231,222,.05)"}
            stroke={ci === lossClusterIndex ? "rgba(255,99,99,.20)" : "rgba(236,231,222,.12)"}
            strokeWidth={1}
            style={{ opacity: highlightCluster === ci ? 1 : 0, transition: "opacity .25s ease" }}
          />
        ))}

        {/* nodes — cream stoppers + coral ceiling; the crowd recedes to dust. Ignite, then breathe. */}
        {nodes.map((n, i) => {
          const lit = n.u < clusters[n.c]!.lit;
          const isLoss = n.c === lossClusterIndex;
          const animated = lit || isLoss; // loss-district nodes resolve to coral even when unlit
          const resolvedOp = lit ? 0.9 : isLoss ? 0.55 : 0.1;
          const fill = lit ? "url(#ndCream)" : isLoss ? "url(#ndCoral)" : TONE.cream;
          const r = lit ? 3.8 : isLoss ? 3.5 : 2;
          const delay = rank[n.c]! * REVEAL_STEP + n.u * REVEAL_JITTER;
          const baseOp = reducedMotion || !animated ? resolvedOp : START_OP;
          const breatheHi = Math.min(1, resolvedOp * 1.32).toFixed(2);
          // living-cloud drift — a small seeded oscillation around the resolved position; cx and cy
          // run on different periods (from u/v) so the swing is an organic Lissajous, never a shuffle.
          const amp = DRIFT_MIN + n.u * DRIFT_VAR;
          const durX = (DRIFT_DUR + n.v * DRIFT_DUR_VAR).toFixed(1);
          const durY = (DRIFT_DUR + n.u * DRIFT_DUR_VAR).toFixed(1);
          const beginX = (-(n.u * 8)).toFixed(1);
          const beginY = (-(n.v * 8)).toFixed(1);
          return (
            <circle key={i} cx={n.x.toFixed(1)} cy={n.y.toFixed(1)} r={r} fill={fill} opacity={baseOp}>
              {!reducedMotion ? (
                <>
                  <animate
                    attributeName="cx"
                    values={`${(n.x - amp).toFixed(1)};${(n.x + amp).toFixed(1)};${(n.x - amp).toFixed(1)}`}
                    dur={`${durX}s`}
                    begin={`${beginX}s`}
                    calcMode="spline"
                    keyTimes="0;0.5;1"
                    keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cy"
                    values={`${(n.y - amp * 0.7).toFixed(1)};${(n.y + amp * 0.7).toFixed(1)};${(n.y - amp * 0.7).toFixed(1)}`}
                    dur={`${durY}s`}
                    begin={`${beginY}s`}
                    calcMode="spline"
                    keyTimes="0;0.5;1"
                    keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
                    repeatCount="indefinite"
                  />
                </>
              ) : null}
              {animated && !reducedMotion ? (
                <animate
                  attributeName="opacity"
                  values={`${START_OP};${resolvedOp}`}
                  dur={`${INTRO_DUR}s`}
                  begin={`${delay.toFixed(2)}s`}
                  fill="freeze"
                />
              ) : null}
              {lit && !reducedMotion ? (
                <animate
                  attributeName="opacity"
                  values={`${resolvedOp};${breatheHi};${resolvedOp}`}
                  dur={`${BREATHE_DUR}s`}
                  begin={`${(delay + INTRO_DUR).toFixed(2)}s`}
                  repeatCount="indefinite"
                />
              ) : null}
            </circle>
          );
        })}
      </svg>
      {verdict ? <VerdictChip verdict={verdict} animate /> : null}
    </div>
  );
}
