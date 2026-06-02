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

import { useEffect, useRef, useState } from "react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  Plus,
  UserPlus,
  House,
  SlidersHorizontal,
  Star,
  ClockCountdown,
  Folder,
  UserCircle,
  List,
  SidebarSimple,
  SignOut,
  CaretDown,
  CaretUpDown,
  Check,
  TiktokLogo,
  InstagramLogo,
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
import { useAnalysisHistory } from "@/hooks/queries";
import { useProfile } from "@/hooks/queries/use-profile";
import { useBoardStore } from "@/stores/board-store";

// ─── relative-time helper ─────────────────────────────────────────
const rtf = typeof Intl !== 'undefined'
  ? new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' })
  : null;

function relativeTime(iso: string | undefined): string {
  if (!iso || !rtf) return '';
  const diffSec = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

// ─── score tone ───────────────────────────────────────────────────
// Reserve color for outliers only — strong scores pop green, weak pop
// orange, the calm middle stays muted. Keeps the recent list quiet
// (coral is reserved for the brand/primary action) while preserving
// at-a-glance signal: the eye catches the exceptions, not the column.
function scoreTone(score: number | null | undefined): string {
  if (score == null) return 'text-foreground-muted';
  if (score >= 80) return 'text-emerald-400/90';
  if (score < 50) return 'text-orange-400/90';
  return 'text-foreground-secondary';
}

// Branded keyboard-focus ring — replaces the browser-default blue outline on
// raw <button>s. Inset so it never spills past the panel's rounded clip.
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50";
import { useSidebarStore } from "@/stores/sidebar-store";
import { createClient } from "@/lib/supabase/client";
import { useSocialAccounts } from "@/hooks/use-social-accounts";
import type { Platform } from "@/hooks/use-social-accounts";

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
        "w-full flex items-center gap-2.5 px-2.5 min-h-[34px] rounded-lg text-sm font-medium",
        "transition-colors duration-100",
        focusRing,
        isCollapsed && "justify-center px-0",
        isActive
          ? "bg-white/[0.06] text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
          : accent
            ? "text-accent hover:bg-accent/[0.08]"
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

// ─── SidebarAccountSelector ──────────────────────────────────────

function SidebarAccountSelector({ isCollapsed }: { isCollapsed: boolean }) {
  const { accounts, activeAccount, isLoading, switchAccount, addAccount, removeAccount } = useSocialAccounts();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [newPlatform, setNewPlatform] = useState<Platform>("tiktok");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) inputRef.current.focus();
  }, [isAdding]);

  const handleAdd = async () => {
    const trimmed = newHandle.trim();
    if (!trimmed) return;
    await addAccount(trimmed, newPlatform);
    setNewHandle("");
    setNewPlatform("tiktok");
    setIsAdding(false);
  };

  if (isLoading) return null;

  const PlatformIconComp = (platform: Platform) =>
    platform === "instagram" ? (
      <InstagramLogo weight="bold" className="h-5 w-5 shrink-0" />
    ) : (
      <TiktokLogo weight="bold" className="h-5 w-5 shrink-0" />
    );

  const trigger = (
    <button
      type="button"
      onClick={() => setIsOpen((p) => !p)}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 min-h-[34px] rounded-lg text-sm font-medium",
        "transition-colors duration-100",
        focusRing,
        isCollapsed ? "justify-center px-0" : "",
        "text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground",
      )}
      aria-label={activeAccount ? `Account: @${activeAccount.handle}` : "Connect account"}
    >
      {activeAccount ? (
        <>
          {PlatformIconComp(activeAccount.platform as Platform)}
          {!isCollapsed && (
            <>
              <span className="flex-1 truncate text-left">@{activeAccount.handle}</span>
              <CaretDown weight="bold" className="h-3 w-3 shrink-0 text-foreground-muted" />
            </>
          )}
        </>
      ) : (
        <>
          <Icon icon={UserPlus} size={20} className="shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left">Connect account</span>}
        </>
      )}
    </button>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="right">
          {activeAccount ? `@${activeAccount.handle}` : "Connect account"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div>
      {trigger}
      {isOpen && (
        <div
          className="mt-0.5 rounded-lg border border-white/[0.06] overflow-hidden"
          style={{ backgroundColor: "rgba(17,18,20,0.95)" }}
        >
          {accounts.length > 0 && (
            <div className="py-1">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="group flex items-center gap-2 px-3 min-h-[40px] text-sm transition-colors hover:bg-white/[0.05] cursor-pointer"
                  onClick={() => { switchAccount(account.id); setIsOpen(false); }}
                >
                  {account.is_active ? (
                    <Check weight="bold" className="h-4 w-4 shrink-0 text-accent" />
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}
                  {PlatformIconComp(account.platform as Platform)}
                  <span className={cn("flex-1 truncate text-xs", account.is_active ? "text-foreground" : "text-foreground-secondary")}>
                    @{account.handle}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAccount(account.id); }}
                    className="opacity-0 group-hover:opacity-100 text-foreground-muted hover:text-foreground transition-opacity"
                    aria-label={`Remove @${account.handle}`}
                  >
                    <X weight="bold" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {accounts.length > 0 && <div className="mx-3 border-t border-white/[0.06]" />}
          {isAdding ? (
            <div className="p-3 space-y-2">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setNewPlatform("tiktok")}
                  className={cn("flex items-center justify-center h-7 w-7 rounded-md transition-colors", newPlatform === "tiktok" ? "bg-white/[0.1] text-foreground" : "text-foreground-muted hover:text-foreground")}
                >
                  <TiktokLogo weight="bold" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setNewPlatform("instagram")}
                  className={cn("flex items-center justify-center h-7 w-7 rounded-md transition-colors", newPlatform === "instagram" ? "bg-white/[0.1] text-foreground" : "text-foreground-muted hover:text-foreground")}
                >
                  <InstagramLogo weight="bold" className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") { setIsAdding(false); setNewHandle(""); setNewPlatform("tiktok"); }
                  }}
                  placeholder="@handle"
                  className="flex-1 h-8 rounded-md bg-white/[0.05] border border-white/[0.06] px-2 text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!newHandle.trim()}
                  className="shrink-0 h-8 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex w-full items-center gap-2 px-3 min-h-[40px] text-xs text-foreground-secondary transition-colors hover:bg-white/[0.05] hover:text-foreground"
            >
              <Plus weight="bold" className="h-3.5 w-3.5" />
              <span>Add account</span>
            </button>
          )}
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
  const { isOpen, close } = useSidebarStore();
  const triggerNewAnalysis = useBoardStore((s) => s.triggerNewAnalysis);

  // Sidebar is always a full-width overlay (no persistent/collapsed desktop mode)
  const effectiveCollapsed = false;

  // Recent boards
  const { data: historyData, isLoading: historyLoading } = useAnalysisHistory();
  const recentBoards = (historyData ?? []).slice(0, 8) as Array<{
    id: string;
    content_text?: string | null;
    overall_score?: number | null;
    created_at?: string;
    variants?: { remix?: unknown } | null;
  }>;

  // User profile for Account section
  const { data: profile } = useProfile();

const isOnBoard = pathname.startsWith("/analyze");
  const isOnSettings = pathname.startsWith("/settings");

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
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[calc(var(--z-sidebar)-1)] bg-black/50"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <nav
        className={cn(
          // Base
          "fixed top-3 left-3 bottom-3 z-[var(--z-sidebar)]",
          "flex flex-col overflow-hidden rounded-xl",
          "border border-white/[0.06]",
          "w-[220px]",
          "transition-transform duration-150 ease-[var(--ease-out-cubic)]",
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+12px)]",
        )}
        style={{
          backgroundImage:
            "linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)",
          backdropFilter: "blur(5px)",
          WebkitBackdropFilter: "blur(5px)",
          boxShadow: "rgba(255,255,255,0.15) 0px 1px 1px 0px inset",
        }}
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
            <Link href="/" className="flex items-center gap-2 group" aria-label="Virtuna home">
              <svg
                width="20"
                height="20"
                viewBox="0 0 32 32"
                fill="none"
                className="text-foreground"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M16 6H13L8 27H11L16 6ZM16 6L21 27H24L19 6H16Z"
                  fill="currentColor"
                />
              </svg>
              <span className="text-[15px] font-semibold tracking-tight text-foreground">
                Virtuna
              </span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={close}
            aria-label="Close sidebar"
            className="flex text-foreground-muted hover:text-foreground p-1.5 -mr-1"
          >
            <Icon icon={SidebarSimple} size={20} />
          </Button>
        </div>

        {/* Scrollable body — scrollbar hidden for a clean glass edge */}
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden gap-0.5 px-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

          {/* ── ⊕ New analysis ── */}
          <div className="pb-1">
            <NavItem
              icon={Plus}
              label="New analysis"
              isCollapsed={effectiveCollapsed}
              accent
              onClick={() => { triggerNewAnalysis(); router.push("/analyze"); }}
              badge={
                !effectiveCollapsed && (
                  <span className="ml-auto text-[11px] text-foreground-muted font-normal tabular-nums">⌘N</span>
                )
              }
            />
          </div>

          {/* Divider */}
          <div className="mx-2 border-t border-white/[0.06]" />

          {/* ── Navigate ── */}
          <div className="pt-3">
            {!effectiveCollapsed && <SectionLabel>Navigate</SectionLabel>}
            <div className="flex flex-col gap-0.5">
              <NavItem
                icon={House}
                label="Boards"
                isActive={isOnBoard}
                isCollapsed={effectiveCollapsed}
                onClick={() => router.push("/analyze")}
              />
              <NavItem
                icon={SlidersHorizontal}
                label="Settings"
                isActive={isOnSettings}
                isCollapsed={effectiveCollapsed}
                onClick={() => router.push("/settings")}
              />
              <SidebarAccountSelector isCollapsed={effectiveCollapsed} />
            </div>
          </div>

          {/* ── ● Running (stub — wired to board-store in plan 2.4) ── */}
          {/*
            Running section is only visible when streaming.
            Board-store (plan 2.4) owns the streaming state; the sidebar
            subscribes to it once it exists. For now we render nothing
            (correct behavior: not streaming = section hidden).
          */}

          {/* ── ⭐ Pinned ── */}
          <div className="pt-4">
            {!effectiveCollapsed && <SectionLabel>Pinned</SectionLabel>}
            {!effectiveCollapsed && (
              <p className="px-2.5 py-1 text-xs text-foreground-muted">
                No pinned boards yet.
              </p>
            )}
            {effectiveCollapsed && (
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
          <div className="pt-4 flex-1">
            {!effectiveCollapsed && <SectionLabel>Recent</SectionLabel>}
            {historyLoading && !effectiveCollapsed && (
              <div className="flex flex-col gap-2 px-2.5 pt-1">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3.5 w-5/6" />
              </div>
            )}
            {!historyLoading && recentBoards.length === 0 && !effectiveCollapsed && (
              <p className="px-2.5 py-1 text-xs text-foreground-muted">
                No analyses yet.
              </p>
            )}
            {!historyLoading && !effectiveCollapsed && (
              <div className="flex flex-col gap-px">
                {recentBoards.map((board) => {
                  const isActive = pathname === `/analyze/${board.id}`;
                  const snippet = board.content_text ? board.content_text.slice(0, 38).trim() : "";
                  return (
                    <button
                      key={board.id}
                      type="button"
                      onClick={() => router.push(`/analyze/${board.id}`)}
                      className={cn(
                        "group w-full flex items-center gap-2 px-2.5 min-h-[30px] rounded-lg text-left",
                        "text-[13px] transition-colors",
                        focusRing,
                        isActive
                          ? "bg-white/[0.06] text-foreground"
                          : "text-foreground-secondary hover:bg-white/[0.04] hover:text-foreground",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="truncate flex-1" data-testid="sidebar-board-label">
                        {snippet ? (
                          snippet
                        ) : (
                          <>
                            Analysis{" "}
                            <span className="text-foreground-muted">· {relativeTime(board.created_at)}</span>
                          </>
                        )}
                      </span>
                      {(() => {
                        // D-11/D-12: remix source rows have null overall_score + non-null
                        // variants.remix — show a "Remix" badge instead of a blank '—' score.
                        // T-05-08: purely render-side, no trust boundary crossed.
                        const isRemix =
                          board.overall_score == null &&
                          (board.variants as { remix?: unknown } | null)?.remix != null;
                        if (isRemix) {
                          return (
                            <span
                              className="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-white/45"
                              data-testid="sidebar-remix-tag"
                            >
                              Remix
                            </span>
                          );
                        }
                        return (
                          <span
                            className={cn(
                              "shrink-0 text-[11px] font-semibold tabular-nums tracking-tight",
                              scoreTone(board.overall_score),
                            )}
                            data-testid="sidebar-score-chip"
                          >
                            {board.overall_score != null ? Math.round(board.overall_score) : '—'}
                          </span>
                        );
                      })()}
                    </button>
                  );
                })}
              </div>
            )}
            {effectiveCollapsed && (
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
          <div className="pt-2">
            {!effectiveCollapsed && (
              <div className="flex items-center gap-2.5 px-2.5 min-h-[34px] rounded-lg">
                <Folder className="h-5 w-5 shrink-0 text-foreground-muted" />
                <span className="text-sm font-medium text-foreground-muted">Projects</span>
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-foreground-muted bg-white/[0.05] rounded-md px-1.5 py-0.5">
                  Soon
                </span>
              </div>
            )}
            {effectiveCollapsed && (
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
                  className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-white/[0.06] overflow-hidden"
                  style={{
                    backgroundColor: "rgba(22, 23, 25, 0.98)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                  }}
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
                    onClick={async () => { await supabase.auth.signOut(); router.push("/login"); setAccountOpen(false); }}
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
        "h-[34px] w-[34px] flex items-center justify-center rounded-[10px]",
        "border border-white/[0.06]",
        "shadow-[rgba(0,0,0,0.4)_0_4px_16px_0]",
        isOpen ? "hidden" : "flex",
      )}
      style={{
        background: "linear-gradient(137deg, rgba(17,18,20,0.85) 4.87%, rgba(12,13,15,0.95) 75.88%)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <List className="h-4 w-4 text-foreground/70" />
    </button>
  );
}
