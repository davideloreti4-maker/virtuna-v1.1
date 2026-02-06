"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/* ============================================
 * EXTENSION CARD — Raycast-style feature/extension card
 * Radial gradient glow at top, icon + title + description
 * ============================================ */

/**
 * Gradient color theme for the card's top glow effect.
 */
type GradientTheme = "coral" | "purple" | "blue" | "green" | "cyan";

/**
 * Radial gradient glow definitions per theme.
 * Each gradient emanates from the top-center of the card,
 * matching Raycast's feature card glow pattern.
 */
const GRADIENT_THEMES: Record<GradientTheme, string> = {
  coral:
    "radial-gradient(85.77% 49.97% at 51% 5.12%, oklch(0.72 0.16 40 / 0.11) 0px, oklch(0.90 0.06 40 / 0.08) 45.83%, oklch(0.97 0.03 40 / 0.02) 100%)",
  purple:
    "radial-gradient(85.77% 49.97% at 51% 5.12%, oklch(0.55 0.20 300 / 0.11) 0px, oklch(0.70 0.10 300 / 0.08) 45.83%, oklch(0.90 0.03 300 / 0.02) 100%)",
  blue:
    "radial-gradient(85.77% 49.97% at 51% 5.12%, oklch(0.60 0.15 240 / 0.11) 0px, oklch(0.75 0.08 240 / 0.08) 45.83%, oklch(0.90 0.03 240 / 0.02) 100%)",
  green:
    "radial-gradient(85.77% 49.97% at 51% 5.12%, oklch(0.65 0.18 145 / 0.11) 0px, oklch(0.80 0.10 145 / 0.08) 45.83%, oklch(0.92 0.03 145 / 0.02) 100%)",
  cyan:
    "radial-gradient(85.77% 49.97% at 51% 5.12%, oklch(0.70 0.12 195 / 0.11) 0px, oklch(0.82 0.08 195 / 0.08) 45.83%, oklch(0.93 0.03 195 / 0.02) 100%)",
} as const;

/**
 * Props for the ExtensionCard component.
 */
export interface ExtensionCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon rendered in the card's icon area (emoji, SVG, or React node) */
  icon: React.ReactNode;
  /** Card title */
  title: string;
  /** Card description (line-clamped to 2 lines) */
  description: string;
  /**
   * Gradient color theme for the top radial glow.
   * @default "coral"
   */
  gradient?: GradientTheme;
  /** Optional metadata rendered below the description */
  metadata?: React.ReactNode;
  /** Optional href — makes the card a clickable link */
  href?: string;
}

/**
 * ExtensionCard — Raycast-style feature/extension card with radial gradient glow.
 *
 * Features a radial gradient glow at the top of the card that fades into
 * the surface background, with an icon, title, description, and optional
 * metadata area. Supports 5 color themes.
 *
 * @example
 * ```tsx
 * // Basic extension card with coral glow (default)
 * <ExtensionCard
 *   icon={<span>🚀</span>}
 *   title="Quick Launch"
 *   description="Launch applications instantly with keyboard shortcuts."
 * />
 *
 * // Purple theme with metadata
 * <ExtensionCard
 *   icon={<span>🎨</span>}
 *   title="Color Picker"
 *   description="Pick colors from anywhere on your screen."
 *   gradient="purple"
 *   metadata={<span className="text-xs text-foreground-tertiary">v2.1.0</span>}
 * />
 *
 * // Clickable card with link
 * <ExtensionCard
 *   icon={<span>📦</span>}
 *   title="Package Manager"
 *   description="Manage npm, pnpm, and yarn packages."
 *   gradient="blue"
 *   href="/extensions/package-manager"
 * />
 * ```
 */
const ExtensionCard = React.forwardRef<HTMLDivElement, ExtensionCardProps>(
  (
    {
      icon,
      title,
      description,
      gradient = "coral",
      metadata,
      href,
      className,
      ...props
    },
    ref,
  ) => {
    const content = (
      <>
        {/* Gradient glow overlay — absolute positioned at top */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{ background: GRADIENT_THEMES[gradient] }}
          aria-hidden="true"
        />

        {/* Content */}
        <div className="relative p-6">
          {/* Icon area */}
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl">
            {icon}
          </div>

          {/* Title */}
          <h3 className="mb-1 text-base font-semibold text-foreground">
            {title}
          </h3>

          {/* Description */}
          <p className="line-clamp-2 text-sm text-foreground-secondary">
            {description}
          </p>

          {/* Metadata (optional) */}
          {metadata != null && <div className="mt-4">{metadata}</div>}
        </div>
      </>
    );

    const cardClasses = cn(
      "group relative overflow-hidden rounded-[12px]",
      "border border-border bg-transparent",
      "transition-all duration-150",
      "hover:border-border-hover hover:-translate-y-0.5 hover:bg-white/[0.03]",
      href && "cursor-pointer",
      className,
    );

    if (href) {
      return (
        <div ref={ref} className={cardClasses} style={{ boxShadow: "rgba(255, 255, 255, 0.1) 0px 1px 0px 0px inset" }} {...props}>
          <a
            href={href}
            className="absolute inset-0 z-10"
            aria-label={title}
          />
          {content}
        </div>
      );
    }

    return (
      <div ref={ref} className={cardClasses} style={{ boxShadow: "rgba(255, 255, 255, 0.1) 0px 1px 0px 0px inset" }} {...props}>
        {content}
      </div>
    );
  },
);
ExtensionCard.displayName = "ExtensionCard";

export { ExtensionCard, GRADIENT_THEMES };
