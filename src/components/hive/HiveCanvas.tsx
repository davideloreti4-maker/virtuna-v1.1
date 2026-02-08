'use client';

// ---------------------------------------------------------------------------
// HiveCanvas.tsx -- Main canvas component for hive visualization
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { ArrowsIn } from '@phosphor-icons/react';

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

import { MAX_ZOOM, MIN_ZOOM, ZOOM_SENSITIVITY } from './hive-constants';
import { computeHiveLayout } from './hive-layout';
import { renderHive, renderSkeletonHive } from './hive-renderer';
import type { Camera, HiveData, LayoutResult } from './hive-types';
import { HiveNodeOverlay } from './HiveNodeOverlay';
import { useCanvasResize } from './use-canvas-resize';
import { useHiveAnimation } from './use-hive-animation';
import { useHiveInteraction } from './use-hive-interaction';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<LayoutResult | null>(null);
  const cameraRef = useRef<Camera>({ zoom: 1, panX: 0, panY: 0 });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

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

    // Apply camera zoom/pan (centered on canvas middle)
    const cam = cameraRef.current;
    ctx.translate(cssWidth / 2 + cam.panX, cssHeight / 2 + cam.panY);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cssWidth / 2, -cssHeight / 2);

    if (layoutRef.current) {
      renderHive(
        ctx,
        layoutRef.current,
        cssWidth,
        cssHeight,
        animation.visibility,
        interactionRef.current,
      );
    } else {
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

  // ---- Interaction hook ----
  const interaction = useHiveInteraction({
    canvasRef,
    layout,
    cameraRef,
    sizeRef,
    render,
  });
  const { interactionRef } = interaction;

  // ---- Re-render on layout change (initial render + data swap) ----
  useEffect(() => {
    render();
  }, [layout, render]);

  // ---- Zoom (wheel) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = cameraRef.current;

      // Get cursor position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const { width: cssWidth, height: cssHeight } = sizeRef.current;

      // Point in world space before zoom
      const worldX = (cursorX - cssWidth / 2 - cam.panX) / cam.zoom + cssWidth / 2;
      const worldY = (cursorY - cssHeight / 2 - cam.panY) / cam.zoom + cssHeight / 2;

      // Apply zoom
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.zoom * (1 + delta)));

      // Adjust pan so the point under the cursor stays fixed
      cam.panX = cursorX - cssWidth / 2 - (worldX - cssWidth / 2) * newZoom;
      cam.panY = cursorY - cssHeight / 2 - (worldY - cssHeight / 2) * newZoom;
      cam.zoom = newZoom;

      render();
      interaction.onCameraChange();
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [render, interaction]);

  // ---- Pan (mouse drag) ----
  // NOTE: This will be migrated into the interaction hook in Task 2b.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // left click only
      isDraggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      cameraRef.current.panX += dx;
      cameraRef.current.panY += dy;
      render();
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      canvas.style.cursor = 'grab';
    };

    canvas.style.cursor = 'grab';
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [render]);

  // ---- JSX ----
  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full', className)}
      style={{ overflow: 'hidden' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%', touchAction: 'none' }}
        aria-label="Hive visualization showing test content analysis"
        role="img"
      />
      {/* Overlay rendered when a node is selected */}
      {interaction.selectedNode && interaction.selectedNodeScreen && (
        <HiveNodeOverlay
          node={interaction.selectedNode}
          screenPosition={interaction.selectedNodeScreen}
          containerWidth={sizeRef.current.width}
          containerHeight={sizeRef.current.height}
          onClose={interaction.clearSelection}
        />
      )}
      {/* Reset/fit button */}
      {interaction.isCameraMoved && (
        <button
          onClick={interaction.resetCamera}
          className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.06] text-white/60 hover:text-white/90 hover:bg-white/[0.1] transition-all text-xs"
          aria-label="Reset zoom and pan"
        >
          <ArrowsIn size={14} />
          <span>Reset view</span>
        </button>
      )}
    </div>
  );
}
