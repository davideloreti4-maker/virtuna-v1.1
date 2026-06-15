# Phase 4: Proof & Conversion - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the trust + conversion tail of the single-scroll landing: a **social-proof
strip**, a **testimonials** block, a **pricing teaser**, a **final full-width CTA band**,
and an **accessible FAQ accordion**. Fills the remaining `#pricing` / `#faq` stubs in
`src/app/(marketing)/page.tsx` and inserts the new proof / testimonials / CTA-band
sections. Marketing surface only — every product visual is a labelled, swappable
`<Placeholder>` slot; no engine/app/Supabase logic beyond the CTA link.

Requirements: PROOF-01, PROOF-02, CONVERT-01, CONVERT-02, CONVERT-03 (5).

**Coverage map:** PROOF-01 → social-proof strip (D-01..D-04); PROOF-02 → testimonials
(D-05..D-07); CONVERT-01 → pricing teaser (D-08..D-11); CONVERT-02 → final CTA band
(D-12..D-14); CONVERT-03 → FAQ accordion (D-15..D-17). Order + nav: D-18..D-19.
Cross-cutting conversion lens: D-20..D-21.

**The phase optimizes for CONVERSION** (explicit human steer): drafted realistic
swap-quotes, result metrics, and trust stats are in-bounds. Do NOT hand-wring about
the pre-launch honesty gap — placeholders are swap slots by construction. Refined >
flashy still holds: this is the calm flat-warm system, the conversion levers are
typographic + structural, not loud.
</domain>

<decisions>
## Implementation Decisions

All decisions were taken by the human (Davide) during discussion — each is an accepted
recommendation (the recommended option was selected on every question), not an inference.

### Social-proof strip (PROOF-01)
- **D-01 (two-part proof, split placement):** Proof is split for conversion — a **thin
  high-trust strip** placed **directly under the hero** (top trust bar), and a fuller
  **testimonials block** down in the conversion zone (D-05, after `#features`). NOT one
  combined block.
- **D-02 (strip = stat + logo marquee):** The strip pairs a **headline trust stat** with
  a **logo marquee**. Reuse `src/components/ui/marquee.tsx` for the auto-scroll (reduced-
  motion-gated). Reads as "real product, real traction" the instant the hero resolves.
- **D-03 (logos = placeholder creator/brand swap slots):** The logo wall is a marquee of
  **`<Placeholder variant="logo">`** slots — neutral stand-ins the human swaps for real
  creator/partner/press logos later. NOT real platform marks ("works with TikTok"), NOT
  press "as seen in" (pre-launch = nothing real yet). Honest-by-construction + flexible.
- **D-04 (stat = creator peer-count):** Headline stat is a **peer social-proof count** —
  e.g. **"Join 2,000+ creators"** ("people like me use this", highest-converting framing).
  The number is a swappable placeholder. NOT an activity stat ("simulations run") or a
  loose outcome claim ("300M+ views predicted").

### Testimonials (PROOF-02)
- **D-05 (placement = conversion zone, after `#features`):** The testimonials block sits
  **after `#features`**, before pricing — the social-proof beat right before the ask.
- **D-06 (3 quote cards, static grid):** **Three** testimonial cards in a **static grid**
  (NOT a marquee carousel, NOT 6+). Higher individual-quote impact; calm, no extra motion.
- **D-07 (card anatomy = avatar + identity + quote + result metric):** Each card =
  **`<Placeholder variant="avatar">`** + name + **@handle** + a **punchy drafted quote**
  + a **result metric** (e.g. "+2.3M views", "3× my hook rate"). Outcome proof is the
  conversion lever — keep the metric. All fields are swap slots / drafted copy.

### Pricing teaser (CONVERT-01)
- **D-08 (two tier cards, Pro highlighted):** Two cards side by side — **Starter** + **Pro**
  — with Pro visually highlighted as **"Most popular."** 3–4 benefit bullets each. NOT a
  single light card, NOT a full feature-matrix table (that's the real `/pricing` route).
- **D-09 (Starter = "Free to start", Pro = placeholder $/mo + trial):** Starter framed
  **"Free to start"** (5 sims/mo, mirrors the real model); Pro shows a **placeholder
  monthly price** (e.g. `$19/mo`, swappable) + a **"7-day free trial"** badge. Free entry
  removes friction; the Pro price anchors value.
- **D-10 (both CTAs → `SIGNUP_URL`):** Both tier CTAs route to `SIGNUP_URL` ("Try it free").
  This is a marketing teaser — NO Whop checkout, NO Supabase auth, NO `CheckoutModal` (those
  live in the real `/pricing` route, which Phase 4 does NOT touch). Pure RSC + link.
- **D-11 (mirror the real tier model, simplified):** Bullet content reflects the real
  model spirit — Starter = limited sims (5/mo) + basics; Pro = unlimited + advanced — but
  compressed to 3–4 bullets, not the 8-row real feature matrix. Numbers are placeholders.

### Final CTA band (CONVERT-02)
- **D-12 (full-width warm band before footer):** A **full-width tone-step band** sits
  **between the FAQ and the footer** — the closing ask. Flat-warm: tone-step surface +
  hairline border, faint warm radial seat (echoes the hero stage seat).
- **D-13 (serif close-line + primary CTA + reassurance):** Band copy = a **Newsreader-serif
  voice close-line** (the landing's serif voice moment recurs here) + a dominant **"Try it
  free"** primary CTA (`SIGNUP_URL`) + the **risk-reducer microcopy** (D-20). Coral on the
  CTA only.
- **D-14 (lone visual flourish = subtle score-gauge echo):** The band's single visual accent
  is a **subtle score-gauge echo** — reuse `score-gauge-skeleton` (Phase-3 primitive),
  rendered small/muted. NOT the full hero product-shot, NOT a new bespoke visual. Ties the
  close back to the instrument without competing with the CTA.

### FAQ (CONVERT-03)
- **D-15 (6 objection-busting questions):** **Six** FAQ items targeting real buying
  objections — **accuracy** ("how does it know?"), **platforms** (TikTok-only or more?),
  **niche fit**, **data/privacy**, **free/price** (is it free to try?), **speed/how it
  works**. Drafted answers, conversion-framed (turn objections into reasons to try).
- **D-16 (single-open accordion):** Accordion is **single-open** (`type="single"
  collapsible`) — one panel at a time keeps focus and avoids a wall of text burying the CTA.
  NOT multi-open, NOT 8+ items.
- **D-17 (reuse Radix `ui/accordion.tsx`):** Reuse the existing Radix-backed
  `src/components/ui/accordion.tsx` for keyboard accessibility (Radix handles arrow keys /
  Enter / Space / focus). Restyle to flat-warm if the primitive is the old cold brand
  (verify aesthetic; restyle tokens, don't re-implement the a11y).

### Order & navigation (CONVERT-02 / structure)
- **D-18 (section order):** Final assembled order —
  `hero → social-proof strip → how-it-works → the-simulation → features → testimonials
  → pricing → faq → final CTA band → footer`. The strip rides high (under hero);
  testimonials drop into the conversion zone (after features).
- **D-19 (no new nav anchors):** The new sections (strip, testimonials, CTA band) get **NO
  nav links** — the locked 5-link nav (`How it works · The Simulation · Features · Pricing
  · FAQ`, from `src/lib/nav.ts`) holds unchanged. `#pricing` and `#faq` remain the existing
  anchored stubs Phase 4 fills in place. The strip/testimonials/band may carry ids for
  internal use but are not added to `NAV_LINKS`.

### Cross-cutting conversion levers
- **D-20 (risk-reducer microcopy = "Free to start — no credit card"):** This friction-
  remover appears near the primary CTAs (hero band echo, pricing cards, final band).
  Strongest first-click reducer; pairs with the free Starter framing (D-09).
- **D-21 (conversion > honesty, per human steer):** Optimize copy/visuals for conversion.
  Drafted realistic testimonials, result metrics, and the trust stat are explicitly
  in-bounds — they are swap slots, not claims to defend. (Departs from the engine-side
  "no fabricated metrics" thread, which applies to the live product, not this marketing
  surface.)

### Claude's Discretion
Deferred to planner/executor within the flat-warm, calm-motion, conversion-optimized taste
bar — art-direction / copy, not visionary calls:
- **Exact placeholder numbers** — Pro price ($/mo), the peer-count stat value, per-quote
  result metrics. Plausible + swappable; planner/executor pick within D-04/D-07/D-09 intent.
- **Drafted copy** — testimonial quotes + names/@handles, FAQ answers, the serif close-line,
  pricing bullet wording. Within the voice + objection set above.
- **Testimonial card / strip / band exact layout, motion, mobile stacking** — within
  flat-warm + reduced-motion-gated. Marquee speed, card grid → stack breakpoints, band
  radial intensity = executor's, on the Phase-5 perf/responsive bar.
- **Whether the FAQ accordion is an RSC with a small client island or a client component** —
  Radix accordion is interactive (client); keep `page.tsx` an RSC and mount the FAQ as a
  client island (mirrors the established `"use client"`-only-for-interactive pattern). Final
  shape = planner.
- **Whether to reuse/restyle `ui/testimonial-card.tsx` (cold brand) or build a flat-warm
  card** — Phase-3 precedent built bespoke flat-warm story components rather than reuse the
  cold UI primitives; lean the same way unless the primitive restyles cleanly. Planner/
  researcher's call.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone source of truth (landing-v2 — this worktree)
- `.planning/ROADMAP.md` — Phase 4 goal + 5 success criteria (lines ~134–156).
- `.planning/REQUIREMENTS.md` — PROOF-01, PROOF-02, CONVERT-01, CONVERT-02, CONVERT-03
  (the Phase-4 contract).
- `.planning/LANDING-VISION.md` — §4 (references: OpusClip structure = creator social proof
  + logo wall + virality framing; Linear/Raycast craft), §5 (placeholder strategy: logo wall
  + testimonials = placeholder avatars/logos), §8 (guardrails: calm motion, perf, a11y).
- `.planning/MILESTONE.md` — marketing-surface-only, placeholders, permitted libs.

### Phase-1/2/3 foundation this builds on (highest priority — already in this worktree)
- `.planning/phases/01-foundation-shell/01-CONTEXT.md` — flat-warm decision record
  (D-01..D-23): charcoal/cream/terracotta tokens, **serif-for-voice-only** (the band close-
  line is a recurrence of that voice), `<Placeholder>` API (avatar/logo variants for proof),
  motion foundation + global reduced-motion, product noun **"Simulation"**, CTA → `SIGNUP_URL`.
  Authoritative "why" for everything inherited.
- `.planning/phases/02-hero-signature-moment/02-CONTEXT.md` — hero composition + the
  product-shot pivot; the strip rides directly under this hero (D-01/D-18). The "Try it free"
  CTA pattern + scroll-cue precedent.
- `src/app/(marketing)/page.tsx` — the RSC scroll skeleton. Fill the `#pricing` + `#faq`
  stubs in place; insert strip / testimonials / final-CTA-band sections per D-18. Mirror the
  established `<section id className="scroll-mt-20 border-t border-border px-6 py-16 md:py-20">`
  rhythm + `mx-auto max-w-5xl` inner measure.
- `src/lib/nav.ts` — the LOCKED 5-link nav set (D-19 — do NOT extend).
- `src/lib/routes.ts` — `SIGNUP_URL` (every CTA target, D-10/D-13).

### Design-system SSOT (carried from Phase 1 — read-only reference)
- `~/virtuna-numen-rework/src/app/globals.css` — flat-warm `@theme` token SSOT (already
  ported into this worktree's `globals.css`; reference for exact hex/coral values).
- ⚠ `BRAND-BIBLE.md` (repo-root + numen-rework) is **STALE** (old Raycast glass). Do NOT use
  for visual direction — `globals.css` + `01-CONTEXT.md` are the SSOT.

### Real product references (read-only — model + a11y, not code to import)
- `src/app/(marketing)/pricing/pricing-section.tsx` + `src/lib/whop/config.ts` — the REAL
  tier model the teaser mirrors (Starter = 5/mo, Pro = unlimited, 7-day free Pro trial, free
  tier exists). Reference for bullet content (D-11); do NOT import its Whop/Supabase/checkout
  machinery into the teaser (D-10).
- `src/components/ui/accordion.tsx` — Radix-backed accordion to reuse for the FAQ (D-17);
  verify flat-warm vs cold brand, restyle tokens if needed.

### Tailwind v4 gotchas (repo-root `CLAUDE.md`)
- oklch L<0.15 → use hex for very dark tokens; Lightning CSS strips `backdrop-filter` (moot —
  flat-matte has no blur); kill dev server + clear `.next/` when CSS changes don't appear.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`<Placeholder>`** (`src/components/marketing/placeholder.tsx`) — `variant="logo"` (logo
  wall, D-03) and `variant="avatar"` (testimonial avatars, D-07); one-prop `src` swap later.
- **`src/components/ui/marquee.tsx`** — auto-scroll marquee for the logo strip (D-02);
  reduced-motion-gated.
- **`src/components/ui/accordion.tsx`** — Radix accordion for the FAQ (D-17); keyboard a11y
  built in. **`ui/avatar.tsx`** (Radix), **`ui/card.tsx`**, **`ui/badge.tsx`** ("Most popular"
  / trial badge), **`ui/testimonial-card.tsx`** (cold-brand — restyle or rebuild flat-warm).
- **`src/components/marketing/story/skeletons/score-gauge-skeleton.tsx`** — the static-SVG
  score-gauge echo for the final CTA band (D-14). Sibling skeletons (`audience-cloud`,
  `driver-rows`, `device-chrome`) are reusable if a card wants a product motif.
- **`src/components/motion/*`** — `fade-in`, `fade-in-up`, `slide-up`, `stagger-reveal`,
  `hover-scale` (on `motion/react`) for section entrances; all auto-respect reduced-motion via
  `MotionConfigShell`. **In RSCs use the named `StaggerRevealItem` export** (the `.Item` static
  prop is undefined across the RSC→client prerender boundary — Phase-3 03-01 landmine).
- **`SIGNUP_URL`** (`src/lib/routes.ts`), **`NAV_LINKS`** (`src/lib/nav.ts`), **`cn()`**
  (`src/lib/utils.ts`).
- **Installed:** Radix accordion/avatar/dialog/tabs, `motion@12`. shadcn/Magic UI/Aceternity
  NOT installed — add per-component only if a chosen pattern needs one (researcher's call).

### Established Patterns
- Tailwind v4 flat-warm `@theme` tokens — reference semantic token names, never hardcode hex.
  Coral = the lone accent (CTAs only). Cream text, never pure white. 6%/10% borders, 12px radius.
- **Pure-RSC `page.tsx`; `"use client"` only for interactive islands.** The FAQ accordion is
  the one genuinely-interactive Phase-4 piece → mount it as a client island; keep the page an
  RSC so `/` stays statically prerendered (the standing build gate from Phases 1–3).
- kebab-case components, barrel `index.ts`, CVA + clsx + tailwind-merge. New Phase-4 components
  live in `src/components/marketing/` (likely `proof/`, `pricing/`, `faq/`, `cta/` subdirs,
  mirroring `hero/` + `story/`); export through the marketing barrel.
- **Phase-3 craft lesson (binds Phase 4):** stub slots get **intentional skeleton/treatment**,
  never flat empty boxes or dev ratio labels. Apply to every placeholder here (logos, avatars,
  any product motif).

### Integration Points
- `src/app/(marketing)/page.tsx` — fill `#pricing` + `#faq` stubs in place; insert the new
  strip (under `#hero`), testimonials (after `#features`), and CTA band (before `<Footer/>`)
  per D-18. Preserve the locked `scroll-mt-20 border-t border-border ... mx-auto max-w-5xl`
  rhythm; the full-width band breaks the `max-w-5xl` measure intentionally (D-12).
- `src/lib/nav.ts` — UNCHANGED (D-19). `#pricing`/`#faq` anchors already exist + already in nav.
- Reduced-motion already wired globally (`MotionConfigShell`) — the marquee + entrances inherit
  it; only manual rAF would need the hook (none expected here).

### Reference-only precedent (do NOT reuse — old aesthetic)
- `src/components/ui/testimonial-card.tsx` + `src/app/(marketing)/pricing/pricing-section.tsx`
  are the OLD cold Raycast brand + heavy client logic. Mine them for structure/model only;
  build flat-warm, server-first per the Phase-3 precedent.
</code_context>

<specifics>
## Specific Ideas

- **Conversion is the brief.** The human steered explicitly: *"don't worry about honesty,
  worry about conversion rate."* Every Phase-4 lever — peer-count stat, result-metric quotes,
  price anchoring, "Most popular" Pro, "Free — no credit card" — is chosen for the click.
  Stay within the calm flat-warm system; the levers are typographic + structural, not loud.
- **The proof split is deliberate** (D-01): a thin trust bar rides high under the hero (instant
  credibility at the fold's edge), and the fuller testimonials land deep, right before the
  pricing ask — proof bracketing the scroll.
- **The serif voice recurs at the close** (D-13): Phase 1 reserved the serif for voice moments;
  the hero headline opened with it, the final CTA band's close-line lands it again — open and
  close in the same voice.
- **References to steal from** (VISION §4): **OpusClip** — creator social proof + logo wall +
  pricing/CTA structure (closest competitor in shape); **Linear/Raycast** — typographic
  restraint, dark-theme craft on the pricing cards + FAQ.
</specifics>

<deferred>
## Deferred Ideas

- **Real proof assets** (actual creator logos, named-creator testimonials with real avatars +
  real metrics) — swap the `<Placeholder>` slots + drafted copy post-launch once real creators
  exist. The frames ship now; the assets land later (placeholder strategy, VISION §5).
- **Live waitlist / email capture on the CTA band** — OUT OF SCOPE (marketing surface only, no
  backend beyond the `SIGNUP_URL` link). CTA routes to the existing app signup.
- **Whop checkout / live tier purchase from the teaser** — the real `/pricing` route owns that
  (D-10); the teaser is link-only.
- **Monthly/annual pricing toggle** — over-engineering a teaser; the real `/pricing` route can
  carry it if ever needed.
- **Phase-5 cross-cutting** — responsive stacking (cards → stack at mobile widths), perf (lazy
  marquee/heavy media, CLS), and full a11y/contrast audit across the assembled page are the
  Phase-5 hardening pass (FOUND-05/06/07), seeded as standing criteria here.

None were dropped silently — each is captured for its proper phase/milestone.
</deferred>

---

*Phase: 4-Proof & Conversion*
*Context gathered: 2026-06-15*
