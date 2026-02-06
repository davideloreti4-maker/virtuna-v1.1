'use client';

// ---------------------------------------------------------------------------
// HiveCanvas.tsx -- Main canvas component for hive visualization
// ---------------------------------------------------------------------------
//
// Wires together:
//   - computeHiveLayout (layout)
//   - renderHive / renderSkeletonHive (rendering)
//   - useCanvasResize (responsive retina)
//   - useHiveAnimation (progressive build reveal)
//   - usePrefersReducedMotion (accessibility)
//
// Data flow:
//   data -> useMemo(computeHiveLayout) -> layoutRef
//   useHiveAnimation -> visibility (ref-based, no React re-renders)
//   useCanvasResize -> sizeRef (buffer dimensions)
//   render() reads all refs synchronously on each frame
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

import { computeHiveLayout } from './hive-layout';
import { renderHive, renderSkeletonHive } from './hive-renderer';
import type { HiveData, LayoutResult } from './hive-types';
import { useCanvasResize } from './use-canvas-resize';
import { useHiveAnimation } from './use-hive-animation';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HiveCanvasProps {
  /** Hive tree data. Pass null to show skeleton loading state. */
  data: HiveData | null;
  /** Additional CSS classes for the canvas container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HiveCanvas({ data, className }: HiveCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<LayoutResult | null>(null);

  // ---- Layout computation (pure, memoized) ----
  const layout = useMemo(
    () => (data ? computeHiveLayout(data) : null),
    [data],
  );

  // Sync layout to ref for synchronous reads in render()
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // ---- Accessibility ----
  const reducedMotion = usePrefersReducedMotion();

  // ---- Render function (reads refs synchronously, no React state) ----
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width: cssWidth, height: cssHeight, dpr } = sizeRef.current;
    if (cssWidth <= 0 || cssHeight <= 0) return;

    // Clear full buffer
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply DPR scaling
    ctx.save();
    ctx.scale(dpr, dpr);

    if (layoutRef.current) {
      // Read current animation visibility from the hook's ref-backed getter
      renderHive(
        ctx,
        layoutRef.current,
        cssWidth,
        cssHeight,
        animation.visibility,
      );
    } else {
      // No data -- show skeleton loading state
      renderSkeletonHive(ctx, cssWidth, cssHeight);
    }

    ctx.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Canvas resize (ResizeObserver + DPR) ----
  const sizeRef = useCanvasResize(canvasRef, render);

  // ---- Animation hook ----
  const animation = useHiveAnimation({
    active: !!layout,
    reducedMotion,
    onFrame: render,
  });

  // ---- Re-render on layout change (initial render + data swap) ----
  useEffect(() => {
    render();
  }, [layout, render]);

  // ---- JSX ----
  return (
    <canvas
      ref={canvasRef}
      className={cn('w-full h-full', className)}
      style={{ width: '100%', height: '100%' }}
      aria-label="Hive visualization showing test content analysis"
      role="img"
    />
  );
}
