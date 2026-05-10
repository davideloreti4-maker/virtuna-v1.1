# Virtuna Brand Spine

> Source of truth for voice, vocabulary, and tone across all customer-facing surfaces.
> Read this before writing any UI string in Phase 2-6 of the Brand Statement Landing milestone.

---

## 1. The One-Liner (canonical)

**Your audience, simulated.**

This appears verbatim in: deck cover, social bios, OG metadata (`og:description`), footer brand stamp.
NOT a tagline subject to A/B testing. Do not paraphrase. Do not extend. Do not invert.

When other phrases describe Virtuna in long-form, they MUST be consistent with this spine -- the audience is the subject, simulation is the mechanism.

## 2. Tone Descriptors

- **Calm** -- never breathless. No exclamation marks in body copy. Numerals over hype. Sentences end with periods, not stage-directions.
- **Confident** -- declarative sentences. No hedging ("maybe", "we think", "could", "might"). State the behavior, not the wish.
- **Lab-credible** -- research vocabulary (forecast, trained, calibrated, behavioral, replication, dataset). Not academic stuffiness. Read like a research org's product page, not a journal abstract.

### Do / Don't

| Do (correct) | Don't (wrong) | Why |
|--------------|---------------|-----|
| Predict how your audience will respond. | AI-powered viral prediction! | Audience-led, calm, no banned vocab |
| Trained on decades of behavioral research. | Powered by cutting-edge AI. | Specific, lab-credible, banned-vocab free |
| Forecast every video before it ships. | Will your video go viral? | Declarative, predict-verb, no "viral" |
| Virtuna simulates your audience. | Virtuna's AI tells you what works. | Subject is audience, mechanism is simulation |
| Run a prediction. | Submit a query. | Verb-first, creator-tactile |
| Self-improving with every outcome. | Always learning, always adapting! | No exclamation, specific outcome-loop |

## 3. Preferred Verbs

predict -- simulate -- forecast -- learn -- improve -- train -- respond -- watch -- land -- run -- ship

Use these as the spine of every CTA and section headline. When in doubt, lead with one of these verbs. Pair them with the audience or the work, never with the algorithm.

**Tactical rule:** Every CTA on every viewport MUST start with one of these verbs (or a creator-tactile near-synonym like "paste", "see", "try"). No verb-less buttons. No "Submit" / "Start now" / "Get started" generics.

## 4. Banned -> Replacement Table (per D-02, D-04)

| Banned | Replacement | Reason |
|--------|-------------|--------|
| viral | breakout / high-performing / lands | "viral" weakens $100M+ venture positioning; dated creator-economy hype |
| AI | behavioral simulation / engine / model | "AI" is generic template marketing; we are specific |
| go viral | land with audience / break through | dated phrase; audience-first replacement reads stronger |
| users | creators (or specific role: founder, partner) | products serve creators, not faceless "users" |
| AI-powered | trained on behavioral research | "AI-powered" is template marketing-speak |
| cutting-edge | (delete; let specifics speak) | hype word -- replace with the specific capability |
| revolutionary | (delete) | hype word; weakens lab credibility |
| game-changing | (delete) | hype word |
| disrupt / disruptive | (delete; describe the actual change) | tired startup phrase |
| leverage | use | filler verb that adds nothing |
| seamless | (delete; describe the experience) | meaningless adjective |

This table is enforced at commit time by `scripts/lint-vocab.mjs` (Plan 04). Inline override: `<!-- vocab-lint-disable-next-line -->` for legitimate uses (e.g., a quoted creator testimonial where the speaker uses one of these words organically -- attribution carries the word, Virtuna does not).

**Authoring discipline:** Do not request an override to slip a banned word into authored copy. Either pick the replacement, restructure the sentence, or escalate to Davide.

## 5. Numen Machines Lockup Pattern (per BRAND-03, D-03)

| Surface | Treatment | Example |
|---------|-----------|---------|
| Landing hero pre-headline | `VIRTUNA · A NUMEN MACHINES PRODUCT` (small mono uppercase, restrained) | per HERO-01 |
| Landing footer | `Made by Numen Machines` + lockup mark | per PRICE-05 |
| OG metadata (og:title) | `Virtuna -- A Numen Machines product` | shareable previews on Twitter / LinkedIn / iMessage |
| In-product chrome | `Virtuna` alone | logged-in user; context already established |
| Page titles (`<title>`) | `Virtuna -- Predict your audience` | tab clarity, search-snippet legibility |

**Rule:** Lead with the lockup on first impression (landing, OG, footer). Drop to Virtuna-alone once the user is in-product. The lockup carries the lab-credible weight on first contact; in-product, the work itself is the credibility.

**What NOT to do:** Do not put the lockup on every dashboard panel header. Do not abbreviate it ("VRT · NM"). Do not animate it. Do not invert order ("A Numen Machines product · Virtuna").

## 6. Audience Tuning per Viewport (per BRAND-04, D-02)

| Viewport | Primary Audience | Voice Lean | Concrete Example |
|----------|------------------|------------|------------------|
| Hero | All three (creator-led) | Creator-led, lab-credible enough for investors | H1 in second person, subline cites "decades of research" |
| Demo | Creators | Tactile, verb-first | "Paste a TikTok URL.", not "Submit a query." |
| How It Works | Creators + investors | Process diagram language | "video -> analyze -> simulate -> predict" |
| Three Surfaces | Creators | Product-language | "Brand Deals", not "Monetization integrations" |
| The Science | Investors + partners | Lab-credible, citation-led | "1,000-survey replication study" |
| Social Proof | Creators + investors | Quote-led, honest framing | "Early signal from 47 creators" not fake-impressive numbers |
| Pricing | Creators | Direct, no jargon | "$X/mo. 7-day Pro trial." |

**Three-audience rule:** Creators are the primary conversion target. Investors and partners absorb tone from the same page -- we do NOT split the site into separate creator / investor flows. Each viewport leans toward its primary audience without alienating the other two.

**Hero serves all three:** The first impression must read credible to a creator scrolling on phone, an investor on desktop with a deck open in another tab, and a partner doing diligence. Lead with creator-tactile language; subline carries lab-credibility for the other two.

### Section-level voice anchors

Use these as quick references when drafting section copy. Each anchor is a single sentence that sounds correct for that viewport.

| Viewport | Voice Anchor |
|----------|--------------|
| Hero | "Predict how your audience will respond. Before you post." |
| Demo | "Paste a TikTok URL. Watch your audience react." |
| How It Works | "Video, analyzed. Audience, simulated. Outcome, forecast." |
| Three Surfaces | "Predict, track, monetize -- in one engine." |
| The Science | "Behavioral research, calibrated against real outcomes." |
| Social Proof | "Early signal from creators running predictions today." |
| Pricing | "Start free. Trial Pro for 7 days. No credit card." |

If a draft headline does not feel like the same writer wrote the anchor, rewrite the draft. The anchors are the tuning fork.

## 7. How to use this document

- **Plan-phase researchers:** read this before creating section-level copy plans. Cross-reference §6 audience tuning before drafting any section headline.
- **Executors:** every UI string MUST be cross-checked against §3 (preferred verbs) and §4 (banned table). One verification task per section copy plan obeys §6 audience tuning.
- **Automated enforcement:** `scripts/lint-vocab.mjs` (Plan 04) blocks commits that introduce banned vocabulary. The BANNED regex array mirrors §4 entries verbatim.
- **Compliance task:** each Phase 2-6 plan should include one verification task that confirms section copy obeys §4 banned-list and §6 audience tuning.
- **Updates:** treat this document as immutable for the Brand Statement Landing milestone. If §4 needs a new banned word, surface as a discussion topic before editing -- BRAND-SPINE.md changes cascade to lint script, audit script, and prior phase summaries.
- **Quality bar:** every customer-facing string in Phase 2-6 must read at $100M+ venture quality against the reference set (Anthropic, Linear, Raycast, Vercel). If a draft does not pass that bar, rewrite -- do NOT ship and "iterate later".

---

*Virtuna Brand Spine v1.0*
*Last updated: 2026-05-10*
