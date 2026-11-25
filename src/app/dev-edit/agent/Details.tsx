"use client";

/**
 * Details.tsx — the dev's facts (Task 13b): closed, at the very bottom, muted. The last call's rounds, seconds and cost in
 * cents, the calls and cost of all since the page was opened, and what else only a developer asks: that this browser draws the
 * looks close and not exact, that a video's style came from its measures alone. They live here and nowhere else.
 */
import { Fold } from "./Findings";
import type { Session } from "./session";

const cents = (cost: number) => `${cost.toFixed(3)} ¢`;
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function Details({ spent, approximate, unjudged }: { spent: Session["spent"]; approximate: boolean; unjudged: boolean }) {
  const { last } = spent;
  if (!last) return null;
  return (
    <Fold part="details" quiet title="Details">
      <div className="grid gap-1 text-[13px] leading-[18px] text-foreground-muted">
        <p>
          The last call: {count(last.rounds, "round")}, {(last.ms / 1000).toFixed(1)} s, {cents(last.cost)}.
        </p>
        <p>
          In all: {count(spent.calls, "call")}, {cents(spent.cost)}.
        </p>
        {unjudged ? <p>The video&apos;s style was read from its measures alone.</p> : null}
        {approximate ? <p>This browser draws the looks close, not exact.</p> : null}
      </div>
    </Fold>
  );
}
