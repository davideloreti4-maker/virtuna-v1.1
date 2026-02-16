"use client";

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
 * - Main content is always full-width (no margin push) so it renders
 *   behind the glassmorphic sidebar, revealing the blur effect.
 * - Desktop open: safe-area padding-left offsets interactive content
 *   from behind the sidebar. The hive/canvas extends edge-to-edge.
 * - Desktop collapsed / Mobile: full width, no padding offset.
 *
 * State managed via useSidebarStore (Zustand persist).
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <AuthGuard>
      <div className="relative h-screen bg-background">
        <main className="h-full overflow-auto">
          <UpgradePrompt />
          {children}
        </main>
        <SidebarToggle />
        <Sidebar />
      </div>
    </AuthGuard>
  );
}
