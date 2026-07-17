"use client";

/**
 * PopulationField — the detail page's resting-state hero (audience rebuild P2).
 *
 * 1,000 dots clustered spatially by persona (share = cluster size), cream alphas
 * only — WHO is in the room, not how it reacts. No verdicts, no counters: the
 * brain/reaction layer only means something while content hits the room (the
 * ambient card during a Read), so at rest this stays population-shaped.
 *
 * Geometry mirrors PopulationSwarm: golden-angle anchors per persona + a seeded
 * Box-Muller scatter (mulberry32) — deterministic, no Math.random/Date.now, so
 * the field is byte-identical across SSR/renders.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface PopulationFieldProps {
  /** Persona shares (0..1). Cluster size follows share; order sets the alpha ramp. */
  shares: number[];
  /** Viewers the field represents (caption + dot count). */
  total?: number;
  /** Right-side provenance caption, already in plain words ("Generated from account data"). */
  provenance: string;
  seed?: number;
  className?: string;
}

const VB_W = 320;
const VB_H = 132;

/** Seeded PRNG — same generator PopulationSwarm/PersonaGraph use. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Dot {
  x: number;
  y: number;
  opacity: number;
}

export function PopulationField({
  shares,
  total = 1000,
  provenance,
  seed = 1337,
  className,
}: PopulationFieldProps) {
  const dots = useMemo<Dot[]>(() => {
    if (shares.length === 0) return [];
    const cx = VB_W / 2;
    const cy = VB_H / 2;
    const n = shares.length;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const maxR = Math.min(VB_W, VB_H) * 0.62;

    const out: Dot[] = [];
    shares.forEach((share, i) => {
      const t = (i + 0.5) / n;
      const r = Math.sqrt(t) * maxR;
      const a = i * golden;
      const ax = cx + Math.cos(a) * r;
      const ay = cy + Math.sin(a) * r * 0.55; // flatten to the wide hero panel
      const rnd = mulberry32(seed + 9173 + i * 31337);
      // Larger clusters read denser, not louder: alpha ramps DOWN the share order
      // so the field stays one quiet material (accent budget: zero here).
      const alpha = 0.55 - (i / Math.max(1, n - 1)) * 0.38;
      const count = Math.max(1, Math.round(share * total));
      const spread = 7 + Math.sqrt(share) * 26;
      for (let k = 0; k < count; k++) {
        const u1 = Math.max(0.0001, rnd());
        const u2 = rnd();
        const mag = Math.sqrt(-2 * Math.log(u1)) * spread;
        const angle = u2 * 2 * Math.PI;
        out.push({
          x: ax + Math.cos(angle) * mag,
          y: ay + Math.sin(angle) * mag * 0.6,
          opacity: Math.min(0.9, Math.max(0.08, alpha + (rnd() - 0.5) * 0.12)),
        });
      }
    });
    return out;
  }, [shares, total, seed]);

  const viewers = total.toLocaleString("en-US");

  return (
    <div className={cn("flex flex-col", className)} data-testid="population-field">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-[176px] w-full"
        role="img"
        aria-label={`${viewers} viewers across ${shares.length} personas`}
      >
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x.toFixed(2)}
            cy={d.y.toFixed(2)}
            r={1.15}
            fill="#ece7de"
            opacity={d.opacity.toFixed(2)}
          />
        ))}
      </svg>
      <div className="mt-3.5 flex items-baseline justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-muted">
          {viewers} viewers · {shares.length} personas
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-muted opacity-60">
          {provenance}
        </span>
      </div>
    </div>
  );
}
