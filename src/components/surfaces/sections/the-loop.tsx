"use client";

/**
 * TheLoop — "what actually happened": real predicted-vs-actual receipts + an aggregate match %.
 * OUR surface and the moat's proof.
 *
 * NOW REAL (2026-07-06, was mock until the outcome loop shipped): fed the user's recent
 * `reconciliations` via buildLoopReceipts/buildLoopAccuracy (start/page.tsx SSR). Each receipt =
 * the same honest match % + standout the inline capture readout shows (buildOutcomeReadout). No
 * captures yet → an honest empty state pointing at the capture affordance, never fabricated proof.
 */

import type { LoopReceipt, LoopAccuracy } from "@/lib/flywheel/loop-summary";
import { SurfaceIcon } from "../icons";

export function TheLoop({
  receipts,
  accuracy,
}: {
  receipts: LoopReceipt[];
  accuracy: LoopAccuracy | null;
}) {
  return (
    <div className="elev-rest rounded-xl border border-border bg-surface-elevated px-3.5 py-[15px]">
      <h3 className="m-0 mb-2 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
        The loop · what actually happened
      </h3>

      {receipts.length === 0 ? (
        <p className="py-1.5 text-[12.5px] leading-[1.45] text-foreground-muted">
          No posts measured yet. Posted a pre-tested idea? Add its link above — your
          predicted-vs-actual reads land here and sharpen every post.
        </p>
      ) : (
        <>
          {receipts.map((r, i) => (
            <div
              key={r.id}
              className={`flex items-center gap-[11px] py-[11px] ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span
                className="grid size-[22px] shrink-0 place-items-center rounded-full"
                style={{ background: "rgba(142,166,138,0.16)", color: "var(--color-positive)" }}
              >
                <SurfaceIcon name="check" size={12} strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] leading-[1.35] text-foreground">
                  {r.headline ?? "Measured against your prediction"}
                </div>
                <div className="mt-[3px] font-mono text-[10px] text-foreground-muted">
                  measured {r.whenLabel}
                </div>
              </div>
              {r.matchPct != null && (
                <span
                  className="shrink-0 whitespace-nowrap rounded-md border px-[7px] py-[3px] font-mono text-[9.5px]"
                  style={{ color: "var(--color-positive)", borderColor: "rgba(142,166,138,0.34)" }}
                >
                  {r.matchPct}% match
                </span>
              )}
            </div>
          ))}

          {accuracy && (
            <div className="mt-[13px] flex items-center gap-[13px] border-t border-border pt-[13px]">
              <b className="shrink-0 font-serif text-[25px] leading-none text-foreground">
                {accuracy.pct}%
              </b>
              <div className="flex-1 text-[11px] leading-[1.45] text-foreground-secondary">
                Avg match across {accuracy.n} measured {accuracy.n === 1 ? "post" : "posts"} —
                sharper every post.
                {accuracy.trendPts != null && accuracy.trendPts > 0 && (
                  <span
                    className="mt-[3px] inline-flex items-center gap-1 font-mono text-[9.5px]"
                    style={{ color: "var(--color-positive)" }}
                  >
                    <SurfaceIcon name="up" size={9} strokeWidth={2.2} />+{accuracy.trendPts} pts
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
