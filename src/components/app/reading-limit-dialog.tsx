"use client";

import { useEffect, useRef, useState } from "react";

import { CheckoutModal } from "@/components/app/checkout-modal";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CreditQuotaExceeded } from "@/lib/billing/quota-error";
import { PLANS, TRIAL, getPlan, isPaidPlanId, creditsLabel, type PaidPlanId } from "@/lib/pricing";
import { useCalibratedAudience } from "@/hooks/use-calibrated-audience";
import { track } from "@/lib/analytics/funnel-events";

/**
 * THE WALL — what a customer sees when their credits are spent.
 *
 * This is the only moment in the product where we take something away, so it is the moment to
 * be precise and generous instead of cryptic. Before this existed, the 402 came back through
 * the stream hook as `new Error(err.error)` and the user read the string
 * `credit_quota_exceeded` in a failure line — indistinguishable from the engine crashing.
 *
 * Six walls, six honest next steps — and they are NOT the same:
 *
 *   · TRIAL SPENT — they have paid us $1 and their plan is about to start. Pushing a second
 *     purchase here would be a way to double-charge a customer who already bought. So the
 *     answer is a date, not a checkout.
 *   · FREE TEST USED (/go, anonymous) — they have had the one run the demo gives. The $1 door,
 *     and the verdict on the run they are looking at is what it opens.
 *   · NEEDS THE TRIAL (/go, anonymous) — they tapped a skill the demo never included. Their
 *     free Test may still be untouched, so this wall must not claim they spent it.
 *   · JUST ACTIVATED — they finished onboarding, spent the one free card the activation
 *     entitlement gives, and are standing at the wall holding a calibrated audience. See below.
 *   · NO PLAN — the $1 trial is the only door in. Offer it.
 *   · PLAN SPENT — offer the next plan up, and say when the current one resets, because
 *     "wait until the 16th" is a perfectly good answer that costs them nothing.
 *   · FAIR-USE (Studio) — there is nothing above them to sell. The answer is a time
 *     (midnight UTC), full stop.
 *
 * ── Why JUST ACTIVATED is its own wall ──────────────────────────────────────────────────────
 * It is the highest-intent moment the product has, and it was being served the most generic
 * copy in the file. A creator who has just spent ~135 seconds watching us read their account,
 * seen ten personas built from it, and read one card written for one of those people, was told:
 * "You don't have a plan yet." That sentence is about US. Everything they have done for the
 * last three minutes is about THEM.
 *
 * Subscription-app paywall research is unusually consistent on this point: surfacing the user's
 * own stated goal in the paywall headline converts meaningfully better than a generic benefits
 * list, and the onboarding paywall — reached at peak motivation, right after setup — carries
 * roughly half of all trial starts. This product has something better than a stated goal: it
 * has ten personas it derived from their real account. So the wall quotes those back.
 *
 * Identified WITHOUT a new reason code, deliberately. The activation entitlement falls through
 * to the ordinary free-tier allowance once spent (lib/billing/quota.ts), which is the right
 * behaviour — an entitlement that no longer applies should be invisible, not a second refusal
 * vocabulary. So the wall recognises the PERSON instead: free tier, no trial history, and a
 * calibrated audience on file. Nobody else can be in that state.
 */

interface ReadingLimitDialogProps {
  quota: CreditQuotaExceeded;
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
  const walled = useRef(false);
  // The NO PLAN wall is reached by two different people: someone who never subscribed, and
  // someone who trialled, converted and cancelled (cancellation returns tier `free` but
  // `trial_used_at` survives it, by design). Only the first is still owed a dollar.
  // This component is dynamically imported and rendered only once a 402 has landed, so the
  // fetch costs nothing until a customer is actually standing at the wall.
  const { trialUsed } = useSubscription();
  // Only read for the personalised branch below; the dialog is dynamically imported and mounts
  // only after a 402, so this fetch costs nothing until someone is actually at the wall.
  const { audience: calibrated } = useCalibratedAudience();

  const plan = isPaidPlanId(quota.tier) ? getPlan(quota.tier) : null;
  const fairUse = quota.reason === "fair_use";
  // The /go funnel visitor who just spent the anonymous demo pool. They are tier `free` with
  // no plan, so without this they fell into the no-plan branch and the dialog opened with
  // "You don't have a plan yet" — a sentence that contradicts its own body ("That was your
  // free test…") and answers a question nobody asked, on a page that spent its whole length
  // promising "free · no account". State what actually happened instead.
  const demo = quota.reason === "demo_used";
  // The same visitor, one step earlier: they tapped something the free demo never included, and
  // their free Test may still be sitting untouched. "That's your free test used" would be false
  // here, and "You don't have a plan yet" answers a question nobody asked — name the situation.
  const trialRequired = quota.reason === "trial_required";
  // No upsell inside a trial (they already paid) and none at the fair-use ceiling (there is
  // nothing above Studio) — those two walls end in a date, never a checkout.
  const upgrade = quota.inTrial || fairUse ? null : nextPlanUp(quota.tier);
  const noPlan = !plan;

  // JUST ACTIVATED — the creator who finished onboarding and spent their one free card. Nobody
  // else can be in this state: a calibrated audience they own, no plan, and no trial history.
  // Anonymous /go visitors are excluded by construction (they reach the `demo`/`trialRequired`
  // walls above, and have no calibrated audience at all).
  const justActivated = noPlan && !trialUsed && !quota.inTrial && !fairUse && Boolean(calibrated);
  const personaCount = calibrated?.personas?.length ?? 0;
  const audienceName = calibrated?.name ?? null;

  // §8's `activation_wall_shown` — the beat between the free card and `checkout_paid`. Fired
  // once per mount and only for the personalised branch, so the ratio it feeds
  // (first_card_shown → activation_wall_shown → checkout_paid) measures this wall specifically
  // rather than every 402 in the product.
  useEffect(() => {
    if (!open || !justActivated || walled.current) return;
    walled.current = true;
    track("activation_wall_shown", { personaCount });
  }, [open, justActivated, personaCount]);

  // The title states the SITUATION; the server's message states the ACTION. Keep them distinct —
  // the no-plan title used to be the server's sentence verbatim, so the dialog said
  // "Start a plan to run a Reading" twice, as its own heading and its own body.
  const title = quota.inTrial
    ? "Your trial credits are spent"
    : fairUse
      ? "That's today's fair-use ceiling"
      : trialRequired
        ? "That one needs the trial"
        : demo
          ? "That's your free test used"
          : justActivated
            ? // Their audience, their numbers. "9 more people" is literally true — the card
              // they just read was written for one of the ten, and the other nine are sitting
              // there uncalibrated-for. It also answers "what do I get" with something they
              // have already seen working, rather than with a feature list.
              personaCount > 1
              ? `${personaCount - 1} more people to write for`
              : "Your audience is ready"
            : noPlan
              ? "You don't have a plan yet"
              : "You're out of credits";

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {/* The server writes this copy, where the tier and the window are known — EXCEPT on
                the activation wall, where the server knows the quota but not the audience, and
                the audience is the whole point. The server's sentence there is the generic
                "start a plan" line, which is what this wall exists to stop saying. */}
            <DialogDescription>
              {justActivated ? (
                <>
                  That card was written for one of the {personaCount || "ten"} people
                  {audienceName ? ` in ${audienceName}’s room` : " in your room"}. The trial opens
                  the rest — every skill, tested against all of them.
                </>
              ) : (
                quota.message
              )}
            </DialogDescription>
          </DialogHeader>

          {/* px-6 to sit on DialogHeader's own p-6 gutter — without it these lines run to the
              dialog's edge while the description above them stays inset. */}
          {((renewsAt && !fairUse) || upgrade) && (
            <div className="space-y-1 px-6 text-sm text-foreground-secondary">
              {/* The fair-use wall resets at midnight UTC (the server's message says so) —
                  the billing renewal date would be the WRONG date to show next to it. */}
              {renewsAt && !fairUse && (
                <p>
                  {quota.inTrial ? (
                    <>
                      Your {plan ? plan.name : "plan"} allowance starts {formatDate(renewsAt)}.
                    </>
                  ) : (
                    <>Your credits reset {formatDate(renewsAt)}.</>
                  )}
                </p>
              )}

              {upgrade && (
                <p>
                  {getPlan(upgrade).name} gives you {creditsLabel(getPlan(upgrade))} for{" "}
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
                {trialUsed
                  ? `Upgrade · ${getPlan("starter").price}/month`
                  : justActivated
                    ? // Benefit-led, not mechanism-led. "Start for $1" names what they pay;
                      // this names what they get, which is the thing they just watched work.
                      `Write for all ${personaCount || 10} — ${TRIAL.price}`
                    : `Start for ${TRIAL.price}`}
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
          // Only a customer with no plan AND no trial history enters through the $1 trial. An
          // existing subscriber upgrading pays the plan price — handing them a second $1 trial
          // would be a free month, and (per the webhook's stamp-once guard) a fresh 5-Reading
          // cap on top. A returning ex-subscriber is in the same position.
          trial={noPlan && !trialUsed}
          onComplete={() => {
            setCheckoutPlan(null);
            onClose();
          }}
        />
      )}
    </>
  );
}
