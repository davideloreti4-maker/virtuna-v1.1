'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useCamera } from './use-camera';
import { useBoardKeyboard } from './use-board-keyboard';
import { CameraOverlay } from './CameraOverlay';
import type { Camera, CameraPresetKey } from './board-types';
import { CAMERA_DEFAULT_SCALE } from './board-constants';

// CRITICAL: dynamic import with ssr:false (RESEARCH Pattern 1). Without ssr:false,
// react-konva touches `window` at module load and SSR throws.
const BoardCanvas = dynamic(
  () => import('./BoardCanvas').then((m) => ({ default: m.BoardCanvas })),
  { ssr: false, loading: () => <Skeleton className="absolute inset-0" /> },
);

export function Board() {
  const reducedMotion = usePrefersReducedMotion();
  // Local camera state until plan 2.4 lands board-store. Once board-store
  // exists, swap these for `useBoardStore` selectors.
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: CAMERA_DEFAULT_SCALE });
  const [activePreset, setActivePreset] = useState<CameraPresetKey | null>(null);

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
      <BoardCanvas camera={camera} setCamera={setCamera} width={viewport.width} height={viewport.height}>
        {/* Group frames mount here from plan 2.2 */}
      </BoardCanvas>
      {/* DOM overlay slots (filled by plans 2.2 frame overlays, 2.6 command bar, 2.7 input node, etc.) */}
      <CameraOverlay activePreset={activePreset} onSelect={goToPreset} />
    </div>
  );
}
