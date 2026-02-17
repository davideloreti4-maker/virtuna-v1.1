"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties } from "react";

export type DividerOrientation = "horizontal" | "vertical";

export interface DividerProps {
  /** Orientation */
  orientation?: DividerOrientation;
  /** Optional label text in the middle */
  label?: ReactNode;
  /** Label alignment (for horizontal only) */
  labelAlign?: "left" | "center" | "right";
  /** Additional className */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

/**
 * Divider - Glass gradient line separator.
 *
 * Features:
 * - Horizontal and vertical orientations
 * - Optional label in the middle
 * - Subtle glass gradient effect
 *
 * @example
 * // Simple horizontal divider
 * <Divider />
 *
 * @example
 * // With label
 * <Divider label="or" />
 *
 * @example
 * // Vertical divider
 * <div className="flex h-8 items-center">
 *   <span>Left</span>
 *   <Divider orientation="vertical" className="mx-4" />
 *   <span>Right</span>
 * </div>
 *
 * @example
 * // With custom label alignment
 * <Divider label="Section" labelAlign="left" />
 */
export function Divider({
  orientation = "horizontal",
  label,
  labelAlign = "center",
  className,
  style,
}: DividerProps) {
  // Vertical divider
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn(
          "w-px self-stretch",
          className
        )}
        style={{
          background: "linear-gradient(180deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)",
          ...style,
        }}
      />
    );
  }

  // Horizontal divider without label
  if (!label) {
    return (
      <hr
        role="separator"
        aria-orientation="horizontal"
        className={cn(
          "w-full h-px border-0",
          className
        )}
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)",
          ...style,
        }}
      />
    );
  }

  // Horizontal divider with label
  const alignStyles = {
    left: "before:w-8 after:flex-1",
    center: "before:flex-1 after:flex-1",
    right: "before:flex-1 after:w-8",
  };

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn(
        "flex items-center gap-4 w-full",
        alignStyles[labelAlign],
        "before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-white/10",
        "after:h-px after:bg-gradient-to-r after:from-white/10 after:via-white/10 after:to-transparent",
        className
      )}
      style={style}
    >
      <span className="text-[12px] text-[var(--color-fg-400)] font-medium uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
