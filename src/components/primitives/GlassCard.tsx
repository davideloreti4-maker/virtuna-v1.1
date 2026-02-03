"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties } from "react";
import { GlassPanel, type GlassTint } from "./GlassPanel";
import { GradientGlow, type GradientColor } from "./GradientGlow";

export interface GlassCardProps {
  children: ReactNode;
  /** Color theme for the card (affects glow and optional tint) */
  color?: GradientColor;
  /** Apply subtle tint to the glass matching the color */
  tinted?: boolean;
  /** Show ambient glow behind the card */
  glow?: boolean;
  /** Glow intensity when glow is true */
  glowIntensity?: "subtle" | "medium" | "strong";
  /** Hover effect: none, lift, or glow-boost */
  hover?: "none" | "lift" | "glow-boost";
  /** Padding preset */
  padding?: "none" | "sm" | "md" | "lg";
  /** Additional className for the card */
  className?: string;
  /** Additional className for the content wrapper */
  contentClassName?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** Click handler */
  onClick?: () => void;
}

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

// Map GradientColor to GlassTint (they're the same values)
const colorToTint: Record<GradientColor, GlassTint> = {
  purple: "purple",
  blue: "blue",
  pink: "pink",
  cyan: "cyan",
  green: "green",
  orange: "orange",
};

/**
 * GlassCard - Premium card component with glass effect, ambient glow, and hover states.
 *
 * Combines GlassPanel and GradientGlow into a ready-to-use card component.
 * Perfect for feature cards, stats cards, and content containers.
 *
 * @example
 * // Basic glass card
 * <GlassCard padding="md">
 *   <h3>Feature Title</h3>
 *   <p>Description text</p>
 * </GlassCard>
 *
 * @example
 * // Card with color identity and glow
 * <GlassCard color="purple" glow tinted hover="glow-boost">
 *   <h3>AI Analysis</h3>
 * </GlassCard>
 *
 * @example
 * // Card with lift hover effect
 * <GlassCard color="blue" hover="lift" onClick={() => doSomething()}>
 *   <h3>Clickable Card</h3>
 * </GlassCard>
 */
export function GlassCard({
  children,
  color = "purple",
  tinted = false,
  glow = false,
  glowIntensity = "subtle",
  hover = "none",
  padding = "md",
  className,
  contentClassName,
  style,
  onClick,
}: GlassCardProps) {
  const isInteractive = hover !== "none" || onClick;

  return (
    <div
      className={cn(
        "group relative",
        isInteractive && "cursor-pointer",
        className
      )}
      style={style}
      onClick={onClick}
    >
      {/* Ambient glow behind the card */}
      {glow && (
        <GradientGlow
          color={color}
          intensity={glowIntensity}
          size={300}
          position="center"
          blur={60}
          className={cn(
            "transition-opacity duration-300",
            hover === "glow-boost" && "group-hover:opacity-150"
          )}
        />
      )}

      {/* Glass card */}
      <GlassPanel
        blur="md"
        opacity={0.6}
        borderGlow
        tint={tinted ? colorToTint[color] : "neutral"}
        innerGlow={tinted ? 0.3 : 0}
        className={cn(
          "relative z-10 transition-all duration-300",
          // Hover effects
          hover === "lift" && "group-hover:-translate-y-1 group-hover:shadow-float",
          hover === "glow-boost" && "group-hover:shadow-elevated",
          paddingMap[padding],
          contentClassName
        )}
      >
        {children}
      </GlassPanel>
    </div>
  );
}
