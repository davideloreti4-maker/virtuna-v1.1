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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { DotsThree } from "@phosphor-icons/react";

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
            Who Numen writes and tests for.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => router.push("/audience/new")}
          className="shrink-0 pointer-coarse:h-11"
        >
          Create audience
        </Button>
      </div>

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
              const platformLabel =
                audience.platform.charAt(0).toUpperCase() + audience.platform.slice(1);
              const typeLabel = audience.type === "personal" ? "Personal" : "Target";
              return (
                <div
                  key={audience.id}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl border border-white/[0.06] bg-surface px-4 min-h-[56px] pointer-coarse:min-h-[64px]",
                    "hover:bg-white/[0.02] transition-colors",
                    isUserOwned && "cursor-pointer",
                  )}
                  onClick={isUserOwned ? () => router.push(`/audience/${audience.id}`) : undefined}
                >
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

                  {/* Trailing: General badge or ⋯ menu */}
                  {isGeneral && (
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

                  {(audience.is_preset || isUserOwned) && (
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
