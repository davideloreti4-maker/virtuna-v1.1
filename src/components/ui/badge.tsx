import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge variant styles using class-variance-authority (CVA).
 *
 * Uses semantic design tokens from globals.css for status colors.
 * Badges are display-only (non-interactive) status indicators.
 *
 * @example
 * ```tsx
 * // Default (neutral)
 * <Badge>Draft</Badge>
 *
 * // Success status
 * <Badge variant="success">Active</Badge>
 *
 * // Warning status
 * <Badge variant="warning">Pending</Badge>
 *
 * // Error status
 * <Badge variant="error">Failed</Badge>
 *
 * // Info status
 * <Badge variant="info">New</Badge>
 *
 * // Small size
 * <Badge size="sm">3</Badge>
 * ```
 */
const badgeVariants = cva(
  // Base styles - shared across all variants
  "inline-flex items-center justify-center rounded-full font-medium",
  {
    variants: {
      /**
       * Visual style variant using semantic status colors
       * - `default`: Neutral surface background for general labels
       * - `success`: Green tint for positive/active states
       * - `warning`: Yellow tint for pending/caution states
       * - `error`: Red tint for failed/danger states
       * - `info`: Blue tint for informational/new states
       */
      variant: {
        default:
          "bg-surface text-foreground-secondary border border-border",
        success:
          "bg-success/10 text-success border border-success/20",
        warning:
          "bg-warning/10 text-warning border border-warning/20",
        error:
          "bg-error/10 text-error border border-error/20",
        info:
          "bg-info/10 text-info border border-info/20",
      },
      /**
       * Size variant
       * - `sm`: 20px height, compact for counts/icons
       * - `md`: 24px height, default for text labels
       */
      size: {
        sm: "h-5 px-2 text-[10px]",
        md: "h-6 px-2.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

/**
 * Badge component props
 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Badge component for displaying status indicators and labels.
 *
 * Features:
 * - 5 semantic variants: default, success, warning, error, info
 * - 2 sizes: sm (20px), md (24px)
 * - Uses semantic color tokens from globals.css
 * - Display-only (non-interactive) - no hover/active states
 *
 * @example
 * ```tsx
 * // Status indicators
 * <Badge variant="success">Active</Badge>
 * <Badge variant="warning">Pending Review</Badge>
 * <Badge variant="error">Expired</Badge>
 *
 * // Count badges
 * <Badge size="sm">3</Badge>
 * <Badge variant="info" size="sm">New</Badge>
 *
 * // Feature tags
 * <Badge>Pro</Badge>
 * <Badge variant="info">Beta</Badge>
 * ```
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <span
        className={cn(badgeVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
