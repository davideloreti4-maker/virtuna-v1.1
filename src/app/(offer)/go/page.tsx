import type { Metadata } from "next";
import { HeroShowcase } from "@/components/offer/hero-showcase";
import { FloatingNav } from "@/components/offer/floating-nav";
import { BlurFade } from "@/components/velora/blur-fade";
import { PlatformBar } from "@/components/offer/sections/platform-bar";
import { Transformation } from "@/components/offer/sections/transformation";
import { HowItWorks } from "@/components/offer/sections/how-it-works";
import { ProofMechanism } from "@/components/offer/sections/proof-mechanism";
import { Testimonials } from "@/components/offer/sections/testimonials";
import { Pricing } from "@/components/offer/sections/pricing";
import { Guarantee } from "@/components/offer/sections/guarantee";
import { Faq } from "@/components/offer/sections/faq";
import { FinalCta } from "@/components/offer/sections/final-cta";
import { OfferFooter } from "@/components/offer/sections/footer";
import { StickyCta } from "@/components/offer/sections/sticky-cta";
import { GRAIN_URL } from "@/components/offer/atmosphere";

export const metadata: Metadata = {
  title: "Maven — Know if your video will pop before you post",
  description:
    "Maven simulates how up to 1,000 viewers react to your video, second by second — see the exact moment they'd scroll, and the fix, before you post. Test your first video for $1.",
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
                Maven reads your video frame by frame, then simulates how a
                room of real viewers reacts — so you see the exact moment
                they&apos;d scroll, and the fix, before you ever hit post.
              </p>
            </BlurFade>
            {/* The hero's action IS the composer below — a "$1 → #pricing" button here sent
                the fold's traffic AWAY from the flow (and contradicted "free, no account").
                The dollar belongs to the wall inside the product and to #pricing below. */}
            <BlurFade delay={0.26}>
              <p className="mt-5 text-[13px] text-foreground-muted">
                🔒 Trained on 500 dissected viral videos
              </p>
            </BlurFade>
          </div>

          {/* the flow — the REAL product, live: the entry is the hero */}
          <BlurFade delay={0.2} className="mt-10 md:mt-12">
            <HeroShowcase />
          </BlurFade>
        </div>
      </section>

      {/* The 4-beat walkthrough is UNMOUNTED — retired as the funnel's demo
          (`ONBOARDING-FUNNEL-DESIGN.md` §0b). It is not deleted: the component and its frozen
          fixture stay in the tree as a possible fallback for visitors who will not enter a video.

          It must not ship on this page in the meantime. Its `$1` button fires `checkout_open`
          and returns — `/go` passes no `onCheckout`, because Whop has no keys — so a visitor
          who reached the wall would dead-end at the one moment the page exists to convert.
          (It also mounts `AmbientDetail` in an unbounded-height wrapper, rendering 2,182px
          instead of 800: 3.24 screens on a phone, with that dead button 2.87 screens down.)

          What replaces it is the real platform, run anonymously, gated at the simulation
          verdict — see the handoff. Until that lands, `/go` is the persuasion page it is today. */}

      {/* honest credibility strip, directly under the hero */}
      <PlatformBar />

      {/*
        The persuasion arc, in alternating tone-zones: stakes → mechanism →
        authority → the ask → risk reversal → objections → close.

        Order is a conversion decision, not a list:
        • Pricing sits directly after ProofMechanism. It used to be 6,500px down,
          behind an empty demo band and an empty testimonial grid — a convinced
          visitor had to scroll past two unfinished sections to find the ask.
        • DemoVideo is UNMOUNTED (owner call 2026-07-26): an empty 16:9 slot on
          a paid page is a conversion cost with no offsetting benefit. The
          section stays on disk — when the real walkthrough recording exists,
          remount it just after HowItWorks with `videoSrc` + `poster` — seeing
          the product move belongs before the price.
        • Testimonials moved below the ask too: "we have no quotes yet" was the
          last thing read before the price. After it, the same section reads as an
          invitation to the founding cohort.
      */}
      <Transformation />
      <HowItWorks />
      <ProofMechanism />
      <Pricing />
      <Guarantee />
      <Testimonials />
      <Faq />
      <FinalCta />
      <OfferFooter />

      {/* always-available close — a bottom bar on mobile, a pill on desktop */}
      <StickyCta />
    </main>
  );
}
