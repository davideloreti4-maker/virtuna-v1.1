import type { Metadata } from "next";
import { Hero } from "@/components/landing/hero";
import { Nav } from "@/components/landing/nav";
import { StickyBar } from "@/components/landing/sticky-bar";
import { Logos } from "@/components/landing/sections/logos";
import { Problem } from "@/components/landing/sections/problem";
import { HowItWorks } from "@/components/landing/sections/how-it-works";
import { Features } from "@/components/landing/sections/features";
import { Proof } from "@/components/landing/sections/proof";
import { Testimonials } from "@/components/landing/sections/testimonials";
import { Pricing } from "@/components/landing/sections/pricing";
import { Guarantee } from "@/components/landing/sections/guarantee";
import { Faq } from "@/components/landing/sections/faq";
import { FinalCta, Footer, FounderNote } from "@/components/landing/sections/closing";

export const metadata: Metadata = {
  title: "Maven — Find the second they scroll away, before you post",
  description:
    "Maven simulates how a thousand viewers react to your video second by second, then hands back the exact frame they drop at and the cut that fixes it. $1 for 3 days.",
};

/**
 * /trial — the cold-traffic trial page. Single scroll, one ask ($1), sections
 * ordered as an argument: claim → credibility → pain → mechanism → capability
 * → proof → voices → price → risk → objections → person → ask.
 */
export default function TrialPage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Logos />
        <Problem />
        <HowItWorks />
        <Features />
        <Proof />
        <Testimonials />
        <Pricing />
        <Guarantee />
        <Faq />
        <FounderNote />
        <FinalCta />
      </main>
      <Footer />
      <StickyBar />
    </>
  );
}
