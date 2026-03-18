'use client';

// ---------------------------------------------------------------------------
// HiveCanvas.tsx -- Main canvas component for hive visualization
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef } from 'react';

import { ArrowsIn } from '@phosphor-icons/react';

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/utils';

import { useSimulationStore } from '@/stores/simulation-store';
import { useTiktokAccounts } from '@/hooks/use-tiktok-accounts';

import { NODE_SIZES, MAX_ZOOM, MIN_ZOOM, ZOOM_SENSITIVITY } from './hive-constants';
import { computeHiveLayout, computeFitTransform } from './hive-layout';
import { worldToScreen } from './hive-interaction';
import { generateMockHiveData } from './hive-mock-data';
import { renderHive, renderSkeletonHive } from './hive-renderer';
import type { Camera, HiveData, LayoutResult, ParallaxOffset } from './hive-types';
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
// Helpers
// ---------------------------------------------------------------------------

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return hash;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HiveCanvas({ data, className }: HiveCanvasProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<LayoutResult | null>(null);
  const cameraRef = useRef<Camera>({ zoom: 1, panX: 0, panY: 0 });

  // ---- Simulation store (HIVE-5, HIVE-6) ----
  const nodeCount = useSimulationStore((s) => s.nodeCount);
  const videoSrc = useSimulationStore((s) => s.videoSrc);
  const thumbnailSrc = useSimulationStore((s) => s.thumbnailSrc);
  const analysisStatus = useSimulationStore((s) => s.analysisStatus);

  // ---- Account-aware seed for persona demographics ----
  const { activeAccount } = useTiktokAccounts();

  // ---- Dynamic data generation ----
  const generatedData = useMemo(
    () => generateMockHiveData({
      totalNodeCount: nodeCount,
      seed: activeAccount ? hashString(activeAccount.id) : 42,
    }),
    [nodeCount, activeAccount],
  );
  const effectiveData = data ?? generatedData;

  // ---- Layout computation (pure, memoized) ----
  const layout = useMemo(
    () => (effectiveData ? computeHiveLayout(effectiveData) : null),
    [effectiveData],
  );

  // Sync layout to ref for synchronous reads in render()
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // ---- Accessibility ----
  const reducedMotion = usePrefersReducedMotion();

  // ---- Parallax tracking (HIVE-2) ----
  const parallaxRef = useRef<ParallaxOffset>({ x: 0, y: 0 });
  const smoothParallaxRef = useRef<ParallaxOffset>({ x: 0, y: 0 });
  const parallaxActiveRef = useRef(false);
  const parallaxRafRef = useRef<number>(0);

  useEffect(() => {
    if (reducedMotion) return;
    // Skip on touch devices
    if (typeof window !== 'undefined' && 'ontouchstart' in window) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      parallaxRef.current = {
        x: (e.clientX - cx) / (rect.width / 2),
        y: (e.clientY - cy) / (rect.height / 2),
      };

      // Start parallax animation loop if not running
      if (!parallaxActiveRef.current) {
        parallaxActiveRef.current = true;
        const animateParallax = () => {
          const sp = smoothParallaxRef.current;
          const tp = parallaxRef.current;
          sp.x += (tp.x - sp.x) * 0.08;
          sp.y += (tp.y - sp.y) * 0.08;

          // Keep animating while there's meaningful difference
          const diff = Math.abs(sp.x - tp.x) + Math.abs(sp.y - tp.y);
          if (diff > 0.001) {
            render();
            parallaxRafRef.current = requestAnimationFrame(animateParallax);
          } else {
            parallaxActiveRef.current = false;
          }
        };
        parallaxRafRef.current = requestAnimationFrame(animateParallax);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (parallaxRafRef.current) cancelAnimationFrame(parallaxRafRef.current);
      parallaxActiveRef.current = false;
    };
    // render is stable (useCallback with [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

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
        smoothParallaxRef.current,
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
      {/* Video overlay for center rectangle (HIVE-5) */}
      {(videoSrc || thumbnailSrc) && layout && (() => {
        const { width: cw, height: ch } = sizeRef.current;
        if (cw <= 0 || ch <= 0) return null;
        const ft = computeFitTransform(layout.bounds, cw, ch);
        const cam = cameraRef.current;
        const center = worldToScreen(0, 0, cam, cw, ch, ft);
        const scaledW = NODE_SIZES.center.width * ft.scale * cam.zoom;
        const scaledH = NODE_SIZES.center.height * ft.scale * cam.zoom;
        return (
          <div
            className="absolute pointer-events-none overflow-hidden"
            style={{
              left: center.x - scaledW / 2,
              top: center.y - scaledH / 2,
              width: scaledW,
              height: scaledH,
              borderRadius: NODE_SIZES.center.borderRadius,
            }}
          >
            {analysisStatus === 'complete' && videoSrc ? (
              <video src={videoSrc} autoPlay muted loop playsInline
                className="w-full h-full object-cover" />
            ) : thumbnailSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnailSrc} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>
        );
      })()}
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
