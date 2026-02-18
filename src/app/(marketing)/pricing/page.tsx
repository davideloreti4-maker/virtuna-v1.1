import { PricingSection } from "./pricing-section";
import { Footer } from "@/components/layout/footer";
import { FAQSection } from "@/components/landing";
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
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
