/**
 * The fold.
 *
 * ── GEOMETRY, ALL MEASURED ────────────────────────────────────────────────────────────────
 *                          Linear      Attio     /go today    here
 *   h1 size    desktop     64px        64px      ~58px        64–68px
 *              mobile      38px        40px      ~37px        39–40px
 *   h1 weight              510         600       500          500
 *   h1 tracking            −0.022em    −0.020em  −0.028em     −0.022em
 *   air above h1 desktop   ~370        —         ~150         240
 *                mobile    196         226       64           200
 *
 * ⚠️ Desktop air is 240, NOT the 300–370 the reference sets. That is a deliberate trade, and
 * the reason is structural: Linear runs ZERO CTAs and no subhead in its fold, so it can spend
 * 370px on air AND still put its shot at 61% of the viewport. We carry a subhead, a CTA and its
 * microcopy — ~200px Linear does not pay — and one CTA above the fold is non-negotiable for
 * cold social traffic at a 1.5% baseline. At 300px of air the shot's top measured at 77% of a
 * 1440x900 and 81% of a 1512x860, i.e. a ~170px sliver of an empty pane: "the probe becomes the
 * fold" in name only. 240 puts it at ~70% with ~270px showing, which is enough for the Test
 * card to visibly assemble in the fold. If the owner wants the fuller Linear air, the thing to
 * give up is the subhead, not the CTA.
 *
 * The mobile air figure is the one that matters most and the one nobody had measured: /go
 * gives the headline 64px of room on a phone where both references give it 196–226. On the
 * viewport that carries most of this page's traffic, that is the single largest geometric miss
 * on the page — a headline jammed under the nav reads as a blog post, the same headline with
 * 200px of air above it reads as a product launch.
 *
 * ── ACCENT DOSAGE ─────────────────────────────────────────────────────────────────────────
 * The current fold spends FIVE accent moments against a LOCKED near-zero rule: a page bloom, a
 * receipt bloom, the ↑792× badge, the italic *before*, and the CTA. Linear spends its one
 * chromatic colour on the brand mark, focus rings, and one CTA per section. Four of the five
 * are cut here; the CTA keeps it, because that is the page's one ask and a cold visitor at a
 * 1.5% social baseline needs to find it instantly.
 *
 * The italic on *before* stays — italic is the serif's own voice, not a colour — and the serif
 * itself stays because Newsreader is the one deliberate divergence from Linear. It is what
 * stops this being a clone.
 *
 * ── WHAT IS NOT IN THE FOLD ANY MORE ──────────────────────────────────────────────────────
 * The two-tile receipt. It moves down to a case study (§6). An anonymous, unverifiable number
 * cannot carry a cold fold — after the machine has been seen working, the same number
 * corroborates instead of asserting. Its removal is also what buys the 300px of air.
 */

import { FreeEntryCta } from "@/components/offer/free-entry-cta";
import { FREE_ENTRY } from "@/components/offer/cta-config";
import { GRAIN_URL } from "@/components/offer/atmosphere";
import { AnnouncementPill } from "./marketing-nav";
import { HeroShot } from "./hero-shot";

/**
 * Atmosphere — the layer the first pass deleted, and shouldn't have.
 *
 * Cutting the accent dosage from five moments to one was correct. Cutting every depth layer
 * along with it was not: what was left was #0d0d0c flat edge to edge, and a serif headline
 * centred on an unlit void reads as a template, however good the type is. Neither reference
 * runs a flat fold — Linear sits its headline in a soft vignette, Attio floats its shot on a
 * pale gradient wash.
 *
 * This is the matte version of that: a broad neutral-cream stage light behind the headline, a
 * masked dot grid, and grain. NO coral (the accent's one moment in this fold is the CTA), no
 * glass, no glow — nothing here is a light source on an element, only ground under it.
 */
function HeroAtmosphere() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* the stage light — broad, neutral, very low; the shot emerges out of it */}
      <div
        className="absolute inset-x-0 top-0 h-[900px]"
        style={{
          background:
            "radial-gradient(120% 62% at 50% 18%, rgba(236,231,222,0.075), rgba(236,231,222,0.022) 46%, transparent 72%)",
        }}
      />
      {/* dot grid, faded well before the edges so it never hard-edges */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px,rgba(236,231,222,0.055) 1px,transparent 0)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(115% 70% at 50% 6%,#000 22%,transparent 74%)",
          WebkitMaskImage: "radial-gradient(115% 70% at 50% 6%,#000 22%,transparent 74%)",
        }}
      />
      {/* film grain — the tooth that stops the matte reading dead-flat */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-soft-light"
        style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: "140px 140px" }}
      />
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <HeroAtmosphere />
      {/* Air above the headline: 200 on a phone, 300 on desktop. Measured, not chosen. */}
      <div className="relative mx-auto w-full max-w-[1400px] px-5 pb-0 pt-[200px] md:px-8 md:pt-[240px]">
        {/*
          ⚠️ MEASURE IN PIXELS, NOT `ch`. This was `max-w-[22ch]` and the headline rendered as
          SEVEN lines, 452px tall — Newsreader's `ch` is narrow, so 22ch at 67px is only ~620px
          of measure for a 48-character line. That pushed the CTA to y=917 on a 1440x900 and
          y=940 on a 1512x860: the page's one ask, below the fold on both, which is the exact
          failure this fold has shipped twice before.

          760px holds it to two lines at the desktop size and 88vw to three on a phone (Linear's
          own h1 measures 88vw on mobile). Re-run `.scratch/verify-v2.js` after ANY change here —
          it asserts the CTA's position rather than trusting it.
        */}
        <AnnouncementPill />

        <div className="mx-auto max-w-[88vw] text-center md:max-w-[760px]">
          <h1
            className="text-balance font-serif font-medium text-[#ece7de]"
            style={{
              // 39px at 390 · 63px at 1440 · 66px at 1512 · caps at 68
              fontSize: "clamp(2.45rem, 4.4vw, 4.25rem)",
              letterSpacing: "-0.022em",
              lineHeight: "1.02",
            }}
          >
            Know if your video will pop — <em className="italic">before</em> you post it.
          </h1>
        </div>

        {/* Two lines, not three. The "trained on 500" claim is NOT lost — it lives in
            ProofMechanism, under this page's rule that every claim is stated exactly once. */}
        <p className="mx-auto mt-6 max-w-[46ch] text-center text-[17px] leading-[1.55] text-[#c2bdb4] md:mt-7">
          A room of simulated viewers watches your video — the exact second they&apos;d scroll,
          and the fix, before you post.
        </p>

        {/* The one ask. Re-measure its position after ANY addition to this fold: it has fallen
            below the fold on a 1512x860 MacBook and on a 390x844 phone before, which is the
            page's single point of failure. */}
        <div className="mt-8 flex flex-col items-center gap-3 md:mt-9">
          <FreeEntryCta size="lg" />
          <p className="text-center text-[13px] text-[#8a857c]">{FREE_ENTRY.microcopy}</p>
        </div>

        {/* The product, bled. Linear puts its shot top at 61% of a phone viewport; this lands
            in the same band and continues off the bottom edge. */}
        <div className="mt-10 md:mt-14">
          <HeroShot />
        </div>
      </div>
    </section>
  );
}
