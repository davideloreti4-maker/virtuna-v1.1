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
  className?: string;
}

/**
 * Navigation item for sidebar menus.
 * Displays icon-left, label-right layout using Button ghost + Icon + Text.
 *
 * Active state: filled background (bg-active) with foreground text color
 * and icon weight changes to "fill" for visual emphasis.
 */
export function SidebarNavItem({
  icon,
  label,
  isActive = false,
  onClick,
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
          ? "bg-active text-foreground"
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
    </Button>
  );
}
