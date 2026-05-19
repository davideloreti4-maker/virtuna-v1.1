# Feature Research: SaaS Landing Page Sections & Interaction Patterns

**Domain:** Single-page SaaS marketing landing (creator-tool / AI-prediction vertical)
**Researched:** 2026-05-19
**Confidence:** HIGH — sourced from SaaSFrame, Eleken, Webstacks, Mantlr, official craft analysis; cross-verified across multiple sources.
**Craft references:** Linear, Stripe, Vercel, Raycast — used for structural/interaction patterns only. No creative content reproduced.

---

## 1. Hero Section Patterns

### Layout Geometry

**Table stakes:**
- Centered single-column layout (headline + sub + CTA block, full-width container) — dominant pattern at top-tier SaaS; text-left / image-right is an acceptable variant but feels more conventional
- H1 at display weight (48–72px desktop, 32–44px mobile), under 8 words, under 44 characters
- Subheadline at body-large (18–20px), 1–2 lines maximum, expanding on the H1 promise
- Two-CTA model: primary (high contrast, "Get started free" / "Try free") + secondary visually subordinate ("See how it works" / "Watch demo") — positioned horizontally on desktop, stacked on mobile
- Hero visual below the text block on mobile (text always above fold on small screens)

**Pre-headline element (eyebrow / badge):**
- Table stakes: a small pill/badge above the H1 — used to carry a product announcement ("Now in beta", "TikTok creators only"), a social-proof micro-claim ("Trusted by 2,000+ creators"), or a category anchor ("AI content intelligence")
- Styling: bordered pill with low-opacity fill, 12–14px text, slight icon or arrow affordance
- Purpose: anchors category before the H1 lands; filters audience in the first second

**Hero visual conventions — ranked by conversion signal:**
1. Product UI screenshot (most trusted for B2B/creator tools — shows the actual thing)
2. Animated product preview — looping motion that simulates product behavior without full interactivity
3. Abstract gradient / geometric composition — works only when paired with very concrete headline; alone signals "nothing to show yet"
4. Full-video hero background — high production cost, accessibility risk (motion sensitivity), load weight — reserve for brand moments, not conversion heroes

**Social proof in hero zone:**
- Logo strip immediately below CTA block OR integrated as micro-badges adjacent to CTA
- Single stat ("Used by X creators", "Y predictions run") performs better than a wall of logos at hero density
- Star rating + review count (G2-style) if reviews exist

**Differentiator:**
- Scroll-triggered product reveal that begins in the hero — the screenshot or UI preview animates in as the user arrives (fade-up + subtle scale from 0.96 to 1.0), signaling interactivity before any scroll
- An embedded interactive demo widget in the hero section (Storylane / Arcade / custom) — lets the visitor click one action in the actual product before signing up; dramatically increases intent signal
- A live "try it" input field in the hero itself (e.g. paste a TikTok URL → get a prediction score) — extremely high differentiation for Virtuna specifically

**Anti-patterns:**
- "Build the future of work" / aspirational non-specific headlines (signals no product yet)
- Purple-to-blue gradient as the hero's primary visual (AI-slop signal, 2024–2025 saturation)
- Auto-play full-page video with audio — fails accessibility, fails mobile bandwidth
- Three or more CTAs competing in the hero — decision paralysis
- H1 font under 40px at 1440px — reads as body copy, not a declaration
- Decorative animated beams / neon glow / particle systems as the hero backdrop — maximalist-template aesthetic, conflicts with restrained craft standard

**Build cost:** LOW–MEDIUM (1–2 days for layout; +1 day if live demo widget is included)

---

## 2. Feature Grid / Bento Section Patterns

### Layout Geometry

**Table stakes:**
- A dedicated section introducing the product's core surfaces / capabilities, positioned after the hero
- Minimum: 3-column grid of equal-size cards (icon + headline + 1-line description) — the "feature list" convention
- Each card: icon (24–32px), headline (16–20px semi-bold), supporting text (14px, 2 lines max), optional mini-visual

**Bento grid (differentiator-tier):**
- Mixed-size card grid where card size maps to feature importance — 2×2 flagship feature, 1×1 supporting features
- Base unit 100px, gutters 16–24px desktop / 12px mobile; 3–4 col desktop, 2 col tablet, 1 col mobile
- Visual-to-text ratio per card: large cards 60–70% visual, small cards 40–50% visual
- Content per card: headline (max 6 words), supporting line (1–2 lines), visual — no body paragraphs
- Cards can contain embedded mini UI screenshots, micro-animations on hover, or live data previews

**For Virtuna's three surfaces (Prediction / Competitor Intel / Brand Deals):**
- Three equal-prominence cards risks under-selling the flagship (Prediction) — a 2×2 flagship card for Prediction surrounded by 1×1 cards for the other surfaces is the stronger hierarchy
- Each bento card should contain a product UI fragment (not abstract illustration) to anchor the feature claim visually

**Hover behavior (table stakes):**
- Subtle lift: `translateY(-4px)` + shadow increase, 200–300ms ease-out
- Border lightens slightly on hover (from 6% to 10% alpha) — aligns with Raycast hover convention already in DS

**Differentiator:**
- Cards with scroll-triggered reveal: each card fades and slides up (8–16px) in staggered sequence (80ms delay per card) as the section enters the viewport
- Interactive mini-previews: hover over a card triggers a 2–3 second looping animation of the feature in action
- A "live" card: one bento cell shows a live counter or real data fetched at render time (e.g. "Predictions run today: 1,247")

**Anti-patterns:**
- Equal-size grid of 6+ feature cards with identical icon-headline-body structure — reads as a spec sheet, not a product showcase
- Illustrations that depict generic concepts (charts, graphs, people) rather than the actual product UI
- More than 3 lines of text per card — breaks card density contract
- Missing mobile reorder: desktop card #1 ≠ mobile card #1 — must reorder by importance on mobile
- Cards with no visual element (text-only) — loses cognitive chunking benefit of the bento format

**Build cost:** LOW for basic grid; MEDIUM for bento (1–2 days); HIGH for animated/interactive bento (3–4 days)

---

## 3. "How It Works" / Product Walkthrough Patterns

### Sequential Step Pattern (table stakes)

- 3–5 numbered steps in a horizontal row (desktop) or vertical stack (mobile)
- Each step: step number + short headline + 1-line description
- Step visual: small icon or mini product screenshot
- Horizontal connector line between steps on desktop (visual progress metaphor)

### Scroll-Pinned Walkthrough (differentiator)

The highest-craft pattern at this tier: a section with a pinned visual panel on the right (or left) that transitions between product states as the user scrolls through step cards on the opposite side.

Mechanics:
- Outer container: `position: sticky; top: X` on the visual panel
- Left column: step cards scroll normally, each step entering viewport triggers panel transition
- Panel transition: crossfade between screenshots (200–300ms), or slide-in of new UI state
- Framework: Framer Motion `useScroll` + `useTransform` on `scrollYProgress`, or scroll-triggered CSS animations

Why it works: shows product depth without requiring click; communicates a workflow naturally; eliminates "how do I even use this" hesitation.

**For Virtuna specifically:** the three-step flow (paste/enter content → AI analysis runs → see prediction + recommendations) is a natural 3-step scroll-pinned walkthrough. Visual panel transitions between the input state → loading state → results state as user scrolls.

### Animated Diagram / Flow Pattern

- SVG or canvas-based flow connecting input → engine → output
- Self-draws on scroll entry (path animation via `stroke-dashoffset`)
- Works well for communicating "AI processing" or "behavioral analysis" without showing raw UI
- Higher complexity; often reserved for "under the hood" or behavioral science section

**Differentiator:**
- Before/after comparison: split-panel or slider showing creator state before Virtuna vs after — concrete outcome framing
- Step-specific micro-animation: each step tile has a small looping animation (e.g. waveform for "analyze content", graph ascending for "predict performance")

**Anti-patterns:**
- Generic 3-step "Upload → Analyze → Download" with abstract icons and no product UI — explains nothing
- An animation that runs once on page load and cannot be re-triggered — users who scroll back miss it
- Autoplay video embedded mid-page without a play button — unexpected, fights scroll flow
- "Steps" that don't map to real product actions — reads as marketing invention, not product truth

**Build cost:** LOW for numbered steps; MEDIUM for scroll-pinned (2–3 days); HIGH for animated flow diagram (3–5 days)

---

## 4. Social Proof Patterns

### Table Stakes

**Logo strip:**
- 6–10 brand logos in a horizontal row, low-opacity or desaturated treatment, immediately below hero or immediately before pricing
- Mobile: horizontal scroll or 2-row grid
- If no recognizable brand names exist yet: do not fake with placeholder names; substitute with a stat claim ("2,000+ creators" or "14,000 predictions run")

**Testimonial cards:**
- Minimum: 1 prominent testimonial with full attribution (name, handle or role, avatar photo)
- Best pattern: 2–3 cards in a horizontal row; avoid walls of 6+ testimonials at same density
- Card anatomy: quote (2–4 lines) + avatar + name + role/company — in that order

**Stat counters:**
- 2–4 bold numbers with labels: "X predictions run", "Y% accuracy", "Z creators"
- Animated count-up on scroll entry (requestAnimationFrame or Framer Motion `animate`)
- Counters only land if the numbers are above ~1,000; below that they read as nascent/pre-launch signal

### Differentiator

- Video testimonial embedded as an autoplaying (muted) loop thumbnail — click expands to full video modal
- A "wall of love" section: grid of social media posts / screenshots of real creator reactions — high authenticity signal
- Results framing: testimonials that pair a specific outcome with the quote ("My view-through rate went from 34% to 61%" — Name) — outcome-specific social proof outperforms generic praise
- "Used by creators at" + recognizable brand names as employer/agency context — if applicable

**Anti-patterns:**
- Generic testimonials without attribution photo/handle — reads as fabricated
- Logo strips with logos the product has never worked with — legal and trust risk
- Star ratings without a review count — "5 stars" without context is meaningless
- Stacking logo strip + testimonials + stat counters + review widget all in one section — visual noise; pick 2–3 types maximum and space them throughout the page narrative
- Carousel/slider for testimonials on desktop — users don't click; show 2–3 cards directly

**Build cost:** LOW for static layout; MEDIUM if count-up animation included (1–2 days); HIGH for video testimonials (3+ days)

---

## 5. Pricing Section Patterns

### Tier Architecture

**For Virtuna (Starter / Pro — two-tier):**
- Two tiers is the minimum viable pricing layout; it works best when the product story is: "free/low tier to try, paid tier to get the full value"
- Two-tier risk: insufficient anchoring — the "Pro" value isn't as clear without a middle option. Mitigate by making Pro visibly more prominent (larger card, highlighted border, "Most Popular" badge)
- Layout: two cards side-by-side, Pro card elevated or highlighted, Starter card slightly recessed or muted

**Table stakes elements:**
- Monthly / Annual toggle at top of section with explicit savings callout ("Save 20% annually") — single biggest conversion lever on pricing pages; annual plan uptake increases 25–35% with toggle
- Each card: plan name, price (large, prominent), billing period, 1-sentence value prop, CTA button, 6–10 feature bullets with check marks
- "Most Popular" / "Recommended" badge on Pro card — center-stage positioning increases selection
- A "7-day trial" or "Try free" note on the CTA button (not buried in small print)

**Comparison table:**
- For two-tier: a collapsible full-feature comparison table below the cards — "Compare all features" toggle; collapsed by default, expanded on click
- Row categories: "Core features", "AI capabilities", "Support", "Limits" — group logically, not alphabetically
- Check/dash pattern: green check for included, gray dash for excluded — enables rapid scan

**FAQ:**
- Embedded on the same page, positioned directly below pricing cards
- 4–6 items max, collapsed accordion
- Topics that must be covered: trial terms, cancellation policy, what happens at plan expiry, what's actually in each tier
- Do not link to a separate FAQ page from pricing — conversion breaks

**Differentiator:**
- A toggle between "Individual creator" and "Agency" context that reframes the pricing narrative for each audience — relevant since Virtuna's audience includes individual creators and potentially brand/agency buyers
- ROI framing adjacent to Pro CTA: "At Pro, one brand deal found pays for 6 months" — outcome math next to the price
- A feature spotlight card between the two tiers showing the single most compelling Pro-only feature — interrupts the comparison and directs attention

**Anti-patterns:**
- Hiding trial terms in footnote text — kills trust at decision moment
- Three-tier layout when the third tier is "Enterprise — contact us" with no pricing information — creates confusion for self-serve buyers
- Feature comparison table always visible (uncollapsed) on load — 40+ rows overwhelm; collapse and let interested buyers expand
- No FAQ on pricing page — forces users to search elsewhere; 30–40% leave and don't return
- Per-feature lock icons (showing locked features to free users in-product is fine; on the landing page it reads as hostile)

**Build cost:** LOW for two-card layout with toggle (1–2 days); MEDIUM with collapsible comparison table + FAQ accordion (2–3 days)

---

## 6. Footer Patterns

### Table Stakes (single-page landing footer)

- Minimal approach: logo left, copyright center or left, 3–5 legal links right (Privacy, Terms, Cookie Settings)
- Optional: thin horizontal section above legal footer with a final CTA — "Ready to start?" + primary button (catches users who scroll to the bottom without converting)
- Social links: icon row (Twitter/X, Instagram, TikTok) — small, low visual weight, not competing with CTA

**Marketing CTA footer variant (recommended for conversion-focused landing):**
- Full-width row above legal strip: large headline ("Start predicting") + CTA button
- This pattern catches late-scroll users who read the full page and are ready at the end

**Link density:**
- For a single-page landing: keep below 8 total links in footer
- For a landing page that links to /about, /blog, /careers: use a 3–4 column sitemap-lite with section headings — but only add these if the pages actually exist; stub links to nowhere signal unfinished product

**Brand lockup placement:**
- Logo top-left of footer or centered above the CTA block — always present, even minimally
- No tagline in footer — already covered in hero; repeating it reads as filler

**Anti-patterns:**
- Full navigation header duplicated in footer — adds no value, increases link count without purpose
- Heavy embedded social widgets (Instagram feed, Twitter timeline) — page weight, layout shift risk
- "Built with [tool]" badges from website builders — low-craft signal
- Copyright year hardcoded (not dynamic) — signals abandoned/unattended site
- Footer with zero links except copyright — feels like a dead end; at minimum include Privacy and Terms

**Build cost:** LOW (0.5–1 day)

---

## 7. Cross-Cutting Interaction Patterns

### Scroll-Linked Reveals (table stakes)

- Fade-up on entry: `opacity: 0 → 1` + `translateY: 16px → 0`, triggered when element is 20% into viewport
- Stagger for sibling groups: 60–80ms delay between cards in a row — avoids the "everything appears at once" effect
- Fire once, do not replay on scroll-back — replaying is jarring
- Framer Motion `whileInView` + `viewport={{ once: true, amount: 0.2 }}` — standard implementation
- Respect `prefers-reduced-motion`: all scroll animations degrade to instant if user has motion sensitivity set

### Hover Micro-Interactions (table stakes)

- Every interactive element has 3 designed states: default, hover, active/focus
- CTA buttons: background color shift + subtle scale (1.02) + easing (200ms ease-out) — NOT just color swap
- Cards: `translateY(-4px)` + shadow increase — matches existing DS hover convention
- Links: underline on hover with color shift to brand coral
- Focus rings: high-contrast, visible, designed (not browser default) — WCAG AA minimum

### Sticky Navigation + CTA (table stakes)

- Navigation bar: transparent on hero, transitions to dark (matches page bg) with subtle bottom border after ~80px scroll
- Primary CTA always visible in nav ("Get started") — on mobile collapses to icon or CTA-only
- Scroll-to-section anchor links in nav (no page reloads on a single-page landing)
- Smooth scroll behavior: `scroll-behavior: smooth` or JS-based with easing

### Sticky "Get Started" CTA (differentiator)

- A floating CTA bar that appears after the user scrolls past the hero CTA and disappears near the pricing section — "ambient CTA" pattern
- Appears from bottom of screen on mobile after ~50% scroll
- Does not overlap the footer or pricing section — hides when those sections are in viewport

### Theme Toggle (optional / low priority for Virtuna)

- Virtuna is dark-mode first; light mode is explicitly deferred in PROJECT.md
- Do not implement a theme toggle for this milestone — it adds complexity without product value at this stage
- Anti-pattern: implementing a non-functional or visually broken theme toggle signals incomplete product

### Command-K / Demo Widget (differentiator)

- A live prediction input embedded on the landing page — either in the hero or as its own demo section — is the highest-differentiation interaction for Virtuna
- Not a command palette (that's an in-app pattern); the landing-page equivalent is a "try it" widget: user pastes a TikTok URL or enters a content description, gets a live confidence score or teaser result
- Requires real API call or a credible-looking demo response — a fake spinner is worse than not having it
- If real API is not feasible for landing: an "interactive tour" built in Arcade/Storylane that walks through a real session is a credible substitute

### Animation Philosophy (cross-cutting)

The Linear / Stripe / Vercel craft standard is restraint + purposefulness:
- Motion communicates state change or directs attention — not decoration
- Easing curves are defined, not arbitrary: ease-out for entrances (300–400ms), ease-in for exits (200ms), spring for interactive feedback
- Two properties animated at once maximum per element (opacity + transform) for performance
- Hardware-accelerated only: `transform` and `opacity` — never animate `margin`, `height`, `width`, `top`
- All transitions must pass: "would a user notice if this was removed?" — if yes, keep; if decorative only, cut

**Anti-patterns (cross-cutting):**
- Identical fade-in on every single element — over-animated, reads as template default
- Motion that replays on every scroll-back — disorienting
- Scroll-linked parallax on full-page backgrounds — performance risk, motion-sensitivity problem
- Elements that "snap" without easing (instant color changes, instant position changes on hover)
- `animate: true` on Framer Motion components without `viewport={{ once: true }}` — re-animates every scroll-pass
- Neon glow / particle stream / animated gradient background as primary visual system — conflicts with Linear/Raycast restraint standard

---

## Feature Dependencies

```
Hero
    └──requires──> Nav (sticky)
    └──enables──> Social proof (logo strip adjacent to CTA)

Feature Grid / Bento
    └──requires──> Design system card component (already exists in DS)
    └──enhances──> "How it works" (bento introduces surfaces; walkthrough deepens them)

"How it works"
    └──requires──> Product screenshots or UI captures (must be created)
    └──benefits from──> Framer Motion (already in stack?)

Social Proof
    └──requires──> Real testimonials + attribution (content dependency — not a build dependency)
    └──requires──> Real stat numbers (predictions run, creators count)

Pricing
    └──requires──> Tier definitions (already exist: Starter / Pro)
    └──requires──> Whop plan IDs (known blocker per PROJECT.md)
    └──requires──> FAQ copy (content)

Footer
    └──requires──> Legal pages (Privacy, Terms — stub or existing)

Scroll Animations (cross-cutting)
    └──requires──> Framer Motion (or CSS scroll-timeline)
    └──requires──> prefers-reduced-motion media query handling

Live Demo Widget (differentiator)
    └──requires──> Prediction API or credible demo mode
    └──blocks on──> API feasibility check (high complexity)
```

---

## MVP Definition for Phases

The roadmap consumer should scope phases around these natural section boundaries:

### Phase 1 — Nav + Hero (P1, table stakes)
- Sticky transparent-to-dark nav with anchor links + CTA
- Centered hero: eyebrow badge + H1 + sub + dual CTA + product screenshot visual
- Logo strip / stat social proof below CTA
- Scroll-reveal entrance animation
- Build cost: 1.5–2 days

### Phase 2 — Feature Bento (P1, table stakes + differentiator)
- Mixed-size bento grid for three product surfaces (Prediction flagship 2×2, Competitor Intel 1×1, Brand Deals 1×1)
- Staggered scroll-reveal on card entry
- Hover lift + border brighten on cards
- Product UI fragments as card visuals
- Build cost: 2–3 days

### Phase 3 — How It Works (P1, differentiator)
- Scroll-pinned two-panel walkthrough (step cards left, pinned UI preview right)
- 3 steps matching Virtuna's actual flow: input → analysis → results
- Screenshot transitions on scroll progress
- Build cost: 2–3 days

### Phase 4 — Social Proof (P2, table stakes)
- Testimonial cards (2–3 real or representative) with full attribution
- Stat counters with count-up animation
- Logo strip if applicable
- Build cost: 1–1.5 days

### Phase 5 — Pricing (P1, table stakes)
- Two-card layout (Starter / Pro) with annual/monthly toggle
- "Most Popular" badge on Pro, trial note on CTA
- Collapsible feature comparison table
- Embedded FAQ accordion (4–6 items)
- Build cost: 2–3 days

### Phase 6 — Footer + Final CTA (P1, table stakes)
- Full-width final CTA row ("Start predicting")
- Minimal footer: logo + legal links + social icons
- Build cost: 0.5 days

### Phase 7 — Motion + Polish Pass (P2, cross-cutting)
- Sticky nav transition tuning
- Floating mobile CTA
- Motion reduced preference handling
- Cross-browser and mobile responsive QA
- Playwright snapshot verification per section
- Build cost: 1–2 days

### Defer (out of scope this milestone)
- Live demo widget / prediction input in hero (requires API feasibility; can be added post-launch)
- Theme toggle (light mode deferred in PROJECT.md)
- Video testimonials (content dependency)
- Interactive Arcade/Storylane tour (content + tooling dependency)

---

## Feature Prioritization Matrix

| Feature | User Value | Build Cost | Priority |
|---------|------------|------------|----------|
| Hero (centered, dual-CTA, screenshot) | HIGH | LOW | P1 |
| Sticky nav with anchor links | HIGH | LOW | P1 |
| Bento feature grid (3 surfaces) | HIGH | MEDIUM | P1 |
| Pricing cards + annual toggle | HIGH | MEDIUM | P1 |
| Collapsible comparison table | MEDIUM | MEDIUM | P1 |
| FAQ accordion on pricing page | HIGH | LOW | P1 |
| Scroll-pinned how it works | HIGH | MEDIUM | P1 |
| Testimonial cards (2–3) | HIGH | LOW | P2 |
| Stat counters with count-up | MEDIUM | LOW | P2 |
| Staggered card scroll reveals | MEDIUM | LOW | P2 |
| Final CTA footer row | MEDIUM | LOW | P1 |
| Minimal footer | HIGH | LOW | P1 |
| Floating mobile CTA | MEDIUM | LOW | P2 |
| Live prediction demo widget | HIGH | HIGH | DEFER |
| Logo strip | LOW (if no known brands) | LOW | P2 |
| Video testimonials | HIGH | HIGH | DEFER |
| Theme toggle | LOW | HIGH | DEFER |

---

## Sources

Research grounded in:
- [SaaSFrame — Designing Bento Grids That Actually Work (2026)](https://www.saasframe.io/blog/designing-bento-grids-that-actually-work-a-2026-practical-guide)
- [SaaSFrame — 10 SaaS Landing Page Trends for 2026](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples)
- [Mantlr — How Stripe, Linear, and Vercel Ship Premium UI](https://mantlr.com/blog/stripe-linear-vercel-premium-ui)
- [Webstacks — SaaS Pricing Page Design](https://www.webstacks.com/blog/saas-pricing-page-design)
- [Eleken — Footer UX Patterns (2026)](https://www.eleken.co/blog-posts/footer-ux)
- [Alf Design Group — SaaS Hero Section Best Practices](https://www.alfdesigngroup.com/post/saas-hero-section-best-practices)
- [925 Studios — AI Slop Web Design Anti-Patterns (2026)](https://www.925studios.co/blog/ai-slop-web-design-guide)
- [Draftss — Best SaaS Hero Examples 2025](https://draftss.com/best-saas-hero-examples/)
- [Motion.dev — Scroll-Linked Animations (Framer Motion)](https://motion.dev/docs/react-scroll-animations)
- [Saashero.net — Social Proof Landing Page Tactics](https://www.saashero.net/content/landing-page-social-proof-examples/)
- [SaaSUI — 7 SaaS UI Design Trends 2026](https://www.saasui.design/blog/7-saas-ui-design-trends-2026)

---
*Feature research for: SaaS landing page sections and interaction patterns*
*Scoped to: Linear Landing Clone milestone — Virtuna landing rebuild*
*Researched: 2026-05-19*
