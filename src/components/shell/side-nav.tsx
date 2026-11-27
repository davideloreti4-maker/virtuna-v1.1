"use client";

import { useId, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GearSix, Plus, SidebarSimple, SignOut } from "@phosphor-icons/react";
import { MavenLogo } from "@/components/brand/maven-logo";
import { creditsLabel } from "@/components/thread-next/thread-field";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { usePinThread, useRenameThread, useThreadList } from "@/hooks/queries";
import { libraryKeys } from "@/hooks/queries/use-library";
import { useProfile } from "@/hooks/queries/use-profile";
import { useSubscription } from "@/hooks/use-subscription";
import { shownBalance } from "@/lib/pricing";
import { initialAutoRail } from "@/lib/shell/side-nav-default";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import { PlatformBadge, platformIdOf } from "@/components/brand/platform-logo";
import { useShellStore } from "@/stores/shell-store";
import {
  EARN,
  PLACES,
  RECENT_LIMIT,
  SHELL_FOCUS,
  SIDE_NAV_ORDER,
  SIDE_NAV_RAIL,
  SIDE_NAV_WIDTH,
  YOU,
  activePlace,
  earnActive,
  youActive,
} from "./nav-config";
import type { ShellIcon } from "./icons";
import { ThreadRow } from "./thread-row";
import { useSideNavCollapse } from "./use-side-nav-collapse";
import type { ThreadActions } from "./use-thread-actions";

/**
 * An account menu row: the text role and colour, the button radius, and the "active" tint while
 * highlighted (Radix focuses the item under the pointer too, so this covers hover). The hover
 * tint (4% in light) was too faint to see which row is highlighted.
 */
const MENU_ITEM = "rounded-xl text-ui text-foreground focus:bg-active";

/**
 * One row of the sidebar, as in Claude's: 34 tall, 14px, the text at full strength whether or not
 * it is current (only the section label is quiet); the current row is lit by the active tint.
 */
function rowClass(current: boolean, collapsed: boolean): string {
  return cn(
    "flex h-[34px] shrink-0 items-center gap-[10px] rounded-lg text-reading font-[480] text-foreground transition-colors duration-150",
    SHELL_FOCUS,
    collapsed ? "w-[40px] justify-center" : "px-2.5",
    current ? "bg-active" : "hover:bg-hover",
  );
}

/** In the rail a control shows no text, so it gets a tooltip. */
function Hint({ label, show, children }: { label: string; show: boolean; children: React.ReactElement }) {
  if (!show) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A row of its own after the places (You, Earn): not a place, the same row, lit when current. Its
 * name alone, nothing at the right (Earn, ruling 10).
 */
function OwnRow({ item, current, collapsed }: { item: { label: string; href: string; icon: ShellIcon }; current: boolean; collapsed: boolean }) {
  const Glyph = item.icon;
  return (
    <Hint label={item.label} show={collapsed}>
      <Link
        href={item.href}
        aria-current={current ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        className={rowClass(current, collapsed)}
      >
        <Glyph size={18} aria-hidden />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    </Hint>
  );
}

/**
 * The desktop sidebar (new look, spec §6.2). 248 wide, a panel of its own as in Claude's
 * (redesign 2026-11-26: on the bare ground it had no separation from the page): its own tone
 * (`--color-sidebar`) edged by a hairline; brand, New chat, the four places, You, Recent, then the
 * account under a divider. Collapses to a 56px
 * icon rail with the same shortcut (⌘\) and the same persisted choice as the legacy sidebar;
 * below 1100px it starts as the rail until the creator chooses (useSideNavCollapse).
 * Shown from 768px up; on a phone the left drawer holds the same rows.
 */
export function SideNav({ actions }: { actions: ThreadActions }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { collapsed, toggle } = useSideNavCollapse();
  const setAutoRail = useShellStore((s) => s.setAutoRail);
  const recentLabelId = useId();
  const activeThreadId = useBoardStore((s) => s.activeThreadId);
  const { data: threads } = useThreadList();
  const renameThread = useRenameThread();
  const pinThread = usePinThread();
  const queryClient = useQueryClient();
  // A rename, pin or delete done here reaches Library beside it (and Home's Recent): once it went
  // through, every Library list is marked old and the ones on screen are read again.
  const libraryFollows = () => void queryClient.invalidateQueries({ queryKey: libraryKeys.all });
  const { data: profile } = useProfile();
  const { usage, tier, isTrial } = useSubscription();
  const current = activePlace(pathname);
  const threadOpen = useShellStore((s) => s.threadOpen);

  // Below 1100px the sidebar starts as the rail, unless the creator already chose. This is the
  // app's default, so it goes to the unpersisted autoRail, never to the saved choice. The store
  // already starts with this value (shell-store), so the first frame is right; this re-checks on
  // every mount, both ways: a mount on a wide window clears a default left from a narrow one.
  // A layout effect, so a correction lands before paint. Safe: the sidebar never renders on the
  // server (it mounts inside AuthGuard, after the client session check).
  useLayoutEffect(() => {
    setAutoRail(initialAutoRail());
  }, [setAutoRail]);

  // The newest thread always shows (it may be the open, still untitled one); beyond it only
  // titled threads, because an untitled placeholder carries no signal.
  const recent = (threads ?? [])
    .filter((thread, index) => index === 0 || Boolean(thread.title?.trim()))
    .slice(0, RECENT_LIMIT);
  // Inside a thread the thread's own row is the current thing, not Home: two highlights said two
  // things (review 2026-11-23; the reference marks the thread only). Only while that row is on
  // screen to be marked: on the rail, or for a thread that is not among the recent ones, Home keeps
  // the mark, so something always says where the creator is.
  const inThread = threadOpen && pathname === "/home" && !collapsed && recent.some((thread) => thread.id === activeThreadId);

  // A blank name must not render as nothing: fall back to the email, then "Account".
  const profileName = profile?.name?.trim() ?? "";
  const name = profileName || profile?.email?.trim() || "Account";
  const initials = profileName
    ? profileName.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  // The connected account (primary first): its platform's mark on the picture, its handle under the name.
  const accountPlatform = platformIdOf(profile?.account?.platform);
  const accountHandle = profile?.account?.handle ?? null;
  // The balance, as the phone's Home shows it: only for a paid plan or a trial pool with a
  // countable limit (`shownBalance`). null = no plan, unlimited or not loaded: no tag.
  const left = shownBalance(usage, tier, isTrial);

  const collapseButton = (
    <IconButton
      surface="quiet"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={toggle}
    >
      <SidebarSimple size={18} aria-hidden />
    </IconButton>
  );

  return (
    <nav
      aria-label="App navigation"
      style={{ width: collapsed ? SIDE_NAV_RAIL : SIDE_NAV_WIDTH }}
      className={cn(
        "fixed inset-y-0 left-0 z-[var(--z-sidebar)] hidden flex-col gap-0.5 border-r border-border bg-[var(--color-sidebar)] px-2 pb-2 pt-3 md:flex",
        "transition-[width] duration-150 ease-[var(--ease-out-cubic)] motion-reduce:transition-none",
        collapsed && "items-center",
      )}
    >
      {/* Brand */}
      <div className={cn("mb-2 flex items-center", collapsed ? "flex-col gap-2" : "h-[38px] justify-between pl-2.5")}>
        <Link
          href="/"
          aria-label="Maven home"
          className={cn("flex h-[34px] items-center rounded-lg text-foreground", SHELL_FOCUS, collapsed && "w-[40px] justify-center")}
        >
          <MavenLogo size={16} wordmark={collapsed ? "none" : "maven"} />
        </Link>
        {collapseButton}
      </div>

      {/* New chat */}
      <Hint label="New chat" show={collapsed}>
        <button
          type="button"
          onClick={actions.newThread}
          // Named explicitly so a screen reader does not read the shortcut hint as part of the name.
          aria-label="New chat"
          aria-keyshortcuts="Meta+N"
          // A row like the others, marked by an ink dot (the primary action's colour, never coral);
          // as in Claude's, New is the sidebar's first row, not a card.
          className={cn(rowClass(false, collapsed), "mb-1 font-[560]", !collapsed && "pl-[7px]")}
        >
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-action text-action-foreground">
            <Plus size={13} weight="bold" />
          </span>
          {!collapsed && (
            <>
              <span>New chat</span>
              <kbd aria-hidden className="ml-auto font-sans text-label tabular-nums text-foreground-muted">⌘N</kbd>
            </>
          )}
        </button>
      </Hint>

      {/* The four places, in the desktop order */}
      {SIDE_NAV_ORDER.map((id) => {
        const place = PLACES.find((candidate) => candidate.id === id);
        if (!place) return null;
        const Glyph = place.icon;
        const active = current === place.id && !(place.id === "home" && inThread);
        return (
          <Hint key={place.id} label={place.label} show={collapsed}>
            <Link
              href={place.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? place.label : undefined}
              // Home is Home, never the empty new-chat screen ("New chat" is that).
              onClick={place.id === "home" ? () => useShellStore.getState().setNewChat(false) : undefined}
              className={rowClass(active, collapsed)}
            >
              <Glyph size={18} aria-hidden />
              {!collapsed && <span className="truncate">{place.label}</span>}
            </Link>
          </Hint>
        );
      })}

      {/* You (plan 2026-11-24-you) and Earn (plan 2026-11-24-earn): after the places, as the drawings
          have them; rows, not places. */}
      <OwnRow item={YOU} current={youActive(pathname)} collapsed={collapsed} />
      <OwnRow item={EARN} current={earnActive(pathname)} collapsed={collapsed} />

      {/* Recent */}
      {!collapsed && recent.length > 0 && (
        <div className="mt-5 flex min-h-0 flex-1 flex-col gap-0.5">
          <p id={recentLabelId} className="mx-2.5 mb-1 text-label font-[560] leading-5 text-foreground-secondary">
            Recent
          </p>
          <ul aria-labelledby={recentLabelId} className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
            {recent.map((thread) => {
              // The open thread is on screen only on /home.
              const isActive = pathname === "/home" && thread.id === activeThreadId;
              return (
                <li key={thread.id}>
                  <ThreadRow
                    thread={thread}
                    isActive={isActive}
                    onOpen={() => actions.openThread(thread.id)}
                    onDelete={() => {
                      void actions.deleteThread(thread.id, isActive).then((deleted) => {
                        if (deleted) libraryFollows();
                      });
                    }}
                    onTogglePin={() =>
                      // Each call's own promise: a per-call `onSuccess` is dropped when a second call follows quickly.
                      void pinThread.mutateAsync({ id: thread.id, pinned: thread.pinned_at == null }).then(libraryFollows, () => {})
                    }
                    onRename={(title) => void renameThread.mutateAsync({ id: thread.id, title }).then(libraryFollows, () => {})}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Account */}
      {/* Under a divider that runs the sidebar's width, as in Claude's. */}
      <div className={cn("-mx-2 mt-auto border-t border-border px-2 pt-2", collapsed && "flex justify-center")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              // The name is part of the label, so what a sighted creator reads is what they can say.
              aria-label={`Account: ${name}`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors duration-150 hover:bg-hover",
                SHELL_FOCUS,
                collapsed ? "justify-center" : "w-full",
              )}
            >
              {/* The creator's picture (owner 2026-11-26: their connected account's, when they have not
                  uploaded one; the profile read falls back to it) with the platform's mark at its corner. */}
              <span className="relative inline-flex shrink-0">
                <Avatar src={profile?.avatar ?? undefined} alt="" fallback={initials} size="sm" className="h-8 w-8" />
                {accountPlatform && <PlatformBadge platform={accountPlatform} size={14} className="absolute -bottom-0.5 -right-0.5" />}
              </span>
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-reading font-[560] text-foreground">{name}</span>
                    {accountHandle && (
                      <span data-part="handle" className="block truncate text-meta text-foreground-secondary">
                        @{accountHandle}
                      </span>
                    )}
                  </span>
                  {left !== null && <Badge className="tabular-nums">{creditsLabel(left)}</Badge>}
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          {/* The shared primitive's panel names `bg-popover`, which this app does not define, and
              sits at z-50, under the sidebar (--z-sidebar 250). Given its surface and layer here.
              The shadow is `!`: cn() keeps the primitive's `shadow-md` beside an arbitrary
              shadow, and `.shadow-md` comes later in the CSS, so it would win. */}
          <DropdownMenuContent
            side="top"
            align="start"
            className="z-[var(--z-modal)] min-w-[200px] rounded-2xl border-0 bg-surface p-1.5 text-foreground shadow-[var(--shadow-float)]!"
          >
            <DropdownMenuItem className={MENU_ITEM} onSelect={() => router.push("/settings")}>
              <GearSix size={16} aria-hidden />
              Settings
            </DropdownMenuItem>
            {/* AuthGuard's auth listener owns the redirect to /login; do not navigate here too. */}
            <DropdownMenuItem className={MENU_ITEM} onSelect={() => { void supabase.auth.signOut(); }}>
              <SignOut size={16} aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
