# Phase 57: Responsive & Accessibility - Research

**Researched:** 2026-02-06
**Domain:** Loading skeletons, responsive CSS grid, keyboard accessibility, ARIA patterns, Radix Tabs a11y, Recharts 3.x a11y
**Confidence:** HIGH

## Summary

Phase 57 is the final polish phase for the v2.3 Brand Deals milestone. It adds three capabilities: (1) skeleton loading states for each tab that match the layout shape of actual content, (2) responsive layout verification and fixes for mobile viewports, and (3) keyboard accessibility across all tab content.

The codebase already has a well-built `Skeleton` component (`src/components/ui/skeleton.tsx`) with shimmer animation, `@keyframes shimmer` in `globals.css`, and `motion-reduce:animate-none` support. The existing `AppShellSkeleton` in `auth-guard.tsx` demonstrates the established pattern of composing `<Skeleton>` elements with specific height/width/radius classes to match real content shapes. No new dependencies are required.

Radix Tabs (`@radix-ui/react-tabs` ^1.1.13) already provides full WAI-ARIA Tabs pattern compliance with arrow key navigation, Home/End support, and automatic activation. The brand-deals page uses Radix Tabs correctly via `Tabs.Root`, `Tabs.List`, `Tabs.Trigger`, and `Tabs.Content`. Recharts 3.7.0 has `accessibilityLayer` enabled by default, giving the AreaChart keyboard navigation and ARIA roles. The main keyboard a11y work is ensuring interactive cards have proper focus styling and that the period selector and filter bar are keyboard-navigable.

**Primary recommendation:** Create three skeleton components (`DealsTabSkeleton`, `AffiliatesTabSkeleton`, `EarningsTabSkeleton`) composed from the existing `Skeleton` primitive. Fix responsive gaps (earnings breakdown table on mobile, header stats wrapping). Add `focus-visible` ring to all interactive cards (DealCard, AffiliateLinkCard, AvailableProductCard) and ensure the EarningsPeriodSelector has proper ARIA attributes. Zero new dependencies.

## Standard Stack

### Core (Already Installed -- NO new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `Skeleton` (design system) | N/A | Shimmer loading placeholders | Already exists at `src/components/ui/skeleton.tsx`, exported from `ui/index.ts` |
| `@radix-ui/react-tabs` | ^1.1.13 | Tab a11y (arrow keys, ARIA roles) | Already provides full WAI-ARIA Tabs pattern |
| `recharts` | ^3.7.0 | Chart keyboard a11y (`accessibilityLayer` on by default in 3.x) | Already installed, a11y is automatic |
| Tailwind CSS | v4 | Responsive breakpoints (`sm:`, `md:`, `lg:`) + `focus-visible:` | Codebase standard |
| `motion/react` | ^12.29.2 | `motion-reduce:animate-none` for reduced motion | Already used throughout |

### No New Dependencies Required

Everything is available from existing installations:
- Skeleton component: `src/components/ui/skeleton.tsx`
- Shimmer keyframe: `src/app/globals.css` line 263
- Responsive breakpoints: Tailwind v4 defaults (sm:640px, md:768px, lg:1024px)
- Focus ring utility: Tailwind `focus-visible:ring-2 focus-visible:ring-accent`
- Reduced motion: Tailwind `motion-reduce:animate-none`

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Composing `<Skeleton>` elements | Content-aware skeleton library (e.g., `react-loading-skeleton`) | Adds dependency for something achievable with existing primitive + className composition |
| Manual responsive testing | Playwright viewport tests | Good for CI but overkill for a UI-only milestone with visual verification |

**Installation:** None required.

## Architecture Patterns

### Recommended Component Structure

```
src/components/app/brand-deals/
  deals-tab-skeleton.tsx          # NEW - skeleton matching DealsTab layout
  affiliates-tab-skeleton.tsx     # NEW - skeleton matching AffiliatesTab layout
  earnings-tab-skeleton.tsx       # NEW - skeleton matching EarningsTab layout
  deals-tab.tsx                   # EDIT - add focus-visible to DealCard grid
  deal-card.tsx                   # EDIT - add focus-visible, keyboard Enter handler
  affiliate-link-card.tsx         # EDIT - add focus-visible
  available-product-card.tsx      # EDIT - add focus-visible, keyboard Enter handler
  earnings-period-selector.tsx    # EDIT - add role="radiogroup" + aria-label
  earnings-breakdown-list.tsx     # EDIT - responsive table for mobile
  brand-deals-header.tsx          # EDIT - responsive stat wrapping on mobile
  brand-deals-page.tsx            # EDIT - integrate skeleton loading states
```

### Pattern 1: Shape-Matching Skeleton Composition

**What:** Build skeleton layouts by composing `<Skeleton>` elements sized to match actual content dimensions.
**When to use:** Loading states for every tab.
**Why:** The existing `AppShellSkeleton` in `auth-guard.tsx` demonstrates this exact pattern.

```typescript
// Source: Existing pattern in src/components/app/auth-guard.tsx
// Example: DealsTabSkeleton matching the real deals grid
import { Skeleton } from "@/components/ui/skeleton";

export function DealsTabSkeleton(): React.JSX.Element {
  return (
    <div>
      {/* New This Week row skeleton */}
      <div className="mb-6">
        <Skeleton className="mb-3 h-6 w-40" />
        <div className="flex gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px] w-[300px] shrink-0 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-[42px] w-[320px] rounded-md" />
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
      </div>

      {/* Deal grid skeleton -- responsive like real grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[200px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
```

### Pattern 2: Loading State Integration via Simulated Delay

**What:** Use a `useState` + `useEffect` with a short delay to simulate loading, showing skeletons on tab mount.
**When to use:** Each tab's first render.
**Why:** Since this is UI-only with mock data, a simulated delay demonstrates the skeleton pattern. In production, this would be replaced with real data-fetching `isLoading` state.

```typescript
// Pattern: Simulated loading for skeleton demonstration
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const timer = setTimeout(() => setIsLoading(false), 800);
  return () => clearTimeout(timer);
}, []);

if (isLoading) return <DealsTabSkeleton />;
```

### Pattern 3: Keyboard-Accessible Interactive Cards

**What:** Add `tabIndex={0}`, `role="article"`, `focus-visible:ring-2`, and `onKeyDown` Enter handler to interactive cards.
**When to use:** All cards that have CTAs (DealCard, AvailableProductCard).
**Why:** Cards are currently `<div>` elements -- they need explicit keyboard focus and activation.

```typescript
// Pattern: Making a card keyboard-accessible
<div
  tabIndex={0}
  role="article"
  className={cn(
    "rounded-xl border border-border bg-surface-elevated p-5",
    "transition-all duration-200",
    "hover:border-border-hover hover:-translate-y-px hover:shadow-md",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  )}
  onKeyDown={(e) => {
    if (e.key === "Enter" && !isApplied && !isExpired) {
      onApply(deal);
    }
  }}
>
```

### Pattern 4: ARIA Radiogroup for Period Selector

**What:** The `EarningsPeriodSelector` acts as a radiogroup (mutually exclusive selection) but currently uses plain `<button>` elements without ARIA semantics.
**When to use:** EarningsPeriodSelector component.

```typescript
// Pattern: Period selector with proper radiogroup semantics
<div
  role="radiogroup"
  aria-label="Earnings period"
  className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-elevated/50 p-1"
>
  {PERIODS.map((period) => {
    const isActive = activePeriod === period.value;
    return (
      <button
        key={period.value}
        type="button"
        role="radio"
        aria-checked={isActive}
        onClick={() => onPeriodChange(period.value)}
        className="relative rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* ... */}
      </button>
    );
  })}
</div>
```

### Anti-Patterns to Avoid

- **Skeleton that doesn't match content shape:** A single tall rectangle for a grid of cards looks wrong. Each skeleton must mirror the actual component's dimensions and layout grid.
- **Using `onClick` for keyboard without `onKeyDown`:** Adding `tabIndex={0}` to a `<div>` without a keydown handler means Enter/Space won't trigger the action.
- **Hiding content from screen readers:** Loading skeletons should have `aria-hidden="true"` and a sibling `aria-live="polite"` region, or use `aria-busy="true"` on the container.
- **Fixed-width elements on mobile:** The `NewThisWeekRow` uses `min-w-[300px]` which is fine for scroll, but the breakdown table's 4-column grid (`grid-cols-4`) will cramp on mobile.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab keyboard navigation | Custom arrow key handlers | Radix Tabs (`@radix-ui/react-tabs`) | Already provides full WAI-ARIA Tabs pattern with arrow, Home, End keys |
| Chart accessibility | Custom ARIA on SVG elements | Recharts 3.x `accessibilityLayer` (on by default) | Adds `role="application"`, `tabIndex={0}`, arrow key navigation automatically |
| Focus ring styling | Custom CSS outlines | Tailwind `focus-visible:ring-2 focus-visible:ring-accent` | Consistent with design system Button, TabsTrigger, Input patterns |
| Shimmer animation | CSS animation from scratch | Existing `Skeleton` component + `@keyframes shimmer` | Already built, tested, and includes `motion-reduce:animate-none` |
| Reduced motion detection | Custom `matchMedia` hook | Existing `usePrefersReducedMotion` hook | Already at `src/hooks/usePrefersReducedMotion.ts` |

**Key insight:** The codebase already has all the accessibility building blocks (Radix, Skeleton, focus-visible patterns, reduced-motion hooks). This phase is about composition and verification, not building new primitives.

## Common Pitfalls

### Pitfall 1: Skeleton Layout Shift

**What goes wrong:** Skeleton renders at a different total height than the real content, causing a visible layout jump when content loads.
**Why it happens:** Skeleton heights are guessed rather than measured from actual components.
**How to avoid:** Match skeleton dimensions to real component measurements. Use the same Tailwind grid classes (`grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`) in skeletons as in real content.
**Warning signs:** Scrollbar jumping when content replaces skeleton.

### Pitfall 2: Earnings Breakdown Table on Mobile

**What goes wrong:** The `EarningsBreakdownList` uses a fixed `grid-cols-4` layout. On mobile (< 640px), the Source column (with avatar + name) and three numeric columns compress to unreadable widths.
**Why it happens:** No responsive breakpoint was added for this table-like grid.
**How to avoid:** On mobile, hide Clicks and Conversions columns (show only Source + Earnings), or switch to a stacked card layout. Alternatively, use `overflow-x-auto` for horizontal scroll.
**Warning signs:** Text truncation on mobile, columns narrower than their content.

### Pitfall 3: Header Stats Cramped on Small Screens

**What goes wrong:** The `BrandDealsHeader` stat dividers (`border-l`) create a row of 3 stats with `px-5` padding each. On narrow screens, these overflow.
**Why it happens:** The stats container doesn't wrap or stack on mobile.
**How to avoid:** Make stats wrap or stack vertically below `sm` breakpoint. The header already uses `flex-col` on mobile for the title/stats split, but the inner stats row needs similar treatment.
**Warning signs:** Horizontal overflow on screens < 400px.

### Pitfall 4: GlassPill Filter Missing Focus-Visible

**What goes wrong:** The `GlassPill` component (used for category filters in `DealFilterBar`) renders as a `<button>` when `onClick` is provided, but lacks `focus-visible:ring` styling.
**Why it happens:** GlassPill has interactive states (hover, active) but no focus ring was added.
**How to avoid:** Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent` to the GlassPill's interactive class list.
**Warning signs:** No visible focus indicator when tabbing through filter pills.

### Pitfall 5: Skeleton Shimmer During Reduced Motion

**What goes wrong:** The `Skeleton` component already has `motion-reduce:animate-none` in its Tailwind classes, but the actual shimmer is applied via inline `style={{ animation: "shimmer 2s..." }}`. The Tailwind class only sets `animation: none` -- this correctly overrides the inline style because `motion-reduce:animate-none` compiles to `animation: none !important` in Tailwind v4's `@media (prefers-reduced-motion: reduce)` layer.
**Why it happens:** Not actually a pitfall -- this is already handled correctly.
**How to avoid:** No action needed. Verified: Tailwind v4's `motion-reduce:animate-none` does override inline styles.
**Warning signs:** None -- already working.

### Pitfall 6: Tab Content Not Announcing to Screen Readers

**What goes wrong:** When switching tabs, screen reader users don't know content has changed.
**Why it happens:** Missing `aria-live` region or the tab panel doesn't receive focus.
**How to avoid:** Radix `Tabs.Content` already handles this -- it has `role="tabpanel"` and `aria-labelledby` linking to the trigger. No manual work needed. However, the `AnimatePresence` wrapper in `brand-deals-page.tsx` should preserve the Radix ARIA attributes during transitions.
**Warning signs:** Tab content silent to screen readers after tab switch.

## Code Examples

### Skeleton for Earnings Tab

```typescript
// Source: Matches real EarningsTab layout (stat cards 2x2 + chart + breakdown)
import { Skeleton } from "@/components/ui/skeleton";

export function EarningsTabSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6" aria-hidden="true">
      {/* Stat cards 2x2 grid */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface-elevated p-5">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="mt-1 h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-48 rounded-full" />
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>

      {/* Breakdown list */}
      <div>
        <Skeleton className="mb-3 h-4 w-36" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    </div>
  );
}
```

### Skeleton for Affiliates Tab

```typescript
// Source: Matches real AffiliatesTab layout (two sections: active links + available products)
import { Skeleton } from "@/components/ui/skeleton";

export function AffiliatesTabSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-8" aria-hidden="true">
      {/* Active Links section */}
      <div>
        <div className="mb-4 flex items-center gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px] rounded-xl" />
          ))}
        </div>
      </div>

      {/* Available Products section */}
      <div>
        <Skeleton className="mb-4 h-5 w-36" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Responsive Earnings Breakdown (Mobile Fix)

```typescript
// Current: grid-cols-4 (too cramped on mobile)
// Fix: Hide middle columns on mobile, show on sm+
<div className="grid grid-cols-2 gap-4 px-4 py-2 sm:grid-cols-4">
  <span>Source</span>
  <span className="hidden text-right sm:block">Clicks</span>
  <span className="hidden text-right sm:block">Conversions</span>
  <span className="text-right">Earnings</span>
</div>
```

### Adding Focus-Visible to DealCard

```typescript
// Add to existing DealCard className + onKeyDown
<div
  tabIndex={0}
  role="article"
  aria-label={`${deal.brandName} deal: ${payout}`}
  onKeyDown={(e) => {
    if (e.key === "Enter" && !isApplied && !isExpired) {
      onApply(deal);
    }
  }}
  className={cn(
    "relative rounded-xl border border-border bg-surface-elevated p-5",
    "transition-all duration-200",
    "hover:border-border-hover hover:-translate-y-px hover:shadow-md",
    // NEW: focus-visible ring
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    deal.isNew && "border-t-2 border-t-orange-400",
    isApplied && "opacity-60",
  )}
>
```

## Existing Responsive Analysis

Current responsive state of all brand-deals components:

| Component | Current Responsive Classes | Mobile Issue? |
|-----------|---------------------------|---------------|
| `brand-deals-header.tsx` | `flex-col sm:flex-row` on outer, none on stats inner div | YES - stats row overflows on narrow screens |
| `deals-tab.tsx` grid | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | No - already responsive |
| `new-this-week-row.tsx` | `flex overflow-x-auto` with `min-w-[300px]` cards | No - horizontal scroll is intentional |
| `deal-filter-bar.tsx` | `flex-wrap` on pills, `max-w-sm` on search | No - already responsive |
| `affiliates-tab.tsx` active links | `grid-cols-1 sm:grid-cols-2` | No - already responsive |
| `affiliates-tab.tsx` products | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | No - already responsive |
| `earnings-stat-cards.tsx` | `grid-cols-2` (fixed, no responsive) | PARTIAL - 2x2 grid works on mobile, but stat card text may cramp below 360px |
| `earnings-chart.tsx` | `ResponsiveContainer width="100%" height={300}` | No - Recharts handles this |
| `earnings-breakdown-list.tsx` | `grid-cols-4` (fixed, no responsive) | YES - 4 columns cramp on mobile |
| `earnings-period-selector.tsx` | `inline-flex` (no responsive) | No - small enough to fit |
| `brand-deals-page.tsx` | `mx-auto max-w-5xl p-6` | PARTIAL - p-6 (24px) may be too much on small screens, consider p-4 on mobile |

## Existing Keyboard A11y Analysis

Current keyboard accessibility state:

| Component | Keyboard Support | Gap? |
|-----------|------------------|------|
| `BrandDealsTabs` (Radix Tabs.Trigger) | Arrow keys, Home/End, Tab (via Radix) | No - full WAI-ARIA Tabs |
| `DealFilterBar` search input | Focusable natively | No |
| `DealFilterBar` GlassPill filters | Renders as `<button>` when onClick provided | YES - no focus-visible ring |
| `DealCard` | Not focusable (div, no tabIndex) | YES - needs tabIndex + onKeyDown |
| `DealApplyModal` (Radix Dialog) | Full focus trap, Escape to close (via Radix) | No |
| `AffiliateLinkCard` | Not focusable (div) | PARTIAL - copy button is focusable, but card itself isn't |
| `AffiliateLinkCard` copy button | Focusable natively, has aria-label | No |
| `AvailableProductCard` | Not focusable (div), but "Generate Link" Button is | PARTIAL - button is accessible, card itself isn't |
| `EarningsPeriodSelector` buttons | Focusable natively, has focus-visible ring | YES - missing role="radiogroup", aria-checked |
| `EarningsChart` (Recharts 3.x) | accessibilityLayer on by default: tabIndex, arrow keys | No - handled by Recharts 3.x |
| `EarningsBreakdownList` | Static display, no interactive elements | No - read-only table |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pulse animation skeleton | Shimmer gradient skeleton | 2024+ | More polished loading feel; already implemented in this codebase |
| Custom tab key handlers | Radix Tabs WAI-ARIA pattern | Radix 1.x | Zero custom a11y code for tabs; this project already uses it |
| Recharts manual ARIA | accessibilityLayer default-on | Recharts 3.0 (2024) | Arrow key chart navigation + ARIA roles for free |
| `outline: none` everywhere | `focus-visible:` (`:focus-visible` CSS) | Browser support universal since 2023 | Focus rings only on keyboard, not mouse clicks |

## Open Questions

1. **Skeleton loading trigger mechanism**
   - What we know: Mock data is synchronous (imported directly), so there's no real loading state
   - What's unclear: Should skeletons be shown via a simulated delay, or should we add a loading prop to tabs for future backend integration?
   - Recommendation: Use a simulated `useState(true)` + `useEffect(setTimeout)` pattern with ~800ms delay. This demonstrates the skeleton and is easily replaced with real `isLoading` from data fetching later. Alternatively, could use a `Suspense` boundary with a lazy-loaded component, but that's more complex than needed for mock data.

2. **Card keyboard activation scope**
   - What we know: DealCard has an "Apply" button, AvailableProductCard has "Generate Link" button. Both buttons are already keyboard-accessible.
   - What's unclear: Should pressing Enter on the card itself trigger the primary CTA, or should users Tab into the button?
   - Recommendation: Add `tabIndex={0}` and `onKeyDown` Enter to trigger primary CTA on the card. This provides a faster keyboard flow (users don't need to tab into nested buttons). The button remains separately focusable for fine-grained control.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `src/components/ui/skeleton.tsx`, `src/components/app/auth-guard.tsx` (skeleton pattern)
- Existing codebase analysis: All 19 brand-deals components reviewed for responsive classes and a11y attributes
- Radix UI Tabs documentation (https://www.radix-ui.com/primitives/docs/components/tabs) - keyboard navigation, ARIA
- Context7 /recharts/recharts - `accessibilityLayer` default-on in 3.x, `ResponsiveContainer` docs
- Context7 /websites/radix-ui - focus management, ARIA patterns

### Secondary (MEDIUM confidence)
- WAI-ARIA Tabs pattern (https://www.w3.org/WAI/ARIA/apg/patterns/tabs) - referenced by Radix docs
- Tailwind v4 responsive breakpoints verified in globals.css (lines 182-186)
- Recharts 3.x keyboard accessibility docs via Context7 storybook source

### Tertiary (LOW confidence)
- None. All findings verified against codebase and official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies, all verified in package.json and existing source
- Architecture: HIGH - skeleton composition pattern already established in auth-guard.tsx
- Pitfalls: HIGH - all identified from direct codebase analysis of actual component source
- Responsive gaps: HIGH - all grid classes catalogued from actual source files
- Keyboard a11y gaps: HIGH - all interactive elements audited against ARIA patterns

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- no fast-moving dependencies)
