"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Button variant styles using class-variance-authority (CVA).
 *
 * Uses semantic design tokens from globals.css for consistent theming.
 * Default variant is `secondary` following Raycast's pattern of sparse accent usage.
 *
 * @example
 * ```tsx
 * // Primary CTA (coral accent) - use sparingly
 * <Button variant="primary">Get Started</Button>
 *
 * // Secondary (default) - most common usage
 * <Button>Learn More</Button>
 * <Button variant="secondary">Cancel</Button>
 *
 * // Ghost - for tertiary/icon buttons
 * <Button variant="ghost">Close</Button>
 *
 * // Destructive - for dangerous actions
 * <Button variant="destructive">Delete Account</Button>
 * ```
 */
const buttonVariants = cva(
  // Base styles - shared across all variants
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium transition-colors",
    // Focus ring using semantic tokens
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    // Disabled state
    "disabled:pointer-events-none disabled:opacity-50",
    // Ensure cursor pointer for interactive element
    "cursor-pointer",
  ],
  {
    variants: {
      /**
       * Visual style variant
       * - `primary`: Coral accent background, for primary CTAs (use sparingly)
       * - `secondary`: Surface background with border, default for most buttons
       * - `ghost`: Transparent background, for tertiary/icon buttons
       * - `destructive`: Error color background, for dangerous actions
       */
      variant: {
        primary:
          "bg-accent text-accent-foreground shadow-button hover:bg-accent-hover active:bg-accent-active",
        secondary:
          "bg-transparent border border-white/[0.06] text-foreground hover:bg-white/[0.1] active:bg-white/[0.15]",
        ghost:
          "bg-transparent text-foreground hover:bg-hover active:bg-active",
        destructive:
          "bg-error text-white hover:bg-error/90 active:bg-error/80",
      },
      /**
       * Size variant - all meet 44x44px minimum touch target (except sm which is 36px for icon buttons)
       * - `sm`: 36px height, compact for icon buttons
       * - `md`: 44px height, default, meets touch target
       * - `lg`: 48px height, prominent CTAs
       */
      size: {
        sm: "h-9 min-h-[36px] min-w-[36px] px-3 text-sm rounded-lg",
        md: "h-11 min-h-[44px] min-w-[44px] px-4 text-sm rounded-lg",
        lg: "h-12 min-h-[48px] min-w-[48px] px-6 text-base rounded-lg",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

/**
 * Button component props
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, renders as a Radix Slot allowing composition with other components.
   * Useful for rendering a button as a link or other element.
   * @default false
   */
  asChild?: boolean;

  /**
   * When true, shows a loading spinner and disables the button.
   * Sets aria-busy="true" for accessibility.
   * @default false
   *
   * @example
   * ```tsx
   * <Button loading>Saving...</Button>
   * ```
   */
  loading?: boolean;
}

/**
 * Button component with Raycast-style design system integration.
 *
 * Features:
 * - 4 variants: primary (coral), secondary (default), ghost, destructive
 * - 3 sizes: sm (36px), md (44px), lg (48px) - all meet touch target requirements
 * - Loading state with spinner and disabled interaction
 * - Full accessibility support (aria-busy, aria-disabled, focus-visible ring)
 * - Composition support via asChild prop (Radix Slot)
 *
 * @example
 * ```tsx
 * // Basic usage (secondary variant is default)
 * <Button>Click me</Button>
 *
 * // Primary CTA
 * <Button variant="primary" size="lg">Get Started</Button>
 *
 * // Loading state
 * <Button loading>Saving...</Button>
 *
 * // Ghost button
 * <Button variant="ghost" size="sm">
 *   <XIcon className="h-4 w-4" />
 * </Button>
 *
 * // As a link (composition)
 * <Button asChild>
 *   <a href="/dashboard">Go to Dashboard</a>
 * </Button>
 *
 * // Destructive action
 * <Button variant="destructive">Delete Account</Button>
 * ```
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <Loader2
            className="h-4 w-4 animate-spin"
            aria-hidden="true"
          />
        )}
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
