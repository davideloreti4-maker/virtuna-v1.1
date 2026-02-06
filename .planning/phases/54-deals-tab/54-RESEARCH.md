# Phase 54: Deals Tab - Research

**Researched:** 2026-02-06
**Domain:** React card grid UI, filtering/search, modal forms, color semantics
**Confidence:** HIGH

## Summary

Phase 54 builds a filterable, searchable brand deal card grid inside the existing `BrandDealsPage` tab shell (Phase 53). The codebase already provides all foundational components needed: `Badge` (5 semantic variants), `Button` (4 variants with loading state), `Avatar` (5 sizes with Radix fallback), `Card`/`GlassCard` (solid and glass variants), `Input`/`InputField` (with error states), and `Dialog` (full Radix Dialog with overlay, sizes, animations). The `GlassPill` primitive exists for colored tags. Mock data (10 deals) is ready in `MOCK_DEALS` with Clearbit CDN logos.

The main implementation work is: (1) a `DealsTab` container with filter/search state, (2) `DealCard` components using `bg-surface-elevated` backgrounds, (3) a "New This Week" horizontal scroll row, (4) an "Apply" modal using the design system Dialog, and (5) color semantics mapping (orange/green/blue). No new dependencies are required -- debounce can be implemented with a simple `useRef`+`setTimeout` hook, and all UI primitives exist.

**Primary recommendation:** Compose existing design system components (`Card`, `Badge`, `Button`, `Avatar`, `Dialog`, `Input`, `GlassPill`) into new `DealCard` and `DealsTab` components. Use `bg-surface-elevated` for card backgrounds (not `GlassCard`). Implement debounced search with a custom `useDebounce` hook (no library needed). Use the existing Radix Dialog wrapper for the Apply modal with controlled open state.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-dialog` | ^1.1.15 | Apply modal | Already used, design system wraps it |
| `@radix-ui/react-tabs` | ^1.1.13 | Tab shell integration | Phase 53 already uses this |
| `motion` (framer-motion) | ^12.29.2 | Tab transitions, card hover | Already in use for tab animations |
| `@phosphor-icons/react` | ^2.1.10 | Icons (search, filter, etc.) | Codebase standard icon library |
| `class-variance-authority` | ^0.7.1 | Component variants | Used throughout design system |
| `zod` | ^4.3.6 | Modal form validation | Already installed (Phase 46 reference) |

### Supporting (Already Available)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `tailwind-merge` + `clsx` via `cn()` | Class merging | All component className composition |
| Clearbit Logo CDN | Brand logos | `https://logo.clearbit.com/{domain}` -- already in mock data |

### No New Dependencies Needed

The codebase has everything required. Specifically:
- **Debounce:** Use a custom `useDebounce` hook with `useRef`+`setTimeout` (3 lines of code, no library needed)
- **Form validation:** Zod v4 is already installed
- **Icons:** Phosphor Icons covers search (MagnifyingGlass), filter, checkmark (Check), etc.
- **Horizontal scroll:** CSS `overflow-x-auto` + `flex-nowrap` (pattern exists in `CategoryTabs`)

**Installation:** None required.

## Architecture Patterns

### Recommended Component Structure

```
src/components/app/brand-deals/
  brand-deals-page.tsx      # Existing -- add DealsTab import
  brand-deals-tabs.tsx      # Existing -- no changes
  brand-deals-header.tsx    # Existing -- no changes
  deals-tab.tsx             # NEW -- container: filter state, search state, grid
  deal-card.tsx             # NEW -- individual deal card
  deal-apply-modal.tsx      # NEW -- apply modal with form
  new-this-week-row.tsx     # NEW -- horizontal scroll featured section
  deal-filter-bar.tsx       # NEW -- filter pills + search input bar
  index.ts                  # Existing -- add new exports
```

### Pattern 1: Container/Presentational Split

**What:** `DealsTab` owns all state (filters, search, applied set); child components are pure presentational.
**When to use:** Any tab with filtering, search, and interactive state.

```typescript
// deals-tab.tsx -- Container component
"use client";

import { useState, useMemo } from "react";
import { MOCK_DEALS } from "@/lib/mock-brand-deals";
import type { BrandDeal, BrandDealCategory } from "@/types/brand-deals";

export function DealsTab() {
  const [activeCategory, setActiveCategory] = useState<BrandDealCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [appliedDeals, setAppliedDeals] = useState<Set<string>>(new Set());

  const filteredDeals = useMemo(() => {
    return MOCK_DEALS.filter((deal) => {
      const matchesCategory = activeCategory === "all" || deal.category === activeCategory;
      const matchesSearch = deal.brandName.toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, debouncedSearch]);

  const newDeals = MOCK_DEALS.filter((d) => d.isNew);
  // ... render NewThisWeekRow, DealFilterBar, grid of DealCards
}
```

### Pattern 2: Debounced Search with useRef

**What:** Custom hook for debouncing search input without external dependency.
**When to use:** Any search input that filters a list.

```typescript
// Inline in deals-tab.tsx or extracted to hooks/
import { useRef, useCallback } from "react";

function useDebouncedCallback(callback: (value: string) => void, delay: number) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  return useCallback((value: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(value), delay);
  }, [callback, delay]);
}
```

### Pattern 3: Controlled Dialog for Apply Modal

**What:** Modal opens via button click, form submits, shows success, then closes.
**When to use:** Any action that needs confirmation/input before completing.
**Source:** Radix UI Dialog docs (Context7 verified)

```typescript
// deal-apply-modal.tsx
"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";

interface DealApplyModalProps {
  deal: BrandDeal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: (dealId: string) => void;
}

export function DealApplyModal({ deal, open, onOpenChange, onApplied }: DealApplyModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 800)); // Simulate API
    setIsSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      onApplied(deal.id);
      setSubmitted(false);
      onOpenChange(false);
    }, 1500);
  };
  // ... render Dialog with form fields
}
```

### Pattern 4: Color Semantics Mapping

**What:** Map deal categories and data types to consistent colors per Brand Bible.
**When to use:** Every place that renders category tags, payout values, or analytics.

```typescript
// Color semantic constants
const CATEGORY_COLORS: Record<BrandDealCategory, string> = {
  // Orange family -- creative categories
  fashion: "text-orange-300",
  beauty: "text-orange-300",
  food: "text-orange-300",
  // Blue family -- analytics/tech categories
  tech: "text-blue-300",
  gaming: "text-blue-300",
  // Green family -- earnings (used on payout values, not categories)
  fitness: "text-green-300",
  travel: "text-cyan-300",
  finance: "text-blue-300",
};

// Green for earnings/payout values
const PAYOUT_COLOR = "text-green-400";
```

### Pattern 5: Solid Card Background (Performance)

**What:** Use `bg-surface-elevated` instead of `GlassCard` for grid items.
**When to use:** Any scrollable grid of cards (10+ items).

```typescript
// DealCard -- solid surface, no backdrop-filter
<div className="rounded-xl border border-border bg-surface-elevated p-4 transition-all hover:border-border-hover hover:-translate-y-px">
  {/* card content */}
</div>
```

### Anti-Patterns to Avoid

- **backdrop-filter on grid items:** Lightning CSS strips backdrop-filter from compiled classes. Even inline styles would cause jank with 10+ cards during scroll. Use solid `bg-surface-elevated` for all regular deal cards.
- **Next.js `<Image>` for Clearbit logos:** `next.config.ts` has no `images.remotePatterns` for `logo.clearbit.com`. Use the `Avatar` component (which uses `<img>` via Radix) instead of `next/image`.
- **State in DealCard:** Don't put filter/search/applied state inside individual cards. Lift all state to `DealsTab` container and pass props down.
- **Re-rendering entire grid on keystroke:** Use `useMemo` for filtered results and debounce the search to prevent expensive re-renders on every character.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialog | Custom overlay + portal | `Dialog` from `@/components/ui/dialog` | Focus trap, scroll lock, animations, a11y all handled by Radix |
| Avatar with fallback | Custom `<img>` + error handler | `Avatar` from `@/components/ui/avatar` | Radix handles loading lifecycle, fallback initials |
| Badge variants | Custom span with color logic | `Badge` from `@/components/ui/badge` | 5 semantic variants already mapped to design tokens |
| Pill tags | Custom colored chips | `GlassPill` from `@/components/primitives` | Color config, interactive states, size variants built in |
| Button loading state | Custom disabled + spinner | `Button` from `@/components/ui/button` | Loading prop handles spinner + disabled + aria-busy |
| Form input fields | Custom input + label + error | `InputField` from `@/components/ui/input` | Label, helper text, error message, a11y all wired up |
| Class merging | Manual string concat | `cn()` from `@/lib/utils` | Handles Tailwind conflicts via tailwind-merge |

**Key insight:** The design system has every primitive needed. The entire Phase 54 is composition -- no new UI primitives need to be created.

## Common Pitfalls

### Pitfall 1: Category Type Mismatch Between Requirements and Mock Data

**What goes wrong:** Requirements list filter categories as "All, Beauty, Tech, Lifestyle, Food, Fitness" but the `BrandDealCategory` type defines: `tech | fashion | gaming | fitness | beauty | food | travel | finance`. "Lifestyle" doesn't exist as a type. Several mock data categories (gaming, travel, finance, fashion) aren't in the requirements filter list.
**Why it happens:** Requirements were written at a different time than the type definitions.
**How to avoid:** Filter pills should derive from actual `BrandDealCategory` values in mock data, not the requirements list. Use the type union as source of truth: show "All" + one pill per category that has at least one deal in mock data.
**Warning signs:** Filter pills that don't match any deals, or deals that can't be reached by any filter.

### Pitfall 2: Clearbit Logo Failures

**What goes wrong:** `https://logo.clearbit.com/example.com` (edge case deal-010) may return a generic/broken image.
**Why it happens:** Not all domains have Clearbit logos. The mock data intentionally includes `example.com` as an edge case.
**How to avoid:** Use the `Avatar` component with a `fallback` prop (brand initials). Radix Avatar shows fallback when image fails to load -- no manual error handling needed.
**Warning signs:** Broken image icons in the grid.

### Pitfall 3: Horizontal Scroll Row Without Snap Points

**What goes wrong:** "New This Week" row scrolls freely without snapping to card boundaries, feels sloppy on touch devices.
**Why it happens:** Missing `scroll-snap-type` and `scroll-snap-align`.
**How to avoid:** Add CSS scroll snap: `scroll-snap-type: x mandatory` on container, `scroll-snap-align: start` on each card.
**Warning signs:** Cards stopping mid-way after swipe on mobile.

### Pitfall 4: Applied State Lost on Tab Switch

**What goes wrong:** User applies to a deal, switches to another tab, comes back -- all applied states are gone.
**Why it happens:** `DealsTab` component unmounts when tab changes (AnimatePresence + forceMount pattern in brand-deals-page.tsx only mounts active tab).
**How to avoid:** Lift `appliedDeals` state to `BrandDealsPage` or use a simple Zustand store. The `forceMount` pattern only keeps the active tab in DOM -- switching tabs unmounts previous tab content.
**Warning signs:** Applied badges disappearing after tab navigation.

### Pitfall 5: Line Clamp Not Working in Tailwind v4

**What goes wrong:** `line-clamp-3` utility doesn't truncate text.
**Why it happens:** Confusion between Tailwind v3 plugin and v4 built-in.
**How to avoid:** In Tailwind v4, `line-clamp-*` is a built-in utility class. It works directly: `<p className="line-clamp-3">`. No plugin needed. Verified in existing codebase: `line-clamp-1`, `line-clamp-2`, `line-clamp-3` are already used in extension-card.tsx and society-selector.tsx.
**Warning signs:** Long descriptions overflowing card boundaries.

### Pitfall 6: Zero/Missing Payout Display

**What goes wrong:** Deal-010 has `commission: 0, fixedFee: 0, payoutRange: "Revenue share TBD"`. Displaying "$0" looks broken.
**Why it happens:** Edge case in mock data -- not all deals have defined payouts.
**How to avoid:** Format payout display logic: if `payoutRange` exists, show it as-is. If only `commission > 0`, show "X% commission". If `fixedFee > 0`, show "$X + Y%". If all zero, show the `payoutRange` string (which is "Revenue share TBD").
**Warning signs:** "$0" or empty payout area on cards.

## Code Examples

### Deal Card with Solid Background and Color Semantics

```typescript
// Source: Composition of existing design system components
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BrandDeal } from "@/types/brand-deals";

interface DealCardProps {
  deal: BrandDeal;
  isApplied: boolean;
  onApply: (deal: BrandDeal) => void;
}

export function DealCard({ deal, isApplied, onApply }: DealCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-surface-elevated p-5",
        "transition-all duration-200 hover:border-border-hover hover:-translate-y-px hover:shadow-md",
        isApplied && "opacity-60"
      )}
    >
      {/* Payout -- top right, green */}
      <div className="absolute right-5 top-5">
        <span className="text-lg font-bold text-green-400">
          {formatPayout(deal)}
        </span>
      </div>

      {/* Brand logo + name */}
      <div className="flex items-center gap-2 mb-3">
        <Avatar
          src={deal.brandLogo}
          fallback={deal.brandName.slice(0, 2).toUpperCase()}
          size="xs"
        />
        <span className="text-sm font-medium text-foreground-secondary truncate">
          {deal.brandName}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-foreground-secondary line-clamp-3 mb-4">
        {deal.description}
      </p>

      {/* Category tag + status badge */}
      <div className="flex items-center justify-between">
        <Badge variant={getCategoryVariant(deal.category)}>
          {deal.category}
        </Badge>
        {isApplied ? (
          <Badge variant="success">Applied</Badge>
        ) : (
          <Button size="sm" variant="primary" onClick={() => onApply(deal)}>
            Apply
          </Button>
        )}
      </div>
    </div>
  );
}
```

### Responsive Grid Layout

```typescript
// Source: Tailwind CSS v4 docs (Context7 verified)
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {filteredDeals.map((deal) => (
    <DealCard key={deal.id} deal={deal} /* ... */ />
  ))}
</div>
```

### Horizontal Scroll Row for "New This Week"

```typescript
// Source: Existing CategoryTabs pattern in codebase
<section className="mb-6">
  <div className="flex items-center gap-2 mb-3">
    <h2 className="text-lg font-semibold text-foreground">New This Week</h2>
    <Badge variant="info" size="sm">{newDeals.length}</Badge>
  </div>
  <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
    {newDeals.map((deal) => (
      <div key={deal.id} className="min-w-[280px] snap-start flex-shrink-0">
        <DealCard deal={deal} /* ... */ />
      </div>
    ))}
  </div>
</section>
```

### Payout Formatting Utility

```typescript
// Source: Decision DEC-53-01-02 -- format at render time
function formatPayout(deal: BrandDeal): string {
  if (deal.payoutRange) return deal.payoutRange;
  if (deal.fixedFee && deal.fixedFee > 0 && deal.commission > 0) {
    return `$${deal.fixedFee} + ${deal.commission}%`;
  }
  if (deal.fixedFee && deal.fixedFee > 0) {
    return `$${deal.fixedFee}`;
  }
  if (deal.commission > 0) {
    return `${deal.commission}% commission`;
  }
  return "TBD";
}
```

### Status Badge Variant Mapping

```typescript
// Source: Badge component variants (5 semantic variants)
function getStatusBadgeVariant(status: BrandDeal["status"]): "success" | "warning" | "error" | "info" | "default" {
  switch (status) {
    case "active": return "success";
    case "pending": return "warning";
    case "expired": return "error";
    case "applied": return "info";
    default: return "default";
  }
}
```

### Empty State Pattern

```typescript
// Source: Design system composition
function DealsEmptyState({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-border-subtle p-8">
      <MagnifyingGlass className="h-10 w-10 text-foreground-muted mb-4" />
      <p className="text-lg font-medium text-foreground mb-1">No deals found</p>
      <p className="text-sm text-foreground-muted mb-4">
        Try adjusting your filters or search query
      </p>
      <Button variant="secondary" size="sm" onClick={onClearFilters}>
        Clear filters
      </Button>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS `line-clamp` plugin (Tailwind v3) | Built-in `line-clamp-*` utility (Tailwind v4) | Tailwind v4 | No plugin needed, use directly |
| `useDebounce` from lodash/usehooks-ts | Simple `useRef` + `setTimeout` hook | React 18+ | No dependency needed for basic debounce |
| `next/image` for all images | Radix Avatar for small logos | Project decision | Avoids `remotePatterns` config; Radix handles fallback |
| Glass cards for everything | Solid `bg-surface-elevated` for grids | Phase 54 decision | Performance -- no backdrop-filter in scroll containers |

## Open Questions

1. **Filter pill categories: derive from type or hardcode subset?**
   - What we know: `BrandDealCategory` has 8 values; requirements mention 6 categories (different set). Mock data uses 7 of 8 categories.
   - What's unclear: Whether to show all 8 categories or only the 6 from requirements.
   - Recommendation: Show "All" + all categories present in mock data (7 pills). This is Claude's discretion per CONTEXT.md. More accurate than requirements list, which has "Lifestyle" (doesn't exist in types).

2. **Applied state persistence across tab switches**
   - What we know: The `forceMount` pattern only keeps the current tab mounted. Tab switches unmount inactive tabs.
   - What's unclear: Whether lifting state to parent or using Zustand is preferred.
   - Recommendation: Lift `appliedDeals` state to `BrandDealsPage` and pass as props. Simpler than adding a store for Phase 54; store can be added later if needed across pages.

3. **scrollbar-hide utility in Tailwind v4**
   - What we know: Tailwind v4 doesn't include `scrollbar-hide` by default.
   - What's unclear: Whether a custom utility or plugin is needed.
   - Recommendation: Use CSS `scrollbar-width: none` + `::-webkit-scrollbar { display: none }` as inline style or small utility class in globals.css if not already present.

## Sources

### Primary (HIGH confidence)

- **Radix UI Dialog Primitives** (Context7 `/websites/radix-ui-primitives`) -- Controlled dialog open/close, async form submission pattern
- **Tailwind CSS v4** (Context7 `/websites/tailwindcss`) -- Responsive grid columns, line-clamp, breakpoint variants
- **Codebase audit** -- Read all Phase 53 files, design system components (Badge, Button, Avatar, Card, GlassCard, Dialog, Input, GlassPill, GradientGlow, FilterPill, ExtensionCard), globals.css tokens, package.json, next.config.ts

### Secondary (MEDIUM confidence)

- **Line-clamp usage verified** in existing codebase: `extension-card.tsx` uses `line-clamp-2`, `society-selector.tsx` uses `line-clamp-3`
- **Horizontal scroll pattern verified** in `category-tabs.tsx` with `overflow-x-auto`
- **Modal pattern verified** in `leave-feedback-modal.tsx` (form with success state + auto-close)

### Tertiary (LOW confidence)

- None -- all findings verified through codebase inspection and Context7

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All dependencies already installed, no new packages needed
- Architecture: HIGH -- Pattern derived from existing codebase conventions (container/presentational split, design system composition)
- Pitfalls: HIGH -- Identified from codebase analysis (type mismatch, Clearbit edge cases, state persistence, Tailwind v4 specifics)

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- no fast-moving dependencies)
