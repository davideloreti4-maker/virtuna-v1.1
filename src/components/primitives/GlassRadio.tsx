"use client";

import { cn } from "@/lib/utils";
import { createContext, useContext, type CSSProperties, type ReactNode } from "react";

/** Size variants for radio buttons */
export type GlassRadioSize = "sm" | "md" | "lg";

export interface GlassRadioGroupProps {
  /** Currently selected value */
  value?: string;
  /** Default selected value (uncontrolled) */
  defaultValue?: string;
  /** Change handler - receives the selected value */
  onChange?: (value: string) => void;
  /** Radio group name (for form submission) */
  name?: string;
  /** Disabled state for all radio items */
  disabled?: boolean;
  /** Size variant for all radio items */
  size?: GlassRadioSize;
  /** Additional className for the group wrapper */
  className?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** Children (GlassRadioItem components) */
  children: ReactNode;
  /** Accessible label for the group */
  "aria-label"?: string;
  /** ID of element that labels this group */
  "aria-labelledby"?: string;
}

export interface GlassRadioItemProps {
  /** Value for this radio option */
  value: string;
  /** Label text */
  label?: string;
  /** Disabled state (overrides group disabled) */
  disabled?: boolean;
  /** Size variant (overrides group size) */
  size?: GlassRadioSize;
  /** Additional className for the item wrapper */
  className?: string;
  /** Additional className for the label */
  labelClassName?: string;
  /** Custom style overrides */
  style?: CSSProperties;
  /** ID for the radio button */
  id?: string;
}

// Context for managing radio group state
interface RadioGroupContextValue {
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  size: GlassRadioSize;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

const useRadioGroup = () => {
  const context = useContext(RadioGroupContext);
  if (!context) {
    throw new Error("GlassRadioItem must be used within GlassRadioGroup");
  }
  return context;
};

// Size-specific dimensions
const sizeConfig = {
  sm: {
    radio: "h-4 w-4",
    dot: "h-2 w-2",
    label: "text-sm",
    gap: "gap-2",
  },
  md: {
    radio: "h-5 w-5",
    dot: "h-2.5 w-2.5",
    label: "text-base",
    gap: "gap-2.5",
  },
  lg: {
    radio: "h-6 w-6",
    dot: "h-3 w-3",
    label: "text-lg",
    gap: "gap-3",
  },
};

/**
 * GlassRadioGroup - Container for managing a group of radio buttons.
 *
 * Provides context for child GlassRadioItem components to coordinate selection state.
 * Supports controlled and uncontrolled modes.
 *
 * @example
 * // Basic controlled radio group
 * const [value, setValue] = useState("option1");
 * <GlassRadioGroup value={value} onChange={setValue}>
 *   <GlassRadioItem value="option1" label="Option 1" />
 *   <GlassRadioItem value="option2" label="Option 2" />
 *   <GlassRadioItem value="option3" label="Option 3" />
 * </GlassRadioGroup>
 *
 * @example
 * // Uncontrolled with default value
 * <GlassRadioGroup defaultValue="medium" name="size">
 *   <GlassRadioItem value="small" label="Small" />
 *   <GlassRadioItem value="medium" label="Medium" />
 *   <GlassRadioItem value="large" label="Large" />
 * </GlassRadioGroup>
 *
 * @example
 * // Different sizes
 * <GlassRadioGroup value={size} onChange={setSize} size="lg">
 *   <GlassRadioItem value="xs" label="Extra Small" />
 *   <GlassRadioItem value="sm" label="Small" />
 *   <GlassRadioItem value="md" label="Medium" />
 * </GlassRadioGroup>
 *
 * @example
 * // Disabled group
 * <GlassRadioGroup value="option1" disabled>
 *   <GlassRadioItem value="option1" label="Option 1" />
 *   <GlassRadioItem value="option2" label="Option 2" />
 * </GlassRadioGroup>
 *
 * @example
 * // With individual item disabled
 * <GlassRadioGroup value={plan} onChange={setPlan}>
 *   <GlassRadioItem value="free" label="Free" />
 *   <GlassRadioItem value="pro" label="Pro" />
 *   <GlassRadioItem value="enterprise" label="Enterprise" disabled />
 * </GlassRadioGroup>
 */
export function GlassRadioGroup({
  value: controlledValue,
  defaultValue,
  onChange,
  name,
  disabled = false,
  size = "md",
  className,
  style,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: GlassRadioGroupProps) {
  // For uncontrolled mode, we'll let individual items manage their own state
  // by checking if their value matches the defaultValue
  const value = controlledValue ?? defaultValue;

  return (
    <RadioGroupContext.Provider
      value={{
        value,
        onChange,
        name,
        disabled,
        size,
      }}
    >
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn("flex flex-col gap-3", className)}
        style={style}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

/**
 * GlassRadioItem - Individual radio button option with glass styling.
 *
 * Must be used within a GlassRadioGroup. Features a glassmorphic circle with
 * a coral dot when selected.
 *
 * @example
 * // Basic radio item
 * <GlassRadioItem value="option1" label="Option 1" />
 *
 * @example
 * // Without label (for custom layouts)
 * <GlassRadioItem value="option2" />
 *
 * @example
 * // Individually disabled
 * <GlassRadioItem value="option3" label="Disabled Option" disabled />
 */
export function GlassRadioItem({
  value,
  label,
  disabled: itemDisabled,
  size: itemSize,
  className,
  labelClassName,
  style,
  id,
}: GlassRadioItemProps) {
  const group = useRadioGroup();

  const size = itemSize ?? group.size;
  const disabled = itemDisabled ?? group.disabled ?? false;
  const isChecked = group.value === value;
  const config = sizeConfig[size];

  const handleClick = () => {
    if (disabled) return;
    group.onChange?.(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      group.onChange?.(value);
    }
  };

  const radioButton = (
    <div
      role="radio"
      aria-checked={isChecked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      id={id}
      className={cn(
        // Base styles - Raycast timing
        "relative inline-flex items-center justify-center rounded-full",
        "backdrop-blur-[8px] transition-all duration-[var(--duration-fast)]",
        "ease-[var(--ease-out)]",
        "border",
        config.radio,
        // Focus styles
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-background)]",
        isChecked
          ? "focus:ring-[var(--color-accent-transparent)]"
          : "focus:ring-white/20",
        // Interactive states
        !disabled && "cursor-pointer",
        // Border color
        isChecked
          ? "border-[var(--color-accent)]"
          : "border-white/10",
        // Hover state
        !disabled && !isChecked && "hover:border-white/[0.1]",
        !disabled && isChecked && "hover:border-[var(--color-accent)]",
        // Disabled state
        disabled && "opacity-50 cursor-not-allowed",
      )}
      style={{
        backgroundColor: isChecked
          ? "var(--color-accent-transparent)" // Coral tint when checked
          : "rgba(255, 255, 255, 0.05)", // Raycast glass when unchecked
        ...style,
      }}
    >
      {/* Hidden native input for form submission */}
      {group.name && (
        <input
          type="radio"
          name={group.name}
          value={value}
          checked={isChecked}
          onChange={() => {}}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Selected dot with smooth scale animation */}
      <span
        className={cn(
          "rounded-full transition-all duration-[var(--duration-fast)]",
          config.dot,
          isChecked ? "scale-100 opacity-100" : "scale-0 opacity-0"
        )}
        style={{
          backgroundColor: "var(--color-accent)", // Coral dot
          transitionTimingFunction: "var(--ease-spring)",
        }}
      />
    </div>
  );

  // If no label, return just the radio button
  if (!label) {
    return radioButton;
  }

  // Return radio button with label
  return (
    <label
      className={cn(
        "inline-flex items-center",
        config.gap,
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className
      )}
    >
      {radioButton}

      <span
        className={cn(
          "font-medium",
          config.label,
          disabled ? "text-[var(--color-fg-400)]" : "text-[var(--color-fg-200)]",
          "transition-colors duration-[var(--duration-fast)]",
          labelClassName
        )}
      >
        {label}
      </span>
    </label>
  );
}
