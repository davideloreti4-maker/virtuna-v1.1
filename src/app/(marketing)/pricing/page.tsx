import { PricingSection } from "./pricing-section";
import { Footer } from "@/components/layout/footer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing | Numen",
  description:
    "Choose the plan that fits your creator journey. Start with a 7-day free Pro trial.",
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
