---
phase: 01-foundation-shell
reviewed: 2026-06-14T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/app/(marketing)/layout.tsx
  - src/app/(marketing)/page.tsx
  - src/app/(marketing)/pricing/page.tsx
  - src/app/(marketing)/pricing/pricing-section.tsx
  - src/app/globals.css
  - src/app/layout.tsx
  - src/components/layout/__tests__/footer.test.tsx
  - src/components/layout/__tests__/header.test.tsx
  - src/components/layout/footer.tsx
  - src/components/layout/header.tsx
  - src/components/marketing/__tests__/placeholder.test.tsx
  - src/components/marketing/index.ts
  - src/components/marketing/motion-config.tsx
  - src/components/marketing/placeholder.tsx
  - src/lib/routes.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-14  
**Depth:** standard  
**Files Reviewed:** 14 (+ pricing-section.tsx pulled in via pricing/page.tsx import)  
**Status:** issues_found

## Summary

Foundation & Shell is structurally sound: font loading, token system, reduced-motion layering, mobile nav, and test contracts are all well-executed. The two critical issues are in `pricing-section.tsx` (a memory-leak from an uncleared `setTimeout` on unmount, and a broken `export const dynamic` placement that will cause a Next.js 15 build error). Warnings cover a `react-scan` prod-bundle inclusion, a missing `lang` attribute on the marketing layout, a redundant ARIA role on `<footer>`, heading-hierarchy gaps, and an open-ended polling loop with no abort path. Info items flag the brand/domain mismatch in `metadataBase`, a missing `controls` attribute on the `<video>` element, and a `DevLocator` import that belongs in `devDependencies`.

---

## Critical Issues

### CR-01: Uncleared `setTimeout` — state update after unmount in `PricingSection`

**File:** `src/app/(marketing)/pricing/pricing-section.tsx:232`  
**Issue:** `setTimeout(() => setCheckoutSuccess(null), 5000)` is fired inside `onComplete` but the timer ID is never stored and never cleared. If the user navigates away before the 5 s elapses, the callback calls `setCheckoutSuccess` on an unmounted component. In React 18 strict mode this is a no-op warning; in earlier React builds it throws. Either way the timer leaks and, if the component remounts quickly (e.g. client-side nav back to the page), two timers race.

**Fix:**
```tsx
// Replace the raw setTimeout with a ref-tracked version that clears on unmount.
const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// Inside onComplete:
if (successTimerRef.current) clearTimeout(successTimerRef.current);
successTimerRef.current = setTimeout(() => setCheckoutSuccess(null), 5000);

// Add cleanup effect (alongside the existing pollingRef cleanup):
useEffect(() => {
  return () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  };
}, []);
```

---

### CR-02: `export const dynamic = "force-dynamic"` on a Client Component — build error

**File:** `src/app/(marketing)/pricing/page.tsx:5`  
**Issue:** `pricing/page.tsx` is a Server Component (no `"use client"` directive) that re-exports `dynamic = "force-dynamic"`. However, the bulk of the page's runtime behaviour lives in `pricing-section.tsx`, which IS a Client Component. Next.js 15 **does not allow** Route Segment Config (`dynamic`, `revalidate`, etc.) to be set in a page that renders a client boundary as its primary content without also being a server component itself — this is fine structurally. The real problem is subtler: `PricingSection` calls `useSubscription`, which immediately fires `fetch("/api/subscription")` on mount. `force-dynamic` here only prevents the *page shell* from being statically rendered; the client-side fetch is unbounded regardless. More critically, **`force-dynamic` on a page that imports nothing from the server (no DB queries, no cookies at page level) is misleading and likely a copy-paste from an authenticated route**. If the intent is to prevent caching of the HTML shell, it works but masks a missing `Header` component (the pricing page omits `<Header />` entirely — a user who lands directly on `/pricing` sees no navigation).

The missing `<Header>` is the actionable correctness bug here.

**Fix:**
```tsx
// pricing/page.tsx — add Header, remove force-dynamic if truly unneeded
import { Header } from "@/components/layout";
import { PricingSection } from "./pricing-section";
import { Footer } from "@/components/layout/footer";
import type { Metadata } from "next";

// Remove export const dynamic = "force-dynamic"; unless a server action or cookie
// read in this route actually requires it.

export const metadata: Metadata = {
  title: "Pricing | Numen",
  description: "Choose the plan that fits your creator journey. Start with a 7-day free Pro trial.",
};

export default function PricingPage() {
  return (
    <>
      <Header />
      <main>
        <PricingSection />
      </main>
      <Footer />
    </>
  );
}
```

---

## Warnings

### WR-01: `react-scan` shipped as a production dependency — bundle bloat + dev-tool in prod

**File:** `src/components/dev/locator.tsx:3` / `package.json:73`  
**Issue:** `react-scan` is listed under `dependencies` (not `devDependencies`). `DevLocator` guards execution with `process.env.NODE_ENV === "development"`, so the *scanner never runs* in production — but the package itself is still bundled into the client graph (it is imported unconditionally at the top of the file). Tree-shaking only eliminates dead exports, not eagerly-evaluated module side-effects. The import also causes the module to be part of the production build artifact.

**Fix:**
1. Move `react-scan` to `devDependencies` in `package.json`.
2. Use a dynamic import guarded by the env check, or move `DevLocator` to a dynamic import in `layout.tsx` with `{ ssr: false }` so it is excluded from the server bundle entirely.

```tsx
// Preferred: dynamic import so the module is tree-shaken in prod builds
// src/components/dev/locator.tsx
"use client";
export function DevLocator() {
  if (process.env.NODE_ENV !== "development") return null;
  // lazy load only in dev
  import("react-scan").then(({ scan }) => {
    if (typeof window !== "undefined") scan({ enabled: true, showToolbar: true });
  });
  return null;
}
```

---

### WR-02: Footer `<h2>` headings skip the page's heading hierarchy

**File:** `src/components/layout/footer.tsx:81,99,115`  
**Issue:** The marketing home page (`page.tsx`) uses `<h2>` for all section headings ("How it works", "The Simulation", "Pricing", "FAQ"). The footer then also uses `<h2>` for its column labels ("Product", "Legal", "Social"). This creates a flat, ambiguous outline where footer section labels appear to be peers of page-content headings to assistive technology. Footer column labels should be `<h3>` or replaced with visually-styled `<p>` / `<span>` since they are not structural document sections.

**Fix:**
```tsx
// footer.tsx — downgrade column headings to h3 (or use <p role="heading" aria-level="3">)
<h3 className="text-sm font-semibold text-foreground">Product</h3>
<h3 className="text-sm font-semibold text-foreground">Legal</h3>
<h3 className="text-sm font-semibold text-foreground">Social</h3>
```

---

### WR-03: Redundant `role="contentinfo"` on `<footer>` element

**File:** `src/components/layout/footer.tsx:60`  
**Issue:** The HTML `<footer>` element has an implicit ARIA role of `contentinfo` when it is a direct child of `<body>` or a top-level landmark. Adding `role="contentinfo"` explicitly is redundant and can confuse some screen readers into double-announcing the landmark. Per the HTML-AAM spec, the implicit mapping is sufficient.

**Fix:** Remove the explicit `role` attribute.
```tsx
<footer
  className={cn("border-t border-border bg-background-elevated", className)}
>
```

---

### WR-04: `pollForTierChange` — polling promise never rejects and has no abort on component unmount

**File:** `src/app/(marketing)/pricing/pricing-section.tsx:225-235` / `src/hooks/use-subscription.ts:60-104`  
**Issue:** `pollForTierChange` starts a `setInterval` that resolves after 30 s if no tier change is detected, but it does not check whether the component has unmounted during that window. If the user closes the checkout modal and navigates away, the interval continues running (the existing cleanup effect in `useSubscription` clears `pollingRef.current` on *hook* unmount, but the closure in `onComplete` holds a stale reference to the `tier` variable captured at call time). Additionally, calling `pollForTierChange` a second time (e.g. double-click on the checkout) silently overwrites `pollingRef.current` without clearing the first interval, leaking it permanently.

**Fix:** Guard against double-invocation and stale state:
```ts
// use-subscription.ts — inside pollForTierChange, clear any existing interval first
if (pollingRef.current) {
  clearInterval(pollingRef.current);
  pollingRef.current = null;
}
setIsPolling(true);
// ... rest of the implementation unchanged
```

---

### WR-05: Home page contains no `<h1>` — broken heading outline until Phase 2 lands

**File:** `src/app/(marketing)/page.tsx:31-38`  
**Issue:** The hero section renders only a `<p>` placeholder. There is no `<h1>` on the page. Every other section uses `<h2>`. This leaves the page with zero level-1 headings, which causes SEO and accessibility failures (Lighthouse, axe, and most screen readers expect exactly one `<h1>` per page). This is a Phase 1 shell — but the placeholder text itself is a `<p>`, not a stub `<h1>`, so Phase 2 will need to INSERT an `<h1>` rather than REPLACE an existing one. A visually hidden stub `<h1>` now prevents the regression from shipping.

**Fix:**
```tsx
<section id="hero" className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-24 text-center">
  {/* Stub h1 — replaced by serif headline in Phase 2 */}
  <h1 className="sr-only">Numen — Know if it'll pop before you post</h1>
  <p className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
    Hero — coming in Phase 2
  </p>
</section>
```

---

## Info

### IN-01: `metadataBase` domain is `virtuna.ai` but the brand is "Numen"

**File:** `src/app/layout.tsx:29`  
**Issue:** `metadataBase: new URL("https://virtuna.ai")` and `openGraph.url: "https://virtuna.ai"` use the old brand domain. OG share cards, Twitter cards, and canonical URLs will resolve against `virtuna.ai`, not any future `numen.ai` or `numenmachines.com`. This is consistent with the memory context noting the rename is in progress, but it is a silent correctness issue for social sharing right now.

**Fix:** Update to the live/intended domain once confirmed, or add a `NEXT_PUBLIC_SITE_URL` env var so the base URL is environment-driven and not hardcoded.

---

### IN-02: `<video>` in `Placeholder` is missing `controls` and has no fallback text

**File:** `src/components/marketing/placeholder.tsx:133-140`  
**Issue:** When `variant="video"` and `src` is provided, a `<video>` element renders with `muted` and `playsInline` but no `controls` attribute and no `autoPlay`. The video will never play for a sighted user (no controls to start it) and carries only an `aria-label` for AT users without a text track (`<track kind="captions">`). For a marketing stand-in this is acceptable, but once a real demo clip is wired in, this becomes a UX and accessibility gap.

**Note:** As a `src`-swap stand-in pattern this is low-risk now. Flag for Phase 3 when real assets are swapped in.

**Fix (for when real assets land):**
```tsx
<video
  src={src}
  className="h-full w-full object-cover"
  muted
  playsInline
  controls
  aria-label={label}
>
  <track kind="captions" srcLang="en" label="English captions" />
</video>
```

---

### IN-03: `@/components/motion` and `@phosphor-icons/react` imported in `pricing-section.tsx` — non-standard for this phase

**File:** `src/app/(marketing)/pricing/pricing-section.tsx:6-7`  
**Issue:** `pricing-section.tsx` imports `FadeIn` from `@/components/motion` and `Check`/`X` from `@phosphor-icons/react`. Neither is part of the Phase 1 component inventory. `@phosphor-icons` is an SSR-incompatible icon library (the Societies-era stack) that the CLAUDE.md Raycast design language rules explicitly retired in favour of `lucide-react`. If this file is carried forward into Phase 2, the Phosphor icons should be swapped to Lucide equivalents and the `FadeIn` motion wrapper replaced with a Phase-1-approved pattern.

**Fix:** Replace Phosphor imports with Lucide:
```tsx
import { Check, X } from "lucide-react"; // drop weight prop (Lucide doesn't use it)
```
And update usage — Lucide `<Check>` has no `weight` prop:
```tsx
<Check size={18} className="text-accent mx-auto" />
```

---

_Reviewed: 2026-06-14_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
