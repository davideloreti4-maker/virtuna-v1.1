import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SurfaceErrorStateProps {
  /** The error message shown to the user. */
  message: ReactNode;
  /** Retry handler — omit to hide the Retry affordance. */
  onRetry?: () => void;
  /** Retry button label. */
  retryLabel?: string;
  /** Stack the message above Retry (for longer, streamed errors) instead of inline. */
  stacked?: boolean;
  className?: string;
}

/**
 * The house-style inline error banner — one shape for every surface that fails
 * to load and offers a Retry. Flat-warm matte: a low-alpha red wash + 20%
 * border, a quiet neutral Retry button, `role="alert"` for a11y. Replaces the
 * hand-rolled per-surface banners (feed / discover / analyze stream).
 *
 * NOTE: keeps the shipped `red-500/red-400` palette for zero visual regression;
 * the design system's semantic `--color-error` token is the future de-drift home.
 */
export function SurfaceErrorState({
  message,
  onRetry,
  retryLabel = "Retry",
  stacked = false,
  className,
}: SurfaceErrorStateProps) {
  const retry = onRetry ? (
    <button
      type="button"
      onClick={onRetry}
      className="shrink-0 rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white/[0.02]"
    >
      {retryLabel}
    </button>
  ) : null;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-red-500/20 bg-red-500/[0.06] p-3",
        stacked
          ? "flex flex-col items-start gap-2"
          : "flex items-center justify-between gap-3",
        className,
      )}
    >
      <span className="text-sm text-red-400">{message}</span>
      {retry}
    </div>
  );
}
