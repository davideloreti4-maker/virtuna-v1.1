"use client";

import { useId, useLayoutEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GearSix, SidebarSimple, SignOut } from "@phosphor-icons/react";
import { MavenMark } from "@/components/brand/maven-logo";
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
import { usePinThread, useRenameThread, useThreadList } from "@/hooks/queries";
import { useProfile } from "@/hooks/queries/use-profile";
import { useSubscription } from "@/hooks/use-subscription";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import { useShellStore } from "@/stores/shell-store";
import { ComposeIcon } from "./icons";
import {
  PLACES,
  RECENT_LIMIT,
  SHELL_FOCUS,
  SIDE_NAV_CHOICE_KEY,
  SIDE_NAV_ORDER,
  SIDE_NAV_RAIL,
  SIDE_NAV_WIDTH,
  activePlace,
  shouldStartCollapsed,
} from "./nav-config";
import { ThreadRow } from "./thread-row";
import { useSideNavCollapse } from "./use-side-nav-collapse";
import type { ThreadActions } from "./use-thread-actions";

/** An account menu row: the text role and colour, the button radius, the hover tint when highlighted. */
const MENU_ITEM = "rounded-xl text-ui text-foreground focus:bg-hover";

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
 * The desktop sidebar (new look, spec §6.2). 248 wide, on the ground with no fill of its own
 * and no divider: brand, New chat, the four places, Recent, the account. Collapses to a 56px
 * icon rail with the same shortcut (⌘\) and the same persisted choice as the legacy sidebar;
 * below 1100px it starts as the rail until the creator chooses (useSideNavCollapse).
 * Shown from 768px up; the phone uses the tab bar.
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
  const { data: profile } = useProfile();
  const { usage } = useSubscription();
  const current = activePlace(pathname);

  // Below 1100px the sidebar starts as the rail, unless the creator already chose. This is the
  // app's default, so it goes to the unpersisted autoRail, never to the saved choice. Set both
  // ways: a mount on a wide window clears a default left from a narrow one. A layout effect, so
  // it lands before the first paint: set after it, the sidebar and the content would be drawn at
  // 248 and then slide to 56. Safe: the sidebar never renders on the server (it mounts inside
  // AuthGuard, after the client session check).
  useLayoutEffect(() => {
    let chosen = true;
    try {
      chosen = window.localStorage.getItem(SIDE_NAV_CHOICE_KEY) !== null;
    } catch {
      // Storage blocked: count it as chosen and leave the sidebar as it is.
    }
    setAutoRail(shouldStartCollapsed(window.innerWidth, chosen));
  }, [setAutoRail]);

  // The newest thread always shows (it may be the open, still untitled one); beyond it only
  // titled threads, because an untitled placeholder carries no signal.
  const recent = (threads ?? [])
    .filter((thread, index) => index === 0 || Boolean(thread.title?.trim()))
    .slice(0, RECENT_LIMIT);

  // A blank name must not render as nothing: fall back to the email, then "Account".
  const profileName = profile?.name?.trim() ?? "";
  const name = profileName || profile?.email?.trim() || "Account";
  const initials = profileName
    ? profileName.split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  // The existing balance (the app meters "Readings"). null = unlimited or not loaded: no tag.
  const left = usage?.remaining ?? null;

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
        "fixed inset-y-0 left-0 z-[var(--z-sidebar)] hidden flex-col gap-0.5 pb-3.5 pt-[18px] md:flex",
        "transition-[width] duration-150 ease-[var(--ease-out-cubic)] motion-reduce:transition-none",
        collapsed ? "items-center px-2" : "px-3.5",
      )}
    >
      {/* Brand */}
      <div className={cn("mb-3 flex items-center", collapsed ? "flex-col gap-2" : "h-[34px] justify-between pl-2")}>
        <Link href="/" aria-label="Maven home" className={cn("flex items-center gap-[9px] rounded-lg text-foreground", SHELL_FOCUS)}>
          {/* The mark sits in a 26 square, as in the reference. MavenMark is 2.5:1 (size = its
              height), so at 13 tall it is 32.5 wide; its gull spans 72% of that (23.3), the
              reference's drawn width. Centred, the svg's empty ends overflow the square. */}
          <span aria-hidden className="flex size-[26px] shrink-0 items-center justify-center">
            <MavenMark size={13} className="shrink-0 text-accent" />
          </span>
          {!collapsed && <span className="text-title font-[640] tracking-[-0.02em]">Maven</span>}
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
          className={cn(
            "mb-2.5 flex h-[42px] shrink-0 items-center gap-[9px] rounded-xl bg-surface text-ui font-[640] text-foreground shadow-[var(--shadow-control)]",
            "transition-transform duration-150 motion-safe:active:scale-[0.98]",
            SHELL_FOCUS,
            collapsed ? "w-[40px] justify-center" : "px-3",
          )}
        >
          <ComposeIcon size={17} aria-hidden />
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
        const active = current === place.id;
        return (
          <Hint key={place.id} label={place.label} show={collapsed}>
            <Link
              href={place.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? place.label : undefined}
              className={cn(
                "flex h-[38px] shrink-0 items-center gap-[11px] rounded-lg text-ui font-[560] transition-colors duration-150",
                SHELL_FOCUS,
                collapsed ? "w-[40px] justify-center" : "px-3",
                active
                  ? "bg-active text-foreground"
                  : "text-foreground-secondary hover:bg-hover hover:text-foreground",
              )}
            >
              <Glyph size={18} aria-hidden />
              {!collapsed && <span className="truncate">{place.label}</span>}
            </Link>
          </Hint>
        );
      })}

      {/* Recent */}
      {!collapsed && recent.length > 0 && (
        <div className="mt-[18px] flex min-h-0 flex-1 flex-col gap-0.5">
          {/* 21px line + 6 below + the 2px gap put the first thread row at y 327, as in the reference. */}
          <p id={recentLabelId} className="mx-3 mb-1.5 text-label font-[560] leading-[21px] text-foreground-muted">
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
                    onDelete={() => { void actions.deleteThread(thread.id, isActive); }}
                    onTogglePin={() => pinThread.mutate({ id: thread.id, pinned: thread.pinned_at == null })}
                    onRename={(title) => renameThread.mutate({ id: thread.id, title })}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Account */}
      <div className="mt-auto pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              // The name is part of the label, so what a sighted creator reads is what they can say.
              aria-label={`Account: ${name}`}
              className={cn(
                "flex items-center gap-2.5 rounded-xl p-2 text-left transition-colors duration-150 hover:bg-hover",
                SHELL_FOCUS,
                collapsed ? "justify-center" : "w-full",
              )}
            >
              <Avatar src={profile?.avatar ?? undefined} alt="" fallback={initials} size="sm" className="h-[30px] w-[30px]" />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-ui font-[640] text-foreground">{name}</span>
                  {left !== null && <Badge className="tabular-nums">{left} left</Badge>}
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          {/* The shared primitive's panel names `bg-popover`, which this app does not define, and
              sits at z-50, under the sidebar (--z-sidebar 250). Given its surface and layer here. */}
          <DropdownMenuContent
            side="top"
            align="start"
            className="z-[var(--z-modal)] min-w-[200px] rounded-2xl border-0 bg-surface p-1.5 text-foreground shadow-[var(--shadow-float)]"
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
