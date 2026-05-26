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
  | 'content-analysis';

export type CameraPresetKey =
  | 'overview'
  | 'verdict'
  | 'audience'
  | 'content-analysis';

export interface GroupFrameLayout {
  id: GroupId;
  label: string;
  bounds: Rect;          // world-space rectangle of the frame
  childPositions?: Rect[]; // optional inner child slots; resolved in plans 2.7+/2.13+
}
