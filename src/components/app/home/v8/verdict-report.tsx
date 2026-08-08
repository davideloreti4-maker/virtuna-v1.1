"use client";

/**
 * VerdictReport — the v8 three-tab verdict report (Phase 3; spec §2 + mock §6/§10).
 *
 * One shell, three presentations:
 *   sheet          — mobile bottom sheet over a scrim
 *   panel          — desktop right overlay over a scrim
 *   panel + pinned — the same panel portaled into the layout's rail host; no scrim, the page
 *                    flows beside it. "The old always-on rail, reborn as a choice."
 *
 * TWO DATA GRADES, one shell. A subject carrying a Stage-2 `population` renders the shipped
 * drill (`buildDomainTemplate` → PopulationFrame + the reason-breakdown Brain). A subject with
 * only its ten cached personas — every DROP, by law: opening a drop's report READS its cache and
 * NEVER re-sims — renders the personas-only template plus <PersonaAudienceFrame>, with Brain and
 * Engagement honestly dimmed. Nothing is synthesized to fill an empty slot.
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
import { PersonaAudienceFrame } from "./persona-audience-frame";
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
  pinned,
  onPinnedChange,
  pinHost,
  watching = false,
  reducedMotion = false,
  onSteer,
}: {
  open: boolean;
  onClose: () => void;
  subject: ReportSubject | null;
  audience: Audience;
  variant: "sheet" | "panel";
  pinned: boolean;
  onPinnedChange: (next: boolean) => void;
  /** Where a PINNED panel docks (the layout's rail host). Null ⇒ the panel stays an overlay. */
  pinHost?: HTMLElement | null;
  watching?: boolean;
  reducedMotion?: boolean;
  /** A tab's fix action feeds the thread as a steer (spec §2). */
  onSteer?: (steer: string) => void;
}) {
  const docked = variant === "panel" && pinned && !!pinHost;

  useEffect(() => {
    if (!open || docked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    // A pinned panel is page furniture; only the overlay grades lock the body behind them.
    if (variant === "sheet") document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, docked, variant, onClose]);

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
        {...(subject && !subject.population && read
          ? { audienceSlot: <PersonaAudienceFrame read={read} onSteer={onSteer} /> }
          : {})}
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
      data-pinned={pinned || undefined}
      role="dialog"
      aria-modal={docked ? undefined : "true"}
      aria-label="The verdict report"
      className={
        docked
          ? "flex min-h-0 w-full flex-1 flex-col"
          : variant === "sheet"
            ? "fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[88vh] min-h-0 flex-col overflow-hidden rounded-t-[20px] border-t border-white/[0.06]"
            : "fixed right-0 top-0 z-[var(--z-modal)] flex h-full min-h-0 w-[400px] flex-col overflow-hidden border-l border-white/[0.06]"
      }
      style={{
        background: "#181817",
        ...(variant === "sheet" && !docked ? { paddingBottom: "env(safe-area-inset-bottom)" } : {}),
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
            <span className="flex items-center gap-3">
              <button
                type="button"
                aria-label={pinned ? "Unpin the report" : "Pin the report"}
                aria-pressed={pinned}
                onClick={() => onPinnedChange(!pinned)}
                className="text-label transition-colors"
                style={{ color: pinned ? TONE.cream : TONE.faint }}
              >
                {pinned ? "pinned" : "pin"}
              </button>
              <button
                type="button"
                aria-label="Close the report"
                onClick={onClose}
                className="text-body transition-colors"
                style={{ color: TONE.faint }}
              >
                ✕
              </button>
            </span>
          </>
        )}
      </div>
      {body}
    </div>
  );

  if (docked) return createPortal(chrome, pinHost!);

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
