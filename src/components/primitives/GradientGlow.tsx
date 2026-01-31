"use client";

import { cn } from "@/lib/utils";
import { type CSSProperties } from "react";

/** Available gradient colors from the palette */
export type GradientColor = "purple" | "blue" | "pink" | "cyan" | "green" | "orange";

export interface GradientGlowProps {
  /** Primary gradient color */
  color: GradientColor;
  /** Glow intensity: subtle (15%), medium (30%), strong (50%) */
  intensity?: "subtle" | "medium" | "strong";
  /** Size of the glow effect in pixels or CSS value */
  size?: number | string;
  /** Position: centered, top, bottom, or custom */
  position?: "center" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Blur amount for the glow (default 100px) */
  blur?: number;
  /** Additional className */
  className?: string;
  /** Animate the glow (subtle pulse) */
  animate?: boolean;
}

// Map color names to oklch values from design tokens
const colorMap: Record<GradientColor, string> = {
  purple: "oklch(0.63 0.24 300)",
  blue: "oklch(0.62 0.19 250)",
  pink: "oklch(0.66 0.22 350)",
  cyan: "oklch(0.72 0.15 200)",
  green: "oklch(0.68 0.17 145)",
  orange: "oklch(0.70 0.18 50)",
};

// Map intensity to opacity values
const intensityMap: Record<string, number> = {
  subtle: 0.15,
  medium: 0.3,
  strong: 0.5,
};

// Map position to CSS positioning
const positionMap: Record<string, CSSProperties> = {
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
  top: { top: "0", left: "50%", transform: "translateX(-50%)" },
  bottom: { bottom: "0", left: "50%", transform: "translateX(-50%)" },
  "top-left": { top: "0", left: "0" },
  "top-right": { top: "0", right: "0" },
  "bottom-left": { bottom: "0", left: "0" },
  "bottom-right": { bottom: "0", right: "0" },
};

/**
 * GradientGlow - Ambient lighting effect component.
 *
 * Creates a blurred radial gradient that acts as ambient lighting behind content.
 * Used to add color identity and depth to glassmorphism designs.
 *
 * @example
 * <div className="relative">
 *   <GradientGlow color="purple" intensity="medium" position="top-right" />
 *   <GlassPanel>Content here</GlassPanel>
 * </div>
 */
export function GradientGlow({
  color,
  intensity = "medium",
  size = 400,
  position = "center",
  blur = 100,
  className,
  animate = false,
}: GradientGlowProps) {
  const colorValue = colorMap[color];
  const opacityValue = intensityMap[intensity];
  const positionStyle = positionMap[position];
  const sizeValue = typeof size === "number" ? `${size}px` : size;

  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-full",
        animate && "animate-pulse",
        className
      )}
      style={{
        width: sizeValue,
        height: sizeValue,
        background: `radial-gradient(circle, ${colorValue} 0%, transparent 70%)`,
        opacity: opacityValue,
        filter: `blur(${blur}px)`,
        ...positionStyle,
      }}
      aria-hidden="true"
    />
  );
}
