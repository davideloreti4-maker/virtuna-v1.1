"use client";

/**
 * AmbientOverviewSheet — the Ambient Audience v2 room, mounted in the composer's <xl thread HEADER.
 *
 * WHY THIS EXISTS (2026-07-24): `AMBIENT_V2_ENABLED` only ever swapped the ≥xl RAIL. The <xl header
 * slot kept rendering the legacy `<AudiencePresence variant="header">`, so a phone still got the
 * retired room — a constellation crown, "General · 10 people ready", and a two-column "say hi →"
 * cast — while a desktop on the same account got the ranked v2 board. One product, two rooms.
 *
 * This is the SAME `AmbientOverviewRail` (same live audience, same projected-card ledger, same real
 * sealed sims via `/api/tools/react`) rendered in `presentation="sheet"`: the surfaces inside drop
 * their rail chrome (440 cap, left hairline, own ground) and flex into the cap this host owns.
 *
 * Anatomy — a collapsed BAR that opens the room FULL SCREEN (owner call 2026-07-24):
 *   bar    · room glyph · audience name · calibration chip · "N ranked" · caret
 *   screen · the v2 Overview ⇄ Simulate ⇄ Detail flow, at full viewport height
 *
 * Full screen, not a 72dvh dropdown: these surfaces are TALL — the cortex figure, the attention
 * scrubber and the ranked board each want the whole column (see the desktop rail, which gets 100% of
 * an 800px+ viewport). A capped dropdown made every one of them a letterbox. The room is a place you
 * go on a phone, not a panel you peek at.
 *
 * Rendered through a PORTAL to <body>: `position: fixed` is trapped by any ancestor with a transform
 * / will-change (the thread and dock both use them), so anchoring in place would have pinned the
 * overlay to the composer instead of the viewport.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AmbientOverviewRail } from "./AmbientOverviewRail";
import { audienceToMeta } from "@/lib/surfaces/ambient-v2-audience-meta";
import type { Audience } from "@/lib/audience/audience-types";
import type { AmbientCardDescriptor } from "@/components/app/home/use-ambient-focus";
import type { SimSealMap } from "@/lib/threads/sim-seals";

// Local tone mirror — the v2 surfaces keep their palette inline for pixel fidelity to the round-4
// target, so the bar that hangs them matches by using the same values (not a second system).
const TONE = {
  cream: "#ece7de",
  dim: "rgba(236,231,222,.62)",
  faint: "rgba(236,231,222,.38)",
  hair: "rgba(255,255,255,.08)",
  border: "rgba(255,255,255,.06)",
} as const;

/** The same calm crowd mark the Overview's room header uses (people, not a sparkline). */
function RoomGlyph() {
  return (
    <svg viewBox="0 0 20 16" className="h-[15px] w-[18px] flex-none" aria-hidden>
      <circle cx="4" cy="11" r="2" fill="#ece7de" opacity=".9" />
      <circle cx="9.5" cy="6" r="2" fill="#ece7de" opacity=".62" />
      <circle cx="14.5" cy="11.5" r="1.9" fill="#ece7de" opacity=".78" />
      <circle cx="16.5" cy="5" r="1.5" fill="#ece7de" opacity=".4" />
    </svg>
  );
}

function Caret({ up }: { up: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
      className={`flex-none transition-transform duration-200 ${up ? "rotate-180" : ""}`}
      style={{ color: TONE.faint }}
    >
      <path
        d="M2.5 4.5L6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AmbientOverviewSheet({
  audience,
  descriptors,
  reducedMotion = false,
  persistedSeals,
  open,
  onOpenChange,
}: {
  audience: Audience;
  descriptors: AmbientCardDescriptor[];
  reducedMotion?: boolean;
  persistedSeals?: SimSealMap;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const meta = audienceToMeta(audience);

  // Escape closes the room, and the page behind it must not scroll under a full-screen overlay
  // (iOS in particular will happily rubber-band the thread beneath it).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onOpenChange]);

  // The bar's one live number. `descriptors` IS the ranked board the Overview renders, so this is a
  // real count of what's in the room — never a fabricated readiness figure (the legacy bar's
  // "N of 10 would stop" was a score with no visible subject once the card scrolled away).
  const count = descriptors.length;

  return (
    <div className="relative w-full" data-testid="ambient-overview-sheet" data-open={open}>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-expanded={open}
        aria-label="Open your audience"
        // While the room is open it covers this bar completely: it is unreachable by pointer, so it
        // must be unreachable by keyboard and screen reader too. The room's own header caret is the
        // single, unambiguous way out — two controls both labelled "close" is a worse room.
        disabled={open}
        aria-hidden={open}
        tabIndex={open ? -1 : undefined}
        className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left transition-colors"
        style={{
          background: "#181817",
          border: `1px solid ${TONE.border}`,
          color: TONE.cream,
          fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)",
        }}
      >
        <RoomGlyph />
        <span className="min-w-0 truncate text-[15px] font-semibold tracking-[-0.015em]">
          {meta.name}
        </span>
        <span
          className="inline-flex flex-none items-center gap-1.5 rounded-full px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.08em]"
          style={{ color: TONE.faint, border: `1px solid ${TONE.hair}` }}
        >
          <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: TONE.dim }} />
          {meta.calibrationBadge}
        </span>
        {count > 0 ? (
          <span
            className="ml-auto flex-none font-mono text-[10.5px] uppercase tracking-[0.06em]"
            style={{ color: TONE.faint }}
          >
            {count} ranked
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        <Caret up={open} />
      </button>

      {/* `open` only ever flips from a client tap (the composer seeds it false), so the portal never
          renders during SSR and needs no mount gate — `document` is guaranteed here. */}
      {open
        ? createPortal(
            <div
              data-testid="ambient-sheet-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Your audience"
              className={
                // THE ROOM, full screen. Fixed to the viewport (not the bar) so the tall v2 surfaces
                // get the whole column the way the desktop rail does. `--z-modal` because it IS one:
                // at `z-[80]` the fixed sidebar chrome (hamburger + account avatar, `--z-sidebar` =
                // 250) floated on top of it and sat across the room's own title.
                "fixed inset-0 z-[var(--z-modal)] flex min-h-0 flex-col overflow-hidden " +
                (reducedMotion ? "" : "ambient-room-in")
              }
              style={{
                background: "#181817",
                color: TONE.cream,
                // Notch / home-indicator clearance — a full-screen surface owns the safe area itself.
                paddingTop: "env(safe-area-inset-top)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              <AmbientOverviewRail
                audience={audience}
                descriptors={descriptors}
                reducedMotion={reducedMotion}
                persistedSeals={persistedSeals}
                presentation="sheet"
                // The Overview header's caret is the way out (the bar that opened it is now covered).
                onDismiss={() => onOpenChange(false)}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
