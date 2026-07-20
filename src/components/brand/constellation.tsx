'use client';

/**
 * Constellation — breathing persona-dot SVG (extracted from audience-presence).
 *
 * Used for audience presence hero + thread loading affordance. Liveness via motion
 * + cream opacity only — no accent in loading variant (dosage LOCKED).
 */

import type { Audience } from '@/lib/audience/audience-types';
import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';
// Leaf-safe (type-only engine import inside): the named-cast source of truth, so the
// sr-only roster announces the SAME people the visible cast shows (Maya, Dev, …) —
// not "Persona 1…10" — for General and for card reactions carrying real archetypes.
import {
  resolvePersonaName,
  ARCHETYPE_PERSONA_NAME,
  GENERAL_ROSTER,
} from '@/lib/audience/persona-names';

export const DEFAULT_ROSTER_DOTS = 10;
const CREAM = '236, 231, 222';

export interface ConDot {
  id: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  accent: boolean;
  phase: number;
  srLabel: string;
}

/** Deterministic seeded PRNG — verbatim from PersonaGraph (no nondeterministic source). */
export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function personaName(label: string | undefined, archetype: string, index: number): string {
  if (label && label.trim().length > 0) return label.trim();
  if (archetype && archetype.length > 0) {
    return archetype
      .split('_')
      .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
      .join(' ');
  }
  return `Persona ${index + 1}`;
}

/**
 * Build constellation dots: one per calibrated persona (or default roster).
 * When focused, dots reflect verdict; idle = uniform calm cream.
 */
export function buildDots(
  personas: Audience['personas'],
  flat: FlatPersonaReaction[],
  vbW: number,
  vbH: number,
): ConDot[] {
  const count = personas.length > 0 ? personas.length : DEFAULT_ROSTER_DOTS;
  const rnd = mulberry32(1013904223 + count * 2654435761);
  const focused = flat.length > 0;
  const padX = vbH * 0.5;
  const usableW = vbW - padX * 2;

  const out: ConDot[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const cx = padX + t * usableW;
    const jitter = (rnd() - 0.5) * (vbH * 0.46);
    const cy = vbH / 2 + jitter;

    const persona = personas[i];
    const reaction = flat[i];

    let fill: string;
    let r: number;
    if (focused && reaction) {
      const alpha = reaction.verdict === 'stop' ? 0.72 : 0.28;
      fill = `rgba(${CREAM}, ${alpha.toFixed(2)})`;
      r = reaction.verdict === 'stop' ? vbH * 0.17 : vbH * 0.13;
    } else {
      fill = `rgba(${CREAM}, 0.5)`;
      r = vbH * 0.15;
    }

    // Name resolution mirrors the visible cast: calibrated persona → its (relabeled) name;
    // a real reaction archetype → its stable registry name (a placeholder viewer_N reaction
    // stays "Persona N" — never a borrowed cast name); idle General → the roster member this
    // slot represents (the same Maya/Dev/… the "meet your room" cast shows).
    const name = persona
      ? personaName(persona.label, persona.archetype, i)
      : reaction
        ? resolvePersonaName(reaction.archetype) ?? `Persona ${i + 1}`
        : (i < GENERAL_ROSTER.length ? ARCHETYPE_PERSONA_NAME[GENERAL_ROSTER[i]!] : null) ??
          `Persona ${i + 1}`;
    out.push({
      id: persona?.archetype ? `${persona.archetype}-${i}` : `roster_${i}`,
      cx,
      cy,
      r,
      fill,
      accent: false,
      phase: rnd(),
      srLabel: focused && reaction ? `${name}: ${reaction.verdict}` : name,
    });
  }
  return out;
}

/** Normalized skeleton — a wide, airy cloud (not a ball, not a row). Seeded jitter applied on scale. */
const HERO_CLOUD_SKELETON: { x: number; y: number }[] = [
  { x: 0.1, y: 0.52 },
  { x: 0.2, y: 0.26 },
  { x: 0.28, y: 0.7 },
  { x: 0.36, y: 0.38 },
  { x: 0.44, y: 0.58 },
  { x: 0.52, y: 0.2 },
  { x: 0.58, y: 0.76 },
  { x: 0.66, y: 0.44 },
  { x: 0.74, y: 0.16 },
  { x: 0.8, y: 0.64 },
  { x: 0.88, y: 0.34 },
  { x: 0.93, y: 0.54 },
];

/**
 * Hero cloud — wide organic constellation for the home greeting. Uses a designed
 * skeleton + light jitter so dots breathe across the band with visible threads.
 */
export function buildHeroCloudDots(count: number, vbW: number, vbH: number): ConDot[] {
  const n = count > 0 ? count : DEFAULT_ROSTER_DOTS;
  const rnd = mulberry32(3141592653 ^ (n * 1618033989));
  const padX = vbW * 0.04;
  const padY = vbH * 0.1;
  const fieldW = vbW - padX * 2;
  const fieldH = vbH - padY * 2;
  const out: ConDot[] = [];

  for (let i = 0; i < n; i++) {
    const sk = HERO_CLOUD_SKELETON[i % HERO_CLOUD_SKELETON.length]!;
    const depth = rnd();
    const r0 = vbH * (0.038 + depth * 0.045);
    const jx = (rnd() - 0.5) * fieldW * 0.04;
    const jy = (rnd() - 0.5) * fieldH * 0.08;
    const cx = Math.max(r0, Math.min(vbW - r0, padX + sk.x * fieldW + jx));
    const cy = Math.max(r0, Math.min(vbH - r0, padY + sk.y * fieldH + jy));
    const alpha = 0.36 + depth * 0.34;
    out.push({
      id: `hero_${i}`,
      cx,
      cy,
      r: r0,
      fill: `rgba(${CREAM}, ${alpha.toFixed(2)})`,
      accent: false,
      phase: rnd(),
      srLabel: `Persona ${i + 1}`,
    });
  }
  return out;
}

/**
 * Field layout — a balanced, intentional constellation for the ambient empty-state
 * hero. Wide viewBoxes use a golden-angle elliptical swarm (one dense cluster);
 * squarer viewBoxes keep the jittered row grid. Per-dot depth drives radius +
 * opacity for air + parallax. Cream only — no accent (dosage LOCKED). Deterministic.
 */
export function buildFieldDots(count: number, vbW: number, vbH: number): ConDot[] {
  const n = count > 0 ? count : DEFAULT_ROSTER_DOTS;
  const rnd = mulberry32(2166136261 ^ (n * 16777619));

  const padX = vbW * 0.06;
  const padY = vbH * 0.08;
  const aspect = vbW / vbH;

  if (aspect > 2) {
    // Tight centered disk — one obvious swarm on wide hero bands (not a left/right split).
    const cx0 = vbW / 2;
    const cy0 = vbH / 2;
    const spread = Math.min(vbW - padX * 2, vbH - padY * 2) * 0.36;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const out: ConDot[] = [];

    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + i * golden * 0.7 + (rnd() - 0.5) * 0.9;
      const radial = spread * Math.sqrt(0.18 + rnd() * 0.82);
      const depth = rnd();
      const r0 = vbH * (0.045 + depth * 0.06);
      const rawX = cx0 + Math.cos(angle) * radial + (rnd() - 0.5) * spread * 0.12;
      const rawY = cy0 + Math.sin(angle) * radial * 0.88 + (rnd() - 0.5) * spread * 0.14;
      const cx = Math.max(r0, Math.min(vbW - r0, rawX));
      const cy = Math.max(r0, Math.min(vbH - r0, rawY));
      const alpha = 0.34 + depth * 0.36;
      out.push({
        id: `field_${i}`,
        cx,
        cy,
        r: r0,
        fill: `rgba(${CREAM}, ${alpha.toFixed(2)})`,
        accent: false,
        phase: rnd(),
        srLabel: `Persona ${i + 1}`,
      });
    }
    return out;
  }

  const fieldW = vbW - padX * 2;
  const fieldH = vbH - padY * 2;
  const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
  const rows = Math.max(1, Math.ceil(n / cols));

  // Even split across rows so the last row is never a lonely left-aligned stub.
  const perRow: number[] = [];
  let left = n;
  for (let r = 0; r < rows; r++) {
    const c = Math.ceil(left / (rows - r));
    perRow.push(c);
    left -= c;
  }

  const rowH = fieldH / rows;
  const out: ConDot[] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    const c = perRow[r]!;
    const step = fieldW / c;
    const cy0 = padY + (r + 0.5) * rowH;
    // Stagger alternate rows by a half-step (hex-ish packing) + heavy jitter so the field
    // breaks out of a square-grid look and reads as an organic constellation, not a matrix.
    const rowShift = (r % 2 === 0 ? 1 : -1) * step * 0.24;
    for (let k = 0; k < c; k++) {
      const depth = rnd(); // 0 = far/dim/small … 1 = near/bright/large
      const r0 = vbH * (0.045 + depth * 0.06);
      const rawX = padX + (k + 0.5) * step + rowShift + (rnd() - 0.5) * step * 0.6;
      const rawY = cy0 + (rnd() - 0.5) * rowH * 0.85;
      const cx = Math.max(r0, Math.min(vbW - r0, rawX));
      const cy = Math.max(r0, Math.min(vbH - r0, rawY));
      const alpha = 0.34 + depth * 0.36;
      out.push({
        id: `field_${i}`,
        cx,
        cy,
        r: r0,
        fill: `rgba(${CREAM}, ${alpha.toFixed(2)})`,
        accent: false,
        phase: rnd(),
        srLabel: `Persona ${i + 1}`,
      });
      i++;
    }
  }
  return out;
}

/** Calm uniform cream dots for thread loading — no accent, no verdict toning. */
export function buildLoadingDots(vbW: number, vbH: number, count = 8): ConDot[] {
  const rnd = mulberry32(0xdec0de);
  const padX = vbH * 0.5;
  const usableW = vbW - padX * 2;
  const out: ConDot[] = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const cx = padX + t * usableW;
    const jitter = (rnd() - 0.5) * (vbH * 0.4);
    const cy = vbH / 2 + jitter;
    out.push({
      id: `loading_${i}`,
      cx,
      cy,
      r: vbH * 0.14,
      fill: `rgba(${CREAM}, 0.45)`,
      accent: false,
      phase: rnd(),
      srLabel: `Persona ${i + 1}`,
    });
  }
  return out;
}

export interface ConstellationProps {
  dots: ConDot[];
  reducedMotion: boolean;
  width: number | string;
  height: number;
  vbW: number;
  vbH: number;
  /** Override default aria-label. */
  ariaLabel?: string;
  /** The room is reacting (a generation is in flight) → dots pulse FAST (breathe→blink,
   *  ~1s) instead of the calm 3–6s breathe. Motion-only (reducedMotion still wins). */
  reacting?: boolean;
  /** Draw faint nearest-neighbour threads between dots — turns a scatter into an
   *  actual constellation. Cream only, very low opacity. Used by the hero field. */
  connect?: boolean;
  /** `tree` = minimum spanning tree (default). `mesh` = k-nearest-neighbour mesh (swarm). */
  connectMode?: 'tree' | 'mesh';
  /** `breathe` = parallel cream pulse (default). `cascade` = one accent node sweeps in sequence. */
  animation?: 'breathe' | 'cascade';
}

/** Full cascade loop duration (seconds) — one lit node at a time. */
export const CASCADE_CYCLE_SEC = 18;

/**
 * Minimum spanning tree over the dots (Prim's) — connects the whole field into ONE
 * figure with no crossings or orphans, so it reads as a single constellation rather
 * than scattered pairs. n is tiny (~10) so the O(n²) build is free.
 */
function threadEdges(dots: ConDot[]) {
  const n = dots.length;
  if (n < 2) return [] as { key: string; x1: number; y1: number; x2: number; y2: number; a: number; b: number }[];
  const inTree = new Array(n).fill(false);
  inTree[0] = true;
  const edges: { key: string; x1: number; y1: number; x2: number; y2: number; a: number; b: number }[] = [];
  for (let e = 0; e < n - 1; e++) {
    let bi = -1;
    let bj = -1;
    let bd = Infinity;
    for (let a = 0; a < n; a++) {
      if (!inTree[a]) continue;
      for (let b = 0; b < n; b++) {
        if (inTree[b]) continue;
        const dx = dots[a]!.cx - dots[b]!.cx;
        const dy = dots[a]!.cy - dots[b]!.cy;
        const d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          bi = a;
          bj = b;
        }
      }
    }
    if (bj < 0) break;
    inTree[bj] = true;
    const a = Math.min(bi, bj);
    const b = Math.max(bi, bj);
    edges.push({
      key: `${a}-${b}`,
      x1: dots[a]!.cx,
      y1: dots[a]!.cy,
      x2: dots[b]!.cx,
      y2: dots[b]!.cy,
      a,
      b,
    });
  }
  return edges;
}

/**
 * k-nearest-neighbour mesh plus proximity links — overlapping triangles/cycles so
 * the field reads as an interconnected swarm rather than a single chain.
 */
export function meshEdges(dots: ConDot[], k = 4) {
  const n = dots.length;
  if (n < 2) return [] as { key: string; x1: number; y1: number; x2: number; y2: number; a: number; b: number }[];
  const seen = new Set<string>();
  const edges: { key: string; x1: number; y1: number; x2: number; y2: number; a: number; b: number }[] = [];

  const pushEdge = (i: number, j: number) => {
    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (seen.has(key)) return;
    seen.add(key);
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    edges.push({
      key,
      x1: dots[a]!.cx,
      y1: dots[a]!.cy,
      x2: dots[b]!.cx,
      y2: dots[b]!.cy,
      a,
      b,
    });
  };

  const nearest: number[] = [];
  for (let i = 0; i < n; i++) {
    let best = Infinity;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = dots[i]!.cx - dots[j]!.cx;
      const dy = dots[i]!.cy - dots[j]!.cy;
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    if (best < Infinity) nearest.push(Math.sqrt(best));
  }
  nearest.sort((x, y) => x - y);
  const linkDist = nearest[Math.floor(nearest.length / 2)]! * 2.35;
  const linkDistSq = linkDist * linkDist;

  for (let i = 0; i < n; i++) {
    const dists: { j: number; d: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dx = dots[i]!.cx - dots[j]!.cx;
      const dy = dots[i]!.cy - dots[j]!.cy;
      dists.push({ j, d: dx * dx + dy * dy });
    }
    dists.sort((a, b) => a.d - b.d);
    for (let ki = 0; ki < Math.min(k, dists.length); ki++) {
      pushEdge(i, dists[ki]!.j);
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = dots[i]!.cx - dots[j]!.cx;
      const dy = dots[i]!.cy - dots[j]!.cy;
      if (dx * dx + dy * dy <= linkDistSq) pushEdge(i, j);
    }
  }

  return edges;
}

/** SMIL keyframes for node `index` of `count` in a looping accent cascade. */
export function cascadeKeyframes(index: number, count: number) {
  const n = Math.max(1, count);
  const slot = 1 / n;
  const litStart = index * slot;
  const litPeak = litStart + slot * 0.08;
  const litEnd = litStart + slot * 0.52;
  const keyTimes = [0, litStart, litPeak, litEnd, 1].map((t) => t.toFixed(4)).join(';');
  return { keyTimes, values: '0;0;1;0;0' };
}

/** Edge lights when either endpoint is active in the cascade. */
export function edgeCascadeKeyframes(a: number, b: number, count: number) {
  const ka = cascadeKeyframes(a, count);
  const kb = cascadeKeyframes(b, count);
  const ta = ka.keyTimes.split(';').map(Number);
  const tb = kb.keyTimes.split(';').map(Number);
  const va = ka.values.split(';').map(Number);
  const vb = kb.values.split(';').map(Number);
  const times = Array.from(new Set([...ta, ...tb])).sort((x, y) => x - y);
  const values = times
    .map((t) => {
      const ia = ta.findIndex((x, i) => x <= t && (ta[i + 1] ?? 1) >= t);
      const ib = tb.findIndex((x, i) => x <= t && (tb[i + 1] ?? 1) >= t);
      const oa = va[Math.max(0, ia)] ?? 0;
      const ob = vb[Math.max(0, ib)] ?? 0;
      const lit = Math.max(oa, ob);
      return (0.22 + lit * 0.62).toFixed(3);
    })
    .join(';');
  return {
    keyTimes: times.map((t) => t.toFixed(4)).join(';'),
    values,
  };
}

function resolveEdges(dots: ConDot[], connect: boolean, connectMode: 'tree' | 'mesh') {
  if (!connect) return [];
  return connectMode === 'mesh' ? meshEdges(dots) : threadEdges(dots);
}

/** The breathing persona constellation (SVG). Liveness via motion + cream opacity only. */
export function Constellation({
  dots,
  reducedMotion,
  width,
  height,
  vbW,
  vbH,
  ariaLabel,
  reacting = false,
  connect = false,
  connectMode = 'tree',
  animation = 'breathe',
}: ConstellationProps) {
  const edges = resolveEdges(dots, connect, connectMode);
  const isCascade = animation === 'cascade';
  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width, height }}
      role="img"
      aria-label={ariaLabel ?? `Your audience — ${dots.length} people`}
    >
      {edges.map((e) => {
        const edgeCascade = isCascade ? edgeCascadeKeyframes(e.a, e.b, dots.length) : null;
        return (
        <line
          key={e.key}
          x1={e.x1.toFixed(2)}
          y1={e.y1.toFixed(2)}
          x2={e.x2.toFixed(2)}
          y2={e.y2.toFixed(2)}
          stroke={`rgba(${CREAM}, ${isCascade ? 0.22 : 0.14})`}
          strokeWidth={isCascade ? 0.85 : 0.7}
          strokeLinecap="round"
        >
          {!reducedMotion && !isCascade && (
            <animate
              attributeName="opacity"
              values="0.5;1;0.5"
              dur="6s"
              repeatCount="indefinite"
            />
          )}
          {isCascade && !reducedMotion && edgeCascade && (
            <animate
              attributeName="opacity"
              values={edgeCascade.values}
              keyTimes={edgeCascade.keyTimes}
              dur={`${CASCADE_CYCLE_SEC}s`}
              repeatCount="indefinite"
            />
          )}
        </line>
        );
      })}
      {dots.map((d, i) => {
        const cascade = isCascade ? cascadeKeyframes(i, dots.length) : null;
        return (
          <g key={d.id} transform={`translate(${d.cx.toFixed(2)} ${d.cy.toFixed(2)})`}>
            {!reducedMotion && !isCascade && (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 0 -1.1; 0 0.9; 0 0"
                dur={`${(6 + d.phase * 4).toFixed(2)}s`}
                begin={`${(d.phase * -3).toFixed(2)}s`}
                repeatCount="indefinite"
                additive="sum"
              />
            )}
            <circle cx={0} cy={0} r={d.r} fill={d.fill}>
              {!reducedMotion && !isCascade && !d.accent && (
                <animate
                  attributeName="opacity"
                  values={reacting ? '0.4;1;0.4' : '0.78;1;0.78'}
                  dur={reacting ? '1s' : `${(3 + (i % 4)).toFixed(0)}s`}
                  begin={`${(d.phase * -2).toFixed(2)}s`}
                  repeatCount="indefinite"
                />
              )}
            </circle>
            {isCascade && !reducedMotion && cascade && (
              <g opacity={0}>
                <circle
                  cx={0}
                  cy={0}
                  r={d.r * 2.2}
                  fill="var(--color-accent)"
                  opacity={0.18}
                />
                <circle cx={0} cy={0} r={d.r} fill="var(--color-accent)" />
                <animate
                  attributeName="opacity"
                  values={cascade.values}
                  keyTimes={cascade.keyTimes}
                  dur={`${CASCADE_CYCLE_SEC}s`}
                  repeatCount="indefinite"
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
