"use client";

/**
 * DayDetail — the selected day's plan. Rendered inline in the desktop right rail and inside the
 * mobile bottom sheet (same card, both breakpoints). Shows the planned post, its format, and the
 * REAL pre-tested reaction — tone + N/10 would stop + one real reaction verbatim (from the idea's
 * Flash personas, personasToCardFace). "See the room" opens the actual AmbientRoom on those
 * personas; "Make for this day" is the Seam-4 handoff. Empty days offer an honest "add an idea".
 *
 * Honesty upgrade: the day's score is a REAL reaction ("pre-tested on your people"), not the old
 * "Directional forecast — not yet tested" — because the idea IS simmed against the audience.
 */

import type { LivePlannedPost } from "@/lib/surfaces/month-plan";
import { toneDot, toneLabel } from "@/components/surfaces/tone";

export function DayDetail({
  monthShort,
  day,
  post,
  onMake,
  onAdd,
  onOpenRoom,
}: {
  monthShort: string; // "July"
  day: number;
  post?: LivePlannedPost;
  onMake: (day: number, post: LivePlannedPost) => void;
  onAdd: (day: number) => void;
  onOpenRoom: (contentId: string) => void;
}) {
  return (
    <div className="elev-rest rounded-xl border border-border bg-surface p-3.5">
      <div className="mb-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-muted">
          {monthShort} {day}
        </div>
        <h3 className="mt-0.5 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
          {post ? "Planned post" : "Nothing planned"}
        </h3>
      </div>

      {post ? (
        <>
          <p className="text-[13px] leading-[1.4] text-foreground">{post.title}</p>
          <div className="mt-2">
            <span className="inline-flex rounded-[4px] border border-border px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.04em] text-foreground-muted">
              {post.type}
            </span>
          </div>

          {/* Real reaction — pre-tested on the user's people (never a fabricated forecast). */}
          <div className="mt-3 rounded-lg border border-border bg-[color:var(--color-surface-thread)] p-2.5">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: toneDot[post.face.tone] }}
              />
              <span className="text-[12px] font-semibold text-foreground">{toneLabel[post.face.tone]}</span>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground-secondary">
                {post.face.stop}/10 would stop
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[9px] leading-[1.5] text-foreground-muted">
              Pre-tested on your people — {post.face.fraction}. Tap in to hear them.
            </p>
          </div>

          {post.face.lead && (
            <p className="mt-2.5 text-[11px] leading-[1.5] text-foreground-secondary">
              <b className="font-semibold text-foreground">One of them:</b> “{post.face.lead}”
            </p>
          )}

          <button
            type="button"
            onClick={() => onOpenRoom(post.contentId)}
            className="mt-3 w-full rounded-[10px] border border-border px-3 py-[10px] text-center text-[12.5px] text-foreground transition-colors hover:border-border-hover hover:bg-[color:var(--color-surface-thread)]"
          >
            See the room →
          </button>
          <button
            type="button"
            onClick={() => onMake(day, post)}
            className="mt-2 w-full rounded-[10px] bg-[color:var(--color-action)] px-3 py-[11px] text-center text-[12.5px] font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90"
          >
            Make for this day →
          </button>
        </>
      ) : (
        <>
          <p className="text-[12.5px] leading-[1.5] text-foreground-secondary">
            No post planned for {monthShort} {day}.
          </p>
          <p className="mt-1 font-mono text-[9px] text-foreground-muted">
            Plan one — Maven pre-tests it on your people before you post.
          </p>
          <button
            type="button"
            onClick={() => onAdd(day)}
            className="mt-3 w-full rounded-[10px] border border-border px-3 py-[10px] text-center text-[12.5px] text-foreground transition-colors hover:border-border-hover hover:bg-[color:var(--color-surface-thread)]"
          >
            Add an idea →
          </button>
        </>
      )}
    </div>
  );
}
