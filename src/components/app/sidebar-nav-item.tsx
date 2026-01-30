"use client";

import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SidebarNavItemProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  className?: string;
}

/**
 * Reusable navigation item for sidebar bottom menu.
 * Displays label on the left and icon on the right.
 *
 * Styling from reference:
 * - Full width flex with space-between
 * - Text: zinc-400, hover: white
 * - Icon: 18px
 * - Padding: py-3 (12px)
 */
export function SidebarNavItem({
  icon: Icon,
  label,
  onClick,
  className,
}: SidebarNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between py-2.5 text-sm text-zinc-400 transition-colors hover:text-white",
        className
      )}
    >
      <span>{label}</span>
      <Icon className="h-4 w-4 stroke-[1.5]" />
    </button>
  );
}
