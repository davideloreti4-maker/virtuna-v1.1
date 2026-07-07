"use client";

/**
 * UpNext — the /calendar hero strip: the creator's SOONEST planned post, its real
 * predicted reaction (tone + N/10 would-stop + one verbatim reaction), and the two
 * moves — open the Room on its people, or launch a thread to make it. Answers "what's
 * my next post" the moment the page loads. Empty state (nothing scheduled) invites the
 * first plan. Honesty spine: everything shown derives from the post's frozen personas.
 */

import type { PlannedPostRow } from "@/lib/planned-posts/planned-posts-repo";
import { labelWhen } from "@/lib/calendar/planned-plan";
import { personasToCardFace } from "@/lib/surfaces/live-cards";
import { toneDot, toneLabel } from "@/components/surfaces/tone";

export function UpNext({
  next,
  onRoom,
  onMake,
  onPlanFirst,
}: {
  next: PlannedPostRow | null;
  onRoom: (post: PlannedPostRow) => void;
  onMake: (post: PlannedPostRow) => void;
  onPlanFirst: () => void;
}) {
  if (!next) {
    return (
      <div className="elev-rest flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-surface-elevated p-4">
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[14px] font-medium text-foreground">Nothing coming up yet.</p>
          <p className="m-0 mt-0.5 font-mono text-[10px] text-foreground-muted">
            Pick a tested idea, then a day — Maven suggests the slot that keeps your rhythm.
          </p>
        </div>
        <button
          type="button"
          onClick={onPlanFirst}
          className="rounded-[10px] bg-[color:var(--color-action)] px-3.5 py-[9px] text-[12.5px] font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90"
        >
          Plan your next post →
        </button>
      </div>
    );
  }

  const face = personasToCardFace(next.personas);
  const { md, dow } = labelWhen(next.scheduled_date);
  const quote = face.lead;

  return (
    <div className="elev-rest flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-border bg-surface-elevated p-4">
      <div className="flex shrink-0 flex-col gap-0.5 border-r border-border pr-4">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[color:var(--color-accent-text)]">
          Up next
        </span>
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-foreground">{md}</span>
        <span className="font-mono text-[9px] text-foreground-muted">{dow}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="m-0 text-[14px] font-medium leading-[1.3] text-foreground">{next.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-foreground-secondary">
          <span
            aria-hidden
            className="size-[7px] shrink-0 rounded-full"
            style={{ background: toneDot[face.tone] }}
          />
          <span>
            {toneLabel[face.tone]} · {face.stop}/10 would stop
          </span>
          {quote && (
            <span className="italic text-foreground-muted">— “{quote}”</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => onRoom(next)}
          className="rounded-[10px] border border-border px-3 py-[9px] text-[12px] text-foreground transition-colors hover:border-border-hover hover:bg-[color:var(--color-surface-thread)]"
        >
          See the room
        </button>
        <button
          type="button"
          onClick={() => onMake(next)}
          className="rounded-[10px] bg-[color:var(--color-action)] px-3.5 py-[9px] text-[12px] font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90"
        >
          Make it →
        </button>
      </div>
    </div>
  );
}
