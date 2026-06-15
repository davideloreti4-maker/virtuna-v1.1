/**
 * hero-constants.ts — the single source of truth for the signature "crowd → score"
 * moment. Consumed by BOTH `composed-still.tsx` (the SSR floor, 02-03) and
 * `signature-canvas.tsx` (the bespoke canvas-2D play, 02-02) so the still and the
 * animation share one score, one geometry, one timing/palette budget.
 *
 * Token rule (Phase-1 D-06, UI-SPEC §Color): NO hardcoded hex in components.
 * Values here mirror the verified `@theme` tokens in `src/app/globals.css`, with
 * comments citing each token name. Components reference the CSS-var token strings;
 * the canvas reads the resolved values via `getComputedStyle` or mirrors them.
 */

/**
 * The canned resolved virality score. MUST be >= BAND_THRESHOLDS.STRONG (70,
 * `src/components/board/verdict/verdict-constants.ts`) so that rendering it in
 * coral as a "will pop" outcome is TRUTHFUL, not a fabricated-green
 * (UI-SPEC §Color "Score-honesty constraint"; A2). High-80s per the spec lean.
 */
export const HERO_SCORE = 87;

/**
 * Desktop particle budget — 300–500, never >600 (UI-SPEC §Particle budget).
 * The 02-02 canvas generates this many start positions once at module scope.
 */
export const PARTICLE_COUNT_DESKTOP = 420;

/**
 * Moment timing budget in milliseconds — the whole play is <=3.5s (UI-SPEC).
 * settle: the field eases into formation; reaction: the coral pulse ripples;
 * coalesce: the crowd flows inward into the ring; total: hard ceiling.
 */
export const TIMING = {
  settle: 550,
  reaction: 800,
  coalesce: 1200,
  total: 3500,
} as const;

/**
 * Clean SVG arc-ring geometry (re-derived from ViralScoreRing, glow/tiers/white
 * stripped). radius = (RING_SIZE - RING_STROKE) / 2; the still and the animated
 * ring MUST use these identical values so the canvas→still handoff is pixel-exact.
 */
export const RING_SIZE = 240;
export const RING_STROKE = 12;

/**
 * Easing token NAMES (string constants) for the 02-02 canvas (globals.css:188-189).
 * coalesce → --ease-out-quart (calm inward arrival, NO spring overshoot);
 * reaction wave → --ease-out-cubic.
 */
export const EASING = {
  coalesce: "--ease-out-quart", // cubic-bezier(0.165, 0.84, 0.44, 1)
  reaction: "--ease-out-cubic", // cubic-bezier(0.215, 0.61, 0.355, 1)
} as const;

/**
 * Palette references (token names) — base field is charcoal/cream only; coral is
 * the LONE reaction accent (D-02 allowlist). The 02-02 canvas lerps base → accent
 * on the reaction crest, then eases back as the stream coalesces inward.
 */
export const PALETTE = {
  baseDots: ["--color-cream-secondary", "--color-cream-muted"], // #c2bdb4 / #8a857c, low alpha
  depthChips: "--color-charcoal-chip", // #2f2e2b — depth in the settled field
  reaction: "--color-accent", // coral-500 — the only accent
} as const;
