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
 * Anatomy — a collapsed BAR that expands DOWNWARD into a sheet:
 *   bar   · room glyph · audience name · calibration chip · "N ranked" · caret
 *   sheet · the v2 Overview ⇄ Simulate ⇄ Detail flow, capped and internally scrolled
 *
 * The bar carries the room's identity so the Overview inside can omit its own header — the legacy
 * header's worst tell was naming the audience twice inside 60 vertical pixels.
 */

import { useEffect, useState } from "react";
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
  // Rise-in on open (mirrors the legacy header sheet's bloom) — mounted first, then transitioned,
  // so the sheet animates in rather than popping. Reduced motion skips straight to risen.
  const [risen, setRisen] = useState(false);
  useEffect(() => {
    if (!open) {
      setRisen(false);
      return;
    }
    if (reducedMotion) {
      setRisen(true);
      return;
    }
    const id = requestAnimationFrame(() => setRisen(true));
    return () => cancelAnimationFrame(id);
  }, [open, reducedMotion]);

  // The bar's one live number. `descriptors` IS the ranked board the Overview renders, so this is a
  // real count of what's in the room — never a fabricated readiness figure (the legacy bar's
  // "N of 10 would stop" was a score with no visible subject once the card scrolled away).
  const count = descriptors.length;

  return (
    <div className="relative w-full" data-testid="ambient-overview-sheet" data-open={open}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={open ? "Close your audience" : "Open your audience"}
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

      {open ? (
        <div
          data-testid="ambient-sheet-panel"
          role="dialog"
          aria-label="Your audience"
          className={
            // Blooms DOWN from the bar, over the thread. Capped + internally scrolled; the surfaces
            // inside are `flex-1 min-h-0`, so a short board hugs its content and a long one scrolls.
            "absolute left-0 right-0 top-full z-[55] mt-1.5 flex max-h-[72dvh] min-h-0 flex-col overflow-hidden rounded-[12px] " +
            (reducedMotion
              ? ""
              : "transition-[transform,opacity] duration-300 ease-out " +
                (risen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"))
          }
          style={{
            background: "#181817",
            border: `1px solid ${TONE.border}`,
            boxShadow: "var(--shadow-float)",
            ...(reducedMotion ? {} : { willChange: "transform" }),
          }}
        >
          <AmbientOverviewRail
            audience={audience}
            descriptors={descriptors}
            reducedMotion={reducedMotion}
            persistedSeals={persistedSeals}
            presentation="sheet"
          />
        </div>
      ) : null}
    </div>
  );
}
