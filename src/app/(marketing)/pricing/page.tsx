import { PricingSection } from "./pricing-section";
import { Footer } from "@/components/layout/footer";
import { TRIAL } from "@/lib/pricing";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/**
 * The description is BUILT from `TRIAL`, not typed out, because the typed-out version was wrong
 * in both of its claims: it promised "a 7-day free Pro trial" against a trial that is $1 and
 * runs 3 days. Every visible surface on this page already reads `TRIAL` and was correct — the
 * FAQ, the CTA, the microcopy — so the stale copy survived in the one string the page never
 * renders and nobody re-reads. It is also the string with the widest reach: metadata is what a
 * search result and a shared link show, so it reaches people who never open the page.
 *
 * The rule this page enforces everywhere else applies here too: promising a price the checkout
 * then refuses is the chargeback shape `lib/billing/trial-eligibility` exists to avoid. Deriving
 * from the constant means the next change to the trial's terms cannot leave this behind.
 */
export const metadata: Metadata = {
  title: "Pricing | Maven",
  description: `Choose the plan that fits your creator journey. Every plan starts at ${TRIAL.price} for ${TRIAL.days} days, then renews at the plan price unless you cancel.`,
};

export default function PricingPage() {
  return (
    <>
      <main>
        <PricingSection />
      </main>
      <Footer />
    </>
  );
}
