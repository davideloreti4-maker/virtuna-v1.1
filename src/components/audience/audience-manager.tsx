"use client";

/**
 * AudienceManager — fetches + renders the audience list as rich persona cards.
 * Flat-warm semantic tokens only. General = baseline card; presets + user = cards with menu.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Audience } from "@/lib/audience/audience-types";
import type { MultiAudienceReadBlock } from "@/lib/tools/blocks";
import { MultiAudienceReadBlockRenderer } from "@/components/thread/multi-audience-read-block";
import { AudienceIndex } from "./audience-index";
import { ConstellationMark } from "@/components/brand/constellation-mark";
import { READING_CARD } from "@/components/reading/reading-section";
import { Button } from "@/components/ui/button";
import { SurfaceEmptyState } from "@/components/ui/surface-empty-state";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Scales } from "@phosphor-icons/react";
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


function AudienceListSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-4 border-b border-white/[0.06] px-4 py-4 last:border-b-0"
        >
          <div className="h-4 w-32 flex-1 rounded bg-white/[0.06]" />
          <div className="h-3 w-40 rounded bg-white/[0.04]" />
          <div className="h-[7px] w-32 rounded bg-white/[0.04]" />
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
  const [tab, setTab] = useState<AudienceTab>(initialTab);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** The user-level audience that seeds new threads (`user_settings.last_audience_id`).
   *  GET /api/audiences has always returned it; the old roster never rendered it, so the
   *  page could not answer "which audience am I being tested against". Now it's the radio. */
  const [defaultAudienceId, setDefaultAudienceId] = useState<string | null>(null);

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

  // The API route (not the repo helper) — it returns `lastAudienceId` alongside the list,
  // which is the fact the index's default radio renders.
  const fetchAudiences = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/audiences");
      if (!res.ok) throw new Error("list failed");
      const data = (await res.json()) as {
        audiences: Audience[];
        lastAudienceId: string | null;
      };
      setAudiences(data.audiences ?? []);
      setDefaultAudienceId(data.lastAudienceId ?? null);
      setError(null);
    } catch {
      setError("Couldn't load audiences.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAudiences();
  }, [fetchAudiences]);

  /**
   * Pin the audience that seeds new threads. General → null (the route's contract).
   * Optimistic: the radio is the whole point of the column, so it must feel instant;
   * a failed write reverts.
   */
  async function handleSetDefault(audience: Audience) {
    const next = audience.is_general ? null : audience.id;
    const previous = defaultAudienceId;
    setDefaultAudienceId(next);
    try {
      const res = await fetch("/api/settings/last-audience", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audienceId: next }),
      });
      if (!res.ok) throw new Error("pin failed");
    } catch {
      setDefaultAudienceId(previous);
      setError("Couldn't set the default audience.");
    }
  }

  const renderIndex = () => (
    <AudienceIndex
      audiences={audiences}
      defaultAudienceId={defaultAudienceId}
      onSetDefault={(a) => void handleSetDefault(a)}
      onOpen={(a) => router.push(`/audience/${a.id}`)}
      selectionMode={selectionMode}
      selectedIds={selectedIds}
      onToggleSelect={toggleSelection}
    />
  );

  return (
    <div className={cn("relative min-h-full text-foreground", className)}>
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 lg:px-6">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[19px] font-semibold tracking-[-0.01em] text-foreground lg:text-[22px]">
              {tab === "account" ? "Your account" : "Audiences"}
            </h1>
            {tab === "audiences" && !selectionMode && (
              <p className="mt-1 max-w-2xl text-[13px] text-foreground-secondary">
                The panel your work gets tested against. Every Read is scored twice — once by
                the audience you pick, once by General.
              </p>
            )}
            {selectionMode && (
              <p className="mt-1 text-sm text-foreground-secondary">
                Pick two audiences to compare.
              </p>
            )}

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
          {/* The two actions the index owns. The retired rail cards said the same thing in
              marketing voice ("the moat that makes a prediction yours") — deleted. */}
          {tab === "audiences" && !selectionMode && !loading && !error && audiences.length > 0 && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectionMode(true)}
                className="pointer-coarse:h-11"
              >
                <Scales weight="bold" className="mr-1.5 h-4 w-4" />
                Compare two
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => router.push("/audience/new")}
                className="pointer-coarse:h-11"
              >
                New audience
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

        {/* Default — the index, full width. */}
        {!loading && !error && audiences.length > 0 && !selectionMode && (
          <div className="rv-in">{renderIndex()}</div>
        )}

        {/* Compare mode — single column, full width, roster becomes selectable. */}
        {!loading && !error && audiences.length > 0 && selectionMode && (
          <div className="flex flex-col gap-6">
            <div className={cn(READING_CARD, "flex flex-col gap-3 p-4")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Scales weight="bold" className="h-4 w-4 text-foreground-secondary" />
                  <p className="text-sm font-medium text-foreground">Compare two audiences</p>
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

            {renderIndex()}
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

      </div>
    </div>
  );
}
