---
phase: 04-proof-conversion
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/components/marketing/proof/social-proof-strip.tsx
  - src/components/marketing/proof/testimonial-card.tsx
  - src/components/marketing/proof/testimonials.tsx
  - src/components/marketing/pricing/pricing-card.tsx
  - src/components/marketing/pricing/pricing-teaser.tsx
  - src/components/marketing/faq/faq-accordion.tsx
  - src/components/marketing/faq/faq.tsx
  - src/components/marketing/cta/final-cta-band.tsx
  - src/components/marketing/index.ts
  - src/app/(marketing)/page.tsx
findings:
  critical: 3
  warning: 2
  info: 3
  total: 8
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 4 adds 7 new marketing components (social proof strip, 3 proof components, 2 pricing components, FAQ pair, CTA band) and wires them into `page.tsx`. Architecture is sound: RSC/client split is correct, no forbidden imports (Whop/Supabase/CheckoutModal), no hardcoded secrets, token discipline mostly followed. Three issues require fixes before ship: one design-token bleed that will visually break the flat-warm theme on the FAQ (cold `text-white` on the Radix accordion icon that cannot be overridden via `className`), a doubled top border on the CTA band causing a 2px hairline artifact, and misleading conversion microcopy on the Pro pricing card.

---

## Critical Issues

### CR-01: AccordionTrigger `CaretDown` icon renders cold `text-white` — not overridable via className

**File:** `src/components/ui/accordion.tsx:59`
**Issue:** `AccordionTrigger` renders a `<CaretDown>` icon with a hardcoded `className="h-5 w-5 shrink-0 text-white ..."`. This class is applied **directly** to the icon element; it is not inherited and is therefore not overridable by passing `className` to `AccordionTrigger`. `FaqAccordion` passes `className="text-foreground hover:text-foreground/80"` (line 76 of `faq-accordion.tsx`), which correctly overrides `text-white` on the trigger button itself — but the icon remains cold white on every flat-warm surface. The `[&[data-state=open]>svg]:rotate-180` selector still works (state change rotate is fine), but the icon color violates the THEME-06 flat-warm contract across all states (closed + open).

**Fix:** In `src/components/ui/accordion.tsx`, add a `currentColor` fallback on the icon so it inherits the trigger's text color, then override with the caller's className:
```tsx
// accordion.tsx line 58-61 — change:
<CaretDown
  className="h-5 w-5 shrink-0 text-current transition-transform duration-200"
  weight="bold"
/>
```
`text-current` makes the icon inherit the trigger button's computed text color. Since `FaqAccordion` sets `text-foreground` on the trigger, the icon will pick up `text-foreground` automatically with no call-site change needed.

---

### CR-02: Double top border on `FinalCtaBand` — 2px hairline artifact

**File:** `src/app/(marketing)/page.tsx:142` and `src/components/marketing/cta/final-cta-band.tsx:41`
**Issue:** `page.tsx` wraps `FinalCtaBand` in `<section className="border-t border-border">`. `FinalCtaBand`'s root `<div>` independently declares `border-y border-border` (which includes a `border-top`). Since the section has no padding, the section's `border-t` and the div's `border-t` are on adjacent boxes with zero gap, producing a 2px effective top border (not a CSS table-cell collapse — separate block boxes stack). The bottom border from `border-y` is the intended one; the section's `border-t` is redundant and harmful.

**Fix (two options — pick one):**

Option A — Remove `border-t` from the `page.tsx` section wrapper (preferred, keeps `FinalCtaBand` self-contained):
```tsx
// page.tsx line 142
<section data-section="final-cta">
  <FinalCtaBand />
</section>
```

Option B — Remove `border-y` from `FinalCtaBand` and let the caller own both borders:
```tsx
// final-cta-band.tsx line 41 — change border-y to border-b only
"relative w-full border-b border-border bg-surface-elevated",
```

---

### CR-03: Static microcopy "Free to start — no credit card" renders on the Pro ($19/mo) card

**File:** `src/components/marketing/pricing/pricing-card.tsx:105-107`
**Issue:** `PricingCard` always renders the hardcoded `<p>Free to start — no credit card</p>` below the CTA, regardless of tier. For the Pro tier ($19/mo after trial), this is factually incorrect: after the 7-day free trial, a credit card is required. This is a conversion integrity issue — a visitor who clicks "Try it free" on Pro and encounters a card-required signup will feel deceived. The Pro tier already carries a `trialBadge="7-day free trial"` badge that correctly signals the trial; the global microcopy contradicts the post-trial reality.

**Fix:** Accept an optional `microcopy` prop on `PricingCard` and pass tier-appropriate text from `TIERS` in `pricing-teaser.tsx`:
```tsx
// pricing-card.tsx — add prop:
microcopy?: string;

// pricing-card.tsx line 105-107 — change:
{microcopy && (
  <p className="text-center text-xs text-foreground-muted">{microcopy}</p>
)}

// pricing-teaser.tsx TIERS — add microcopy field:
// Starter:
microcopy: "Free to start — no credit card",
// Pro:
microcopy: "7-day free trial — cancel anytime",
```

---

## Warnings

### WR-01: `FaqAccordion` uses full question string as Radix `value` — fragile identity

**File:** `src/components/marketing/faq/faq-accordion.tsx:70-72`
**Issue:** `value={item.q}` passes the entire question string as the Radix `AccordionItem` value (also used as the React `key`). Any copy edit that changes a question (e.g., rewording for A/B) silently resets accordion state because the stable identity is gone. If two questions were ever identical (possible when the array is expanded), Radix breaks silently — only the first match opens. The `FAQ_ITEMS` array is `as const` so the risk is contained for now, but the pattern is fragile.

**Fix:** Add an `id` field to `FaqItem` and use it as both `key` and `value`:
```tsx
interface FaqItem { id: string; q: string; a: string; }

const FAQ_ITEMS = [
  { id: "faq-how-it-works", q: "How does it actually know...", a: "..." },
  { id: "faq-platforms", q: "Does it work for platforms...", a: "..." },
  // ...
] as const;

// In the map:
<AccordionItem key={item.id} value={item.id} ...>
```

---

### WR-02: `data-section="final-cta"` duplicated on nested elements

**File:** `src/app/(marketing)/page.tsx:142` and `src/components/marketing/cta/final-cta-band.tsx:39`
**Issue:** Both the `<section>` wrapper in `page.tsx` (line 142) and the root `<div>` in `FinalCtaBand` (line 39) carry `data-section="final-cta"`. Selectors or analytics that query `[data-section="final-cta"]` will return two elements and potentially double-fire events or produce duplicate results in DOM queries.

**Fix:** Remove `data-section="final-cta"` from `FinalCtaBand`'s root `<div>`. The section in `page.tsx` is the correct owner of this attribute (it is the structural anchor):
```tsx
// final-cta-band.tsx line 37-41 — remove the data-section attribute:
<div
  className={cn(
    "relative w-full border-y border-border bg-surface-elevated",
    ...
  )}
>
```

---

## Info

### IN-01: `PricingCard` uses `bullet` text as React `key` — fragile with duplicate bullets

**File:** `src/components/marketing/pricing/pricing-card.tsx:88`
**Issue:** `bullets.map((bullet) => <li key={bullet} ...>)` uses the bullet string as the key. Duplicate bullet text within a tier (unlikely but possible as tiers grow) produces a React key collision and suppresses the second item. Current data has no duplicates, but the pattern is brittle.

**Fix:** Use the array index as the key (acceptable for a static ordered list that never reorders):
```tsx
{bullets.map((bullet, i) => (
  <li key={i} ...>{bullet}</li>
))}
```

---

### IN-02: `ScoreGaugeSkeleton` decorative element is unnecessarily exposed to screen readers in CTA band

**File:** `src/components/marketing/cta/final-cta-band.tsx:66`
**Issue:** `ScoreGaugeSkeleton` carries `role="img" aria-label="Virality score (sample)"` (defined in the component itself). In the CTA band it serves as pure decoration — tying visual continuity back to the instrument — but it will be announced to screen reader users ("Virality score (sample) image") before the close-line heading, adding noise without value. The component is not wrapped in `aria-hidden` at the call site.

**Fix:** Wrap the skeleton in `aria-hidden` at the call site to suppress the announcement:
```tsx
// final-cta-band.tsx line 66
<div aria-hidden="true">
  <ScoreGaugeSkeleton className="opacity-70 scale-75" />
</div>
```

---

### IN-03: `AccordionContent` primitive leaks cold token `text-gray-400` on its outer wrapper

**File:** `src/components/ui/accordion.tsx:73`
**Issue:** The `AccordionContent` wrapper element has `className="overflow-hidden text-gray-400 ..."` hardcoded. `FaqAccordion` passes `className="text-foreground-secondary"` which lands on the **inner** `<div>` (line 76), so the actual text content correctly inherits `text-foreground-secondary` (child wins). However, the outer element's `text-gray-400` is a cold token that will affect any element placed directly on `AccordionPrimitive.Content` outside the inner wrapper — a future misuse trap. The token also makes the intent of the override non-obvious to maintainers.

**Fix:** In `accordion.tsx`, move the default text color to the inner wrapper so className overrides it cleanly:
```tsx
// accordion.tsx line 73-76 — change:
<AccordionPrimitive.Content
  ref={ref}
  className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
  {...props}
>
  <div className={cn("px-4 pb-4 pt-0 text-gray-400", className)}>{children}</div>
```
Now `className="text-foreground-secondary"` on `AccordionContent` will override `text-gray-400` via `twMerge` on the same element.

---

_Reviewed: 2026-06-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
