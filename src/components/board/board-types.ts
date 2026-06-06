/** World-space rectangle. All coordinates are device-independent canvas units. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export type GroupId =
  | 'input'
  | 'engine'
  | 'audience'
  | 'verdict'
  | 'actions'
  | 'content-analysis'
  | 'decode'
  | 'adapt'
  | 'insight-hero';  // D-08: Apollo insight hero frame (Plan 05-03)

export type CameraPresetKey =
  | 'overview'
  | 'engine'           // D-09 alignment for plan 2.13 auto-pan (internal-only, not user-facing)
  | 'verdict'
  | 'audience'
  | 'content-analysis';

export interface GroupFrameLayout {
  id: GroupId;
  label: string;
  bounds: Rect;          // world-space rectangle of the frame
  childPositions?: Rect[]; // optional inner child slots; resolved in plans 2.7+/2.13+
}

export type NodeStatus = 'idle' | 'pending' | 'streaming' | 'complete' | 'error';

export interface NodeSpec {
  id: string;                // unique node id
  groupId: GroupId;          // which group container this node lives inside
  bounds: Rect;              // world-space rectangle (absolute, NOT relative to group)
  ariaLabel: string;         // screen-reader label
  tabIndex?: 0 | -1;         // explicit tab order; positive values disrupt natural tab order (WR-06)
}
