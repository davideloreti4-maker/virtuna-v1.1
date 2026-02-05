"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Tabs — Radix-based tab system with Raycast glass pill styling.
 *
 * Built on @radix-ui/react-tabs for full accessibility:
 * - Arrow key navigation between triggers
 * - Home/End key support
 * - Automatic roving tabindex
 * - ARIA roles (tablist, tab, tabpanel)
 *
 * @example
 * ```tsx
 * <Tabs defaultValue="overview">
 *   <TabsList>
 *     <TabsTrigger value="overview">Overview</TabsTrigger>
 *     <TabsTrigger value="settings">Settings</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="overview">Overview content</TabsContent>
 *   <TabsContent value="settings">Settings content</TabsContent>
 * </Tabs>
 * ```
 */
const Tabs = TabsPrimitive.Root;

/**
 * TabsList — Container for tab triggers with glass pill track background.
 *
 * Styled as an inline-flex pill container with `bg-surface-elevated`
 * and a subtle `border-white/5` border, matching Raycast's tab list pattern.
 */
const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex items-center gap-1 rounded-full",
      "border border-white/5 bg-surface-elevated p-1",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

/**
 * TabsTrigger variant styles using CVA.
 *
 * Active state shows Raycast glass pill styling:
 * - `bg-white/5` background
 * - `border-white/10` border
 * - White foreground text with subtle shadow
 *
 * Inactive state uses muted text with transparent border.
 */
const tabsTriggerVariants = cva(
  // Base styles
  [
    "inline-flex items-center justify-center whitespace-nowrap rounded-full",
    "font-medium transition-all duration-200",
    // Focus
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
    // Disabled
    "disabled:pointer-events-none disabled:opacity-50",
    // Inactive state (default)
    "text-foreground-secondary border border-transparent",
    "hover:text-foreground hover:bg-white/[0.03]",
    // Active state — Raycast glass pill
    "data-[state=active]:bg-white/5 data-[state=active]:border-white/10",
    "data-[state=active]:text-foreground data-[state=active]:shadow-sm",
  ],
  {
    variants: {
      /**
       * Size variant controlling padding and font size.
       * - `sm`: Compact, 12px text
       * - `md`: Default, 14px text
       * - `lg`: Prominent, 16px text
       */
      size: {
        sm: "px-3 py-1 text-xs",
        md: "px-4 py-1.5 text-sm",
        lg: "px-5 py-2 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

/**
 * TabsTrigger — Individual tab button with Raycast glass pill styling.
 *
 * Accessibility is handled entirely by Radix:
 * - `role="tab"` with `aria-selected`
 * - Arrow key navigation (roving tabindex)
 * - Home/End key support
 */
const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> &
    VariantProps<typeof tabsTriggerVariants>
>(({ className, size, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabsTriggerVariants({ size, className }))}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

/**
 * TabsContent — Content panel displayed when its matching trigger is active.
 *
 * Includes top margin for spacing and focus-visible ring for keyboard users.
 */
const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsTriggerVariants };
