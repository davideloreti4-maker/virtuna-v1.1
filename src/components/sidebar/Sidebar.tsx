"use client";

/**
 * Sidebar — Phase 2.5 restructured nav (D-11, D-12, R1.10)
 *
 * Sections (top → bottom):
 *  ⊕ New analysis   — coral primary CTA, ⌘N shortcut, always visible
 *  Navigate         — Boards / Trending / Settings compact nav
 *  ● Running        — visible only when streaming (board-store Phase 2.4)
 *  ⭐ Pinned         — starred boards (stub: empty state until pinning lands)
 *  🕐 Recent         — chronological history from useAnalysisHistory
 *  📁 Projects       — collapsed placeholder, "Coming soon"
 *  👤 Account        — bottom-anchored, user avatar + settings link
 *
 * Desktop: collapsible to 52px icon-only mode via ⌘\  (D-12, UI-SPEC exception: 40px target)
 * Mobile: hidden behind hamburger, slides as full-height Sheet
 */

import { useEffect, useState } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  Plus,
  House,
  TrendUp,
  SlidersHorizontal,
  CircleNotch,
  Star,
  ClockCountdown,
  Folder,
  UserCircle,
  List,
  SidebarSimple,
  SignOut,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAnalysisHistory } from "@/hooks/queries";
import { useProfile } from "@/hooks/queries/use-profile";
import { useSidebarStore } from "@/stores/sidebar-store";

// ─── sub-components ──────────────────────────────────────────────

/** Section header label — hidden in collapsed mode */
function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "block px-2 mb-1 text-[11px] font-medium text-foreground-muted uppercase tracking-wider",
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
  accent?: boolean;
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
  accent = false,
  className,
}: NavItemProps) {
  const item = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-2 min-h-[36px] rounded-lg text-sm font-medium",
        "transition-colors duration-100",
        isCollapsed && "justify-center px-0",
        isActive
          ? "bg-white/[0.08] text-foreground"
          : accent
            ? "text-accent hover:bg-accent/10"
            : "text-foreground-secondary hover:bg-white/[0.05] hover:text-foreground",
        className,
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon
        icon={IconComp}
        size={20}
        weight={isActive ? "fill" : "regular"}
        className={cn(
          accent && "text-accent",
          isActive && !accent && "text-foreground",
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

// ─── Sidebar ─────────────────────────────────────────────────────

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, close, isCollapsed, toggleCollapsed } = useSidebarStore();

  // Recent boards
  const { data: historyData, isLoading: historyLoading } = useAnalysisHistory();
  const recentBoards = (historyData ?? []).slice(0, 8) as Array<{
    id: string;
    content_text?: string;
    created_at?: string;
  }>;

  // User profile for Account section
  const { data: profile } = useProfile();

  // ⌘\ toggles collapsed mode (desktop only)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleCollapsed();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapsed]);

  const isOnBoard = pathname.startsWith("/analyze");
  const isOnTrending = pathname.startsWith("/trending");
  const isOnSettings = pathname.startsWith("/settings");

  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[calc(var(--z-sidebar)-1)] bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          // Base
          "fixed top-3 left-3 bottom-3 z-[var(--z-sidebar)]",
          "flex flex-col overflow-hidden rounded-xl",
          "border border-white/[0.06]",
          // Width transition — collapsed: 40px, expanded: 220px
          "transition-[transform,width] duration-150 ease-[var(--ease-out-cubic)]",
          isCollapsed ? "w-[52px]" : "w-[220px]",
          // Mobile: off-canvas when closed
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+12px)]",
          // Desktop: always visible (transform overridden below)
          "md:translate-x-0",
        )}
        style={{
          backgroundImage:
            "linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
        }}
        role="navigation"
        aria-label="App navigation"
      >
        {/* ── Header: Logo + collapse/close ── */}
        <div
          className={cn(
            "flex items-center px-3 pt-4 pb-2",
            isCollapsed ? "justify-center" : "justify-between",
          )}
        >
          {!isCollapsed && (
            <Link href="/" className="flex items-center" aria-label="Virtuna home">
              <svg
                width="22"
                height="22"
                viewBox="0 0 32 32"
                fill="none"
                className="text-white"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M16 6H13L8 27H11L16 6ZM16 6L21 27H24L19 6H16Z"
                  fill="currentColor"
                />
              </svg>
            </Link>
          )}
          {/* Desktop collapse toggle (⌘\) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-keyshortcuts="Meta+\\"
            className="hidden md:flex text-foreground-muted hover:text-foreground p-1"
          >
            <Icon icon={SidebarSimple} size={18} />
          </Button>
          {/* Mobile close button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            aria-label="Close sidebar"
            className="flex md:hidden text-foreground-muted hover:text-foreground p-1"
          >
            <Icon icon={SidebarSimple} size={18} />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden gap-1 px-2 pb-2">

          {/* ── ⊕ New analysis ── */}
          <div className="py-1">
            <NavItem
              icon={Plus}
              label="New analysis"
              isCollapsed={isCollapsed}
              accent
              onClick={() => router.push("/analyze")}
              badge={
                !isCollapsed && (
                  <span className="ml-auto text-[11px] text-foreground-muted font-normal">⌘N</span>
                )
              }
            />
          </div>

          {/* Divider */}
          <div className="mx-1 border-t border-white/[0.06]" />

          {/* ── Navigate ── */}
          <div className="py-1">
            {!isCollapsed && <SectionLabel>Navigate</SectionLabel>}
            <div className="flex flex-col gap-0.5">
              <NavItem
                icon={House}
                label="Boards"
                isActive={isOnBoard}
                isCollapsed={isCollapsed}
                onClick={() => router.push("/analyze")}
              />
              <NavItem
                icon={TrendUp}
                label="Trending"
                isActive={isOnTrending}
                isCollapsed={isCollapsed}
                onClick={() => router.push("/trending")}
              />
              <NavItem
                icon={SlidersHorizontal}
                label="Settings"
                isActive={isOnSettings}
                isCollapsed={isCollapsed}
                onClick={() => router.push("/settings")}
              />
            </div>
          </div>

          {/* ── ● Running (stub — wired to board-store in plan 2.4) ── */}
          {/*
            Running section is only visible when streaming.
            Board-store (plan 2.4) owns the streaming state; the sidebar
            subscribes to it once it exists. For now we render nothing
            (correct behavior: not streaming = section hidden).
          */}

          {/* Divider */}
          <div className="mx-1 border-t border-white/[0.06]" />

          {/* ── ⭐ Pinned ── */}
          <div className="py-1">
            {!isCollapsed && <SectionLabel>Pinned</SectionLabel>}
            {!isCollapsed && (
              <p className="px-2 py-1 text-xs text-foreground-muted">
                No pinned boards yet.
              </p>
            )}
            {isCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex justify-center py-2 text-foreground-muted"
                    aria-label="Pinned boards (empty)"
                  >
                    <Star className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Pinned (empty)</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* ── 🕐 Recent ── */}
          <div className="py-1 flex-1">
            {!isCollapsed && <SectionLabel>Recent</SectionLabel>}
            {historyLoading && !isCollapsed && (
              <div className="flex flex-col gap-1 px-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            )}
            {!historyLoading && recentBoards.length === 0 && !isCollapsed && (
              <p className="px-2 py-1 text-xs text-foreground-muted">
                No analyses yet.
              </p>
            )}
            {!historyLoading && !isCollapsed && (
              <div className="flex flex-col gap-0.5">
                {recentBoards.map((board) => (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => router.push(`/analyze/${board.id}`)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left",
                      "text-xs text-foreground-secondary truncate",
                      "hover:bg-white/[0.05] hover:text-foreground transition-colors",
                      pathname === `/analyze/${board.id}` && "bg-white/[0.08] text-foreground",
                    )}
                    aria-current={pathname === `/analyze/${board.id}` ? "page" : undefined}
                  >
                    <span className="truncate flex-1">
                      {board.content_text
                        ? board.content_text.substring(0, 40).trim() || "Untitled board"
                        : "Untitled board"}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {isCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => router.push("/analyze")}
                    className="w-full flex justify-center py-2 text-foreground-muted hover:text-foreground transition-colors"
                    aria-label="Recent boards"
                  >
                    <ClockCountdown className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Recent boards</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* ── 📁 Projects (Coming soon placeholder) ── */}
          <div className="py-1">
            {!isCollapsed && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                <Folder className="h-4 w-4 shrink-0 text-foreground-muted" />
                <span className="text-xs text-foreground-muted">Projects</span>
                <span className="ml-auto text-[10px] text-foreground-muted bg-white/[0.06] rounded px-1.5 py-0.5">
                  Soon
                </span>
              </div>
            )}
            {isCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="w-full flex justify-center py-2 text-foreground-muted opacity-50 cursor-default"
                    aria-label="Projects — coming soon"
                  >
                    <Folder className="h-5 w-5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">Projects · Coming soon</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* ── 👤 Account (bottom-anchored) ── */}
        <div className="border-t border-white/[0.06] px-2 py-2">
          {!isCollapsed ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((prev) => !prev)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg",
                  "text-sm text-foreground-secondary",
                  "hover:bg-white/[0.05] hover:text-foreground transition-colors",
                )}
                aria-label="Account menu"
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
                <span className="flex-1 truncate text-left text-xs">
                  {profile?.name ?? profile?.email ?? "Account"}
                </span>
                <UserCircle className="h-4 w-4 shrink-0 text-foreground-muted" />
              </button>

              {/* Account popover */}
              {accountOpen && (
                <div
                  className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-white/[0.06] overflow-hidden"
                  style={{
                    backgroundColor: "rgba(22, 23, 25, 0.98)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => { router.push("/settings"); setAccountOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 min-h-[40px] text-sm text-foreground-secondary hover:bg-white/[0.05] hover:text-foreground transition-colors"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                  <div className="mx-3 border-t border-white/[0.06]" />
                  <button
                    type="button"
                    onClick={() => { router.push("/login"); setAccountOpen(false); }}
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
      </aside>
    </>
  );
}

/** Mobile hamburger toggle — shows when sidebar is closed */
export function SidebarHamburger() {
  const { isOpen, open } = useSidebarStore();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={open}
      aria-label="Open sidebar"
      className={cn(
        "fixed left-4 top-4 z-[var(--z-sidebar)]",
        "border border-border bg-surface/80 shadow-md",
        "flex md:hidden",
        !isOpen && "md:flex",
      )}
    >
      <Icon icon={List} size={20} />
    </Button>
  );
}
