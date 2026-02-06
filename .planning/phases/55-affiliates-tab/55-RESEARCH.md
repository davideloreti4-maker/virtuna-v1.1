# Phase 55: Affiliates Tab - Research

**Researched:** 2026-02-06
**Domain:** React affiliate link cards with stats, clipboard interaction, product grid with "Generate Link" CTA, state management for dynamic list updates
**Confidence:** HIGH

## Summary

Phase 55 builds the `AffiliatesTab` component inside the existing `BrandDealsPage` tab shell (Phase 53). The codebase provides all foundational pieces: `useCopyToClipboard` hook (built in Phase 53), `Badge` (5 semantic variants), `Button` (4 variants with loading state), `Avatar` (5 sizes with Radix fallback), the `Copy` and `Check` icons from Phosphor (already used in `copy-button.tsx`), `useToast` for success feedback, and the container/presentational pattern established in `DealsTab`. Mock data is already defined: `MOCK_AFFILIATE_LINKS` (5 items with edge cases) and `MOCK_PRODUCTS` (8 items) in `mock-brand-deals.ts`, with corresponding `AffiliateLink` and `Product` TypeScript interfaces in `brand-deals.ts`.

The main implementation work is: (1) an `AffiliatesTab` container managing active links state and generate-link interactions, (2) `AffiliateLinkCard` components with mini KPI stat blocks and copy-to-clipboard with icon morph, (3) `AvailableProductCard` components with hero commission rate and "Generate Link" CTA, (4) an empty state for when no active links exist, and (5) wiring the tab into `brand-deals-page.tsx` replacing the placeholder div. The "Generate Link" action adds a product to the active links list with toast feedback. No new dependencies are required.

**Primary recommendation:** Compose existing design system components (`Badge`, `Button`, `Avatar`, `useCopyToClipboard`, `useToast`) into new `AffiliateLinkCard`, `AvailableProductCard`, and `AffiliatesTab` components. Use `bg-surface-elevated` for card backgrounds (matching Phase 54 pattern). Manage active links as local React state initialized from `MOCK_AFFILIATE_LINKS`, with "Generate Link" creating a new `AffiliateLink` entry from the `Product` data. Use the `Copy` -> `Check` icon morph pattern from `copy-button.tsx` combined with `useCopyToClipboard` hook.

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@phosphor-icons/react` | ^2.1.10 | Icons (Copy, Check, LinkSimple, etc.) | Codebase standard; Copy/Check already used in copy-button.tsx |
| `motion` (motion/react) | ^12.29.2 | Tab transitions (inherited from shell) | Already in use for tab animations in BrandDealsPage |
| `@radix-ui/react-avatar` | ^1.1.11 | Product thumbnails with fallback | Already used in DealCard for brand logos |
| `class-variance-authority` | ^0.7.1 | Component variants | Used throughout design system |

### Supporting (Already Available)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `tailwind-merge` + `clsx` via `cn()` | Class merging | All component className composition |
| Clearbit Logo CDN | Brand logos on product/link cards | `https://logo.clearbit.com/{domain}` -- already in mock data |
| `useToast` hook | Success toast for "Generate Link" | `toast({ variant: "success", title: "..." })` |
| `useCopyToClipboard` hook | Clipboard copy with 2s reset | Already built in Phase 53 at `src/hooks/useCopyToClipboard.ts` |

### No New Dependencies Needed

The codebase has everything required. Specifically:
- **Clipboard:** `useCopyToClipboard` hook already exists with 2s reset delay
- **Icons:** Phosphor Icons has `Copy` and `Check` (used in `copy-button.tsx` line 4)
- **Toast:** `useToast` and `ToastProvider` exist in `src/components/ui/toast.tsx`
- **Badge:** 5 semantic variants (success, warning, error, info, default) for status badges
- **Avatar:** 5 sizes with Radix fallback for product thumbnails

**Installation:** None required.

## Architecture Patterns

### Recommended Component Structure

```
src/components/app/brand-deals/
  affiliates-tab.tsx              # NEW -- container: active links state, generate link handler
  affiliate-link-card.tsx         # NEW -- individual active link card with stats + copy
  available-product-card.tsx      # NEW -- product card with commission rate + generate CTA
  affiliates-empty-state.tsx      # NEW -- empty state for no active links
  brand-deals-page.tsx            # MODIFY -- replace affiliates placeholder, wire AffiliatesTab
  index.ts                        # MODIFY -- add AffiliatesTab export
```

### Pattern 1: Container/Presentational Split (Matches DealsTab)

**What:** `AffiliatesTab` owns all state (active links list, available products list); child components are pure presentational.
**When to use:** Any tab with interactive state that modifies data collections.

```typescript
// affiliates-tab.tsx -- Container component
"use client";

import { useState, useMemo } from "react";
import { MOCK_AFFILIATE_LINKS, MOCK_PRODUCTS } from "@/lib/mock-brand-deals";
import { useToast } from "@/components/ui/toast";
import type { AffiliateLink, Product } from "@/types/brand-deals";

export function AffiliatesTab() {
  const { toast } = useToast();
  const [activeLinks, setActiveLinks] = useState<AffiliateLink[]>(MOCK_AFFILIATE_LINKS);

  // Products not yet linked (filter out products that already have active links)
  const availableProducts = useMemo(() => {
    const linkedProductNames = new Set(activeLinks.map((l) => l.productName));
    return MOCK_PRODUCTS.filter((p) => !linkedProductNames.has(p.name));
  }, [activeLinks]);

  function handleGenerateLink(product: Product): void {
    const newLink: AffiliateLink = {
      id: `link-gen-${Date.now()}`,
      dealId: "",
      productName: product.name,
      productImage: product.brandLogo,
      url: `https://${product.brandName.toLowerCase().replace(/\s/g, "")}.com/ref/vtna-${Date.now()}`,
      shortCode: `vtna-${Date.now().toString(36)}`,
      clicks: 0,
      conversions: 0,
      earnings: 0,
      commissionRate: product.commissionRate,
      status: "active",
      createdAt: new Date().toISOString().split("T")[0],
    };
    setActiveLinks((prev) => [newLink, ...prev]); // Add at top
    toast({ variant: "success", title: `Affiliate link created for ${product.name}` });
  }

  return (
    <div>
      {/* Active Links section */}
      {/* Available Products section */}
    </div>
  );
}
```

### Pattern 2: Copy-to-Clipboard with Icon Morph

**What:** Use `useCopyToClipboard` hook combined with Phosphor `Copy` and `Check` icons for inline visual feedback.
**When to use:** Any copy button that needs visual confirmation without toast.
**Source:** Existing `copy-button.tsx` pattern + `useCopyToClipboard` hook

```typescript
// Inside AffiliateLinkCard
import { Copy, Check } from "@phosphor-icons/react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

function CopyLinkButton({ url }: { url: string }) {
  const { copied, copy } = useCopyToClipboard(2000); // 2s reset

  return (
    <button
      type="button"
      onClick={() => copy(url)}
      className="text-foreground-muted transition-colors hover:text-foreground"
      aria-label={copied ? "Link copied" : "Copy affiliate link"}
    >
      {copied ? (
        <Check size={16} className="text-green-400" />
      ) : (
        <Copy size={16} />
      )}
    </button>
  );
}
```

**Critical detail:** Per CONTEXT.md decision, copy button uses icon morph only -- no toast needed since inline feedback (Copy -> Check for 2s) is sufficient. The `useCopyToClipboard` hook handles the 2s timeout reset via simple `setTimeout` (DEC-53-01-03).

### Pattern 3: Mini KPI Stat Blocks

**What:** Three small labeled stat blocks inside each affiliate link card showing clicks, conversions, and commission earned.
**When to use:** When stats are the hero element of a card.

```typescript
// Inside AffiliateLinkCard
function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-white/[0.03] px-3 py-2">
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted">
        {label}
      </span>
    </div>
  );
}

// Usage in card:
<div className="grid grid-cols-3 gap-2">
  <StatBlock label="Clicks" value={formatNumber(link.clicks)} />
  <StatBlock label="Conversions" value={formatNumber(link.conversions)} />
  <StatBlock label="Earned" value={formatCurrency(link.earnings)} />
</div>
```

### Pattern 4: Commission Rate as Hero Number

**What:** Large percentage displayed prominently on available product cards as the main visual anchor.
**When to use:** When a single number is the primary decision-making metric.

```typescript
// Inside AvailableProductCard
<div className="text-2xl font-bold text-green-400">
  {product.commissionRate}%
</div>
<span className="text-[10px] uppercase tracking-wider text-foreground-muted">
  Commission
</span>
```

### Pattern 5: Solid Card Background (Performance -- from Phase 54)

**What:** Use `bg-surface-elevated` instead of `GlassCard` for grid items.
**When to use:** Any scrollable grid of cards (consistent with Phase 54).

```typescript
// AffiliateLinkCard -- solid surface, no backdrop-filter
<div className={cn(
  "rounded-xl border border-border bg-surface-elevated p-5",
  "transition-all duration-200 hover:border-border-hover hover:-translate-y-px hover:shadow-md"
)}>
  {/* card content */}
</div>
```

### Anti-Patterns to Avoid

- **Using per-card `useCopyToClipboard` without scoping:** Each `AffiliateLinkCard` must have its own `useCopyToClipboard` instance. Don't share a single hook across all cards -- clicking Copy on one card would affect all cards.
- **Mutating MOCK_AFFILIATE_LINKS directly:** Use `useState` initialized from the mock array. Generate Link should update local state, not mutate the imported constant.
- **Using `useToast` without ToastProvider:** The app layout (`src/app/(app)/layout.tsx`) does NOT currently wrap children in `<ToastProvider>`. Either add it to the layout or wrap the AffiliatesTab content in a provider. The toast demo only uses it in showcase pages with a local provider.
- **backdrop-filter on grid items:** Follow Phase 54 decision -- use solid `bg-surface-elevated` for all cards.
- **Next.js `<Image>` for Clearbit logos:** Same as Phase 54 -- use `Avatar` component (which uses `<img>` via Radix) instead of `next/image` since `remotePatterns` isn't configured for clearbit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clipboard copy with timeout | Inline `navigator.clipboard` + `setTimeout` | `useCopyToClipboard` hook | Already built, handles errors, manages copied state with reset |
| Copy -> Check icon morph | Custom animation | Conditional render `{copied ? <Check /> : <Copy />}` | Simple ternary, same pattern as copy-button.tsx |
| Success notification | Custom notification system | `useToast` from `@/components/ui/toast` | Full toast system exists: variants, auto-dismiss, progress, pause-on-hover |
| Avatar with fallback | Custom `<img>` + error handler | `Avatar` from `@/components/ui/avatar` | Radix handles loading lifecycle, fallback initials |
| Status badges | Custom colored spans | `Badge` from `@/components/ui/badge` | 5 semantic variants already mapped |
| Button loading state | Custom disabled + spinner | `Button` from `@/components/ui/button` | Loading prop handles spinner + disabled + aria-busy |
| Class merging | Manual string concat | `cn()` from `@/lib/utils` | Handles Tailwind conflicts via tailwind-merge |
| Number formatting | Manual string manipulation | `Intl.NumberFormat` | Locale-aware, handles thousands separators correctly |
| Currency formatting | `"$" + value.toFixed(2)` | `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })` | Handles edge cases, locale, symbol placement |

**Key insight:** The design system and hooks have every primitive needed. Phase 55 is pure composition -- no new primitives need to be created. The only new UI patterns are the stat block layout within cards and the "Generate Link" interaction flow.

## Common Pitfalls

### Pitfall 1: ToastProvider Not in App Layout

**What goes wrong:** Calling `useToast()` throws "useToast must be used within a <ToastProvider>" because the app layout doesn't wrap children in `<ToastProvider>`.
**Why it happens:** The app layout at `src/app/(app)/layout.tsx` only wraps children in `<AppShell>`. `ToastProvider` is only used in showcase demo pages with local providers.
**How to avoid:** Either (a) add `<ToastProvider>` to the `(app)/layout.tsx` around `{children}` inside `<AppShell>`, or (b) wrap `AffiliatesTab` content in a local `<ToastProvider>`. Option (a) is better -- it makes toasts available across all app pages for future phases too.
**Warning signs:** Runtime crash when clicking "Generate Link" with error about ToastProvider context.

### Pitfall 2: Shared Copy State Across Cards

**What goes wrong:** Clicking Copy on one affiliate link card shows the Check icon on ALL cards.
**Why it happens:** Using a single `useCopyToClipboard` instance for the entire list instead of one per card.
**How to avoid:** Each `AffiliateLinkCard` component calls `useCopyToClipboard()` internally. The hook returns independent `copied` state per instance. Don't lift `copied` state to the parent.
**Warning signs:** All copy buttons switching to Check icon simultaneously.

### Pitfall 3: Generated Links Not Appearing at Top

**What goes wrong:** Newly generated affiliate links appear at the bottom of the list, invisible below the fold.
**Why it happens:** Using `[...prev, newLink]` instead of `[newLink, ...prev]` in the state updater.
**How to avoid:** Prepend new links: `setActiveLinks((prev) => [newLink, ...prev])`. This ensures newly generated links appear at the top of the "Active Links" section for immediate visibility.
**Warning signs:** User clicks "Generate Link" but doesn't see any change because the new card is off-screen.

### Pitfall 4: Available Products Not Filtering After Generation

**What goes wrong:** After generating a link for a product, the product still appears in the "Available Products" section, allowing duplicate link generation.
**Why it happens:** Not filtering available products based on active links state.
**How to avoid:** Use `useMemo` to derive available products by excluding products whose names already appear in the active links list. The filtering should react to `activeLinks` state changes.
**Warning signs:** Same product showing in both sections, or clicking "Generate Link" creating duplicate entries.

### Pitfall 5: Currency Formatting Inconsistency

**What goes wrong:** Earnings show "$2725" or "$2725.00" inconsistently across cards and the header stats.
**Why it happens:** Using different formatting approaches in different places.
**How to avoid:** Create utility functions in a shared location (suggest adding to `deal-utils.ts` or a new `affiliate-utils.ts`):
```typescript
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}
```
**Warning signs:** "$2725" in one place, "$2,725.00" in another.

### Pitfall 6: URL Truncation Breaking Copy

**What goes wrong:** The displayed URL is truncated (e.g., "https://open.spotify.com/ref/vt...") but the copy button copies the truncated text instead of the full URL.
**Why it happens:** Using CSS `truncate` on a span and passing the span's `textContent` to the clipboard instead of the data prop.
**How to avoid:** Always pass `link.url` (the full URL from data) to the `copy()` function, not the rendered/truncated text. The truncation is purely visual (CSS `truncate` class).
**Warning signs:** Pasting a copied link shows "..." at the end.

### Pitfall 7: Edge Case -- Zero Stats Display

**What goes wrong:** Active link `link-004` (Coinbase Signup) has 0 clicks, 0 conversions, 0 earnings. Displaying "0" or "$0" looks broken.
**Why it happens:** Mock data intentionally includes this edge case for a newly created link.
**How to avoid:** Zero is a valid display value -- format it consistently using the same utility functions. `formatNumber(0)` -> "0", `formatCurrency(0)` -> "$0". These are intentional values that show the link is new/unused. Don't show "N/A" or "---" for zeros.
**Warning signs:** Cards looking broken or empty when all stats are zero.

## Code Examples

### Affiliate Link Card with Stats and Copy

```typescript
// Source: Composition of existing design system components + useCopyToClipboard hook
import { Copy, Check } from "@phosphor-icons/react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import type { AffiliateLink } from "@/types/brand-deals";
import { cn } from "@/lib/utils";

interface AffiliateLinkCardProps {
  link: AffiliateLink;
}

export function AffiliateLinkCard({ link }: AffiliateLinkCardProps) {
  const { copied, copy } = useCopyToClipboard(2000);

  return (
    <div className={cn(
      "rounded-xl border border-border bg-surface-elevated p-5",
      "transition-all duration-200 hover:border-border-hover hover:-translate-y-px hover:shadow-md"
    )}>
      {/* Top row: product info + status badge */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar
            src={link.productImage}
            alt={link.productName}
            fallback={link.productName.slice(0, 2).toUpperCase()}
            size="xs"
          />
          <span className="text-sm font-medium text-foreground truncate max-w-[180px]">
            {link.productName}
          </span>
        </div>
        <Badge
          variant={link.status === "active" ? "success" : link.status === "paused" ? "warning" : "error"}
          size="sm"
        >
          {link.status.charAt(0).toUpperCase() + link.status.slice(1)}
        </Badge>
      </div>

      {/* URL + copy button row */}
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
        <span className="flex-1 truncate text-xs text-foreground-muted font-mono">
          {link.url}
        </span>
        <button
          type="button"
          onClick={() => copy(link.url)}
          className="shrink-0 text-foreground-muted transition-colors hover:text-foreground"
          aria-label={copied ? "Link copied" : "Copy affiliate link"}
        >
          {copied ? (
            <Check size={16} className="text-green-400" weight="bold" />
          ) : (
            <Copy size={16} />
          )}
        </button>
      </div>

      {/* Mini KPI stat blocks */}
      <div className="grid grid-cols-3 gap-2">
        <StatBlock label="Clicks" value={formatNumber(link.clicks)} />
        <StatBlock label="Conversions" value={formatNumber(link.conversions)} />
        <StatBlock label="Earned" value={formatCurrency(link.earnings)} />
      </div>
    </div>
  );
}
```

### Available Product Card with Hero Commission

```typescript
// Source: Composition of existing design system components
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types/brand-deals";

interface AvailableProductCardProps {
  product: Product;
  onGenerateLink: (product: Product) => void;
}

export function AvailableProductCard({ product, onGenerateLink }: AvailableProductCardProps) {
  return (
    <div className={cn(
      "rounded-xl border border-border bg-surface-elevated p-5",
      "transition-all duration-200 hover:border-border-hover hover:-translate-y-px hover:shadow-md"
    )}>
      {/* Brand logo + name */}
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar
          src={product.brandLogo}
          alt={`${product.brandName} logo`}
          fallback={product.brandName.slice(0, 2).toUpperCase()}
          size="xs"
        />
        <span className="text-sm font-medium text-foreground-secondary">
          {product.brandName}
        </span>
      </div>

      {/* Product name */}
      <h3 className="mb-2 text-sm font-semibold text-foreground">
        {product.name}
      </h3>

      {/* Hero commission rate */}
      <div className="mb-4 text-center">
        <div className="text-2xl font-bold text-green-400">
          {product.commissionRate}%
        </div>
        <span className="text-[10px] uppercase tracking-wider text-foreground-muted">
          Commission
        </span>
      </div>

      {/* Generate Link CTA */}
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        onClick={() => onGenerateLink(product)}
      >
        Generate Link
      </Button>
    </div>
  );
}
```

### Status Badge Variant Mapping for Affiliate Links

```typescript
// AffiliateLink status differs from BrandDeal status
// AffiliateLink: "active" | "paused" | "expired"
function getAffiliateBadgeVariant(status: AffiliateLink["status"]): "success" | "warning" | "error" {
  const variantMap: Record<AffiliateLink["status"], "success" | "warning" | "error"> = {
    active: "success",
    paused: "warning",
    expired: "error",
  };
  return variantMap[status];
}
```

### Number/Currency Formatting Utilities

```typescript
// Source: Intl.NumberFormat standard API
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}
```

### Empty State for Active Links

```typescript
// Source: DealsEmptyState pattern from Phase 54
import { LinkSimple } from "@phosphor-icons/react";

function AffiliatesEmptyState() {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-border-subtle p-8">
      <LinkSimple
        className="text-foreground-muted"
        size={40}
        weight="thin"
        aria-hidden="true"
      />
      <div className="text-center">
        <h3 className="text-lg font-medium text-foreground">
          No active affiliate links
        </h3>
        <p className="mt-1 text-sm text-foreground-muted">
          Generate your first link from the products below
        </p>
      </div>
    </div>
  );
}
```

### Responsive Grid (Matching Phase 54)

```typescript
// Source: DealsTab responsive grid pattern
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {availableProducts.map((product) => (
    <AvailableProductCard
      key={product.id}
      product={product}
      onGenerateLink={handleGenerateLink}
    />
  ))}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline clipboard code per component | `useCopyToClipboard` reusable hook | Phase 53 (this project) | Centralized, tested, consistent |
| Custom notification banners | `useToast` with ToastProvider | Phase 46 (this project) | 5 variants, auto-dismiss, accessible |
| `"$" + val.toFixed(2)` | `Intl.NumberFormat` with currency style | ES2015+ standard | Locale-aware, handles edge cases |
| Glass cards for everything | Solid `bg-surface-elevated` for grids | Phase 54 decision | Performance -- no backdrop-filter in scroll containers |
| `framer-motion` import path | `motion/react` | Already migrated | Use `import { motion } from "motion/react"` |

## Open Questions

1. **ToastProvider placement**
   - What we know: The app layout (`src/app/(app)/layout.tsx`) does NOT currently include `<ToastProvider>`. It only wraps children in `<AppShell>`. Toast is only used in showcase demo pages with local providers.
   - What's unclear: Whether to add ToastProvider to the app layout (global) or wrap it locally in AffiliatesTab.
   - Recommendation: Add `<ToastProvider>` to the app layout. This is a one-line change and makes toast available for Phase 56 (Earnings) and beyond. The alternative (local provider per tab) creates redundancy and risks stale context.

2. **Product state after link generation: remove vs badge**
   - What we know: CONTEXT.md marks this as "Claude's Discretion". After generating a link for a product, the product should no longer be available for duplicate generation.
   - What's unclear: Whether to remove the product from the Available Products list entirely, or show it with a "Generated" badge.
   - Recommendation: Filter it out entirely (remove from the Available Products grid). This is cleaner -- the product now appears in the Active Links section instead. No visual clutter. The `useMemo` filter pattern handles this reactively.

3. **Section ordering**
   - What we know: CONTEXT.md marks this as "Claude's Discretion".
   - What's unclear: Whether Active Links or Available Products should come first.
   - Recommendation: Active Links first (your links, your stats) then Available Products below. Active Links is the "manage" section; Available Products is the "discover" section. Users will check existing link performance more often than generating new links.

## Sources

### Primary (HIGH confidence)

- **Codebase audit** -- Read all Phase 53 and 54 files: `brand-deals-page.tsx`, `deals-tab.tsx`, `deal-card.tsx`, `deal-apply-modal.tsx`, `new-this-week-row.tsx`, `deals-empty-state.tsx`, `deal-filter-bar.tsx`, `brand-deals-header.tsx`, `brand-deals-tabs.tsx`, `deal-utils.ts`, `mock-brand-deals.ts`, `brand-deals.ts` (types), `useCopyToClipboard.ts`, `use-debounce.ts`, `copy-button.tsx`, `avatar.tsx`, `badge.tsx`, `button.tsx`, `toast.tsx`, `(app)/layout.tsx`, `index.ts`, `package.json`
- **Mock data shapes** -- `MOCK_AFFILIATE_LINKS` (5 items including edge cases: zero stats, paused status) and `MOCK_PRODUCTS` (8 items with commission rates 8-35%) verified in `src/lib/mock-brand-deals.ts`
- **TypeScript interfaces** -- `AffiliateLink` and `Product` types verified in `src/types/brand-deals.ts` with all required fields for card rendering

### Secondary (MEDIUM confidence)

- **Copy icon morph pattern** verified in `src/app/(marketing)/showcase/_components/copy-button.tsx` -- `{copied ? <Check size={14} /> : <Copy size={14} />}` with Phosphor icons
- **useToast API** verified in `src/components/ui/toast.tsx` -- `toast({ variant: "success", title: "..." })` with context provider pattern
- **Container/presentational pattern** verified via `DealsTab` (state container) + `DealCard` (presentational) architecture

### Tertiary (LOW confidence)

- None -- all findings verified through direct codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All dependencies already installed, no new packages needed
- Architecture: HIGH -- Pattern directly mirrors Phase 54 DealsTab (container/presentational, lifted state, design system composition)
- Pitfalls: HIGH -- Identified from codebase analysis (ToastProvider missing from layout, per-card hook scoping, URL truncation vs copy, mock data edge cases)

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (stable -- no fast-moving dependencies)
