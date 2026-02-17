"use client";

import { cn } from "@/lib/utils";
import { Check, Minus } from "@phosphor-icons/react";
import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type CSSProperties,
} from "react";

/** Size variants for the checkbox */
export type GlassCheckboxSize = "sm" | "md" | "lg";

export interface GlassCheckboxProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "size" | "type" | "onChange"
  > {
  /** Size variant of the checkbox */
  size?: GlassCheckboxSize;
  /** Controlled checked state */
  checked?: boolean;
  /** Default checked state (uncontrolled) */
  defaultChecked?: boolean;
  /** Indeterminate state (shows minus icon) */
  indeterminate?: boolean;
  /** Change handler */
  onChange?: (checked: boolean) => void;
  /** Label text */
  label?: string;
  /** Label position */
  labelPosition?: "left" | "right";
  /** Additional className for the wrapper */
  wrapperClassName?: string;
  /** Additional className for the label */
  labelClassName?: string;
  /** Custom style overrides for the checkbox */
  checkboxStyle?: CSSProperties;
}

// Size-specific dimensions and icon sizes
const sizeConfig = {
  sm: {
    box: "h-4 w-4",
    icon: 12,
    text: "text-sm",
  },
  md: {
    box: "h-5 w-5",
    icon: 16,
    text: "text-base",
  },
  lg: {
    box: "h-6 w-6",
    icon: 20,
    text: "text-lg",
  },
};

/**
 * GlassCheckbox - Glassmorphism checkbox with coral check mark.
 *
 * Features:
 * - Glass background with subtle blur
 * - Coral check mark with scale animation (Raycast-style)
 * - States: unchecked, checked, indeterminate, disabled
 * - Size variants (sm, md, lg)
 * - Optional label with left/right positioning
 * - Controlled and uncontrolled modes
 * - Spring-animated check appearance
 * - Full accessibility support
 *
 * @example
 * // Basic uncontrolled checkbox
 * <GlassCheckbox label="Accept terms" />
 *
 * @example
 * // Controlled checkbox with change handler
 * const [agreed, setAgreed] = useState(false);
 * <GlassCheckbox
 *   checked={agreed}
 *   onChange={setAgreed}
 *   label="I agree to the terms"
 *   labelPosition="right"
 * />
 *
 * @example
 * // Different sizes
 * <GlassCheckbox size="sm" label="Small" />
 * <GlassCheckbox size="md" label="Medium" />
 * <GlassCheckbox size="lg" label="Large" />
 *
 * @example
 * // Indeterminate state (for "select all" scenarios)
 * <GlassCheckbox
 *   indeterminate
 *   label="Select all items"
 *   onChange={(checked) => {
 *     if (checked) selectAll();
 *     else deselectAll();
 *   }}
 * />
 *
 * @example
 * // Disabled states
 * <GlassCheckbox checked disabled label="Checked and disabled" />
 * <GlassCheckbox disabled label="Unchecked and disabled" />
 *
 * @example
 * // Label on the left
 * <GlassCheckbox
 *   label="Enable feature"
 *   labelPosition="left"
 * />
 */
export const GlassCheckbox = forwardRef<HTMLInputElement, GlassCheckboxProps>(
  (
    {
      size = "md",
      checked: controlledChecked,
      defaultChecked = false,
      indeterminate = false,
      onChange,
      label,
      labelPosition = "right",
      disabled = false,
      className,
      wrapperClassName,
      labelClassName,
      checkboxStyle,
      id,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const [uncontrolledChecked, setUncontrolledChecked] =
      useState(defaultChecked);

    // Determine if controlled or uncontrolled
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : uncontrolledChecked;

    const config = sizeConfig[size];

    const handleChange = () => {
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
        handleChange();
      }
    };

    // Determine which icon to show
    const showCheck = (checked || indeterminate) && !disabled;
    const IconComponent = indeterminate ? Minus : Check;

    const checkboxElement = (
      <div className="relative inline-flex items-center">
        {/* Hidden native checkbox for accessibility */}
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          className="sr-only"
          aria-checked={indeterminate ? "mixed" : checked}
          aria-label={ariaLabel || label}
          {...props}
        />

        {/* Custom checkbox UI */}
        <div
          role="checkbox"
          aria-checked={indeterminate ? "mixed" : checked}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          onClick={handleChange}
          className={cn(
            // Base glass styling - Raycast timing
            "relative inline-flex items-center justify-center",
            "rounded-[var(--rounding-sm)]",
            "border transition-all",
            "duration-[var(--duration-fast)]",
            "ease-[var(--ease-out)]",
            config.box,

            // Border states
            !checked &&
              !indeterminate &&
              "border-white/[0.06] hover:border-white/[0.1]",
            (checked || indeterminate) && "border-[var(--color-accent)]",

            // Background states
            (checked || indeterminate) && "bg-[var(--color-accent-transparent)]",

            // Interactive states
            !disabled && "cursor-pointer",

            // Focus state (Raycast-style)
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-transparent)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]",

            // Disabled state
            disabled && "opacity-50 cursor-not-allowed",

            className
          )}
          style={{
            backgroundColor: !checked && !indeterminate
              ? "rgba(255, 255, 255, 0.05)"
              : undefined,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            ...checkboxStyle,
          }}
        >
          {/* Check/Minus Icon with scale animation */}
          {showCheck && (
            <IconComponent
              size={config.icon}
              weight="bold"
              className={cn(
                "text-[var(--color-accent)]",
                "animate-scale-in",
                "transition-all duration-[var(--duration-fast)]"
              )}
              style={{
                transitionTimingFunction: "var(--ease-spring)",
              }}
            />
          )}
        </div>
      </div>
    );

    // If no label, return just the checkbox
    if (!label) {
      return checkboxElement;
    }

    // Return checkbox with label
    return (
      <label
        htmlFor={id}
        className={cn(
          "inline-flex items-center gap-2",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          wrapperClassName
        )}
      >
        {labelPosition === "left" && (
          <span
            className={cn(
              "font-medium",
              config.text,
              disabled ? "text-text-tertiary" : "text-text-secondary",
              "transition-colors duration-[var(--duration-fast)]",
              labelClassName
            )}
          >
            {label}
          </span>
        )}

        {checkboxElement}

        {labelPosition === "right" && (
          <span
            className={cn(
              "font-medium",
              config.text,
              disabled ? "text-text-tertiary" : "text-text-secondary",
              "transition-colors duration-[var(--duration-fast)]",
              labelClassName
            )}
          >
            {label}
          </span>
        )}
      </label>
    );
  }
);

GlassCheckbox.displayName = "GlassCheckbox";
