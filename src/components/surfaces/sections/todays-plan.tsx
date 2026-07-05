"use client";

/**
 * TodaysPlan — the upcoming planned posts (the real pre-tested ideas projected onto days;
 * see month-plan.ts), each with its REAL headline reaction (N/10 would stop) and a door to
 * the Room. "Add a new idea" seeds the composer. Empty (a cold/failed warm) → honest nudge.
 *
 * The score is real (pre-tested on the user's people), not a fabricated "predicted" — so the
 * row reads "N/10 would stop", matching the Room that opens when you tap it.
 */

import type { LivePlannedPost } from "@/lib/surfaces/month-plan";
import { toneDot } from "../tone";
import { SurfaceIcon } from "../icons";

/** "Wed 8" — deterministic from the server-passed (year, monthIndex, day); SSR-safe. */
function dayLabel(year: number, monthIndex: number, day: number): string {
  const weekday = new Date(year, monthIndex, day).toLocaleDateString("en-US", { weekday: "short" });
  return `${weekday} ${day}`;
}

export function TodaysPlan({
  plan,
  year,
  monthIndex,
  onOpen,
  onAdd,
}: {
  plan: LivePlannedPost[];
  year: number;
  monthIndex: number; // 0-based
  onOpen: (contentId: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="elev-rest rounded-xl border border-border bg-surface-elevated px-3.5 py-[15px]">
      <h3 className="m-0 mb-1.5 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Your plan</h3>
      {plan.length === 0 ? (
        <p className="py-2 text-[12.5px] leading-[1.5] text-foreground-muted">
          Nothing planned yet — today’s pre-tested ideas will slot in here.
        </p>
      ) : (
        plan.map((p, i) => (
          <button
            key={p.contentId}
            type="button"
            onClick={() => onOpen(p.contentId)}
            className={`flex w-full items-center gap-2.5 py-[11px] text-left ${i > 0 ? "border-t border-border" : ""}`}
          >
            <span aria-hidden className="mt-[3px] size-2 shrink-0 self-start rounded-full" style={{ background: toneDot[p.face.tone] }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] text-foreground">{p.title}</span>
              <span className="mt-[3px] inline-block rounded-[4px] border border-border px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.04em] text-foreground-muted">
                {p.type}
              </span>
            </span>
            <span className="shrink-0 self-start text-right font-mono text-[10px] text-foreground-muted">
              {dayLabel(year, monthIndex, p.day)}
              <span className="mt-px block tabular-nums text-foreground-secondary">{p.face.stop}/10 stop</span>
            </span>
          </button>
        ))
      )}
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 flex w-full items-center justify-center gap-[7px] rounded-[11px] border border-dashed border-border-hover px-3 py-3 text-[12.5px] text-foreground-secondary transition-colors hover:border-foreground-muted hover:bg-[color:var(--color-surface-thread)]"
      >
        <SurfaceIcon name="plus" size={13} />
        Add a new idea
      </button>
    </div>
  );
}
