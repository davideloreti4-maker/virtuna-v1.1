'use client';
/**
 * AdaptShellNode — DOM shell mount for the Adapt frame in remix mode.
 *
 * Phase 4: replaces the descriptor <p> body with AdaptFrameBody (ADAPT-01/02).
 * Keeps: 'use client', data-testid="adapt-shell", outer div className.
 *
 * DOM component (returns <div>), NOT a Konva node (RESEARCH Pattern 1 / Pitfall 1).
 */
import { AdaptFrameBody } from './AdaptFrameBody';
import type { Camera, GroupFrameLayout } from '../board-types';

interface AdaptShellNodeProps {
  camera?: Camera;
  layout?: GroupFrameLayout;
}

const FALLBACK_CAMERA: Camera = { x: 0, y: 0, scale: 1 };

export function AdaptShellNode({ camera, layout }: AdaptShellNodeProps) {
  return (
    <div className="relative flex w-full flex-col gap-2" data-testid="adapt-shell">
      <AdaptFrameBody
        camera={camera ?? FALLBACK_CAMERA}
        layout={layout ?? ({ id: 'adapt', label: 'Adapt', bounds: { x: 0, y: 0, width: 400, height: 600 } } as GroupFrameLayout)}
      />
    </div>
  );
}
