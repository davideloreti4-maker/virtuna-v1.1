'use client';
import { Node } from './Node';
import { NodeOverlay } from './NodeOverlay';
import { useBoardStore } from '@/stores/board-store';
import { INPUT_NODE_BOUNDS } from './board-constants';
import { InputResultCard } from './InputResultCard';
import type { Camera, NodeSpec } from './board-types';
import type { BehavioralPredictions } from '@/lib/engine/types';

interface Props {
  camera: Camera;
  videoStoragePath: string | null;
  videoUrl?: string | null;
  thumbnailUrl: string | null;
  behavioral: BehavioralPredictions | null;
  isStreaming?: boolean;
}

const SPEC: NodeSpec = {
  id: 'input-node',
  groupId: 'input',
  bounds: INPUT_NODE_BOUNDS,
  ariaLabel: 'Uploaded video with predicted engagement',
};

/** Konva-side shape — rendered as a Layer child inside BoardCanvas. */
export function InputNodeShape({ selected }: { selected: boolean }) {
  return <Node spec={SPEC} status="idle" selected={selected} />;
}

/**
 * DOM-side overlay body — renders the vertical TikTok-style result card
 * showing the uploaded video and predicted engagement metrics. Editing the
 * input happens exclusively via the bottom command bar.
 */
export function InputNodeOverlay({
  camera,
  videoStoragePath,
  videoUrl,
  thumbnailUrl,
  behavioral,
  isStreaming,
}: Props) {
  const selected = useBoardStore((s) => s.selectedNodeId === SPEC.id);

  return (
    <NodeOverlay spec={SPEC} camera={camera} status="idle" selected={selected}>
      <InputResultCard
        videoStoragePath={videoStoragePath}
        videoUrl={videoUrl}
        thumbnailUrl={thumbnailUrl}
        behavioral={behavioral}
        isStreaming={isStreaming}
      />
    </NodeOverlay>
  );
}
