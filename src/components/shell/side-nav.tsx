"use client";

import { useEffect } from "react";
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
import { FOCUS_RING, cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { ComposeIcon } from "./icons";
import {
  PLACES,
  RECENT_LIMIT,
  SIDEBAR_STORAGE_KEY,
  SIDE_NAV_ORDER,
  SIDE_NAV_RAIL,
  SIDE_NAV_WIDTH,
  activePlace,
  shouldStartCollapsed,
} from "./nav-config";
import { ThreadRow } from "./thread-row";
import type { ThreadActions } from "./use-thread-actions";

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
 * icon rail with the same shortcut (⌘\) and the same persisted choice as the legacy sidebar.
 * Shown from 768px up; the phone uses the tab bar.
 */
export function SideNav({ actions }: { actions: ThreadActions }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggleCollapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const activeThreadId = useBoardStore((s) => s.activeThreadId);
  const { data: threads } = useThreadList();
  const renameThread = useRenameThread();
  const pinThread = usePinThread();
  const { data: profile } = useProfile();
  const { usage } = useSubscription();
  const current = activePlace(pathname);

  // Below 1100px the sidebar starts as the rail, unless the creator already chose.
  useEffect(() => {
    let hasStoredChoice = true;
    try {
      hasStoredChoice = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) !== null;
    } catch {
      // Storage blocked: leave the sidebar as it is.
    }
    if (shouldStartCollapsed(window.innerWidth, hasStoredChoice)) setCollapsed(true);
  }, [setCollapsed]);

  // The newest thread always shows (it may be the open, still untitled one); beyond it only
  // titled threads, because an untitled placeholder carries no signal.
  const recent = (threads ?? [])
    .filter((thread, index) => index === 0 || Boolean(thread.title?.trim()))
    .slice(0, RECENT_LIMIT);

  const name = profile?.name ?? profile?.email ?? "Account";
  const initials = profile?.name
    ? profile.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  // The existing balance (the app meters "Readings"). null = unlimited or not loaded: no tag.
  const left = usage?.remaining ?? null;

  const collapseButton = (
    <IconButton
      surface="quiet"
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={toggleCollapsed}
    >
      <SidebarSimple size={18} aria-hidden />
    </IconButton>
  );

  return (
    <nav
      aria-label="App navigation"
      style={{ width: isCollapsed ? SIDE_NAV_RAIL : SIDE_NAV_WIDTH }}
      className={cn(
        "fixed inset-y-0 left-0 z-[var(--z-sidebar)] hidden flex-col gap-0.5 pb-3.5 pt-[18px] md:flex",
        "transition-[width] duration-150 ease-[var(--ease-out-cubic)] motion-reduce:transition-none",
        isCollapsed ? "items-center px-2" : "px-3.5",
      )}
    >
      {/* Brand */}
      <div className={cn("mb-3 flex items-center", isCollapsed ? "flex-col gap-2" : "h-[34px] justify-between pl-2")}>
        <Link href="/" aria-label="Maven home" className={cn("flex items-center gap-[9px] rounded-lg text-foreground", FOCUS_RING)}>
          {/* The mark sits in a 26 square, as in the reference. MavenMark is 2.5:1 (size = its
              height), so at 13 tall it is 32.5 wide; its gull spans 72% of that (23.3), the
              reference's drawn width. Centred, the svg's empty ends overflow the square. */}
          <span aria-hidden className="flex size-[26px] shrink-0 items-center justify-center">
            <MavenMark size={13} className="shrink-0 text-accent" />
          </span>
          {!isCollapsed && <span className="text-title font-[640] tracking-[-0.02em]">Maven</span>}
        </Link>
        {collapseButton}
      </div>

      {/* New chat */}
      <Hint label="New chat" show={isCollapsed}>
        <button
          type="button"
          onClick={actions.newThread}
          // Named explicitly so a screen reader does not read the shortcut hint as part of the name.
          aria-label="New chat"
          aria-keyshortcuts="Meta+N"
          className={cn(
            "mb-2.5 flex h-[42px] shrink-0 items-center gap-[9px] rounded-xl bg-surface text-ui font-[640] text-foreground shadow-[var(--shadow-press)]",
            "transition-transform duration-150 active:scale-[0.98]",
            FOCUS_RING,
            isCollapsed ? "w-[40px] justify-center" : "px-3",
          )}
        >
          <ComposeIcon size={17} aria-hidden />
          {!isCollapsed && (
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
          <Hint key={place.id} label={place.label} show={isCollapsed}>
            <Link
              href={place.href}
              aria-current={active ? "page" : undefined}
              aria-label={isCollapsed ? place.label : undefined}
              className={cn(
                "flex h-[38px] shrink-0 items-center gap-[11px] rounded-lg text-ui font-[560] transition-colors duration-150",
                FOCUS_RING,
                isCollapsed ? "w-[40px] justify-center" : "px-3",
                active
                  ? "bg-active text-foreground"
                  : "text-foreground-secondary hover:bg-hover hover:text-foreground",
              )}
            >
              <Glyph size={18} aria-hidden />
              {!isCollapsed && <span className="truncate">{place.label}</span>}
            </Link>
          </Hint>
        );
      })}

      {/* Recent */}
      {!isCollapsed && recent.length > 0 && (
        <div className="mt-[18px] flex min-h-0 flex-1 flex-col gap-0.5">
          {/* 21px line + 6 below + the 2px gap put the first thread row at y 327, as in the reference. */}
          <p id="side-nav-recent" className="mx-3 mb-1.5 text-label font-[560] leading-[21px] text-foreground-muted">
            Recent
          </p>
          <ul aria-labelledby="side-nav-recent" className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
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
              aria-label="Account menu"
              className={cn(
                "flex items-center gap-2.5 rounded-xl p-2 text-left transition-colors duration-150 hover:bg-hover",
                FOCUS_RING,
                isCollapsed ? "justify-center" : "w-full",
              )}
            >
              <Avatar src={profile?.avatar ?? undefined} alt="" fallback={initials} size="sm" className="h-[30px] w-[30px]" />
              {!isCollapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-ui font-[640] text-foreground">{name}</span>
                  {left !== null && <Badge className="tabular-nums">{left} left</Badge>}
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-[200px]">
            <DropdownMenuItem onSelect={() => router.push("/settings")}>
              <GearSix size={16} aria-hidden />
              Settings
            </DropdownMenuItem>
            {/* AuthGuard's auth listener owns the redirect to /login; do not navigate here too. */}
            <DropdownMenuItem onSelect={() => { void supabase.auth.signOut(); }}>
              <SignOut size={16} aria-hidden />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
