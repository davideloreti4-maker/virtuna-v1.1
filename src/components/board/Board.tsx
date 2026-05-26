'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useBoardStore } from '@/stores/board-store';
import type { BoardMachineState } from '@/stores/board-store';
import { useCamera } from './use-camera';
import { useBoardKeyboard } from './use-board-keyboard';
import { CameraOverlay } from './CameraOverlay';
import { GROUP_FRAMES } from './board-constants';
import { GroupFrame } from './GroupFrame';
import { GroupFrameOverlay } from './GroupFrameOverlay';
import type { GroupId } from './board-types';
import type { FrameVisualState } from './GroupFrame';

/**
 * Derives per-frame visual state from the board machine state.
 * Anti-virality treatment applies only to Verdict + Audience frames (UI-SPEC §State Machine Transitions).
 * Extended in plan 2.13 with panelReady mapping for per-panel streaming progress.
 */
function deriveFrameVisual(
  boardMachineState: BoardMachineState,
  frameId: GroupId,
): FrameVisualState {
  if (boardMachineState === 'idle' || boardMachineState === 'edit-input') return 'idle';
  if (boardMachineState === 'streaming') return 'streaming';
  // complete or anti-virality
  if (boardMachineState === 'anti-virality' && (frameId === 'verdict' || frameId === 'audience')) {
    return 'anti-virality';
  }
  return 'complete';
}

// CRITICAL: dynamic import with ssr:false (RESEARCH Pattern 1). Without ssr:false,
// react-konva touches `window` at module load and SSR throws.
const BoardCanvas = dynamic(
  () => import('./BoardCanvas').then((m) => ({ default: m.BoardCanvas })),
  { ssr: false, loading: () => <Skeleton className="absolute inset-0" /> },
);

export function Board() {
  const reducedMotion = usePrefersReducedMotion();

  // Board machine state for frame visual derivation (plan 2.2)
  const boardMachineState = useBoardStore((s) => s.boardState);

  // Per-frame expanded state (all start expanded; user collapses via chevron)
  const [expanded, setExpanded] = useState<Record<GroupId, boolean>>(() =>
    Object.fromEntries(GROUP_FRAMES.map((f) => [f.id, true])) as Record<GroupId, boolean>,
  );

  // Camera state from board-store (Plan 2.4). Replaces prior local useState.
  const camera = useBoardStore((s) => s.camera);
  const setCamera = useBoardStore((s) => s.setCamera);
  const activePreset = useBoardStore((s) => s.activePreset);
  const setActivePreset = useBoardStore((s) => s.setActivePreset);
  const userOverrideCameraFollow = useBoardStore((s) => s.userOverrideCameraFollow);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { goToPreset } = useCamera({
    camera, setCamera, viewport, activePreset, setActivePreset, reducedMotion,
  });

  useBoardKeyboard({ goToPreset });

  return (
    <div
      ref={wrapperRef}
      className="relative h-screen w-full overflow-hidden bg-background"
      role="application"
      aria-label="Analysis board"
    >
      <BoardCanvas
        camera={camera}
        setCamera={setCamera}
        onUserInteract={userOverrideCameraFollow}
        width={viewport.width}
        height={viewport.height}
      >
        {GROUP_FRAMES.map((layout) => (
          <GroupFrame
            key={layout.id}
            layout={layout}
            visual={deriveFrameVisual(boardMachineState, layout.id)}
          />
        ))}
      </BoardCanvas>

      {/* DOM overlay layer: title bars, ARIA, empty-state copy. pointer-events-none
          keeps Konva pan/zoom hit-test alive; individual overlays restore pointer-events-auto. */}
      <div className="pointer-events-none absolute inset-0">
        {GROUP_FRAMES.map((layout) => (
          <GroupFrameOverlay
            key={layout.id}
            layout={layout}
            camera={camera}
            visual={deriveFrameVisual(boardMachineState, layout.id)}
            expanded={expanded[layout.id]}
            onToggleExpanded={() => setExpanded((s) => ({ ...s, [layout.id]: !s[layout.id] }))}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>

      {/* DOM overlay slots (filled by plans 2.6 command bar, 2.7 input node, etc.) */}
      <CameraOverlay activePreset={activePreset} onSelect={goToPreset} />
    </div>
  );
}
