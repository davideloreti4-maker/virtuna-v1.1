"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { cn } from "@/lib/utils";
import { VisualizationResetButton } from "./visualization-reset-button";
import { drawGlassOrb, calculateOrbRadius } from "./orb-renderer";
import type { OrbState } from "@/lib/visualization-types";

interface ProgressiveVisualizationProps {
  className?: string;
  state?: OrbState;
}

/**
 * ProgressiveVisualization - Canvas-based visualization with pan/zoom support
 *
 * Phase 20: Central orb with glass effect and pan/zoom infrastructure
 * - Canvas 2D for orb rendering with radial gradients
 * - Pan/zoom via react-zoom-pan-pinch
 * - Responsive canvas with ResizeObserver
 * - Crisp retina display support via devicePixelRatio
 */
export function ProgressiveVisualization({
  className,
  state = 'idle'
}: ProgressiveVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasTransformed, setHasTransformed] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Track when user has moved the view
  const handleTransform = useCallback(() => {
    if (!hasTransformed) {
      setHasTransformed(true);
    }
  }, [hasTransformed]);

  // Hide reset button when view is reset
  const handleReset = useCallback(() => {
    setHasTransformed(false);
  }, []);

  // Canvas setup with ResizeObserver pattern from NetworkVisualization
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();

      // Set canvas dimensions accounting for devicePixelRatio
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);

      setDimensions({ width: rect.width, height: rect.height });
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
    resizeCanvas();

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Draw orb on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Calculate orb position and size
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = calculateOrbRadius(dimensions.width, dimensions.height);

    // Draw the glass orb
    drawGlassOrb(ctx, centerX, centerY, radius, 1);
  }, [dimensions, state]);

  return (
    <div ref={containerRef} className={cn("absolute inset-0 overflow-hidden", className)}>
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={3}
        centerOnInit={true}
        wheel={{ smoothStep: 0.05 }}
        panning={{ velocityDisabled: true }}
        pinch={{ disabled: false }}
        doubleClick={{ disabled: true }}
        onTransformed={handleTransform}
        onInit={handleReset}
      >
        {() => (
          <>
            <VisualizationResetButton visible={hasTransformed} />
            <TransformComponent
              wrapperClass="!w-full !h-full"
              contentClass="!w-full !h-full"
            >
              <canvas
                ref={canvasRef}
                className="w-full h-full"
                aria-label="AI visualization orb"
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
