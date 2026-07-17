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
import { filterHorizontalAudiences } from "@/lib/flags/horizontal";

/** Slim, client-serializable view of a connected account — the roster's ACCOUNTS
 *  zone reads it (and /audience/new's source picker imports the type). */
export interface AccountOption {
  id: string;
  handle: string;
  platform: "tiktok" | "instagram" | "youtube";
  is_primary: boolean;
  last_synced_at: string | null;
}

interface AudienceManagerProps {
  className?: string;
  /** The user's connected accounts — each renders in the ACCOUNTS zone. */
  accounts?: AccountOption[];
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

export function AudienceManager({ className, accounts = [] }: AudienceManagerProps) {
  const router = useRouter();
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

  // MERGE (2026-07-14, lane/explore-a × main): main's /audience redesign (#280) replaced the
  // old grouped AudienceCard sections with <AudienceIndex>, and that version wins — the
  // redesign is the newer surface and this lane never had an opinion about it.
  //
  // But the redesign was written on a main that has never seen HORIZONTAL_ENABLED (this lane
  // introduced the flag; there are zero refs to it on main). AudienceIndex renders a
  // Social/CUSTOM track switch, and "custom" IS `mode: 'general'` — the horizontal. Handing
  // it the raw list would have quietly re-opened the exact door the flag exists to close,
  // through a component neither side thought to check. Nothing would have failed; the
  // Analyst/Hiring panels would simply have reappeared under a new name.
  //
  // So the redesign gets the filtered list. `filterHorizontalAudiences` is a no-op when the
  // flag is on, so flipping the boolean still restores the horizontal in one move — including
  // here. It keys on `mode`, never `is_general` (see THE TRAP in lib/flags/horizontal.ts:
  // the Baseline creator audience carries `is_general: true` and must stay visible).
  const visibleAudiences = filterHorizontalAudiences(audiences);

  const renderIndex = () => (
    <AudienceIndex
      audiences={visibleAudiences}
      accounts={accounts}
      defaultAudienceId={defaultAudienceId}
      onSetDefault={(a) => void handleSetDefault(a)}
      onOpen={(a) => router.push(`/audience/${a.id}`)}
      onOpenAccount={(a) => router.push(`/audience/${a.id}`)}
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
              Audiences
            </h1>
            {selectionMode && (
              <p className="mt-1 text-sm text-foreground-secondary">
                Pick two audiences to compare.
              </p>
            )}
          </div>
          {/* The two actions the index owns. The retired rail cards said the same thing in
              marketing voice ("the moat that makes a prediction yours") — deleted. */}
          {!selectionMode && !loading && !error && audiences.length > 0 && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectionMode(true)}
                className="pointer-coarse:h-11 text-foreground-secondary hover:text-foreground"
              >
                Compare
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
      </div>
    </div>
  );
}
