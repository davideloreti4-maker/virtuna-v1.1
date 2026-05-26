import type { GroupFrameLayout, Rect } from './board-types';

export const FRAME_PADDING = 16;
export const GUTTER = 96;
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
 * World-space gaps: minimum 96px between every adjacent frame edge.
 * UAT gap 1 (2026-05-26): user reported the prior 32px GUTTER read as a
 * packed CSS grid, not an infinite canvas. Increasing horizontal gaps to
 * 96px and vertical gaps to 96px between rows restores the spatial-canvas
 * affordance while preserving D-06 reading order.
 */
export const GROUP_FRAMES: GroupFrameLayout[] = [
  { id: 'input',            label: 'Input',            bounds: { x:    0, y:    0, width:  240, height: 160 } },
  { id: 'engine',           label: 'Engine',           bounds: { x:    0, y:  256, width:  240, height: 320 } },
  { id: 'audience',         label: 'Audience',         bounds: { x:  336, y:    0, width:  560, height: 576 } },
  { id: 'verdict',          label: 'Verdict',          bounds: { x:  992, y:    0, width:  360, height: 280 } },
  { id: 'actions',          label: 'Actions',          bounds: { x:  992, y:  376, width:  360, height: 200 } },
  { id: 'content-analysis', label: 'Content Analysis', bounds: { x:    0, y:  672, width: 1352, height: 200 } },
];

export const BOARD_BOUNDS: Rect = (() => {
  const right = Math.max(...GROUP_FRAMES.map((f) => f.bounds.x + f.bounds.width));
  const bottom = Math.max(...GROUP_FRAMES.map((f) => f.bounds.y + f.bounds.height));
  return { x: 0, y: 0, width: right, height: bottom };
})();

/** UI-SPEC §Input Node: 200x100 desktop canvas units, sits inside the Input frame body. */
export const INPUT_NODE_BOUNDS = {
  x: 16,                          // FRAME_PADDING from group frame x=0
  y: 16 + TITLE_BAR_HEIGHT,       // below title bar, +FRAME_PADDING
  width: 200,
  height: 100,
} as const;

export const CAMERA_PRESET_TARGETS: Record<string, Rect> = {
  overview: BOARD_BOUNDS,
  // D-09: Wave 0/1 auto-pan target = Input + Engine column (Engine + Hook decomp area).
  // Internal-only preset — not user-facing in CameraOverlay.
  engine: { x: 0, y: 0, width: 240, height: 576 },
  // hero pair = Audience + Verdict union (D-07)
  verdict: { x: 336, y: 0, width: 1016, height: 576 },
  audience: GROUP_FRAMES.find((f) => f.id === 'audience')!.bounds,
  'content-analysis': GROUP_FRAMES.find((f) => f.id === 'content-analysis')!.bounds,
};
