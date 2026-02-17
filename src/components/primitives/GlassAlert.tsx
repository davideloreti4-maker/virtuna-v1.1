"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties } from "react";

/** Alert severity variants */
export type AlertVariant = "info" | "success" | "warning" | "error" | "neutral";

export interface GlassAlertProps {
  /** Alert content */
  children: ReactNode;
  /** Severity variant — controls left border, icon, and title text color */
  variant?: AlertVariant;
  /** Optional title rendered above children */
  title?: string;
  /** Optional icon element placed before the title */
  icon?: ReactNode;
  /** Additional className */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
}

// Neutral dark background for every variant — no colored tinting
const NEUTRAL_BG = "rgba(255, 255, 255, 0.05)";

// Per-variant: only the left border color and the text/icon accent color change
const variantConfig: Record<
  AlertVariant,
  { borderColor: string; accentClass: string; defaultIcon: string }
> = {
  info: {
    borderColor: "#60a5fa", // blue-400
    accentClass: "text-blue-400",
    defaultIcon: "ℹ",
  },
  success: {
    borderColor: "#4ade80", // green-400
    accentClass: "text-green-400",
    defaultIcon: "✓",
  },
  warning: {
    borderColor: "#fb923c", // orange-400
    accentClass: "text-orange-400",
    defaultIcon: "⚠",
  },
  error: {
    borderColor: "#f87171", // red-400
    accentClass: "text-red-400",
    defaultIcon: "✕",
  },
  neutral: {
    borderColor: "rgba(255, 255, 255, 0.2)",
    accentClass: "text-white/60",
    defaultIcon: "•",
  },
};

/**
 * GlassAlert — Status/feedback alert following Raycast design language.
 *
 * Background is always neutral dark glass. Color accent lives exclusively in
 * the left border stripe, the icon, and the title text — never as a background fill.
 *
 * @example
 * <GlassAlert variant="success" title="Payment confirmed">
 *   Your transaction was processed successfully.
 * </GlassAlert>
 *
 * @example
 * <GlassAlert variant="error" title="Connection failed" icon={<AlertIcon />}>
 *   Could not reach the server. Try again later.
 * </GlassAlert>
 */
export function GlassAlert({
  children,
  variant = "neutral",
  title,
  icon,
  className,
  style,
}: GlassAlertProps) {
  const config = variantConfig[variant];

  return (
    <div
      role="alert"
      className={cn(
        "relative flex gap-3 rounded-lg px-4 py-3",
        "border border-white/[0.06]",
        "text-sm text-white/80",
        className
      )}
      style={{
        backgroundColor: NEUTRAL_BG,
        // Left border accent stripe — the only colored surface element
        borderLeft: `2px solid ${config.borderColor}`,
        ...style,
      }}
    >
      {/* Icon */}
      {(icon ?? title !== undefined) && (
        <span
          className={cn("mt-0.5 shrink-0 text-base leading-none", config.accentClass)}
          aria-hidden="true"
        >
          {icon ?? config.defaultIcon}
        </span>
      )}

      <div className="flex flex-col gap-0.5">
        {/* Title — colored accent text */}
        {title && (
          <p className={cn("font-semibold leading-snug", config.accentClass)}>
            {title}
          </p>
        )}
        {/* Body — neutral muted text */}
        <div className="leading-relaxed text-white/60">{children}</div>
      </div>
    </div>
  );
}
