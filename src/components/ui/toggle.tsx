"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * CVA variants for the toggle track (Switch Root).
 *
 * The track changes from neutral glass to coral-tinted glass when checked,
 * using Radix data-state attributes for styling.
 */
const toggleTrackVariants = cva(
  [
    // Base
    "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border",
    "transition-all duration-200",
    // Focus ring
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
    // Disabled
    "disabled:cursor-not-allowed disabled:opacity-50",
    // Unchecked state
    "data-[state=unchecked]:bg-surface data-[state=unchecked]:border-border-glass",
    // Checked state — coral accent tint
    "data-[state=checked]:bg-accent/20 data-[state=checked]:border-accent/30",
  ],
  {
    variants: {
      /**
       * Size variant for the track.
       * - `sm`: 20px height, 36px width
       * - `md`: 24px height, 44px width — default
       * - `lg`: 28px height, 52px width
       */
      size: {
        sm: "h-5 w-9",
        md: "h-6 w-11",
        lg: "h-7 w-[52px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

/**
 * CVA variants for the toggle thumb (Switch Thumb).
 *
 * The thumb slides to the right when checked and gains a coral glow shadow.
 * Uses Radix data-state attributes for position and color transitions.
 */
const toggleThumbVariants = cva(
  [
    // Base
    "pointer-events-none block rounded-full shadow-sm",
    "transition-all duration-200",
    // Unchecked: secondary foreground, slight offset
    "data-[state=unchecked]:bg-foreground-secondary data-[state=unchecked]:translate-x-0.5",
    // Checked: coral accent with glow
    "data-[state=checked]:bg-accent",
    "data-[state=checked]:shadow-[0_0_8px_oklch(0.72_0.16_40_/_0.4)]",
  ],
  {
    variants: {
      /**
       * Size variant for the thumb.
       * - `sm`: 16px
       * - `md`: 20px — default
       * - `lg`: 24px
       */
      size: {
        sm: "h-4 w-4 data-[state=checked]:translate-x-[18px]",
        md: "h-5 w-5 data-[state=checked]:translate-x-[22px]",
        lg: "h-6 w-6 data-[state=checked]:translate-x-[26px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

/**
 * Toggle component props.
 *
 * Extends Radix Switch Root props with size variant and optional label.
 */
export interface ToggleProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
    VariantProps<typeof toggleTrackVariants> {
  /**
   * Optional label text rendered alongside the toggle.
   * Wraps the toggle in a `<label>` element for accessibility.
   */
  label?: string;
}

/**
 * Toggle/Switch component with Raycast-style coral accent.
 *
 * Built on `@radix-ui/react-switch` for accessible, keyboard-navigable toggle behavior.
 * Radix handles checked/onChange state management for both controlled and uncontrolled modes.
 *
 * Features:
 * - 3 sizes: sm (20px), md (24px, default), lg (28px)
 * - Coral accent when checked with glow shadow
 * - Neutral glass track when unchecked
 * - Keyboard accessible (Space to toggle)
 * - Optional label with `<label>` wrapping
 * - Full controlled/uncontrolled support via Radix
 *
 * @example
 * ```tsx
 * // Basic uncontrolled toggle
 * <Toggle label="Enable notifications" />
 *
 * // Controlled toggle
 * const [enabled, setEnabled] = useState(false);
 * <Toggle checked={enabled} onCheckedChange={setEnabled} label="Dark mode" />
 *
 * // Different sizes
 * <Toggle size="sm" label="Small" />
 * <Toggle size="md" label="Medium" />
 * <Toggle size="lg" label="Large" />
 *
 * // Without label
 * <Toggle aria-label="Toggle feature" />
 *
 * // Disabled
 * <Toggle checked disabled label="Locked setting" />
 * ```
 */
const Toggle = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  ToggleProps
>(({ className, size, label, ...props }, ref) => {
  const switchElement = (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(toggleTrackVariants({ size, className: label ? undefined : className }))}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(toggleThumbVariants({ size }))}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) {
    return switchElement;
  }

  return (
    <label
      className={cn(
        "flex items-center gap-3 cursor-pointer",
        props.disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {switchElement}
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
});
Toggle.displayName = "Toggle";

export { Toggle, toggleTrackVariants, toggleThumbVariants };
