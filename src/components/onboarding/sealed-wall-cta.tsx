"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckoutModal } from "@/components/app/checkout-modal";
import { ClaimAccountDialog } from "@/components/onboarding/claim-account-dialog";
import { getPlan, TRIAL } from "@/lib/pricing";

/**
 * SealedWallCta — the $1 dressing on the sealed drill (§0b② THE WALL → "$1").
 *
 * Mounts ONLY inside the sealed drill, which only an anonymous session ever receives
 * (verdict-seal.ts strips the verdict server-side), so "the viewer is anonymous" is true by
 * construction here. What is NOT known by construction is whether they already paid:
 * checkout completing and identity linking are two separate steps, and a visitor who paid
 * but bailed on the link must be offered the LINK again, never a second charge. The probe
 * against /api/subscription is that guard — any non-free tier on a sealed (⇒ anonymous)
 * session means "paid, unlinked", and the CTA becomes the claim step directly.
 *
 * The $1 SKU is the Creator trial (§0b③ IS the trial's deal: 50 credits, 3 days); price
 * strings come from the pricing SSOT, never literals.
 */

const PLAN = getPlan("starter");

export function SealedWallCta() {
  // null = probe in flight; the CTA renders immediately as the $1 default and upgrades to
  // the claim step if the probe finds a paid tier — a slow probe must never blank the wall.
  const [paid, setPaid] = useState<boolean>(false);
  const [stage, setStage] = useState<"checkout" | "claim" | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { tier?: string } | null) => {
        if (!cancelled && data?.tier && data.tier !== "free") setPaid(true);
      })
      .catch(() => {
        // Unreachable probe ⇒ keep the $1 default. The checkout route's own one-trial
        // guard is the backstop against a double trial; nothing is charged silently.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-6 flex w-full max-w-[300px] flex-col items-center gap-2.5">
      {paid ? (
        <>
          <Button variant="primary" className="w-full" onClick={() => setStage("claim")}>
            Finish unlocking — link your account
          </Button>
          <p className="text-center text-[12px] leading-relaxed text-foreground/40">
            Your $1 unlock is paid. Linking opens the verdict — same thread, same room.
          </p>
        </>
      ) : (
        <>
          <Button variant="primary" className="w-full" onClick={() => setStage("checkout")}>
            Unlock the simulation — {TRIAL.price}
          </Button>
          <p className="text-center text-[12px] leading-relaxed text-foreground/40">
            {TRIAL.price} for {TRIAL.days} days of {PLAN.name} · {TRIAL.credits} credits,
            then {PLAN.price}
            {PLAN.priceSuffix} — cancel anytime.
          </p>
        </>
      )}

      <CheckoutModal
        open={stage === "checkout"}
        // The modal fires onComplete THEN onClose on a finished payment — this close must
        // only clear ITS stage, or it clobbers the claim step it just advanced to.
        onClose={() => setStage((s) => (s === "checkout" ? null : s))}
        planId="starter"
        trial
        funnel
        heading={`Unlock the simulation — ${TRIAL.price}`}
        subheading={`${TRIAL.price} for ${TRIAL.days} days of ${PLAN.name} · ${TRIAL.credits} credits, then ${PLAN.price}${PLAN.priceSuffix}. Cancel anytime.`}
        onComplete={() => setStage("claim")}
      />
      <ClaimAccountDialog open={stage === "claim"} onClose={() => setStage(null)} />
    </div>
  );
}
