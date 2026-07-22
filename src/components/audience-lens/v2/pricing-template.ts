/**
 * PRICING_TEMPLATE — the SECOND DomainTemplate (business · pricing). The swap proof.
 *
 * Authored purely as data against the same slot contract (`domain-template.ts`) that CREATOR_TEMPLATE
 * fills — NO change to the Brain/Population frames beyond the two new figure `kind`s they already
 * switch on (`resistance-curve`, `demand-curve`). Scan it top-to-bottom against the creator template
 * and the cascade is identical (verdict → brain: cortex/driver/signals → population: main/terrain/
 * segments/voices); only the FIGURES swap. That is the whole bet: a new domain = one template object,
 * never a frame fork.
 *
 * The honest limit is stated in the template, not hidden: `population.calibration` renders the
 * generalization-bounded-by-calibration tag — a room calibrated on engagement is being asked a
 * willingness-to-pay question, so the read is `modeled · pricing decision · engagement-calibrated`.
 * A production pricing vertical would swap in a pricing-calibrated audience; the seam is the same.
 */

import type { DomainTemplate } from "./domain-template";

export const PRICING_TEMPLATE: DomainTemplate = {
  id: "pricing",
  label: "Business · pricing",
  backLabel: "All plans",
  pager: "Pro plan · $29/mo",
  verdict: { value: "$24", label: "optimal price" },
  // THE UNLOCK — the cheat code: the lever, the modeled revenue gain, and the counterintuitive read
  // (it's fairness, not value or trust, that breaks $29 — so the fix is the price, not the product).
  unlock: {
    lever: "Price at $24, not $29",
    gain: "+18% revenue",
    insight: "It's fairness that breaks $29 (−14), not value or trust — those hold. You're not underselling the product; you're overpricing it for the bargain tier.",
  },

  brain: {
    cortexSeedKey: "pricing-pro-29",
    clipSeconds: 12, // the shared cortex figure needs a loop duration (the reaction unfolding)
    stopRatio: 0.55, // reaction intensity — drives the cortex bold (generic, not a stop rate here)
    cortexNote: "A modeled reaction — not a real purchase decision.", // #3 claim boundary
    signalsBaseline: "vs a fair-priced plan", // #8 the delta referent
    // ◇ driver axis — pricing = resistance over price ("why this price")
    driver: {
      kind: "resistance-curve",
      data: {
        question: "Where resistance spikes",
        points: [16, 19, 24, 31, 41, 56, 73, 86], // 0..100 resistance, rising across $9→$49
        spikeAt: 0.62, // ≈ $29
        spikeLabel: "$29 · resistance spikes",
      },
    },
    // ◇ signals — same figure, relabeled for the domain; deltas vs a fair-priced plan (#8) tell the
    // story: fairness is the problem at $29, trust and value hold.
    signals: [
      { label: "Perceived value", score: 55, band: "okay", vsBase: 5 },
      { label: "Fairness", score: 40, band: "weak", vsBase: -14 },
      { label: "Trust", score: 68, band: "strong", vsBase: 11 },
    ],
    // networks omitted — proves the optional slot (pricing has no playhead-network figure)
    // ● ask-why chat — shared slot, deferred
    askWhy: { enabled: false, placeholder: "Ask why $29 felt steep…" },
  },

  population: {
    // one-line read under the terrain hero — the non-obvious pattern
    heroRead: "Value and premium tiers are already sold (66–90%). The bargain tier is priced out at $24 — only 22% in.",
    // ◇ main figure — pricing = the demand curve
    main: {
      kind: "demand-curve",
      data: {
        kicker: "Demand · price → would-pay",
        points: [92, 87, 79, 67, 53, 39, 25, 14], // 0..100 would-pay share, falling across $9→$49
        optimalAt: 0.38, // ≈ $24 (revenue-optimal)
        optimalLabel: "$24 optimal",
        loLabel: "$9",
        hiLabel: "$49",
        caption: "+18% revenue vs $29",
      },
    },
    // ● the society — same terrain figure, pricing clusters (bargain priced-out = the loss)
    terrain: {
      clusters: [
        { name: "bargain", cx: 128, cy: 92, spread: 50, n: 38, lit: 0.22 },
        { name: "value", cx: 246, cy: 72, spread: 40, n: 34, lit: 0.66 },
        { name: "premium", cx: 250, cy: 156, spread: 30, n: 16, lit: 0.9 },
        { name: "loyal", cx: 120, cy: 160, spread: 26, n: 12, lit: 0.8 },
      ],
      lossClusterIndex: 0, // bargain-hunters priced out at $24 = the loudest-no (coral)
    },
    // ◇ segments — willingness-to-pay tiers
    segments: {
      title: "Willingness to pay",
      rows: [
        { label: "Won't pay >$19", pct: 38, loss: true },
        { label: "Pay up to $29", pct: 47 },
        { label: "Pay $29+", pct: 15 },
      ],
    },
    // ● voices — coded reasons + exemplar cast
    voices: {
      kicker: "Why · coded from 1,000",
      reasons: [
        {
          label: "The price outruns the value",
          count: 312,
          quote: "$29 feels steep for what I'd use — $20-ish and I'm in",
          who: "Sam · value-seeker",
          loss: true,
        },
        {
          label: "Worth it for the time saved",
          count: 205,
          quote: "if it saves me an hour a week it pays for itself",
          who: "Dana · power user",
        },
        {
          label: "Won't commit without a trial",
          count: 140,
          quote: "i'd want to see it work before i pay anything",
          who: "Ray · skeptic",
        },
      ],
    },
    // ◇ the honest limit — an engagement-calibrated room answering a pricing question
    calibration: { note: "modeled · pricing decision · engagement-calibrated" },
  },
};
