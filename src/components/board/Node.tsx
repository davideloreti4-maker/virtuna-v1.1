'use client';
import { Group, Rect } from 'react-konva';
import type { NodeSpec, NodeStatus } from './board-types';
import { FRAME_CORNER_RADIUS } from './board-constants';

interface Props {
  spec: NodeSpec;
  status: NodeStatus;
  selected: boolean;
  onTap?: () => void;
}

const STATUS_STROKE: Record<NodeStatus, string> = {
  'idle':      'rgba(255,255,255,0.06)',
  'pending':   'rgba(255,255,255,0.06)',
  'streaming': 'rgba(255,255,255,0.10)',
  'complete':  'rgba(255,255,255,0.06)',
  'error':     'rgba(255,255,255,0.06)',
};

export function Node({ spec, status, selected, onTap }: Props) {
  return (
    <Group x={spec.bounds.x} y={spec.bounds.y}>
      <Rect
        width={spec.bounds.width}
        height={spec.bounds.height}
        cornerRadius={FRAME_CORNER_RADIUS - 4 /* 8px — UI-SPEC §Spacing thumbnail radius */}
        stroke={selected ? 'var(--color-foreground-secondary)' : STATUS_STROKE[status]}
        strokeWidth={selected ? 2 : 1}
        fill="transparent" // body is rendered in DOM overlay
        onClick={onTap}
        onTap={onTap}
        perfectDrawEnabled={false}
        // hit detection should respect the visible rect only
      />
    </Group>
  );
}
