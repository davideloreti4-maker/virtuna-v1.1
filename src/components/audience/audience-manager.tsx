"use client";

/**
 * AudienceManager — fetches + renders the audience list as rich persona cards.
 * Flat-warm semantic tokens only. General = baseline card; presets + user = cards with menu.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { listAudiences } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import type { MultiAudienceReadBlock } from "@/lib/tools/blocks";
import { MultiAudienceReadBlockRenderer } from "@/components/thread/multi-audience-read-block";
import { AudienceCard } from "./audience-card";
import { groupAudiences } from "./audience-display";
import { ConstellationMark } from "@/components/brand/constellation-mark";
import { READING_CARD } from "@/components/reading/reading-section";
import { Button } from "@/components/ui/button";
import { SurfaceEmptyState } from "@/components/ui/surface-empty-state";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Scales, Sparkle, ArrowRight } from "@phosphor-icons/react";
import type { AccountSnapshot } from "@/lib/account-metrics/account-metrics";
import type { Pillar } from "@/lib/room-contract/mock-room";
import { AnalyticsView } from "@/components/analytics/analytics-view";

type AudienceTab = "audiences" | "account";

/** Slim, client-serializable view of a connected account for the "Your account" switcher. */
export interface AccountOption {
  id: string;
  handle: string;
  platform: "tiktok" | "instagram" | "youtube";
  is_primary: boolean;
}

interface AudienceManagerProps {
  className?: string;
  /** Real account metrics for the "Your account" analytics tab. */
  snapshots?: AccountSnapshot[];
  /** Real content pillars for the analytics tab's content-mix zone. */
  pillars?: Pillar[];
  /** The user's connected accounts — powers the switcher on the "Your account" tab. */
  accounts?: AccountOption[];
  /** Which connected account's series the snapshots/pillars belong to (switcher selection). */
  selectedAccountId?: string;
  /** Which tab to open on mount — `account` deep-links the analytics tab (the
   *  /analytics + /grow redirects land here via ?tab=account). */
  initialTab?: AudienceTab;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 ml-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
      {children}
    </p>
  );
}

/**
 * RailCard — a right-rail action card (desktop). An icon + title + one-line
 * "why it matters" + a full-width CTA. The rail is where the moat's primary
 * action (Calibrate from your @handle) and Compare live on wide viewports;
 * mobile falls back to the compact header buttons.
 */
function RailCard({
  icon,
  title,
  body,
  cta,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <div className={cn(READING_CARD, "p-4")}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[13px] font-medium text-foreground">{title}</p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-foreground-secondary">{body}</p>
      <Button
        variant={primary ? "primary" : "secondary"}
        size="sm"
        onClick={onClick}
        className="mt-3 w-full pointer-coarse:h-11"
      >
        {cta}
        <ArrowRight weight="bold" className="ml-1.5 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function AudienceListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(READING_CARD, "flex items-center gap-4 p-4 animate-pulse")}
        >
          <ConstellationMark width={56} litNodeIndex={-1} className="shrink-0 opacity-40" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-white/[0.06]" />
            <div className="h-3 w-48 rounded bg-white/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AudienceManager({
  className,
  snapshots = [],
  pillars = [],
  accounts = [],
  selectedAccountId,
  initialTab = "audiences",
}: AudienceManagerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<AudienceTab>(initialTab);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Audience | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareConcept, setCompareConcept] = useState("");
  const [comparing, setComparing] = useState(false);
  const [compareBlock, setCompareBlock] = useState<MultiAudienceReadBlock | null>(null);
  const [compareNote, setCompareNote] = useState<string | null>(null);

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds([]);
    setCompareConcept("");
    setCompareBlock(null);
    setCompareNote(null);
  }

  // Switch tabs; keep the URL shareable/deep-linkable without a navigation (no server
  // refetch — the snapshots/pillars are already hydrated). Leaving the roster drops
  // compare mode so returning to it is a clean state.
  function selectTab(next: AudienceTab) {
    setTab(next);
    if (next === "account") exitSelectionMode();
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", next === "account" ? "/audience?tab=account" : "/audience");
    }
  }

  function toggleSelection(id: string) {
    setCompareBlock(null);
    setCompareNote(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length < 2) return [...prev, id];
      return [prev[1]!, id];
    });
  }

  async function handleCompare() {
    if (selectedIds.length !== 2) return;
    const concept = compareConcept.trim();
    if (concept.length === 0) {
      setCompareNote("Enter a concept to compare these two audiences.");
      return;
    }
    setComparing(true);
    setCompareNote(null);
    setCompareBlock(null);
    try {
      const res = await fetch("/api/tools/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept, audienceIds: selectedIds }),
      });
      if (!res.ok) {
        setCompareNote("This audience isn't calibrated enough to compare yet.");
        return;
      }
      const data = (await res.json()) as { block?: MultiAudienceReadBlock };
      if (data.block) {
        setCompareBlock(data.block);
      } else {
        setCompareNote("This audience isn't calibrated enough to compare yet.");
      }
    } catch {
      setCompareNote("Couldn't run the compare. Try again.");
    } finally {
      setComparing(false);
    }
  }

  const fetchAudiences = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listAudiences(supabase);
      setAudiences(list);
      setError(null);
    } catch {
      setError("Couldn't load audiences.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchAudiences();
  }, [fetchAudiences]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest("[data-audience-menu]")) {
        setMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/audiences/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("delete failed");
      setDeleteTarget(null);
      await fetchAudiences();
    } catch {
      // silently surface via reload
    } finally {
      setDeleting(false);
    }
  }

  const { baseline, templates, generalTemplates, yours } = groupAudiences(audiences);

  function renderAudienceCard(audience: Audience) {
    const isUserOwned = !audience.is_general && !audience.is_preset;
    const isSelected = selectedIds.includes(audience.id);

    return (
      <AudienceCard
        key={audience.id}
        audience={audience}
        selectionMode={selectionMode}
        isSelected={isSelected}
        onSelect={() => toggleSelection(audience.id)}
        onNavigate={() => router.push(`/audience/${audience.id}`)}
        showMenu={!audience.is_general}
        menuOpen={menuOpen === audience.id}
        onMenuToggle={(e) => {
          e.stopPropagation();
          setMenuOpen((prev) => (prev === audience.id ? null : audience.id));
        }}
        onMenuEdit={
          isUserOwned
            ? (e) => {
                e.stopPropagation();
                setMenuOpen(null);
                router.push(`/audience/${audience.id}`);
              }
            : undefined
        }
        onMenuDelete={(e) => {
          e.stopPropagation();
          setMenuOpen(null);
          setDeleteTarget(audience);
        }}
      />
    );
  }

  const renderSections = () => {
    const sections: { key: string; label: string; items: Audience[] }[] = [
      { key: "yours", label: "Yours", items: yours },
      { key: "baseline", label: "Baseline", items: baseline },
      { key: "templates", label: "Templates", items: templates },
      { key: "generalTemplates", label: "General templates", items: generalTemplates },
    ];
    let delay = 0.02;
    const rendered: React.ReactNode[] = [];
    for (const { key, label, items } of sections) {
      if (items.length === 0) continue;
      rendered.push(
        <section key={key} className="rv-in" style={{ animationDelay: `${delay}s` }}>
          <SectionLabel>{label}</SectionLabel>
          <div className="flex flex-col gap-3">{items.map(renderAudienceCard)}</div>
        </section>,
      );
      delay += 0.06;
    }
    return rendered;
  };

  return (
    <div className={cn("relative min-h-full text-foreground", className)}>
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 lg:px-6">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">
              Your audiences
            </h1>
            {/* A1-COUPLED-COPY: revise if weights→generation wires */}
            <p className="mt-1 text-sm text-foreground-secondary">
              {tab === "account"
                ? "Your real numbers, over time — the ground truth behind your people."
                : selectionMode
                  ? "Pick two audiences to compare."
                  : "Who's in the room when you run a Read."}
            </p>

            {/* Section tabs — the roster (the moat) vs your account analytics (folded in
                from the retired /grow "Numbers" tab). */}
            <div
              className="mt-3 inline-flex rounded-lg border border-border bg-surface-elevated p-0.5"
              role="tablist"
              aria-label="Audience sections"
            >
              {([
                { id: "audiences", label: "Audiences" },
                { id: "account", label: "Your account" },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => selectTab(t.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                    tab === t.id
                      ? "bg-[color:var(--color-action)] text-[color:var(--color-action-foreground)]"
                      : "text-foreground-secondary hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {/* Mobile/tablet quick actions — desktop uses the rail cards instead. */}
          {tab === "audiences" && !selectionMode && !loading && !error && audiences.length > 0 && (
            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectionMode(true)}
                className="pointer-coarse:h-11"
              >
                <Scales weight="bold" className="mr-1.5 h-4 w-4" />
                Compare
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push("/audience/new")}
                className="pointer-coarse:h-11"
              >
                Create
              </Button>
            </div>
          )}
        </header>

        {tab === "audiences" && (
          <>
            {loading && <AudienceListSkeleton />}

            {!loading && error && (
              <p className="py-8 text-center text-sm text-error">{error}</p>
            )}

        {!loading && !error && audiences.length === 0 && (
          <SurfaceEmptyState
            className="mx-auto max-w-xl"
            icon={<ConstellationMark width={80} litNodeIndex={-1} className="opacity-80" />}
            title="No custom audiences yet"
            action={
              <Button variant="primary" onClick={() => router.push("/audience/new")}>
                Create audience
              </Button>
            }
          >
            {`You're using `}
            <strong className="text-foreground">General</strong>
            {` — Maven's universal audience. Calibrate a personal audience from your own @handle, or start from a template, to test against the people who actually watch you.`}
          </SurfaceEmptyState>
        )}

        {/* Default — roster + sticky rail (desktop); roster only (mobile). */}
        {!loading && !error && audiences.length > 0 && !selectionMode && (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
            <div className="flex min-w-0 flex-col gap-6">{renderSections()}</div>

            <aside className="mt-6 hidden flex-col gap-3 lg:mt-0 lg:flex lg:sticky lg:top-4">
              <div className="rv-in" style={{ animationDelay: "0.06s" }}>
                <RailCard
                  icon={<Sparkle weight="fill" className="h-4 w-4 text-[color:var(--color-accent)]" />}
                  title="Calibrate a new audience"
                  body="Read your public @handle once → the ~10 real people who actually watch you. That's the room every Read is tested in."
                  cta="Calibrate from your @handle"
                  onClick={() => router.push("/audience/new")}
                  primary
                />
              </div>
              <div className="rv-in" style={{ animationDelay: "0.1s" }}>
                <RailCard
                  icon={<Scales weight="bold" className="h-4 w-4 text-foreground-secondary" />}
                  title="Compare two rooms"
                  body="Run one concept across two audiences and see who leans in — and who scrolls past."
                  cta="Compare audiences"
                  onClick={() => setSelectionMode(true)}
                />
              </div>
              <p
                className="rv-in px-1 pt-1 text-[11px] leading-relaxed text-foreground-muted"
                style={{ animationDelay: "0.14s" }}
              >
                Your calibrated audience grounds every Read, hook, and remix you run — the
                moat that makes a prediction yours, not generic.
              </p>
            </aside>
          </div>
        )}

        {/* Compare mode — single column, full width, roster becomes selectable. */}
        {!loading && !error && audiences.length > 0 && selectionMode && (
          <div className="flex flex-col gap-6">
            <div className={cn(READING_CARD, "flex flex-col gap-3 p-4")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Scales weight="bold" className="h-4 w-4 text-foreground-secondary" />
                  <p className="text-sm font-medium text-foreground">Compare two rooms</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="tabular-nums text-xs text-foreground-secondary" aria-live="polite">
                    {selectedIds.length}/2 selected
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={exitSelectionMode}
                    className="pointer-coarse:h-11"
                  >
                    Cancel
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={selectedIds.length !== 2 || comparing}
                          onClick={() => void handleCompare()}
                          className="pointer-coarse:h-11"
                        >
                          {comparing ? <Spinner size="sm" /> : "Compare these two →"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {selectedIds.length !== 2 && (
                      <TooltipContent side="bottom" className="text-xs">
                        Select two audiences
                      </TooltipContent>
                    )}
                  </Tooltip>
                </div>
              </div>
              <Input
                value={compareConcept}
                onChange={(e) => setCompareConcept(e.target.value)}
                placeholder="A concept to compare — e.g. “a 30-second morning routine”"
                maxLength={2000}
                aria-label="Concept to compare"
                className="pointer-coarse:h-11"
              />
              {compareNote && <p className="text-xs text-warning">{compareNote}</p>}
            </div>

            {compareBlock && (
              <div className={cn(READING_CARD, "p-4")}>
                <MultiAudienceReadBlockRenderer block={compareBlock} />
              </div>
            )}

            <div className="flex flex-col gap-6">{renderSections()}</div>
          </div>
        )}
          </>
        )}

        {/* Your account — the real analytics tab (folded in from the retired /grow "Numbers"
            tab): account_snapshots metrics + recommendations + content mix. Deep-linked via
            /audience?tab=account (the /analytics + /grow redirects land here). */}
        {tab === "account" && (
          <div key="account" className="rv-in">
            <AnalyticsView
              snapshots={snapshots}
              pillars={pillars}
              accounts={accounts}
              selectedAccountId={selectedAccountId}
            />
          </div>
        )}

        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Delete audience</DialogTitle>
              <DialogDescription>
                {`Delete "${deleteTarget?.name}"? This removes the calibrated audience and its personas. Threads already generated under it keep their results. This can't be undone.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" disabled={deleting}>Keep audience</Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                {deleting ? <Spinner size="sm" /> : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
