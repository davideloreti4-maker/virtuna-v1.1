import type { Metadata } from "next";
import { HeroShowcase } from "@/components/offer/hero-showcase";
import { OutcomeReceipt } from "@/components/offer/outcome-receipt";
import { FreeEntryCta } from "@/components/offer/free-entry-cta";
import { FREE_ENTRY } from "@/components/offer/cta-config";
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
import { GRAIN_URL } from "@/components/offer/atmosphere";

export const metadata: Metadata = {
  title: "Maven — Know if your video will pop before you post",
  description:
    "Maven simulates how up to 1,000 viewers react to your video, second by second — see the exact moment they'd scroll, and the fix, before you post. Your first test is free, no account.",
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

        {/* Fold budget is tight and load-bearing: the receipt's two tiles are ~300px, and at the
            previous rhythm the CTA measured BELOW the fold on a 1512×860 MacBook and on a 390×844
            phone — the page's one ask, off screen. Verified back above the fold on both. */}
        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-16 md:pb-16 md:pt-20">
          {/* copy — the OUTCOME, which is the fold's whole job (owner call 2026-07-27).
              The fold used to lead with the mechanism ("a room of simulated viewers
              watches your video") over a live composer. Two problems: it asked a cold
              visitor to go find a video and wait a minute before anything happened, and
              the composer's empty state communicated nothing about what comes back. The
              fold now sells what the product DID — one real video, the same cut twice —
              and the entry is a button. The mechanism moves to the probe below, where a
              visitor can watch it instead of read it. */}
          <div className="mx-auto max-w-2xl text-center">
            <BlurFade delay={0.05}>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                Stop posting blind
              </span>
            </BlurFade>
            <BlurFade delay={0.12}>
              {/* Reverted to the original wording (owner, 2026-07-27). The numbers-as-headline
                  version ("231 views. Then 183,000.") is gone — the receipt below carries the
                  outcome, and the headline goes back to naming what the product does. */}
              <h1 className="mt-3 font-serif text-[clamp(2.3rem,5.2vw,3.6rem)] font-medium leading-[1.05] tracking-tight text-balance">
                Know if your video will pop —{" "}
                <span className="italic text-accent-text">before</span> you post
                it.
              </h1>
            </BlurFade>
            <BlurFade delay={0.19}>
              {/* Two lines, not three — the fold stacks few, larger moments. The
                  "trained on 500" claim is NOT lost: it lives in ProofMechanism
                  (PlatformBar's rule: every claim stated once). */}
              <p className="mx-auto mt-4 max-w-[46ch] text-[17px] leading-relaxed text-foreground-secondary">
                A room of simulated viewers watches your video — the exact
                second they&apos;d scroll, and the fix, before you post.
              </p>
            </BlurFade>
          </div>

          {/* the receipt — the thumbnail and the views, concretely */}
          <BlurFade delay={0.26} className="mt-7 md:mt-8">
            <OutcomeReceipt />
          </BlurFade>

          {/* the one ask */}
          <BlurFade delay={0.32} className="mt-6">
            <div className="flex flex-col items-center gap-3">
              <FreeEntryCta size="lg" />
              <p className="text-center text-[13px] text-foreground-muted">
                {FREE_ENTRY.microcopy}
              </p>
            </div>
          </BlurFade>

          {/* the probe — what it showed them, at full platform fidelity */}
          <BlurFade delay={0.38} className="mt-14 md:mt-20">
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
      {/* StickyCta UNMOUNTED (owner call 2026-07-27): the floating pill overlapped the read
          rail's own rows inside the product window and competed with the fold's button, which
          is now the page's one standing ask. The component stays on disk. */}
    </main>
  );
}
