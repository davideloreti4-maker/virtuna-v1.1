"use client";

/**
 * DayDetail — the selected day's plan. Rendered inline in the desktop right rail and
 * inside the mobile bottom sheet (same card, both breakpoints). Shows the planned
 * post, its pillar, and the DIRECTIONAL forecast (labeled as such — a reserved
 * ambient slot, NEVER a claimed live reaction), plus the one Seam-4 "Make" handoff.
 * Empty days offer an honest "add an idea," never a fabricated plan.
 */

import type { PlannedPost } from "@/lib/room-contract/mock-room";
import { getReadByCardId } from "@/lib/room-contract/mock-room";
import { toneDot, toneLabel } from "@/components/surfaces/tone";

export function DayDetail({
  monthShort,
  day,
  post,
  pillarName,
  onMake,
  onAdd,
}: {
  monthShort: string; // "July"
  day: number;
  post?: PlannedPost;
  pillarName: (pillarId: string) => string;
  onMake: (day: number, post: PlannedPost) => void;
  onAdd: (day: number) => void;
}) {
  const read = post?.cardId ? getReadByCardId(post.cardId) : undefined;

  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
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
              {pillarName(post.pillarId)}
            </span>
          </div>

          {/* Directional forecast — labeled, honest; never a live reaction */}
          <div className="mt-3 rounded-lg border border-border bg-[color:var(--color-surface-thread)] p-2.5">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: toneDot[post.tone] }}
              />
              <span className="text-[12px] font-semibold text-foreground">{toneLabel[post.tone]}</span>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground-secondary">
                pred {post.predicted}/10
              </span>
            </div>
            <p className="mt-1.5 font-mono text-[9px] leading-[1.5] text-foreground-muted">
              Directional forecast — from your room’s patterns, not yet tested. Make it to get the
              real Read.
            </p>
          </div>

          {read && (
            <p className="mt-2.5 text-[11px] leading-[1.5] text-foreground-secondary">
              <b className="font-semibold text-foreground">Known note:</b> {read.fix}
            </p>
          )}

          <button
            type="button"
            onClick={() => onMake(day, post)}
            className="mt-3 w-full rounded-[10px] bg-[color:var(--color-action)] px-3 py-[11px] text-center text-[12.5px] font-semibold text-[color:var(--color-action-foreground)] transition-opacity hover:opacity-90"
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
