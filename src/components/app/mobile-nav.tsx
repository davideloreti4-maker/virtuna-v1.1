"use client";

import { Menu } from "lucide-react";

interface MobileNavProps {
  onMenuClick: () => void;
}

/**
 * Mobile navigation hamburger button.
 *
 * Shows fixed at top-left on mobile only (md:hidden).
 * Triggers sidebar drawer when clicked.
 */
export function MobileNav({ onMenuClick }: MobileNavProps) {
  return (
    <button
      className="fixed left-4 top-4 z-50 rounded-lg bg-zinc-900/80 p-2 backdrop-blur-sm md:hidden"
      onClick={onMenuClick}
      aria-label="Open menu"
    >
      <Menu className="h-6 w-6 text-white" />
    </button>
  );
}
