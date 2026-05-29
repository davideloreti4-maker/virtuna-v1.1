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
 *   Verdict (large hero, right column) + Actions (below Verdict)
 *   Content Analysis (supporting row, beneath Audience+Verdict)
 *
 * World-space gaps: 32px between every adjacent frame edge.
 */
export const GROUP_FRAMES: GroupFrameLayout[] = [
  { id: 'input',            label: 'Input',            bounds: { x:    0, y:    0, width:  240, height: 440 } },
  { id: 'engine',           label: 'Engine',           bounds: { x:    0, y:  456, width:  240, height: 120 } },
  { id: 'audience',         label: 'Audience',         bounds: { x:  272, y:    0, width:  560, height: 800 } },
  { id: 'verdict',          label: 'Verdict',          bounds: { x:  864, y:    0, width:  360, height: 280 } },
  // Actions is now a tall hero column (560) holding the inline reshoot script,
  // the "What to fix" list, and "When to post" — all inline, no drawers. The
  // former AV-only 200→360 grow is gone; one height serves every state.
  { id: 'actions',          label: 'Actions',          bounds: { x:  864, y:  312, width:  360, height: 560 } },
  // Pushed below the taller Actions bottom (872) + 32px gutter.
  { id: 'content-analysis', label: 'Content Analysis', bounds: { x:    0, y:  904, width: 1224, height: 200 } },
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
  // Internal-only preset — not user-facing in CameraOverlay.
  engine: { x: 0, y: 0, width: 240, height: 576 },
  // hero pair = Audience + Verdict union (D-07). Height tracks the taller
  // Audience frame so the preset still frames both.
  verdict: { x: 272, y: 0, width: 952, height: 800 },
  audience: GROUP_FRAMES.find((f) => f.id === 'audience')!.bounds,
  'content-analysis': GROUP_FRAMES.find((f) => f.id === 'content-analysis')!.bounds,
};
