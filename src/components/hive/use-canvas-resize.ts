'use client';

// ---------------------------------------------------------------------------
// use-canvas-resize.ts -- ResizeObserver + DPR canvas hook for retina displays
// ---------------------------------------------------------------------------

import { useEffect, useRef, type RefObject } from 'react';

import type { CanvasSize } from './hive-types';

// ---------------------------------------------------------------------------
// useCanvasResize
// ---------------------------------------------------------------------------

/**
 * Manages canvas buffer dimensions for crisp retina/HiDPI rendering.
 *
 * Sets `canvas.width` / `canvas.height` (the backing store) to device-pixel
 * resolution using a ResizeObserver with a DPR fallback chain:
 *
 *   1. `devicePixelContentBoxSize` (Chrome/Edge) -- already device pixels, dpr=1
 *   2. `contentBoxSize` * `window.devicePixelRatio` (Safari >=15.4)
 *   3. `contentRect` * `window.devicePixelRatio` (legacy fallback)
 *
 * Does NOT set CSS width/height -- the parent component controls sizing via
 * Tailwind classes. Only the buffer (backing store) dimensions are managed.
 *
 * @param canvasRef - React ref to the canvas element
 * @param onResize  - Callback fired when canvas buffer size changes
 * @returns sizeRef - Ref holding current CanvasSize for synchronous reads
 */
export function useCanvasResize(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  onResize: (size: CanvasSize) => void,
): React.RefObject<CanvasSize> {
  const sizeRef = useRef<CanvasSize>({ width: 0, height: 0, dpr: 1 });

  // Store latest callback in a ref to avoid re-creating the observer when
  // the consumer's onResize function identity changes.
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        let width: number;
        let height: number;
        let dpr = window.devicePixelRatio || 1;

        // DPR fallback chain
        const dpBox = entry.devicePixelContentBoxSize?.[0];
        const cbBox = entry.contentBoxSize?.[0];

        if (dpBox) {
          // Best path: already in device pixels (Chrome/Edge)
          width = dpBox.inlineSize;
          height = dpBox.blockSize;
          dpr = 1; // dimensions are already device-pixel accurate
        } else if (cbBox) {
          // Safari >=15.4: CSS pixels, multiply by DPR
          width = cbBox.inlineSize * dpr;
          height = cbBox.blockSize * dpr;
        } else {
          // Legacy fallback: CSS pixels, multiply by DPR
          width = entry.contentRect.width * dpr;
          height = entry.contentRect.height * dpr;
        }

        const displayWidth = Math.round(width);
        const displayHeight = Math.round(height);

        // Only update if buffer size actually changed (avoid unnecessary redraws)
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;

          // CSS pixel dimensions for the caller
          const actualDpr = window.devicePixelRatio || 1;
          const cssWidth = displayWidth / actualDpr;
          const cssHeight = displayHeight / actualDpr;

          sizeRef.current = { width: cssWidth, height: cssHeight, dpr: actualDpr };
          onResizeRef.current(sizeRef.current);
        }
      }
    });

    // Prefer device-pixel-content-box observation (Chrome/Edge), fall back to
    // content-box (Safari/Firefox) if not supported.
    try {
      observer.observe(canvas, { box: 'device-pixel-content-box' as ResizeObserverBoxOptions });
    } catch {
      observer.observe(canvas, { box: 'content-box' });
    }

    return () => observer.disconnect();
  }, [canvasRef]);

  return sizeRef;
}
