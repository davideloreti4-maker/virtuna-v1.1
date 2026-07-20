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

/**
 * Field layout — a balanced, intentional constellation for the ambient empty-state
 * hero. Dots are laid on a jittered, row-centred grid (even coverage, no clumping,
 * still organic) rather than pure-random scatter (which reads as noise). Per-dot
 * depth drives radius + opacity for air + parallax. Threads (see threadEdges) connect
 * the field into a SINGLE figure. Cream only — no accent (dosage LOCKED). Deterministic.
 */
export function buildFieldDots(count: number, vbW: number, vbH: number): ConDot[] {
  const n = count > 0 ? count : DEFAULT_ROSTER_DOTS;
  const rnd = mulberry32(2166136261 ^ (n * 16777619));

  const padX = vbW * 0.08;
  const padY = vbH * 0.1;
  const fieldW = vbW - padX * 2;
  const fieldH = vbH - padY * 2;

  // Wide viewBoxes cap columns so dots cluster in ~4×3 (swarm) instead of a flat 7×2 band.
  const aspect = vbW / vbH;
  const cols =
    aspect > 2
      ? Math.max(1, Math.ceil(Math.sqrt(n * 0.75)))
      : Math.max(1, Math.round(Math.sqrt(n * aspect)));
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
export const CASCADE_CYCLE_SEC = 6;

/**
 * Minimum spanning tree over the dots (Prim's) — connects the whole field into ONE
 * figure with no crossings or orphans, so it reads as a single constellation rather
 * than scattered pairs. n is tiny (~10) so the O(n²) build is free.
 */
function threadEdges(dots: ConDot[]) {
  const n = dots.length;
  if (n < 2) return [] as { key: string; x1: number; y1: number; x2: number; y2: number }[];
  const inTree = new Array(n).fill(false);
  inTree[0] = true;
  const edges: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];
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
    edges.push({
      key: `${bi}-${bj}`,
      x1: dots[bi]!.cx,
      y1: dots[bi]!.cy,
      x2: dots[bj]!.cx,
      y2: dots[bj]!.cy,
    });
  }
  return edges;
}

/**
 * k-nearest-neighbour mesh — overlapping triangles/cycles so the field reads as an
 * interconnected swarm rather than a single MST chain.
 */
export function meshEdges(dots: ConDot[], k = 2) {
  const n = dots.length;
  if (n < 2) return [] as { key: string; x1: number; y1: number; x2: number; y2: number }[];
  const seen = new Set<string>();
  const edges: { key: string; x1: number; y1: number; x2: number; y2: number }[] = [];

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
      const j = dists[ki]!.j;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        key,
        x1: dots[i]!.cx,
        y1: dots[i]!.cy,
        x2: dots[j]!.cx,
        y2: dots[j]!.cy,
      });
    }
  }
  return edges;
}

/** SMIL keyframes for node `index` of `count` in a looping accent cascade. */
export function cascadeKeyframes(index: number, count: number) {
  const n = Math.max(1, count);
  const slot = 1 / n;
  const litStart = index * slot;
  const litPeak = litStart + slot * 0.12;
  const litEnd = litStart + slot * 0.88;
  const keyTimes = [0, litStart, litPeak, litEnd, 1].map((t) => t.toFixed(4)).join(';');
  return { keyTimes, values: '0;0;1;0;0' };
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
      {edges.map((e) => (
        <line
          key={e.key}
          x1={e.x1.toFixed(2)}
          y1={e.y1.toFixed(2)}
          x2={e.x2.toFixed(2)}
          y2={e.y2.toFixed(2)}
          stroke={`rgba(${CREAM}, 0.14)`}
          strokeWidth={0.7}
        >
          {!reducedMotion && !isCascade && (
            <animate
              attributeName="opacity"
              values="0.5;1;0.5"
              dur="6s"
              repeatCount="indefinite"
            />
          )}
        </line>
      ))}
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
