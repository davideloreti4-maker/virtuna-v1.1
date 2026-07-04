"use client";

/**
 * Per-audience constellation thumbnail for list cards.
 * P0 stub: duplicates buildDots from audience-presence until brand/constellation.tsx lands.
 * Empty personas → static ConstellationMark (A4 preset-safe).
 */

import { useMemo } from "react";
import type { Audience } from "@/lib/audience/audience-types";
import { ConstellationMark } from "@/components/brand/constellation-mark";
import { getPersonaRoster } from "./audience-display";
import { cn } from "@/lib/utils";

const DEFAULT_ROSTER_DOTS = 10;
const CREAM = "236, 231, 222";

export interface AudienceConstellationThumbProps {
  audience: Audience;
  reducedMotion?: boolean;
  width?: number;
  className?: string;
}

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

interface ConDot {
  id: string;
  cx: number;
  cy: number;
  r: number;
  fill: string;
  phase: number;
}

function buildThumbDots(count: number, seed: number, vbW: number, vbH: number): ConDot[] {
  const dotCount = count > 0 ? count : DEFAULT_ROSTER_DOTS;
  const rnd = mulberry32(seed + dotCount * 2654435761);
  const padX = vbH * 0.5;
  const usableW = vbW - padX * 2;
  const out: ConDot[] = [];

  for (let i = 0; i < dotCount; i++) {
    const t = dotCount === 1 ? 0.5 : i / (dotCount - 1);
    const cx = padX + t * usableW;
    const jitter = (rnd() - 0.5) * (vbH * 0.46);
    const cy = vbH / 2 + jitter;
    // Crisper, less uniform: a few brighter "stars" among dimmer dots reads as a
    // designed constellation rather than a faint even scatter.
    const r = vbH * (0.13 + rnd() * 0.07);
    const op = 0.46 + rnd() * 0.3;
    out.push({
      id: `roster_${i}`,
      cx,
      cy,
      r,
      fill: `rgba(${CREAM}, ${op.toFixed(2)})`,
      phase: rnd(),
    });
  }
  return out;
}

function ThumbConstellation({
  dots,
  reducedMotion,
  width,
  height,
  vbW,
  vbH,
}: {
  dots: ConDot[];
  reducedMotion: boolean;
  width: number;
  height: number;
  vbW: number;
  vbH: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      width={width}
      height={height}
      role="img"
      aria-hidden
    >
      {/* Faint constellation edges — connect consecutive nodes into a path (drawn
          under the dots). Reinforces the identity motif vs. a loose dot scatter. */}
      {dots.slice(1).map((d, i) => {
        const prev = dots[i]!;
        return (
          <line
            key={`edge_${d.id}`}
            x1={prev.cx.toFixed(2)}
            y1={prev.cy.toFixed(2)}
            x2={d.cx.toFixed(2)}
            y2={d.cy.toFixed(2)}
            stroke={`rgba(${CREAM}, 0.1)`}
            strokeWidth={0.6}
          />
        );
      })}
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
            {!reducedMotion && (
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

export function AudienceConstellationThumb({
  audience,
  reducedMotion = false,
  width = 72,
  className,
}: AudienceConstellationThumbProps) {
  const roster = getPersonaRoster(audience);
  const hasPersonas = roster.length > 0 || audience.is_general;
  const dotCount = audience.is_general ? DEFAULT_ROSTER_DOTS : roster.length;

  const dots = useMemo(() => {
    if (!hasPersonas) return [];
    return buildThumbDots(dotCount, seedFromId(audience.id), 120, 48);
  }, [audience.id, dotCount, hasPersonas]);

  if (!hasPersonas) {
    return (
      <ConstellationMark
        width={width}
        litNodeIndex={-1}
        className={cn("shrink-0 opacity-80", className)}
        aria-hidden
      />
    );
  }

  const height = Math.round((width * 48) / 120);
  return (
    <div className={cn("shrink-0", className)}>
      <ThumbConstellation
        dots={dots}
        reducedMotion={reducedMotion}
        width={width}
        height={height}
        vbW={120}
        vbH={48}
      />
    </div>
  );
}
