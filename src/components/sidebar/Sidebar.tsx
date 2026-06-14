"use client";

/**
 * Sidebar — lean flat-warm shell (Numen Rework P1, D-10..D-16)
 *
 * Sections (top → bottom):
 *  ⊕ New Simulation — coral primary CTA, ⌘N shortcut, always visible
 *  Settings         — settings link + @handle account selector (D-12)
 *  Simulations      — chronological history from useAnalysisHistory (D-13);
 *                     score chips + remix tag; rows route to /analyze/[id]
 *  👤 Account        — bottom-anchored, user avatar + settings/logout
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
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NumenMark } from "@/components/brand/numen-logo";
import { useAnalysisHistory } from "@/hooks/queries";
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

// ─── score tone ───────────────────────────────────────────────────
// Reserve color for outliers only — strong scores read soft green, weak
// read soft amber, the calm middle stays muted. Tones are dimmed to 70%
// so they whisper rather than shout — refined hints, not a traffic-light
// column. Coral stays reserved for the brand/primary action; the eye
// still catches the exceptions at a glance.
function scoreTone(score: number | null | undefined): string {
  if (score == null) return 'text-foreground-muted';
  if (score >= 80) return 'text-emerald-400/70';
  if (score < 50) return 'text-amber-400/70';
  return 'text-foreground-secondary';
}

// Branded keyboard-focus ring — replaces the browser-default blue outline on
// raw <button>s. Inset so it never spills past the panel's rounded clip.
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50";
import { useSidebarStore } from "@/stores/sidebar-store";
import { createClient } from "@/lib/supabase/client";
import { SidebarAccountSelector } from "./SidebarAccountSelector";

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

// ─── Sidebar ─────────────────────────────────────────────────────

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { isOpen, close, isCollapsed, toggleCollapsed } = useSidebarStore();
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const triggerNewAnalysis = useBoardStore((s) => s.triggerNewAnalysis);

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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  // Past Simulations (D-13) — reuse useAnalysisHistory; rows route to /analyze/[id]
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
          // Base — flat-warm matte: solid charcoal sidebar + hairline (no glass, no blur, no inset shine)
          "fixed top-3 left-3 bottom-3 z-[var(--z-sidebar)]",
          "flex flex-col overflow-hidden rounded-xl",
          "bg-background-elevated border border-white/[0.06]",
          effectiveCollapsed ? "w-[60px]" : "w-[220px]",
          !reducedMotion && "transition-[transform,width] duration-150 ease-[var(--ease-out-cubic)]",
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+12px)]",
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
            <Link href="/" className="group text-foreground pl-2" aria-label="Numen home">
              <NumenMark size={26} />
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

          {/* ── ⊕ New Simulation ── */}
          <div className="pb-1">
            <NavItem
              icon={Plus}
              label="New Simulation"
              isCollapsed={effectiveCollapsed}
              accent
              onClick={() => { triggerNewAnalysis(); router.push("/home"); }}
              badge={
                !effectiveCollapsed && (
                  <span className="ml-auto text-[11px] text-foreground-muted font-normal tabular-nums">⌘N</span>
                )
              }
            />
          </div>

          {/* Divider */}
          <div className="mx-2 border-t border-white/[0.06]" />

          {/* ── Settings + @handle account selector (D-12) ── */}
          <div className="pt-3">
            <div className="flex flex-col gap-0.5">
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

          {/* ── Simulations (D-13) ── */}
          <div className="pt-4 flex-1">
            {!effectiveCollapsed && <SectionLabel>Simulations</SectionLabel>}
            {historyLoading && !effectiveCollapsed && (
              <div className="flex flex-col gap-2 px-2.5 pt-1">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3.5 w-5/6" />
              </div>
            )}
            {!historyLoading && recentBoards.length === 0 && !effectiveCollapsed && (
              <p className="px-2.5 py-1 text-xs text-foreground-muted">
                No simulations yet.
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
                          (() => {
                            // WR-06: only render the "·" separator when there is a
                            // time string — a malformed/absent created_at yields ''
                            // and must not leave a dangling "Simulation ·".
                            const when = relativeTime(board.created_at);
                            return (
                              <>
                                Simulation
                                {when && (
                                  <span className="text-foreground-muted"> · {when}</span>
                                )}
                              </>
                            );
                          })()
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
                    onClick={() => router.push("/home")}
                    className="w-full flex justify-center py-2 text-foreground-muted hover:text-foreground transition-colors"
                    aria-label="Simulations"
                  >
                    <ClockCountdown className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Simulations</TooltipContent>
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
        "h-[34px] w-[34px] flex items-center justify-center rounded-[10px]",
        // flat-warm matte: solid charcoal + hairline + soft float shadow (no glass, no blur)
        "bg-background-elevated border border-white/[0.06] shadow-float",
        isOpen ? "hidden" : "flex",
      )}
    >
      <List className="h-4 w-4 text-foreground/70" />
    </button>
  );
}
