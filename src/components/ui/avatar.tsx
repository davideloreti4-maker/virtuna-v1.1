"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Avatar size variants using CVA.
 *
 * Sizes follow the design system scale:
 * - `xs`: 24px — inline indicators
 * - `sm`: 32px — compact lists
 * - `md`: 40px — default, cards/comments
 * - `lg`: 48px — profile headers
 * - `xl`: 64px — hero/profile pages
 */
const avatarRootVariants = cva(
  [
    "relative inline-flex shrink-0 overflow-hidden rounded-full",
    "border border-border-glass bg-surface-elevated",
  ],
  {
    variants: {
      size: {
        xs: "h-6 w-6",
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
        xl: "h-16 w-16",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

/**
 * Fallback text size mapped to avatar size.
 */
const fallbackTextSize: Record<string, string> = {
  xs: "text-[10px]",
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-[15px]",
  xl: "text-[18px]",
};

/* ============================================
 * LOW-LEVEL PRIMITIVES
 * For advanced/custom composition
 * ============================================ */

/**
 * AvatarRoot — Low-level Radix Avatar root with size variants.
 */
const AvatarRoot = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> &
    VariantProps<typeof avatarRootVariants>
>(({ className, size, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(avatarRootVariants({ size, className }))}
    {...props}
  />
));
AvatarRoot.displayName = "AvatarRoot";

/**
 * AvatarImage — Low-level Radix Avatar image.
 *
 * Radix handles the image loading lifecycle: it shows the fallback
 * while the image loads and permanently if it fails.
 */
const AvatarImage = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = "AvatarImage";

/**
 * AvatarFallback — Low-level Radix Avatar fallback.
 *
 * Rendered when the image is loading or has failed.
 * Typically shows initials or an icon.
 */
const AvatarFallback = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center",
      "bg-surface text-foreground-secondary font-medium",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";

/* ============================================
 * CONVENIENCE COMPOUND COMPONENT
 * Simple API: <Avatar src="..." fallback="DL" />
 * ============================================ */

/**
 * Props for the convenience Avatar component.
 */
export interface AvatarProps {
  /** Image source URL */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** Fallback initials (e.g., "DL" for Davide Loreti) */
  fallback?: string;
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Additional className */
  className?: string;
}

/**
 * Avatar — Convenience component composing Radix Avatar primitives.
 *
 * Renders an image with automatic fallback to initials when the image
 * fails to load. Uses Radix's built-in image lifecycle management.
 *
 * @example
 * ```tsx
 * // With image
 * <Avatar src="/photo.jpg" alt="Davide Loreti" fallback="DL" />
 *
 * // Initials only
 * <Avatar fallback="DL" size="lg" />
 *
 * // Different sizes
 * <Avatar src="/photo.jpg" size="xs" />
 * <Avatar src="/photo.jpg" size="xl" />
 * ```
 */
const Avatar = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ src, alt, fallback, size = "md", className }, ref) => (
  <AvatarRoot ref={ref} size={size} className={className}>
    {src && <AvatarImage src={src} alt={alt ?? ""} />}
    {fallback && (
      <AvatarFallback className={fallbackTextSize[size]}>
        {fallback}
      </AvatarFallback>
    )}
  </AvatarRoot>
));
Avatar.displayName = "Avatar";

/* ============================================
 * AVATAR GROUP
 * Overlapping avatar stack with +N count
 * ============================================ */

/**
 * Props for the AvatarGroup component.
 */
export interface AvatarGroupProps {
  /** Avatar elements to render */
  children: React.ReactNode;
  /** Maximum visible avatars (remaining shows +N) */
  max?: number;
  /** Size applied to the overflow count avatar */
  size?: AvatarProps["size"];
  /** Additional className */
  className?: string;
}

/**
 * AvatarGroup — Displays overlapping avatars with an optional +N count.
 *
 * Each child avatar gets a ring for visual separation when overlapped.
 * If `max` is set and there are more children, a "+N" circle is appended.
 *
 * @example
 * ```tsx
 * <AvatarGroup max={3} size="sm">
 *   <Avatar src="/user1.jpg" fallback="A" />
 *   <Avatar src="/user2.jpg" fallback="B" />
 *   <Avatar src="/user3.jpg" fallback="C" />
 *   <Avatar src="/user4.jpg" fallback="D" />
 *   <Avatar src="/user5.jpg" fallback="E" />
 * </AvatarGroup>
 * // Renders 3 avatars + "+2" circle
 * ```
 */
function AvatarGroup({
  children,
  max,
  size = "md",
  className,
}: AvatarGroupProps): React.JSX.Element {
  const childArray = React.Children.toArray(children);
  const visibleChildren = max ? childArray.slice(0, max) : childArray;
  const remainingCount = max ? Math.max(0, childArray.length - max) : 0;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {visibleChildren.map((child, index) => (
        <div key={index} className="ring-2 ring-background rounded-full">
          {child}
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="ring-2 ring-background rounded-full">
          <Avatar fallback={`+${remainingCount}`} size={size} />
        </div>
      )}
    </div>
  );
}
AvatarGroup.displayName = "AvatarGroup";

export {
  Avatar,
  AvatarRoot,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  avatarRootVariants,
};
