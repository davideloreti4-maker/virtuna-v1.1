"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, UsersThree, SlidersHorizontal, ChatCircleText } from "@phosphor-icons/react";
import { AuthGuard } from "./auth-guard";
import { Sidebar, SidebarHamburger, MOBILE_NAV_BAND } from "@/components/sidebar/Sidebar";
import { CommandPalette, type CommandItem } from "@/components/primitives/CommandPalette";
import { useSidebarStore } from "@/stores/sidebar-store";
import { useBoardStore } from "@/stores/board-store";
import { useThreadList } from "@/hooks/queries";
import {
  setActiveThreadCookie,
  clearActiveThreadCookie,
} from "@/lib/threads/active-thread-cookie";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** Compact relative time for a thread row's subtitle ("3d", "2mo"). */
const rtf =
  typeof Intl !== "undefined"
    ? new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "narrow" })
    : null;

function relativeTime(iso: string | undefined): string {
  if (!iso || !rtf) return "";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  const diffSec = (parsed - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month");
  return rtf.format(Math.round(diffSec / 31536000), "year");
}

interface AppShellProps {
  children: React.ReactNode;
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

export function AppShell({ children }: AppShellProps) {
  const { isCollapsed, commandOpen, setCommandOpen } = useSidebarStore();
  const { isMobile, hydrated } = useIsMobileHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const router = useRouter();
  const { data: threads } = useThreadList();
  const switchThread = useBoardStore((s) => s.switchThread);
  const setActiveThreadId = useBoardStore((s) => s.setActiveThreadId);

  // ⌘K searches THREADS. It mounts here, as a sibling of <main> and outside
  // <Sidebar>, on purpose: the sidebar <nav> animates with translate-x, and a
  // transformed ancestor re-bases `position: fixed` onto itself — mounting the
  // palette inside it would trap the overlay in a 220px column.
  //
  // The first version listed only Home / Audience / Settings / New audience, and
  // was rightly called out as pointless: every one of those is already visible in
  // a two-item sidebar, so the palette navigated you to things you could already
  // see. Threads are the only thing here that grows without bound and cannot be
  // scanned at a glance — they are what a search is FOR, and they are what the
  // trigger on the Threads header promises.
  //
  // Destinations stay, demoted below the threads: they cost nothing and they make
  // typing "set" resolve, but they are no longer the payload.
  const threadItems = useMemo<CommandItem[]>(
    () =>
      (threads ?? []).map((t) => ({
        id: `thread-${t.id}`,
        title: t.title ?? "New chat",
        subtitle: relativeTime(t.updated_at),
        group: "Threads",
        icon: <ChatCircleText size={16} />,
        // Same path the sidebar rows take — cookie, store pointer, switch, /home.
        // Anything less leaves the composer pointing at the previous thread.
        onSelect: () => {
          setActiveThreadCookie(t.id);
          setActiveThreadId(t.id);
          switchThread();
          router.push("/home");
        },
      })),
    [threads, router, setActiveThreadId, switchThread],
  );

  const commandItems = useMemo<CommandItem[]>(
    () => [
      ...threadItems,
      {
        id: "new-thread",
        title: "New thread",
        subtitle: "Start a fresh conversation",
        group: "Actions",
        icon: <Plus size={16} />,
        onSelect: () => {
          clearActiveThreadCookie();
          setActiveThreadId(null);
          switchThread();
          router.push("/home");
        },
      },
      {
        id: "new-audience",
        title: "New audience",
        subtitle: "Calibrate from a handle, an account, or a description",
        group: "Actions",
        icon: <UsersThree size={16} />,
        onSelect: () => router.push("/audience/new"),
      },
      {
        id: "audience",
        title: "Audience",
        subtitle: "Your calibrated audiences",
        group: "Go to",
        icon: <UsersThree size={16} />,
        onSelect: () => router.push("/audience"),
      },
      {
        id: "settings",
        title: "Settings",
        group: "Go to",
        icon: <SlidersHorizontal size={16} />,
        onSelect: () => router.push("/settings"),
      },
    ],
    [threadItems, router, setActiveThreadId, switchThread],
  );

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
