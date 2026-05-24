# Phase 2: Hero Shell + Final CTA Bookend + Vision Beat - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 02-hero-shell-final-cta-bookend-vision-beat
**Areas discussed:** Hero copy lock, CTA strategy, Vision Beat, Footer architecture

---

## Hero Copy Lock

### H1 outcome-pattern: 'AI that [verb][object]' — which direction?

| Option | Description | Selected |
|--------|-------------|----------|
| Score before post | 'AI that scores your TikToks before TikTok does.' (matches OG meta) | |
| Predict viral | 'AI that predicts which TikToks go viral — before you post.' | |
| Simulate audience | 'AI that simulates your audience reaction — before you ever post.' | |

**User's choice:** Free-text — "ideally not copy using AI"

**Notes:** User steered away from any "AI that..." prefix as brand-voice direction. Claude re-presented three non-AI alternatives:
- A: "Predict viral before you post." (matches <title>)
- B: "Score every TikTok before TikTok does." (OG-aligned)
- C: WordRotate fused inside H1 — "Predict viral for [creators/brands/founders] before you post."

---

### H1 direction — pick one (working-draft mode)

| Option | Description | Selected |
|--------|-------------|----------|
| C — H1+rotate fused | 'Predict viral for [creators/brands/founders] before you post.' — WordRotate inside H1 | ✓ |
| A — short hook | 'Predict viral before you post.' + WordRotate on second line | |
| B — score-before-TikTok | 'Score every TikTok before TikTok does.' | |

**User's choice:** C — H1+rotate fused
**Notes:** Most distinctive option; one sentence, WordRotate is a word slot inside the H1.

---

### WordRotate cycle — which audience-target words?

| Option | Description | Selected |
|--------|-------------|----------|
| creators/brands/founders | Dual-purpose creator + investor signal | ✓ |
| creators/brands/agencies | ROADMAP-suggested set | |
| creators/brands/marketers | Broader B2B reach | |

**User's choice:** creators/brands/founders
**Notes:** "founders" replaces ROADMAP's "agencies" deliberately — sharper investor resonance.

---

### Sub-headline pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Outcome + time | 'Simulate audience reactions and get a viral score in 30 seconds — no real posting required.' | |
| Science-led | 'Behavioral models trained on creator data score every post before it ships.' | |
| Two-line risk-killer | 'Stop guessing what'll hit. Score, refine, ship — with confidence.' | |

**User's choice:** Free-text — leans option 3, asked Claude for honest opinion

**Notes:** Claude's take: option 3 has strongest conversion pull but "with confidence" reads filler-y. Proposed tightened version fusing option 3 risk-killer + option 1 time signal.

---

### Sub-head lock

| Option | Description | Selected |
|--------|-------------|----------|
| Tightened option 3 | 'Stop guessing what'll hit. Score, refine, ship — in 30 seconds.' | ✓ |
| Pure option 3 | 'Stop guessing what'll hit. Score, refine, ship — with confidence.' | |

**User's choice:** Tightened option 3
**Notes:** Drops "with confidence" filler, adds concrete "30 seconds" time signal.

---

### Copy lock status for Phase 2 ship

| Option | Description | Selected |
|--------|-------------|----------|
| Lock now | Final ship copy | |
| Working draft | Iterable through Phase 11 polish; position/structure locked | ✓ |

**User's choice:** Working draft

---

## CTA Strategy

### Primary CTA label (ShimmerButton)

| Option | Description | Selected |
|--------|-------------|----------|
| Score your first TikTok | Verb + object + ownership (OpusClip pattern) | ✓ |
| Try the demo | Lower-commitment, sends to #demo | |
| Get your viral score | Pure outcome | |
| Start predicting | Echoes H1 verb | |

**User's choice:** Score your first TikTok

---

### Primary CTA destination

| Option | Description | Selected |
|--------|-------------|----------|
| #demo anchor | Smooth-scroll to Phase 4 scripted demo | ✓ |
| /signup flow | Direct funnel to Whop signup | |
| Configurable | ENV flag for A/B | |

**User's choice:** #demo anchor

---

### Secondary CTA label + destination

| Option | Description | Selected |
|--------|-------------|----------|
| See pricing → #pricing | Direct, OpusClip-mirroring | ✓ |
| View pricing → #pricing | Softer verb | |
| How it works → #how-it-works | Investors-first routing | |

**User's choice:** See pricing → #pricing

---

### Final CTA copy strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Verbatim mirror | Same H1 + sub + buttons as Hero | ✓ |
| Paraphrase same promise | Different words, same outcome | |
| Verbatim H1 + new sub | Mirror H1, swap sub-head | |

**User's choice:** Verbatim mirror
**Notes:** Strongest bookend symmetry; zero drift risk.

---

## Vision Beat

### Quote angle (attributed 'Davide Loreti, Founder, Virtuna')

| Option | Description | Selected |
|--------|-------------|----------|
| Behavioral-science thesis | "Virality isn't luck — it's a behavioral signal. We built Virtuna to surface that signal before you bet on the post." | ✓ |
| Creator-empathy frame | "Every creator has lost a week to a post that flopped. Virtuna is the antidote to that gut-feel guess." | |
| Anti-luck manifesto | "The best creators don't post and pray. They predict — and so should you." | |
| I'll write it later | Placeholder, supply final before Phase 11 | |

**User's choice:** Behavioral-science thesis
**Notes:** Investor-leaning, leverages PROJECT.md science differentiator.

---

### Visual container

| Option | Description | Selected |
|--------|-------------|----------|
| Centered pull-quote | Italic large quote, no card | |
| GlassPanel card | Raycast 137deg gradient + 5px blur | ✓ |
| Bordered card | 6% border, 12px radius | |

**User's choice:** GlassPanel card

---

### Attribution treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Plain text | '— Davide Loreti, Founder, Virtuna' | ✓ |
| Plain text + role chip | Coral border-bottom under role | |

**User's choice:** Plain text
**Notes:** Matches REQ VISION-01 — no photo, no signature for v1.

---

## Footer Architecture

### 4-column structure

| Option | Description | Selected |
|--------|-------------|----------|
| Product / Company / Legal / Social | Standard SaaS | ✓ |
| Product / Resources / Legal / Social | Dev-friendly swap | |
| Sections / Account / Legal / Social | Anchors-led | |

**User's choice:** Product / Company / Legal / Social

---

### Stub-route strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Real placeholder pages | /privacy + /terms real pages; others href='#' aria-disabled | ✓ |
| All href='#' aria-disabled | Zero new routes | |
| Real legal only | Hide About/Careers/Blog from footer | |

**User's choice:** Real placeholder pages
**Notes:** Investor-credibility signal; missing legal pages flag in due-diligence review.

---

### Social platforms

| Option | Description | Selected |
|--------|-------------|----------|
| X + LinkedIn + TikTok | Three-platform recommended set | |
| TikTok + X only | Two-platform focus | |
| X + LinkedIn only | B2B feel | |
| All four (add YouTube) | YouTube long-form | |

**User's choice:** Free-text — "option 1 + instagram" → X + LinkedIn + TikTok + Instagram (four platforms)

---

### Numen Machines lockup placement

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom strip, full-width | Below 4 columns, centered | ✓ |
| Inside Company column | Nested under Company links | |
| Top of footer, prominent | Above 4 columns | |

**User's choice:** Bottom strip, full-width
**Notes:** Top placement would double up with Phase 3 above-fold logo bar.

---

## Claude's Discretion

Areas user delegated to Claude / planner / executor (logged in CONTEXT.md `<decisions>` § Claude's Discretion):

- Spotlight position + intensity (single-stop coral alpha gradient locked, exact origin + alpha stops open)
- Hero vertical rhythm at 375px mobile pre-Phase 3 credibility hook
- BorderBeam loop duration/easing (honor triggerOnce + VIZ-02 single-pulse)
- WordRotate interval timing + reduced-motion fallback

## Deferred Ideas

- Hero credibility hook + Spline 3D scene — Phase 3
- Header "Sign up" CTA copy lock — Phase 11 cutover or dedicated copy-pass
- Founder photo / signature in Vision Beat — explicitly out per VISION-01
- Real About / Careers / Blog pages — post-launch when content exists
- A/B test primary CTA destination (#demo vs /signup) — future conversion phase
- Real Numen Machines SVG lockup — Phase 9 content gate; text lockup acceptable for Phase 2
