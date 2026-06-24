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
import { Scales } from "@phosphor-icons/react";

interface AudienceManagerProps {
  className?: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 ml-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-foreground-muted">
      {children}
    </p>
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

export function AudienceManager({ className }: AudienceManagerProps) {
  const router = useRouter();
  const supabase = createClient();
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

  const { baseline, templates, yours } = groupAudiences(audiences);
  const userAudienceCount = yours.length;

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

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground">Your audiences</h1>
          {/* A1-COUPLED-COPY: revise if weights→generation wires */}
          <p className="mt-1 text-sm text-foreground-secondary">
            {selectionMode
              ? "Pick two audiences to compare."
              : "Who's in the room when you run a Read."}
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
          {compareNote && <p className="text-xs text-warning">{compareNote}</p>}
        </div>
      )}

      {selectionMode && compareBlock && (
        <div className={cn(READING_CARD, "p-4")}>
          <MultiAudienceReadBlockRenderer block={compareBlock} />
        </div>
      )}

      {loading && <AudienceListSkeleton />}

      {!loading && error && (
        <p className="text-sm text-error py-8 text-center">{error}</p>
      )}

      {!loading && !error && audiences.length === 0 && (
        <div className={cn(READING_CARD, "flex flex-col items-center px-6 py-12 text-center")}>
          <ConstellationMark width={80} litNodeIndex={-1} className="mb-5 opacity-80" />
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
        <div className="flex flex-col gap-6">
          {baseline.length > 0 && (
            <section>
              <SectionLabel>Baseline</SectionLabel>
              <div className="flex flex-col gap-3">
                {baseline.map(renderAudienceCard)}
              </div>
            </section>
          )}

          {templates.length > 0 && (
            <section>
              <SectionLabel>Templates</SectionLabel>
              <div className="flex flex-col gap-3">
                {templates.map(renderAudienceCard)}
              </div>
            </section>
          )}

          {yours.length > 0 && (
            <section>
              <SectionLabel>Yours</SectionLabel>
              <div className="flex flex-col gap-3">
                {yours.map(renderAudienceCard)}
              </div>
            </section>
          )}

          {userAudienceCount === 0 && (
            <p className="text-xs text-foreground-muted px-1">
              No custom audiences yet. Create one to calibrate from your @handle.
            </p>
          )}
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
  );
}
