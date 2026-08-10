"use client";

/**
 * The v8 audience sheet (owner decision 13): everything about who you're creating for,
 * one tap from the composer foot's audience chip — audiences with PROVENANCE, a
 * new-audience door, and the platform LENS as a segmented control. The lens is a run
 * setting (platform-lens.ts); `audiences.platform` is provenance; mismatch is admitted,
 * never blocked (spec §5). Rows carry no numbers (no follower counts — the mock's are
 * fabricated, handoff §5).
 *
 * Craft pass 2026-08-11 (owner: "this ui design could also be done better"):
 *  · It floated at the BOTTOM CENTRE of the screen, unattached to anything the user
 *    clicked. It now rises from the composer's top edge, left-aligned — the same
 *    geometry as the skills panel, so the composer has one popover behaviour, not two.
 *  · Rows were two-line blocks behind pseudo-avatar tiles — tiles that carried no real
 *    information and collided ("General" and "Growth Audience" were both a grey "G"), and
 *    a stack of eight of them read as a contact list rather than a setting. Rows are ONE
 *    line now: name left, provenance right, tiles gone. Half the height, nothing lost.
 *  · The tones were fighting: the sheet, the segmented track and the selected segment
 *    were three near-identical charcoals, so the control had no visible container. The
 *    sheet is `surface-elevated` (matching the skills panel and the restored composer)
 *    and the track sits DARKER inside it, the way an inset control should.
 *  · Section labels dropped mono — a monospace section header is noise at 10px — and
 *    now match the skills panel's group labels exactly.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { groupAudiences } from "@/components/audience/audience-display";
import { Ico } from "@/components/app/home/composer-controls";
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-3 text-micro font-semibold uppercase tracking-[0.1em] text-foreground-muted/70">
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
  placeAboveRef,
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
  /** Element the desktop popover rises from (the composer's field region), matching the
   *  skills panel. Absent ⇒ the sheet falls back to bottom-centre. */
  placeAboveRef?: React.RefObject<HTMLElement | null>;
}) {
  const isWide = useMediaQuery("(min-width: 640px)");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

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

  // Same anchoring contract as the skills panel: above the composer box, left-aligned,
  // growing upward, re-placed on scroll/resize.
  useEffect(() => {
    if (!open || !isWide) return;
    const place = () => {
      const r = placeAboveRef?.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ left: Math.max(12, r.left), bottom: window.innerHeight - r.top + 10 });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, isWide, placeAboveRef]);

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
            "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
            selected ? "bg-white/[0.07]" : "hover:bg-white/[0.035]",
          )}
        >
          <span className="min-w-0 flex-1 truncate text-reading font-medium text-foreground">
            {a.name}
          </span>
          <span className="shrink-0 text-label text-foreground-muted">{provenanceLine(a)}</span>
          {/* The check keeps a reserved slot on every row, so the provenance column stays
              straight instead of jumping 14px on whichever row happens to be selected. */}
          <span className="grid w-3.5 shrink-0 place-items-center">
            {selected && <Ico name="check" size={13} className="text-foreground-secondary" />}
          </span>
        </button>
      );
    });

  const presets = [...groups.baseline, ...groups.templates];

  const body = (
    <div ref={panelRef} role="listbox" aria-label="Creating for">
      <SectionLabel>Creating for</SectionLabel>
      {rows(groups.yours)}
      {/* Yours vs the shipped presets, separated by a rule rather than a second label —
          the distinction is real, but it does not need two more words to land. */}
      {groups.yours.length > 0 && presets.length > 0 && (
        <div className="my-1.5 border-t border-white/[0.06]" />
      )}
      {rows(presets)}
      <button
        type="button"
        onClick={onNewAudience}
        className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-white/[0.035]"
      >
        <span className="min-w-0 flex-1 truncate text-reading font-medium text-foreground">
          New audience
        </span>
        <span className="shrink-0 text-label text-foreground-muted">connect or describe</span>
        <span className="grid w-3.5 shrink-0 place-items-center text-foreground-muted">
          <Ico name="plus" size={12} />
        </span>
      </button>

      <div className="mt-1.5 border-t border-white/[0.06]" />
      <SectionLabel>On platform</SectionLabel>
      <div
        role="radiogroup"
        aria-label="Platform lens"
        className="mx-1 flex gap-1 rounded-lg border border-white/[0.05] bg-black/25 p-1"
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
              "flex-1 rounded-md py-1.5 text-center text-label transition-colors",
              lens === p
                ? "bg-white/[0.10] font-medium text-foreground"
                : "text-foreground-muted hover:text-foreground-secondary",
            )}
          >
            {LENS_LABEL[p]}
          </button>
        ))}
      </div>
      {/* Calibrated-on vs asked-for: admitted quietly, never a block (spec §5). */}
      {note && <p className="px-2.5 pb-0.5 pt-2 text-caption text-foreground-muted">{note}</p>}
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
        style={isWide && pos ? { left: pos.left, bottom: pos.bottom } : undefined}
        className={cn(
          "ambient-room-in fixed z-[var(--z-modal)] overflow-y-auto border-white/[0.10] bg-surface-elevated",
          isWide
            ? cn(
                "max-h-[min(560px,70vh)] w-[380px] max-w-[calc(100vw-28px)] rounded-lg border p-2",
                "shadow-[0_16px_40px_rgba(0,0,0,0.4)]",
                // No anchor measured yet ⇒ the old bottom-centre placement, so the sheet is
                // never rendered at 0,0 in the corner on its first paint.
                !pos && "bottom-6 left-1/2 -translate-x-1/2",
              )
            : "inset-x-0 bottom-0 max-h-[78dvh] rounded-t-2xl border border-b-0 px-2.5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2",
        )}
      >
        {!isWide && <div className="mx-auto mb-1.5 h-1 w-[34px] rounded-full bg-white/[0.14]" />}
        {body}
      </div>
    </>,
    document.body,
  );
}
