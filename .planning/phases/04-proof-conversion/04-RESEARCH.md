# Phase 4: Proof & Conversion - Research

**Researched:** 2026-06-15
**Domain:** Marketing-surface React/Next.js 15 RSC — social-proof strip, testimonials grid, pricing teaser, CTA band, FAQ accordion (flat-warm design system)
**Confidence:** HIGH (all reuse/landmine claims VERIFIED in-repo; external patterns MEDIUM)

<user_constraints>
## User Constraints (from CONTEXT.md)

> CONTEXT.md `04-CONTEXT.md` records 21 human-locked decisions (D-01..D-21). These are accepted human choices — the planner MUST honor them. Do NOT re-litigate. Below is the verbatim decision set, condensed only where the original is a long prose paragraph; the authoritative wording is in `04-CONTEXT.md`.

### Locked Decisions

**Social-proof strip (PROOF-01)**
- **D-01 (two-part proof, split placement):** Proof is split — a thin high-trust strip **directly under the hero**, and a fuller testimonials block down in the conversion zone (D-05, after `#features`). NOT one combined block.
- **D-02 (strip = stat + logo marquee):** The strip pairs a headline trust stat with a logo marquee. Reuse `src/components/ui/marquee.tsx` (reduced-motion-gated).
- **D-03 (logos = placeholder creator/brand swap slots):** Logo wall = a marquee of `<Placeholder variant="logo">` slots. NOT real platform marks, NOT press "as seen in".
- **D-04 (stat = creator peer-count):** Headline stat is a peer social-proof count — e.g. "Join 2,000+ creators". Swappable placeholder number. NOT an activity/outcome claim.

**Testimonials (PROOF-02)**
- **D-05 (placement = conversion zone, after `#features`):** Testimonials sit after `#features`, before pricing.
- **D-06 (3 quote cards, static grid):** Three cards, static grid. NOT a marquee carousel, NOT 6+.
- **D-07 (card anatomy):** Each card = `<Placeholder variant="avatar">` + name + @handle + a punchy drafted quote + a result metric (e.g. "+2.3M views", "3× my hook rate"). All fields are swap slots / drafted copy.

**Pricing teaser (CONVERT-01)**
- **D-08 (two tier cards, Pro highlighted):** Starter + Pro side by side, Pro highlighted "Most popular". 3–4 benefit bullets each. NOT a single card, NOT a full feature-matrix table.
- **D-09 (Starter = "Free to start", Pro = placeholder $/mo + trial):** Starter framed "Free to start" (5 sims/mo); Pro shows a placeholder monthly price (e.g. $19/mo, swappable) + a "7-day free trial" badge.
- **D-10 (both CTAs → `SIGNUP_URL`):** NO Whop checkout, NO Supabase auth, NO `CheckoutModal`. Pure RSC + link.
- **D-11 (mirror the real tier model, simplified):** Starter = limited sims (5/mo) + basics; Pro = unlimited + advanced — compressed to 3–4 bullets. Numbers are placeholders.

**Final CTA band (CONVERT-02)**
- **D-12 (full-width warm band before footer):** Full-width tone-step band between FAQ and footer. Flat-warm: tone-step surface + hairline border, faint warm radial seat.
- **D-13 (serif close-line + primary CTA + reassurance):** Newsreader-serif voice close-line + dominant "Try it free" CTA (`SIGNUP_URL`) + risk-reducer microcopy (D-20). Coral on the CTA only.
- **D-14 (lone visual flourish = subtle score-gauge echo):** Reuse `score-gauge-skeleton`, rendered small/muted. NOT the full hero product-shot, NOT a new bespoke visual.

**FAQ (CONVERT-03)**
- **D-15 (6 objection-busting questions):** Six items — accuracy, platforms, niche fit, data/privacy, free/price, speed/how-it-works. Drafted conversion-framed answers.
- **D-16 (single-open accordion):** `type="single" collapsible`. NOT multi-open, NOT 8+ items.
- **D-17 (reuse Radix `ui/accordion.tsx`):** Reuse for keyboard a11y. Restyle to flat-warm if it's the old cold brand (restyle tokens, don't re-implement a11y).

**Order & navigation**
- **D-18 (section order):** `hero → social-proof strip → how-it-works → the-simulation → features → testimonials → pricing → faq → final CTA band → footer`.
- **D-19 (no new nav anchors):** New sections get NO nav links. The locked 5-link nav holds unchanged. `#pricing`/`#faq` remain the existing anchored stubs filled in place.

**Cross-cutting conversion levers**
- **D-20 (risk-reducer microcopy):** "Free to start — no credit card" near the primary CTAs (hero echo, pricing cards, final band).
- **D-21 (conversion > honesty, per human steer):** Drafted realistic testimonials, result metrics, and the trust stat are in-bounds — they are swap slots, not claims to defend. (Applies to this marketing surface only, NOT the live product.)

### Claude's Discretion
Deferred to planner/executor within the flat-warm, calm-motion, conversion-optimized taste bar:
- **Exact placeholder numbers** — Pro price ($/mo), the peer-count stat value, per-quote result metrics. Plausible + swappable, within D-04/D-07/D-09 intent.
- **Drafted copy** — testimonial quotes + names/@handles, FAQ answers, the serif close-line, pricing bullet wording. Within the voice + objection set above.
- **Testimonial card / strip / band exact layout, motion, mobile stacking** — within flat-warm + reduced-motion-gated.
- **Whether the FAQ accordion is an RSC with a small client island or a client component** — keep `page.tsx` an RSC, mount the FAQ as a client island.
- **Whether to reuse/restyle `ui/testimonial-card.tsx` (cold brand) or build a flat-warm card** — Phase-3 precedent built bespoke flat-warm components; lean the same way unless the primitive restyles cleanly.

### Deferred Ideas (OUT OF SCOPE)
- **Real proof assets** (actual creator logos, named testimonials, real metrics) — swap post-launch.
- **Live waitlist / email capture on the CTA band** — marketing surface only; CTA → `SIGNUP_URL`.
- **Whop checkout / live tier purchase from the teaser** — the real `/pricing` route owns that (D-10).
- **Monthly/annual pricing toggle** — over-engineering a teaser.
- **Phase-5 cross-cutting** — responsive stacking, perf (lazy/CLS), full a11y/contrast audit — the Phase-5 hardening pass (FOUND-05/06/07), seeded as standing criteria here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROOF-01 | A social-proof strip shows creator avatars and a logo wall (placeholder slots) | Reuse `ui/marquee.tsx` (VERIFIED API below) + `<Placeholder variant="logo">` (VERIFIED). Marquee CSS is already reduced-motion-gated globally (globals.css L363-369). **Landmine:** marquee `repeat=4` is NOT `aria-hidden` — planner must wrap duplicated copies. Strip rides directly under `#hero`. |
| PROOF-02 | A testimonials section shows creator quote cards (placeholder avatars + quotes) | Bespoke flat-warm card recommended (existing `ui/testimonial-card.tsx` is cold-brand + lacks @handle/metric anatomy — REBUILD, evidence below). `<Placeholder variant="avatar">` exists. Static 3-card grid (D-06). |
| CONVERT-01 | A pricing teaser presents tiers (Starter/Pro) with "Try it free" CTAs (placeholder-ok pricing) | Bespoke flat-warm pricing card recommended (existing `pricing-section.tsx` is cold-brand + heavy client logic — MINE for model only, D-10). Real model extracted below. `Badge` + `Button` reusable. |
| CONVERT-02 | A final full-width CTA band ("Try it free") sits before the footer | Full-width band breaks `max-w-5xl` intentionally (D-12). Reuse `ScoreGaugeSkeleton` (VERIFIED export, pure RSC). Newsreader serif close-line (font already wired Phase 1). |
| CONVERT-03 | An FAQ section answers common creator questions in an accessible accordion | Reuse Radix `ui/accordion.tsx` (VERIFIED Radix-backed, `type="single" collapsible` supported) — but it is COLD BRAND (`text-white`/`bg-background-elevated`/`text-gray-400`) → restyle tokens to flat-warm. Radix gives keyboard a11y free (VERIFIED). Mount as client island. |
</phase_requirements>

## Summary

Phase 4 is the **lowest-risk phase of the milestone from a technology standpoint** — every primitive it needs already exists in-repo and is verified working, and the page assembly pattern is fully established by Phases 1–3. The phase's risk is concentrated in **craft + conversion copy**, both of which are human-gated (live UAT precedent from Phases 2 & 3) and explicitly steered by D-21 (optimize for the click). There is **no new library to install** — Radix accordion, `motion@12`, CVA/clsx/tailwind-merge, lucide, and the `<Placeholder>` system are all present.

Three reuse-vs-rebuild calls drive the plan: (1) the **marquee** is reused as-is with one a11y wrapper for the duplicated track; (2) the **testimonial card** and **pricing card** are the OLD cold Raycast brand (`text-white`, `border-white/[0.06]`, `oklch glow`, heavy `"use client"` Supabase/Whop logic) — **build bespoke flat-warm versions**, mirroring the Phase-3 precedent (which built bespoke `how-it-works`/`feature-blocks` rather than reuse cold UI primitives); (3) the **Radix accordion** is reused for its keyboard a11y (which Radix gives free and the planner must NOT re-implement) but **restyled** from cold tokens (`text-white`/`bg-background-elevated/50`/`text-gray-400`) to flat-warm (`text-foreground`/`bg-surface-elevated`/`text-foreground-secondary`).

The single highest-value structural fact: **`page.tsx` is a pure RSC and `/` is statically prerendered — this is the standing build gate from Phases 1–3.** The FAQ accordion is the one genuinely-interactive piece (Radix uses context → `"use client"`); it must be mounted as a client *island* so the page root stays RSC. Three carried landmines apply: the `StaggerReveal.Item` RSC-boundary trap (use the named `StaggerRevealItem` export), the cold-brand-component trap (don't reuse `ui/testimonial-card.tsx` / `pricing-section.tsx` styling), and the static-build gate (no `"use client"` may leak to a section root mounted in `page.tsx`).

**Primary recommendation:** Build five flat-warm marketing sections (`proof/` strip + `proof/` testimonials, `pricing/` teaser, `cta/` band, `faq/` accordion island) as new components under `src/components/marketing/`, mirroring the `story/` directory + barrel + test conventions exactly. Reuse the marquee, Placeholder, ScoreGaugeSkeleton, Badge, Button, and Radix accordion *structure*; rebuild the testimonial + pricing cards bespoke in flat-warm. Seed a `04-00` Nyquist RED scaffold mirroring `03-00`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Social-proof strip (stat + logo marquee) | Frontend Server (RSC) | Browser (marquee CSS animation, client `useReducedMotion` is moot — CSS-only) | Pure presentational; the marquee is CSS-keyframe driven, no JS. Render server-side, static. |
| Testimonials grid | Frontend Server (RSC) | — | Static content + `<Placeholder>` avatars. No interactivity. Pure RSC + optional `StaggerReveal` client-leaf entrance. |
| Pricing teaser | Frontend Server (RSC) | — | Static cards + `<Link href={SIGNUP_URL}>`. NO auth/checkout (D-10) — explicitly kept out of this tier. |
| Final CTA band | Frontend Server (RSC) | — | Static band + serif copy + `<Link>` CTA + static `ScoreGaugeSkeleton` SVG. |
| FAQ accordion | Browser (client island) | Frontend Server (page mount) | Radix accordion needs React context (`"use client"`). Mount as an isolated client island so `page.tsx` root stays RSC and `/` stays static. |
| CTA routing | (link only) | — | Every CTA is a plain anchor to `SIGNUP_URL` (`/signup`). No backend, no API, no Supabase. |

**Why this matters:** The whole phase is a frontend-server (RSC) surface with exactly ONE client island (the FAQ). Any capability accidentally pulling auth, checkout, or Supabase into the marketing tier is a D-10 violation AND breaks the static-build gate. The map makes the single client boundary explicit.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-accordion` | installed (used by `ui/accordion.tsx`) | FAQ keyboard-accessible single-open accordion (D-16/D-17) | Already in-repo; WAI-ARIA accordion pattern, arrow-key nav, focus mgmt, `type="single" collapsible` all built-in [CITED: radix-ui.com/primitives/docs/components/accordion] |
| `motion` (Framer Motion) | `motion@12` | Section entrance reveals (`StaggerReveal`, `FadeInUp`) behind global reduced-motion | Phase 1 foundation; `<MotionConfigShell>` already wraps the tree [VERIFIED: in-repo] |
| `class-variance-authority` + `clsx` + `tailwind-merge` | installed | Component variant styling + `cn()` merge | Established convention (`cn()` in `src/lib/utils.ts`) [VERIFIED: in-repo] |
| `lucide-react` | installed | Placeholder media glyphs (used by `placeholder.tsx`) | Already the project's icon set for marketing [VERIFIED: in-repo] |
| Tailwind CSS v4 | installed | Flat-warm `@theme` semantic tokens | Project styling; tokens in `globals.css` [VERIFIED: in-repo] |

### Supporting (all in-repo — REUSE)
| Component | Path | Purpose | Reuse Verdict |
|-----------|------|---------|---------------|
| `Marquee` | `src/components/ui/marquee.tsx` | Logo-wall auto-scroll (D-02) | **REUSE as-is** + a11y wrapper (see Landmines). Props: `reverse`, `pauseOnHover`, `vertical`, `repeat=4`, `className`. CSS-driven `animate-marquee`. |
| `Placeholder` | `src/components/marketing/placeholder.tsx` | `variant="logo"` (D-03) + `variant="avatar"` (D-07) | **REUSE as-is.** Verified API below. |
| `ScoreGaugeSkeleton` | `src/components/marketing/story/skeletons/score-gauge-skeleton.tsx` | CTA-band visual echo (D-14) | **REUSE as-is.** Pure RSC, `{ className }` prop, fixed score 87 "Strong". |
| Radix accordion parts | `src/components/ui/accordion.tsx` | FAQ (D-17) | **REUSE structure, RESTYLE tokens** (cold brand → flat-warm). |
| `Badge` | `src/components/ui/badge.tsx` | "Most popular" + "7-day free trial" badges (D-08/D-09) | **REUSE.** `variant="accent"` = coral; `variant="secondary"` = neutral. `size="sm"\|"md"`. |
| `Button` | `src/components/ui/button.tsx` | CTAs — `variant="primary"` (coral) / `"secondary"`, `asChild` for `<Link>` | **REUSE** (same pattern as `pricing-section.tsx renderCTA`). |
| `StaggerReveal` / `StaggerRevealItem` | `src/components/motion/stagger-reveal.tsx` | Section entrance | **REUSE** — use the NAMED `StaggerRevealItem` export (landmine). |
| `cn` | `src/lib/utils.ts` | Class merge | REUSE. |
| `SIGNUP_URL` | `src/lib/routes.ts` | `"/signup"` — every CTA target (D-10/D-13) | REUSE. |
| `NAV_LINKS` | `src/lib/nav.ts` | Locked 5-link set | **DO NOT extend** (D-19). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bespoke flat-warm testimonial card | Reuse `ui/testimonial-card.tsx` | The existing card is cold-brand (`oklch glow`, `border-accent/20 shadow`, Raycast inset shine) AND its anatomy is `{quote, author:{name,role,company,avatar}}` — it has NO `@handle` and NO `result metric` field, both of which D-07 requires. Restyling tokens won't add the missing fields. **Rebuild.** |
| Bespoke flat-warm pricing card | Reuse/import `pricing-section.tsx` | It is `"use client"` with `useState`/`useEffect`/`createClient`(Supabase)/`useSubscription`/`CheckoutModal`/`hasAccessToTier`. Importing ANY of that violates D-10 and breaks the static build. Mine for the tier MODEL only. **Rebuild.** |
| `ui/avatar.tsx` (Radix Avatar) for testimonial avatars | `<Placeholder variant="avatar">` | D-07 explicitly specifies `<Placeholder variant="avatar">` (swap-slot system, intentional skeleton). Use Placeholder, not raw Avatar. |
| Magic UI marquee install | — | NOT needed. The repo already has a Magic-UI-style `ui/marquee.tsx`. Do not install. |

**Installation:** **None.** No new package is required for Phase 4. All primitives are in-repo. (`@radix-ui/react-accordion`, `motion@12`, `cva`/`clsx`/`tailwind-merge`, `lucide-react`, `@phosphor-icons/react` — the accordion's caret icon — are all already installed and in use.)

## Package Legitimacy Audit

> Phase 4 installs **zero** external packages. No legitimacy gate is triggered. All components are reused from the existing, already-vetted in-repo tree.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No installs this phase |

**Packages removed due to slopcheck [SLOP] verdict:** none (no installs).
**Packages flagged as suspicious [SUS]:** none (no installs).

## Architecture Patterns

### System Architecture Diagram

```
                            page.tsx  (PURE RSC — statically prerendered "○ /")
                                │
        ┌───────────────────────┼─────────────────────────────────────────────┐
        │  <MotionConfigShell>  (client boundary, reducedMotion="user")        │
        │     │                                                                 │
        │  <Header/>  ──►  <main>  ──►  <Footer/>                               │
        │                    │                                                  │
        │   D-18 section order inside <main>:                                   │
        │                    │                                                  │
        │   #hero ──────────►  (existing, Phase 2)                              │
        │      │                                                                │
        │   ┌──▼──────────────────┐  NEW · PROOF-01 · rides directly under hero │
        │   │ social-proof strip  │  stat ("Join 2,000+ creators") + <Marquee>  │
        │   │  (RSC)              │   of <Placeholder variant="logo"> ×N        │
        │   └─────────────────────┘   marquee = CSS anim, reduced-motion-gated  │
        │      │                                                                │
        │   #how-it-works ──► #the-simulation ──► #features  (existing, Phase 3)│
        │      │                                                                │
        │   ┌──▼──────────────────┐  NEW · PROOF-02 · conversion zone           │
        │   │ testimonials (RSC)  │  static 3-card grid; each =                 │
        │   │                     │  <Placeholder variant="avatar"> + name +    │
        │   └─────────────────────┘  @handle + quote + result-metric           │
        │      │                                                                │
        │   #pricing (FILL stub) ─┐ NEW · CONVERT-01 · 2 cards Starter|Pro      │
        │   │ pricing teaser (RSC)│  Pro "Most popular"; both CTA → SIGNUP_URL  │
        │   └─────────────────────┘  NO Whop/Supabase/CheckoutModal (D-10)      │
        │      │                                                                │
        │   #faq (FILL stub) ─────┐ NEW · CONVERT-03 · 6 Q&A                     │
        │   │ FAQ accordion       │  ◄── ONLY client island: Radix accordion    │
        │   │  ("use client")     │      type="single" collapsible (D-16)       │
        │   └─────────────────────┘      restyled flat-warm                     │
        │      │                                                                │
        │   ┌──▼──────────────────┐  NEW · CONVERT-02 · breaks max-w-5xl        │
        │   │ final CTA band (RSC)│  full-width tone-step + warm radial;        │
        │   │                     │  serif close-line + "Try it free"→SIGNUP_URL│
        │   └─────────────────────┘  + ScoreGaugeSkeleton (small/muted, D-14)   │
        │                                                                       │
        └───────────────────────────────────────────────────────────────────────┘

  CTA flow: every "Try it free" / tier CTA  ──►  <Link href={SIGNUP_URL}>  ──►  /signup
            (no API, no fetch, no Supabase, no waitlist backend)
```

### Component Responsibilities

| Component (new) | File (recommended) | Renders | Client? |
|-----------------|--------------------|---------|---------|
| `SocialProofStrip` | `marketing/proof/social-proof-strip.tsx` | Trust stat + `<Marquee>` of logo placeholders | RSC (CSS marquee) |
| `Testimonials` | `marketing/proof/testimonials.tsx` | 3-card static grid | RSC (+ `StaggerReveal` leaf) |
| `TestimonialCard` (bespoke) | `marketing/proof/testimonial-card.tsx` | avatar + name + @handle + quote + metric | RSC |
| `PricingTeaser` | `marketing/pricing/pricing-teaser.tsx` | 2 tier cards | RSC |
| `PricingCard` (bespoke) | `marketing/pricing/pricing-card.tsx` | one tier card + bullets + CTA | RSC |
| `FaqAccordion` | `marketing/faq/faq-accordion.tsx` | Radix single-open accordion, 6 items | **client island** |
| `Faq` (section wrapper) | `marketing/faq/faq.tsx` | heading + mounts `<FaqAccordion>` | RSC heading + client island |
| `FinalCtaBand` | `marketing/cta/final-cta-band.tsx` | full-width band, serif line, CTA, gauge echo | RSC |

> Directory + export convention is the planner/executor's call (D — Claude's discretion on layout), but `proof/`, `pricing/`, `faq/`, `cta/` subdirs mirroring `story/` is the natural fit. Export each section through the marketing barrel `src/components/marketing/index.ts` (see Don't Hand-Roll → barrel).

### Recommended Project Structure
```
src/components/marketing/
├── index.ts                  # extend barrel: add the new section exports
├── proof/
│   ├── social-proof-strip.tsx     # PROOF-01 (RSC)
│   ├── testimonials.tsx           # PROOF-02 grid (RSC)
│   ├── testimonial-card.tsx       # bespoke flat-warm card (RSC)
│   └── __tests__/                 # social-proof-strip.test.tsx, testimonials.test.tsx
├── pricing/
│   ├── pricing-teaser.tsx         # CONVERT-01 (RSC)
│   ├── pricing-card.tsx           # bespoke flat-warm tier card (RSC)
│   └── __tests__/pricing-teaser.test.tsx
├── faq/
│   ├── faq.tsx                    # RSC section wrapper (heading)
│   ├── faq-accordion.tsx          # "use client" Radix island (CONVERT-03)
│   └── __tests__/faq.test.tsx
└── cta/
    ├── final-cta-band.tsx         # CONVERT-02 (RSC)
    └── __tests__/final-cta-band.test.tsx
```

### Pattern 1: Pure-RSC section + client-leaf entrance (the Phase-3 idiom — copy it)
**What:** Section components are pure Server Components; the only client code is the `StaggerReveal` entrance leaf (imported as an island). Keeps `page.tsx` RSC and `/` static.
**When to use:** Every Phase-4 section EXCEPT the FAQ accordion.
**Example (verbatim shape from `story/feature-blocks.tsx`):**
```tsx
// Source: src/components/marketing/story/feature-blocks.tsx (in-repo, VERIFIED)
import * as React from "react";
import { StaggerReveal, StaggerRevealItem } from "@/components/motion";
import { cn } from "@/lib/utils";

// NOTE: named StaggerRevealItem export, NOT StaggerReveal.Item (RSC-boundary landmine).
export function Testimonials({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      <h2 className="text-3xl font-semibold text-foreground">What creators say</h2>
      <StaggerReveal className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <StaggerRevealItem key={t.handle}>
            <TestimonialCard {...t} />
          </StaggerRevealItem>
        ))}
      </StaggerReveal>
    </div>
  );
}
```

### Pattern 2: FAQ as a client island under an RSC section wrapper
**What:** Radix accordion needs React context → `"use client"`. Isolate it so the page root and the section heading stay RSC.
**When to use:** The FAQ section only (the lone interactive Phase-4 piece).
**Example:**
```tsx
// faq.tsx — RSC wrapper (no "use client")
import { FaqAccordion } from "./faq-accordion";
export function Faq({ className }: { className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-3xl font-semibold text-foreground">Questions, answered</h2>
      <FaqAccordion className="mt-10" />   {/* the only client island */}
    </div>
  );
}

// faq-accordion.tsx — client island
"use client";
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent }
  from "@/components/ui/accordion";
const FAQ_ITEMS = [ /* 6 objection-busting Q&A (D-15) */ ] as const;
export function FaqAccordion({ className }: { className?: string }) {
  return (
    <AccordionRoot type="single" collapsible className={className}>   {/* D-16 */}
      {FAQ_ITEMS.map((item) => (
        <AccordionItem key={item.q} value={item.q}>
          <AccordionTrigger>{item.q}</AccordionTrigger>
          <AccordionContent>{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </AccordionRoot>
  );
}
```
> **Note:** `ui/accordion.tsx` is already `"use client"` and exports `AccordionRoot/Item/Trigger/Content`. Radix's `Root` accepts `type="single"` + `collapsible` (VERIFIED — see Radix docs). The `<FaqAccordion>` wrapper being `"use client"` is fine; what matters is that `page.tsx` itself stays RSC and only mounts the island.

### Pattern 3: Full-width band that breaks the `max-w-5xl` measure (D-12)
**What:** The CTA band is full-bleed; it does NOT sit inside the `<div className="mx-auto max-w-5xl">` inner measure other sections use. Its inner content can still be centered/constrained, but the band surface spans the viewport.
**When to use:** The final CTA band only.
**Example:**
```tsx
// Inside page.tsx <main>, between #faq and <Footer/>:
<section className="border-t border-border">            {/* no max-w on the section */}
  <FinalCtaBand />                                        {/* owns its own full-bleed surface */}
</section>
// FinalCtaBand internally: full-width tone-step surface + faint warm radial,
// inner content wrapped mx-auto max-w-3xl text-center.
```

### Anti-Patterns to Avoid
- **`StaggerReveal.Item` in an RSC section** — the `.Item` static prop (`stagger-reveal.tsx` line 102) is `undefined` across the RSC→client prerender boundary → crashes `next build` on `/`. Use the named `StaggerRevealItem` import. (VERIFIED in `feature-blocks.tsx` docblock + `how-it-works.tsx`.)
- **Reusing `ui/testimonial-card.tsx` styling** — cold Raycast brand (`oklch glow`, `border-accent/20 shadow-[...]`, white inset shine) + missing `@handle`/`metric` fields. Build bespoke.
- **Importing anything from `pricing-section.tsx`** — it's `"use client"` + Supabase + Whop + `CheckoutModal`. Crosses D-10 and breaks the static build. Mine the MODEL only.
- **`"use client"` on a section root mounted in `page.tsx`** — leaks the whole subtree to client, breaks the `○ /` static prerender (the standing build gate). Only `faq-accordion.tsx` is client, and it's an island.
- **Hardcoded hex / glass / glow / blur** — reference semantic tokens only (`--color-foreground`, `--color-surface-elevated`, `--color-border`, `--color-accent`). Coral (`--color-accent`) is reserved for CTAs only (A6 "keep it precious").
- **Adding `#proof`/`#testimonials`/`#cta` to `NAV_LINKS`** — D-19 forbids it. The new sections may carry ids for internal use, but `src/lib/nav.ts` is UNCHANGED.
- **Pure white text** — flat-warm uses cream (`--color-foreground` = cream-primary), never `text-white`. (The cold accordion uses `text-white` — restyle it.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard-accessible accordion (arrow keys, Enter/Space, focus mgmt, `aria-expanded`, single-open) | Custom `useState` open/close with hand-rolled key handlers | Radix `ui/accordion.tsx` (`type="single" collapsible`) | Radix implements the full WAI-ARIA accordion pattern incl. roving focus + arrow-key nav + correct aria roles. Re-implementing it is the classic a11y bug farm. [CITED: radix-ui.com/primitives/docs/components/accordion] |
| Logo-wall auto-scroll | Custom `requestAnimationFrame` transform loop | `ui/marquee.tsx` (CSS `animate-marquee`) | CSS-driven, GPU-composited, and already globally reduced-motion-gated (globals.css L363-369). A rAF loop would re-introduce the reduced-motion gate manually. |
| Aspect-locked, swappable, no-CLS placeholder visuals | Bare `<div>` boxes or `<img>` with no reserved box | `<Placeholder variant="logo"\|"avatar">` | One-prop `src` swap, per-variant default aspect, intentional flat-warm skeleton (Phase-3 craft lesson: empty boxes fail the taste bar). |
| Tier badge / "Most popular" pill | Custom span styling | `ui/badge.tsx` `variant="accent"` (coral) / `"secondary"` | Token-correct, sized, consistent with the system. |
| CTA button → link | Custom `<a>` with hand-styled hover | `ui/button.tsx` `variant="primary"` + `asChild` wrapping `<Link href={SIGNUP_URL}>` | Matches the established hero/pricing CTA pattern; `asChild` keeps it a real link for SEO/a11y. |
| Class merge with Tailwind conflict resolution | String concatenation | `cn()` (`src/lib/utils.ts`) | clsx + tailwind-merge; the project standard. |
| The score-gauge motif in the CTA band | A new bespoke SVG | `ScoreGaugeSkeleton` | D-14 mandates reuse; it's a pure-RSC static SVG, flat-warm tokens, no engine hook. |

**Key insight:** Phase 4 is almost entirely *composition of existing primitives*. The only genuinely new code is (a) two bespoke flat-warm cards (testimonial + pricing — because the existing ones are cold-brand with wrong anatomy/heavy client logic) and (b) section wrappers + drafted copy. Everything interactive or a11y-sensitive (accordion, marquee, reduced-motion) is already solved in-repo — do not re-solve it.

## Common Pitfalls

### Pitfall 1: The `StaggerReveal.Item` RSC-boundary trap (carried from Phase 3)
**What goes wrong:** Using `<StaggerReveal.Item>` in a pure-RSC section yields `undefined` at prerender → `next build` crashes on `/`.
**Why it happens:** `stagger-reveal.tsx` is `"use client"`; its `StaggerReveal.Item = StaggerRevealItem` static-prop assignment (line 102) does not survive the RSC→client serialization boundary.
**How to avoid:** Import and use the **named** `StaggerRevealItem` export: `import { StaggerReveal, StaggerRevealItem } from "@/components/motion"`.
**Warning signs:** `next build` error "Element type is invalid… got: undefined" on the `/` route.

### Pitfall 2: The cold-brand component trap
**What goes wrong:** Reusing `ui/testimonial-card.tsx` or `pricing-section.tsx` ships the old Raycast brand (white text, oklch glow, accent shadow, `border-white/[0.06]`, inset shine) into the flat-warm landing — instant craft-verify failure.
**Why it happens:** These were built in milestone 41-05 for the old brand and use `text-white`/`border-accent/20 shadow-[0_0_20px_oklch(...)]`/`bg-surface-elevated` cold tokens, plus (pricing) heavy `"use client"` Supabase/Whop logic.
**How to avoid:** Build bespoke flat-warm cards. For the FAQ, reuse the Radix accordion *structure* but restyle its className tokens (see Pitfall 3). Mirror the Phase-3 precedent (`story/*` components are bespoke flat-warm, not reused cold primitives).
**Warning signs:** `text-white`, `oklch(... glow)`, `border-accent/20`, `bg-background-elevated`, white inset `boxShadow` in any new Phase-4 component.

### Pitfall 3: The accordion is COLD BRAND — restyle its tokens (not just reuse it)
**What goes wrong:** D-17 says "reuse Radix `ui/accordion.tsx`", which is correct for a11y — but the component as written is societies.io/Raycast cold brand and will read wrong in flat-warm.
**Evidence (exact classNames in `ui/accordion.tsx`):**
- `AccordionItem`: `border-white/[0.06] bg-background-elevated/50` (cold — should be `border-border bg-surface-elevated/50` or flat-warm equivalent)
- `AccordionTrigger`: `text-base font-medium text-white … hover:text-white/80` (cold — should be `text-foreground … hover:text-foreground/80`)
- `AccordionContent`: `text-gray-400` (cold — should be `text-foreground-secondary`)
- Icon: `@phosphor-icons/react CaretDown text-white` (cold — should be `text-foreground-muted`)
**How to avoid:** Two clean options — (A) pass flat-warm overrides via the `className` prop on each part (`cn()` + tailwind-merge lets the override win for conflicting utilities like `text-white`→`text-foreground`); OR (B) the executor edits `ui/accordion.tsx` token defaults to flat-warm if no other surface depends on the cold styling. **Recommendation: option A (className overrides at the FAQ call site)** — it's surgical, avoids touching a shared `ui/` primitive other (legacy) routes might use, and is the cleaner reviewable diff. The a11y behavior (Radix) is untouched either way.
> ⚠ Note: `bg-background-elevated` resolves to `--color-charcoal-sidebar` (globals.css L86), a valid flat-warm token but the SIDEBAR shade, not the elevated-chip shade. `bg-surface-elevated` (`--color-charcoal-chip`, L88) is the canonical card-surface token used by `<Placeholder>` and the skeletons — prefer it for visual consistency with the rest of the landing.
**Warning signs:** FAQ panels read brighter/colder than the surrounding flat-warm sections; `text-gray-400` answer text.

### Pitfall 4: Marquee duplicate content is read N times by screen readers
**What goes wrong:** `ui/marquee.tsx` renders the children `repeat=4` times (line 57-71) for the seamless loop. None of the copies are `aria-hidden`, so a screen reader announces the logo wall up to 4×.
**Why it happens:** The Magic-UI marquee pattern duplicates the track visually but doesn't de-duplicate for the a11y tree; the in-repo version has no `aria-hidden` on copies.
**How to avoid:** Since the logos are decorative `<Placeholder variant="logo">` stand-ins (no real brand names yet), the cleanest fix is to mark the whole marquee region decorative — wrap it with `aria-hidden="true"` OR give the strip a single accessible label (e.g. the trust stat as the section's accessible name) and hide the marquee from the a11y tree. When real logos land (deferred), revisit. Best practice: duplicate-for-loop copies carry `aria-hidden`, with one visible copy named [CITED: danielnewton.dev/blog/react-marquee-component]. For placeholders, `aria-hidden` on the marquee is sufficient and honest.
**Warning signs:** Screen-reader output repeats "logo placeholder" multiple times.

### Pitfall 5: Leaking a client component into `page.tsx` breaks the `○ /` static build gate
**What goes wrong:** If a section root mounted directly in `page.tsx` carries `"use client"` (or transitively forces the page client), `next build` flips `/` from static (`○`) to dynamic — failing the standing build gate from Phases 1–3.
**Why it happens:** `page.tsx` is a pure RSC; the moment a directly-imported child is client-only at the root, Next can't prerender the route statically.
**How to avoid:** Keep every section root an RSC. The FAQ accordion is the only client piece — mount it as an island INSIDE an RSC section wrapper (`faq.tsx` RSC → `faq-accordion.tsx` client). `<MotionConfigShell>` is already the established client boundary and is fine. Verify with `npm run build` → route table shows `○ /`.
**Warning signs:** `next build` route table shows `ƒ /` (dynamic) or `λ /` instead of `○ /` (static).

### Pitfall 6: Two-band warmth ("faint warm radial") must stay flat-matte-legal
**What goes wrong:** D-12's "faint warm radial seat" can tempt a `radial-gradient` glow that reads as the banned glass/glow aesthetic.
**Why it happens:** "Radial" + "warm" sounds like a glow; the flat-warm system forbids glow/blur/glass.
**How to avoid:** Use a very-low-opacity `radial-gradient` *background tint* on the band surface (a tone-step, not a halo) — the device-chrome shadow precedent (`shadow-[0_40px_80px_-24px_rgba(0,0,0,0.72)]`, a layered DARK shadow, NOT a glow) shows the legal way to add depth. Keep the radial subtle and warm-charcoal, never coral-glow. Coral stays on the CTA only.
**Warning signs:** Visible coral halo, blur, or a glass surface on the band.

## Code Examples

Verified patterns from in-repo sources:

### Reused `<Marquee>` API (logo wall — D-02/D-03)
```tsx
// Source: src/components/ui/marquee.tsx (VERIFIED in-repo)
// Props: reverse?, pauseOnHover?, vertical?, repeat=4, className, ...divProps
<Marquee pauseOnHover className="[--duration:40s]" aria-hidden="true">
  {LOGOS.map((l) => (
    <Placeholder key={l} variant="logo" aspect="3/1" className="h-10 w-28 shrink-0" />
  ))}
</Marquee>
// animate-marquee is globally disabled under prefers-reduced-motion (globals.css L363-369)
```

### Reused `<Placeholder>` API (logo + avatar — VERIFIED)
```tsx
// Source: src/components/marketing/placeholder.tsx (VERIFIED in-repo)
// Props: variant: "image"|"video"|"avatar"|"logo"; aspect?: string; label?: string;
//        src?: string (one-prop swap); breathe?: boolean
// Defaults: avatar → aspect 1/1 (rounded-full); logo → aspect 3/1 (rounded-[--radius-lg])
// NOTE: for variant="logo" the label is intentionally NOT rendered (line 167:
//       `label && resolvedVariant !== "logo"`) — logos are icon-only stand-ins.
// NOTE: the "16:10"-style dev ratio label was REMOVED in Phase-3 gap-closure (03-04);
//       the current Placeholder renders an intentional flat-warm skeleton, no dev label.
<Placeholder variant="avatar" label="Creator" />                 {/* circular 1/1 */}
<Placeholder variant="logo" aspect="3/1" />                       {/* icon-only logo chip */}
```

### Reused `<ScoreGaugeSkeleton>` (CTA-band echo — D-14)
```tsx
// Source: src/components/marketing/story/skeletons/score-gauge-skeleton.tsx (VERIFIED)
// Pure RSC. Single prop { className }. Fixed score 87 "Strong" (>=70 honesty floor).
// 128×128 viewBox SVG; flat-warm tokens (track foreground-muted/25, sweep
// foreground-secondary). NO coral. role="img" aria-label="Virality score (sample)".
import { ScoreGaugeSkeleton } from "@/components/marketing/story/skeletons";
<ScoreGaugeSkeleton className="opacity-70 scale-75" />   {/* "small/muted" per D-14 */}
```

### Reused Radix accordion parts + flat-warm className override (D-16/D-17)
```tsx
// Source: src/components/ui/accordion.tsx (VERIFIED Radix-backed, "use client")
// Exports: AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent
// Root accepts Radix props incl. type="single" collapsible (VERIFIED via Radix docs).
// Restyle cold tokens via className (cn()/tailwind-merge lets the override win):
<AccordionItem value={q} className="border-border bg-surface-elevated/50">
  <AccordionTrigger className="text-foreground hover:text-foreground/80">
    {q}
  </AccordionTrigger>
  <AccordionContent className="text-foreground-secondary">{a}</AccordionContent>
</AccordionItem>
```

### Bespoke flat-warm testimonial card anatomy (D-07 — REBUILD)
```tsx
// New: marketing/proof/testimonial-card.tsx (RSC, flat-warm)
// Anatomy D-07: <Placeholder variant="avatar"> + name + @handle + quote + result metric
// Flat-warm card surface: bg-transparent border-border rounded-[--radius-lg];
// inset shine = the project's subtle white 5% inset (matches existing card token),
// NO coral, NO glow. Quote in cream-secondary; metric is the conversion lever (keep it).
<article className="rounded-[--radius-lg] border border-border bg-transparent p-6">
  <blockquote className="text-base leading-relaxed text-foreground-secondary">
    {quote}
  </blockquote>
  <div className="mt-4 text-sm font-medium text-foreground">{metric}</div>  {/* +2.3M views */}
  <div className="mt-6 flex items-center gap-3">
    <Placeholder variant="avatar" className="h-10 w-10" />
    <div>
      <div className="text-sm font-medium text-foreground">{name}</div>
      <div className="text-xs text-foreground-muted">@{handle}</div>
    </div>
  </div>
</article>
```

### Reference-only: the REAL tier model to mirror (D-11 — DO NOT import)
```ts
// Source: src/app/(marketing)/pricing/pricing-section.tsx + src/lib/whop/config.ts (READ-ONLY)
// Real model (mine the SHAPE, do NOT import the machinery — D-10):
//   Tiers: free(0) < starter(1) < pro(2)  [whop/config.ts TIER_HIERARCHY]
//   Real Starter: $19/mo, "Viral prediction score: 5 / month", "Trend intelligence: Basic"
//   Real Pro:     $49/mo, "Unlimited", "Advanced", + Audience insights / Referral / Calendar /
//                 Priority support / Export reports; 7-day free Pro trial
// Teaser reframe (D-09/D-11, conversion):
//   Starter → "Free to start" · ~3-4 bullets: 5 simulations/mo, core score + why, basic trend read
//   Pro     → placeholder $/mo (e.g. $19/mo, swappable) + "7-day free trial" badge ·
//             ~3-4 bullets: unlimited simulations, advanced insights, audience deep-dive, priority
//   Both CTAs → <Link href={SIGNUP_URL}> ("Try it free") — NO CheckoutModal, NO auth.
// FORBIDDEN imports into the teaser: createClient (Supabase), useSubscription, CheckoutModal,
//   hasAccessToTier, WHOP_PRODUCT_IDS — all live in the real /pricing route only.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cold Raycast brand (`#FF7F50` coral, `#07080a` bg, glass/glow, white text) | Flat-warm Numen (charcoal `#262624`, cream `#ece7de`, terracotta `#d97757`, flat-matte) | Phase 1 (THEME-06 UAT) | All Phase-4 components use flat-warm tokens; the OLD `ui/testimonial-card.tsx`, `pricing-section.tsx`, `ui/accordion.tsx` styling are stale and must not be copied verbatim. |
| `BRAND-BIBLE.md` (Raycast glass) | `globals.css @theme` + `01-CONTEXT.md` | Phase 1 | BRAND-BIBLE is STALE — do not use for visual direction. |
| Placeholder with "16:10"-style dev ratio label | Intentional flat-warm skeleton, no dev label | Phase 3 gap-closure (03-04) | Placeholders already look intentional; no extra treatment needed beyond reusing them. |

**Deprecated/outdated:**
- `ui/testimonial-card.tsx` styling — cold brand, missing @handle/metric. Reference structure only.
- `pricing-section.tsx` — cold brand + heavy client/Whop/Supabase logic. Reference the tier MODEL only.
- The cold token defaults inside `ui/accordion.tsx` (`text-white`, `text-gray-400`, `bg-background-elevated`) — restyle at the call site.

## Validation Architecture

> `workflow.nyquist_validation: true` (config.json) — this section is REQUIRED. Mirrors the Phase-3 `03-VALIDATION.md` structure exactly.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`) + `@testing-library/react` + happy-dom (per-file `/** @vitest-environment happy-dom */` pragma) |
| Config file | `vitest.config.ts` (default env `node`; component files opt into happy-dom per-file) |
| Quick run command | `npx vitest run src/components/marketing/proof/ src/components/marketing/pricing/ src/components/marketing/faq/ src/components/marketing/cta/` (or scope per-section during a task) |
| Full suite command | `npm test` (= `vitest run`) — **baseline 1985 green** as of Phase-3 gap-closure (VERIFIED by running `npx vitest run` → `PASS (1985) FAIL (0)`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROOF-01 | Strip renders a trust stat (text) + a marquee of ≥N logo placeholders (`[data-variant="logo"]`) | unit | `npx vitest run src/components/marketing/proof/__tests__/social-proof-strip.test.tsx` | ❌ Wave 0 |
| PROOF-01 | Marquee region is hidden from a11y tree (`aria-hidden`) OR labelled (Pitfall 4) | unit | same file | ❌ Wave 0 |
| PROOF-02 | Exactly 3 testimonial cards; each has avatar placeholder + name + @handle + quote + metric | unit | `npx vitest run src/components/marketing/proof/__tests__/testimonials.test.tsx` | ❌ Wave 0 |
| CONVERT-01 | Two tier cards (Starter + Pro); Pro carries "Most popular"; both CTAs link to `SIGNUP_URL`; 3–4 bullets each | unit | `npx vitest run src/components/marketing/pricing/__tests__/pricing-teaser.test.tsx` | ❌ Wave 0 |
| CONVERT-01 | NO Supabase/Whop/CheckoutModal import (static guard) | unit (import-absence) OR build | grep/assert no forbidden import; `npm run build` `○ /` | ❌ Wave 0 |
| CONVERT-02 | Final band renders before `<Footer/>`; serif close-line; one CTA → `SIGNUP_URL`; ScoreGaugeSkeleton present | unit | `npx vitest run src/components/marketing/cta/__tests__/final-cta-band.test.tsx` | ❌ Wave 0 |
| CONVERT-03 | FAQ renders 6 items; `type="single"` (one panel open at a time); each trigger is a button (Radix → keyboard a11y) | unit | `npx vitest run src/components/marketing/faq/__tests__/faq.test.tsx` | ❌ Wave 0 |
| (cross) | `page.tsx` D-18 order: strip after #hero, testimonials after #features, pricing fills #pricing, faq fills #faq, band before footer | unit (page) OR build | extend a `page.test.tsx` if present, else assert in section tests | ❌ Wave 0 (verify) |
| (cross) | `/` stays statically prerendered — no `"use client"` leaked to a section root | build assertion | `npm run build` → route table shows `○ /` | n/a (build gate) |
| (cross) | `NAV_LINKS` UNCHANGED (D-19) — still exactly 5 links | unit | extend existing nav/footer test if present | verify |

### Test idioms to mirror (from `03-00-PLAN.md` interfaces + `placeholder.test.tsx`/`hero.test.tsx`)
```tsx
// Line 1 of EVERY test file:
/** @vitest-environment happy-dom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// Placeholder-presence / count idiom (Success-Crit style):
container.querySelectorAll('[data-variant="logo"]')      // count logo placeholders
container.querySelector('[data-variant="avatar"]')       // testimonial avatar present

// Stable-token assertion, NOT full sentences (resilience idiom from hero.test.tsx):
screen.getByText(/2,?000\+? creators/i)                  // trust stat (tolerate copy tweaks)
screen.getAllByRole("button")                            // accordion triggers are buttons (Radix)

// CTA target assertion:
screen.getAllByRole("link").some(a => a.getAttribute("href") === "/signup")
```

### Sampling Rate
- **Per task commit:** `npx vitest run <the section dir under test>` (~5s scoped)
- **Per wave merge:** `npm test` (full suite green, ~60s) + `npm run build` (exit 0, route table shows `○ /` static)
- **Phase gate:** Full suite green + clean build before `/gsd:verify-work`; then **live human craft UAT** (Phase-2/3 precedent — the taste bar is human-gated).

### Wave 0 Gaps
- [ ] `src/components/marketing/proof/__tests__/social-proof-strip.test.tsx` — PROOF-01 (trust stat + logo marquee count + a11y)
- [ ] `src/components/marketing/proof/__tests__/testimonials.test.tsx` — PROOF-02 (3 cards, full anatomy)
- [ ] `src/components/marketing/pricing/__tests__/pricing-teaser.test.tsx` — CONVERT-01 (2 tiers, Most-popular, CTAs→SIGNUP_URL, bullet count, no-forbidden-import)
- [ ] `src/components/marketing/faq/__tests__/faq.test.tsx` — CONVERT-03 (6 items, single-open, button triggers)
- [ ] `src/components/marketing/cta/__tests__/final-cta-band.test.tsx` — CONVERT-02 (serif line, CTA→SIGNUP_URL, gauge echo)
- [ ] Page-order / NAV-unchanged coverage — verify whether a `page.test.tsx` exists to extend; if not, assert section presence + order + `NAV_LINKS.length === 5` in a small test.
- [ ] Framework install: **none** — Vitest + Testing Library + happy-dom already present (used by `placeholder.test.tsx`, story tests).

> All test files use the `/** @vitest-environment happy-dom */` pragma (line 1) and are RED-by-design (module-not-found until the section components exist) — exactly the `03-00` scaffold pattern.

## Security Domain

> The phase is a **static marketing surface with zero user input, zero auth, zero data** beyond outbound `<Link href="/signup">`. Most ASVS categories are N/A by construction.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth on this surface (D-10 forbids it); CTA links to the app's existing signup. |
| V3 Session Management | no | No sessions on the marketing page. |
| V4 Access Control | no | All content is public marketing. |
| V5 Input Validation | no | **No user input fields** — no forms, no waitlist (deferred). CTAs are static links. |
| V6 Cryptography | no | No secrets, no crypto on this surface. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via CTA | Tampering | CTA target is the hardcoded internal constant `SIGNUP_URL = "/signup"` (`src/lib/routes.ts`) — no user-controlled redirect param. (Phase 1 already fixed an OAuth open-redirect elsewhere; this surface introduces none.) |
| Accidental secret/PII in placeholder copy | Information Disclosure | Drafted testimonials/metrics are FICTIONAL placeholders (D-21) — by construction contain no real PII or secrets. |
| `dangerouslySetInnerHTML` in FAQ/testimonial copy | XSS | Use plain string children only (no HTML injection); React escapes by default. No `dangerouslySetInnerHTML` anywhere. |

## Environment Availability

> All dependencies are in-repo npm packages already installed and exercised by Phases 1–3. No external services, runtimes, or CLIs beyond the existing toolchain.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest + @testing-library/react + happy-dom | Nyquist tests | ✓ | in `package.json`, 1985 tests green | — |
| Next.js build (`next build`) | static-build gate | ✓ | Next 15 | — |
| `@radix-ui/react-accordion` | FAQ (D-17) | ✓ | used by `ui/accordion.tsx` | — |
| `motion@12` | entrance reveals | ✓ | installed | reduced-motion path is the fallback |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## State of the Art (external pattern confirmation)

Brief — the design direction is already locked in CONTEXT; these confirm structural patterns only.

- **OpusClip / Linear / Raycast proof + pricing + FAQ shape** (VISION §4): the standard calm-dark structure is a thin logo/stat strip high on the page, a 2-column pricing block with the upper tier highlighted ("Most popular" pill), and a single-open FAQ accordion near the conversion tail. The Phase-4 decisions (D-01/D-08/D-16) already mirror this. Typographic restraint (one accent color, generous spacing, no loud motion) is the through-line — matches flat-warm. [CITED: VISION §4; MEDIUM]
- **Marquee a11y best practice** [CITED: danielnewton.dev/blog/react-marquee-component, wcag.dock.codes/wcag222]: duplicate-for-loop copies should carry `aria-hidden`; `prefers-reduced-motion` should pause/stop entirely (the in-repo marquee already does the latter via globals.css); optional gradient mask on the strip edges is a visual nicety (not required). For decorative placeholder logos, `aria-hidden` on the marquee region is the simplest honest fix. [MEDIUM]
- **Radix single-open accordion** [CITED: radix-ui.com/primitives/docs/components/accordion]: `type="single"` + `collapsible` gives one-panel-at-a-time with the ability to close all; Tab focuses triggers, Enter/Space toggles, arrow keys move between items, focus management is handled. The planner must NOT re-implement any of this. [HIGH]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Placeholder Pro price `$19/mo`, peer-count `2,000+`, per-quote metrics (`+2.3M views`, `3× hook rate`) are plausible swappable stand-ins | Pricing/Testimonials | LOW — explicitly Claude's-discretion (D-09/D-04/D-07); all are swap slots, human swaps real numbers later. Planner/executor pick within intent. |
| A2 | `proof/`, `pricing/`, `faq/`, `cta/` subdir layout + barrel exports is the right structure | Project Structure | LOW — Claude's discretion on layout; mirrors `story/`. Planner may consolidate. |
| A3 | className-override (option A) is the cleaner way to flat-warm-restyle the accordion vs editing the shared `ui/` primitive | Pitfall 3 | LOW — both work; recommendation is reversible. If a legacy route depends on the cold accordion styling, option A is strictly safer. |
| A4 | A `page.test.tsx` may or may not exist to extend for the order/NAV-unchanged assertion | Validation | LOW — Wave 0 verifies existence; falls back to a small new test. |
| A5 | The marquee `repeat=4` copies are not individually `aria-hidden` and should be hidden as a region for placeholder logos | Pitfall 4 | LOW-MEDIUM — verified in source; the planner should confirm the chosen a11y approach at UAT. |

**Note:** No assumption here is a locked decision in disguise — D-01..D-21 are the locked decisions and are honored verbatim. The above are discretion-area choices flagged for executor freedom.

## Open Questions (RESOLVED)

1. **Does a `page.test.tsx` (or `header.test.tsx`) exist to extend for the D-18 order + D-19 NAV-unchanged assertions?**
   - What we know: `footer.test.tsx` exists (Phase 3 extended it for `#features`); section components have their own `__tests__/`.
   - What's unclear: whether a page-level order test exists.
   - **RESOLVED:** none exists → 04-00 Task 2 creates a fresh `page-order.test.tsx` asserting the 5 new/filled sections render in D-18 order and `NAV_LINKS.length === 5`.

2. **Restyle the shared `ui/accordion.tsx` in place, or override at the FAQ call site?**
   - What we know: the primitive is cold-brand; `cn()`/tailwind-merge supports call-site overrides.
   - What's unclear: whether any legacy (non-marketing) route still renders the cold accordion and would regress if defaults change.
   - **RESOLVED:** **call-site className overrides (option A)** — surgical, no shared-primitive risk; locked into 04-03. (A3.)

3. **CTA-band "faint warm radial" exact intensity.**
   - What we know: must stay flat-matte-legal (no glow/glass); Claude's discretion (D — band radial intensity).
   - What's unclear: the precise opacity that reads "warm seat" without reading "glow".
   - **RESOLVED:** Claude's-discretion + live-UAT gate — start very subtle (low-opacity warm-charcoal radial tint, the verbatim flat-matte-legal radial from `simulation-showcase.tsx`), human eyes decide at the closing moment. Coral stays on the CTA only.

## Sources

### Primary (HIGH confidence — VERIFIED in-repo this session)
- `src/components/ui/marquee.tsx` — marquee API (`reverse`/`pauseOnHover`/`vertical`/`repeat`), CSS-driven, no internal `aria-hidden`.
- `src/components/ui/accordion.tsx` — Radix-backed, `"use client"`, cold-brand classNames (exact tokens quoted in Pitfall 3).
- `src/components/ui/testimonial-card.tsx` — cold brand, anatomy `{quote, author:{name,role,company,avatar}}`, NO @handle/metric → rebuild.
- `src/components/marketing/placeholder.tsx` — `variant` logo/avatar, `aspect`/`label`/`src`/`breathe`; logo label suppressed; no dev ratio label.
- `src/components/marketing/story/skeletons/score-gauge-skeleton.tsx` — pure RSC, `{className}`, fixed 87 "Strong", flat-warm, no coral.
- `src/components/marketing/story/skeletons/device-chrome.tsx` — `BrowserChrome`/`PhoneChrome` (legal flat-warm depth = layered DARK shadow, NOT glow).
- `src/app/(marketing)/page.tsx` — pure RSC, D-18 mount points, `#pricing`/`#faq` stubs, locked `scroll-mt-20 border-t border-border px-6 py-16 md:py-20` + `mx-auto max-w-5xl` rhythm, `<Footer/>` mount.
- `src/components/motion/stagger-reveal.tsx` + `index.ts` — `StaggerReveal`/`StaggerRevealItem` named exports; `.Item` static-prop landmine (line 102).
- `src/components/marketing/story/feature-blocks.tsx` + `how-it-works.tsx` — the pure-RSC section idiom + named-export usage + flat-warm token discipline (the build pattern to mirror).
- `src/components/marketing/story/__tests__/feature-blocks.test.tsx` + `03-00-PLAN.md` — the Nyquist RED scaffold + test idioms.
- `src/lib/routes.ts` (`SIGNUP_URL="/signup"`, `LOGIN_URL="/login"`), `src/lib/nav.ts` (5 locked links), `src/lib/utils.ts` (`cn`).
- `src/app/(marketing)/pricing/pricing-section.tsx` + `src/lib/whop/config.ts` — real tier model (Starter $19/5-mo, Pro $49/unlimited/7-day trial) + the forbidden client/Whop/Supabase imports.
- `src/components/ui/badge.tsx` — `variant` accent/secondary, `size` sm/md.
- `src/app/globals.css` — marquee keyframes (L330-349) + reduced-motion hard-stop (L363-369) + accordion keyframes (L256-265) + tokens (`--color-accent`, `--color-surface-elevated`, `--color-border`, `--radius-lg`, `--color-background-elevated`).
- `vitest.config.ts` + `package.json` — runner/scripts; `npx vitest run` → **1985 green** baseline (run this session).
- `.planning/phases/03-story-showcase/03-VALIDATION.md` — the validation-doc structure mirrored here.

### Secondary (MEDIUM confidence — external, verified against official sources)
- [radix-ui.com/primitives/docs/components/accordion](https://www.radix-ui.com/primitives/docs/components/accordion) — `type="single"` + `collapsible`, WAI-ARIA keyboard a11y, focus mgmt.
- [danielnewton.dev/blog/react-marquee-component](https://www.danielnewton.dev/blog/react-marquee-component/) — marquee a11y (`aria-hidden` on duplicate track, reduced-motion).
- [wcag.dock.codes/documentation/wcag222](https://wcag.dock.codes/documentation/wcag222/) — WCAG 2.2.2 pause/stop/hide for moving content.
- `.planning/LANDING-VISION.md` §4 (OpusClip/Linear/Raycast structural refs), §5 (placeholder strategy), §8 (guardrails).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every primitive verified in-repo; zero new installs.
- Architecture: HIGH — RSC + single-client-island pattern is established and verified across Phases 1–3.
- Pitfalls: HIGH — all six are either carried-and-documented (StaggerReveal, cold-brand, build gate) or verified in source this session (accordion cold tokens, marquee a11y).
- External patterns: MEDIUM — confirm structural conventions only; design is locked in CONTEXT.

**Research date:** 2026-06-15
**Valid until:** ~2026-07-15 (stable — in-repo facts don't drift; re-verify the 1985 test baseline at plan time if Phase-4 work has begun).
