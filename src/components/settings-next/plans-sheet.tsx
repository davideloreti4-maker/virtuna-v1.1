"use client";

import * as React from "react";
import { useRef, useState } from "react";

import { SheetShell } from "@/components/discover-next/sheet-shell";
import { Button } from "@/components/ui/button";
import { PLANS, type PaidPlanId } from "@/lib/pricing";
import { cn } from "@/lib/utils";

import { arrowTarget } from "./radio-keys";
import { PLANS_TITLE, planCredits, startPlanLabel, startPlanLine } from "./settings-words";

/**
 * See plans (spec 2026-11-26-settings-design 5; drawing frame 7): "Choose a plan", the three plans as
 * one radio group (name, credits, price, from `PLANS`), Creator chosen first, and the ink button that
 * starts the chosen one: for $1 while the trial is unused, else at the plan's price. Presentational:
 * the button hands the plan's id and the trial on (the container opens Whop's checkout) and the sheet
 * closes. Offered only with no plan; a running plan is changed on Whop.
 *
 * - Each opening starts on Creator (the choice mounts with the open sheet).
 * - The arrows move the choice, as a radio group's do; the chosen radio is the one Tab stop.
 * - The chosen plan is marked by a heavier outline, and by `aria-checked`.
 */
export interface PlansSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  /** The $1 trial has not been used: the button starts it. */
  trialAvailable: boolean;
  onStartPlan(planId: PaidPlanId, trial: boolean): void;
  /** Where the focus goes on close when what opened the sheet has left the page. */
  returnFocus?: () => HTMLElement | null;
}

function PlanChoice({ trialAvailable, onStart }: { trialAvailable: boolean; onStart(planId: PaidPlanId): void }) {
  const [at, setAt] = useState(0);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  // A closing sheet stays pressable through its exit: a second press there starts nothing more.
  const started = useRef(false);
  const plan = PLANS[at];
  if (!plan) return null;

  return (
    <>
      <div role="radiogroup" aria-label={PLANS_TITLE} className="mt-4 flex flex-col gap-2">
        {PLANS.map((each, index) => {
          const on = index === at;
          return (
            <button
              key={each.id}
              ref={(el) => {
                radios.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setAt(index)}
              onKeyDown={(e) => {
                const next = arrowTarget(e.key, index, PLANS.length);
                if (next === null) return;
                e.preventDefault();
                setAt(next);
                radios.current[next]?.focus();
              }}
              className={cn(
                "flex min-h-16 w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left",
                on ? "shadow-[inset_0_0_0_2px_var(--color-foreground)]" : "shadow-[inset_0_0_0_1px_var(--color-border-hover)]",
              )}
            >
              {/* The spaces keep the radio's name "Creator 500 credits a month $49", not run together. */}
              <span className="min-w-0 flex-1">
                <span className="block text-title font-[640] text-foreground">{each.name}</span>{" "}
                <span className="block text-meta text-foreground-secondary">{planCredits(each)}</span>
              </span>{" "}
              <span className="shrink-0 text-ui font-bold text-foreground">{each.price}</span>
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={() => {
          if (started.current) return;
          started.current = true;
          onStart(plan.id);
        }}
        className="mt-3 w-full next:rounded-full"
      >
        {startPlanLabel(plan, trialAvailable)}
      </Button>
      <p className="mt-2.5 text-center text-meta text-foreground-secondary">{startPlanLine(plan, trialAvailable)}</p>
    </>
  );
}

export function PlansSheet({ open, onOpenChange, trialAvailable, onStartPlan, returnFocus }: PlansSheetProps): React.JSX.Element {
  return (
    <SheetShell open={open} onOpenChange={onOpenChange} title={PLANS_TITLE} returnFocus={returnFocus}>
      <PlanChoice
        trialAvailable={trialAvailable}
        onStart={(planId) => {
          onStartPlan(planId, trialAvailable);
          onOpenChange(false);
        }}
      />
    </SheetShell>
  );
}
