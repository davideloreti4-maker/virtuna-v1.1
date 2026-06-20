"use client";

/**
 * AudienceManager — fetches + renders the audience list.
 * Flat-warm semantic tokens ONLY (no zinc-*).
 * General = coral badge, no delete. Presets + user audiences = ⋯ overflow menu.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { listAudiences } from "@/lib/audience/audience-repo";
import type { Audience } from "@/lib/audience/audience-types";
import type { MultiAudienceReadBlock } from "@/lib/tools/blocks";
import { MultiAudienceReadBlockRenderer } from "@/components/thread/multi-audience-read-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { DotsThree, Scales, Check } from "@phosphor-icons/react";

interface AudienceManagerProps {
  className?: string;
}

export function AudienceManager({ className }: AudienceManagerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Audience | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Compare selection mode (AUD-EDIT-02 / D-05) ───────────────────────────────
  // The flagship audience action: pick ANY two saved audiences and run P8's existing
  // multi-audience Read (08-06) against the arbitrary pair. The Read render is REUSED
  // verbatim (MultiAudienceReadBlockRenderer) — the only net-new build is this entry.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareConcept, setCompareConcept] = useState("");
  const [comparing, setComparing] = useState(false);
  const [compareBlock, setCompareBlock] = useState<MultiAudienceReadBlock | null>(null);
  // Honest warning-tone note (never error-red, never coral) for an under-calibrated
  // pair or a transient launch failure (UI-SPEC §degraded states).
  const [compareNote, setCompareNote] = useState<string | null>(null);

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds([]);
    setCompareConcept("");
    setCompareBlock(null);
    setCompareNote(null);
  }

  // Toggle an audience into/out of the compare selection. Cap at 2 — selecting a
  // third drops the OLDEST pick (replace-oldest keeps the count ≤ 2, D-05/D-09).
  function toggleSelection(id: string) {
    setCompareBlock(null);
    setCompareNote(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length < 2) return [...prev, id];
      // already 2 → drop the oldest, append the new pick (stays ≤ 2)
      return [prev[1]!, id];
    });
  }

  // Launch the arbitrary-pair compare: POST { concept, audienceIds } → /api/tools/read,
  // then surface the returned multi-audience-read block via the REUSED P8 renderer.
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
        // Honest warning tone — an under-calibrated pick or a bad pair, never error-red.
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

  // Close menu on outside click
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

  const userAudienceCount = audiences.filter((a) => !a.is_general && !a.is_preset).length;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header — mirrors the competitors page pattern (text-2xl font-medium) */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Your audiences</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            {selectionMode ? "Pick two audiences to compare." : "Who Numen writes and tests for."}
          </p>
        </div>
        {selectionMode ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-foreground-secondary tabular-nums" aria-live="polite">
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
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectionMode(true)}
              className="pointer-coarse:h-11"
            >
              <Scales weight="bold" className="w-4 h-4 mr-1.5" />
              Compare
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/audience/new")}
              className="pointer-coarse:h-11"
            >
              Create audience
            </Button>
          </div>
        )}
      </div>

      {/* Selection-mode concept input — the concept the chosen pair is read against
          (REQUIRED by /api/tools/read). Shown only in selection mode. */}
      {selectionMode && (
        <div className="flex flex-col gap-2">
          <Input
            value={compareConcept}
            onChange={(e) => setCompareConcept(e.target.value)}
            placeholder="A concept to compare — e.g. “a 30-second morning routine”"
            maxLength={2000}
            aria-label="Concept to compare"
            className="pointer-coarse:h-11"
          />
          {compareNote && (
            <p className="text-xs text-warning">{compareNote}</p>
          )}
        </div>
      )}

      {/* Compare result — the REUSED P8 multi-audience Read (08-06), rendered inline.
          The render COMPONENT is fixed (MultiAudienceReadBlockRenderer) — not redesigned. */}
      {selectionMode && compareBlock && (
        <div className="rounded-xl border border-white/[0.06] bg-surface p-4">
          <MultiAudienceReadBlockRenderer block={compareBlock} />
        </div>
      )}

      {/* List */}
      {loading && (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-error py-8 text-center">{error}</p>
      )}

      {!loading && !error && audiences.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-surface px-6 py-10 text-center">
          <p className="text-base font-semibold text-foreground mb-2">No custom audiences yet</p>
          <p className="text-sm text-foreground-secondary max-w-md mx-auto mb-5">
            {`You're using `}
            <strong className="text-foreground">General</strong>
            {` — Numen's universal audience. Calibrate a personal audience from your own @handle, or start from a template, to test against the people who actually watch you.`}
          </p>
          <Button variant="primary" onClick={() => router.push("/audience/new")}>
            Create audience
          </Button>
        </div>
      )}

      {!loading && !error && audiences.length > 0 && (
        <div className="flex flex-col gap-2">
          {/* Section: built-in */}
          <div className="flex flex-col gap-1">
            {audiences.map((audience) => {
              const isGeneral = audience.is_general;
              const isUserOwned = !isGeneral && !audience.is_preset;
              const isSelected = selectedIds.includes(audience.id);
              const platformLabel =
                audience.platform.charAt(0).toUpperCase() + audience.platform.slice(1);
              const typeLabel = audience.type === "personal" ? "Personal" : "Target";
              // In selection mode the WHOLE row toggles selection (any saved audience
              // may be picked); normal navigation is suppressed. Outside selection mode
              // the shipped behavior is unchanged (user-owned rows navigate to detail).
              const rowOnClick = selectionMode
                ? () => toggleSelection(audience.id)
                : isUserOwned
                  ? () => router.push(`/audience/${audience.id}`)
                  : undefined;
              return (
                <div
                  key={audience.id}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl border bg-surface px-4 min-h-[56px] pointer-coarse:min-h-[64px]",
                    "transition-colors",
                    // Selection state is NEUTRAL (charcoal-chip / white-[0.06] + cream
                    // check) — NOT coral. Coral stays on the Compare-launch CTA only.
                    selectionMode && isSelected
                      ? "border-white/[0.06] bg-white/[0.06]"
                      : "border-white/[0.06] hover:bg-white/[0.02]",
                    (selectionMode || isUserOwned) && "cursor-pointer",
                  )}
                  onClick={rowOnClick}
                  role={selectionMode ? "checkbox" : undefined}
                  aria-checked={selectionMode ? isSelected : undefined}
                  aria-label={selectionMode ? `Select ${audience.name}` : undefined}
                >
                  {/* Selection checkbox — neutral box, cream check when selected. */}
                  {selectionMode && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded-md border w-5 h-5 pointer-coarse:w-6 pointer-coarse:h-6 transition-colors",
                        isSelected
                          ? "border-white/[0.12] bg-white/[0.06]"
                          : "border-white/[0.12] bg-transparent",
                      )}
                    >
                      {isSelected && (
                        <Check weight="bold" className="w-3.5 h-3.5 text-cream-secondary" />
                      )}
                    </span>
                  )}

                  {/* Name + sub-label */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-foreground truncate">
                      {audience.name}
                    </p>
                    <p className="text-xs text-foreground-secondary truncate">
                      {isGeneral
                        ? "Universal baseline"
                        : audience.is_preset
                          ? `${platformLabel} · Template`
                          : `${platformLabel} · ${typeLabel}`}
                    </p>
                  </div>

                  {/* Trailing: General badge or ⋯ menu (hidden in selection mode so the
                      row reads as a single selection target). */}
                  {!selectionMode && isGeneral && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Badge variant="accent" size="sm">General</Badge>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-[200px] text-xs text-center">
                        {"Numen's universal audience — the protected baseline. Can't be edited or deleted."}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {!selectionMode && (audience.is_preset || isUserOwned) && (
                    <div className="relative" data-audience-menu>
                      <button
                        type="button"
                        aria-label="Audience options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen((prev) => (prev === audience.id ? null : audience.id));
                        }}
                        className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-lg pointer-coarse:w-10 pointer-coarse:h-10",
                          "text-foreground-secondary hover:bg-white/[0.06] hover:text-foreground transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                        )}
                      >
                        <DotsThree weight="bold" className="w-4 h-4" />
                      </button>

                      {menuOpen === audience.id && (
                        <div
                          role="menu"
                          className="absolute right-0 top-full mt-1 z-10 w-36 rounded-lg border border-white/[0.06] bg-surface-elevated shadow-float overflow-hidden"
                          data-audience-menu
                        >
                          {isUserOwned && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpen(null);
                                router.push(`/audience/${audience.id}`);
                              }}
                              className="w-full flex items-center px-3 min-h-[40px] text-sm text-foreground-secondary hover:bg-white/[0.05] hover:text-foreground transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(null);
                              setDeleteTarget(audience);
                            }}
                            className="w-full flex items-center px-3 min-h-[40px] text-sm text-error hover:bg-white/[0.05] transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary line */}
          {userAudienceCount === 0 && (
            <p className="text-xs text-foreground-muted px-1 mt-1">
              {`No custom audiences yet. Create one to calibrate from your @handle.`}
            </p>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
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
  );
}
