"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

/* ============================================
 * CATEGORY TABS — Raycast-style category navigation
 * Horizontal scrollable tab nav with icons and counts
 * ============================================ */

/**
 * Category definition for a single tab.
 */
export interface CategoryTab {
  /** Unique value identifier for this category */
  value: string;
  /** Display label */
  label: string;
  /** Optional icon rendered before the label */
  icon?: React.ReactNode;
  /** Optional count displayed after the label */
  count?: number;
}

/**
 * Props for the CategoryTabs component.
 */
export interface CategoryTabsProps {
  /** Array of category definitions */
  categories: CategoryTab[];
  /**
   * Default active category value (uncontrolled).
   * Falls back to the first category's value if not provided.
   */
  defaultValue?: string;
  /** Controlled active category value */
  value?: string;
  /** Callback when active category changes */
  onValueChange?: (value: string) => void;
  /** TabsContent children matching category values */
  children: React.ReactNode;
  /** Additional className for the root Tabs container */
  className?: string;
}

/**
 * CategoryTabs — Raycast-style horizontal scrollable category navigation.
 *
 * Composes the base Tabs, TabsList, and TabsTrigger components with
 * category-specific styling: horizontal scroll on mobile, icons, and
 * count badges. User provides TabsContent children matching category values.
 *
 * @example
 * ```tsx
 * import { CategoryTabs, CategoryTabsProps } from "@/components/ui/category-tabs";
 * import { TabsContent } from "@/components/ui/tabs";
 *
 * const categories = [
 *   { value: "all", label: "All", count: 42 },
 *   { value: "productivity", label: "Productivity", icon: <ZapIcon />, count: 12 },
 *   { value: "developer", label: "Developer Tools", icon: <CodeIcon />, count: 18 },
 *   { value: "design", label: "Design", icon: <PaletteIcon />, count: 8 },
 * ];
 *
 * <CategoryTabs categories={categories} defaultValue="all">
 *   <TabsContent value="all">All extensions...</TabsContent>
 *   <TabsContent value="productivity">Productivity extensions...</TabsContent>
 *   <TabsContent value="developer">Developer extensions...</TabsContent>
 *   <TabsContent value="design">Design extensions...</TabsContent>
 * </CategoryTabs>
 * ```
 */
const CategoryTabs = React.forwardRef<HTMLDivElement, CategoryTabsProps>(
  (
    {
      categories,
      defaultValue,
      value,
      onValueChange,
      children,
      className,
    },
    ref,
  ) => {
    const resolvedDefault = defaultValue ?? categories[0]?.value;

    return (
      <Tabs
        ref={ref}
        defaultValue={value === undefined ? resolvedDefault : undefined}
        value={value}
        onValueChange={onValueChange}
        className={className}
      >
        {/* Scrollable tab list */}
        <TabsList
          className={cn(
            "w-full justify-start overflow-x-auto",
            "scrollbar-none flex-nowrap",
            "rounded-lg border-white/5 bg-transparent p-0",
            "gap-1",
          )}
        >
          {categories.map((category) => (
            <TabsTrigger
              key={category.value}
              value={category.value}
              className="shrink-0"
            >
              {category.icon != null && (
                <span className="mr-1.5 inline-flex">{category.icon}</span>
              )}
              {category.label}
              {category.count !== undefined && (
                <span className="ml-1.5 text-xs text-foreground-muted">
                  ({category.count})
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* User-provided TabsContent children */}
        {children}
      </Tabs>
    );
  },
);
CategoryTabs.displayName = "CategoryTabs";

export { CategoryTabs, TabsContent };
