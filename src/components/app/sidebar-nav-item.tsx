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
 * Active state: subtle filled background (white/6%) with foreground text color
 * and icon weight changes to "fill" for visual emphasis. Matches Raycast's selection style.
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
        "w-full justify-start gap-3",
        isActive
          ? "bg-white/[0.06] text-foreground"
          : "text-foreground-secondary",
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
