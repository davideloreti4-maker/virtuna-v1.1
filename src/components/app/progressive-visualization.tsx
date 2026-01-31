"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { cn } from "@/lib/utils";
import { VisualizationResetButton } from "./visualization-reset-button";
import { drawGlassOrb, calculateOrbRadius } from "./orb-renderer";
import { useOrbAnimation } from "./use-orb-animation";
import type { OrbState } from "@/lib/visualization-types";

interface ProgressiveVisualizationProps {
  className?: string;
  state?: OrbState;
  onStateChange?: (state: OrbState) => void;
}

/**
 * ProgressiveVisualization - Animated orb with pan/zoom support
 *
 * Phase 20: Central orb with glass effect, animations, and pan/zoom
 * - Breathing animation (2-3s cycle) in idle state
 * - State transitions: idle -> gathering -> analyzing -> complete
 * - Hover/tap interaction feedback
 * - prefers-reduced-motion support
 */
export function ProgressiveVisualization({
  className,
  state = 'idle',
  onStateChange: _onStateChange
}: ProgressiveVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasTransformed, setHasTransformed] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Animation state from hook
  const { animationState, setIsHovered } = useOrbAnimation(state);

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

  // Animation loop - redraw orb with current animation state
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const baseRadius = calculateOrbRadius(dimensions.width, dimensions.height);

      // Apply animation state
      const scaledRadius = baseRadius * animationState.scale;

      // Save context for rotation
      ctx.save();

      // Apply rotation for analyzing state
      if (animationState.rotation !== 0) {
        ctx.translate(centerX, centerY);
        ctx.rotate(animationState.rotation);
        ctx.translate(-centerX, -centerY);
      }

      // Draw the glass orb with animated glow intensity
      drawGlassOrb(ctx, centerX, centerY, scaledRadius, animationState.glowIntensity);

      ctx.restore();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [dimensions, animationState]);

  // Mouse/touch handlers for interaction feedback
  const handlePointerEnter = useCallback(() => {
    setIsHovered(true);
  }, [setIsHovered]);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
  }, [setIsHovered]);

  const handleClick = useCallback(() => {
    // Brief glow boost on click/tap (handled via hover state for simplicity)
    setIsHovered(true);
    setTimeout(() => setIsHovered(false), 200);
  }, [setIsHovered]);

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
                className="w-full h-full cursor-pointer"
                aria-label="AI visualization orb"
                onPointerEnter={handlePointerEnter}
                onPointerLeave={handlePointerLeave}
                onClick={handleClick}
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
