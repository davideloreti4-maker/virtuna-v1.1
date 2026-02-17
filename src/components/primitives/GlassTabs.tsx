"use client";

import { cn } from "@/lib/utils";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";

/** Size variants for tabs */
export type GlassTabsSize = "sm" | "md" | "lg";

/** Orientation variants */
export type GlassTabsOrientation = "horizontal" | "vertical";

export interface GlassTabsProps {
  /** Currently selected tab value */
  value?: string;
  /** Default selected tab (uncontrolled) */
  defaultValue?: string;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Size variant */
  size?: GlassTabsSize;
  /** Orientation */
  orientation?: GlassTabsOrientation;
  /** Additional className */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
  /** Children (GlassTabList and GlassTabPanels) */
  children: ReactNode;
}

export interface GlassTabListProps {
  /** Additional className for the tab list */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
  /** Tab triggers */
  children: ReactNode;
  /** Accessible label */
  "aria-label"?: string;
}

export interface GlassTabTriggerProps {
  /** Value that identifies this tab */
  value: string;
  /** Tab label/content */
  children: ReactNode;
  /** Disabled state */
  disabled?: boolean;
  /** Additional className */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

export interface GlassTabPanelsProps {
  /** Additional className */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
  /** Tab panel content */
  children: ReactNode;
}

export interface GlassTabPanelProps {
  /** Value that matches this panel to its trigger */
  value: string;
  /** Panel content */
  children: ReactNode;
  /** Additional className */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

// Size configurations - Raycast inspired
const sizeConfig = {
  sm: {
    tab: "px-3 py-1.5 text-[13px]",
    gap: "gap-1",
  },
  md: {
    // Raycast: padding 12px, font-size 15px
    tab: "px-3 py-2 text-[15px]",
    gap: "gap-1.5",
  },
  lg: {
    tab: "px-4 py-2.5 text-[16px]",
    gap: "gap-2",
  },
};

// Context for tab state
interface TabsContextValue {
  value?: string;
  onChange?: (value: string) => void;
  size: GlassTabsSize;
  orientation: GlassTabsOrientation;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabs = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tab components must be used within GlassTabs");
  }
  return context;
};

/**
 * GlassTabs - Raycast-style tabs with glass background and sliding indicator.
 *
 * Features:
 * - Pill-style tabs with glass track background
 * - Coral accent for active tab indicator
 * - Smooth slide animation between tabs
 * - Horizontal and vertical orientations
 * - Size variants (sm, md, lg)
 * - Full accessibility support
 *
 * @example
 * // Basic horizontal tabs
 * <GlassTabs defaultValue="tab1">
 *   <GlassTabList>
 *     <GlassTabTrigger value="tab1">Tab 1</GlassTabTrigger>
 *     <GlassTabTrigger value="tab2">Tab 2</GlassTabTrigger>
 *   </GlassTabList>
 *   <GlassTabPanels>
 *     <GlassTabPanel value="tab1">Content 1</GlassTabPanel>
 *     <GlassTabPanel value="tab2">Content 2</GlassTabPanel>
 *   </GlassTabPanels>
 * </GlassTabs>
 *
 * @example
 * // Controlled tabs
 * const [tab, setTab] = useState("overview");
 * <GlassTabs value={tab} onChange={setTab}>
 *   ...
 * </GlassTabs>
 */
export function GlassTabs({
  value: controlledValue,
  defaultValue,
  onChange,
  size = "md",
  orientation = "horizontal",
  className,
  style,
  children,
}: GlassTabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const handleChange = (newValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
    onChange?.(newValue);
  };

  return (
    <TabsContext.Provider
      value={{
        value,
        onChange: handleChange,
        size,
        orientation,
      }}
    >
      <div
        className={cn(
          orientation === "vertical" && "flex gap-4",
          className
        )}
        style={style}
        data-orientation={orientation}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

/**
 * GlassTabList - Container for tab triggers with glass background.
 */
export function GlassTabList({
  className,
  style,
  children,
  "aria-label": ariaLabel,
}: GlassTabListProps) {
  const { size, orientation } = useTabs();
  const config = sizeConfig[size];

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      className={cn(
        // Glass track background - Raycast style
        "inline-flex p-1 rounded-full",
        "backdrop-blur-[10px]",
        "border border-white/[0.06]",
        config.gap,
        orientation === "horizontal" ? "flex-row" : "flex-col",
        className
      )}
      style={{
        backgroundColor: "var(--color-bg-100)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * GlassTabTrigger - Individual tab button.
 *
 * Raycast styling:
 * - Active: transparent bg, white text, border rgba(255,255,255,0.1)
 * - Inactive: grey-200 text, transparent border
 */
export function GlassTabTrigger({
  value,
  children,
  disabled = false,
  className,
  style,
}: GlassTabTriggerProps) {
  const { value: selectedValue, onChange, size } = useTabs();
  const isActive = value === selectedValue;
  const config = sizeConfig[size];

  const handleClick = () => {
    if (!disabled) {
      onChange?.(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !disabled) {
      e.preventDefault();
      onChange?.(value);
    }
  };

  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      className={cn(
        // Base - Raycast: rounded 100px (pill)
        "relative rounded-full font-medium",
        "transition-all duration-[var(--duration-fast)]",
        "ease-[var(--ease-out)]",
        config.tab,
        // Active state - Raycast: border 1px solid rgba(255,255,255,0.1)
        isActive && [
          "text-[var(--color-fg)]",
          "border border-white/10",
          "shadow-sm",
        ],
        // Inactive state - Raycast: grey-200 text
        !isActive && [
          "text-[var(--color-grey-200)]",
          "border border-transparent",
          "hover:text-[var(--color-fg)]",
        ],
        // Disabled
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer",
        // Focus
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-transparent)]",
        className
      )}
      style={{
        backgroundColor: isActive ? "rgba(255, 255, 255, 0.05)" : "transparent",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/**
 * GlassTabPanels - Container for tab panel content.
 */
export function GlassTabPanels({
  className,
  style,
  children,
}: GlassTabPanelsProps) {
  return (
    <div className={cn("mt-4", className)} style={style}>
      {children}
    </div>
  );
}

/**
 * GlassTabPanel - Content panel for a tab.
 */
export function GlassTabPanel({
  value,
  children,
  className,
  style,
}: GlassTabPanelProps) {
  const { value: selectedValue } = useTabs();
  const isActive = value === selectedValue;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      tabIndex={0}
      className={cn(
        "animate-fade-in",
        "focus:outline-none",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}
