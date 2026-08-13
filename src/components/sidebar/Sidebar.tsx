"use client";

/**
 * Sidebar — lean flat-warm shell (Maven Rework P1, D-10..D-16)
 *
 * Sections (top → bottom):
 *  ⊕ New Thread     — coral primary CTA, ⌘N shortcut; opens the /home composer (which IS the home)
 *  Discover         — the outward-looking hub (Watching · Trending · Competitors) → /feed
 *  Audience         — the calibrated-audience moat (D-04)
 *  Library          — saved-content State surface (IA-01 / D-01) → /library
 *  Thread           — chronological chat history; rows re-open in place
 *  👤 Account        — bottom-anchored, user avatar + settings/logout
 *
 * MVP launch cut (lane/launch-prep, 2026-07-15): the standalone briefing was removed after preview
 * (New Thread / the /home composer IS the home), and Calendar · Discover · Library · Start were
 * hidden with their routes redirecting to /home.
 *
 * Discover + Library were REACTIVATED 2026-07-29 at the owner's request — their NavItems are back
 * and their page.tsx redirects reverted. Calendar · Start are still hidden (→ /home); restore them
 * the same way (NavItem + revert the redirect) if they're ever wanted back.
 *
 * Flat-warm matte: no Raycast glass, no blur, no inset shine (THEME-02 Layer B).
 * Desktop: persistent + collapsible to an icon rail via ⌘\ (D-14), choice
 *   persisted via sidebar-store; main content offset by app-shell.
 * Mobile: slide-in drawer from the left with a backdrop (D-15); never a rail.
 */

import { useEffect, useState } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  Plus,
  MagnifyingGlass,
  PushPin,
  PencilSimple,
  SlidersHorizontal,
  ClockCountdown,
  UserCircle,
  List,
  SidebarSimple,
  SignOut,
  CaretUpDown,
  UsersThree,
  Books,
  Binoculars,
  Trash,
  Check,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, FOCUS_RING as focusRing } from "@/lib/utils";
import { MavenMark } from "@/components/brand/maven-logo";
import {
  useThreadList,
  useArchiveThread,
  useRenameThread,
  usePinThread,
  type ThreadSummary,
} from "@/hooks/queries";
import {
  setActiveThreadCookie,
  clearActiveThreadCookie,
  NEW_THREAD_SENTINEL,
} from "@/lib/threads/active-thread-cookie";
import { useProfile } from "@/hooks/queries/use-profile";
import { useBoardStore } from "@/stores/board-store";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// ─── relative-time helper ─────────────────────────────────────────
const rtf = typeof Intl !== 'undefined'
  ? new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' })
  : null;

function relativeTime(iso: string | undefined): string {
  if (!iso || !rtf) return '';
  const parsed = Date.parse(iso);
  // WR-06: guard NaN (undefined/malformed created_at) — Math.round(NaN) feeds
  // RelativeTimeFormat "NaN days ago"; return '' so the caller drops the
  // separator entirely instead of rendering a broken label.
  if (Number.isNaN(parsed)) return '';
  const diffSec = (parsed - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  // WR-06: roll up past a day so a 45-day-old simulation reads "1mo"/"2mo"
  // instead of "45d" (the 'narrow' style expects coarse buckets here).
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day');
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), 'month');
  return rtf.format(Math.round(diffSec / 31536000), 'year');
}
import { useSidebarStore } from "@/stores/sidebar-store";
import { createClient } from "@/lib/supabase/client";

// ─── sub-components ──────────────────────────────────────────────

/** Section header label — hidden in collapsed mode */
function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "block px-2.5 mb-1.5 text-caption font-semibold text-foreground-muted uppercase tracking-[0.08em]",
        "transition-opacity duration-150",
        className,
      )}
    >
      {children}
    </span>
  );
}

interface NavItemProps {
  icon: PhosphorIcon;
  label: string;
  isActive?: boolean;
  isCollapsed?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
  className?: string;
}

/** Single nav item — collapses to icon-only when `isCollapsed` */
function NavItem({
  icon: IconComp,
  label,
  isActive = false,
  isCollapsed = false,
  onClick,
  badge,
  className,
}: NavItemProps) {
  const item = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Density matched to the references (2026-07-28). Ours ran 34px rows / 14px
        // text / 20px icons; Linear runs roughly 30 / 13 / 16. The chunkier row read
        // as a touch target in a desktop app — and with only two destinations in the
        // nav, the extra weight made the panel look emptier, not fuller.
        //
        // …which is exactly why the floor is `pointer-coarse` and not unconditional (F-19,
        // measured 203×30). On a phone this same panel IS a touch surface — the drawer only
        // exists there — so the row that was deliberately made desktop-tight gets the 44px floor
        // back on touch. Real height, not a `.tap-44` halo: these are full-width stacked boxes
        // 2px apart, so growing them collides with nothing and the drawn row matches the target.
        "w-full flex items-center gap-2 px-2.5 min-h-[30px] pointer-coarse:min-h-11 rounded-md text-body font-medium",
        "transition-colors duration-100",
        focusRing,
        isCollapsed && "justify-center px-0",
        isActive
          ? "bg-white/[0.06] text-foreground"
          : "text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground",
        className,
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        icon={IconComp}
        size={16}
        weight={isActive ? "fill" : "regular"}
        className={cn(
          isActive && "text-foreground",
        )}
      />
      {!isCollapsed && (
        <span className="flex-1 truncate text-left">{label}</span>
      )}
      {!isCollapsed && badge}
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return item;
}

/**
 * One chat-thread row: the full-width open button plus a hover-revealed delete
 * affordance. The open action and the delete action are SIBLING buttons inside a
 * div (a button cannot nest inside a button). Delete is two-step — a trash icon
 * arms an inline check/cancel confirm — so a single stray click never drops a
 * thread. The confirm disarms when the pointer leaves the row.
 */
function ThreadRow({
  thread,
  isActive,
  isPending = false,
  onOpen,
  onDelete,
  onTogglePin,
  onRename,
}: {
  thread: ThreadSummary;
  isActive: boolean;
  /** Reserved for a mid-load pulse. Opening is now instant (pointer re-point, no
   *  round-trip) and the active-row highlight lands synchronously, so callers pass
   *  false; kept so a future async open can re-enable the terracotta dim-pulse. */
  isPending?: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onRename: (title: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const when = relativeTime(thread.updated_at);
  const label = thread.title ?? "New chat";
  const isPinned = thread.pinned_at != null;
  const onStartRename = () => setRenaming(true);

  // Rename mode replaces the whole row with a bare input. Enter commits, Escape
  // and blur both cancel-or-commit as you'd expect; an emptied field clears the
  // title, which hands the thread back to automatic derivation.
  if (renaming) {
    return (
      <div className="flex items-center rounded-lg bg-white/[0.04] px-1">
        <input
          autoFocus
          defaultValue={thread.title ?? ""}
          aria-label={`Rename ${label}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRename((e.target as HTMLInputElement).value);
              setRenaming(false);
            } else if (e.key === "Escape") {
              setRenaming(false);
            }
          }}
          onBlur={(e) => {
            onRename(e.target.value);
            setRenaming(false);
          }}
          className={cn(
            "w-full min-w-0 bg-transparent px-1.5 py-1 text-body text-foreground",
            "outline-none placeholder:text-foreground-muted",
          )}
          placeholder="Thread name"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/row relative flex items-center rounded-lg transition-colors",
        // A2 pending: terracotta is the live/active dosage — earned here (an action is
        // in flight). Dim-pulse reads as "working"; disabled on reduced motion.
        isPending
          ? "border-l-2 border-l-accent bg-white/[0.03] animate-pulse motion-reduce:animate-none"
          : isActive
            ? "bg-white/[0.06]"
            : "hover:bg-white/[0.04]",
      )}
      aria-busy={isPending || undefined}
      onMouseLeave={() => setConfirming(false)}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          // `pointer-coarse:min-h-11` — the 44px touch floor (F-19, measured 129×30). Same
          // reasoning as <NavItem>: desktop density stays, the phone drawer gets a real target.
          "min-w-0 flex-1 flex items-center gap-2 pl-2.5 pr-1 min-h-[30px] pointer-coarse:min-h-11 text-left text-body",
          focusRing,
          isActive
            ? "text-foreground"
            : "text-foreground-secondary group-hover/row:text-foreground",
        )}
        aria-current={isActive ? "page" : undefined}
      >
        {isPinned && (
          <PushPin
            className="h-3 w-3 shrink-0 text-foreground-muted"
            weight="fill"
            aria-hidden
          />
        )}
        <span className="truncate flex-1" data-testid="sidebar-thread-label">
          {thread.title ? (
            label
          ) : (
            <>
              New chat
              {when && <span className="text-foreground-muted"> · {when}</span>}
            </>
          )}
        </span>
      </button>

      {confirming ? (
        <div className="flex items-center gap-0.5 pr-1">
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${label}`}
            className={cn("rounded p-1 pointer-coarse:p-2 pointer-coarse:min-h-11 text-error hover:bg-white/[0.06]", focusRing)}
          >
            <Check className="h-3.5 w-3.5" weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            aria-label="Cancel delete"
            className={cn("rounded p-1 pointer-coarse:p-2 pointer-coarse:min-h-11 text-foreground-muted hover:bg-white/[0.06]", focusRing)}
          >
            <X className="h-3.5 w-3.5" weight="bold" />
          </button>
        </div>
      ) : (
        // Hover affordances: pin · rename · delete. All three stay hidden until the
        // row is hovered or keyboard-focused, so a long history reads as a clean list
        // rather than a wall of icons. The pin also shows persistently on the LABEL
        // side when set (above) — that one is state, not an action.
        //
        // 🔴 ON TOUCH THERE IS NO HOVER, AND `opacity-0` IS STILL CLICKABLE.
        // Found while enumerating F-19's 84 sub-40px targets (2026-08-14): 39 of them were these
        // three buttons × 13 rows, every one of them INVISIBLE and live. On a phone the right end
        // of every thread row carried three unmarked 22px hit zones, and the rightmost was
        // `Delete thread` — a destructive action with no affordance, reachable by a mis-aimed tap
        // on a row you meant to open. The audit counted them as "small targets"; the size was the
        // lesser half of the bug.
        //
        // Two changes, and the first matters more than the second:
        //   1. `pointer-events-none` while hidden — an invisible control cannot be pressed by
        //      ANY pointer now, which also closes the desktop version (a 0-opacity button was
        //      still hittable in the 100ms before the row's hover transition ran).
        //   2. On coarse pointers the trio is REVEALED on the active row, so the actions stay
        //      reachable on a phone instead of being silently deleted from the surface. The
        //      active row is one row, not thirteen, so the list stays clean.
        //
        // ⚠️ NOT `.tap-44` here. Three 22px icons 2px apart become three 44px halos overlapping
        // by 20px, and the later sibling wins the tap — aiming at Rename would fire Delete. That
        // is worse than a small target, so these grow their real box instead (see below).
        <div
          className={cn(
            "mr-1 flex items-center gap-0.5 pointer-coarse:gap-1 opacity-0 pointer-events-none transition-opacity",
            "group-hover/row:opacity-100 group-hover/row:pointer-events-auto",
            "focus-within:opacity-100 focus-within:pointer-events-auto",
            isActive && "pointer-coarse:opacity-100 pointer-coarse:pointer-events-auto",
          )}
        >
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={isPinned ? `Unpin ${label}` : `Pin ${label}`}
            aria-pressed={isPinned}
            className={cn(
              "rounded p-1 pointer-coarse:p-2 pointer-coarse:min-h-11 hover:bg-white/[0.06] hover:text-foreground",
              isPinned ? "text-foreground" : "text-foreground-muted",
              focusRing,
            )}
          >
            <PushPin className="h-3.5 w-3.5" weight={isPinned ? "fill" : "regular"} />
          </button>
          <button
            type="button"
            onClick={onStartRename}
            aria-label={`Rename ${label}`}
            className={cn(
              "rounded p-1 pointer-coarse:p-2 pointer-coarse:min-h-11 text-foreground-muted hover:bg-white/[0.06] hover:text-foreground",
              focusRing,
            )}
          >
            <PencilSimple className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete thread: ${label}`}
            className={cn(
              "rounded p-1 pointer-coarse:p-2 pointer-coarse:min-h-11 text-foreground-muted hover:bg-white/[0.06] hover:text-foreground",
              focusRing,
            )}
          >
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { isOpen, close, isCollapsed, toggleCollapsed, setCommandOpen } = useSidebarStore();
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const switchThread = useBoardStore((s) => s.switchThread);
  const setActiveThreadId = useBoardStore((s) => s.setActiveThreadId);
  const activeThreadId = useBoardStore((s) => s.activeThreadId);
  const archiveThread = useArchiveThread();
  const renameThread = useRenameThread();
  const pinThread = usePinThread();
  const { toast } = useToast();

  // Mobile drawer hygiene: ANY navigation tap must land the creator ON the
  // destination, not back under the still-open sheet (live-caught 2026-07-20:
  // New Thread left the drawer + scrim covering the fresh home). Desktop no-ops —
  // the persistent panel never closes on navigation.
  const closeIfMobile = () => {
    if (isMobile) close();
  };

  // Open a fresh BLANK thread. No DB row is created here — a blank thread must not
  // pollute history. The pointer is set to the new-thread sentinel so the composer
  // renders empty; the row is created lazily on the first message send
  // (ensureThreadForSend in composer.tsx).
  const handleNewThread = () => {
    setActiveThreadCookie(NEW_THREAD_SENTINEL);
    setActiveThreadId(null);
    switchThread();
    closeIfMobile();
    router.push("/home");
  };

  // Re-open a past thread. Re-points the active-thread cookie (NO updated_at touch),
  // so the thread resumes exactly where it was WITHOUT jumping to the top of history
  // — only a sent message re-orders. The composer reloads on switchThread().
  const handleOpenThread = (id: string) => {
    setActiveThreadCookie(id);
    setActiveThreadId(id);
    switchThread();
    closeIfMobile();
    router.push("/home");
  };

  // Delete (archive) a thread. If it was the active one while the user is on /home,
  // clear the pointer so the composer reloads onto the newest remaining open thread.
  const handleDeleteThread = async (id: string, wasActive: boolean) => {
    try {
      await archiveThread.mutateAsync(id);
    } catch {
      // This catch used to be empty, justified by "the refetch reconciles the sidebar
      // either way" — it does not. The optimistic drop (use-threads onMutate) removes the
      // row instantly and the rollback puts it back ~2 s later, so a server failure read as
      // a UI glitch: the thread "flickered deleted" and returned, silently, forever (F-021).
      // Tell the creator, and DON'T fall through to the active-thread cleanup below — the
      // thread still exists, so dropping the pointer would strand them off a live thread.
      toast({ variant: "error", title: "Couldn't delete that thread." });
      return;
    }
    if (wasActive && pathname === "/home") {
      clearActiveThreadCookie();
      setActiveThreadId(null);
      switchThread();
    }
  };

  // Desktop persistent+collapsible (D-14): collapse to an icon rail.
  // Mobile (D-15): a slide-in drawer driven by isOpen — never the collapsed rail.
  const effectiveCollapsed = !isMobile && isCollapsed;

  // ⌘\ / Ctrl-\ toggles the persisted collapse (D-14). Choice survives reload
  // via the sidebar-store 'virtuna-sidebar' persist key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleCollapsed();
      }
      // ⌘N / Ctrl-N opens a fresh chat thread (matches the New Thread badge).
      if ((e.metaKey || e.ctrlKey) && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        void handleNewThread();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleCollapsed]);

  // Chat threads — each conversation is its own listable thread (active = first).
  // Declutter (2026-07-06): the sidebar IS the chat-history surface, but empty untitled
  // "New chat" placeholders carry no signal and dominated the list. Keep every TITLED
  // thread (the real history) plus the newest one regardless (so /home's active-row
  // highlight, keyed to index 0, still lands even on a fresh untitled thread), cap 12.
  const { data: threads, isLoading: threadsLoading } = useThreadList();
  const recentThreads = (threads ?? [])
    .filter((t, i) => i === 0 || Boolean(t.title && t.title.trim()))
    .slice(0, 12);

  // User profile for Account section
  const { data: profile } = useProfile();

  // Analytics folded into /audience (/analytics + /grow redirect there), so those light Audience.
  const isOnAudience =
    pathname.startsWith("/audience") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/grow");
  // Discover is a hub at /feed and everything under it — the content tabs, the Channels/Hooks/
  // Pull tool tabs, and the two legacy doors that redirect in (/competitors → ?tab=competitors,
  // /discover → /feed/discover). The /feed prefix covers the subtree; the other two are listed
  // so the item stays lit during the redirect rather than blinking off mid-navigation.
  const isOnDiscover =
    pathname.startsWith("/feed") ||
    pathname.startsWith("/competitors") ||
    pathname.startsWith("/discover");
  // /saved redirects to /library over the same saved_items store, so it lights Library too.
  const isOnLibrary = pathname.startsWith("/library") || pathname.startsWith("/saved");

  const [accountOpen, setAccountOpen] = useState(false);

  // CR-04: close account popover on outside-click or Escape.
  useEffect(() => {
    if (!accountOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAccountOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-account-menu]')) setAccountOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [accountOpen]);

  return (
    <>
      {/* Mobile overlay backdrop — mobile ONLY (md:hidden). On desktop the sidebar
          is a persistent push panel, so no scrim darkens the content and clicking
          the main view never closes it. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[calc(var(--z-sidebar)-1)] bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <nav
        className={cn(
          // FLUSH TO THE EDGE (2026-07-28). This used to be a floating inset card:
          // `top-3 left-3 bottom-3 … rounded-xl border` on a LIFTED surface. It read
          // as a widget parked next to the app rather than as the app's own chrome —
          // and it cost 24px of horizontal room to say so. Linear, Attio and Cursor
          // all run the nav flush to the window edge, separated from content by a
          // single hairline and nothing else. Same panel, one border, no gap.
          "fixed inset-y-0 left-0 z-[var(--z-sidebar)]",
          "flex flex-col overflow-hidden",
          // Same tone as the content surface — the hairline does ALL the separating.
          // (Was bg-background-elevated #2c2c2b, a visible tone-step that made the
          // panel read as raised.) On mobile it's an overlay drawer, but it keeps its
          // existing bg-black/50 scrim below, so it still reads as floating there.
          "bg-[var(--color-chrome)] border-r border-white/[0.06]",
          effectiveCollapsed ? "w-[56px]" : "w-[220px]",
          !reducedMotion && "transition-[transform,width] duration-150 ease-[var(--ease-out-cubic)]",
          // Mobile: slide-in driven by isOpen. Desktop (md:): ALWAYS visible
          // (md:translate-x-0 overrides the hidden transform) — persistent, never
          // slid off-canvas. ⌘\ / the header button collapse it to a rail instead.
          // Plain -translate-x-full now: there is no 12px inset left to clear.
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        aria-label="App navigation"
      >
        {/* ── Header: Logo + collapse/close ── */}
        <div
          className={cn(
            "flex items-center px-3 pt-4 pb-2",
            effectiveCollapsed ? "justify-center" : "justify-between",
          )}
        >
          {!effectiveCollapsed && (
            <Link href="/" className="tap-44 group text-foreground pl-2" aria-label="Maven home">
              <MavenMark size={26} />
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            // Desktop: collapse to the icon rail (mirrors ⌘\). Mobile: close the
            // drawer. Never hide the persistent desktop panel into a dead gap.
            onClick={isMobile ? close : toggleCollapsed}
            aria-label={isMobile ? "Close sidebar" : "Collapse sidebar"}
            className="tap-44 flex text-foreground-muted hover:text-foreground p-1.5 -mr-1"
          >
            <Icon icon={SidebarSimple} size={20} />
          </Button>
        </div>

        {/* Scrollable body — scrollbar hidden for a clean glass edge */}
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden gap-0.5 px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          {/* ── ⌕ Search / ⊕ New Thread — the two verbs, in the reference idiom ──
              Attio and Linear both open the nav with a search affordance above the
              destinations, because search IS the primary navigation once history
              outgrows the panel. The palette itself mounts in AppShell, not here:
              this <nav> animates with translate-x, and a transformed ancestor makes
              a fixed-position child resolve against IT rather than the viewport. */}
          <div className="flex flex-col gap-0.5 pb-1">
            <NavItem
              icon={Plus}
              label="New Thread"
              isCollapsed={effectiveCollapsed}
              onClick={() => { void handleNewThread(); }}
              badge={
                !effectiveCollapsed && (
                  <span className="ml-auto text-caption text-foreground-muted font-normal tabular-nums">⌘N</span>
                )
              }
            />
          </div>

          {/* Divider */}
          <div className="mx-2 border-t border-white/[0.06]" />

          {/* ── Destinations — Discover · Audience · Library (Discover + Library reactivated
              2026-07-29; they had redirected to /home since the 2026-07-15 launch cut). Kept as a
              FLAT list: the old Create/Analyze/Assets umbrella labels existed to chunk five items
              across three groups, and three items don't need chunking — a label per pair here would
              just echo its own item. Calendar · Start stay hidden (→ /home). ── */}
          <div className="pt-3 flex flex-col gap-0.5">
            {/* Discover — the outward-looking hub at /feed: Watching (watched channels' outliers) ·
                Trending · Competitors, plus the Channels · Hooks · Pull tool tabs. /competitors
                and /discover deep-link into it, so the whole subtree lights this one item. */}
            <NavItem
              icon={Binoculars}
              label="Discover"
              isActive={isOnDiscover}
              isCollapsed={effectiveCollapsed}
              onClick={() => { closeIfMobile(); router.push("/feed"); }}
            />
            {/* Audience Manager — the calibrated-audience moat; D-04 per-thread pin entry point. */}
            <NavItem
              icon={UsersThree}
              label="Audience"
              isActive={isOnAudience}
              isCollapsed={effectiveCollapsed}
              onClick={() => { closeIfMobile(); router.push("/audience"); }}
            />
            {/* Library — saved State surface (IA-01 / D-01). NO accent: its active
                state is matte white/[0.06] — the nav's one accent belongs to "New Thread". */}
            <NavItem
              icon={Books}
              label="Library"
              isActive={isOnLibrary}
              isCollapsed={effectiveCollapsed}
              onClick={() => { closeIfMobile(); router.push("/library"); }}
            />
          </div>

          {/* ── Chat thread history (multi-thread) ── */}
          <div className="pt-4 flex-1">
            {/* Threads header — and the search that acts ON it. Search opened the nav
                (Attio/Linear idiom) until it read as odd here: those products search a
                large place graph, ours has two destinations, so a top-anchored Search
                promised navigation it can't deliver. Sitting on the Threads header it
                says what it actually does. ⌘K is unchanged and still global. */}
            {!effectiveCollapsed && (
              <div className="flex items-center justify-between pr-1">
                <SectionLabel className="mb-0">Threads</SectionLabel>
                <button
                  type="button"
                  onClick={() => { closeIfMobile(); setCommandOpen(true); }}
                  aria-label="Search threads"
                  className={cn(
                    "tap-44 -mt-1 flex items-center gap-1 rounded-md px-1.5 py-1",
                    "text-foreground-muted transition-colors hover:bg-white/[0.04] hover:text-foreground",
                    focusRing,
                  )}
                >
                  <Icon icon={MagnifyingGlass} size={16} />
                  <span className="text-caption font-normal tabular-nums">⌘K</span>
                </button>
              </div>
            )}
            {threadsLoading && !effectiveCollapsed && (
              <div className="flex flex-col gap-2 px-2.5 pt-1">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3.5 w-5/6" />
              </div>
            )}
            {!threadsLoading && recentThreads.length === 0 && !effectiveCollapsed && (
              <p className="px-2.5 py-1 text-xs text-foreground-muted">
                No threads yet.
              </p>
            )}
            {!threadsLoading && !effectiveCollapsed && (
              <div className="flex flex-col gap-px">
                {recentThreads.map((thread) => {
                  // Active = the OPEN thread (pointer), not "row 0" — re-opening an
                  // old thread highlights it in place without reordering history.
                  const isActive = pathname === "/home" && thread.id === activeThreadId;
                  return (
                    <ThreadRow
                      key={thread.id}
                      thread={thread}
                      isActive={isActive}
                      isPending={false}
                      onOpen={() => { handleOpenThread(thread.id); }}
                      onDelete={() => { void handleDeleteThread(thread.id, isActive); }}
                      onTogglePin={() => { pinThread.mutate({ id: thread.id, pinned: thread.pinned_at == null }); }}
                      onRename={(title) => { renameThread.mutate({ id: thread.id, title }); }}
                    />
                  );
                })}
              </div>
            )}
            {effectiveCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => router.push("/home")}
                    className="w-full flex justify-center py-2 text-foreground-muted hover:text-foreground transition-colors"
                    aria-label="Thread"
                  >
                    <ClockCountdown className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Thread</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* ── 👤 Account (bottom-anchored) ── */}
        <div className="border-t border-white/[0.06] px-2 py-2">
          {!effectiveCollapsed ? (
            <div className="relative" data-account-menu>
              <button
                type="button"
                onClick={() => setAccountOpen((prev) => !prev)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2 py-1.5 pointer-coarse:min-h-11 rounded-lg",
                  "text-sm text-foreground-secondary",
                  "hover:bg-white/[0.04] hover:text-foreground transition-colors",
                  focusRing,
                  accountOpen && "bg-white/[0.04] text-foreground",
                )}
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
              >
                <Avatar
                  fallback={
                    profile?.name
                      ? profile.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                      : "?"
                  }
                  size="xs"
                />
                <span className="flex-1 truncate text-left text-body font-medium">
                  {profile?.name ?? profile?.email ?? "Account"}
                </span>
                <CaretUpDown weight="bold" className="h-3.5 w-3.5 shrink-0 text-foreground-muted" />
              </button>

              {/* Account popover — CR-04: role=menu, outside-click/Escape handled via useEffect */}
              {accountOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-white/[0.06] overflow-hidden bg-surface-elevated shadow-float"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { closeIfMobile(); router.push("/settings"); setAccountOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 min-h-[40px] text-sm text-foreground-secondary hover:bg-white/[0.05] hover:text-foreground transition-colors"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                  <div className="mx-3 border-t border-white/[0.06]" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => { setAccountOpen(false); await supabase.auth.signOut(); /* WR-04: AuthGuard's onAuthStateChange owns the post-logout redirect (→ /login). Don't navigate here too — two competing router calls made the landing route non-deterministic. */ }}
                    className="w-full flex items-center gap-2 px-3 min-h-[40px] text-sm text-foreground-secondary hover:bg-white/[0.05] hover:text-foreground transition-colors"
                  >
                    <SignOut className="h-4 w-4" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => router.push("/settings")}
                  className="w-full flex justify-center py-2 text-foreground-muted hover:text-foreground transition-colors"
                  aria-label="Account settings"
                >
                  <UserCircle className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Account</TooltipContent>
            </Tooltip>
          )}
        </div>
      </nav>
    </>
  );
}

/**
 * Mobile nav opener — a TAB in the top row, shown when the sidebar is closed.
 *
 * History (2026-07-24): a 34px hamburger at `left-4 top-4`, then briefly an edge sliver at the
 * vertical centre, now this — bar height, sitting immediately left of the audience bar so the two
 * read as ONE navigation row (owner call). The caret still points right: the sidebar slides in from
 * that edge, and the tab hugs the row's left margin.
 *
 * ⚠️ The paragraph that stood here described geometry COUPLED to the composer's audience header
 * slot — the bar that used to share this row. On 2026-07-31 that bar moved into the composer dock
 * (it is now the strip fused to the field's top edge), so the tab is the row's only occupant and
 * `MOBILE_NAV_BAR_INSET` has no consumer left. The band + tab numbers below are still live.
 */
/** The mobile top-nav band. All px. `gap` is retained for the day a second item joins the row. */
export const MOBILE_NAV = {
  /** Page gutter — the opener's left edge, and the row's right edge. */
  gutter: 10,
  /** Top offset of the band. */
  top: 10,
  /** Opener height. Was 45 to match the audience bar it shared the row with; that bar moved into
   *  the composer dock on 2026-07-31, so the opener is square again — a burger, not a tab. */
  height: 36,
  /** Opener width. */
  width: 36,
  /** Gap between the opener and anything that joins it in the row. */
  gap: 8,
} as const;

/** Left inset the audience bar needs to clear the tab: gutter + tab + gap. */
export const MOBILE_NAV_BAR_INSET = MOBILE_NAV.gutter + MOBILE_NAV.width + MOBILE_NAV.gap;

/** Vertical band the fixed tab occupies — what a page must reserve so nothing renders under it. */
export const MOBILE_NAV_BAND = MOBILE_NAV.top + MOBILE_NAV.height;

export function SidebarHamburger() {
  const { isOpen, open } = useSidebarStore();

  return (
    <>
      {/* F-18 — THE SCRIM. The opener is opaque and fixed, and the thread scrolls under it, so
          before this a sentence ran into a 36px square and continued on its far side. Painting
          only the button's own footprint was never enough: the collision is with the BAND, not the
          chip. This is the band, faded out below (`.nav-scrim`).

          `pointer-events-none` — a card that scrolls up into the fade must stay tappable; the
          scrim dims it, it does not disable it. One z below the opener so the button keeps its
          own ground. `md:hidden` + `isOpen` track the opener exactly: with the drawer open the
          opener is gone and there is nothing to protect. */}
      <div
        aria-hidden
        className={cn(
          "nav-scrim pointer-events-none fixed inset-x-0 top-0 h-[66px] bg-background",
          "z-[calc(var(--z-sidebar)-1)] md:hidden",
          isOpen ? "hidden" : "block",
        )}
      />
      <button
        type="button"
        onClick={open}
        aria-label="Open sidebar"
        style={{
          left: MOBILE_NAV.gutter,
          top: MOBILE_NAV.top,
          height: MOBILE_NAV.height,
          width: MOBILE_NAV.width,
        }}
        className={cn(
          "fixed z-[var(--z-sidebar)] items-center justify-center",
          // Keeps its own opaque ground even though the band behind it is transparent now: the thread
          // scrolls UNDER this button, and a see-through opener over moving text is unreadable.
          "rounded-[10px] border border-white/[0.06] bg-[#181817] transition-colors active:bg-[#32312e]",
          // 36px is the drawn size the owner settled on; 44px is the tap floor. `.tap-44` grows the
          // HIT AREA only, so the burger keeps its geometry and `MOBILE_NAV_BAND` — which the
          // thread's scroll reserve is derived from — does not move.
          "tap-44",
          // Mobile only — the desktop sidebar is always present, so the opener
          // never appears ≥md regardless of isOpen.
          "md:hidden",
          isOpen ? "hidden" : "flex",
        )}
      >
        {/* A burger again (2026-07-31, owner call). The caret was a TAB's glyph — it belonged to the
            edge-sliver shape that shared a row with the audience bar, and read as "expand this panel"
            rather than "open the menu" once the bar moved into the composer dock. */}
        <List className="h-[18px] w-[18px] text-foreground/70" weight="bold" />
      </button>
    </>
  );
}
