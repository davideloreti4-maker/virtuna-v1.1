"use client";

import { useControls } from "react-zoom-pan-pinch";
import { RotateCcw } from "lucide-react";

interface VisualizationResetButtonProps {
  visible: boolean;
}

/**
 * VisualizationResetButton - Reset view button for pan/zoom visualization
 *
 * Uses react-zoom-pan-pinch's useControls hook to reset transform.
 * Only renders when visible prop is true (after user has transformed view).
 */
export function VisualizationResetButton({ visible }: VisualizationResetButtonProps) {
  const { resetTransform } = useControls();

  if (!visible) return null;

  return (
    <button
      onClick={() => resetTransform()}
      className="absolute top-4 right-4 z-10 p-2 rounded-lg glass-base glass-blur-sm opacity-80 hover:opacity-100 transition-opacity"
      aria-label="Reset view"
    >
      <RotateCcw className="w-4 h-4 text-text-secondary" />
    </button>
  );
}
