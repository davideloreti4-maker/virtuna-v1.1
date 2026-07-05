"use client";

/**
 * MonthCalendar — the glanceable /start month widget: a Mon-first grid with a predicted-tone
 * dot on each planned day. Right rail on desktop, stacked card on mobile. The dots come from
 * the REAL plan (the day's pre-tested ideas projected onto upcoming days — see month-plan.ts),
 * so the widget agrees with the full /calendar workspace. Tapping a day deep-links to /calendar.
 *
 * Geometry (lead/trail) is computed from `monthLayout(year, monthIndex)` — never hardcoded — so
 * the widget renders correctly for any month, not just the one it shipped on.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { WidgetDay } from "@/lib/surfaces/month-plan";
import { monthLayout } from "@/lib/calendar/month-layout";
import { toneDot } from "../tone";
import { cn } from "@/lib/utils";

const DAY_HEADS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function MonthCalendar({
  month,
  year,
  monthIndex,
  today,
  days,
  onEmptyDay,
  onPlannedDay,
}: {
  month: string;
  year: number;
  monthIndex: number; // 0-based
  today: number;
  days: WidgetDay[];
  onEmptyDay: (day: number) => void;
  onPlannedDay: (day: number) => void;
}) {
  const { lead, trail } = monthLayout(year, monthIndex);
  const plannedCount = days.filter((c) => c.tone).length;
  return (
    <div className="elev-rest rounded-xl border border-border bg-surface-elevated px-3.5 py-[15px]">
      <div className="mb-[13px] flex items-center gap-1.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold tracking-[-0.01em] text-foreground">{month}</span>
          <span className="mt-px block font-mono text-[9.5px] text-foreground-muted">
            {plannedCount > 0 ? `${plannedCount} planned · pre-tested` : "nothing planned yet"}
          </span>
        </span>
        <button type="button" aria-label="Previous month" className="grid size-6 place-items-center rounded-md border border-border text-foreground-secondary transition-colors hover:border-border-hover hover:bg-[color:var(--color-surface-thread)]">
          <ChevronLeft className="size-[13px]" />
        </button>
        <button type="button" aria-label="Next month" className="grid size-6 place-items-center rounded-md border border-border text-foreground-secondary transition-colors hover:border-border-hover hover:bg-[color:var(--color-surface-thread)]">
          <ChevronRight className="size-[13px]" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 gap-y-1">
        {DAY_HEADS.map((h) => (
          <div key={h} className="pb-1.5 text-center font-mono text-[9.5px] font-medium text-foreground-muted">
            {h}
          </div>
        ))}
        {lead.map((d) => (
          <div key={`lead-${d}`} className="grid aspect-square place-items-center rounded-[9px] text-[12px] text-foreground-muted opacity-50">
            {d}
          </div>
        ))}
        {days.map((c) => {
          const isToday = c.day === today;
          const planned = Boolean(c.tone);
          return (
            <button
              key={c.day}
              type="button"
              onClick={() => (planned ? onPlannedDay(c.day) : onEmptyDay(c.day))}
              className={cn(
                "relative grid aspect-square place-items-center rounded-[9px] text-[12px] transition-colors [font-variant-numeric:tabular-nums]",
                isToday
                  ? "bg-[color:var(--color-action)] font-bold text-[color:var(--color-action-foreground)]"
                  : "text-foreground-secondary hover:bg-[color:var(--color-surface-thread)]",
              )}
            >
              {c.day}
              {c.tone && (
                <span
                  aria-hidden
                  className="absolute bottom-[5px] size-[5px] rounded-full"
                  style={{ background: isToday ? "var(--color-action-foreground)" : toneDot[c.tone] }}
                />
              )}
            </button>
          );
        })}
        {trail.map((d) => (
          <div key={`trail-${d}`} className="grid aspect-square place-items-center rounded-[9px] text-[12px] text-foreground-muted opacity-50">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-3.5 flex justify-center gap-3.5 border-t border-border pt-3 font-mono text-[9px] text-foreground-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: toneDot.loved }} />
          predicted win
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: toneDot.bounced }} />
          risky
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: toneDot.neutral }} />
          neutral
        </span>
      </div>
    </div>
  );
}
