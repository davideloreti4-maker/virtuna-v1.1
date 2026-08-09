"use client";

/**
 * The v8 audience sheet (owner decision 13): everything about who you're creating for,
 * one tap from the sub-bar — audiences with PROVENANCE, a new-audience door, and the
 * platform LENS as a segmented control. The lens is a run setting (platform-lens.ts);
 * `audiences.platform` is provenance; mismatch is admitted, never blocked (spec §5).
 * Rows carry no numbers (no follower counts — the mock's are fabricated, handoff §5).
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { groupAudiences } from "@/components/audience/audience-display";
import { platformLabel } from "@/lib/platforms";
import type { Audience } from "@/lib/audience/audience-types";
import type { Platform } from "@/components/app/home/platform-chip";
import { LENS_LABEL, LENS_OPTIONS } from "./platform-lens";

function provenanceLine(a: Audience): string {
  if (a.source_account_id) return `modeled on ${platformLabel(a.platform)}`;
  if (a.is_general) return "baseline";
  if (a.is_preset) return "preset";
  return "described by you";
}

function Whisper({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1 pb-1 pt-3 font-mono text-micro uppercase tracking-[0.12em] text-foreground-muted">
      {children}
    </div>
  );
}

export function AudienceSheetV8({
  open,
  onClose,
  audiences,
  selectedAudienceId,
  onSelect,
  lens,
  onLensChange,
  note,
  onNewAudience,
}: {
  open: boolean;
  onClose: () => void;
  audiences: Audience[];
  selectedAudienceId: string | null;
  onSelect: (a: Audience) => void;
  lens: Platform;
  onLensChange: (p: Platform) => void;
  note: string | null;
  onNewAudience: () => void;
}) {
  const isWide = useMediaQuery("(min-width: 640px)");
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    if (!isWide) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, isWide]);

  if (!open || typeof document === "undefined") return null;

  const groups = groupAudiences(audiences);
  const rows = (list: Audience[]) =>
    list.map((a) => {
      const selected = a.id === selectedAudienceId;
      return (
        <button
          key={a.id}
          type="button"
          role="option"
          aria-selected={selected}
          onClick={() => onSelect(a)}
          className={cn(
            "flex w-full items-center gap-3 rounded-[10px] px-2 py-2.5 text-left transition-colors",
            selected ? "bg-white/[0.06]" : "hover:bg-white/[0.035]",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-reading font-medium text-foreground">
              {a.name}
            </span>
            <span className="mt-[2px] block text-label text-foreground-muted">
              {provenanceLine(a)}
            </span>
          </span>
          {selected && <span className="shrink-0 text-foreground-secondary">✓</span>}
        </button>
      );
    });

  const body = (
    <div ref={panelRef} role="listbox" aria-label="Creating for">
      <Whisper>Creating for</Whisper>
      {rows(groups.yours)}
      {rows(groups.baseline)}
      {rows(groups.templates)}
      <button
        type="button"
        onClick={onNewAudience}
        className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2.5 text-left transition-colors hover:bg-white/[0.035]"
      >
        <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border border-white/[0.06] text-foreground-muted">
          +
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-reading font-medium text-foreground">New audience</span>
          <span className="mt-[2px] block text-label text-foreground-muted">
            connect an account, or describe them
          </span>
        </span>
      </button>
      <Whisper>On platform</Whisper>
      <div
        role="radiogroup"
        aria-label="Platform lens"
        className="flex gap-1 rounded-[12px] border border-white/[0.06] bg-surface-sunken p-1"
      >
        {LENS_OPTIONS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={lens === p}
            aria-label={LENS_LABEL[p]}
            onClick={() => onLensChange(p)}
            className={cn(
              "flex-1 rounded-[9px] py-1.5 text-center text-label transition-colors",
              lens === p
                ? "bg-background font-medium text-foreground ring-1 ring-inset ring-white/[0.07]"
                : "text-foreground-muted hover:text-foreground-secondary",
            )}
          >
            {LENS_LABEL[p]}
          </button>
        ))}
      </div>
      {note && <p className="px-1 pt-2 font-mono text-micro text-foreground-muted">{note}</p>}
    </div>
  );

  return createPortal(
    // The dialog role lives on the PANEL itself, not a wrapper — a zero-height
    // wrapper around fixed children reads as "hidden" to visibility checks.
    <>
      <div className="fixed inset-0 z-[var(--z-modal)] bg-black/40" onMouseDown={onClose} />
      <div
        data-testid="audience-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Creating for"
        className={cn(
          "ambient-room-in fixed z-[var(--z-modal)] overflow-y-auto border-white/[0.10] bg-surface-sunken",
          isWide
            ? "bottom-6 left-1/2 max-h-[70vh] w-[420px] -translate-x-1/2 rounded-[18px] border p-3 shadow-[0_16px_40px_rgba(0,0,0,0.4)]"
            : "inset-x-0 bottom-0 max-h-[78dvh] rounded-t-[22px] border border-b-0 px-3 pb-[max(20px,env(safe-area-inset-bottom))] pt-2",
        )}
      >
        {!isWide && <div className="mx-auto mb-2 h-1 w-[34px] rounded-full bg-surface-elevated" />}
        {body}
      </div>
    </>,
    document.body,
  );
}
