"use client";

import { List } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

/**
 * Floating toggle button to open the sidebar.
 *
 * Visibility rules:
 * - Mobile (< md): Always visible (sidebar is off-canvas)
 * - Desktop (>= md): Only visible when sidebar is collapsed
 * - When sidebar is open on desktop: hidden (collapse button inside sidebar is used)
 *
 * Positioned fixed at top-left with z-sidebar layer.
 */
export function SidebarToggle(): React.ReactElement {
  const { isOpen, open } = useSidebarStore();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={open}
      aria-label="Open sidebar"
      className={cn(
        "fixed left-4 top-4 z-[var(--z-sidebar)]",
        "border border-border bg-surface/80 shadow-md",
        "flex md:hidden",
        !isOpen && "md:flex"
      )}
    >
      <Icon icon={List} size={20} />
    </Button>
  );
}
