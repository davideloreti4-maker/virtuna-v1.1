"use client";

/**
 * TodaysPlan — the planned posts with their predicted score, plus an "Add a new idea"
 * affordance that seeds the composer. Each planned row is a door to the Room.
 */

import type { PlanItem } from "@/lib/room-contract/mock-room";
import { toneDot } from "../tone";
import { SurfaceIcon } from "../icons";

export function TodaysPlan({
  plan,
  onOpen,
  onAdd,
}: {
  plan: PlanItem[];
  onOpen: (cardId: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated px-3.5 py-[15px]">
      <h3 className="m-0 mb-1.5 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Today’s plan</h3>
      {plan.map((p, i) => (
        <button
          key={p.cardId}
          type="button"
          onClick={() => onOpen(p.cardId)}
          className={`flex w-full items-center gap-2.5 py-[11px] text-left ${i > 0 ? "border-t border-border" : ""}`}
        >
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: toneDot[p.tone] }} />
          <span className="flex-1 text-[12.5px] text-foreground">{p.title}</span>
          <span className="font-mono text-[10px] text-foreground-muted">
            {p.day} · pred {p.predicted}/10
          </span>
        </button>
      ))}
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
