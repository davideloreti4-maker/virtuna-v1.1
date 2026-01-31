"use client";

import { useRef, useState, useCallback } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { cn } from "@/lib/utils";
import { VisualizationResetButton } from "./visualization-reset-button";

interface ProgressiveVisualizationProps {
  className?: string;
}

/**
 * ProgressiveVisualization - Canvas-based visualization with pan/zoom support
 *
 * Phase 20: Foundation component with orb placeholder
 * - Pan/zoom via react-zoom-pan-pinch (desktop drag + wheel, touch pinch + drag)
 * - Reset button appears after user moves view
 * - No momentum (direct control per CONTEXT.md)
 * - Min/max zoom limits: 0.5x to 3x (sensible defaults per RESEARCH.md)
 */
export function ProgressiveVisualization({ className }: ProgressiveVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasTransformed, setHasTransformed] = useState(false);

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

  return (
    <div ref={containerRef} className={cn("absolute inset-0 overflow-hidden", className)}>
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={3}
        centerOnInit={true}
        wheel={{ smoothStep: 0.05 }}
        panning={{ velocityDisabled: true }} // No momentum per CONTEXT.md
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
              contentClass="!w-full !h-full flex items-center justify-center"
            >
              {/* Placeholder for orb - will be replaced in 20-02 */}
              <div
                className="w-32 h-32 rounded-full bg-surface-elevated border border-border-glass"
                aria-label="Visualization orb placeholder"
              />
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
