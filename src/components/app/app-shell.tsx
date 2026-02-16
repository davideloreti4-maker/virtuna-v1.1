"use client";

import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

import { AuthGuard } from "./auth-guard";
import { Sidebar } from "./sidebar";
import { SidebarToggle } from "./sidebar-toggle";
import { UpgradePrompt } from "@/components/upgrade-prompt";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Client-side app shell wrapper.
 *
 * Layout behavior:
 * - Desktop open: Sidebar visible, main content pushed right by 324px (300 + 12 + 12)
 * - Desktop collapsed: Sidebar off-screen, main content full width, toggle visible
 * - Mobile: Sidebar overlays content (no margin push), toggle always visible
 *
 * Content push and sidebar slide animate synchronously via
 * transition-[margin-left] duration-300 ease-[var(--ease-out-cubic)].
 *
 * State managed via useSidebarStore (Zustand persist).
 * MobileNav has been replaced by SidebarToggle.
 */
export function AppShell({ children }: AppShellProps) {
  const isOpen = useSidebarStore((s) => s.isOpen);

  return (
    <AuthGuard>
      <div className="flex h-screen bg-background">
        <SidebarToggle />
        <Sidebar />
        <main
          className={cn(
            "flex-1 overflow-auto",
            "transition-[margin-left] duration-300 ease-[var(--ease-out-cubic)]",
            isOpen ? "md:ml-[284px]" : "md:ml-0",
            "ml-0",
          )}
        >
          <UpgradePrompt />
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
