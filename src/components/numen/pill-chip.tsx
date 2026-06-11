"use client";

import { type ReactNode } from "react";

import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

/**
 * PillChip — the full-pill Tool chip of the Numen kit.
 *
 * Built on `tailwind-variants` slots (D-08, not cva) and composed through `cn()`
 * so caller `className` overrides win predictably. Warm-neutral fill + hairline
 * `border-border`; NO glass, NO neon/gradient/glow (D-07). Icons are Lucide (D-09).
 *
 * The `intent` variants are visually DISTINCT (different root class strings) so
 * "instant" tools and "agentic" tools read differently — load-bearing for the
 * later TOOL-04 work:
 *   - instant  → quiet panel fill, hover lift to panel-2
 *   - agentic  → elevated panel-2 fill + a faint accent ring; icon tints accent
 */
export const pillChip = tv({
  slots: {
    root: "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
    icon: "size-4 shrink-0 text-text-muted",
    label: "text-text",
  },
  variants: {
    intent: {
      instant: { root: "bg-panel hover:bg-panel-2" },
      agentic: { root: "bg-panel-2 ring-1 ring-accent/30 hover:bg-panel-2" },
    },
  },
  compoundVariants: [{ intent: "agentic", class: { icon: "text-accent" } }],
  defaultVariants: { intent: "instant" },
});

export type PillChipVariants = VariantProps<typeof pillChip>;

export interface PillChipProps extends PillChipVariants {
  children?: ReactNode;
  /** Optional leading Lucide icon node */
  icon?: ReactNode;
  /** Click handler — makes the chip an interactive <button> */
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function PillChip({
  children,
  icon,
  intent,
  onClick,
  disabled = false,
  className,
}: PillChipProps) {
  const slots = pillChip({ intent });
  // Polymorphic: a button when interactive, otherwise a passive span.
  const Component = onClick ? "button" : "span";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={disabled ? undefined : onClick}
      disabled={onClick ? disabled : undefined}
      className={cn(slots.root(), className)}
    >
      {icon ? <span className={slots.icon()}>{icon}</span> : null}
      <span className={slots.label()}>{children}</span>
    </Component>
  );
}
