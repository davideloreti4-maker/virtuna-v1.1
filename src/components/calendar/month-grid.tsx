"use client";

/**
 * MonthGrid — the /calendar workspace hero: a Mon-first month grid of REAL planned posts
 * (planned_posts), each cell showing its post (title + format + tone-dot) or an empty
 * add-affordance. Two ways to schedule, both routed through the workspace:
 *   - DRAG a backlog idea (or an already-planned post) onto a day, or
 *   - TAP a backlog idea (placement mode) then tap a day — works on touch.
 * While placing, Maven RINGS its recommended days (recommendedDays heuristic).
 *
 * Honesty spine: the tone-dot is the REAL frozen Flash reaction (personasToCardFace over
 * the snapshotted personas) — never a fabricated reaction. Compact on mobile, expands on `lg`.
 */

import type { PlannedPost } from "@/lib/calendar/planned-plan";
import { monthLayout, WEEKDAY_HEADS } from "@/lib/calendar/month-layout";
import { toneDot } from "@/components/surfaces/tone";
import { cn } from "@/lib/utils";

export function MonthGrid({
  year,
  monthIndex,
  monthShort,
  todayDay,
  plan,
  placing,
  recommended,
  onDropDay,
  onDragStartPost,
  onDragEndPost,
  onTapEmpty,
  onClickPost,
}: {
  year: number;
  monthIndex: number;
  monthShort: string; // "July" — for aria labels
  todayDay: number | null; // null when the viewed month isn't the "today" month
  plan: Record<number, PlannedPost>;
  placing: boolean; // a backlog idea is picked up → empty days become tappable targets
  recommended: number[]; // Maven's suggested days (rings, while placing)
  onDropDay: (day: number) => void; // a card was dropped on this day (schedule or move)
  onDragStartPost: (rowId: string) => void; // a planned post started dragging (move)
  onDragEndPost: () => void;
  onTapEmpty: (day: number) => void; // placement-mode tap on an empty day
  onClickPost: (post: PlannedPost) => void; // open the Room on a planned post
}) {
  const { daysInMonth, lead, trail } = monthLayout(year, monthIndex);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const recSet = new Set(recommended);

  return (
    <div className="rounded-2xl bg-surface-sunken p-2 sm:p-3 sm:pb-3.5">
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
            className="min-h-[46px] rounded-[10px] p-1 text-[11px] text-foreground-muted opacity-40 lg:min-h-[108px]"
          >
            {d}
          </div>
        ))}

        {days.map((day) => {
          const post = plan[day];
          const planned = Boolean(post);
          const isToday = day === todayDay;
          const isRec = placing && recSet.has(day);

          return (
            <div
              key={day}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add("cal-drop-active");
              }}
              onDragLeave={(e) => e.currentTarget.classList.remove("cal-drop-active")}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("cal-drop-active");
                onDropDay(day);
              }}
              onClick={() => {
                if (planned) return; // a planned cell's post handles its own click
                if (placing) onTapEmpty(day);
              }}
              role={placing && !planned ? "button" : undefined}
              aria-label={
                planned
                  ? `${monthShort} ${day}: ${post!.title}`
                  : placing
                    ? `Place on ${monthShort} ${day}${isRec ? " — Maven's pick" : ""}`
                    : `${monthShort} ${day}: no post planned`
              }
              className={cn(
                "group relative flex min-h-[46px] flex-col rounded-[10px] border p-1 text-left transition-colors lg:min-h-[108px] lg:p-1.5 [&.cal-drop-active]:border-[color:var(--color-accent)] [&.cal-drop-active]:bg-[color:var(--color-accent-soft)]",
                planned
                  ? "elev-rest border-border bg-surface-elevated hover:border-border-hover"
                  : isRec
                    ? "cursor-pointer border-dashed border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
                    : placing
                      ? "cursor-pointer border-border bg-[color:var(--color-surface-thread)] hover:border-border-hover"
                      : "border-transparent hover:border-border hover:bg-[color:var(--color-surface-thread)]",
              )}
            >
              <span className="flex items-center justify-between gap-1">
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
                {isRec && (
                  <span className="hidden font-mono text-[8px] uppercase tracking-[0.05em] text-[color:var(--color-accent-text)] lg:inline">
                    ★ pick
                  </span>
                )}
              </span>

              {/* desktop: the planned-post chip (draggable → move; click → Room) */}
              {planned && (
                <button
                  type="button"
                  draggable
                  onClick={(e) => {
                    e.stopPropagation();
                    onClickPost(post!);
                  }}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    onDragStartPost(post!.id);
                  }}
                  onDragEnd={onDragEndPost}
                  className="mt-1 hidden min-w-0 flex-1 cursor-grab flex-col text-left active:cursor-grabbing lg:flex"
                  aria-label={`${post!.title} — open the room, or drag to move`}
                >
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
                    {post!.format} · {post!.face.stop}/10
                  </span>
                </button>
              )}

              {/* desktop: empty-day add affordance (hidden during placement) */}
              {!planned && !placing && (
                <span className="mt-auto hidden font-mono text-[10px] text-foreground-muted opacity-0 transition-opacity group-hover:opacity-100 lg:block">
                  + add
                </span>
              )}
            </div>
          );
        })}

        {trail.map((d) => (
          <div
            key={`trail-${d}`}
            aria-hidden
            className="min-h-[46px] rounded-[10px] p-1 text-[11px] text-foreground-muted opacity-40 lg:min-h-[108px]"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Tone legend — decodes the dots + gives the grid a footer (mirrors the /start widget). */}
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
