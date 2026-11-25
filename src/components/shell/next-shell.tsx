"use client";

import { useLayoutEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthGuard } from "@/components/app/auth-guard";
import { useCommandItems } from "@/components/app/use-command-items";
import { CommandPalette } from "@/components/primitives/CommandPalette";
import { MOBILE_NAV_BAND } from "@/components/sidebar/Sidebar";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useThemeSync } from "@/lib/theme/use-theme";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { IconButton } from "@/components/ui/icon-button";
import { Drawer } from "./drawer";
import { ComposeIcon } from "./icons";
import { MenuButton } from "./menu-button";
import { SIDE_NAV_RAIL, SIDE_NAV_WIDTH, backInHistory, backTarget, onPlaceScreen } from "./nav-config";
import { PushedHeader } from "./pushed-header";
import { SideNav } from "./side-nav";
import { useShellShortcuts } from "./use-shell-shortcuts";
import { useSideNavCollapse } from "./use-side-nav-collapse";
import { useThreadActions } from "./use-thread-actions";
import { useThreadTitle } from "./use-thread-title";

/**
 * The app frame of the new look (spec §6). Desktop: the sidebar, content beside it. Phone: no
 * bottom bar; the left drawer (mounted here once) is the one way around. The four places draw their
 * own top row, with the drawer's opener at its left; every other screen gets a band with Back, so
 * no screen is a dead end. A chat not opened from Library has nowhere to go back to: its band shows
 * the menu that opens the drawer in Back's place.
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
  // The audience the open thread is for, published by the composer (thread answers step 1).
  const threadAudience = useShellStore((s) => s.threadAudience);
  // The sidebar's width as it is drawn: the creator's choice, or the rail the app starts with
  // on a narrow window. The same hook drives SideNav, so the two cannot disagree.
  const { collapsed: isCollapsed } = useSideNavCollapse();
  const commandOpen = useSidebarStore((s) => s.commandOpen);
  const setCommandOpen = useSidebarStore((s) => s.setCommandOpen);
  const { isMobile, hydrated } = useIsMobileHydrated();
  const reducedMotion = usePrefersReducedMotion();
  useShellShortcuts(actions);
  useThemeSync();

  const inThread = pathname === "/home" && threadOpen;
  // Library (plan 2026-11-23): a chat opened from Library goes back there; a chat opened any
  // other way shows the drawer's menu where Back was (`menuInBand`). The marker lives while the
  // creator is in the thread or one of its results (a result's Back returns to the thread);
  // arriving anywhere else drops it, so a chat found open again later (the Home tab, a system Back)
  // is not taken for one opened from Library. A layout effect: it runs in the commit that changes
  // the route, before the browser paints, so no tap on the new screen (a Library row setting the
  // marker) can come before it. The row's name for an untitled chat and Library's scroll go with
  // the marker. After the Back below there is nothing to drop: Library takes its scroll on arrival.
  // An edit opened from the chat keeps it too (plan 2026-11-24-editor-screens-a).
  const threadBack = useShellStore((s) => s.threadBack);
  useLayoutEffect(() => {
    if (pathname === "/home" || pathname.startsWith("/simulation/") || pathname.startsWith("/edit/")) return;
    const shell = useShellStore.getState();
    if (shell.threadBack !== null || shell.threadTitleHint !== null) shell.setThreadBack(null);
  }, [pathname]);
  // A result is opened from a thread, a card or Library: Back returns there. Opened directly
  // (a fresh tab, a pasted link) there is nothing to go back to, so it goes Home.
  // A chat opened from Library goes back in history to the Library entry it was opened from, with
  // its chip and search in the address; with no entry to go back to, to Library. A chat with no
  // marker is no longer drawn with Back: its band shows the menu there (`menuInBand`), so the
  // `actions.newThread` branch is not reached from the screen; it keeps `back` a function.
  const back = inThread
    ? threadBack
      ? () => {
          useShellStore.getState().backFromThread();
          if (window.history.length > 1) router.back();
          else router.push(threadBack);
        }
      : actions.newThread
    : pathname.startsWith("/simulation/")
      ? () => (window.history.length > 1 ? router.back() : router.push("/home"))
      : // A page Discover pushes goes back to the grid as it was left (its filter, search and scroll
        // are in the hub's history entry); opened directly, up to Discover.
        backInHistory(pathname)
        ? () => (window.history.length > 1 ? router.back() : router.push(backTarget(pathname)))
        : () => router.push(backTarget(pathname));
  // A chat not opened from Library has nowhere to go back to: its band shows the drawer's menu in
  // Back's place (New chat stays at the right). The exact opposite of the marker test in `back`, so
  // a chat's Back only ever returns to Library. Every other pushed page keeps Back.
  const menuInBand = inThread && !threadBack;
  const onPlace = onPlaceScreen(pathname, threadOpen);
  // The editor draws its own header in the band: Back, Undo, Redo and Export (E19), more than the pushed header's one action.
  const ownHeader = pathname.startsWith("/edit/");
  // While the list loads the title stays empty, so the header does not flash "New chat" first.
  const threadTitle = useThreadTitle();

  // Until the viewport is measured assume desktop, as the legacy shell does, so the first paint
  // does not start at 0 and jump by the sidebar's width.
  const treatAsMobile = hydrated && isMobile;
  const offset = treatAsMobile ? 0 : isCollapsed ? SIDE_NAV_RAIL : SIDE_NAV_WIDTH;

  return (
    <AuthGuard>
      <div className="h-screen overflow-hidden bg-background">
        <SideNav actions={actions} />

        {!onPlace && !ownHeader && (
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
              // Under the title in a thread: who it is for (thread answers step 1, Task 6).
              subtitle={inThread && threadAudience ? `For ${threadAudience}` : undefined}
              // A screen named through `pushedTitle` has no heading of its own on the phone: this is
              // it. Nor does a thread any more: its page heading is the desktop thread header's
              // title, which is not shown on a phone (and this band is not shown from md up).
              titleAs={inThread || pushedTitle ? "h1" : "div"}
              onBack={back}
              leading={menuInBand ? <MenuButton variant="lines" /> : undefined}
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
            // A place's last row scrolls clear of the phone's home indicator: the four screens pad
            // their foot 24px, not for the safe area. Every other screen keeps what it had (a chat
            // docks its field over the safe area).
            onPlace && "max-md:pb-[env(safe-area-inset-bottom)]",
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

        {/* Once, for every opener: the four places' pictures and a chat's menu open it through the
            shell store. Phone only; it closes itself from 768. */}
        <Drawer actions={actions} />

        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          items={commandItems}
          placeholder="Search threads…"
          // A place named exactly comes first: "You" + Enter opens You, not a chat titled "…you…".
          exactFirst
        />
      </div>
    </AuthGuard>
  );
}
