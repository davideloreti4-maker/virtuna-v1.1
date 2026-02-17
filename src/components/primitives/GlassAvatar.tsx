"use client";

import { cn } from "@/lib/utils";
import { User } from "@phosphor-icons/react";
import { useState, type CSSProperties } from "react";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "online" | "offline" | "away" | "busy";

export interface GlassAvatarProps {
  /** Image source URL */
  src?: string;
  /** Alt text for image */
  alt?: string;
  /** Fallback initials (e.g., "JD" for John Doe) */
  fallback?: string;
  /** Size variant */
  size?: AvatarSize;
  /** Status indicator */
  status?: AvatarStatus;
  /** Additional className */
  className?: string;
  /** Custom style */
  style?: CSSProperties;
}

// Size configurations - Raycast avatar: 20x20 with rounded full
const sizeConfig = {
  xs: { avatar: "w-6 h-6", text: "text-[10px]", icon: 12, status: "w-1.5 h-1.5" },
  sm: { avatar: "w-8 h-8", text: "text-[11px]", icon: 14, status: "w-2 h-2" },
  md: { avatar: "w-10 h-10", text: "text-[13px]", icon: 18, status: "w-2.5 h-2.5" },
  lg: { avatar: "w-12 h-12", text: "text-[15px]", icon: 22, status: "w-3 h-3" },
  xl: { avatar: "w-16 h-16", text: "text-[18px]", icon: 28, status: "w-3.5 h-3.5" },
};

// Status colors
const statusColors: Record<AvatarStatus, string> = {
  online: "var(--color-green)",
  offline: "var(--color-grey-400)",
  away: "var(--color-yellow)",
  busy: "var(--color-red)",
};

/**
 * GlassAvatar - User avatar with glass border ring and status indicator.
 *
 * Features:
 * - Glass border ring
 * - Image with fallback to initials
 * - Status indicator (online/offline/away/busy)
 * - Size variants
 *
 * @example
 * // With image
 * <GlassAvatar
 *   src="/user.jpg"
 *   alt="John Doe"
 *   size="md"
 *   status="online"
 * />
 *
 * @example
 * // With initials fallback
 * <GlassAvatar
 *   fallback="JD"
 *   size="lg"
 * />
 *
 * @example
 * // Avatar group
 * <div className="flex -space-x-2">
 *   <GlassAvatar src="/user1.jpg" />
 *   <GlassAvatar src="/user2.jpg" />
 *   <GlassAvatar fallback="+3" />
 * </div>
 */
export function GlassAvatar({
  src,
  alt,
  fallback,
  size = "md",
  status,
  className,
  style,
}: GlassAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const config = sizeConfig[size];

  const showImage = src && !imageError;
  const showFallback = !showImage && fallback;
  const showIcon = !showImage && !fallback;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        "rounded-full",
        // Glass border ring
        "ring-2 ring-white/10",
        config.avatar,
        className
      )}
      style={{
        backgroundColor: "var(--color-bg-200)",
        ...style,
      }}
    >
      {/* Image */}
      {showImage && (
        <img
          src={src}
          alt={alt || "Avatar"}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover rounded-full"
        />
      )}

      {/* Fallback initials */}
      {showFallback && (
        <span
          className={cn(
            "font-medium text-[var(--color-fg-200)] uppercase",
            config.text
          )}
        >
          {fallback}
        </span>
      )}

      {/* Icon fallback */}
      {showIcon && (
        <User
          size={config.icon}
          weight="bold"
          className="text-[var(--color-fg-400)]"
        />
      )}

      {/* Status indicator */}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0",
            "rounded-full ring-2 ring-[var(--color-bg-100)]",
            config.status
          )}
          style={{
            backgroundColor: statusColors[status],
          }}
        />
      )}
    </div>
  );
}

/**
 * GlassAvatarGroup - Display multiple avatars in a stack.
 */
export function GlassAvatarGroup({
  children,
  max,
  size = "md",
  className,
}: {
  children: React.ReactNode;
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  const childArray = Array.isArray(children) ? children : [children];
  const visibleChildren = max ? childArray.slice(0, max) : childArray;
  const remainingCount = max ? childArray.length - max : 0;

  return (
    <div className={cn("flex -space-x-2", className)}>
      {visibleChildren}
      {remainingCount > 0 && (
        <GlassAvatar fallback={`+${remainingCount}`} size={size} />
      )}
    </div>
  );
}
