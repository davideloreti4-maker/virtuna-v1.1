"use client";

import { AuthGuard } from "./auth-guard";
import { Sidebar, SidebarHamburger } from "@/components/sidebar/Sidebar";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface AppShellProps {
  children: React.ReactNode;
}

// Sidebar geometry — kept in sync with Sidebar.tsx (left-3 inset + w-[220px] /
// w-[60px] rail). Main content is offset by the sidebar's right edge + a gutter
// so the persistent desktop sidebar never overlaps the content (D-14).
const SIDEBAR_EXPANDED = 220;
const SIDEBAR_RAIL = 60;
const SIDEBAR_INSET = 12; // matches `left-3`
const CONTENT_GUTTER = 12;

export function AppShell({ children }: AppShellProps) {
  const { isCollapsed } = useSidebarStore();
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();

  // Mobile (D-15): the sidebar is an overlay drawer — content does not shift.
  // Desktop (D-14): content shifts right by the real sidebar width.
  const sidebarWidth = isCollapsed ? SIDEBAR_RAIL : SIDEBAR_EXPANDED;
  const offset = isMobile ? 0 : SIDEBAR_INSET + sidebarWidth + CONTENT_GUTTER;

  return (
    <AuthGuard>
      <div className="h-screen bg-background">
        <SidebarHamburger />
        <Sidebar />
        <main
          className="h-full overflow-auto"
          style={{
            marginLeft: `${offset}px`,
            transition: reducedMotion ? undefined : "margin-left 150ms var(--ease-out-cubic)",
          }}
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
