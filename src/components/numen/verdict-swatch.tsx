import { type ReactNode } from "react";

import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

/**
 * VerdictSwatch — surfaces the three muted load-bearing verdict colors (DS-02).
 *
 * Built on `tailwind-variants` (D-08) with LITERAL class strings only — never
 * `bg-${verdict}` interpolation (Pitfall 5: Tailwind cannot see dynamic strings).
 *
 * The three verdict bands are PEERS, not a good→bad gradient:
 *   - good  → muted green   (positive band)
 *   - mixed → amber, FIRST-CLASS "mixed signals" — its own band, never a failure tint
 *   - bad   → muted clay    (negative band)
 *
 * Muted, not saturated. Any text rendered on a swatch must meet APCA Lc >= 60
 * (validated by scripts/check-apca.ts from Plan 01).
 */
export const verdictSwatch = tv({
  base: "inline-flex items-center justify-center rounded-[8px] border border-border",
  variants: {
    verdict: {
      good: "bg-verdict-good",
      mixed: "bg-verdict-mixed",
      bad: "bg-verdict-bad",
    },
    size: {
      sm: "size-4",
      md: "size-6",
      lg: "size-8",
    },
  },
  defaultVariants: { verdict: "mixed", size: "md" },
});

export type VerdictSwatchVariants = VariantProps<typeof verdictSwatch>;

export interface VerdictSwatchProps extends VerdictSwatchVariants {
  /** Optional content rendered on the swatch (must meet APCA Lc >= 60) */
  children?: ReactNode;
  className?: string;
}

export function VerdictSwatch({
  verdict,
  size,
  children,
  className,
}: VerdictSwatchProps) {
  return (
    <span className={cn(verdictSwatch({ verdict, size }), className)}>
      {children}
    </span>
  );
}
