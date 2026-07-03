"use client";

/**
 * MonthGrid — the /calendar workspace hero: a full Mon-first month grid where each
 * planned day shows its post (title + pillar tag + Directional tone-dot) and empty
 * days offer an add affordance. Compact on mobile (day + dot → tap opens the day
 * sheet); expands to content-bearing cells on `lg`. Shares `monthLayout` + `toneDot`
 * with the glanceable /start widget so both read as the same object.
 *
 * Honesty spine: the tone-dot is a DIRECTIONAL forecast (a reserved ambient slot),
 * never a fabricated live reaction on an unposted draft.
 */

import type { PlannedPost } from "@/lib/room-contract/mock-room";
import { monthLayout, WEEKDAY_HEADS } from "@/lib/calendar/month-layout";
import { toneDot } from "@/components/surfaces/tone";
import { cn } from "@/lib/utils";

export function MonthGrid({
  year,
  monthIndex,
  monthShort,
  todayDay,
  plan,
  selectedDay,
  onSelectDay,
  pillarName,
}: {
  year: number;
  monthIndex: number;
  monthShort: string; // "July" — for aria labels
  todayDay: number | null; // null when the viewed month isn't the "today" month
  plan: Record<number, PlannedPost>;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
  pillarName: (pillarId: string) => string;
}) {
  const { daysInMonth, lead, trail } = monthLayout(year, monthIndex);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-2 sm:p-3">
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAY_HEADS.map((h) => (
          <div
            key={h}
            className="pb-1 text-center font-mono text-[9.5px] font-medium uppercase tracking-[0.06em] text-foreground-muted"
          >
            <span className="sm:hidden">{h.slice(0, 1)}</span>
            <span className="hidden sm:inline">{h}</span>
          </div>
        ))}

        {lead.map((d) => (
          <div
            key={`lead-${d}`}
            aria-hidden
            className="min-h-[46px] rounded-[10px] p-1 text-[11px] text-foreground-muted opacity-40 lg:min-h-[104px]"
          >
            {d}
          </div>
        ))}

        {days.map((day) => {
          const post = plan[day];
          const planned = Boolean(post);
          const isToday = day === todayDay;
          const isSelected = day === selectedDay;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-pressed={isSelected}
              aria-label={
                planned
                  ? `${monthShort} ${day}: ${post!.title}`
                  : `${monthShort} ${day}: no post planned — add one`
              }
              className={cn(
                "group relative flex min-h-[46px] flex-col rounded-[10px] border p-1 text-left transition-colors lg:min-h-[104px] lg:p-1.5",
                isSelected
                  ? "border-border-hover bg-[color:var(--color-surface-thread)]"
                  : "border-transparent hover:border-border hover:bg-[color:var(--color-surface-thread)]",
              )}
            >
              <span className="flex items-center gap-1">
                <span
                  className={cn(
                    "grid size-[19px] place-items-center rounded-full text-[11px] [font-variant-numeric:tabular-nums] lg:size-[21px] lg:text-[12px]",
                    isToday
                      ? "bg-[color:var(--color-action)] font-bold text-[color:var(--color-action-foreground)]"
                      : "text-foreground-secondary",
                  )}
                >
                  {day}
                </span>
                {planned && (
                  <span
                    aria-hidden
                    className="size-[6px] shrink-0 rounded-full lg:hidden"
                    style={{ background: toneDot[post!.tone] }}
                  />
                )}
              </span>

              {/* desktop: the planned-post chip */}
              {planned && (
                <span className="mt-1 hidden min-w-0 flex-1 flex-col lg:flex">
                  <span className="flex items-start gap-1">
                    <span
                      aria-hidden
                      className="mt-[5px] size-[6px] shrink-0 rounded-full"
                      style={{ background: toneDot[post!.tone] }}
                    />
                    <span className="line-clamp-2 text-[11px] leading-[1.25] text-foreground">
                      {post!.title}
                    </span>
                  </span>
                  <span className="mt-auto inline-flex w-fit rounded-[4px] border border-border px-1 py-px font-mono text-[8.5px] uppercase tracking-[0.04em] text-foreground-muted">
                    {pillarName(post!.pillarId)}
                  </span>
                </span>
              )}

              {/* desktop: empty-day add affordance (hover-revealed) */}
              {!planned && (
                <span className="mt-auto hidden font-mono text-[10px] text-foreground-muted opacity-0 transition-opacity group-hover:opacity-100 lg:block">
                  + add
                </span>
              )}
            </button>
          );
        })}

        {trail.map((d) => (
          <div
            key={`trail-${d}`}
            aria-hidden
            className="min-h-[46px] rounded-[10px] p-1 text-[11px] text-foreground-muted opacity-40 lg:min-h-[104px]"
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}
