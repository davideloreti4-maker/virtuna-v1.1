"use client";

import { AuthGuard } from "./auth-guard";
import { Sidebar, SidebarHamburger } from "@/components/sidebar/Sidebar";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
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
  const { isMobile, hydrated } = useIsMobileHydrated();
  const reducedMotion = usePrefersReducedMotion();

  // Mobile (D-15): the sidebar is an overlay drawer — content does not shift.
  // Desktop (D-14): content shifts right by the real sidebar width.
  // WR-03: until the viewport is measured (`hydrated`), assume DESKTOP — the
  // dominant app context — so the first paint starts at the sidebar offset
  // instead of 0px and then snapping 244px right once `useIsMobile` corrects.
  // (Mobile is the post-mount correction; an extra ~244px gutter for one frame
  // on a real phone is invisible because the drawer is an overlay anyway.)
  const treatAsMobile = hydrated && isMobile;
  const sidebarWidth = isCollapsed ? SIDEBAR_RAIL : SIDEBAR_EXPANDED;
  const offset = treatAsMobile ? 0 : SIDEBAR_INSET + sidebarWidth + CONTENT_GUTTER;

  return (
    <AuthGuard>
      <div className="h-screen overflow-hidden bg-background">
        <SidebarHamburger />
        <Sidebar />
        <main
          // The blanket 56px mobile top pad is GONE (2026-07-24). It existed for exactly one reason:
          // to keep page content out from under the fixed hamburger at `left-4 top-4`. That opener is
          // now an EDGE TAB on the vertical centre of the left rail (Sidebar.tsx), so nothing floats
          // over the top of the page and no page owes it a band. Mobile pages start at the top; the
          // only reservation left is the notch, which is the device's, not the hamburger's.
          // marginLeft stays inline: it depends on the real sidebar width, which CSS can't know.
          className="relative h-full overflow-auto pt-[env(safe-area-inset-top)] md:pt-0"
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
