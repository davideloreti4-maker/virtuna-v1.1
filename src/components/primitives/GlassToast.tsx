"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties } from "react";

/** Toast severity variants */
export type ToastVariant = "info" | "success" | "warning" | "error" | "neutral";

export interface GlassToastProps {
  /** Toast message */
  children: ReactNode;
  /** Severity variant — controls icon and title accent color; background stays neutral */
  variant?: ToastVariant;
  /** Optional short title rendered above children */
  title?: string;
  /** Optional icon; falls back to a built-in glyph */
  icon?: ReactNode;
  /** Optional dismiss/action slot */
  action?: ReactNode;
  /** Additional className */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
}

// Solid dark background — consistent across every variant
const TOAST_BG = "rgba(18, 19, 21, 0.96)";

// Per-variant: only the icon and title text carry color
const variantConfig: Record<
  ToastVariant,
  { accentClass: string; defaultIcon: string }
> = {
  info: {
    accentClass: "text-blue-400",
    defaultIcon: "ℹ",
  },
  success: {
    accentClass: "text-green-400",
    defaultIcon: "✓",
  },
  warning: {
    accentClass: "text-orange-400",
    defaultIcon: "⚠",
  },
  error: {
    accentClass: "text-red-400",
    defaultIcon: "✕",
  },
  neutral: {
    accentClass: "text-white/60",
    defaultIcon: "•",
  },
};

/**
 * GlassToast — Notification toast following Raycast design language.
 *
 * Background is always a solid near-opaque dark surface. Color accent lives
 * exclusively in the icon and title text — never as a background fill or glow.
 *
 * @example
 * <GlassToast variant="success" title="Saved">
 *   Your changes have been saved.
 * </GlassToast>
 *
 * @example
 * <GlassToast variant="error" title="Failed" action={<button>Retry</button>}>
 *   Could not save your changes.
 * </GlassToast>
 */
export function GlassToast({
  children,
  variant = "neutral",
  title,
  icon,
  action,
  className,
  style,
}: GlassToastProps) {
  const config = variantConfig[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3",
        "border border-white/[0.06]",
        "shadow-lg",
        className
      )}
      style={{
        backgroundColor: TOAST_BG,
        boxShadow:
          "rgba(255,255,255,0.06) 0 1px 1px 0 inset, 0 8px 32px rgba(0,0,0,0.4)",
        ...style,
      }}
    >
      {/* Icon — sole colored element */}
      <span
        className={cn("mt-0.5 shrink-0 text-base leading-none", config.accentClass)}
        aria-hidden="true"
      >
        {icon ?? config.defaultIcon}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Title — colored accent text */}
        {title && (
          <p className={cn("truncate font-semibold leading-snug", config.accentClass)}>
            {title}
          </p>
        )}
        {/* Body — neutral muted text */}
        <div className="text-sm leading-relaxed text-white/60">{children}</div>
      </div>

      {/* Optional action slot (e.g. dismiss button or CTA) */}
      {action && (
        <div className="ml-auto shrink-0 self-center">{action}</div>
      )}
    </div>
  );
}
