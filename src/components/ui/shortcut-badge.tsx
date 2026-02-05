"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Kbd } from "./kbd";

// ============================================
// Modifier key symbol mapping
// ============================================

const MODIFIER_SYMBOLS: Record<string, string> = {
  cmd: "\u2318",
  command: "\u2318",
  shift: "\u21E7",
  alt: "\u2325",
  option: "\u2325",
  ctrl: "\u2303",
  control: "\u2303",
  enter: "\u21B5",
  return: "\u21B5",
  backspace: "\u232B",
  delete: "\u2326",
  tab: "\u21E5",
  escape: "Esc",
  space: "Space",
  up: "\u2191",
  down: "\u2193",
  left: "\u2190",
  right: "\u2192",
};

// ============================================
// Types
// ============================================

export interface ShortcutBadgeProps {
  /** Key names, e.g. ["cmd", "K"] or ["shift", "alt", "P"] */
  keys: string[];
  /** Separator between keys. "plus" shows +, "none" shows gap only. @default "none" */
  separator?: "plus" | "none";
  /** Size passed to each Kbd */
  size?: "sm" | "md" | "lg";
  /** Highlight all keys with coral glow */
  highlighted?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Resolve a key string to its display symbol.
 * Modifier keys map to standard symbols. Single letters render uppercase.
 */
function resolveKey(key: string): string {
  const lower = key.toLowerCase();
  if (MODIFIER_SYMBOLS[lower]) {
    return MODIFIER_SYMBOLS[lower];
  }
  // Single letters/numbers render uppercase
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
}

// ============================================
// ShortcutBadge component
// ============================================

/**
 * ShortcutBadge - Displays modifier+key combinations using Kbd components.
 *
 * Composes `Kbd` components with proper modifier symbol mapping.
 * Supports optional "+" separator between keys.
 *
 * @example
 * ```tsx
 * // Renders: [Cmd] [K]
 * <ShortcutBadge keys={["cmd", "K"]} />
 *
 * // Renders: [Shift] + [Alt] + [P]
 * <ShortcutBadge keys={["shift", "alt", "P"]} separator="plus" />
 *
 * // Small highlighted
 * <ShortcutBadge keys={["cmd", "enter"]} size="sm" highlighted />
 * ```
 */
const ShortcutBadge = React.forwardRef<HTMLSpanElement, ShortcutBadgeProps>(
  (
    {
      keys,
      separator = "none",
      size = "md",
      highlighted = false,
      className,
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn("inline-flex items-center gap-1", className)}
      >
        {keys.map((key, index) => (
          <React.Fragment key={`${key}-${index}`}>
            <Kbd size={size} highlighted={highlighted}>
              {resolveKey(key)}
            </Kbd>
            {separator === "plus" && index < keys.length - 1 && (
              <span className="mx-0.5 text-xs text-foreground-muted">+</span>
            )}
          </React.Fragment>
        ))}
      </span>
    );
  }
);
ShortcutBadge.displayName = "ShortcutBadge";

export { ShortcutBadge };
