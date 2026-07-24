import type { Metadata } from "next";
import { HeroShowcase } from "@/components/offer/hero-showcase";
import { FloatingNav } from "@/components/offer/floating-nav";
import { BlurFade } from "@/components/velora/blur-fade";
import { PrimaryCta } from "@/components/offer/cta-config";
import { PlatformBar } from "@/components/offer/sections/platform-bar";
import { Transformation } from "@/components/offer/sections/transformation";
import { DemoVideo } from "@/components/offer/sections/demo-video";
import { HowItWorks } from "@/components/offer/sections/how-it-works";
import { ProofMechanism } from "@/components/offer/sections/proof-mechanism";
import { Testimonials } from "@/components/offer/sections/testimonials";
import { Pricing } from "@/components/offer/sections/pricing";
import { Guarantee } from "@/components/offer/sections/guarantee";
import { Faq } from "@/components/offer/sections/faq";
import { FinalCta } from "@/components/offer/sections/final-cta";
import { OfferFooter } from "@/components/offer/sections/footer";
import { StickyCta } from "@/components/offer/sections/sticky-cta";
import { Walkthrough } from "@/components/offer/walkthrough/walkthrough";
import { GRAIN_URL } from "@/components/offer/atmosphere";

export const metadata: Metadata = {
  title: "Maven — Know if your video will pop before you post",
  description:
    "Maven simulates how 1,000 viewers react to your video, second by second — see the exact moment they'd scroll, and the fix, before you post. Test your first video for $1.",
};

/**
 * /go — the cold-traffic offer page (paid social → this).
 * A floating premium brand island + the interactive hero, then the persuasion
 * arc (transformation → pricing → FAQ → CTA).
 */
export default function OfferPage() {
  return (
    <main>
      {/* floating premium brand island — centered, detached, scroll-aware */}
      <FloatingNav />

      {/* hero */}
      <section className="relative overflow-hidden">
        {/* atmosphere — layered matte depth (wash + dot-grid + soft blooms + grain), never glass */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* warm top wash */}
          <div
            className="absolute inset-x-0 top-0 h-[70%]"
            style={{ background: "linear-gradient(180deg,rgba(255,143,112,0.05),transparent 62%)" }}
          />
          {/* dot grid, fading toward the edges */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px,rgba(236,231,222,0.05) 1px,transparent 0)",
              backgroundSize: "24px 24px",
              maskImage: "radial-gradient(120% 80% at 50% 0%,#000 28%,transparent 76%)",
              WebkitMaskImage: "radial-gradient(120% 80% at 50% 0%,#000 28%,transparent 76%)",
            }}
          />
          {/* coral bloom, top-right (the one warm accent) */}
          <div
            className="absolute -top-40 right-[-12%] h-[560px] w-[560px] rounded-full opacity-[0.13] blur-[140px]"
            style={{ background: "radial-gradient(circle,#FF6363,transparent 70%)" }}
          />
          {/* neutral-warm bloom, bottom-left — balances the composition */}
          <div
            className="absolute bottom-[-28%] left-[-14%] h-[520px] w-[520px] rounded-full opacity-[0.07] blur-[150px]"
            style={{ background: "radial-gradient(circle,#ffb27a,transparent 70%)" }}
          />
          {/* film grain */}
          <div
            className="absolute inset-0 opacity-[0.03] mix-blend-soft-light"
            style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: "140px 140px" }}
          />
          {/* settle into the page below */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-24 md:pb-16 md:pt-28">
          {/* copy — the promise, above the two-surface showcase */}
          <div className="mx-auto max-w-2xl text-center">
            <BlurFade delay={0.05}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Stop posting blind
              </span>
            </BlurFade>
            <BlurFade delay={0.12}>
              <h1 className="mt-3 font-serif text-[clamp(2.3rem,5.2vw,3.6rem)] font-medium leading-[1.05] tracking-tight text-balance">
                Know if your video will pop —{" "}
                <span className="italic text-accent-text">before</span> you post
                it.
              </h1>
            </BlurFade>
            <BlurFade delay={0.19}>
              <p className="mx-auto mt-4 max-w-[46ch] text-[17px] leading-relaxed text-foreground-secondary">
                Maven reads your video frame by frame, then simulates how 1,000
                real viewers react — so you see the exact moment they&apos;d
                scroll, and the fix, before you ever hit post.
              </p>
            </BlurFade>
            <BlurFade delay={0.26}>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <PrimaryCta href="#pricing" size="lg">
                  Test your first video — $1
                </PrimaryCta>
                <span className="text-[13px] text-foreground-muted">
                  $1 for 3 days · cancel anytime
                </span>
              </div>
            </BlurFade>
            <BlurFade delay={0.33}>
              <p className="mt-6 text-[13px] text-foreground-muted">
                🔒 Trained on 500 dissected viral videos
              </p>
            </BlurFade>
          </div>

          {/* the wow — the REAL product, live: craft card BESIDE the room */}
          <BlurFade delay={0.2} className="mt-12 md:mt-16">
            <HeroShowcase />
          </BlurFade>
        </div>
      </section>

      {/* S1 — the interactive walkthrough. Sits directly under the hero on purpose: the
          time-to-aha budget is ~10s to the first insight and ~45s to the wall, and a demo
          buried below four persuasion sections cannot meet it. Renders null in production
          while the fixture is placeholder data (see `walkthroughEnabled`). */}
      <section className="relative px-5 py-14 md:py-20">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            Try it on a real video
          </span>
          <h2 className="mt-3 font-serif text-[clamp(1.8rem,4vw,2.6rem)] font-medium leading-[1.1] tracking-tight text-balance">
            This is the actual product, not a screenshot.
          </h2>
        </div>
        <Walkthrough />
      </section>

      {/* honest credibility strip, directly under the hero */}
      <PlatformBar />

      {/* the rest of the page — the persuasion arc, in alternating tone-zones */}
      <Transformation />
      <DemoVideo />
      <HowItWorks />
      <ProofMechanism />
      <Testimonials />
      <Pricing />
      <Guarantee />
      <Faq />
      <FinalCta />
      <OfferFooter />

      {/* always-available mobile close */}
      <StickyCta />
    </main>
  );
}
