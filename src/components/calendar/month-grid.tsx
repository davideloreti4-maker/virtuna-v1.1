"use client";

/**
 * MonthGrid — the /calendar workspace hero: a full Mon-first month grid where each
 * planned day shows its post (title + format tag + tone-dot) and empty days offer an
 * add affordance. Compact on mobile (day + dot → tap opens the day sheet); expands to
 * content-bearing cells on `lg`. Shares `monthLayout` + `toneDot` with the glanceable
 * /start widget so both read as the same object.
 *
 * Honesty spine: the tone-dot is the REAL pre-tested reaction (personasToCardFace over
 * the idea's Flash personas) projected onto a suggested day — never a fabricated reaction.
 */

import type { LivePlannedPost } from "@/lib/surfaces/month-plan";
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
}: {
  year: number;
  monthIndex: number;
  monthShort: string; // "July" — for aria labels
  todayDay: number | null; // null when the viewed month isn't the "today" month
  plan: Record<number, LivePlannedPost>;
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
}) {
  const { daysInMonth, lead, trail } = monthLayout(year, monthIndex);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="rounded-2xl bg-[#252320] p-2 sm:p-3 sm:pb-3.5">
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
                  ? "elev-rest border-border-hover bg-surface-elevated ring-1 ring-inset ring-white/[0.10]"
                  : planned
                    ? "elev-rest border-border bg-surface-elevated hover:border-border-hover"
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
                    style={{ background: toneDot[post!.face.tone] }}
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
                      style={{ background: toneDot[post!.face.tone] }}
                    />
                    <span className="line-clamp-2 text-[11px] leading-[1.25] text-foreground">
                      {post!.title}
                    </span>
                  </span>
                  <span className="mt-auto w-fit max-w-full truncate font-mono text-[8px] uppercase tracking-[0.04em] text-foreground-muted/75">
                    {post!.type} · {post!.face.stop}/10
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

      {/* Tone legend — decodes the Directional dots + gives the grid a footer (mirrors the
          /start month widget), so the hero doesn't end on a bare edge. */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1 border-t border-border/70 pt-3 font-mono text-[9px] text-foreground-muted">
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
        <span className="text-foreground-muted/70">· pre-tested on your people</span>
      </div>
    </div>
  );
}
