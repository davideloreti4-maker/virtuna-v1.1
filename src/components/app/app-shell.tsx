"use client";

import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

import { AuthGuard } from "./auth-guard";
import { Sidebar, SidebarHamburger } from "@/components/sidebar/Sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Client-side app shell wrapper.
 *
 * Layout: main uses padding-left (not margin-left) so its box extends
 * behind the fixed sidebar. Pages that want glass-visible backgrounds
 * can use negative margin to bleed into the sidebar area.
 *
 * --sidebar-offset CSS var is set on main so children can reference it.
 *
 * Phase 2.5: Sidebar width varies by collapsed state:
 *  expanded: 220px sidebar + 16px gap = 236px offset
 *  collapsed: 52px sidebar + 16px gap = 68px offset
 *
 * State managed via useSidebarStore (Zustand persist).
 */
export function AppShell({ children }: AppShellProps) {
  const { isOpen, isCollapsed } = useSidebarStore();

  // On desktop the sidebar is always mounted (toggle changes width).
  // On mobile it's an overlay so main never offsets.
  const mainOffset = isOpen
    ? isCollapsed
      ? "md:pl-[68px]"   // 52px sidebar + 16px gap
      : "md:pl-[236px]"  // 220px sidebar + 16px gap
    : "md:pl-0";

  const sidebarOffsetPx = isOpen ? (isCollapsed ? "68px" : "236px") : "0px";

  return (
    <AuthGuard>
      <div className="h-screen bg-background">
        <SidebarHamburger />
        <Sidebar />
        <main
          className={cn(
            "h-full overflow-auto",
            "transition-[padding-left] duration-150 ease-[var(--ease-out-cubic)]",
            mainOffset,
          )}
          style={{
            "--sidebar-offset": sidebarOffsetPx,
          } as React.CSSProperties}
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
