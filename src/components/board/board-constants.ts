import type { GroupFrameLayout, Rect } from './board-types';

export const FRAME_PADDING = 16;
export const GUTTER = 32;
export const TITLE_BAR_HEIGHT = 36;
export const FRAME_CORNER_RADIUS = 12;
export const CAMERA_MIN_SCALE = 0.2;
export const CAMERA_MAX_SCALE = 4;
export const CAMERA_DEFAULT_SCALE = 1;

/**
 * D-06 spatial layout — deterministic, identical phone and desktop.
 * Layout reads left→right, top→bottom:
 *   Input (top-left, compact) + Engine (under Input, compact)
 *   Audience (large central centerpiece)
 *   Verdict (large hero, right column) + Actions (tall, fills right column)
 *   Content Analysis (lower-left+center block, under Input/Engine+Audience)
 *
 * Phase 3 re-space: Content Analysis moved UP from a full-width footer (y904)
 * into the lower-left+center void (x0..832, under the short Input/Engine column
 * and Audience), and Actions grown so the right column reaches the same bottom
 * (1072) — killing the ~328px lower-left dead space without a far-bottom strip.
 *
 * World-space gaps: 32px between every adjacent frame edge.
 */
export const GROUP_FRAMES: GroupFrameLayout[] = [
  { id: 'input',            label: 'Input',            bounds: { x:    0, y:    0, width:  240, height: 440 } },
  // Engine grown to fill the left column down to the Audience/CA bottom line
  // (472 + 328 = 800): the 9:16 Input card caps the column's top half, so the
  // Engine pipeline stepper now fills the rest — killing the lower-left void.
  { id: 'engine',           label: 'Engine',           bounds: { x:    0, y:  472, width:  240, height: 328 } },
  { id: 'audience',         label: 'Audience',         bounds: { x:  272, y:    0, width:  560, height: 800 } },
  { id: 'verdict',          label: 'Score',            bounds: { x:  864, y:    0, width:  360, height: 280 } },
  // Actions: tall hero column holding the inline reshoot script, "What to fix",
  // and "When to post" (all inline, no drawers). Grown to bottom 1072 so the
  // right column matches the Content Analysis block on the left (Phase 3).
  { id: 'actions',          label: 'Actions',          bounds: { x:  864, y:  312, width:  360, height: 760 } },
  // Lower-left+center block: top clears Audience (800) by the 32px gutter; right
  // edge (832) aligns with Audience; left edge fills under the short Input/Engine
  // column. Right edge clears the Actions column (x864) by 32px.
  { id: 'content-analysis', label: 'Content Analysis', bounds: { x:    0, y:  832, width:  832, height: 240 } },
];

export const BOARD_BOUNDS: Rect = (() => {
  const right = Math.max(...GROUP_FRAMES.map((f) => f.bounds.x + f.bounds.width));
  const bottom = Math.max(...GROUP_FRAMES.map((f) => f.bounds.y + f.bounds.height));
  return { x: 0, y: 0, width: right, height: bottom };
})();

/** Input node sits inside the Input frame body and holds the vertical
 *  TikTok-style result card (video + predicted engagement metrics overlaid).
 *  Frame is 240×440; node fills body minus 16px padding on each side.
 *  Result: 208×376 — close to a 9:16 aspect (208 × 16/9 ≈ 370). */
export const INPUT_NODE_BOUNDS = {
  x: 16,                          // FRAME_PADDING from group frame x=0
  y: 16 + TITLE_BAR_HEIGHT,       // below title bar, +FRAME_PADDING
  width: 208,                     // 240 - 2*16
  height: 376,                    // 440 - 32 (title) - 2*16
} as const;

export const CAMERA_PRESET_TARGETS: Record<string, Rect> = {
  overview: BOARD_BOUNDS,
  // D-09: Wave 0/1 auto-pan target = Input + Engine column (Engine + Hook decomp area).
  // Internal-only preset — not user-facing in CameraOverlay. Height tracks the
  // grown Engine frame (bottom 800) so the preset still frames the full column.
  engine: { x: 0, y: 0, width: 240, height: 800 },
  // hero pair = Audience + Verdict union (D-07). Height tracks the taller
  // Audience frame so the preset still frames both.
  verdict: { x: 272, y: 0, width: 952, height: 800 },
  audience: GROUP_FRAMES.find((f) => f.id === 'audience')!.bounds,
  'content-analysis': GROUP_FRAMES.find((f) => f.id === 'content-analysis')!.bounds,
};
