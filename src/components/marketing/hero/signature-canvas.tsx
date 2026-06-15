"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "motion/react";

import { useCountUp } from "@/hooks/useCountUp";
import {
  HERO_SCORE,
  PARTICLE_COUNT_DESKTOP,
  TIMING,
  RING_SIZE,
  RING_STROKE,
} from "./hero-constants";

/**
 * signature-canvas.tsx — the bespoke canvas-2D "crowd → score" signature moment
 * (HERO-03, the wow). The `dynamic(ssr:false)` lazy target referenced by
 * `signature-moment-client.tsx`; mounts ONLY on the desktop + motion-OK path
 * (the 02-03 boundary already gated mobile / reduced-motion / low-GPU → still).
 *
 * A single requestAnimationFrame loop plays ONCE on mount:
 *   settle (~550ms)  → a field of ~420 charcoal/cream soft particles eases into
 *                      formation around the instrument;
 *   reaction (~800ms)→ a coral pulse ripples across the crowd as it "reacts" to
 *                      the phone (--ease-out-cubic) — the LONE accent moment (D-02);
 *   coalesce (~1200ms)→ the crowd flows inward in ONE continuous gesture to its
 *                      ring-circumference targets (--ease-out-quart, NEVER spring),
 *                      handing off to the arc ring (strokeDashoffset full → score)
 *                      while the center number counts up (useCountUp, D-03/D-04);
 *   rest (after total)→ a very slow, low-amplitude drift/shimmer (the hive-demo
 *                      idle-sine technique); the score + ring stay fixed; NO loop
 *                      of the intro (D-13/D-14).
 *
 * Mechanics copied BY HAND from `hive-demo-canvas.tsx` (DPR backing store,
 * setTransform, getBoundingClientRect fit, idle sine float, touchAction:"auto",
 * rAF + cancelAnimationFrame) — NOT imported, and its rgba(255,255,255) white
 * aesthetic is rejected. No import from hive-demo / board / viral-results /
 * audience; motion/react only (never framer-motion).
 *
 * The resolved ring + the count-up <motion.span> live in a DOM/SVG overlay whose
 * geometry is PIXEL-IDENTICAL to ComposedStill (radius=(RING_SIZE-RING_STROKE)/2,
 * same score offset, same coral) so the canvas → still handoff is seamless
 * (RESEARCH Open Q1). The canvas paints the particles underneath; both sit
 * absolutely over the still inside the stage's `relative` box (no CLS).
 *
 * Token rule (Phase-1 D-06, UI-SPEC §Color): NO raw hex without a token reference.
 * Colors are read at runtime from CSS vars via getComputedStyle on the host node;
 * the literals below are verified fallbacks that cite their token (globals.css).
 */

// ---------------------------------------------------------------------------
// Geometry — IDENTICAL to ComposedStill so the coalesce lands pixel-exact.
// ---------------------------------------------------------------------------
const RADIUS = (RING_SIZE - RING_STROKE) / 2; // 114 — matches composed-still.tsx
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = RING_SIZE / 2;

// ---------------------------------------------------------------------------
// Token-derived palette. Read from CSS vars at runtime (getComputedStyle); the
// fallbacks here are the VERIFIED @theme values (globals.css), each citing its
// token name so there is no untraceable raw hex (UI-SPEC §Color).
// ---------------------------------------------------------------------------
interface Rgb {
  r: number;
  g: number;
  b: number;
}

const FALLBACK_PALETTE = {
  // base field — charcoal/cream only, NO white (D-02)
  creamSecondary: { r: 0xc2, g: 0xbd, b: 0xb4 }, // --color-cream-secondary #c2bdb4
  creamMuted: { r: 0x8a, g: 0x85, b: 0x7c }, // --color-cream-muted #8a857c
  charcoalChip: { r: 0x2f, g: 0x2e, b: 0x2b }, // --color-charcoal-chip #2f2e2b
  // the lone accent — coral-500 ≈ #d97757 (--color-accent → --color-coral-500)
  accent: { r: 0xd9, g: 0x77, b: 0x57 }, // --color-accent oklch(0.68 0.13 33)
} as const;

function parseColor(input: string, fallback: Rgb): Rgb {
  const s = input.trim();
  // rgb()/rgba()
  const rgbMatch = s.match(
    /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i,
  );
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }
  // #rrggbb
  const hexMatch = s.match(/^#?([0-9a-f]{6})$/i);
  if (hexMatch && hexMatch[1]) {
    const hex = hexMatch[1];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return fallback;
}

function readPalette(host: HTMLElement) {
  const cs = getComputedStyle(host);
  const read = (token: string, fallback: Rgb): Rgb => {
    const raw = cs.getPropertyValue(token);
    return raw ? parseColor(raw, fallback) : fallback;
  };
  // getComputedStyle on a CSS var returns its raw declared value (here an
  // oklch() for --color-accent), which canvas fillStyle cannot consume directly.
  // Resolve coral to an rgb() by painting it onto a throwaway probe so the lerp
  // target is concrete; cream/charcoal are declared as hex so parse directly.
  return {
    creamSecondary: read("--color-cream-secondary", FALLBACK_PALETTE.creamSecondary),
    creamMuted: read("--color-cream-muted", FALLBACK_PALETTE.creamMuted),
    charcoalChip: read("--color-charcoal-chip", FALLBACK_PALETTE.charcoalChip),
    accent: resolveAccent(cs) ?? FALLBACK_PALETTE.accent,
  };
}

/**
 * Resolve --color-accent (declared as oklch) to a concrete rgb by letting the
 * browser compute it. happy-dom / SSR-less environments may not support this, so
 * we fall back to the verified coral literal.
 */
function resolveAccent(cs: CSSStyleDeclaration): Rgb | null {
  const raw = cs.getPropertyValue("--color-accent").trim();
  if (!raw) return null;
  // Already rgb/hex (some browsers normalise) → parse straight away.
  if (/^(rgb|#)/i.test(raw)) return parseColor(raw, FALLBACK_PALETTE.accent);
  // oklch()/other → use a probe element so the UA converts it to rgb.
  if (typeof document === "undefined") return null;
  const probe = document.createElement("span");
  probe.style.color = raw;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color; // → "rgb(r, g, b)"
  document.body.removeChild(probe);
  return computed ? parseColor(computed, FALLBACK_PALETTE.accent) : null;
}

const rgba = (c: Rgb, a: number) =>
  `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${a})`;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: lerp(a.r, b.r, t),
  g: lerp(a.g, b.g, t),
  b: lerp(a.b, b.b, t),
});
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Easing helpers — mirror the @theme token cubic-beziers (globals.css:188-189)
// so the canvas matches the SVG-side easing exactly.
//   --ease-out-quart cubic-bezier(0.165,0.84,0.44,1)  (coalesce — decisive arrival)
//   --ease-out-cubic cubic-bezier(0.215,0.61,0.355,1) (reaction wave)
// Analytic ease-out polynomials are visually equivalent and cheap per-frame.
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4); // ≈ --ease-out-quart
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3); // ≈ --ease-out-cubic

// ---------------------------------------------------------------------------
// Particle model. Positions are in a normalized [-1, 1] field space; the rAF
// fit transform maps them into the canvas CSS-px box each frame (so DPR/resize
// are handled centrally, hive-demo Mechanic 3). Start scatter + ring target +
// base color + per-particle phase offsets are pre-computed ONCE at module scope
// (NOT per frame), exactly like hive-demo's BOUNDS/NODE_MAP (Pattern 3).
// ---------------------------------------------------------------------------
type ColorKey = "creamSecondary" | "creamMuted" | "charcoalChip";

interface Particle {
  // start position (scattered across the field), normalized field space
  sx: number;
  sy: number;
  // target position on the ring's circumference (where it coalesces to), px in
  // RING_SIZE space relative to CENTER
  tx: number;
  ty: number;
  // base color key (charcoal/cream — never coral, never white) + base alpha
  color: ColorKey;
  alpha: number;
  radius: number; // 2–4px rendered (DPR-scaled by the fit transform)
  // phase offsets for the reaction wavefront + the at-rest drift
  wavePhase: number; // 0..1 across the field → staggers the coral crest
  driftPhase: number; // randomizes the idle sine so the rest field shimmers
  coalesceDelay: number; // small per-particle stagger so arrival is organic
}

// Deterministic PRNG (mulberry32) so module-scope generation is stable across
// renders and never depends on Math.random timing.
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PARTICLES: Particle[] = (() => {
  const rand = mulberry32(0x5eed02);
  const out: Particle[] = [];
  const count = PARTICLE_COUNT_DESKTOP; // 420
  const colorKeys: ColorKey[] = [
    "creamSecondary",
    "creamSecondary",
    "creamMuted",
    "charcoalChip", // ~1 in 4 charcoal for depth
  ];

  for (let i = 0; i < count; i++) {
    // Start: scattered across a wide field (normalized [-1,1], biased slightly
    // outward so the inward coalesce reads as a true gather).
    const a0 = rand() * Math.PI * 2;
    const r0 = 0.45 + Math.pow(rand(), 0.6) * 0.85; // 0.45..1.3 (some off-stage)
    const sx = Math.cos(a0) * r0;
    const sy = Math.sin(a0) * r0 * 0.78; // slight vertical squash for a crowd feel

    // Target: a point on the ring circumference (the coalescing stream lands on
    // the gauge). Distribute evenly around the ring with light jitter so the
    // ring reads "formed by the crowd," not a clean machine circle.
    const ringAngle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.18;
    const ringR = RADIUS + (rand() - 0.5) * 6; // hug the stroke, tiny jitter
    const tx = Math.cos(ringAngle) * ringR;
    const ty = Math.sin(ringAngle) * ringR;

    // rand() ∈ [0,1) → index is always in-bounds; assert to satisfy
    // noUncheckedIndexedAccess.
    const color = colorKeys[Math.floor(rand() * colorKeys.length)]!;
    const alpha =
      color === "charcoalChip" ? 0.5 + rand() * 0.15 : 0.28 + rand() * 0.27; // 0.25–0.55 band
    const radius = 2 + rand() * 2; // 2–4px

    out.push({
      sx,
      sy,
      tx,
      ty,
      color,
      alpha,
      radius,
      // wavefront keyed off start angle so the coral crest sweeps across the field
      wavePhase: (a0 / (Math.PI * 2) + 1) % 1,
      driftPhase: rand() * Math.PI * 2,
      coalesceDelay: rand() * 0.18, // up to 18% of the coalesce window
    });
  }
  return out;
})();

// Phase boundaries (ms) derived once from the TIMING budget (≤3500ms total).
const SETTLE_END = TIMING.settle; // 550
const REACTION_END = SETTLE_END + TIMING.reaction; // 1350
const COALESCE_END = REACTION_END + TIMING.coalesce; // 2550 (< total 3500)

export interface SignatureCanvasProps {
  /** The resolved virality score driving the moment. Defaults to HERO_SCORE. */
  score?: number;
}

export default function SignatureCanvas({
  score = HERO_SCORE,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const paletteRef = useRef<ReturnType<typeof readPalette> | null>(null);
  // Coordinate the rAF loop with React state (avoid stale closures + redundant
  // setState churn inside the high-frequency draw). Declared before the effect.
  const ringVisibleRef = useRef(false);
  const lastRingOffsetRef = useRef<number>(CIRCUMFERENCE);

  // SVG ring: animate strokeDashoffset from full (empty) → the score offset over
  // the coalesce window, so the crowd "becomes" the gauge. Driven by React state
  // updated from the rAF loop only during the coalesce (one pass), then frozen.
  const finalOffset = CIRCUMFERENCE - (clamp01(score / 100)) * CIRCUMFERENCE;
  const [ringOffset, setRingOffset] = useState<number>(CIRCUMFERENCE); // start empty
  const [ringVisible, setRingVisible] = useState<boolean>(false);

  // Replay (D-13): bump a token to remount the count-up + reset the rAF start.
  const [replayKey, setReplayKey] = useState<number>(0);

  // Center number — count-up to the score over ~the coalesce window (Pattern 4:
  // MUST render inside <motion.span>, never a plain element). Re-keyed on replay.
  const display = useCountUp({ to: score, duration: 1.2 });

  const replay = useCallback(() => {
    startRef.current = 0; // rAF re-baselines elapsed → plays the once-through again
    setRingOffset(CIRCUMFERENCE);
    setRingVisible(false);
    setReplayKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!canvas.getContext("2d")) return; // bail if 2d unavailable; draw re-acquires

    // Resolve tokens once on mount (then reuse; tokens don't change at runtime).
    if (!paletteRef.current) {
      paletteRef.current = readPalette(canvas);
    }

    // Track whether the coalesce ring has been committed so we set state once.
    let ringCommitted = false;

    function draw(timestamp: number) {
      const c = canvasRef.current;
      if (!c) return;
      const context = c.getContext("2d");
      if (!context) return;
      const pal = paletteRef.current!;

      if (startRef.current === 0) {
        startRef.current = timestamp;
        ringCommitted = false;
      }
      const elapsed = timestamp - startRef.current;

      // --- hive-demo Mechanic 1: DPR-aware backing store, resize only on change.
      const dpr = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (
        c.width !== Math.round(w * dpr) ||
        c.height !== Math.round(h * dpr)
      ) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }

      // --- Mechanic 2: draw in CSS px.
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, w, h);

      // --- Mechanic 3: fit transform. Map RING_SIZE-space targets and the
      // normalized [-1,1] start field onto the same centered box so the canvas
      // ring targets land EXACTLY over the SVG ring overlay (also centered).
      const cx = w / 2;
      const cy = h / 2;
      // The SVG ring overlay is RING_SIZE px regardless of canvas size; match it
      // 1:1 in CSS px (no extra scaling) so canvas targets === SVG geometry.
      const fieldSpread = Math.min(w, h) * 0.46; // start-scatter radius in px

      // Phase progress values (each 0..1, clamped).
      const settleT = easeOutCubic(clamp01(elapsed / SETTLE_END));
      const reactionRaw = clamp01(
        (elapsed - SETTLE_END) / (REACTION_END - SETTLE_END),
      );
      const coalesceRaw = clamp01(
        (elapsed - REACTION_END) / (COALESCE_END - REACTION_END),
      );
      const atRest = elapsed >= TIMING.total;

      // Commit the SVG ring fill once the coalesce is underway, animating the
      // dashoffset full→score across the coalesce window (handoff to the gauge).
      if (coalesceRaw > 0) {
        if (!ringVisibleRef.current) {
          ringVisibleRef.current = true;
          setRingVisible(true);
        }
        const ringT = easeOutQuart(coalesceRaw);
        const off = lerp(CIRCUMFERENCE, finalOffset, ringT);
        // Throttle React state writes: only when it visibly changed.
        if (Math.abs(off - lastRingOffsetRef.current) > 0.5 || coalesceRaw >= 1) {
          lastRingOffsetRef.current = off;
          setRingOffset(coalesceRaw >= 1 ? finalOffset : off);
        }
        if (coalesceRaw >= 1 && !ringCommitted) {
          ringCommitted = true;
        }
      }

      // At-rest drift parameters (hive-demo Mechanic 4): a gentle, low-amplitude
      // sine shimmer. period ~8s, ≤~1.5px positional, ≤0.05 alpha. No intro loop.
      const driftTime = elapsed * 0.00078; // ≈ 8s period feel
      const driftAmp = atRest ? 1.4 : 0; // px — only after total

      for (let i = 0; i < PARTICLES.length; i++) {
        const p = PARTICLES[i]!; // i < length → defined (noUncheckedIndexedAccess)

        // SETTLE → field eases from a wide scatter into its resting field pos.
        // Resting field pos = the start scatter pulled gently inward (it is the
        // "crowd watching," BEFORE the coalesce gathers it onto the ring).
        const restFieldX = cx + p.sx * fieldSpread;
        const restFieldY = cy + p.sy * fieldSpread;
        // pre-settle, particles begin further out; ease toward the rest field.
        const preX = cx + p.sx * fieldSpread * 1.18;
        const preY = cy + p.sy * fieldSpread * 1.18;
        let px = lerp(preX, restFieldX, settleT);
        let py = lerp(preY, restFieldY, settleT);

        // COALESCE → in one continuous gesture, flow from the rest field to the
        // ring-circumference target (--ease-out-quart). Per-particle stagger so
        // arrival is organic, not a synchronized snap.
        if (coalesceRaw > 0) {
          const local = clamp01(
            (coalesceRaw - p.coalesceDelay) / (1 - p.coalesceDelay),
          );
          const cT = easeOutQuart(local);
          const ringX = cx + p.tx;
          const ringY = cy + p.ty;
          px = lerp(restFieldX, ringX, cT);
          py = lerp(restFieldY, ringY, cT);
        }

        // REST → very slow, barely-perceptible drift once the moment resolves.
        if (driftAmp > 0) {
          px += Math.sin(driftTime + p.driftPhase) * driftAmp;
          py += Math.cos(driftTime * 0.9 + p.driftPhase) * driftAmp;
        }

        // --- Color: base charcoal/cream; lerp toward coral ONLY on the reaction
        // wavefront (D-02 lone accent), easing back as the crest passes.
        const base = pal[p.color];
        let col: Rgb = base;
        let alpha = p.alpha;

        if (reactionRaw > 0 && coalesceRaw < 1) {
          // A coral wavefront sweeps across the field: each particle peaks when
          // the front (reactionRaw) reaches its wavePhase, then eases back.
          const front = reactionRaw;
          const dist = Math.abs(front - p.wavePhase);
          const crest = clamp01(1 - dist / 0.28); // wave width
          const reactT = easeOutCubic(crest);
          if (reactT > 0) {
            col = lerpRgb(base, pal.accent, reactT);
            // peak alpha ~0.9 at the crest
            alpha = lerp(p.alpha, 0.9, reactT);
          }
        }

        // During coalesce, the inflowing stream keeps a faint coral tint that
        // fades to the resolved ring's coral as it arrives (the crowd "becomes"
        // the gauge) — still within the accent allowlist (reaction → instrument).
        if (coalesceRaw > 0) {
          const local = clamp01(
            (coalesceRaw - p.coalesceDelay) / (1 - p.coalesceDelay),
          );
          const tint = easeOutQuart(local) * 0.55;
          col = lerpRgb(col, pal.accent, tint);
          alpha = lerp(alpha, 0.85, easeOutQuart(local) * 0.4);
        }

        // At rest the particles sit as the calm cream/charcoal field that hugs
        // the ring; a ≤0.05 alpha shimmer keeps it feeling live.
        if (atRest) {
          alpha += Math.sin(driftTime * 1.3 + p.driftPhase) * 0.04;
          alpha = clamp01(alpha);
        }

        const r = p.radius;
        context.beginPath();
        context.arc(px, py, r, 0, Math.PI * 2);
        context.fillStyle = rgba(col, alpha);
        context.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // replayKey re-runs the effect → fresh rAF baseline for the once-through.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, finalOffset]);

  // Keep the rAF-visible ref in sync with the committed ring-visible state.
  useEffect(() => {
    ringVisibleRef.current = ringVisible;
  }, [ringVisible]);

  return (
    // Absolutely overlays the ComposedStill inside the stage's `relative` box —
    // the still paints first (SSR), the canvas + ring overlay paint over it with
    // NO CLS. Click/hover replays the once-through (D-13). role/aria-label mirror
    // the still so the resolved score is announced.
    <div
      ref={stageRef}
      className="absolute inset-0 flex items-center justify-center"
      role="img"
      aria-label={`A synthetic audience reacts to a video and resolves into a virality score of ${score} out of 100.`}
      onMouseEnter={replay}
    >
      {/* Particle field — vanilla canvas; touchAction:"auto" never blocks scroll
          (hive-demo Mechanic 5). pointer-events handled by the replay button. */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ touchAction: "auto" }}
        aria-hidden="true"
      />

      {/* Resolved instrument overlay — SAME geometry as ComposedStill so the
          canvas → still handoff is pixel-consistent. The arc animates
          full → score; the number counts up alongside it. */}
      <div className="pointer-events-none relative flex items-center justify-center"
        style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track — secondary tone-step (matches the still), not white/10. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="var(--color-surface-elevated)"
            strokeWidth={RING_STROKE}
            opacity={ringVisible ? 1 : 0}
          />
          {/* Progress — coral accent, rounded cap, NO glow. strokeDashoffset
              animates full → the score offset over the coalesce window. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={ringOffset}
            opacity={ringVisible ? 1 : 0}
          />
        </svg>

        {/* Center number — count-up to the score (Pattern 4: MUST be motion.span;
            a plain element renders "[object Object]"). Coral (allowlist item 3),
            tabular-nums, --text-display 64px / 600; "/100" suffix in cream-muted.
            Re-keyed on replay so the count-up restarts with the once-through. */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-baseline" style={{ opacity: ringVisible ? 1 : 0 }}>
            <motion.span
              key={replayKey}
              className="font-semibold tabular-nums text-accent text-display leading-none"
            >
              {display}
            </motion.span>
            <span className="ml-1 text-lg font-medium text-foreground-muted">
              /100
            </span>
          </span>
        </div>
      </div>

      {/* Replay affordance (D-13) — an accessible, keyboard-operable control with
          a name. It covers the stage so click anywhere replays; it is transparent
          and does not paint, so the canvas/ring read through it. The still beneath
          already shows the full outcome, so this is an enhancement, not the only
          way to perceive the moment (UI-SPEC §A11y). */}
      <button
        type="button"
        onClick={replay}
        aria-label="Replay the simulation"
        className="absolute inset-0 z-10 cursor-pointer bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </div>
  );
}
