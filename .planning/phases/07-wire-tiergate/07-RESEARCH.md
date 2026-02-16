# Phase 7: Wire TierGate - Research

**Researched:** 2026-02-16
**Domain:** Feature tier gating / subscription-based access control
**Confidence:** HIGH

## Summary

Phase 7 is a pure wiring phase. All infrastructure is already built: `TierGate` component, `useSubscription` hook, `UpgradeBanner`, `CheckoutModal`, `FeatureGate`, `hasAccessToTier()`, and the full Whop subscription pipeline (DB, API route, webhook handler). The `TierGate` component exists at `src/components/tier-gate.tsx` but is **imported by zero files** in the codebase -- it was created in Phase 4 (plan 04-02) but never wired to actual feature pages.

The work is: identify which features map to Pro-only (using the pricing table as source of truth), wrap those features with `<TierGate requiredTier="pro">`, and verify that Starter/free users see the upgrade banner while Pro users pass through unobstructed. No new components, hooks, or API routes need to be created.

**Primary recommendation:** Wrap 3 features in TierGate: (1) Referrals page content, (2) advanced result sections in simulation results (Variants, Insights, Themes), and (3) use the existing `UpgradeBanner` fallback that opens `CheckoutModal` for in-context upgrade.

## Standard Stack

### Core (Already Built -- No Installation Needed)

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| `TierGate` | `src/components/tier-gate.tsx` | Client-side wrapper that gates children behind a required tier | Built, unused |
| `FeatureGate` | `src/components/ui/feature-gate.tsx` | Server-side gate (takes `userTier` as prop, no hook) | Built, unused |
| `useSubscription` | `src/hooks/use-subscription.ts` | Client hook, fetches `/api/subscription`, returns `tier`, `isLoading`, etc. | Built, used in sidebar/billing/pricing |
| `UpgradeBanner` | `src/components/ui/upgrade-banner.tsx` | Visual fallback shown when tier check fails | Built, used only inside TierGate |
| `CheckoutModal` | `src/components/app/checkout-modal.tsx` | Whop embedded checkout dialog | Built, used in pricing/billing/TierGate |
| `hasAccessToTier()` | `src/lib/whop/config.ts` | Pure function: `TIER_HIERARCHY[user] >= TIER_HIERARCHY[required]` | Built, used |
| `getUserTier()` | `src/lib/whop/subscription.ts` | Server-side tier fetch from Supabase | Built, used by API route |

### Tier Hierarchy

```typescript
// src/lib/whop/config.ts
export type VirtunaTier = 'free' | 'starter' | 'pro';
export const TIER_HIERARCHY = { free: 0, starter: 1, pro: 2 };
```

- `free` < `starter` < `pro`
- `hasAccessToTier("pro", "pro")` = true
- `hasAccessToTier("starter", "pro")` = false
- `hasAccessToTier("pro", "starter")` = true (Pro includes Starter)

### No Installation Required

Zero new dependencies. This phase uses only existing components.

## Architecture Patterns

### Pattern 1: TierGate Wrapper (Client-Side -- Primary Pattern)

**What:** Wrap feature content in `<TierGate requiredTier="pro">` to gate behind subscription tier.
**When to use:** Any client component that should be visible only to Pro users.
**How it works:** TierGate calls `useSubscription()` internally, checks tier via `hasAccessToTier()`, renders children if authorized or `UpgradeBanner` + `CheckoutModal` if not.

```typescript
// Source: src/components/tier-gate.tsx (actual codebase)
import { TierGate } from "@/components/tier-gate";

// Usage: wrap gated content
<TierGate requiredTier="pro">
  <ProOnlyFeature />
</TierGate>

// With custom fallback
<TierGate requiredTier="pro" fallback={<LockedPreview />}>
  <ProOnlyFeature />
</TierGate>
```

**Key behavior:**
- Shows `null` while loading (prevents flash of gated content)
- Default fallback: `UpgradeBanner` + `CheckoutModal` (opens Whop checkout inline)
- Custom fallback supported via `fallback` prop

### Pattern 2: FeatureGate (Server-Side -- For Server Components)

**What:** Pure component that takes `userTier` as a prop (no hook dependency).
**When to use:** Server components where hooks are unavailable.

```typescript
// Source: src/components/ui/feature-gate.tsx (actual codebase)
import { FeatureGate } from "@/components/ui/feature-gate";
import { getUserTier } from "@/lib/whop/subscription";

// Server component usage
const tier = await getUserTier();
<FeatureGate requiredTier="pro" userTier={tier}>
  <ProOnlyContent />
</FeatureGate>
```

**Key difference from TierGate:** No hook, no CheckoutModal fallback. Requires explicit `userTier` prop. Fallback is `null` by default.

### Pattern 3: Partial Page Gating (Recommended Approach)

**What:** Gate specific sections within a page rather than the entire page.
**When to use:** When the page should remain accessible but certain features within it are Pro-only.
**Why preferred:** Users can still see and use the page, maintaining engagement while creating upgrade motivation.

```typescript
// Example: Dashboard with gated result sections
<ImpactScore score={result.impactScore} label={result.impactLabel} />
<AttentionBreakdown attention={result.attention} />

{/* Pro-only sections */}
<TierGate requiredTier="pro">
  <VariantsSection variants={result.variants} />
  <InsightsSection insights={result.insights} />
  <ThemesSection themes={result.conversationThemes} />
</TierGate>
```

### Recommended Project Structure (No Changes Needed)

```
src/
├── components/
│   ├── tier-gate.tsx           # Client-side gate (uses useSubscription)
│   └── ui/
│       ├── feature-gate.tsx    # Server-side gate (prop-based)
│       └── upgrade-banner.tsx  # Visual fallback for TierGate
├── hooks/
│   └── use-subscription.ts    # Client hook for subscription data
├── lib/whop/
│   ├── config.ts              # Tier types, hierarchy, hasAccessToTier()
│   └── subscription.ts        # Server-side getUserTier()
└── app/(app)/
    ├── dashboard/             # Gate: advanced simulation results
    ├── referrals/             # Gate: entire page content (Pro-only)
    ├── trending/              # Gate: future - advanced trend filters
    └── settings/              # No gating needed
```

### Anti-Patterns to Avoid

- **Full page redirect gating:** Don't redirect Starter users away from routes entirely. Show the page with gated sections and upgrade prompts instead. Users who can see what they're missing convert better.
- **Multiple useSubscription calls in same component tree:** TierGate already calls useSubscription internally. Don't duplicate the call in parent components -- React will handle it correctly but it creates unnecessary API requests (each call triggers `/api/subscription` fetch).
- **Server-side redirect for tier gating:** Don't add tier checks to middleware. Middleware handles auth only. Tier gating is a UI concern, not a routing concern.
- **Gating basic functionality:** Don't gate the core dashboard, test creation flow, or Hive visualization. These are the product's hook -- gate the advanced outputs, not the input.

## Feature-to-Tier Mapping (Source of Truth: Pricing Page)

The pricing table in `src/app/(marketing)/pricing/pricing-section.tsx` defines what's included per tier:

| Feature | Starter | Pro | Gate Target |
|---------|---------|-----|-------------|
| Viral prediction score | 5/month | Unlimited | Future (backend not built) |
| Trend intelligence | Basic | Advanced | Future (trending page is placeholder) |
| Audience insights | No | Yes | Gate in simulation results |
| Referral rewards | No | Yes | Gate referrals page |
| Content calendar suggestions | No | Yes | Future (not built) |
| Priority support | No | Yes | Non-UI feature |
| Hive visualization | Yes | Yes | No gate needed |
| Export reports | No | Yes | Future (not built) |

### Gatable Features (Exist Now)

Based on what's actually built in the codebase, these are the features that can be meaningfully gated today:

1. **Referrals page** (`/referrals`) -- Pricing table says "Referral rewards: Starter=No, Pro=Yes". The entire referrals page (`src/app/(app)/referrals/page.tsx`) is the feature.

2. **Advanced simulation results** -- Pricing table says "Audience insights: Starter=No, Pro=Yes". The simulation results panel has 5 sections: ImpactScore, AttentionBreakdown, VariantsSection, InsightsSection, ThemesSection. Gate the deeper analysis sections (Variants + Insights + Themes) while keeping ImpactScore + AttentionBreakdown free.

3. **Test type variety** -- The test selector has 11 types. Could gate some as Pro-only (e.g., limit Starter to 3-4 basic types). This requires modifying the selector to show locked state, not just hiding types.

### Recommendation: Gate These 3 Areas

1. **Referrals page content** -- Wrap the page body in TierGate. Starter/free users see upgrade banner.
2. **Simulation result deep sections** -- Gate VariantsSection + InsightsSection + ThemesSection. Starter users see score + attention but need Pro for variants/insights/themes.
3. **Test type selector (optional)** -- Mark some test types as "Pro" with a lock icon/badge. Show upgrade flow when clicked. (This is a stretch goal -- involves more UI changes.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tier access checking | Custom if/else chains | `hasAccessToTier()` from config.ts | Already handles hierarchy (Pro includes Starter) |
| Client-side gating | Custom loading/tier check pattern | `TierGate` component | Already handles loading states, fallback, CheckoutModal |
| Server-side gating | Custom server-side checks | `FeatureGate` + `getUserTier()` | Already paired for server components |
| Upgrade flow | Custom /pricing links or redirect | `UpgradeBanner` + `CheckoutModal` (built into TierGate) | In-context checkout converts better than redirect |

**Key insight:** Everything needed for this phase is already built. The work is purely wiring -- importing TierGate into feature pages and wrapping content.

## Common Pitfalls

### Pitfall 1: Gating Server Components with Client TierGate

**What goes wrong:** `TierGate` is a `"use client"` component that uses `useSubscription()` hook. Wrapping a server component in TierGate forces it to become a client component, losing server-side data fetching.
**Why it happens:** The referrals page (`src/app/(app)/referrals/page.tsx`) is a server component with `await` calls to Supabase.
**How to avoid:** For server components, either:
  - Use `FeatureGate` with `getUserTier()` (server-side, no hook)
  - Extract the server data fetching to the parent, pass as props to a client child wrapped in TierGate
  - Create a client wrapper component that handles the gate and renders server-fetched content
**Warning signs:** Build error "useState/useEffect only works in client components" or seeing `"use client"` forced onto a server component.

### Pitfall 2: Flash of Gated Content

**What goes wrong:** Pro-only content briefly renders before `useSubscription()` resolves, then disappears when TierGate activates.
**Why it happens:** TierGate returns `null` during `isLoading`, but if children have their own loading states, they may render before TierGate's loading resolves.
**How to avoid:** TierGate already handles this correctly by returning `null` during loading. Don't add custom loading logic around TierGate -- let it handle the loading state.
**Warning signs:** Brief flash of content when page loads, then content disappears and upgrade banner appears.

### Pitfall 3: Over-Gating Kills Product Appeal

**What goes wrong:** Gating too many features makes Starter tier feel useless, increasing churn instead of conversions.
**Why it happens:** Zealous tier differentiation without considering user experience.
**How to avoid:** Follow the pricing page as source of truth. Only gate what's explicitly marked as Pro-only. Keep the core loop (create test -> see score) ungated.
**Warning signs:** Starter users can't complete any meaningful workflow.

### Pitfall 4: Server/Client Component Boundary in Referrals Page

**What goes wrong:** The referrals page (`src/app/(app)/referrals/page.tsx`) is an async server component that does Supabase queries. Adding `<TierGate>` around its JSX would require making it a client component.
**Why it happens:** TierGate is a client component; you can't use client components as wrappers in server component render.
**How to avoid:** Two approaches:
  1. **Server-side gate with FeatureGate:** Use `getUserTier()` in the server component and wrap content with `<FeatureGate>`. Then provide a client-component fallback with upgrade CTA.
  2. **Client wrapper pattern:** Extract the referrals page body into a client component, fetch data via API/props, and wrap with TierGate.

  Approach 1 is simpler and preserves server rendering. Recommend using `FeatureGate` for the referrals page specifically.
**Warning signs:** Having to add `"use client"` to the referrals page just for gating.

### Pitfall 5: UpgradeBanner onUpgrade Opens CheckoutModal, Not /pricing Link

**What goes wrong:** Success criteria says "upgrade prompt links to /pricing for conversion" but `UpgradeBanner` opens a `CheckoutModal` inline (via `onUpgrade` callback in TierGate).
**Why it happens:** TierGate's default behavior is inline checkout, not /pricing redirect.
**How to avoid:** The inline checkout is actually better UX (fewer clicks to conversion). The success criteria should be interpreted as "provides a clear upgrade path" rather than literally linking to /pricing. But if a /pricing link is strictly required, provide a custom fallback that links to /pricing instead of using the default UpgradeBanner.
**Warning signs:** Literal interpretation of success criteria #3 conflicting with better UX.

## Code Examples

### Example 1: TierGate on Client Component (Simulation Results)

```typescript
// Source: Derived from existing src/components/app/simulation/results-panel.tsx
// Gate advanced sections in results panel

import { TierGate } from "@/components/tier-gate";

// Inside ResultsPanel component:
<div className="space-y-4 p-4">
  {/* Always visible */}
  <ImpactScore score={result.impactScore} label={result.impactLabel} />
  <AttentionBreakdown attention={result.attention} />

  {/* Pro-only sections */}
  <TierGate requiredTier="pro">
    <VariantsSection variants={result.variants} />
    <InsightsSection insights={result.insights} />
    <ThemesSection themes={result.conversationThemes} />
  </TierGate>
</div>
```

### Example 2: FeatureGate on Server Component (Referrals Page)

```typescript
// Source: Derived from existing src/app/(app)/referrals/page.tsx
// Gate referrals page content server-side

import { FeatureGate } from "@/components/ui/feature-gate";
import { getUserTier } from "@/lib/whop/subscription";

export default async function ReferralsPage() {
  const tier = await getUserTier();

  // ... existing data fetching ...

  return (
    <FeatureGate
      requiredTier="pro"
      userTier={tier}
      fallback={<ReferralsUpgradeFallback />}
    >
      {/* Existing referrals content */}
    </FeatureGate>
  );
}
```

### Example 3: Custom Fallback with /pricing Link

```typescript
// For success criteria #3: upgrade prompt links to /pricing
import Link from "next/link";
import { Zap } from "lucide-react";

function ReferralsUpgradeFallback() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-6">
      <div className="mb-2">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Referral Program
        </h1>
        <p className="text-muted">
          Invite friends to Virtuna and earn rewards.
        </p>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#FF7F50]/10">
          <Zap className="h-5 w-5 text-[#FF7F50]" />
        </div>
        <h3 className="text-sm font-medium text-white">Pro Feature</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Upgrade to Pro to unlock the referral program and start earning.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-block rounded-lg bg-[#FF7F50] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#FF7F50]/90"
        >
          View pricing
        </Link>
      </div>
    </div>
  );
}
```

### Example 4: Server-Side Tier Check for API Gating (Future)

```typescript
// Pattern for server-side API route gating (not needed now but useful reference)
import { getUserTier } from "@/lib/whop/subscription";
import { hasAccessToTier } from "@/lib/whop/config";
import { NextResponse } from "next/server";

export async function GET() {
  const tier = await getUserTier();
  if (!hasAccessToTier(tier, "pro")) {
    return NextResponse.json({ error: "Pro plan required" }, { status: 403 });
  }
  // ... pro-only logic
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full-page redirect gating | Partial page gating with inline upgrade | Industry shift 2023-2024 | Better conversion rates, less user frustration |
| Server-side middleware tier checks | Client-side component gating | React Server Components era | Tier gating is UI concern, not routing concern |
| Redirect to external checkout | Embedded checkout (Whop `WhopCheckoutEmbed`) | Already implemented in Phase 4 | Fewer clicks, higher conversion |

**Current in this codebase:**
- `TierGate` with `UpgradeBanner` + inline `CheckoutModal` is the established pattern
- `FeatureGate` for server components is the complementary server-side pattern
- Both are built and tested in Phase 4 but not yet wired to features

## Open Questions

1. **Which simulation result sections to gate?**
   - What we know: Pricing page says "Audience insights: Pro-only". Results panel has 5 sections.
   - What's unclear: Exactly which sections count as "audience insights" vs basic results.
   - Recommendation: Gate VariantsSection + InsightsSection + ThemesSection. Keep ImpactScore + AttentionBreakdown free. The free sections show "what" (score + breakdown), the gated sections show "why" and "how to improve" (variants, insights, themes).

2. **Should test type selection be gated?**
   - What we know: Pricing says "5/month viral prediction" for Starter. There are 11 test types.
   - What's unclear: Usage limits (5/month) require backend tracking which doesn't exist yet.
   - Recommendation: Defer test count limits. Optionally add "Pro" badge to some test types as visual differentiation, but don't block selection (no backend enforcement exists).

3. **Success criteria #3 interpretation: "links to /pricing"**
   - What we know: TierGate's default UpgradeBanner opens CheckoutModal inline (not /pricing link).
   - What's unclear: Whether literal /pricing link is required or if inline checkout satisfies the intent.
   - Recommendation: Provide BOTH paths. UpgradeBanner (with inline checkout) for dashboard gating, and a "View pricing" link in the server-side fallback for the referrals page. This satisfies both interpretations.

## Sources

### Primary (HIGH confidence)
- `src/components/tier-gate.tsx` -- Actual TierGate implementation, verified imports and behavior
- `src/components/ui/feature-gate.tsx` -- Server-side FeatureGate implementation
- `src/hooks/use-subscription.ts` -- useSubscription hook implementation and API contract
- `src/lib/whop/config.ts` -- VirtunaTier type, TIER_HIERARCHY, hasAccessToTier()
- `src/app/(marketing)/pricing/pricing-section.tsx` -- Feature comparison table (source of truth for tier mapping)
- `src/app/(app)/referrals/page.tsx` -- Server component structure, Supabase queries
- `src/components/app/simulation/results-panel.tsx` -- Results panel section structure
- `src/components/app/sidebar.tsx` -- Sidebar tier badge already wired
- `src/components/app/checkout-modal.tsx` -- Whop checkout embed integration

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` -- Phase 7 definition, success criteria, dependencies
- `.planning/STATE.md` -- Prior decisions from Phases 4 and 6

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All components already built and verified in codebase
- Architecture: HIGH -- Patterns are established and documented in existing components
- Pitfalls: HIGH -- Server/client boundary issues identified from actual page analysis
- Feature mapping: MEDIUM -- Which features to gate involves product decisions, pricing page used as proxy

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- all components exist, no external dependencies)
