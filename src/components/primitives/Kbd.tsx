"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, type CSSProperties } from "react";

export type KbdSize = "sm" | "md" | "lg";

export interface KbdProps {
  /** Key(s) to display */
  children: ReactNode;
  /** Size variant */
  size?: KbdSize;
  /** Show as highlighted (coral glow) */
  highlighted?: boolean;
  /** Additional className */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

// Size configurations - Raycast keyboard keys
// Raycast: font-size 11-12px for inline, 16-32px for display keys
const sizeConfig = {
  sm: {
    wrapper: "px-1.5 py-0.5 text-[11px]",
    rounded: "rounded-[var(--rounding-xs)]",
  },
  md: {
    wrapper: "px-2 py-1 text-[12px]",
    rounded: "rounded-[var(--rounding-sm)]",
  },
  lg: {
    wrapper: "px-3 py-1.5 text-[14px]",
    rounded: "rounded-[var(--rounding-sm)]",
  },
};

/**
 * Kbd - Raycast-style keyboard key display.
 *
 * Features:
 * - Glass key appearance with 3D shadow effect
 * - Coral glow on highlight
 * - Size variants (sm for inline, md/lg for display)
 * - Proper font family (SF Pro style)
 *
 * Raycast exact shadow:
 * box-shadow: rgba(0, 0, 0, 0.4) 0px 1.5px 0.5px 2.5px,
 *             rgb(0, 0, 0) 0px 0px 0.5px 1px,
 *             rgba(0, 0, 0, 0.25) 0px 2px 1px 1px inset,
 *             rgba(255, 255, 255, 0.2) 0px 1px 1px 1px inset;
 *
 * @example
 * // Inline keyboard shortcut
 * Press <Kbd>⌘K</Kbd> to open command palette
 *
 * @example
 * // Key combination
 * <div className="flex gap-1">
 *   <Kbd>⌘</Kbd>
 *   <Kbd>Shift</Kbd>
 *   <Kbd>P</Kbd>
 * </div>
 *
 * @example
 * // Highlighted key
 * <Kbd highlighted>Enter</Kbd>
 *
 * @example
 * // Large display key
 * <Kbd size="lg">Escape</Kbd>
 */
export function Kbd({
  children,
  size = "sm",
  highlighted = false,
  className,
  style,
}: KbdProps) {
  const config = sizeConfig[size];

  return (
    <kbd
      className={cn(
        // Base styling
        "inline-flex items-center justify-center",
        "font-medium font-sans",
        "text-[var(--color-fg)]",
        "select-none",
        // Border
        "border border-white/[0.06]",
        // Size
        config.wrapper,
        config.rounded,
        // Highlighted state (coral glow)
        highlighted && "ring-1 ring-[var(--color-accent)]",
        className
      )}
      style={{
        // Raycast keyboard key gradient
        background: "linear-gradient(180deg, rgb(18, 18, 18), rgb(13, 13, 13))",
        // Raycast exact 3D key shadow
        boxShadow: `rgba(0, 0, 0, 0.4) 0px 1.5px 0.5px 2.5px,
             rgb(0, 0, 0) 0px 0px 0.5px 1px,
             rgba(0, 0, 0, 0.25) 0px 2px 1px 1px inset,
             rgba(255, 255, 255, 0.2) 0px 1px 1px 1px inset`,
        ...style,
      }}
    >
      {children}
    </kbd>
  );
}

/**
 * KbdCombo - Display a keyboard shortcut combination.
 *
 * @example
 * <KbdCombo keys={["⌘", "Shift", "P"]} />
 */
export function KbdCombo({
  keys,
  separator = "",
  size = "sm",
  className,
}: {
  keys: string[];
  separator?: string;
  size?: KbdSize;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          <Kbd size={size}>{key}</Kbd>
          {separator && i < keys.length - 1 && (
            <span className="text-[var(--color-fg-400)]">{separator}</span>
          )}
        </span>
      ))}
    </span>
  );
}
