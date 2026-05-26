'use client';
import { Node } from './Node';
import { NodeOverlay } from './NodeOverlay';
import { useBoardStore } from '@/stores/board-store';
import { INPUT_NODE_BOUNDS } from './board-constants';
import type { Camera, NodeSpec } from './board-types';

interface Props {
  camera: Camera;
  thumbnailUrl?: string | null;
  snippet?: string | null;
}

const SPEC: NodeSpec = {
  id: 'input-node',
  groupId: 'input',
  bounds: INPUT_NODE_BOUNDS,
  ariaLabel: 'Edit analysis input',
};

/** Konva-side shape — rendered as a Layer child inside BoardCanvas. */
export function InputNodeShape({ selected }: { selected: boolean }) {
  const openInputDrawer = useBoardStore((s) => s.openInputDrawer);
  return (
    <Node spec={SPEC} status="idle" selected={selected}
          onTap={openInputDrawer} />
  );
}

/** DOM-side overlay body — rendered as DOM overlay sibling. */
export function InputNodeOverlay({ camera, thumbnailUrl, snippet }: Props) {
  const openInputDrawer = useBoardStore((s) => s.openInputDrawer);
  const selected = useBoardStore((s) => s.selectedNodeId === SPEC.id);

  return (
    <NodeOverlay spec={SPEC} camera={camera} status="idle" selected={selected} onTap={openInputDrawer}>
      <div className="flex h-full w-full items-center gap-2 p-3">
        <div
          className="size-[60px] shrink-0 overflow-hidden rounded-lg bg-white/[0.05]"
          aria-hidden
        >
          {thumbnailUrl && (
            // Plain img — Next/Image not used since the thumbnail URL is dynamic
            // and supabase storage signed; CSP is permissive for our supabase bucket.
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={thumbnailUrl} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-semibold text-foreground">Input</span>
          <span className="line-clamp-2 text-sm text-foreground-secondary">
            {snippet ?? 'Paste URL, drop file, or describe in command bar'}
          </span>
        </div>
      </div>
    </NodeOverlay>
  );
}
