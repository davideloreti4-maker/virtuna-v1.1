# Phase 4: Proof & Conversion - Pattern Map

**Mapped:** 2026-06-15
**Files analyzed:** 13 (8 new components + 5 new tests + 2 modified) 
**Analogs found:** 15 / 15 (every Phase-4 file maps to a verified in-repo template)

Phase 4 is **pure composition of existing primitives**. There is no "no-analog" file — every
new component mirrors a verified Phase-1/2/3 source. The only genuinely new code is two bespoke
flat-warm cards (testimonial + pricing — the existing UI primitives are cold-brand with wrong
anatomy / heavy client logic) and drafted copy.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `marketing/proof/social-proof-strip.tsx` | component (section, RSC) | transform (static render) | `marketing/story/simulation-showcase.tsx` (RSC section + `Marquee` + `Placeholder`) | role-match (new compose) |
| `marketing/proof/testimonials.tsx` | component (section grid, RSC) | transform | `marketing/story/feature-blocks.tsx` (RSC + StaggerReveal grid) | exact |
| `marketing/proof/testimonial-card.tsx` | component (card, RSC) | transform | `marketing/story/feature-block.tsx` structure + RESEARCH § anatomy excerpt; cold `ui/testimonial-card.tsx` = anti-analog | role-match (REBUILD) |
| `marketing/pricing/pricing-teaser.tsx` | component (section, RSC) | transform | `marketing/story/feature-blocks.tsx` (RSC grid) | exact |
| `marketing/pricing/pricing-card.tsx` | component (card, RSC) | transform | flat-warm card surface (`ui/testimonial-card.tsx` surface only) + `ui/badge.tsx` + `ui/button.tsx asChild`; `pricing-section.tsx` = MODEL only (anti-analog) | role-match (REBUILD) |
| `marketing/cta/final-cta-band.tsx` | component (full-bleed band, RSC) | transform | `marketing/story/simulation-showcase.tsx` (warm-seat radial + device depth) + `score-gauge-skeleton.tsx` | role-match |
| `marketing/faq/faq.tsx` | component (section wrapper, RSC) | transform | `marketing/story/how-it-works.tsx` (RSC section heading) | exact |
| `marketing/faq/faq-accordion.tsx` | component (client island) | event-driven (expand/collapse) | `ui/accordion.tsx` (Radix, restyled) — the lone Phase-4 client island | role-match (RESTYLE) |
| `src/app/(marketing)/page.tsx` | route (RSC page) | transform | itself (lines 89-111 = the `#pricing`/`#faq` stubs to fill; lines 80-87 = insert rhythm) | exact (in-place edit) |
| `src/components/marketing/index.ts` | config (barrel) | — | itself (lines 7-11 = current section exports) | exact (append) |
| `proof/__tests__/social-proof-strip.test.tsx` | test | — | `story/__tests__/feature-blocks.test.tsx` | exact |
| `proof/__tests__/testimonials.test.tsx` | test | — | `story/__tests__/feature-blocks.test.tsx` | exact |
| `pricing/__tests__/pricing-teaser.test.tsx` | test | — | `story/__tests__/feature-blocks.test.tsx` | exact |
| `faq/__tests__/faq.test.tsx` | test | — | `story/__tests__/feature-blocks.test.tsx` | exact |
| `cta/__tests__/final-cta-band.test.tsx` | test | — | `story/__tests__/feature-blocks.test.tsx` | exact |

> Directory layout (`proof/ pricing/ faq/ cta/`) is Claude's-discretion (CONTEXT) and mirrors
> `story/`. Each section exports through the marketing barrel.

---

## Pattern Assignments

### `marketing/proof/social-proof-strip.tsx` (component · RSC · PROOF-01, D-01..D-04)

**Analogs:** `marketing/story/simulation-showcase.tsx` (RSC section idiom) + `ui/marquee.tsx` (reuse) + `marketing/placeholder.tsx` (reuse `variant="logo"`).

**Section shell pattern** — pure RSC, single `{ className }` prop, sans heading (serif stays precious to the hero). Copy the `simulation-showcase.tsx:72-86` shape:
```tsx
// Source: src/components/marketing/story/simulation-showcase.tsx lines 72-86
export function SimulationShowcase({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      <h2 className="text-3xl font-semibold text-foreground">The Simulation</h2>
      <p className="mt-4 max-w-[60ch] text-base text-foreground-secondary md:text-lg">…</p>
```

**Reused `<Marquee>` API** — props are `reverse? / pauseOnHover? / vertical? / repeat=4 / className`; CSS-driven `animate-marquee` (no JS, globally reduced-motion-gated):
```tsx
// Source: src/components/ui/marquee.tsx lines 36-44 (signature) + 57-71 (repeat=4 track)
export function Marquee({ className, reverse=false, pauseOnHover=false,
  children, vertical=false, repeat=4, ...props }: MarqueeProps)
// Array(repeat).fill(0).map → 4 duplicated copies of children, NONE aria-hidden
```

**Reused `<Placeholder variant="logo">`** — logo label is intentionally suppressed (icon-only), default aspect `3/1`, `data-variant="logo"` is the test count hook:
```tsx
// Source: src/components/marketing/placeholder.tsx — DEFAULT_ASPECT.logo="3/1" (line 58);
//   line 167: `label && resolvedVariant !== "logo"` → logo renders icon only;
//   line 121: data-variant={resolvedVariant} → query [data-variant="logo"] in tests
<Placeholder variant="logo" aspect="3/1" className="h-10 w-28 shrink-0" />
```

**Adaptation vs analog:** No device frame, no skeletons. Compose: a headline trust stat (e.g. "Join 2,000+ creators", swappable — D-04) + a `<Marquee pauseOnHover>` of N `<Placeholder variant="logo">` slots. Rides directly under `#hero` (D-01/D-18).

> ⚠ **LANDMINE — marquee a11y (RESEARCH Pitfall 4):** `ui/marquee.tsx` renders children
> `repeat=4` times (lines 57-71); none are `aria-hidden`, so a screen reader announces the
> logo wall up to 4×. Since logos are decorative `<Placeholder>` stand-ins, wrap the marquee
> region with `aria-hidden="true"` (or give the strip one accessible name via the trust stat).
> The PROOF-01 test asserts this (RESEARCH § Test Map).

---

### `marketing/proof/testimonials.tsx` (component · RSC grid · PROOF-02, D-05/D-06)

**Analog:** `marketing/story/feature-blocks.tsx` (the canonical RSC-section-with-StaggerReveal-grid idiom). RESEARCH § Pattern 1 quotes this exact shape.

**Core pattern** — module-level const array mapped through a card, wrapped in `StaggerReveal` / `StaggerRevealItem`:
```tsx
// Source: src/components/marketing/story/feature-blocks.tsx lines 78-104
export function FeatureBlocks({ className }: { className?: string }) {
  return (
    <div className={cn(className)}>
      <h2 className="text-3xl font-semibold text-foreground">…</h2>
      <StaggerReveal className="mt-16 flex flex-col gap-12 md:gap-16">
        {FEATURES.map((f, i) => (
          <StaggerRevealItem key={f.title}>
            <FeatureBlock title={f.title} body={f.body} visual={f.visual} flip={i % 2 === 1} />
          </StaggerRevealItem>
        ))}
      </StaggerReveal>
    </div>
  );
}
```

**Imports pattern** (line 3) — named exports from the motion barrel:
```tsx
// Source: src/components/marketing/story/feature-blocks.tsx line 3
import { StaggerReveal, StaggerRevealItem } from "@/components/motion";
```

**Adaptation vs analog:** Swap the flex column for a 3-up grid (D-06 — static grid, NOT a carousel): `<StaggerReveal className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">`. Map a `TESTIMONIALS` const (3 entries) through `<TestimonialCard>`. Exactly 3 cards (test asserts count).

> ⚠ **LANDMINE — StaggerReveal.Item RSC-boundary trap (RESEARCH Pitfall 1, carried from 03-01):**
> Use the **named `StaggerRevealItem`** import, NOT `StaggerReveal.Item`. The `.Item` static prop
> (`stagger-reveal.tsx` line 102) is `undefined` across the RSC→client prerender boundary →
> `next build` crashes on `/` with "Element type is invalid… got: undefined". The motion barrel
> already exports the named form (`motion/index.ts` line 7).

---

### `marketing/proof/testimonial-card.tsx` (component · RSC card · D-07 — **REBUILD bespoke flat-warm**)

**Analogs:** flat-warm card *surface* from `ui/testimonial-card.tsx` lines 96-110 (surface only) + the RESEARCH § anatomy excerpt. **`ui/testimonial-card.tsx` is the ANTI-analog for styling + fields.**

**Anatomy to build (D-07)** — RESEARCH gives the verbatim flat-warm shape:
```tsx
// Source: 04-RESEARCH.md § "Bespoke flat-warm testimonial card anatomy" (lines 427-447)
<article className="rounded-[--radius-lg] border border-border bg-transparent p-6">
  <blockquote className="text-base leading-relaxed text-foreground-secondary">{quote}</blockquote>
  <div className="mt-4 text-sm font-medium text-foreground">{metric}</div>   {/* +2.3M views — the conversion lever */}
  <div className="mt-6 flex items-center gap-3">
    <Placeholder variant="avatar" className="h-10 w-10" />
    <div>
      <div className="text-sm font-medium text-foreground">{name}</div>
      <div className="text-xs text-foreground-muted">@{handle}</div>
    </div>
  </div>
</article>
```

**Legal flat-warm card surface** — the project's subtle white-5% inset (NO glow, NO oklch). Take ONLY the inset boxShadow + `bg-transparent border-border` from the cold card; DROP its `featured` glow:
```tsx
// Source: src/components/ui/testimonial-card.tsx lines 99-108 — KEEP only the inset + border-border:
className="… border bg-transparent … border-border"
style={{ boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset" }}
// DROP: featured ? "border-accent/20 shadow-[0_0_20px_oklch(0.72_0.16_40_/_0.05)]" (cold glow)
```

**Reused `<Placeholder variant="avatar">`** — default aspect `1/1`, `rounded-full`, `data-variant="avatar"` count hook (placeholder.tsx lines 31/58/121).

**Adaptation vs analog:** The cold `ui/testimonial-card.tsx` has anatomy `{quote, author:{name, role, company, avatar}}` — **NO `@handle`, NO `result metric`**, both of which D-07 requires. Restyling tokens cannot add missing fields → rebuild. New props: `{ quote, name, handle, metric }`. RSC (no `"use client"`). Use `<Placeholder variant="avatar">`, NOT raw `ui/avatar.tsx` (D-07 explicitly specifies Placeholder).

> ⚠ **LANDMINE — cold-brand trap (RESEARCH Pitfall 2):** Do NOT reuse `ui/testimonial-card.tsx`'s
> styling — it ships `text-white`, `border-accent/20`, `shadow-[…oklch glow…]`. Flat-warm uses
> cream (`text-foreground`/`text-foreground-secondary`), never `text-white`; coral is CTA-only.

---

### `marketing/pricing/pricing-teaser.tsx` (component · RSC section · CONVERT-01, D-08..D-11)

**Analog:** `marketing/story/feature-blocks.tsx` (RSC section + grid + module-level const). Same `{ className }` + sans `<h2>` + grid map shape as Testimonials above.

**Adaptation vs analog:** Map a 2-entry `TIERS` const through `<PricingCard>` in a 2-up grid (`grid-cols-1 md:grid-cols-2`, D-08). Pro card carries the highlight. RSC — no StaggerReveal required (calm, 2 cards), but a `StaggerReveal` leaf is allowed (use the named-item form if so).

> ⚠ **LANDMINE — static-build gate (RESEARCH Pitfall 5):** No `"use client"` at this section root.
> The teaser is pure RSC + `<Link>`. The CONVERT-01 test includes an import-absence guard.

---

### `marketing/pricing/pricing-card.tsx` (component · RSC card · D-09/D-10/D-11 — **REBUILD bespoke flat-warm**)

**Analogs:** flat-warm card surface (same inset shine as the testimonial card) + `ui/badge.tsx` (the "Most popular" / trial pills) + `ui/button.tsx asChild` (the CTA→link). **`pricing-section.tsx` is the MODEL-only anti-analog (D-10).**

**Reused `<Badge>` API** — `variant="accent"` (coral, "Most popular") / `variant="secondary"` (neutral, "7-day free trial"); `size="sm"|"md"`:
```tsx
// Source: src/components/ui/badge.tsx lines 48-72 (variants) + 113-122 (component)
<Badge variant="accent" size="sm">Most popular</Badge>      {/* coral — bg-accent/15 text-accent border-accent/25 */}
<Badge variant="secondary" size="sm">7-day free trial</Badge> {/* neutral — bg-surface-elevated */}
```

**Reused `<Button asChild>` → `<Link>`** — the established CTA-as-link pattern (matches the real `pricing-section.tsx renderCTA`):
```tsx
// Source: src/components/ui/button.tsx lines 53-56 (primary=coral) + 157/174 (asChild=Slot, single child)
<Button asChild variant="primary" size="lg">
  <Link href={SIGNUP_URL}>Try it free</Link>
</Button>
// asChild requires EXACTLY ONE element child (React.Children.only) — wrap one <Link> only.
```

**Reference-only tier MODEL to mirror (D-11, DO NOT import):**
```ts
// Source: 04-RESEARCH.md lines 449-464 (mined from pricing-section.tsx + whop/config.ts)
// Real:   Starter $19/mo "5 / month" "Basic"; Pro $49/mo "Unlimited" "Advanced" + 7-day Pro trial.
// Teaser reframe (D-09/D-11):
//   Starter → "Free to start" · ~3-4 bullets (5 simulations/mo, core score + why, basic trend read)
//   Pro     → placeholder "$19/mo" (swappable) + "7-day free trial" badge · ~3-4 bullets
//             (unlimited simulations, advanced insights, audience deep-dive, priority)
//   Both CTAs → <Link href={SIGNUP_URL}> "Try it free"
```

**Adaptation vs analog:** Bespoke RSC card. Props: `{ name, price, highlighted?, badge?, bullets[], ctaLabel }`, all CTAs → `SIGNUP_URL`. 3-4 bullets each (D-08, test asserts count). Pro highlighted = a token-legal accent ring/border emphasis, NOT a glow. Add the D-20 risk-reducer microcopy ("Free to start — no credit card") near the CTA.

> ⚠ **LANDMINE — forbidden imports (RESEARCH Pitfall 2 + D-10):** `pricing-section.tsx` is
> `"use client"` and imports `createClient` (Supabase), `useSubscription`, `CheckoutModal`,
> `hasAccessToTier`, `WHOP_PRODUCT_IDS` (verified head, lines 1-10). Importing ANY of those
> violates D-10 AND breaks the static build. Mine the tier MODEL only — never the machinery.

---

### `marketing/cta/final-cta-band.tsx` (component · RSC full-bleed band · CONVERT-02, D-12..D-14)

**Analogs:** `marketing/story/simulation-showcase.tsx` lines 89-105 (the warm-seat radial + layered-dark-shadow depth — the flat-warm-legal way to add a "warm seat" without a glow) + `score-gauge-skeleton.tsx` (reuse, D-14).

**Legal warm-seat radial (D-12, flat-matte-safe)** — copy the verbatim low-alpha cream radial from the showcase (NOT a coral glow):
```tsx
// Source: src/components/marketing/story/simulation-showcase.tsx lines 92-100
<div aria-hidden="true" className="pointer-events-none absolute -inset-x-16 -inset-y-10 -z-10"
  style={{ background:
    "radial-gradient(68% 60% at 50% 36%, rgba(236,231,222,0.07), transparent 70%)" }} />
// Legal DARK-shadow depth (NOT glow): shadow-[0_40px_80px_-24px_rgba(0,0,0,0.72), …]  (line 105)
```

**Reused `<ScoreGaugeSkeleton>` echo (D-14)** — pure RSC, `{ className }`, fixed 87 "Strong", flat-warm tokens, no coral; render small/muted:
```tsx
// Source: src/components/marketing/story/skeletons/score-gauge-skeleton.tsx lines 35/39-40 + 78-86
import { ScoreGaugeSkeleton } from "@/components/marketing/story/skeletons";
<ScoreGaugeSkeleton className="opacity-70 scale-75" />   {/* "small/muted" per D-14 */}
// role="img" aria-label="Virality score (sample)"; track foreground-muted/25, sweep foreground-secondary
```

**Adaptation vs analog:** Full-bleed band — breaks the `max-w-5xl` measure (D-12). Inner content `mx-auto max-w-3xl text-center`. The band carries the **Newsreader serif close-line** (the serif voice recurs at the close, D-13 — the lone serif moment in Phase 4) + one primary CTA `<Button variant="primary" asChild><Link href={SIGNUP_URL}></Link></Button>` + the D-20 risk-reducer microcopy + the muted gauge echo. Coral on the CTA only.

> ⚠ **LANDMINE — band radial must stay flat-matte-legal (RESEARCH Pitfall 6):** "Faint warm
> radial seat" must be a very-low-opacity warm-charcoal/cream tone-step (the showcase precedent
> above), NEVER a coral halo, blur, or glass surface. Depth comes from a layered DARK shadow.

---

### `marketing/faq/faq.tsx` (component · RSC section wrapper · CONVERT-03)

**Analog:** `marketing/story/how-it-works.tsx` lines 1-9 (RSC section, no `"use client"`, sans heading) — the established RSC-wrapper-mounts-a-leaf pattern.

**Pattern** — RSC heading + mounts the one client island:
```tsx
// Source pattern: 04-RESEARCH.md § Pattern 2 (lines 263-272), mirroring how-it-works.tsx
export function Faq({ className }: { className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-3xl font-semibold text-foreground">Questions, answered</h2>
      <FaqAccordion className="mt-10" />   {/* the only client island */}
    </div>
  );
}
```

**Adaptation vs analog:** `how-it-works.tsx` mounts skeletons; `faq.tsx` mounts the `<FaqAccordion>` client island under an RSC heading so the page root stays RSC.

---

### `marketing/faq/faq-accordion.tsx` (component · **client island** · CONVERT-03, D-15/D-16/D-17 — **RESTYLE Radix**)

**Analog:** `ui/accordion.tsx` (Radix-backed, `"use client"`, exports `AccordionRoot/Item/Trigger/Content`). **Reuse the a11y structure, RESTYLE the cold tokens at the call site.**

**Reused Radix parts (a11y untouched)** — `type="single" collapsible` gives one-panel-at-a-time + keyboard nav free (D-16). Triggers are `<button>` (Radix), the test count hook:
```tsx
// Source: src/components/ui/accordion.tsx — Root (lines 17-26), Item (29-41), Trigger (44-65, a <button>),
//   Content (67-79). Radix Root accepts type="single" + collapsible.
"use client";
import { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
<AccordionRoot type="single" collapsible className={className}>          {/* D-16 */}
  {FAQ_ITEMS.map((item) => (
    <AccordionItem key={item.q} value={item.q} className="border-border bg-surface-elevated/50">
      <AccordionTrigger className="text-foreground hover:text-foreground/80">{item.q}</AccordionTrigger>
      <AccordionContent className="text-foreground-secondary">{item.a}</AccordionContent>
    </AccordionItem>
  ))}
</AccordionRoot>
```

**Adaptation vs analog:** 6 objection-busting items (D-15: accuracy, platforms, niche fit, data/privacy, free/price, speed). RESTYLE cold tokens via `className` overrides at the call site (RESEARCH option A — surgical, no shared-primitive risk). Do NOT re-implement the a11y.

> ⚠ **LANDMINE — accordion is COLD BRAND (RESEARCH Pitfall 3):** `ui/accordion.tsx` ships cold
> tokens that must be overridden (verified exact classNames):
> - `AccordionItem` line 36: `border-white/[0.06] bg-background-elevated/50` → `border-border bg-surface-elevated/50`
> - `AccordionTrigger` line 52: `text-white … hover:text-white/80` → `text-foreground … hover:text-foreground/80`
> - `AccordionContent` line 73: `text-gray-400` → `text-foreground-secondary`
> - Caret icon line 59: `text-white` → `text-foreground-muted`
>
> Note: prefer `bg-surface-elevated` (`--color-charcoal-chip`) over the cold `bg-background-elevated`
> (`--color-charcoal-sidebar`, the SIDEBAR shade) for visual consistency with the rest of the landing.
> `cn()` + tailwind-merge lets the call-site override win for conflicting utilities.

---

### `src/app/(marketing)/page.tsx` (route · RSC · MODIFY in place · D-18/D-19)

**Analog:** itself. The locked section rhythm is verbatim at lines 80-87; the stubs to fill are at 89-99 (`#pricing`) and 101-111 (`#faq`).

**Locked section rhythm to mirror for every inserted section:**
```tsx
// Source: src/app/(marketing)/page.tsx lines 80-87 (the LOCKED rhythm)
<section id="features" className="scroll-mt-20 border-t border-border px-6 py-16 md:py-20">
  <div className="mx-auto max-w-5xl">
    <FeatureBlocks />
  </div>
</section>
```

**The two stubs to FILL in place (replace the `<h2>…muted</h2>` body):**
```tsx
// Source: src/app/(marketing)/page.tsx lines 89-99 (#pricing stub) + 101-111 (#faq stub)
<section id="pricing" className="scroll-mt-20 border-t border-border px-6 py-16 md:py-20">
  <div className="mx-auto max-w-5xl">
    <h2 className="text-3xl font-semibold text-foreground-muted">Pricing</h2>   {/* ← replace with <PricingTeaser/> */}
  </div>
</section>
```

**Adaptation vs analog — the D-18 mount plan (final order):**
- After `#hero` (lines 46-48) → insert `<SocialProofStrip>` section (rides high under hero, D-01).
- After `#features` (line 87) → insert `<Testimonials>` section (conversion zone, D-05).
- Fill `#pricing` stub (lines 89-99) → `<PricingTeaser>` (replace the muted `<h2>`).
- Fill `#faq` stub (lines 101-111) → `<Faq>` (replace the muted `<h2>`).
- Before `<Footer/>` (line 113) → insert the `<FinalCtaBand>` (full-bleed band, D-12 — the band section has **NO `max-w-5xl`**, RESEARCH § Pattern 3):
```tsx
// RESEARCH § Pattern 3 — the band breaks the inner measure intentionally:
<section className="border-t border-border">   {/* no max-w on the section */}
  <FinalCtaBand />                              {/* owns its own full-bleed surface */}
</section>
```

> ⚠ **LANDMINE — static-build gate (RESEARCH Pitfall 5):** `page.tsx` is a pure RSC and `/` is
> statically prerendered (`○ /`). Every directly-mounted section root MUST be RSC. Only
> `faq-accordion.tsx` is `"use client"`, mounted as an island inside the RSC `faq.tsx`. Verify
> `npm run build` shows `○ /`.

---

### `src/components/marketing/index.ts` (config · barrel · MODIFY · append)

**Analog:** itself (current section exports lines 7-11).
```tsx
// Source: src/components/marketing/index.ts lines 7-11 (the analog — append the new sections)
export { Hero } from "./hero";
export { HowItWorks } from "./story/how-it-works";
export { SimulationShowcase } from "./story/simulation-showcase";
export { FeatureBlocks } from "./story/feature-blocks";
// ADD: SocialProofStrip, Testimonials, PricingTeaser, Faq, FinalCtaBand
```
**Adaptation:** Append `export { SocialProofStrip } from "./proof/social-proof-strip";` (+ `Testimonials`, `PricingTeaser`, `Faq`, `FinalCtaBand`) so `page.tsx` imports them from `@/components/marketing` (matches the page's existing barrel import, page.tsx lines 3-9).

---

### `04-00` Nyquist test files (test · RED scaffold · 5 files)

**Analog:** `story/__tests__/feature-blocks.test.tsx` (the Phase-3 `03-00` scaffold pattern). The 5 Phase-4 test files mirror it exactly.

**Test scaffold idioms (copy verbatim):**
```tsx
// Source: src/components/marketing/story/__tests__/feature-blocks.test.tsx lines 1-19
/** @vitest-environment happy-dom */                         // ← line 1 of EVERY test file
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeatureBlocks } from "../feature-blocks";            // RED until the component exists

describe("<FeatureBlocks /> — STORY-03", () => {
  it("renders 3 to 4 feature blocks", () => {
    const { container } = render(<FeatureBlocks />);
    const slots = container.querySelectorAll("[data-feature-visual]");  // count idiom
    expect(slots.length).toBeGreaterThanOrEqual(3);
  });
```

**Phase-4 assertion idioms (RESEARCH § Test Map, lines 505-522):**
```tsx
container.querySelectorAll('[data-variant="logo"]')        // count logo placeholders (PROOF-01)
container.querySelector('[data-variant="avatar"]')         // testimonial avatar present (PROOF-02)
screen.getByText(/2,?000\+? creators/i)                    // trust stat — tolerate copy tweaks
screen.getAllByRole("button")                              // accordion triggers are <button> (CONVERT-03)
screen.getAllByRole("link").some(a => a.getAttribute("href") === "/signup")  // CTA → SIGNUP_URL
```

**Adaptation vs analog:** Five RED-by-design files (module-not-found until components exist), one per section, asserting the RESEARCH § Test Map row for each req. Assert against **stable tokens / `data-variant` counts**, never full drafted sentences (copy is swappable). Optionally add a small page-order / `NAV_LINKS.length === 5` test (RESEARCH Open Q1 — check whether a `page.test.tsx`/`footer.test.tsx` exists to extend first).

---

## Shared Patterns

### Pure-RSC section + named StaggerReveal leaf (applies to ALL new sections except the FAQ accordion)
**Source:** `marketing/story/feature-blocks.tsx` line 3 + lines 90-101.
```tsx
import { StaggerReveal, StaggerRevealItem } from "@/components/motion";   // named, NOT .Item
export function Section({ className }: { className?: string }) { return <div className={cn(className)}>…</div>; }
```
No `"use client"` at a section root; the only client leaf is the motion entrance (self-gates reduced-motion via `MotionConfigShell`). This keeps `/` statically prerendered (the standing build gate).

### CTA → link (applies to pricing cards + final band)
**Source:** `ui/button.tsx` lines 53-56 + 157/174.
```tsx
<Button asChild variant="primary"><Link href={SIGNUP_URL}>Try it free</Link></Button>
```
`SIGNUP_URL = "/signup"` (`src/lib/routes.ts` line 10). `asChild` requires exactly one element child. Coral (`variant="primary"`) is reserved for CTAs only.

### Flat-warm card surface (applies to testimonial + pricing cards)
**Source:** `ui/testimonial-card.tsx` lines 99-108 — KEEP only `bg-transparent border border-border` + the subtle white-5% inset boxShadow; DROP the `featured` oklch glow.
```tsx
className="… border bg-transparent … border-border"
style={{ boxShadow: "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset" }}
```

### Token discipline (applies to every Phase-4 file)
Reference semantic tokens only: `--color-foreground` (cream), `--color-foreground-secondary`, `--color-foreground-muted`, `--color-surface-elevated`, `--color-border`, `--color-accent` (coral, CTA-only), `--radius-lg`. Never `text-white`, never hardcoded hex, never glow/blur/glass. The Newsreader serif is voice-only — Phase 4's single serif moment is the final CTA band close-line (D-13).

---

## No Analog Found

None. Every Phase-4 file maps to a verified in-repo template. The two "rebuild" cards
(testimonial + pricing) have a **structural** analog (`feature-blocks`/`feature-block` RSC card
idiom + flat-warm surface) and a **MODEL-only anti-analog** (`ui/testimonial-card.tsx`,
`pricing-section.tsx`) whose styling/machinery must NOT be copied — RESEARCH § Pitfall 2.

---

## Metadata

**Analog search scope:** `src/components/marketing/**`, `src/components/ui/**`, `src/components/motion/**`, `src/app/(marketing)/**`, `src/lib/{nav,routes,utils}.ts`, `src/lib/whop/config.ts`.
**Files scanned:** 18 source files (all reuse/anti-analog claims VERIFIED in-repo this session — line numbers cited inline).
**Pattern extraction date:** 2026-06-15
**Project skills:** none (`.claude/skills/` and `.agents/skills/` absent).
