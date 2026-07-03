"use client";

/**
 * TheLoop — "what actually happened": receipts of predicted-vs-actual (we said 7 · you
 * got 7.2) + a rising accuracy figure. This is OUR surface and the moat's proof.
 *
 * ⏸ DEFERRED TO MILESTONE END (owner call 2026-07-03g, handoff §4.4). This renders MOCK
 * receipts/accuracy and stays that way until the end-of-milestone WIRE-OR-REMOVE gate.
 * Reason it can't just be wired: the write path is real (`use-outcome-signature` /
 * `/api/outcomes/signature`), but the numbers this section shows are not derivable from
 * stored data — the receipt scalar ("we said 7") is never persisted (predicted/realized
 * are 6-dim normalized SHARE vectors), and the accuracy % is undefined anywhere. Wiring
 * real receipts = inventing a metric = the still-OPEN contract §6.1 ("don't design it
 * twice"). At milestone end: EITHER wire it (owner metric call + §6.1 ownership + seeded
 * data) OR remove this section for launch. The reconcile → recalibrate half is The Room's.
 */

import type { Accuracy, Receipt } from "@/lib/room-contract/mock-room";
import { SurfaceIcon } from "../icons";

export function TheLoop({ receipts, accuracy }: { receipts: Receipt[]; accuracy: Accuracy }) {
  return (
    <div className="rounded-xl border border-border bg-surface-elevated px-3.5 py-[15px]">
      <h3 className="m-0 mb-2 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
        The loop · what actually happened
      </h3>
      {receipts.map((r, i) => (
        <div key={r.title} className={`flex items-center gap-[11px] py-[11px] ${i > 0 ? "border-t border-border" : ""}`}>
          <span className="grid size-[22px] shrink-0 place-items-center rounded-full" style={{ background: "rgba(142,166,138,0.16)", color: "#8ea68a" }}>
            <SurfaceIcon name="check" size={12} strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] leading-[1.35] text-foreground">{r.title}</div>
            <div className="mt-[3px] font-mono text-[10px] text-foreground-muted">
              <span className="text-foreground-secondary">we said {r.said}</span> ·{" "}
              <span style={{ color: "#8ea68a" }}>you got {r.got}</span> · posted {r.posted}
            </div>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-md border px-[7px] py-[3px] font-mono text-[9.5px]" style={{ color: "#8ea68a", borderColor: "rgba(142,166,138,0.34)" }}>
            {r.delta}
          </span>
        </div>
      ))}
      <div className="mt-[13px] flex items-center gap-[13px] border-t border-border pt-[13px]">
        <b className="shrink-0 font-serif text-[25px] leading-none text-foreground">{accuracy.pct}</b>
        <div className="flex-1 text-[11px] leading-[1.45] text-foreground-secondary">
          {accuracy.line}
          <span className="mt-[3px] inline-flex items-center gap-1 font-mono text-[9.5px]" style={{ color: "#8ea68a" }}>
            <SurfaceIcon name="up" size={9} strokeWidth={2.2} />
            {accuracy.up}
          </span>
        </div>
      </div>
    </div>
  );
}
