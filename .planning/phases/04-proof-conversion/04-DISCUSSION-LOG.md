# Phase 4: Proof & Conversion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 4-Proof & Conversion
**Areas discussed:** Proof honesty & shape, Pricing teaser depth, FAQ content & behavior, Final CTA band + order

**Cross-cutting steer (set at area selection):** *"don't worry about honesty, worry about
conversion rate, and show me on each topic your recommended answer."* → conversion-optimized
throughout; recommendation-first questioning; recommended option accepted on every question.

---

## Proof layout (PROOF-01/02)

| Option | Description | Selected |
|--------|-------------|----------|
| Strip + 3 testimonial cards | Thin trust strip (stat + logo marquee) + 3-card testimonial grid w/ avatar, name/@handle, quote, result metric | ✓ |
| Testimonials only (grid of 3–6) | Just quote cards, no stat/logo strip | |
| Logo wall + marquee of many quotes | Auto-scrolling logo wall + quote carousel | |

**User's choice:** Strip + 3 testimonial cards (Recommended)
**Notes:** Highest conversion — stat anchor + social proof + outcome proof. Split placement
(strip high under hero, testimonials in conversion zone) decided in the order question.

## Logo strip identity (PROOF-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Placeholder creator/brand logos as swap slots | Neutral `<Placeholder variant="logo">` marquee, swapped later | ✓ |
| Platform logos — "works with TikTok/IG/YouTube" | Real platform marks | |
| Press "As seen in" style logos | Media/publication logos | |

**User's choice:** Placeholder creator/brand swap slots (Recommended)
**Notes:** Most flexible + honest-by-construction; pre-launch has nothing real to show.

## Headline trust stat (PROOF-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Creator peer-count — "Join 2,000+ creators" | Peer social proof | ✓ |
| Activity — "12,000+ simulations run" | Usage/traction stat | |
| Outcome — "300M+ views predicted" | Big outcome number | |

**User's choice:** Creator peer-count (Recommended)
**Notes:** "People like me use this" — highest-converting framing. Number is a placeholder.

## Pricing teaser depth (CONVERT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Two tier cards, price + Pro "Most popular" | Starter/Pro, bullets, anchored price, Pro highlighted, CTAs→signup | ✓ |
| Light single "Free to start" card + link | Minimal, defers to /pricing | |
| Two cards, NO price (Free/Pro) | Benefits only, no number | |

**User's choice:** Two tier cards w/ price + Pro highlighted (Recommended)

## Pricing price display (CONVERT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Starter free + Pro placeholder $/mo + trial badge | Free entry, Pro price anchor, 7-day trial — matches real model | ✓ |
| Placeholder $/mo on BOTH tiers | Number on both | |
| No prices — names + bullets only | Defer numbers entirely | |

**User's choice:** Starter free + Pro placeholder $/mo + trial badge (Recommended)
**Notes:** Real model confirmed from `whop/config.ts` + `/pricing` (Starter 5/mo, Pro
unlimited, 7-day free Pro trial, free tier exists); marketing $ are placeholders. NO Whop/
Supabase/checkout in the teaser — CTAs are link-only to SIGNUP_URL.

## FAQ scope + behavior (CONVERT-03)

| Option | Description | Selected |
|--------|-------------|----------|
| 6 objection-busting Qs, single-open accordion | accuracy/platforms/niche/privacy/price/speed, one open at a time, Radix accordion | ✓ |
| 4–5 Qs, multi-open | Shorter, several expanded | |
| 8+ Qs, single-open | Exhaustive | |

**User's choice:** 6 objection-busters, single-open (Recommended)
**Notes:** Reuse Radix `ui/accordion.tsx` for keyboard a11y; restyle flat-warm if cold.

## Final CTA band + section order (CONVERT-02 + structure)

| Option | Description | Selected |
|--------|-------------|----------|
| Serif band + mini gauge echo; strip high under hero | Warm band w/ serif close-line + Try-it-free + reassurance + score-gauge echo; strip under hero, testimonials in conversion zone; no new nav anchors | ✓ |
| Pure-type band; all proof in one block after features | No flourish; strip+testimonials grouped | |
| Band reuses the hero product-shot visual | Echo device shot instead of gauge | |

**User's choice:** Serif band + mini gauge echo; strip high under hero (Recommended)

## Risk-reducer microcopy (cross-cutting conversion lever)

| Option | Description | Selected |
|--------|-------------|----------|
| "Free to start — no credit card" | Strongest first-click friction-remover | ✓ |
| "7-day free Pro trial" | Matches real model, sells Pro | |
| Both (free-to-start near CTA, trial badge on Pro) | Each where it fits | |

**User's choice:** "Free to start — no credit card" (Recommended)

---

## Claude's Discretion

- Exact placeholder numbers (Pro $/mo, peer-count value, per-quote result metrics).
- Drafted copy (testimonial quotes + names/@handles, FAQ answers, serif close-line, pricing bullets).
- Testimonial-card / strip / band exact layout, motion, mobile stacking (within flat-warm + reduced-motion).
- FAQ as RSC + client island vs client component (Radix accordion is interactive → client island).
- Reuse/restyle `ui/testimonial-card.tsx` (cold) vs build flat-warm (Phase-3 precedent leans build).

## Deferred Ideas

- Real proof assets (real logos, named-creator testimonials, real metrics) — post-launch swap.
- Live waitlist / email capture on the CTA band — out of scope (link-only to SIGNUP_URL).
- Whop checkout / live purchase from the teaser — real `/pricing` route owns it.
- Monthly/annual pricing toggle — over-engineering a teaser.
- Phase-5 cross-cutting: responsive stacking, perf (lazy marquee/media, CLS), a11y/contrast audit.
