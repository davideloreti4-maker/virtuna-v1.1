"use client";

/**
 * VerdictReport — the v8 three-tab verdict report (Phase 3; spec §2 + mock §6/§10).
 *
 * One shell, two presentations — an EVENT, never furniture (the 2026-08-09 rail ruling:
 * rail or no rail, and the owner picked no rail; the pinned panel was a rejected third
 * shape). Nothing about the sim is permanently resident:
 *   sheet — mobile bottom sheet over a scrim
 *   panel — desktop right overlay over a scrim; close it and it is gone
 *
 * TWO DATA GRADES, one shell — and ONE audience page either way (owner ruling 2026-08-09: the
 * content is the content we already had). A subject carrying a Stage-2 `population` renders the
 * shipped drill (`buildDomainTemplate` → PopulationFrame + the reason-breakdown Brain). A subject
 * with only its ten cached personas — every DROP, by law: opening a drop's report READS its cache
 * and NEVER re-sims — renders the same PopulationFrame at its reduced grade (`personaRead`), with
 * Brain and Engagement honestly dimmed. Nothing is synthesized to fill an empty slot.
 *
 * The sealed-verdict law carries over: while a run is in flight the report shows the watcher and
 * withholds the number until it returns.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AmbientDetail, REPORT_TAB_ORDER, TONE } from "@/components/audience-lens/v2/AmbientDetail";
import { buildDomainTemplate } from "@/lib/surfaces/ambient-v2-population";
import { audienceToMeta } from "@/lib/surfaces/ambient-v2-audience-meta";
import { personasToReportRead, buildPersonaReportTemplate } from "@/lib/surfaces/v8-report";
import type { Audience } from "@/lib/audience/audience-types";
import type { ReactionPersona } from "@/lib/tools/blocks";
import type { PopulationAggregate } from "@/lib/audience/population";

/** What the report is a report OF. `population` present ⇒ the full drill; absent ⇒ personas only. */
export interface ReportSubject {
  id: string;
  /** The hook / concept text the read is about. */
  title: string;
  personas: ReactionPersona[];
  population?: PopulationAggregate | null;
  /** The measured stop % when a fired run sealed one. Absent ⇒ derived from the personas. */
  stopPct?: number;
}

export function VerdictReport({
  open,
  onClose,
  subject,
  audience,
  variant,
  watching = false,
  reducedMotion = false,
  onSteer,
}: {
  open: boolean;
  onClose: () => void;
  subject: ReportSubject | null;
  audience: Audience;
  variant: "sheet" | "panel";
  watching?: boolean;
  reducedMotion?: boolean;
  /** A tab's fix action feeds the thread as a steer (spec §2). */
  onSteer?: (steer: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    // Only the sheet locks the body behind it; the desktop panel leaves the page scrollable.
    if (variant === "sheet") document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, variant, onClose]);

  if (!open || typeof document === "undefined") return null;

  const meta = audienceToMeta(audience);
  const read = subject ? personasToReportRead(subject.personas) : null;

  // The full drill when a Stage-2 projection exists; the personas-only template otherwise.
  const template =
    subject && subject.population
      ? buildDomainTemplate({
          pct: subject.stopPct ?? read!.stopPct,
          aggregate: subject.population,
          personas: subject.personas,
          calibratedFrom: meta.calibratedFrom,
          tier: meta.tier,
          conceptLabel: "",
          stimulusKey: subject.id,
          ...(subject.title.trim() ? { transcript: subject.title.trim() } : {}),
        })
      : subject && read
        ? buildPersonaReportTemplate({
            read,
            title: subject.title,
            audienceName: meta.name,
            calibratedFrom: meta.calibratedFrom,
          })
        : null;

  const body =
    watching && !subject ? (
      // The sealed watcher — the verdict is withheld until the run returns.
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <span className="font-mono text-body" style={{ color: TONE.faint }}>
          watching…
        </span>
      </div>
    ) : template ? (
      <AmbientDetail
        template={template}
        presentation="sheet"
        tabOrder={REPORT_TAB_ORDER}
        reducedMotion={reducedMotion}
        onSteer={onSteer}
      />
    ) : (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <span className="max-w-[240px] text-label leading-[1.5]" style={{ color: TONE.faint }}>
          Nothing simulated yet — open a card and simulate it, and the room&rsquo;s read lands here.
        </span>
      </div>
    );

  const chrome = (
    <div
      data-testid="verdict-report"
      data-variant={variant}
      role="dialog"
      aria-modal="true"
      aria-label="The verdict report"
      className={
        // `ambient-room-in`: the house entrance for overlays that MOUNT already-open — a
        // short rise, snapped to rest under prefers-reduced-motion (globals.css).
        variant === "sheet"
          ? "ambient-room-in fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[88vh] min-h-0 flex-col overflow-hidden rounded-t-[20px] border-t border-white/[0.06]"
          : "ambient-room-in fixed right-0 top-0 z-[var(--z-modal)] flex h-full min-h-0 w-[400px] flex-col overflow-hidden border-l border-white/[0.06]"
      }
      style={{
        background: "#181817",
        ...(variant === "sheet" ? { paddingBottom: "env(safe-area-inset-bottom)" } : {}),
      }}
    >
      <div className="flex items-center justify-between px-[22px] pt-3">
        {variant === "sheet" ? (
          <span aria-hidden className="mx-auto h-1 w-9 rounded-full bg-white/[0.14]" />
        ) : (
          <>
            <span className="text-label font-semibold" style={{ color: TONE.dim }}>
              Report
            </span>
            <button
              type="button"
              aria-label="Close the report"
              onClick={onClose}
              className="text-body transition-colors"
              style={{ color: TONE.faint }}
            >
              ✕
            </button>
          </>
        )}
      </div>
      {body}
    </div>
  );

  return createPortal(
    <>
      <div
        data-testid="verdict-report-scrim"
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-[var(--z-modal-backdrop)]"
        style={{ background: "rgba(10,10,10,.55)" }}
      />
      {chrome}
    </>,
    document.body,
  );
}
