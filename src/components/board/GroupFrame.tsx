'use client';
import { Group, Rect } from 'react-konva';
import type { GroupFrameLayout } from './board-types';
import { FRAME_CORNER_RADIUS } from './board-constants';

export type FrameVisualState = 'idle' | 'streaming' | 'complete' | 'anti-virality';

interface Props {
  layout: GroupFrameLayout;
  visual: FrameVisualState;
}

const STYLE: Record<FrameVisualState, { stroke: string; fillOpacity: number; strokeWidth: number }> = {
  'idle':          { stroke: 'rgba(255,255,255,0.06)', fillOpacity: 1.00, strokeWidth: 1 },
  'streaming':     { stroke: 'rgba(255,255,255,0.10)', fillOpacity: 1.00, strokeWidth: 1 },
  'complete':      { stroke: 'rgba(255,255,255,0.06)', fillOpacity: 1.00, strokeWidth: 1 },
  'anti-virality': { stroke: 'rgba(255,148,0,0.30)',   fillOpacity: 1.00, strokeWidth: 1.5 },
};

export function GroupFrame({ layout, visual }: Props) {
  const s = STYLE[visual];
  // surface = #18191a (Raycast design language per CLAUDE.md) — Konva needs rgba with opacity
  const fill = `rgba(24, 25, 26, ${s.fillOpacity})`;
  const height = layout.bounds.height;
  return (
    <Group x={layout.bounds.x} y={layout.bounds.y}>
      <Rect
        width={layout.bounds.width}
        height={height}
        cornerRadius={FRAME_CORNER_RADIUS}
        fill={fill}
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        perfectDrawEnabled={false}
        listening={true}
      />
    </Group>
  );
}
