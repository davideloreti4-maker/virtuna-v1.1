"use client";

import { cn } from "@/lib/utils";
import { type CSSProperties } from "react";
import { colorMap, type GradientColor } from "./GradientGlow";

export interface GradientMeshProps {
  /** Array of gradient colors to blend (2-4 colors recommended) */
  colors: GradientColor[];
  /** Overall intensity of the mesh */
  intensity?: "subtle" | "medium" | "strong";
  /** Animate the mesh (slow flowing movement) */
  animate?: boolean;
  /** Additional className */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
}

// Preset positions for mesh blobs based on count
const positionPresets: Record<number, Array<{ x: string; y: string; size: number }>> = {
  2: [
    { x: "20%", y: "30%", size: 500 },
    { x: "80%", y: "70%", size: 600 },
  ],
  3: [
    { x: "15%", y: "25%", size: 450 },
    { x: "75%", y: "20%", size: 400 },
    { x: "50%", y: "80%", size: 550 },
  ],
  4: [
    { x: "20%", y: "20%", size: 400 },
    { x: "80%", y: "25%", size: 450 },
    { x: "25%", y: "75%", size: 500 },
    { x: "75%", y: "80%", size: 400 },
  ],
};

const intensityMap: Record<string, number> = {
  subtle: 0.2,
  medium: 0.35,
  strong: 0.5,
};

/**
 * GradientMesh - Multi-color flowing gradient background.
 *
 * Creates an ambient mesh of multiple gradient glows that blend together,
 * similar to the backgrounds in iOS 26 and premium crypto/finance dashboards.
 *
 * @example
 * // Two-color mesh
 * <div className="relative min-h-screen">
 *   <GradientMesh colors={["purple", "blue"]} intensity="medium" />
 *   <div className="relative z-10">Content here</div>
 * </div>
 *
 * @example
 * // Animated three-color mesh
 * <GradientMesh colors={["purple", "pink", "cyan"]} animate />
 */
export function GradientMesh({
  colors,
  intensity = "medium",
  animate = false,
  className,
  style,
}: GradientMeshProps) {
  // Limit to 4 colors
  const limitedColors = colors.slice(0, 4);
  const positions = positionPresets[limitedColors.length] ?? positionPresets[2]!;
  const opacityValue = intensityMap[intensity];

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
      style={style}
      aria-hidden="true"
    >
      {limitedColors.map((color, index) => {
        const pos = positions[index]!;
        const colorValue = colorMap[color];
        // Stagger animation delay for each blob
        const animationDelay = animate ? `${index * 2}s` : undefined;

        return (
          <div
            key={`${color}-${index}`}
            className={cn(
              "absolute rounded-full",
              animate && "animate-glow-drift"
            )}
            style={{
              left: pos.x,
              top: pos.y,
              width: pos.size,
              height: pos.size,
              background: `radial-gradient(circle, ${colorValue} 0%, transparent 70%)`,
              opacity: opacityValue,
              filter: "blur(80px)",
              transform: "translate(-50%, -50%)",
              animationDelay,
            }}
          />
        );
      })}
    </div>
  );
}
