import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Divider orientation variants using CVA.
 */
const dividerVariants = cva("bg-border", {
  variants: {
    /**
     * Orientation of the divider line.
     * - `horizontal`: Full-width horizontal line (1px height)
     * - `vertical`: Full-height vertical line (1px width)
     */
    orientation: {
      horizontal: "w-full h-px",
      vertical: "h-full w-px",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
});

/**
 * Props for the Divider component.
 */
export interface DividerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dividerVariants> {
  /** Optional label text displayed in the center of a horizontal divider */
  label?: string;
}

/**
 * Divider — Layout separator with horizontal, vertical, and labeled variants.
 *
 * Uses the semantic `border` color token for consistent theming.
 * Includes `role="separator"` and `aria-orientation` for accessibility.
 *
 * @example
 * ```tsx
 * // Simple horizontal divider
 * <Divider />
 *
 * // With label
 * <Divider label="or" />
 *
 * // Vertical divider
 * <div className="flex h-8 items-center gap-4">
 *   <span>Left</span>
 *   <Divider orientation="vertical" />
 *   <span>Right</span>
 * </div>
 * ```
 */
const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, orientation = "horizontal", label, ...props }, ref) => {
    // Labeled horizontal divider
    if (label && orientation === "horizontal") {
      return (
        <div
          ref={ref}
          role="separator"
          aria-orientation="horizontal"
          className={cn("flex items-center gap-4 w-full", className)}
          {...props}
        >
          <span className="flex-1 h-px bg-border" />
          <span className="text-xs text-foreground-muted whitespace-nowrap">
            {label}
          </span>
          <span className="flex-1 h-px bg-border" />
        </div>
      );
    }

    // Simple horizontal or vertical divider
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={orientation ?? "horizontal"}
        className={cn(dividerVariants({ orientation }), className)}
        {...props}
      />
    );
  },
);
Divider.displayName = "Divider";

export { Divider, dividerVariants };
