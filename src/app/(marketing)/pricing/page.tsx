import { PricingSection } from "./pricing-section";
import { Footer } from "@/components/layout/footer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing | Virtuna",
  description:
    "Choose the plan that fits your creator journey. Start with a 7-day free Pro trial.",
};

export default function PricingPage() {
  return (
    <>
      <main>
        <PricingSection />
        {/* FAQ section removed in Phase 1 (was AS-plagiarized).
            Phase 7 may add a new FAQ here if /pricing needs one. */}
      </main>
      <Footer />
    </>
  );
}
