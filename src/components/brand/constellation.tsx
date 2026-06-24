'use client';

/**
 * Constellation — breathing persona-dot SVG (extracted from audience-presence).
 *
 * Used for audience presence hero + thread loading affordance. Liveness via motion
 * + cream opacity only — no accent in loading variant (dosage LOCKED).
 */

import type { Audience } from '@/lib/audience/audience-types';
import type { FlatPersonaReaction } from '@/components/board/audience/audience-derive';

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

    const name = persona ? personaName(persona.label, persona.archetype, i) : `Persona ${i + 1}`;
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
}: ConstellationProps) {
  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width, height }}
      role="img"
      aria-label={ariaLabel ?? `Your audience — ${dots.length} people`}
    >
      {dots.map((d, i) => (
        <g key={d.id} transform={`translate(${d.cx.toFixed(2)} ${d.cy.toFixed(2)})`}>
          {!reducedMotion && (
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
            {!reducedMotion && !d.accent && (
              <animate
                attributeName="opacity"
                values="0.78;1;0.78"
                dur={`${(3 + (i % 4)).toFixed(0)}s`}
                begin={`${(d.phase * -2).toFixed(2)}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
        </g>
      ))}
    </svg>
  );
}
