"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// ============================================
// Raycast exact 4-layer keycap shadow
// ============================================

const KEYCAP_SHADOW = [
  "rgba(0, 0, 0, 0.4) 0px 1.5px 0.5px 2.5px",
  "rgb(0, 0, 0) 0px 0px 0.5px 1px",
  "rgba(0, 0, 0, 0.25) 0px 2px 1px 1px inset",
  "rgba(255, 255, 255, 0.2) 0px 1px 1px 1px inset",
].join(", ");

const KEYCAP_SHADOW_HIGHLIGHTED = [
  KEYCAP_SHADOW,
  "0 0 8px oklch(0.72 0.16 40 / 0.3)",
].join(", ");

// ============================================
// CVA variants
// ============================================

const kbdVariants = cva(
  [
    "inline-flex items-center justify-center",
    "rounded-md font-medium font-mono",
    "border border-white/10",
    "text-foreground-secondary",
    "select-none",
  ],
  {
    variants: {
      size: {
        sm: "min-w-[20px] h-5 px-1 text-[10px]",
        md: "min-w-[24px] h-6 px-1.5 text-xs",
        lg: "min-w-[28px] h-7 px-2 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

// ============================================
// Types
// ============================================

export interface KbdProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof kbdVariants> {
  /** Render with coral glow highlight */
  highlighted?: boolean;
}

// ============================================
// Kbd component
// ============================================

/**
 * Kbd - Raycast-style 3D keyboard keycap visualization.
 *
 * Renders a `<kbd>` element with the exact 4-layer box shadow extracted
 * from Raycast, creating a realistic physical keycap appearance.
 *
 * @example
 * ```tsx
 * // Inline key
 * Press <Kbd>K</Kbd> to search
 *
 * // Large highlighted key
 * <Kbd size="lg" highlighted>Enter</Kbd>
 *
 * // Small modifier
 * <Kbd size="sm">Esc</Kbd>
 * ```
 */
const Kbd = React.forwardRef<HTMLElement, KbdProps>(
  ({ className, size, highlighted = false, style, ...props }, ref) => {
    return (
      <kbd
        ref={ref}
        className={cn(kbdVariants({ size, className }))}
        style={{
          background:
            "linear-gradient(180deg, rgb(18, 18, 18), rgb(13, 13, 13))",
          boxShadow: highlighted ? KEYCAP_SHADOW_HIGHLIGHTED : KEYCAP_SHADOW,
          ...style,
        }}
        {...props}
      />
    );
  }
);
Kbd.displayName = "Kbd";

export { Kbd, kbdVariants };
