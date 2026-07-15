"use client";

import { useState } from "react";

import { CheckoutModal } from "@/components/app/checkout-modal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReadingQuotaExceeded } from "@/lib/billing/quota-error";
import { PLANS, TRIAL, getPlan, isPaidPlanId, readingsLabel, type PaidPlanId } from "@/lib/pricing";

/**
 * THE WALL — what a customer sees when their Readings are spent.
 *
 * This is the only moment in the product where we take something away, so it is the moment to
 * be precise and generous instead of cryptic. Before this existed, the 402 came back through
 * the stream hook as `new Error(err.error)` and the user read the string
 * `reading_quota_exceeded` in a failure line — indistinguishable from the engine crashing.
 *
 * Three walls, three honest next steps — and they are NOT the same:
 *
 *   · TRIAL SPENT — they have paid us $1 and their plan is about to start. Pushing a second
 *     purchase here would be a way to double-charge a customer who already bought. So the
 *     answer is a date, not a checkout.
 *   · NO PLAN — the $1 trial is the only door in. Offer it.
 *   · PLAN SPENT — offer the next plan up, and say when the current one resets, because
 *     "wait until the 16th" is a perfectly good answer that costs them nothing.
 */

interface ReadingLimitDialogProps {
  quota: ReadingQuotaExceeded;
  open: boolean;
  onClose: () => void;
  /** When the allowance resets — the renewal date, or the day a trial converts. */
  renewsAt?: string | null;
}

/** The next plan up from `tier`, or null at the top (Studio) / off-plan. */
function nextPlanUp(tier: string): PaidPlanId | null {
  if (!isPaidPlanId(tier)) return null;
  const i = PLANS.findIndex((p) => p.id === tier);
  const next = PLANS[i + 1];
  return next ? next.id : null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function ReadingLimitDialog({ quota, open, onClose, renewsAt }: ReadingLimitDialogProps) {
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlanId | null>(null);

  const plan = isPaidPlanId(quota.tier) ? getPlan(quota.tier) : null;
  const upgrade = quota.inTrial ? null : nextPlanUp(quota.tier);
  const noPlan = !plan;

  // The title states the SITUATION; the server's message states the ACTION. Keep them distinct —
  // the no-plan title used to be the server's sentence verbatim, so the dialog said
  // "Start a plan to run a Reading" twice, as its own heading and its own body.
  const title = quota.inTrial
    ? "That's your trial's last Reading"
    : noPlan
      ? "You don't have a plan yet"
      : "You're out of Readings";

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {/* The server writes this copy, where the tier and the window are known. */}
            <DialogDescription>{quota.message}</DialogDescription>
          </DialogHeader>

          {/* px-6 to sit on DialogHeader's own p-6 gutter — without it these lines run to the
              dialog's edge while the description above them stays inset. */}
          {(renewsAt || upgrade) && (
            <div className="space-y-1 px-6 text-sm text-foreground-secondary">
              {renewsAt && (
                <p>
                  {quota.inTrial ? (
                    <>
                      Your {plan ? plan.name : "plan"} allowance starts {formatDate(renewsAt)}.
                    </>
                  ) : (
                    <>Your Readings reset {formatDate(renewsAt)}.</>
                  )}
                </p>
              )}

              {upgrade && (
                <p>
                  {/* "Readings" is the product's noun — never lowercased to fit a sentence. */}
                  {getPlan(upgrade).name} gives you {readingsLabel(getPlan(upgrade))} for{" "}
                  {getPlan(upgrade).price}
                  {getPlan(upgrade).priceSuffix}.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              {/* Not "Cancel": nothing is being cancelled — they are going back to the app. */}
              Close
            </Button>

            {noPlan && (
              <Button variant="primary" onClick={() => setCheckoutPlan("starter")}>
                Start for {TRIAL.price}
              </Button>
            )}

            {upgrade && (
              <Button variant="primary" onClick={() => setCheckoutPlan(upgrade)}>
                Upgrade to {getPlan(upgrade).name}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {checkoutPlan && (
        <CheckoutModal
          open={!!checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          planId={checkoutPlan}
          // Only a customer with no plan enters through the $1 trial. An existing subscriber
          // upgrading pays the plan price — handing them a second $1 trial would be a free
          // month, and (per the webhook's stamp-once guard) a fresh 5-Reading cap on top.
          trial={noPlan}
          onComplete={() => {
            setCheckoutPlan(null);
            onClose();
          }}
        />
      )}
    </>
  );
}
