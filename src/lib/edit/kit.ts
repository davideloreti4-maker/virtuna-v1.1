/**
 * kit.ts — the closed lists an edit may name, and where each lives in the kit.
 *
 * The kit is the set of static files every film needs (`public/edit-kit/v1/`): the text page, the
 * font, the wipes and the sound effects. This file is versioned WITH the kit: once an edit has
 * been rendered with a kit version, no value here changes for that version. A new look is `v2`.
 *
 * Spec: docs/superpowers/specs/2026-11-11-edit-format-design.md §3.5 and §5.6.
 */
export const KIT = "v1" as const;
/** Where the kit sits inside a film folder. */
export const KIT_DIR = `kit/${KIT}` as const;

/** Whole-clip looks, as CSS filter strings. */
export const FILTERS = {
  vivid: "saturate(1.25) contrast(1.06)",
  warm: "sepia(.18) saturate(1.12)",
  cool: "hue-rotate(-10deg) saturate(1.06) brightness(1.02)",
  mono: "grayscale(1) contrast(1.08)",
  fade: "contrast(.9) brightness(1.06) saturate(.85)",
  punch: "contrast(1.18) saturate(1.1)",
} as const;
export type FilterId = keyof typeof FILTERS;
export const FILTER_IDS = Object.keys(FILTERS) as [FilterId, ...FilterId[]];

/**
 * Wipes: pages of OpenFilm's bundled library (CC0), copied unchanged to `wipes/<id>.html`. Each
 * draws itself for a fixed length and covers the cut at its middle. `tint`: whether the page
 * reads a `--color`.
 */
export const WIPES = {
  "swipe-blur": { frames: 18, tint: true },
  glitch: { frames: 18, tint: false },
  "flare-whip": { frames: 21, tint: false },
  shutter: { frames: 24, tint: true },
  "rgb-split": { frames: 18, tint: false },
  datamosh: { frames: 21, tint: false },
} as const;
export type WipeId = keyof typeof WIPES;
export const WIPE_IDS = Object.keys(WIPES) as [WipeId, ...WipeId[]];

/** How a text comes in or goes out. Drawn by the text page from the film time, 9 frames each. */
export const MOTION_IDS = ["pop", "fade", "rise"] as const;
export type MotionId = (typeof MOTION_IDS)[number];

export const FONTS = {
  inter: { family: "inter", file: "fonts/inter-latin-wght.woff2" },
} as const;
export type FontId = keyof typeof FONTS;
export const FONT_IDS = Object.keys(FONTS) as [FontId, ...FontId[]];

/** The bundled sound effects, at `sfx/<name>.m4a` (OpenFilm's library, CC0). */
export const SFX = [
  "boom", "buzz", "click", "ding", "drop", "heartbeat", "hit", "kick", "notify", "pop",
  "rain", "riser", "shutter", "swish", "tick", "typing", "whoosh-low", "whoosh", "wind", "zap",
] as const;
export type SfxId = (typeof SFX)[number];
