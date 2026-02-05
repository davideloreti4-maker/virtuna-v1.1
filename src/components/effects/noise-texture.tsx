"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Props for the NoiseTexture component.
 */
export interface NoiseTextureProps {
  /**
   * Opacity of the noise overlay.
   * Keep very low for Raycast-style subtlety.
   * @default 0.03
   */
  opacity?: number;

  /**
   * Base frequency of the SVG feTurbulence noise pattern.
   * Higher values produce finer grain.
   * @default 0.65
   */
  baseFrequency?: number;

  /**
   * Number of octaves for the feTurbulence noise.
   * More octaves add detail but increase rendering cost.
   * @default 3
   */
  numOctaves?: number;

  /**
   * Additional CSS classes applied to the overlay container.
   */
  className?: string;
}

/**
 * Decorative SVG noise texture overlay using feTurbulence.
 *
 * Renders an absolutely positioned, pointer-events-none overlay that adds
 * subtle grain texture to its parent container. Matches the premium glass
 * aesthetic found in Raycast's UI.
 *
 * The parent element must have `position: relative` (or absolute/fixed/sticky)
 * for the overlay to position correctly.
 *
 * Each instance generates a unique SVG filter ID via `React.useId()`,
 * so multiple NoiseTexture components can coexist on the same page
 * without filter ID collisions.
 *
 * @example
 * ```tsx
 * <GlassCard className="relative">
 *   <NoiseTexture />
 *   <p>Content with subtle grain overlay</p>
 * </GlassCard>
 * ```
 *
 * @example
 * ```tsx
 * // Custom frequency and opacity
 * <div className="relative">
 *   <NoiseTexture opacity={0.05} baseFrequency={0.8} numOctaves={4} />
 *   <p>More visible grain</p>
 * </div>
 * ```
 */
function NoiseTexture({
  opacity = 0.03,
  baseFrequency = 0.65,
  numOctaves = 3,
  className,
}: NoiseTextureProps): React.JSX.Element {
  const id = React.useId();
  const filterId = `noise-${id}`;

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 z-[1]", className)}
      style={{ opacity }}
    >
      <svg
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id={filterId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency={baseFrequency}
            numOctaves={numOctaves}
            stitchTiles="stitch"
          />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter={`url(#${filterId})`}
        />
      </svg>
    </div>
  );
}

NoiseTexture.displayName = "NoiseTexture";

export { NoiseTexture };
