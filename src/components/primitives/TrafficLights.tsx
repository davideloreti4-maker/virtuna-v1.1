"use client";

import { cn } from "@/lib/utils";

export interface TrafficLightsProps {
  /** Size variant: sm (10px), md (12px), lg (14px) */
  size?: "sm" | "md" | "lg";
  /** Interactive mode - shows hover icons */
  interactive?: boolean;
  /** Disabled/inactive appearance */
  disabled?: boolean;
  /** Additional className for the container */
  className?: string;
  /** Callback when close button clicked (only in interactive mode) */
  onClose?: () => void;
  /** Callback when minimize button clicked (only in interactive mode) */
  onMinimize?: () => void;
  /** Callback when maximize button clicked (only in interactive mode) */
  onMaximize?: () => void;
}

// Exact macOS traffic light colors
const colors = {
  close: {
    fill: "#ed6a5f",
    border: "#e24b41",
  },
  minimize: {
    fill: "#f6be50",
    border: "#e1a73e",
  },
  maximize: {
    fill: "#61c555",
    border: "#2dac2f",
  },
  disabled: {
    fill: "#3d3d3d",
    border: "#2a2a2a",
  },
};

// Size mapping
const sizeMap = {
  sm: 10,
  md: 12,
  lg: 14,
};

/**
 * TrafficLights - macOS window control buttons.
 *
 * Renders the iconic red/yellow/green circles used in macOS window chrome.
 * Optional interactive mode shows x/-/+ icons on hover.
 *
 * @example
 * // Static (decorative)
 * <TrafficLights size="md" />
 *
 * // Interactive
 * <TrafficLights interactive onClose={() => closeWindow()} />
 */
export function TrafficLights({
  size = "md",
  interactive = false,
  disabled = false,
  className,
  onClose,
  onMinimize,
  onMaximize,
}: TrafficLightsProps) {
  const buttonSize = sizeMap[size];
  const gap = Math.round(buttonSize * 0.67); // ~8px gap for 12px buttons

  const buttonStyle = (color: keyof typeof colors) => ({
    width: buttonSize,
    height: buttonSize,
    backgroundColor: disabled ? colors.disabled.fill : colors[color].fill,
    borderColor: disabled ? colors.disabled.border : colors[color].border,
  });

  const Button = ({
    color,
    onClick,
    label,
  }: {
    color: "close" | "minimize" | "maximize";
    onClick?: () => void;
    label: string;
  }) => (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={disabled || !interactive}
      aria-label={label}
      className={cn(
        "rounded-full border transition-transform",
        interactive && !disabled && "hover:scale-110 cursor-pointer",
        !interactive && "cursor-default",
        disabled && "opacity-50"
      )}
      style={buttonStyle(color)}
    />
  );

  return (
    <div
      className={cn("flex items-center", className)}
      style={{ gap }}
      role="group"
      aria-label="Window controls"
    >
      <Button color="close" onClick={onClose} label="Close window" />
      <Button color="minimize" onClick={onMinimize} label="Minimize window" />
      <Button color="maximize" onClick={onMaximize} label="Maximize window" />
    </div>
  );
}
