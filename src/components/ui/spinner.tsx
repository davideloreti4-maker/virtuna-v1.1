import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Size to pixel mapping for spinner dimensions
 */
const sizeMap: Record<"sm" | "md" | "lg", number> = {
  sm: 16,
  md: 24,
  lg: 32,
};

/**
 * Spinner component props
 */
export interface SpinnerProps
  extends Omit<React.SVGAttributes<SVGSVGElement>, "children"> {
  /**
   * Size of the spinner.
   * - `sm`: 16px
   * - `md`: 24px (default)
   * - `lg`: 32px
   */
  size?: "sm" | "md" | "lg";

  /**
   * Determinate progress value (0-100).
   * When undefined, spinner shows indeterminate (spinning) animation.
   * When provided, shows a static progress indicator.
   */
  value?: number;

  /**
   * Accessible label for screen readers.
   * @default "Loading"
   */
  label?: string;
}

/**
 * Spinner component for loading states.
 *
 * Features:
 * - Indeterminate mode: continuous spinning animation
 * - Determinate mode: static progress indicator (0-100%)
 * - 3 sizes: sm (16px), md (24px), lg (32px)
 * - Full accessibility support (role, aria attributes)
 * - Inherits color from parent via currentColor
 *
 * @example
 * ```tsx
 * // Indeterminate spinner (default)
 * <Spinner />
 *
 * // With custom size
 * <Spinner size="lg" />
 *
 * // Determinate progress
 * <Spinner value={75} />
 *
 * // With color inheritance
 * <div className="text-accent">
 *   <Spinner />
 * </div>
 *
 * // Custom label for screen readers
 * <Spinner label="Uploading file" />
 *
 * // In a button
 * <Button disabled>
 *   <Spinner size="sm" /> Loading...
 * </Button>
 * ```
 */
const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ size = "md", value, label = "Loading", className, ...props }, ref) => {
    const pixelSize = sizeMap[size];
    const isDeterminate = typeof value === "number";

    // SVG circle calculations
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = isDeterminate
      ? circumference * (1 - Math.min(100, Math.max(0, value)) / 100)
      : undefined;

    return (
      <svg
        ref={ref}
        className={cn(
          "text-foreground-muted",
          !isDeterminate && "animate-spin",
          className
        )}
        viewBox="0 0 24 24"
        width={pixelSize}
        height={pixelSize}
        fill="none"
        role="progressbar"
        aria-label={label}
        aria-valuemin={isDeterminate ? 0 : undefined}
        aria-valuemax={isDeterminate ? 100 : undefined}
        aria-valuenow={isDeterminate ? value : undefined}
        {...props}
      >
        {/* Background track for determinate mode */}
        {isDeterminate && (
          <circle
            cx="12"
            cy="12"
            r={radius}
            stroke="currentColor"
            strokeWidth="3"
            strokeOpacity="0.2"
          />
        )}

        {/* Progress/spinner circle */}
        <circle
          cx="12"
          cy="12"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={isDeterminate ? circumference : "60 40"}
          strokeDashoffset={strokeDashoffset}
          style={
            isDeterminate
              ? {
                  transform: "rotate(-90deg)",
                  transformOrigin: "center",
                }
              : undefined
          }
        />
      </svg>
    );
  }
);
Spinner.displayName = "Spinner";

export { Spinner };
