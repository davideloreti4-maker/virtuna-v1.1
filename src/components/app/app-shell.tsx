"use client";

import { AuthGuard } from "./auth-guard";
import { Sidebar } from "./sidebar";
import { SidebarToggle } from "./sidebar-toggle";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Client-side app shell wrapper.
 *
 * Manages:
 * - AuthGuard wrapper for skeleton loading
 * - Sidebar (reads state from useSidebarStore)
 * - SidebarToggle (floating open button, visible when sidebar collapsed)
 *
 * Mobile menu state is now managed via useSidebarStore (Zustand persist).
 * MobileNav has been replaced by SidebarToggle.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-[#0A0A0A]">
        <SidebarToggle />
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
