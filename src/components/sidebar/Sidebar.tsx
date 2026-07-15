"use client";

/**
 * Sidebar — lean flat-warm shell (Maven Rework P1, D-10..D-16)
 *
 * Sections (top → bottom):
 *  ⊕ New Thread     — coral primary CTA, ⌘N shortcut, always visible
 *  Start            — briefing landing + outcome capture
 *  Audience         — the calibrated-audience moat (D-04)
 *  Thread           — chronological chat history; rows re-open in place
 *  👤 Account        — bottom-anchored, user avatar + settings/logout
 *
 * MVP launch cut (lane/launch-prep, 2026-07-15): Calendar · Discover · Library nav
 * items are hidden and their routes redirect to /home. Restore the NavItems here +
 * revert the page.tsx redirects (git) to bring them back feature-by-feature post-launch.
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
  SlidersHorizontal,
  ClockCountdown,
  UserCircle,
  List,
  SidebarSimple,
  SignOut,
  CaretUpDown,
  House,
  UsersThree,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MavenMark } from "@/components/brand/maven-logo";
import {
  useThreadList,
  useArchiveThread,
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

// Branded keyboard-focus ring — replaces the browser-default blue outline on
// raw <button>s. Inset so it never spills past the panel's rounded clip.
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/10";
import { useSidebarStore } from "@/stores/sidebar-store";
import { createClient } from "@/lib/supabase/client";

// ─── sub-components ──────────────────────────────────────────────

/** Section header label — hidden in collapsed mode */
function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "block px-2.5 mb-1.5 text-[10px] font-semibold text-foreground-muted uppercase tracking-[0.08em]",
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
        "w-full flex items-center gap-2.5 px-2.5 min-h-[34px] rounded-lg text-sm font-medium",
        "transition-colors duration-100",
        focusRing,
        isCollapsed && "justify-center px-0",
        isActive
          ? "bg-white/[0.06] text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
          : "text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground",
        className,
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        icon={IconComp}
        size={20}
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
}: {
  thread: ThreadSummary;
  isActive: boolean;
  /** Reserved for a mid-load pulse. Opening is now instant (pointer re-point, no
   *  round-trip) and the active-row highlight lands synchronously, so callers pass
   *  false; kept so a future async open can re-enable the terracotta dim-pulse. */
  isPending?: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const when = relativeTime(thread.updated_at);
  const label = thread.title ?? "New chat";

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
          "min-w-0 flex-1 flex items-center gap-2 pl-2.5 pr-1 min-h-[30px] text-left text-[13px]",
          focusRing,
          isActive
            ? "text-foreground"
            : "text-foreground-secondary group-hover/row:text-foreground",
        )}
        aria-current={isActive ? "page" : undefined}
      >
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
            className={cn("rounded p-1 text-error hover:bg-white/[0.06]", focusRing)}
          >
            <Check className="h-3.5 w-3.5" weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            aria-label="Cancel delete"
            className={cn("rounded p-1 text-foreground-muted hover:bg-white/[0.06]", focusRing)}
          >
            <X className="h-3.5 w-3.5" weight="bold" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete thread: ${label}`}
          className={cn(
            "mr-1 rounded p-1 text-foreground-muted opacity-0 transition-opacity",
            "group-hover/row:opacity-100 focus-visible:opacity-100",
            "hover:text-foreground hover:bg-white/[0.06]",
            focusRing,
          )}
        >
          <Trash className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { isOpen, close, isCollapsed, toggleCollapsed } = useSidebarStore();
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const switchThread = useBoardStore((s) => s.switchThread);
  const setActiveThreadId = useBoardStore((s) => s.setActiveThreadId);
  const activeThreadId = useBoardStore((s) => s.activeThreadId);
  const archiveThread = useArchiveThread();

  // Open a fresh BLANK thread. No DB row is created here — a blank thread must not
  // pollute history. The pointer is set to the new-thread sentinel so the composer
  // renders empty; the row is created lazily on the first message send
  // (ensureThreadForSend in composer.tsx).
  const handleNewThread = () => {
    setActiveThreadCookie(NEW_THREAD_SENTINEL);
    setActiveThreadId(null);
    switchThread();
    router.push("/home");
  };

  // Re-open a past thread. Re-points the active-thread cookie (NO updated_at touch),
  // so the thread resumes exactly where it was WITHOUT jumping to the top of history
  // — only a sent message re-orders. The composer reloads on switchThread().
  const handleOpenThread = (id: string) => {
    setActiveThreadCookie(id);
    setActiveThreadId(id);
    switchThread();
    router.push("/home");
  };

  // Delete (archive) a thread. If it was the active one while the user is on /home,
  // clear the pointer so the composer reloads onto the newest remaining open thread.
  const handleDeleteThread = async (id: string, wasActive: boolean) => {
    try {
      await archiveThread.mutateAsync(id);
    } catch {
      // Non-fatal: the thread-list refetch reconciles the sidebar either way.
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

  const isOnStart = pathname.startsWith("/start");
  // Analytics folded into /audience (/analytics + /grow redirect there), so those light Audience.
  const isOnAudience =
    pathname.startsWith("/audience") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/grow");

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
          // Base — flat-warm matte: solid charcoal sidebar + hairline (no glass, no blur, no inset shine)
          "fixed top-3 left-3 bottom-3 z-[var(--z-sidebar)]",
          "flex flex-col overflow-hidden rounded-xl",
          "bg-background-elevated border border-white/[0.06]",
          effectiveCollapsed ? "w-[60px]" : "w-[220px]",
          !reducedMotion && "transition-[transform,width] duration-150 ease-[var(--ease-out-cubic)]",
          // Mobile: slide-in driven by isOpen. Desktop (md:): ALWAYS visible
          // (md:translate-x-0 overrides the hidden transform) — persistent, never
          // slid off-canvas. ⌘\ / the header button collapse it to a rail instead.
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+12px)] md:translate-x-0",
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
            <Link href="/" className="group text-foreground pl-2" aria-label="Maven home">
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
            className="flex text-foreground-muted hover:text-foreground p-1.5 -mr-1"
          >
            <Icon icon={SidebarSimple} size={20} />
          </Button>
        </div>

        {/* Scrollable body — scrollbar hidden for a clean glass edge */}
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden gap-0.5 px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          {/* ── ⊕ New Thread ── */}
          <div className="pb-1">
            <NavItem
              icon={Plus}
              label="New Thread"
              isCollapsed={effectiveCollapsed}
              onClick={() => { void handleNewThread(); }}
              badge={
                !effectiveCollapsed && (
                  <span className="ml-auto text-[11px] text-foreground-muted font-normal tabular-nums">⌘N</span>
                )
              }
            />
          </div>

          {/* Divider */}
          <div className="mx-2 border-t border-white/[0.06]" />

          {/* ── Destinations — the MVP launch loop. Calendar · Discover · Library are
              hidden for launch (route-guarded → /home); the nav is the two surfaces the
              core loop needs: Start (briefing + outcome capture) and Audience (the calibrated
              moat). Flat list — with two items the Create/Analyze/Assets group labels were
              just echoing their single child. ── */}
          <div className="pt-3 flex flex-col gap-0.5">
            {/* Start — the flagship briefing landing: your day, pre-tested on your people.
                /home stays the thread/composer surface, so this never steals the thread flow. */}
            <NavItem
              icon={House}
              label="Start"
              isActive={isOnStart}
              isCollapsed={effectiveCollapsed}
              onClick={() => router.push("/start")}
            />
            {/* Audience Manager — the calibrated-audience moat; D-04 per-thread pin entry point. */}
            <NavItem
              icon={UsersThree}
              label="Audience"
              isActive={isOnAudience}
              isCollapsed={effectiveCollapsed}
              onClick={() => router.push("/audience")}
            />
          </div>

          {/* ── Chat thread history (multi-thread) ── */}
          <div className="pt-4 flex-1">
            {!effectiveCollapsed && <SectionLabel>Threads</SectionLabel>}
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
                  "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg",
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
                <span className="flex-1 truncate text-left text-[13px] font-medium">
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
                    onClick={() => { router.push("/settings"); setAccountOpen(false); }}
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

/** Mobile hamburger toggle — shows when sidebar is closed */
export function SidebarHamburger() {
  const { isOpen, open } = useSidebarStore();

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Open sidebar"
      className={cn(
        "fixed left-4 top-4 z-[var(--z-sidebar)]",
        "h-[34px] w-[34px] items-center justify-center rounded-[10px]",
        // flat-warm matte: solid charcoal + hairline + soft float shadow (no glass, no blur)
        "bg-background-elevated border border-white/[0.06] shadow-float",
        // Mobile only — the desktop sidebar is always present, so the hamburger
        // never appears ≥md regardless of isOpen.
        "md:hidden",
        isOpen ? "hidden" : "flex",
      )}
    >
      <List className="h-4 w-4 text-foreground/70" />
    </button>
  );
}
