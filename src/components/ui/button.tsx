"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Spinner } from "./spinner";

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
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    // Disabled state
    "disabled:pointer-events-none disabled:opacity-50",
    // Ensure cursor pointer for interactive element
    "cursor-pointer",
    // Next look (spec §7): title weight, press = scale 0.98, disabled = 40% and no shadow.
    "next:font-[640] next:duration-150 next:transition-[color,background-color,box-shadow,transform]",
    "next:active:scale-[0.98] next:disabled:opacity-40 next:disabled:shadow-none",
  ],
  {
    variants: {
      /**
       * Visual style variant
       * - `primary`: the one filled action of a card or screen (cream today, ink under the new look)
       * - `secondary`: default for most buttons (bordered today, tint fill under the new look)
       * - `ghost`: Transparent background, for tertiary/icon buttons
       * - `destructive`: Error color background, for dangerous actions
       * - `quiet`: text only, for links like "See all" (new look)
       */
      variant: {
        primary:
          "bg-action text-action-foreground shadow-button hover:bg-action/90 active:bg-action/80 next:shadow-[var(--shadow-button)]",
        secondary:
          "bg-transparent border border-white/[0.06] text-foreground hover:bg-white/[0.1] active:bg-white/[0.15] next:border-transparent next:bg-surface-sunken next:hover:bg-active next:active:bg-active",
        ghost:
          "bg-transparent text-foreground hover:bg-hover active:bg-active",
        destructive:
          "bg-error text-white hover:bg-error/90 active:bg-error/80",
        quiet:
          "bg-transparent text-foreground-secondary hover:text-foreground",
      },
      /**
       * Size variant
       * - `sm`: 36px height, compact for icon buttons
       * - `md`: 44px height, default, meets touch target
       * - `lg`: 48px height (50px under the new look), prominent actions
       * - `xl`: 56px height, the one main action of a screen (new look)
       */
      size: {
        sm: "h-9 min-h-[36px] min-w-[36px] px-3 text-sm rounded-md next:rounded-lg",
        md: "h-11 min-h-[44px] min-w-[44px] px-4 text-sm rounded-md next:rounded-xl",
        lg: "h-12 min-h-[48px] min-w-[48px] px-6 text-base rounded-md next:h-[50px] next:rounded-xl next:text-ui",
        xl: "h-14 min-h-[56px] min-w-[56px] px-6 text-ui rounded-xl",
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

    // When asChild=true, Radix Slot requires exactly one React element child
    // (React.Children.only). The `{loading && <Spinner />}` fragment produces
    // a `false` sibling even when loading=false, which counts as a child and
    // breaks SSR prerender. Spinner composition into a Link/anchor is also
    // semantically incoherent, so the spinner is skipped in asChild mode.
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && (
              <Spinner
                size="sm"
                aria-hidden="true"
              />
            )}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
