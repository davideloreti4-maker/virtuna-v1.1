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
 */
export const GROUP_FRAMES: GroupFrameLayout[] = [
  { id: 'input',            label: 'Input',            bounds: { x:   0, y:    0, width: 240, height: 160 } },
  { id: 'engine',           label: 'Engine',           bounds: { x:   0, y:  192, width: 240, height: 320 } },
  { id: 'audience',         label: 'Audience',         bounds: { x: 272, y:    0, width: 560, height: 512 } },
  { id: 'verdict',          label: 'Verdict',          bounds: { x: 864, y:    0, width: 360, height: 280 } },
  { id: 'actions',          label: 'Actions',          bounds: { x: 864, y:  312, width: 360, height: 200 } },
  { id: 'content-analysis', label: 'Content Analysis', bounds: { x:   0, y:  544, width: 1224, height: 200 } },
];

export const BOARD_BOUNDS: Rect = (() => {
  const right = Math.max(...GROUP_FRAMES.map((f) => f.bounds.x + f.bounds.width));
  const bottom = Math.max(...GROUP_FRAMES.map((f) => f.bounds.y + f.bounds.height));
  return { x: 0, y: 0, width: right, height: bottom };
})();

export const CAMERA_PRESET_TARGETS: Record<string, Rect> = {
  overview: BOARD_BOUNDS,
  // D-09: Wave 0/1 auto-pan target = Input + Engine column (Engine + Hook decomp area).
  // Internal-only preset — not user-facing in CameraOverlay.
  engine: { x: 0, y: 0, width: 240, height: 512 },
  // hero pair = Audience + Verdict union (D-07)
  verdict: { x: 272, y: 0, width: 952, height: 280 },
  audience: GROUP_FRAMES.find((f) => f.id === 'audience')!.bounds,
  'content-analysis': GROUP_FRAMES.find((f) => f.id === 'content-analysis')!.bounds,
};
