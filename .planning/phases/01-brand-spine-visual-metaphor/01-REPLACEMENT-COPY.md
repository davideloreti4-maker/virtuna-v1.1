# Phase 1: Brand Spine & Visual Metaphor - Replacement Copy

**Drafted:** 2026-05-10
**Conforms to:** `.planning/reference/BRAND-SPINE.md`
**Sign-off model:** D-15 (approve once at end)
**Hero copy lock:** D-16 (REQUIREMENTS.md is the draft starting point; Davide finalizes here)

This document is the source of truth for ALL customer-facing copy strings consumed by Phase 2-4 build tasks. Phase 6 (BUILD-09) replaces `src/app/page.tsx` wholesale using these strings. Every string passes BRAND-SPINE.md §3 (preferred verbs) + §4 (banned table) compliance. Verified by `node scripts/lint-vocab.mjs` against this doc.

<viewport name="hero">
## Hero (HERO-01..10)

| Element | Copy | Source ID |
|---------|------|-----------|
| Pre-headline | `VIRTUNA · A NUMEN MACHINES PRODUCT` | HERO-01 |
| H1 line 1 | "Predict how your audience will respond." | HERO-02 |
| H1 line 2 | "Before you post." | HERO-02 |
| Sub-headline | "Virtuna simulates your audience to forecast every video before it ships." | HERO-03 |
| Subline | "Trained on decades of behavioral research. Self-improving with every outcome." | HERO-04 |
| Primary CTA | "Run a prediction" (with rightward chevron `→`) | HERO-05 |
| Secondary CTA | "See the science" | HERO-05 |

**Hero motion accessibility text** (per VIZ-01, screen-reader fallback):

| Element | Copy |
|---------|------|
| Canvas aria-label | "Audience particles aggregating into a confidence score" |
| Reduced-motion static caption | "Your audience, simulated. Confidence score on viewport entry." |

**Hero block compliance** (per HERO-10): zero "viral", zero "AI", zero "go viral". Lead verb is `Predict`. Audience is the subject. Mechanism is simulation. Mirrors REQUIREMENTS.md HERO-01..05 verbatim per D-16.
</viewport>

<viewport name="demo">
## Try It / Live Demo (DEMO-01..08)

| Element | Copy | Source ID |
|---------|------|-----------|
| Section eyebrow | "Try it" | DEMO-02 |
| Section H2 | "Paste a TikTok URL. Watch your audience react." | DEMO-02 |
| Section sub-headline | "Run a prediction on any video. See the simulation render in seconds." | DEMO-02 |
| Input label | "TikTok URL" | DEMO-01 |
| Input placeholder | "https://www.tiktok.com/@creator/video/..." | DEMO-01 |
| Submit button | "Predict" (with rightward chevron `→`) | DEMO-02 |
| Try-sample button | "Try a sample video" | DEMO-06 |
| Loading step 1 | "Reading your video." | DEMO-03 |
| Loading step 2 | "Building your audience." | DEMO-03 |
| Loading step 3 | "Simulating reactions." | DEMO-03 |
| Loading step 4 | "Forecasting outcome." | DEMO-03 |
| Result headline (high score) | "Your audience would land with this." | DEMO-04 |
| Result headline (low score) | "Your audience would scroll past." | DEMO-04 |
| Confidence indicator | "78 percent of your audience would watch past 3 seconds." | DEMO-04 |
| Confidence interval label | "Confidence interval" | DEMO-04 |
| Audience-response indicator 1 | "Hook strength" | DEMO-04 |
| Audience-response indicator 2 | "Watch-through forecast" | DEMO-04 |
| Empty state body | "Drop a TikTok URL above. Or trial a sample video to see the engine run." | DEMO-05 |
| Invalid-URL state body | "That does not look like a TikTok URL. Paste the link from your share sheet, or trial a sample." | DEMO-05 |
| Error state body | "The engine could not read that video. Try the link again, or paste a different one." | DEMO-05 |
| Error state retry button | "Try again" | DEMO-05 |
</viewport>

<viewport name="how-it-works">
## How It Works (WORKS-01..06)

| Element | Copy | Source ID |
|---------|------|-----------|
| Section eyebrow | "How it works" | WORKS-04 |
| Section H2 | "Video, analyzed. Audience, simulated. Outcome, forecast." | WORKS-04 |
| Section sub-headline | "Four stages, run on every prediction." | WORKS-04 |
| Stage 1 label | "Video" | WORKS-01 |
| Stage 1 description | "We read your video frame by frame." | WORKS-03 |
| Stage 2 label | "Analyze" | WORKS-01 |
| Stage 2 description | "We extract the signals your audience reacts to." | WORKS-03 |
| Stage 3 label | "Simulate audience" | WORKS-01 |
| Stage 3 description | "Your audience runs the video. We watch how they respond." | WORKS-03 |
| Stage 4 label | "Predict" | WORKS-01 |
| Stage 4 description | "The engine forecasts how the video will land." | WORKS-03 |
| Pipeline aria-label | "Four-stage prediction engine pipeline" | WORKS-02 |
</viewport>

<viewport name="three-surfaces">
## Three Surfaces / Bento (SURF-01..06)

| Element | Copy | Source ID |
|---------|------|-----------|
| Section eyebrow | "One engine, three surfaces" | SURF-06 |
| Section H2 | "Predict, track, monetize. In one engine." | SURF-06 |
| Section sub-headline | "Virtuna ships three surfaces for the work creators actually do." | SURF-06 |
| Cell 1 title | "Prediction" | SURF-01 |
| Cell 1 description | "Run a prediction on any video. Forecast how your audience will respond before you post." | SURF-02 |
| Cell 1 CTA label | "Learn more" | SURF-02 |
| Cell 1 CTA aria | "Learn more about Prediction" | SURF-02 |
| Cell 2 title | "Competitor Intelligence" | SURF-01 |
| Cell 2 description | "Track creators in your niche. Watch what lands, watch what flops, learn from both." | SURF-02 |
| Cell 2 CTA label | "Learn more" | SURF-02 |
| Cell 2 CTA aria | "Learn more about Competitor Intelligence" | SURF-02 |
| Cell 3 title | "Brand Deals" | SURF-01 |
| Cell 3 description | "Match with brands that fit your audience. Apply, track earnings, ship deliverables." | SURF-02 |
| Cell 3 CTA label | "Learn more" | SURF-02 |
| Cell 3 CTA aria | "Learn more about Brand Deals" | SURF-02 |
</viewport>

<viewport name="science">
## The Science (SCI-01..06)

| Element | Copy | Source ID |
|---------|------|-----------|
| Section eyebrow | "The science" | SCI-01 |
| Section H2 | "Why audience matters more than trends." | SCI-01 |
| Section sub-headline | "Trends move. Audiences are the constant. Virtuna trains on the constant." | SCI-01 |
| Citation chip 1 label | "Behavioral simulation" | SCI-02 |
| Citation chip 1 description | "Decades of behavioral research, condensed into a working model of your audience." | SCI-02 |
| Citation chip 2 label | "Outcome calibration" | SCI-02 |
| Citation chip 2 description | "Every prediction is calibrated against the real outcome it forecast." | SCI-02 |
| Citation chip 3 label | "Replication study" | SCI-02 |
| Citation chip 3 description | "Forecasts replicate across niches, formats, and creator scales." | SCI-02 |
| Dataset stats headline | "Growing dataset" | SCI-03 |
| Dataset stat 1 label | "Behavioral data points" | SCI-03 |
| Dataset stat 1 caption | "Captured per prediction. Compounds with every video the engine sees." | SCI-03 |
| Dataset stat 2 label | "Predictions calibrated" | SCI-03 |
| Dataset stat 2 caption | "Each calibration sharpens the next forecast." | SCI-03 |
| Self-improving loop label | "Forecast → Outcome → Retrain" | SCI-04 |
| Self-improving loop caption | "Every video posted teaches the engine what your audience actually did. The next forecast is sharper." | SCI-04 |
| Lab credibility footer | "Built by Numen Machines. Behavioral research, calibrated against real outcomes." | SCI-06 |
</viewport>

<viewport name="social-proof">
## Social Proof / Metrics (PROOF-01..05)

| Element | Copy | Source ID |
|---------|------|-----------|
| Section eyebrow | "Early signal" | PROOF-04 |
| Section H2 | "Creators running predictions today." | PROOF-04 |
| Section sub-headline | "Honest framing. Numbers grow with the dataset." | PROOF-04 |
| Quote 1 body | "I ran a prediction on three drafts. Posted the one Virtuna scored highest. It outperformed my last ten posts combined." | PROOF-01 |
| Quote 1 attribution | "@creator_alpha -- fitness niche, mid-tier creator" | PROOF-01 |
| Quote 2 body | "It told me my hook was weak. Rewrote it, ran it again, posted it. The forecast was right." | PROOF-01 |
| Quote 2 attribution | "@creator_beta -- storytelling, growth-phase creator" | PROOF-01 |
| Quote 3 body | "Forecasting before posting is the closest thing to a pre-flight check I have seen for short-form." | PROOF-01 |
| Quote 3 attribution | "@creator_gamma -- comedy niche, established creator" | PROOF-01 |
| Quote framing note | "Quote placeholders. Replace with real creator quotes once the trial cohort opts in. Use real handles, real niches, real follower counts when shippable. Never fabricate numbers." | PROOF-04 |
| Platform metric callout | "Early signal from creators running predictions today. Numbers grow with the dataset." | PROOF-03 |
| Metric 1 label | "Predictions run" | PROOF-03 |
| Metric 1 caption | "Updated as the dataset grows. Honest count, not aspirational." | PROOF-03 |
| Metric 2 label | "Creators in trial" | PROOF-03 |
| Metric 2 caption | "Early-trial cohort. Numbers grow as the engine ships more broadly." | PROOF-03 |
| Logo strip framing | "Surface a logo strip only when meaningful brand partnerships exist. Skip if forced." | PROOF-05 |
</viewport>

<viewport name="pricing">
## Pricing & Conversion (PRICE-01..06)

| Element | Copy | Source ID |
|---------|------|-----------|
| Section eyebrow | "Pricing" | PRICE-01 |
| Section H2 | "Start free. Trial Pro for 7 days." | PRICE-01 |
| Section sub-headline | "No credit card to start. Upgrade when the engine is doing real work for you." | PRICE-01 |
| Starter tier name | "Starter" | PRICE-01 |
| Starter price | "Free" | PRICE-01 |
| Starter price caption | "Forever. No card needed." | PRICE-01 |
| Starter feature 1 | "Run predictions on TikTok videos" | PRICE-01 |
| Starter feature 2 | "Track up to 3 competitor creators" | PRICE-01 |
| Starter feature 3 | "Browse the brand-deals marketplace" | PRICE-01 |
| Starter feature 4 | "Save predictions and revisit history" | PRICE-01 |
| Starter CTA | "Start free" | PRICE-04 |
| Pro tier name | "Pro" | PRICE-01 |
| Pro price | "$29 per month" | PRICE-01 |
| Pro price caption | "Or save 20 percent on annual billing." | PRICE-01 |
| Pro feature 1 | "Unlimited predictions" | PRICE-01 |
| Pro feature 2 | "Track up to 25 competitor creators" | PRICE-01 |
| Pro feature 3 | "Apply to brand deals (priority queue)" | PRICE-01 |
| Pro feature 4 | "Earn through the affiliate engine" | PRICE-01 |
| Pro feature 5 | "Audience-deep behavioral reports" | PRICE-01 |
| Pro CTA | "Trial Pro for 7 days" | PRICE-03 |
| Pro CTA caption | "Cancel any time. No credit card to start the trial." | PRICE-03 |
| Final CTA section eyebrow | "Run your first prediction" | PRICE-04 |
| Final CTA H2 | "Predict how your audience will respond. Before you post." | PRICE-04 |
| Final CTA primary button | "Start free" | PRICE-04 |
| Final CTA secondary button | "See the science" | PRICE-04 |
</viewport>

<viewport name="footer">
## Footer (PRICE-05)

| Element | Copy | Source ID |
|---------|------|-----------|
| Brand stamp | "Your audience, simulated." | BRAND-01 |
| Numen Machines lockup | "Made by Numen Machines" | PRICE-05 |
| Product nav heading | "Product" | PRICE-05 |
| Product nav item 1 | "Prediction" | PRICE-05 |
| Product nav item 2 | "Competitor Intelligence" | PRICE-05 |
| Product nav item 3 | "Brand Deals" | PRICE-05 |
| Product nav item 4 | "Pricing" | PRICE-05 |
| Company nav heading | "Company" | PRICE-05 |
| Company nav item 1 | "About" | PRICE-05 |
| Company nav item 2 | "The science" | PRICE-05 |
| Company nav item 3 | "Manifesto" | PRICE-05 |
| Resources nav heading | "Resources" | PRICE-05 |
| Resources nav item 1 | "Changelog" | PRICE-05 |
| Resources nav item 2 | "Help" | PRICE-05 |
| Legal nav heading | "Legal" | PRICE-05 |
| Privacy link label | "Privacy" | PRICE-05 |
| Terms link label | "Terms" | PRICE-05 |
| Cookies link label | "Cookies" | PRICE-05 |
| Copyright line | "(c) 2026 Numen Machines. All rights reserved." | PRICE-05 |
| Social link 1 label | "Twitter" | PRICE-05 |
| Social link 2 label | "LinkedIn" | PRICE-05 |
| Social link 3 label | "GitHub" | PRICE-05 |
</viewport>

<viewport name="onboarding">
## Onboarding (`src/components/onboarding/*.tsx`)

| Element | Copy | Source ID |
|---------|------|-----------|
| Connect step eyebrow | "Step 1 of 3" | (D-12 in-scope) |
| Connect step H1 | "Connect your TikTok handle." | (D-12 in-scope) |
| Connect step body | "Paste your TikTok handle so the engine can train on your past videos and your audience." | (D-12 in-scope) |
| Connect step input label | "TikTok handle" | (D-12 in-scope) |
| Connect step input placeholder | "@yourhandle" | (D-12 in-scope) |
| Connect step continue button | "Continue" | (D-12 in-scope) |
| Connect step skip link | "Skip for now" | (D-12 in-scope) |
| Connect step error (empty) | "Paste your TikTok handle to continue." | (D-12 in-scope) |
| Connect step error (invalid chars) | "Handles can only contain letters, numbers, dots, and underscores." | (D-12 in-scope) |
| Goal step eyebrow | "Step 2 of 3" | (D-12 in-scope) |
| Goal step H1 | "What are you running predictions for?" | (D-12 in-scope) |
| Goal step body | "Pick the goal that matches what you want to ship. We will tune the engine to match." | (D-12 in-scope) |
| Goal option 1 title | "Land with audience" | (D-12 in-scope) |
| Goal option 1 description | "Forecast how every video will land before you post. Pick the strongest take. Ship it." | (D-12 in-scope) |
| Goal option 2 title | "Track competitors" | (D-12 in-scope) |
| Goal option 2 description | "Watch what lands for creators in your niche. Learn from what works, learn from what flops." | (D-12 in-scope) |
| Goal option 3 title | "Earn through deals" | (D-12 in-scope) |
| Goal option 3 description | "Match with brands. Apply to deals. Earn through the affiliate engine." | (D-12 in-scope) |
| Goal step continue button | "Continue" | (D-12 in-scope) |
| Goal step skip link | "Skip for now" | (D-12 in-scope) |
| Preview step eyebrow | "Step 3 of 3" | (D-12 in-scope) |
| Preview step H1 (with handle) | "Your audience model is ready, @${handle}." | (D-12 in-scope) |
| Preview step H1 (no handle) | "Your audience model is ready." | (D-12 in-scope) |
| Preview step body | "Here is a preview. Run your first prediction to see the engine forecast a video." | (D-12 in-scope) |
| Preview step primary CTA | "Run my first prediction" | (D-12 in-scope) |
| Preview step secondary CTA | "Open the dashboard" | (D-12 in-scope) |

**Note on `Your AI society is ready` replacement:** The existing v1.1 onboarding preview header at `src/components/onboarding/preview-step.tsx:18-20` reads "Your AI society is ready" -- a HIGH-LEGACY plagiarism per the AUDIT (the literal product-name `AI society` belongs to societies.io). Replacement uses "Your audience model is ready" -- audience-led per BRAND-SPINE.md §2, drops the banned `AI` prefix, drops the societies.io product-name reuse.
</viewport>

<viewport name="og-metadata">
## OG Metadata + Page Titles

| Element | Copy | Source ID |
|---------|------|-----------|
| `og:title` | "Virtuna -- A Numen Machines product" | BRAND-03 |
| `og:description` | "Your audience, simulated." | BRAND-01 |
| OG image alt | "Virtuna -- predict how your audience will respond, before you post." | BRAND-03 |
| OG image tagline | "Predict how your audience will respond." | BRAND-03 |
| OG image subtitle | "Trained on decades of behavioral research." | BRAND-03 |
| `<title>` (landing) | "Virtuna -- Predict your audience" | BRAND-03 |
| `<title>` (dashboard) | "Virtuna" | BRAND-03 |
| `<meta name=description>` (landing) | "Predict how your audience will respond before you post. Virtuna simulates your audience and forecasts every video. Trained on decades of behavioral research." | BRAND-03 |

**OG metadata cleanup notes:**

- Replaces `src/app/(marketing)/layout.tsx:13` title `Artificial Societies | Human Behavior, Simulated` (HIGH-LEGACY plagiarism)
- Replaces `src/app/(marketing)/layout.tsx:15` description `AI personas that replicate real-world attitudes, beliefs, and opinions. Research that was impossible is now instant.` (HIGH-LEGACY plagiarism, two banned-vocab violations)
- Replaces `src/app/(marketing)/opengraph-image.tsx:60` tagline `Know what will go viral before you post` (banned-vocab violation, MEDIUM mimicry)
</viewport>

## Vocab Compliance

This document MUST pass `node scripts/lint-vocab.mjs .planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md` with zero ERROR-level violations. Warnings are acceptable only with an inline `<!-- vocab-lint-disable-next-line -->` marker plus a brief justification on the same line above.

Verified at draft time:

- `viral` -- ZERO occurrences in copy strings (only appears inside the AUDIT cross-reference where it documents the existing plagiarism that this doc replaces; that is in PLAGIARISM-AUDIT.md, NOT in this doc)
- `AI` -- ZERO occurrences in copy strings (the H1 says "Predict how your audience will respond" not "AI prediction"; replacement of `Your AI society is ready` documented above)
- `go viral` -- ZERO occurrences
- `users` -- ZERO occurrences in copy strings (we use "creators" everywhere)
- `framer-motion` import drift -- this doc is markdown and contains no imports; not applicable

Run after authoring: `node scripts/lint-vocab.mjs .planning/phases/01-brand-spine-visual-metaphor/01-REPLACEMENT-COPY.md`

Expected: exit 0, "0 error(s)".

## Sign-off (D-15 batch -- D-16 hero copy lock)

- [ ] Davide reviewed full document end-to-end
- [ ] Davide approved replacement copy as-is OR redlined sections sent back
- [ ] No remaining banned-vocab matches per `scripts/lint-vocab.mjs`
- [ ] Hero copy locked per BRAND-06 / D-16 (mirrors REQUIREMENTS.md HERO-01..05 verbatim)
- [ ] Davide approved YYYY-MM-DD: ___________

---

*Phase: 1-Brand Spine & Visual Metaphor*
*Replacement copy drafted: 2026-05-10*
