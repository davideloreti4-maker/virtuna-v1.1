import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard glyph chip for empty-state icons — a lucide/phosphor glyph inside a
 * subtle rounded tile. Brand motifs (Constellation / ConstellationMark) render
 * bare instead; pass those directly as `icon`.
 */
export function EmptyStateIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] text-foreground-muted">
      {children}
    </div>
  );
}

interface SurfaceEmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Optional icon node — a brand motif or an <EmptyStateIcon>-wrapped glyph. */
  icon?: ReactNode;
  /** Optional bold title line. */
  title?: ReactNode;
  /** Subtext / description. */
  children?: ReactNode;
  /** Single CTA (button or dialog trigger). */
  action?: ReactNode;
  /** Compact slot (panels, rails) — smaller padding, no tall min-height. */
  compact?: boolean;
}

/**
 * The house-style empty state — one "quiet tile" for every surface/section that
 * has no content yet. Flat-warm matte: filled `bg-background-elevated`, 6%
 * border, centered icon → title → subtext → single CTA. Replaces the
 * hand-rolled divergent empties (dashed borders, borderless blocks, ad-hoc icon
 * chips) with one shape. House-style ratified 2026-07-06 ("A — Quiet tile").
 */
export function SurfaceEmptyState({
  icon,
  title,
  children,
  action,
  compact = false,
  className,
  ...rest
}: SurfaceEmptyStateProps) {
  return (
    <div
      {...rest}
      className={cn(
        "elev-rest flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-white/[0.06] bg-background-elevated px-6 text-center",
        compact ? "gap-3 py-10" : "min-h-[360px] gap-5 py-16",
        className,
      )}
    >
      {icon}
      {(title || children) && (
        <div className="flex flex-col gap-2">
          {title && (
            <p
              className={cn(
                "font-semibold text-foreground",
                compact ? "text-sm" : "text-base",
              )}
            >
              {title}
            </p>
          )}
          {children && (
            <p className="mx-auto max-w-md text-sm text-foreground-muted">
              {children}
            </p>
          )}
        </div>
      )}
      {action}
    </div>
  );
}
