"use client";

import { usePathname, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/app/auth-guard";
import { useCommandItems } from "@/components/app/use-command-items";
import { CommandPalette } from "@/components/primitives/CommandPalette";
import { MOBILE_NAV_BAND } from "@/components/sidebar/Sidebar";
import { useThreadList } from "@/hooks/queries";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useThemeSync } from "@/lib/theme/use-theme";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { IconButton } from "@/components/ui/icon-button";
import { ComposeIcon } from "./icons";
import { SIDE_NAV_RAIL, SIDE_NAV_WIDTH, backTarget, tabBarVisible } from "./nav-config";
import { PushedHeader } from "./pushed-header";
import { SideNav } from "./side-nav";
import { TabBar } from "./tab-bar";
import { useShellShortcuts } from "./use-shell-shortcuts";
import { useSideNavCollapse } from "./use-side-nav-collapse";
import { useThreadActions } from "./use-thread-actions";

/**
 * The app frame of the new look (spec §6). Desktop: the sidebar, content beside it. Phone: the
 * tab bar on the four places; on every other screen a Back header instead, because with the
 * drawer gone a screen without the bar would be a dead end. A thread hides the bar: its message
 * field is docked, and the two are never stacked.
 *
 * Legacy pages still render inside this frame until their own build part replaces them. They
 * were laid out against the legacy phone top band (`--mobile-nav-band`, which the composer
 * cancels with a negative margin), so <main> keeps that band exactly; the Back header sits in it.
 */
export function NextShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const actions = useThreadActions();
  const commandItems = useCommandItems();
  const threadOpen = useShellStore((s) => s.threadOpen);
  const pushedTitle = useShellStore((s) => s.pushedTitle);
  // The sidebar's width as it is drawn: the creator's choice, or the rail the app starts with
  // on a narrow window. The same hook drives SideNav, so the two cannot disagree.
  const { collapsed: isCollapsed } = useSideNavCollapse();
  const commandOpen = useSidebarStore((s) => s.commandOpen);
  const setCommandOpen = useSidebarStore((s) => s.setCommandOpen);
  const activeThreadId = useBoardStore((s) => s.activeThreadId);
  const { data: threads } = useThreadList();
  const { isMobile, hydrated } = useIsMobileHydrated();
  const reducedMotion = usePrefersReducedMotion();
  useShellShortcuts(actions);
  useThemeSync();

  const inThread = pathname === "/home" && threadOpen;
  // A result is opened from a thread, a card or Library: Back returns there. Opened directly
  // (a fresh tab, a pasted link) there is nothing to go back to, so it goes Home.
  const back = inThread
    ? actions.newThread
    : pathname.startsWith("/simulation/")
      ? () => (window.history.length > 1 ? router.back() : router.push("/home"))
      : () => router.push(backTarget(pathname));
  const showBar = tabBarVisible(pathname, threadOpen);
  // While the list loads the title stays empty, so the header does not flash "New chat" first.
  const threadTitle =
    threads === undefined
      ? ""
      : threads.find((t) => t.id === activeThreadId)?.title?.trim() || "New chat";

  // Until the viewport is measured assume desktop, as the legacy shell does, so the first paint
  // does not start at 0 and jump by the sidebar's width.
  const treatAsMobile = hydrated && isMobile;
  const offset = treatAsMobile ? 0 : isCollapsed ? SIDE_NAV_RAIL : SIDE_NAV_WIDTH;

  return (
    <AuthGuard>
      <div className="h-screen overflow-hidden bg-background">
        <SideNav actions={actions} />

        {!showBar && (
          // The band is exactly what <main> reserves (MOBILE_NAV_BAND below the safe area), from the
          // same constant, so the two cannot drift; the 40px row is centred in it. A column flex,
          // not a row: as a row item the header would shrink to its content and lose its width.
          <div
            className="fixed inset-x-0 top-0 z-[var(--z-sidebar)] flex flex-col justify-center bg-background px-4 md:hidden"
            style={{
              height: `calc(env(safe-area-inset-top) + ${MOBILE_NAV_BAND}px)`,
              paddingTop: "env(safe-area-inset-top)",
            }}
          >
            <PushedHeader
              // A thread's title names the screen; a screen that names itself from its data sets
              // `pushedTitle` (the result page); the others carry their own heading.
              title={inThread ? threadTitle : pushedTitle}
              // A screen named through `pushedTitle` has no heading of its own on the phone: this is it.
              titleAs={!inThread && pushedTitle ? "h1" : "div"}
              onBack={back}
              // As in the reference: a new chat is one tap away on every pushed screen.
              trailing={
                <IconButton aria-label="New chat" onClick={actions.newThread}>
                  <ComposeIcon aria-hidden />
                </IconButton>
              }
            />
          </div>
        )}

        <main
          className={cn(
            "relative h-full overflow-auto pt-[calc(env(safe-area-inset-top)+var(--mobile-nav-band))] md:pt-0",
            // Content clears the floating bar: 104px plus the safe area (spec §6.1).
            showBar && "max-md:pb-[calc(104px+env(safe-area-inset-bottom))]",
          )}
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

        {showBar && <TabBar onNewChat={actions.newThread} />}

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
