"use client";

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface SidebarNavItemProps {
  icon: PhosphorIcon;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  badge?: number;
  className?: string;
}

/**
 * Navigation item for sidebar menus.
 * Displays icon-left, label-right layout using Button ghost + Icon + Text.
 *
 * Active state: coral left-border indicator (2px) with subtle bg highlight
 * (white/4%) and icon weight changes to "fill" for visual emphasis.
 */
export function SidebarNavItem({
  icon,
  label,
  isActive = false,
  onClick,
  badge,
  className,
}: SidebarNavItemProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "w-full justify-start gap-3 border-l-2",
        isActive
          ? "border-accent bg-white/[0.04] text-foreground"
          : "border-transparent text-foreground-secondary",
        className
      )}
    >
      <Icon
        icon={icon}
        size={20}
        weight={isActive ? "fill" : "regular"}
      />
      <Text as="span" size="sm" className={cn(
        isActive ? "text-foreground" : "text-foreground-secondary",
      )}>
        {label}
      </Text>
      {badge != null && badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/20 px-1.5 text-xs font-medium text-accent">
          {badge}
        </span>
      )}
    </Button>
  );
}
