import type { Metadata } from "next";

/**
 * ⚠️ MARKETING-ONLY STYLESHEET. Imported HERE and nowhere else — not in `(offer)/layout.tsx`,
 * not in the app. That single import is the structural guarantee that the near-black marketing
 * floor (#0d0d0c) and the ambient motion layer cannot reach `/go` or any signed-in surface.
 * The app's own floor (#1f1f1e) is unchanged by design. Do not move this import up a level.
 */
import "../marketing.css";

import { MarketingNav } from "@/components/offer/v2/marketing-nav";
import { Hero } from "@/components/offer/v2/hero";
import { LogoWall } from "@/components/offer/v2/sections/logo-wall";
import { ThreeUp } from "@/components/offer/v2/sections/three-up";
import { ReadSection } from "@/components/offer/v2/sections/read-section";
import { RoomSection } from "@/components/offer/v2/sections/room-section";
import { BrainSection } from "@/components/offer/v2/sections/brain-section";
import { MetricsBand } from "@/components/offer/v2/sections/metrics-band";
import { CaseStudy } from "@/components/offer/v2/sections/case-study";
import { TestimonialWall } from "@/components/offer/v2/sections/testimonial-wall";
import { Transformation } from "@/components/offer/sections/transformation";
import { ProofMechanism } from "@/components/offer/sections/proof-mechanism";
import { Pricing } from "@/components/offer/sections/pricing";
import { Guarantee } from "@/components/offer/sections/guarantee";
import { Faq } from "@/components/offer/sections/faq";
import { FinalCta } from "@/components/offer/sections/final-cta";
import { OfferFooter } from "@/components/offer/sections/footer";

export const metadata: Metadata = {
  title: "Maven — Know if your video will pop before you post",
  description:
    "Maven simulates how up to 1,000 viewers react to your video, second by second — see the exact moment they'd scroll, and the fix, before you post. Your first test is free, no account.",
  // A review route must never be indexed. /go is the page that ranks; two near-identical
  // landing pages in an index is a self-inflicted duplicate-content problem, and this one
  // additionally carries visible placeholders.
  robots: { index: false, follow: false },
};

/**
 * /go-v2 — the landing rebuild, on a no-auth review route.
 *
 * Follows the `/ambient-v2` precedent: not linked from anywhere, reviewed live on a prod build,
 * refined in code. `/go` is NOT touched until the owner approves this one.
 *
 * ── WHAT THIS PAGE IS FOR ─────────────────────────────────────────────────────────────────
 * The owner's diagnosis was "Attio has so much animation in the actual panels which looks
 * really premium; ours just looks like AI trash", and measuring proved it right. At 1440x900
 * AND at 390x844, Linear runs 180 infinite CSS animations, Cursor 37, Attio 12 — and /go runs
 * ONE, which is Tailwind's `ping`. None of the three uses <video>. Every reveal on /go is a
 * `BlurFade` that fires once and freezes, and the hero choreography finishes at 5.9s and dies.
 *
 * So the point of this rebuild is MOTION, not layout, and the rule is: motion belongs inside
 * the product surface, never on its container. See `marketing.css` for the vocabulary and
 * `v2/ambient.ts` for why nothing shares a period.
 *
 * ── SECTION ORDER, AND THE TWO MOVES THAT MATTER ──────────────────────────────────────────
 * Nothing is cut. Two things move:
 *
 *   1. THE PROBE BECOMES THE FOLD. Proof below the fold is proof wasted — the hero demo had to
 *      be intersection-armed precisely because nobody was ever seeing it.
 *   2. THE RECEIPT MOVES DOWN, into a case study. An anonymous, unverifiable number cannot
 *      carry a cold fold. After the machine has been seen working, the same number corroborates
 *      instead of asserting.
 *
 * `HowItWorks` is the one section not mounted (owner call this session): 1.0/2.0/3.0 tell that
 * story with the LIVE surfaces, while `shot-stages.tsx`'s webps still capture the legacy room —
 * they would sit next to the real thing showing an older version of it. The component stays on
 * disk, undeleted.
 *
 * ── LANDMINES ─────────────────────────────────────────────────────────────────────────────
 * • Never judge this funnel on `next dev` — StrictMode makes the /go → /home arrival look stone
 *   dead. Prod build only. This worktree serves :3000; two others also serve /go.
 * • The cortex is WebGL and does NOT render headless. `BrainSection` deliberately does not
 *   mount it — see that file's header.
 * • The hero rail cycles its two read pages every 5s, so screenshot filenames lie. Verify which
 *   tab is active before trusting a capture.
 */
export default function OfferPageV2() {
  return (
    <div className="mk-root">
      <MarketingNav />

      <main>
        <Hero />

        {/* Grammar borrowed from Attio and Cursor — logo wall, numbered sections, a metrics
            band, a case study whose headline IS the number. Colour is borrowed from nobody:
            two of the three references are LIGHT, and only Linear is dark. */}
        <LogoWall />
        <ThreeUp />

        <ReadSection />
        <RoomSection />
        <BrainSection />

        <MetricsBand />
        <CaseStudy />

        {/* The kept persuasion arc. Re-shelled geometry lands with these in phase 3; their copy
            is untouched in this pass. `showStats` is off because MetricsBand now carries those
            same three numbers, and this page states every claim exactly once. */}
        <Transformation />
        <ProofMechanism showStats={false} />

        <TestimonialWall />
        <Pricing />
        <Guarantee />
        <Faq />
        <FinalCta />
        <OfferFooter />
      </main>
    </div>
  );
}
