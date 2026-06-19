"use client";

/**
 * SavedItemCard — one typed item on the flat Saved shelf (Plan 10-04 Task 2).
 *
 * State→Act: a saved item launches back INTO a thread via the existing
 * CHAIN_HANDOFFS SSOT (no one-off wiring) and can be removed from the shelf
 * (confirmation; never deletes the original).
 *
 * Anatomy (10-UI-SPEC §Interaction Contracts + §Color):
 *  - item-type chip (NEUTRAL charcoal-chip + cream text — NEVER coral)
 *  - title (cream-primary) + muted timestamp
 *  - primary "Use in thread →" (accent CTA) — per-type label resolved from
 *    CHAIN_HANDOFFS (saved hook → "Test full →", saved idea → "Develop →")
 *  - overflow "Remove" → "Remove from shelf?" confirmation (destructive)
 *
 * Launch model (mirrors DiscoverClient): POST the snapshot's anchor to the
 * resolved handoff endpoint, then navigate to /home where the open thread
 * rehydrates and renders the new card. Context-mediated handoffs (endpoint:
 * null, e.g. hook→test) navigate to /home carrying the anchor for the thread
 * view to pick up.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DotsThree, ArrowRight } from "@phosphor-icons/react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useDeleteSavedItem } from "@/hooks/queries/use-saved-items";
import {
  handoffsFor,
  type ChainHandoff,
  type SkillId,
} from "@/lib/tools/chain-handoff";
import type { SavedItem, SavedItemType } from "@/lib/shelf/shelf-repo";
import { cn } from "@/lib/utils";

// ─── item_type → originating SkillId (CHAIN_HANDOFFS launch resolution) ───────
// The Saved shelf's item_type vocabulary maps onto the chain-handoff SkillId
// union. `read`/`outlier`/`format` have no direct launch CTA in P10's minimal
// set — they render without a "Use in thread →" launch (P12 extends).
const ITEM_TYPE_TO_SKILL: Partial<Record<SavedItemType, SkillId>> = {
  idea: "idea",
  hook: "hooks",
  script: "script",
  outlier: "discover",
};

// Human-facing per-type launch label (UI-SPEC: hook→"Test full →", idea→"Develop →").
const LAUNCH_LABEL: Partial<Record<SavedItemType, string>> = {
  hook: "Test full →",
  idea: "Develop →",
};

const TYPE_LABEL: Record<SavedItemType, string> = {
  read: "Read",
  idea: "Idea",
  hook: "Hook",
  script: "Script",
  outlier: "Outlier",
  format: "Format",
};

/** Resolve the launch handoff for a saved item_type from the SSOT. */
function launchHandoffFor(type: SavedItemType): ChainHandoff | undefined {
  const skill = ITEM_TYPE_TO_SKILL[type];
  if (!skill) return undefined;
  // The first downstream handoff is the canonical "Use in thread →" launch
  // (idea→hooks "Develop", hooks→test "Test full", etc.).
  return handoffsFor(skill)[0];
}

/** Best-effort anchor extraction from a persisted snapshot's block props. */
function anchorFromSnapshot(snapshot: Record<string, unknown>): string {
  const props = (snapshot.props as Record<string, unknown> | undefined) ?? snapshot;
  const pick = (k: string) =>
    typeof props[k] === "string" ? (props[k] as string) : "";
  const title = pick("title");
  const angle = pick("angle");
  const hookLine = pick("hookLine");
  if (hookLine) return hookLine;
  if (title && angle) return `${title}\n\n${angle}`;
  return title || pick("text") || "";
}

export interface SavedItemCardProps {
  item: SavedItem;
}

export function SavedItemCard({ item }: SavedItemCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const remove = useDeleteSavedItem();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [launching, setLaunching] = useState(false);

  const handoff = launchHandoffFor(item.item_type);
  const launchLabel =
    LAUNCH_LABEL[item.item_type] ?? handoff?.ctaLabel ?? "Use in thread →";
  const displayTitle = item.title?.trim() || TYPE_LABEL[item.item_type];

  const handleUse = async () => {
    if (!handoff || launching) return;
    setLaunching(true);
    try {
      if (handoff.endpoint) {
        const anchor = anchorFromSnapshot(item.snapshot);
        const res = await fetch(handoff.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anchor, platform: "tiktok" }),
        });
        if (!res.ok) throw new Error("Launch failed");
      }
      // Context-mediated handoffs (endpoint: null) and card-POST launches both
      // land in the open thread — navigate to /home where it rehydrates.
      router.push("/home");
    } catch {
      toast({ variant: "error", title: "Couldn't launch this into a thread." });
      setLaunching(false);
    }
  };

  const handleRemove = () => {
    remove.mutate(item.id, {
      onSuccess: () => toast({ variant: "success", title: "Removed from shelf" }),
      onError: () =>
        toast({ variant: "error", title: "Couldn't remove this item." }),
    });
    setConfirmOpen(false);
  };

  const timestamp = new Date(item.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-white/[0.06] p-4"
      style={{
        backgroundColor: "var(--color-charcoal-composer)",
        boxShadow: "rgba(255,255,255,0.05) 0 1px 0 0 inset",
      }}
    >
      {/* Header: neutral type chip + overflow */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="shrink-0 rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium text-foreground-secondary"
          style={{ backgroundColor: "var(--color-charcoal-chip)" }}
        >
          {TYPE_LABEL[item.item_type]}
        </span>

        <AlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialog.Trigger asChild>
            <button
              type="button"
              className="shrink-0 text-foreground-muted transition-colors hover:text-foreground"
              aria-label="Item options"
            >
              <DotsThree size={20} weight="bold" />
            </button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay
              className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0"
              style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
            />
            <AlertDialog.Content
              className="fixed left-[50%] top-[50%] z-[var(--z-modal)] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-xl border border-white/[0.06] p-6 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
              style={{
                backgroundColor: "rgba(17, 18, 20, 0.95)",
                boxShadow:
                  "0 20px 25px rgba(0,0,0,0.3), 0 10px 10px rgba(0,0,0,0.2), rgba(255,255,255,0.1) 0px 1px 0px 0px inset",
              }}
            >
              <AlertDialog.Title className="text-lg font-semibold text-foreground">
                Remove from shelf?
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-2 text-sm text-foreground-secondary">
                This takes &ldquo;{displayTitle}&rdquo; off your shelf. It won&rsquo;t
                delete the original.
              </AlertDialog.Description>
              <div className="mt-6 flex justify-end gap-3">
                <AlertDialog.Cancel asChild>
                  <Button variant="secondary">Keep</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button variant="destructive" onClick={handleRemove}>
                    Remove
                  </Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>

      {/* Title + timestamp */}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold leading-snug text-foreground line-clamp-3">
          {displayTitle}
        </p>
        <span className="text-xs text-foreground-muted">{timestamp}</span>
      </div>

      {/* Primary accent launch — resolved from CHAIN_HANDOFFS */}
      {handoff && (
        <button
          type="button"
          onClick={() => void handleUse()}
          disabled={launching}
          className={cn(
            "inline-flex items-center gap-1 self-start text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
          )}
          style={{ color: launching ? "rgba(255,127,80,0.5)" : "#FF7F50" }}
          aria-label={`Use this ${TYPE_LABEL[item.item_type]} in a thread`}
        >
          {launching ? "Launching…" : launchLabel}
          {!launching && <ArrowRight size={14} weight="bold" />}
        </button>
      )}
    </div>
  );
}
