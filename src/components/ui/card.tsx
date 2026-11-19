import * as React from "react";

import { cn } from "@/lib/utils";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";

/* ============================================
 * CARD COMPONENT TYPES
 * ============================================ */

/**
 * Props for the Card component
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

/**
 * Props for the GlassCard component with glassmorphism effects
 */
export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Blur intensity for glassmorphism effect
   * @default "md"
   */
  blur?: "sm" | "md" | "lg";
  /** Show inner glow effect on top edge
   * @default true
   */
  glow?: boolean;
}

/* ============================================
 * CARD COMPONENT
 * Basic card with surface background and border
 * ============================================ */

// The legacy surface is an INLINE style (transparent + an inset white line), which no class can
// override. So the new look is chosen with the flag here, not with a `next:` variant.
const LEGACY_CARD_STYLE = {
  background: "transparent",
  boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset",
} as const;

/**
 * Basic Card component with dark surface styling.
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <h3>Card Title</h3>
 *   </CardHeader>
 *   <CardContent>
 *     <p>Card content goes here.</p>
 *   </CardContent>
 *   <CardFooter>
 *     <Button>Action</Button>
 *   </CardFooter>
 * </Card>
 * ```
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        NEW_LOOK_ENABLED
          ? // Spec §7: surface, radius 24, the resting shadow (which carries the hairline), padding 16.
            "rounded-3xl bg-surface p-4 shadow-[var(--shadow-rest)]"
          : "border border-border rounded-[12px] transition-colors duration-150 hover:bg-white/[0.02]",
        className
      )}
      style={NEW_LOOK_ENABLED ? style : { ...LEGACY_CARD_STYLE, ...style }}
      {...props}
    />
  )
);
Card.displayName = "Card";

/**
 * Tile — a card inside a card (new look). Radius 20, hairline only, no shadow.
 * A card is never nested more than once; the inner one is a tile.
 */
const Tile = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-2xl border border-border p-4", className)}
      {...props}
    />
  )
);
Tile.displayName = "Tile";

/* ============================================
 * GLASS CARD COMPONENT
 * Raycast-style glassmorphism with blur and glow
 * ============================================ */

/** Blur values mapping */
const blurValues = {
  sm: "8px",
  md: "12px",
  lg: "20px",
} as const;

/**
 * GlassCard component with Raycast-style glassmorphism effect.
 * Features frosted glass background, blur, and optional inner glow.
 *
 * @example
 * ```tsx
 * // Default glass card
 * <GlassCard>
 *   <CardContent>
 *     <p>Glassmorphism content</p>
 *   </CardContent>
 * </GlassCard>
 *
 * // Strong blur with glow
 * <GlassCard blur="lg" glow>
 *   <CardHeader>Premium Feature</CardHeader>
 *   <CardContent>Enhanced glass effect</CardContent>
 * </GlassCard>
 *
 * // Subtle blur without glow
 * <GlassCard blur="sm" glow={false}>
 *   <CardContent>Minimal glass styling</CardContent>
 * </GlassCard>
 * ```
 */
const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, blur = "md", glow = true, style, ...props }, ref) => {
    const blurValue = blurValues[blur];

    // Inner glow: rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset
    const glowShadow = glow
      ? "rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset"
      : undefined;

    return (
      <div
        ref={ref}
        className={cn("border border-border rounded-[12px] transition-colors duration-150 hover:bg-white/[0.02]", className)}
        style={{
          background: "transparent",
          // Glassmorphism blur with Safari prefix
          backdropFilter: `blur(${blurValue})`,
          WebkitBackdropFilter: `blur(${blurValue})`,
          // Inner glow effect
          boxShadow: glowShadow,
          ...style,
        }}
        {...props}
      />
    );
  }
);
GlassCard.displayName = "GlassCard";

/* ============================================
 * COMPOUND SUB-COMPONENTS
 * Work with both Card and GlassCard
 * ============================================ */

/**
 * Card header section with default padding.
 * Use for titles, descriptions, and header actions.
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 next:p-0 next:pb-3", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

/**
 * Card content section with padding (no top padding to connect with header).
 * Use for main card body content.
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0 next:p-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

/**
 * Card footer section with flex layout.
 * Use for actions, buttons, and footer content.
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0 next:p-0 next:pt-3", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, GlassCard, CardHeader, CardContent, CardFooter, Tile };
