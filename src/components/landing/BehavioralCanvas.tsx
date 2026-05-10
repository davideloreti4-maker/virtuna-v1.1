'use client';

// ---------------------------------------------------------------------------
// BehavioralCanvas.tsx -- Canvas 2D drift+attract particle viz for the
// behavioral-simulation hero (Phase 2).
// ---------------------------------------------------------------------------
//
// Paints PARTICLE_COUNTS.{desktop,mobile} particles at uniform random positions
// (70% coral / 30% neutral), then runs a one-shot ~2.2s animation that:
//   - Adds Brownian Gaussian velocity noise per frame
//   - Pulls each particle toward the upper-center target with attractor
//     strength scaled by easeOutCubic(t)
//   - Damps velocity each frame
// converging into a coral cloud where Plan 04 overlays the "87 percent" chip
// as a DOM element (NOT canvas-rendered text -- the canvas-2d text APIs are
// intentionally avoided so the chip stays accessible to assistive tech).
//
// Reuses (verbatim, no duplication):
//   - useCanvasResize from @/components/hive/use-canvas-resize
//   - usePrefersReducedMotion from @/hooks/usePrefersReducedMotion
//   - easeOutCubic from ./behavioral-hero-constants (matches hive easing)
//
// Module-level flag `behavioralHeroAnimationComplete` (file-scoped, NOT
// exported, NOT named `globalAnimationComplete` to avoid colliding with
// use-hive-animation.ts:43) prevents the animation from replaying after a
// client-side navigation back to the page.
//
// Pitfalls handled:
//   5: Flag name is `behavioralHeroAnimationComplete`, not the hive flag
//   6: 'use client' directive at line 1 (RSC boundary)
//   10: No background-color on canvas; ctx.clearRect at frame start so the
//       parent gradient shows through
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';

import { useCanvasResize } from '@/components/hive/use-canvas-resize';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

import {
  PARTICLE_COUNTS,
  PARTICLE_SIZES,
  PARTICLE_COLORS,
  PARTICLE_MOTION,
  easeOutCubic,
} from './behavioral-hero-constants';

// ---------------------------------------------------------------------------
// Module-level flag (Pitfall 5)
// ---------------------------------------------------------------------------

/**
 * Prevents the drift+attract animation from replaying after the first run in
 * a session. Survives client-side navigation in Next.js App Router; resets
 * only on full page reload. NOT exported (file-scoped per threat T-2-08).
 */
let behavioralHeroAnimationComplete = false;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
}

interface BehavioralCanvasProps {
  /** Optional layout class -- parent controls canvas sizing via Tailwind. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Box-Muller transform for a standard-normal Gaussian sample (mean 0,
 * variance 1). Used for Brownian velocity perturbation each frame.
 *
 * Rejects `Math.random() === 0` because `Math.log(0) === -Infinity`
 * propagates `NaN` into particle velocity (and, transitively, every
 * subsequent frame's position math) -- a particle with NaN velocity
 * disappears for the rest of the session, since `ctx.arc(NaN, NaN, ...)`
 * is a no-op. Probability per call is ~1 / 2^53, but gaussian() runs
 * ~2 * 250 * 132 = ~66k times per page-view, so the bug is reachable
 * over a long-enough horizon. WR-02.
 */
export function gaussian(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BehavioralCanvas({
  className,
}: BehavioralCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);

  const reducedMotion = usePrefersReducedMotion();

  // ---- Size mirror (CR-01 fix)
  // `useCanvasResize` returns a ref that's populated *asynchronously* on the
  // first ResizeObserver callback. The original code read `sizeRef.current`
  // inside the init `useEffect` and bailed when width was 0 -- but the effect
  // never re-ran when size later became available because its deps didn't
  // include the size. Mirror the size into React state so the init effect
  // re-runs when ResizeObserver fires its first callback.
  const [size, setSize] = useState({ width: 0, height: 0, dpr: 1 });

  // ---- Render callback (reads refs synchronously, no React state per frame)
  // PATTERN: HiveCanvas.tsx:147-186
  // Reads from `sizeRef.current` (declared below) lazily at call time, so
  // lexical order is fine -- but `react-hooks/immutability` static-analyzes
  // identifier order, so we use the captured `size` state instead. The
  // values are kept in lockstep by the `useCanvasResize` onResize callback.
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height, dpr } = size;
    if (width <= 0 || height <= 0) return;

    // Clear full buffer (pixel space, not CSS pixels) -- Pitfall 10
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply DPR scaling so all subsequent ops are in CSS pixels
    ctx.save();
    ctx.scale(dpr, dpr);

    // Color batching -- PATTERN: hive-renderer.ts:240-298
    const particles = particlesRef.current;
    const colorGroups = new Map<string, Particle[]>();
    for (const p of particles) {
      let group = colorGroups.get(p.color);
      if (!group) {
        group = [];
        colorGroups.set(p.color, group);
      }
      group.push(p);
    }

    for (const [color, group] of colorGroups) {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const p of group) {
        ctx.moveTo(p.x + p.size, p.y);
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    ctx.restore();
    // NOTE: NO chip drawing here. The "87 percent" chip is rendered by Plan 04
    // (BehavioralHero.tsx) as a positioned DOM element so screen readers can
    // pick it up and the coral chip inherits the page font stack.
  }, [size]);

  // ---- Canvas resize (ResizeObserver + DPR) -- VERBATIM REUSE
  // The onResize callback writes through React state (so the init effect
  // re-runs when size lands) and then drives an immediate render so the
  // pre-converged frame paints before RAF kicks in.
  useCanvasResize(
    canvasRef,
    useCallback(
      (next) => {
        setSize(next);
        render();
      },
      [render],
    ),
  );

  // ---- Initialize particles + drive RAF
  useEffect(() => {
    const { width, height } = size;
    if (width <= 0 || height <= 0) return;

    const isMobile = width < 640;
    const count = isMobile ? PARTICLE_COUNTS.mobile : PARTICLE_COUNTS.desktop;
    const sigmaScale = isMobile
      ? PARTICLE_MOTION.brownianSigmaMobile
      : PARTICLE_MOTION.brownianSigmaPxPerSec;
    const sizeMultiplier = isMobile ? PARTICLE_SIZES.mobileScale : 1;

    const target = {
      x: width / 2,
      y: height * (0.5 + PARTICLE_MOTION.targetOffsetY),
    };

    // Branch A: reduced-motion or already-played -- build particles directly
    // at the converged cluster position (no animation needed).
    // Building a fresh array (not mutating particlesRef.current) keeps
    // react-hooks/immutability happy and is functionally identical.
    if (reducedMotion || behavioralHeroAnimationComplete) {
      const clusterRadius = Math.min(width, height) * 0.12;
      const converged: Particle[] = Array.from({ length: count }, () => {
        const isCoral = Math.random() < PARTICLE_COLORS.coralRatio;
        const baseSize =
          PARTICLE_SIZES.min +
          Math.random() * (PARTICLE_SIZES.max - PARTICLE_SIZES.min);
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * clusterRadius;
        return {
          x: target.x + Math.cos(angle) * r,
          y: target.y + Math.sin(angle) * r,
          vx: 0,
          vy: 0,
          color: isCoral ? PARTICLE_COLORS.coral : PARTICLE_COLORS.neutral,
          size: baseSize * sizeMultiplier,
        };
      });
      particlesRef.current = converged;
      behavioralHeroAnimationComplete = true;
      render();
      return;
    }

    // Branch B: animation path -- build a local particle array, hand it to
    // the ref so render() can read it, and mutate the local array in the RAF
    // tick (the lint rule tracks `particlesRef` directly so we operate on a
    // local binding that aliases the same array).
    const particles: Particle[] = Array.from({ length: count }, () => {
      const isCoral = Math.random() < PARTICLE_COLORS.coralRatio;
      const baseSize =
        PARTICLE_SIZES.min +
        Math.random() * (PARTICLE_SIZES.max - PARTICLE_SIZES.min);
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        color: isCoral ? PARTICLE_COLORS.coral : PARTICLE_COLORS.neutral,
        size: baseSize * sizeMultiplier,
      };
    });
    particlesRef.current = particles;

    startTimeRef.current = performance.now();
    lastFrameRef.current = startTimeRef.current;

    let rafId = 0;

    const tick = (now: number): void => {
      const elapsed = now - startTimeRef.current;
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      const t = Math.min(1, elapsed / PARTICLE_MOTION.animationDurationMs);
      const easedProgress = easeOutCubic(t);
      const k = PARTICLE_MOTION.attractorPeakStrength * easedProgress;

      for (const p of particles) {
        // Brownian (per-component independent gaussian samples)
        p.vx += gaussian() * sigmaScale * dt;
        p.vy += gaussian() * sigmaScale * dt;

        // Attractor toward target (strength scales with easedProgress)
        p.vx += (target.x - p.x) * k * dt;
        p.vy += (target.y - p.y) * k * dt;

        // Damping
        p.vx *= PARTICLE_MOTION.damping;
        p.vy *= PARTICLE_MOTION.damping;

        // Apply position
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      render();

      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        behavioralHeroAnimationComplete = true;
        render();
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [reducedMotion, render, size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      role="img"
      aria-label="Audience particles aggregating into a confidence score of 87 percent"
    />
  );
}
