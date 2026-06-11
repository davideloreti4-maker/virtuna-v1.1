"use client";

import { type ReactNode } from "react";

import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

/**
 * PillChip — the full-pill Tool chip of the Numen kit.
 *
 * Built on `tailwind-variants` slots (D-08, not cva) and composed through `cn()`
 * so caller `className` overrides win predictably. Warm-neutral fill + hairline
 * `border-numen-border`; NO glass, NO neon/gradient/glow (D-07). Icons are Lucide (D-09).
 *
 * The `intent` variants are visually DISTINCT (different root class strings) so
 * "instant" tools and "agentic" tools read differently — load-bearing for the
 * later TOOL-04 work:
 *   - instant  → quiet panel fill, hover lift to panel-2
 *   - agentic  → elevated panel-2 fill + a faint accent ring; icon tints accent
 *
 * WR-01: the `icon` slot constrains the child `<svg>` directly (`[&>svg]:size-4`),
 * not just the wrapping span — a bare Lucide icon defaults to 24px, so sizing the
 * span alone would let the icon render oversized. The SVG selector forces 16px.
 */
export const pillChip = tv({
  slots: {
    root: "inline-flex items-center gap-2 rounded-full border border-numen-border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-numen-accent disabled:opacity-50",
    icon: "[&>svg]:size-4 shrink-0 text-numen-text-muted",
    label: "text-numen-text",
  },
  variants: {
    intent: {
      instant: { root: "bg-numen-panel hover:bg-numen-panel-2" },
      agentic: { root: "bg-numen-panel-2 ring-1 ring-numen-accent/30 hover:bg-numen-panel-2" },
    },
  },
  compoundVariants: [{ intent: "agentic", class: { icon: "text-numen-accent" } }],
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
      // `disabled` is only a valid attribute on <button>. In <span> mode it is
      // dropped, so the disabled state is carried for ALL element types via
      // `aria-disabled` + a class that visually dims and blocks pointer events
      // (WR-02 — a <span> has no native `:disabled`, so `disabled:opacity-50`
      // never fires there and a "disabled passive chip" would otherwise look and
      // behave enabled).
      disabled={onClick ? disabled : undefined}
      aria-disabled={disabled || undefined}
      className={cn(
        slots.root(),
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      {icon ? <span className={slots.icon()}>{icon}</span> : null}
      <span className={slots.label()}>{children}</span>
    </Component>
  );
}
