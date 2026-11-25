"use client";

import { AuthGuard } from "./auth-guard";
import { useCommandItems } from "./use-command-items";
import { Sidebar, SidebarHamburger, MOBILE_NAV_BAND } from "@/components/sidebar/Sidebar";
import { CommandPalette } from "@/components/primitives/CommandPalette";
import { NextShell } from "@/components/shell/next-shell";
import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Picks the app frame. With NEXT_PUBLIC_NEW_LOOK on it is the new shell
 * (src/components/shell); otherwise the legacy shell below, exactly as before.
 */
export function AppShell({ children }: AppShellProps) {
  return NEW_LOOK_ENABLED ? <NextShell>{children}</NextShell> : <LegacyShell>{children}</LegacyShell>;
}

// Sidebar geometry — kept in sync with Sidebar.tsx.
//
// The sidebar is now FLUSH to the window edge (2026-07-28), so the content offset
// is simply its width: no `left-3` inset to add, and no gutter to clear a floating
// card's right edge. Both used to be 12px, which is why this was 244 for a 220px
// panel. Content now begins exactly where the sidebar's hairline ends, as it does
// in Linear and Attio.
const SIDEBAR_EXPANDED = 220;
const SIDEBAR_RAIL = 56;
const SIDEBAR_INSET = 0;
const CONTENT_GUTTER = 0;

function LegacyShell({ children }: AppShellProps) {
  const { isCollapsed, commandOpen, setCommandOpen } = useSidebarStore();
  const { isMobile, hydrated } = useIsMobileHydrated();
  const reducedMotion = usePrefersReducedMotion();
  // ⌘K searches THREADS. The palette mounts here, as a sibling of <main> and outside <Sidebar>,
  // on purpose: the sidebar <nav> animates with translate-x, and a transformed ancestor re-bases
  // `position: fixed` onto itself — mounting the palette inside it would trap the overlay in a
  // 220px column. The items live in use-command-items.tsx, shared with the new shell.
  const commandItems = useCommandItems();

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
          // Mobile reserves the top-nav band so no page renders under the fixed opener tab
          // (Sidebar.tsx). It is sized FROM that tab's own geometry — 55px, not a hand-tuned 56 that
          // drifts the next time the tab changes shape. /home cancels it and puts the audience bar
          // in the band instead (composer.tsx); every other page just starts below it.
          // Pure CSS at the same 768px boundary as the tab's `md:hidden` — it used to ride the
          // JS `treatAsMobile`, which is false until the post-mount measurement, so the pad landed
          // one frame late and anything offsetting against it jumped.
          // marginLeft stays inline: it depends on the real sidebar width, which CSS can't know.
          // The band rides a custom PROPERTY, not an inline paddingTop: an inline padding would
          // outrank `md:pt-0` and the desktop would keep the mobile band forever.
          className="relative h-full overflow-auto pt-[calc(env(safe-area-inset-top)+var(--mobile-nav-band))] md:pt-0"
          style={
            {
              marginLeft: `${offset}px`,
              "--mobile-nav-band": `${MOBILE_NAV_BAND}px`,
              transition: reducedMotion ? undefined : "margin-left 150ms var(--ease-out-cubic)",
            } as React.CSSProperties
          }
        >
          {children}
        </main>
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          items={commandItems}
          placeholder="Search threads…"
        />
      </div>
    </AuthGuard>
  );
}
