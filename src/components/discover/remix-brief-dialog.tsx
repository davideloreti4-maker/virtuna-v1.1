"use client";

/**
 * THE PRE-BRIEF (D3) — one optional line that decides what the remix is FOR.
 *
 * `brief` has been accepted by `/api/tools/remix/run` since phase 1 (`route.ts:73`,
 * `z.string().max(200).optional()`) and reaches the adapt call as `AdaptInput.target`
 * (`remix-runner.ts:342`). Until this component, NOTHING in the UI ever sent it — a backend field
 * with no producer, the same silent-no-op shape that kept the empty profile columns invisible.
 *
 * The owner's ruling, and why the wording matters:
 *
 *   > D3 — Pre-brief: one optional free-text line, skippable. Empty = today's behaviour. Present =
 *   > it REPLACES the profile niche as the adaptation target, not augments it. Cross-niche
 *   > transfer is the case it exists for.
 *
 * ⚠️ "Replaces" is why an empty brief must be ABSENT, never `""`. The runner reads
 * `target: input.brief ?? null`, so a blank string is a supplied-but-empty target that overrides
 * the creator's niche with nothing — precisely the failure the field exists to prevent. `ask`
 * normalises to `null` here rather than trusting each call site to remember.
 *
 * COLOUR: none. The accent dosage is locked at "at most one accent element on screen, often
 * zero", primary actions are neutral cream (`--color-action`), and a text field before a run is
 * not one of the sanctioned uses. Deliberately the same shape as `SessionExpiredListener` so the
 * product's modals are learned once.
 */

import { useCallback, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The route's own cap (`z.string().max(200)`). Enforced here as `maxLength` so the field cannot
 * compose a body the route will answer with a 400 — a long brief is a validation error, not a
 * long brief, and the creator would never learn which.
 */
export const MAX_BRIEF = 200;

export interface RemixBriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the trimmed brief, or NULL when skipped or blank. Never an empty string. */
  onConfirm: (brief: string | null) => void;
  /** The source's hook, so the sheet says which video it is about rather than being a bare box. */
  sourceHook?: string | null;
}

export function RemixBriefDialog({
  open,
  onOpenChange,
  onConfirm,
  sourceHook,
}: RemixBriefDialogProps) {
  const [value, setValue] = useState("");

  const confirm = useCallback(
    (brief: string | null) => {
      setValue("");
      onConfirm(brief);
    },
    [onConfirm],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    confirm(value.trim() || null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>What do you want to make from this?</DialogTitle>
            {/* Says what SKIPPING does, not just that skipping is allowed — the fallback is the
                whole reason the field is optional, and a creator who doesn't know their niche is
                the default has no way to judge whether to type anything. */}
            <DialogDescription>
              Optional. Leave it blank and we&rsquo;ll adapt it to your niche.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 px-6 pt-4">
            {sourceHook ? (
              /* The source, quoted. Without it this is a text box with no subject — and on a grid
                 of near-identical covers, "which one did I just tap" is a real question.
                 ⚠️ A RULE, not a bordered box. The first draft gave it the same rounded border and
                 tinted fill as the input below it, and at both 1440 and 390 the sheet read as a
                 two-field form whose top field was already filled in. A left rule cannot be
                 mistaken for a control. */
              <p className="line-clamp-2 border-l-2 border-white/[0.12] pl-3 text-sm text-foreground-secondary">
                {sourceHook}
              </p>
            ) : null}

            <label htmlFor="remix-brief" className="sr-only">
              What do you want to make from this? Optional.
            </label>
            <input
              id="remix-brief"
              name="brief"
              type="text"
              autoFocus
              maxLength={MAX_BRIEF}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. a cold-email teardown for B2B founders"
              className="h-11 w-full rounded-lg border border-white/[0.06] bg-white/[0.05] px-3 text-sm text-foreground outline-none transition-colors placeholder:text-foreground-muted focus-visible:border-[var(--color-foreground-secondary)]/50 focus-visible:ring-1 focus-visible:ring-[var(--color-foreground-secondary)]/50"
            />

            {/* Only once it is close enough to matter. A permanent 0/200 counter on an optional
                field reads as a requirement. */}
            {value.length > MAX_BRIEF - 40 ? (
              <p className="text-right text-caption tabular-nums text-foreground-muted">
                {value.length}/{MAX_BRIEF}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            {/* CANCEL, not "Skip". An earlier draft offered Skip beside Remix and both started
                the same billed run — so the sheet had no visible way out at all, and the only
                no-spend exit was an Escape key nobody is told about. Skipping the brief is
                already what an empty field does, so the honest second button is the one that
                spends nothing. */}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Remix
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** What `useRemixBrief` hands a consumer to spread onto the dialog. */
export interface RemixBriefDialogState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (brief: string | null) => void;
  sourceHook?: string | null;
}

/**
 * Holds "which row is waiting on a brief" so a panel adds the sheet in two lines.
 *
 * `launch` is `useRemixLaunch`'s `remix` (or a panel's own equivalent): `(id, url, brief) => …`.
 *
 * ⚠️ Dismissing launches NOTHING. Closing a sheet is not consent to spend a credit, and the
 * remix route is billed — so the only paths that fire are Remix and Skip, both explicit.
 */
export function useRemixBrief(
  launch: (id: string, url: string | null, brief: string | null) => void,
) {
  const [pending, setPending] = useState<{
    id: string;
    url: string;
    hook?: string | null;
  } | null>(null);

  const ask = useCallback(
    (id: string, url: string | null, hook?: string | null) => {
      // No URL means there is nothing to remix and no brief worth collecting. Hand it straight to
      // the launcher, which already owns the "that video has no URL" message.
      if (!url) {
        launch(id, url, null);
        return;
      }
      setPending({ id, url, hook });
    },
    [launch],
  );

  const onConfirm = useCallback(
    (brief: string | null) => {
      const target = pending;
      setPending(null);
      if (target) launch(target.id, target.url, brief);
    },
    [launch, pending],
  );

  const onOpenChange = useCallback((next: boolean) => {
    if (!next) setPending(null);
  }, []);

  return {
    ask,
    dialogProps: {
      open: pending !== null,
      onOpenChange,
      onConfirm,
      sourceHook: pending?.hook ?? null,
    } satisfies RemixBriefDialogState,
  };
}
