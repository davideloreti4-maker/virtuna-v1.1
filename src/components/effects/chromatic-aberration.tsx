"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Props for the ChromaticAberration component.
 */
export interface ChromaticAberrationProps {
  /** Content to apply the chromatic aberration effect to. */
  children: React.ReactNode;

  /**
   * Pixel offset for the RGB channel split.
   * Higher values create a more pronounced effect.
   * @default 1
   */
  offset?: number;

  /**
   * Opacity of the color channel shadows (0-1).
   * Keep low for subtle, premium results.
   * @default 0.15
   */
  intensity?: number;

  /** Additional CSS classes. */
  className?: string;

  /**
   * HTML element to render as.
   * Use "span" for inline text, "div" for block content.
   * @default "div"
   */
  as?: "div" | "span";
}

/**
 * Decorative chromatic aberration effect via CSS text-shadow RGB split.
 *
 * Applies a subtle red/cyan color fringe to text content, mimicking
 * the chromatic aberration seen in camera lenses. Best used sparingly
 * on glass surfaces for premium decorative headings — NOT on body text
 * or content that needs to be clearly readable.
 *
 * This is a purely decorative enhancement. The wrapped content remains
 * fully visible and accessible without the effect.
 *
 * @example
 * ```tsx
 * <GlassCard>
 *   <ChromaticAberration>
 *     <h2 className="text-2xl font-bold">Premium Feature</h2>
 *   </ChromaticAberration>
 * </GlassCard>
 * ```
 *
 * @example
 * ```tsx
 * // Inline span with custom offset
 * <ChromaticAberration as="span" offset={2} intensity={0.2}>
 *   Glitch Text
 * </ChromaticAberration>
 * ```
 */
function ChromaticAberration({
  children,
  offset = 1,
  intensity = 0.15,
  className,
  as: Component = "div",
}: ChromaticAberrationProps): React.JSX.Element {
  return (
    <Component
      className={cn(className)}
      style={{
        textShadow: `-${offset}px 0 rgba(255, 0, 0, ${intensity}), ${offset}px 0 rgba(0, 255, 255, ${intensity})`,
      }}
    >
      {children}
    </Component>
  );
}

ChromaticAberration.displayName = "ChromaticAberration";

export { ChromaticAberration };
