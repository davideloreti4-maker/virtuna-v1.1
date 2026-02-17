"use client";

import { cn } from "@/lib/utils";
import { useState, type CSSProperties } from "react";

export interface GlassToggleProps {
  /** Controlled checked state */
  checked?: boolean;
  /** Default checked state (uncontrolled) */
  defaultChecked?: boolean;
  /** Change handler */
  onChange?: (checked: boolean) => void;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Disabled state */
  disabled?: boolean;
  /** Label text */
  label?: string;
  /** Label position */
  labelPosition?: "left" | "right";
  /** Additional className for the wrapper */
  className?: string;
  /** Additional className for the label */
  labelClassName?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** Accessible name (for screen readers when no label) */
  "aria-label"?: string;
  /** ID for the toggle */
  id?: string;
}

const sizeConfig = {
  sm: {
    track: "h-5 w-9",
    knob: "h-3.5 w-3.5",
    translate: "translate-x-4",
    padding: "p-0.5",
  },
  md: {
    track: "h-6 w-11",
    knob: "h-4.5 w-4.5",
    translate: "translate-x-5",
    padding: "p-0.75",
  },
  lg: {
    track: "h-7 w-14",
    knob: "h-5.5 w-5.5",
    translate: "translate-x-7",
    padding: "p-0.75",
  },
};

/**
 * GlassToggle - iOS-style toggle switch with glass track and coral accent.
 *
 * Features a glassmorphic track background with a smooth spring-animated knob.
 * Shows coral accent when checked, neutral glass when unchecked.
 *
 * @example
 * // Basic uncontrolled toggle
 * <GlassToggle label="Enable feature" />
 *
 * @example
 * // Controlled toggle with change handler
 * const [enabled, setEnabled] = useState(false);
 * <GlassToggle
 *   checked={enabled}
 *   onChange={setEnabled}
 *   label="Dark mode"
 *   labelPosition="left"
 * />
 *
 * @example
 * // Different sizes
 * <GlassToggle size="sm" label="Small" />
 * <GlassToggle size="md" label="Medium" />
 * <GlassToggle size="lg" label="Large" />
 *
 * @example
 * // Disabled state
 * <GlassToggle
 *   checked
 *   disabled
 *   label="Disabled toggle"
 * />
 */
export function GlassToggle({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  size = "md",
  disabled = false,
  label,
  labelPosition = "right",
  className,
  labelClassName,
  style,
  "aria-label": ariaLabel,
  id,
}: GlassToggleProps) {
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked);

  // Determine if controlled or uncontrolled
  const isControlled = controlledChecked !== undefined;
  const checked = isControlled ? controlledChecked : uncontrolledChecked;

  const config = sizeConfig[size];

  const handleToggle = () => {
    if (disabled) return;

    const newChecked = !checked;

    if (!isControlled) {
      setUncontrolledChecked(newChecked);
    }

    onChange?.(newChecked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleToggle();
    }
  };

  const toggleButton = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        // Base styles - Raycast timing
        "relative inline-flex items-center rounded-full",
        "backdrop-blur-[10px] transition-all duration-[var(--duration-fast)]",
        "ease-[var(--ease-out)]",
        "border border-white/10",
        config.track,
        config.padding,
        // Focus styles - Coral accent
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-background)]",
        checked
          ? "focus:ring-[var(--color-accent-transparent)]"
          : "focus:ring-white/20",
        // Interactive states
        !disabled && "cursor-pointer",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
      )}
      style={{
        backgroundColor: checked
          ? "var(--color-accent-transparent)" // Coral glass when checked
          : "var(--color-bg-100)", // Raycast bg-100 when unchecked
        ...style,
      }}
    >
      {/* Knob */}
      <span
        className={cn(
          // Base knob styles
          "inline-block rounded-full",
          "transition-all duration-[var(--duration-fast)]",
          "shadow-md",
          config.knob,
          // Translation
          checked && config.translate,
          // Disabled state
          disabled && "opacity-80",
        )}
        style={{
          backgroundColor: checked
            ? "var(--color-accent)" // Coral when checked
            : "var(--color-fg)", // White when unchecked
          transitionTimingFunction: "var(--ease-spring)",
          boxShadow: checked
            ? "0 0 0 1px rgba(229, 120, 80, 0.1)"
            : "0 2px 4px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)",
        }}
      />
    </button>
  );

  // If no label, return just the toggle
  if (!label) {
    return toggleButton;
  }

  // Return toggle with label
  return (
    <label
      className={cn(
        "inline-flex items-center gap-3",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className
      )}
    >
      {labelPosition === "left" && (
        <span
          className={cn(
            "text-[14px] font-medium",
            disabled ? "text-[var(--color-fg-400)]" : "text-[var(--color-fg-200)]",
            labelClassName
          )}
        >
          {label}
        </span>
      )}

      {toggleButton}

      {labelPosition === "right" && (
        <span
          className={cn(
            "text-[14px] font-medium",
            disabled ? "text-[var(--color-fg-400)]" : "text-[var(--color-fg-200)]",
            labelClassName
          )}
        >
          {label}
        </span>
      )}
    </label>
  );
}
