# Phase 6: Polish - Research

**Researched:** 2026-02-16
**Domain:** UI polish, mobile responsiveness, OG metadata, dead code cleanup
**Confidence:** HIGH

## Summary

Phase 6 is a polish pass across the entire Virtuna MVP. The codebase is functionally complete (Phases 1-5 verified) but has several categories of work remaining: dashboard UI inconsistencies, an orphaned brand-deals page that should redirect to referrals, missing route-level OG images for social sharing, mobile responsiveness gaps across all pages, and significant dead code inherited from the societies.io codebase this project was forked from.

The technical scope is straightforward -- no new libraries needed, no architectural changes. This is editing existing files, adding `opengraph-image.tsx` route handlers (pattern already established at root level), testing mobile layouts, and deleting unused code. The main risk is missing edge cases during the mobile pass and accidentally breaking imports during dead code cleanup.

**Primary recommendation:** Split into two plans as roadmap suggests -- Plan 06-01 for dashboard fixes + affiliate rework (focused, fewer files), Plan 06-02 for OG tags + mobile pass + dead code (broader sweep). Both plans should end with a full build verification since dead code removal can break imports.

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15 | OG image generation via `opengraph-image.tsx` file convention | Built-in `ImageResponse` from `next/og` -- already used at root |
| Tailwind CSS | v4 | Responsive utilities for mobile pass | Already configured with full design token system |
| TypeScript | - | Type-safe refactoring during dead code cleanup | Already project standard |

### Supporting (Already Installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@phosphor-icons/react` | - | Icons already used in sidebar, buttons | Consistent with existing UI |
| `framer-motion` / `motion/react` | - | Animation library used in loading phases | Only touch if fixing skeleton delays |

### Alternatives Considered

None. This phase uses exclusively what's already in the project. No new dependencies.

**Installation:** None required.

## Architecture Patterns

### OG Image File Convention (Next.js 15)

The project already has the pattern at `src/app/opengraph-image.tsx`. For route-specific OG images, place additional `opengraph-image.tsx` files in the relevant route segments:

```
src/app/
├── opengraph-image.tsx              # Root OG (EXISTS -- generic Virtuna branding)
├── (marketing)/
│   ├── opengraph-image.tsx          # NEEDED -- landing page specific
│   └── pricing/
│       └── opengraph-image.tsx      # OPTIONAL -- pricing-specific
```

**Key finding:** The root `opengraph-image.tsx` already exists and generates a dynamic image with `ImageResponse`. However, the root `layout.tsx` metadata references `/og-image.png` which does NOT exist in `public/`. There are two OG image mechanisms conflicting:
1. `opengraph-image.tsx` (dynamic, works)
2. `metadata.openGraph.images` pointing to `/og-image.png` (static, file missing)

**Resolution:** Remove the static `/og-image.png` reference from `layout.tsx` metadata since the `opengraph-image.tsx` file convention takes precedence. Or generate a static file. The dynamic approach is better for per-route customization.

### Referral Link OG Tags

For referral links (`?ref=CODE`), the OG image is served from whatever page the link points to (typically the landing page `/`). The `?ref` parameter is handled by middleware for cookie setting -- it does not affect which page renders. So the landing page's OG image covers referral link sharing.

### Dashboard UI Fix Pattern

Current issues identified in the dashboard:

1. **No `bg-white/5` card background issue found in dashboard itself** -- the PLSH-01 requirement mentions this but the actual dashboard (`dashboard-client.tsx`) uses `bg-background` on the root div. The `bg-white/5` pattern appears in other components (tabs, selects, extension cards) but not as a dashboard-specific card issue. **The planner should verify with the user which specific cards need fixing, or treat this as ensuring all cards follow the Raycast pattern: `bg-transparent` + `border-white/[0.06]` + inset shadow.**

2. **Button shadows** -- The `shadow-button` token is properly defined in globals.css and used correctly in the Button component. No obvious fix needed unless specific buttons are misusing it.

3. **Skeleton delays / hardcoded timers** -- The `test-store.ts` `submitTest` method uses four `setTimeout(resolve, 1000)` calls to simulate AI processing phases. These are intentional mock delays (simulating backend processing), NOT skeleton loading delays. The actual skeleton display in `loading-phases.tsx` is driven by Zustand state, not timers. **The Suspense fix likely refers to replacing the `AuthGuard` loading state** -- currently it uses `useState(isLoading)` with an async check, which could be replaced with React Suspense boundaries. However, this is a minor change and the current approach works correctly.

### Affiliate Page Rework Pattern

Current state:
- `/brand-deals/page.tsx` -- Placeholder page saying "Brand deal tracking and earnings coming soon" (DEAD CODE -- should be removed or redirected)
- `/referrals/page.tsx` -- Fully functional referral dashboard with link generation + stats
- Sidebar already links "Referrals" to `/referrals` (not `/brand-deals`)
- Middleware `PROTECTED_PREFIXES` still includes `/brand-deals` and `/earnings`

**Resolution:** The brand-deals page is effectively dead. The "affiliate/earnings" rework means either:
1. Delete `/brand-deals/` entirely and remove from middleware
2. OR redirect `/brand-deals` to `/referrals`

Option 1 is cleaner. The sidebar already points to `/referrals`.

### Mobile Responsiveness Pass Pattern

Pages requiring mobile audit (all routes in the app):

**Marketing (public):**
- `/` (landing page) -- Hero, hive demo, features, stats, social proof, FAQ, footer
- `/pricing` -- Pricing cards, comparison table
- `/login`, `/signup` -- Auth forms
- `/coming-soon` -- Simple placeholder

**App (authenticated):**
- `/dashboard` -- Hive canvas, context bar, filter pills, test forms, results panel
- `/trending` -- Placeholder (simple)
- `/referrals` -- Referral link card, stats grid
- `/settings` -- Tabbed settings with profile, account, notifications, billing, team

**Known mobile concerns from code review:**
1. Dashboard filter pills: `overflow-x-auto` is set but no `min-w-0` or flex constraints -- could overflow on narrow screens
2. Dashboard floating content area: `max-w-2xl px-6` with `absolute bottom-6` -- may clip on short mobile screens
3. Pricing comparison table: Has `overflow-x-auto` wrapper but `min-w-[480px]` on table -- will scroll horizontally on <480px screens (acceptable pattern)
4. Hive canvas: `absolute inset-0 top-14` -- needs to verify touch events don't interfere with scrolling on mobile
5. Sidebar toggle: Properly set to `flex md:hidden` + conditional desktop visibility -- looks correct
6. Upgrade prompt: `mx-4 mb-4 flex items-center justify-between` -- may need `flex-wrap` on very narrow screens
7. Settings page: Need to verify tab navigation is scrollable on mobile

### Dead Code Cleanup Strategy

**High-confidence dead code identified:**

1. **`/brand-deals/page.tsx`** -- Orphaned placeholder, not linked from sidebar
2. **Landing components NOT exported or imported anywhere:**
   - `backers-section.tsx` -- References external backers/investors (not Virtuna)
   - `case-study-section.tsx` -- References Teneo + "Artificial Societies" (societies.io content)
   - `partnership-section.tsx` -- References Pulsar + "Artificial Societies" (societies.io content)
   - `comparison-chart.tsx` -- References "Artificial Societies" vs GPT-5/Gemini (societies.io content)
   - `persona-card.tsx` -- Not imported anywhere
3. **Visualization components only used in test pages:**
   - `components/visualization/` (GlassOrb, VisualizationCanvas, SplineOrb, shaders) -- Only used in `/viz-test` page
4. **Marketing test/showcase pages** (may want to keep for dev reference):
   - `/viral-score-test/` -- Test page
   - `/viz-test/` -- Visualization test page
   - `/viral-results-showcase/` -- Showcase page
   - `/primitives-showcase/` -- Primitives showcase
   - `/showcase/` -- Full component showcase
5. **Motion components not used outside showcase:**
   - `page-transition.tsx` + `frozen-router.tsx` -- Exported from barrel but never imported in app code
6. **Effects components only used in showcase:**
   - `noise-texture.tsx`, `chromatic-aberration.tsx` -- Only imported in showcase utilities page
7. **Middleware references to dead routes:**
   - `PUBLIC_PATHS` includes `/coming-soon`, `/showcase`, `/primitives-showcase`, `/viral-score-test`, `/viral-results-showcase`, `/viz-test`
   - `PROTECTED_PREFIXES` includes `/brand-deals`, `/earnings`, `/content-intelligence`
8. **societies.io references in code comments** -- Multiple files reference "societies.io" in comments (header, accordion, hive files, etc.)
9. **Database types for old affiliate tables** -- `affiliate_clicks` and `affiliate_conversions` tables in `database.types.ts` are from the pre-referral system; the new referral system uses `referral_codes`, `referral_clicks`, `referral_conversions` tables. The old affiliate types remain in the auto-generated types file.

**Decision needed for showcase pages:** The showcase/test pages are useful development references but add to bundle size and are technically "dead" for the MVP. Recommend keeping `/showcase` but removing test pages (`/viz-test`, `/viral-score-test`, `/viral-results-showcase`, `/primitives-showcase`). **This is a planner/user decision.**

**Decision needed for database types:** The `database.types.ts` is auto-generated by `supabase gen types`. The old affiliate tables may still exist in the database. Modifying this file manually is not recommended -- it should be regenerated after any DB schema changes. **Leave database types as-is.**

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OG image generation | Custom API route returning images | `opengraph-image.tsx` file convention | Next.js auto-handles caching, content-type, and metadata injection |
| Mobile viewport meta | Manual `<meta name="viewport">` | `export const viewport: Viewport` in root layout | Already configured correctly |
| Dead import detection | Manual search | `npx tsc --noEmit` + ESLint | Catches type errors and unused imports automatically |
| Responsive breakpoints | Custom media queries | Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) | Already established pattern throughout codebase |

**Key insight:** The OG image generation is already set up correctly with the file convention pattern. The planner just needs to add route-specific `opengraph-image.tsx` files, not build any new infrastructure.

## Common Pitfalls

### Pitfall 1: Deleting Files That Are Indirectly Imported
**What goes wrong:** Removing a component that is re-exported through a barrel file (`index.ts`) breaks other imports even if no page directly uses the component.
**Why it happens:** Barrel exports create transitive dependencies. `import { X } from "@/components/landing"` will fail if `X` was removed but still re-exported.
**How to avoid:** For each file deletion: (1) Check the barrel export, (2) Remove the export line, (3) Search for any direct imports, (4) Run `npx tsc --noEmit` after all deletions.
**Warning signs:** Build errors mentioning "Module not found" or "has no exported member."

### Pitfall 2: OG Image Not Updating Due to Caching
**What goes wrong:** After adding/updating `opengraph-image.tsx`, social media platforms show old/cached previews.
**Why it happens:** Platforms like Facebook, Twitter, LinkedIn cache OG images aggressively (hours to days).
**How to avoid:** Use social media debugger tools to invalidate cache: Facebook Sharing Debugger, Twitter Card Validator. Also verify locally with `curl` to check the actual HTML `<meta>` tags.
**Warning signs:** OG image works locally but shows wrong preview on social media.

### Pitfall 3: Mobile Overflow From Fixed-Width Elements
**What goes wrong:** Elements with pixel-based widths or `min-w-[Xpx]` cause horizontal scroll on narrow mobile screens.
**Why it happens:** Fixed widths don't adapt to viewport. Combined with `overflow-x: hidden` on body, content gets clipped instead of scrolling.
**How to avoid:** Use `max-w-full`, percentage widths, or responsive variants. Check with Chrome DevTools responsive mode at 320px and 375px widths.
**Warning signs:** Horizontal scrollbar on mobile, content cut off on right edge.

### Pitfall 4: Removing Showcase Pages Breaks Development Workflow
**What goes wrong:** Deleting showcase pages that the developer uses for visual testing during development.
**Why it happens:** Showcase pages look like dead code but serve as live component documentation.
**How to avoid:** Confirm with the user which test/showcase pages to keep vs remove.
**Warning signs:** Developer asks "where did the showcase page go?" after cleanup.

### Pitfall 5: `opengraph-image.tsx` Font Loading in Edge Runtime
**What goes wrong:** Using `readFile` or Node.js APIs in edge runtime fails.
**Why it happens:** The existing root `opengraph-image.tsx` uses `export const runtime = "edge"`. Edge runtime has no access to `node:fs`.
**How to avoid:** For custom fonts in OG images, either: (1) Use `fetch` to load from a URL, or (2) Switch to Node.js runtime (remove `export const runtime = "edge"`), or (3) Use system fonts (no loading needed). The current root OG image doesn't load custom fonts, so this is fine as-is.
**Warning signs:** Build error mentioning "Module 'node:fs' not found."

## Code Examples

### OG Image for Marketing Routes (Verified Pattern from Existing Root)

```typescript
// src/app/(marketing)/opengraph-image.tsx
// Source: Mirrors existing src/app/opengraph-image.tsx pattern
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Virtuna - AI Content Intelligence for TikTok Creators";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        background: "#07080a",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {/* ... branding content ... */}
      </div>
    ),
    { ...size },
  );
}
```

### Mobile-Safe Dashboard Filter Container

```tsx
// Current: overflow-x-auto without width constraint
<div className="flex items-center gap-3 overflow-x-auto">
  <FilterPillGroup />
</div>

// Fixed: Add min-w-0 to prevent flex child overflow + scrollbar styling
<div className="flex min-w-0 items-center gap-3 overflow-x-auto">
  <FilterPillGroup />
</div>
```

### Redirect Pattern for Removed Routes

```typescript
// src/app/(app)/brand-deals/page.tsx -- Replace with redirect
import { redirect } from "next/navigation";

export default function BrandDealsPage() {
  redirect("/referrals");
}
```

### TypeScript Verification After Dead Code Removal

```bash
# After removing files, verify no broken imports
npx tsc --noEmit

# If errors found, fix the import paths
# Then verify full build
pnpm build
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static `/og-image.png` in public | `opengraph-image.tsx` file convention | Next.js 13.3+ | Auto-generates, route-specific, cacheable |
| `useState` loading + `setTimeout` skeleton | React Suspense boundaries | React 18+ | Better UX, no waterfall, streaming compatible |
| Manual `<meta>` tags in `<Head>` | `export const metadata` / `generateMetadata` | Next.js 13+ | Type-safe, deduplicated, composable per route |

**Deprecated/outdated:**
- Static OG image approach: The project has BOTH `opengraph-image.tsx` AND static references to `/og-image.png`. The static file doesn't exist. Clean up the metadata to rely solely on the dynamic approach.
- `export const runtime = "edge"` for OG images: Still valid but optional. Node.js runtime works fine for OG generation and allows `readFile` for fonts.

## Open Questions

1. **Which dashboard cards need `bg-white/5` fix?**
   - What we know: The PLSH-01 requirement mentions "bg-white/5 card" but no card in the dashboard uses this class. The cards in loading-phases use `GlassCard` which has its own styling.
   - What's unclear: Whether this refers to dashboard cards or other app pages (referrals, settings).
   - Recommendation: During planning, audit all cards in the app for Raycast design compliance. The standard is `bg-transparent` + `border-white/[0.06]` + `shadow inset`. Fix any deviations.

2. **Keep or remove showcase/test pages?**
   - What we know: 5 showcase/test pages exist under `(marketing)` that are not linked from the landing page or navigation.
   - What's unclear: Whether the developer wants these for ongoing development reference.
   - Recommendation: Default to keeping `/showcase` (design system docs) and removing the 4 test pages. Confirm with user.

3. **Skeleton delay semantics**
   - What we know: The `submitTest` in `test-store.ts` uses `setTimeout` to simulate AI processing phases. These are intentional mock delays for demo purposes, not loading state bugs.
   - What's unclear: Whether PLSH-01 wants these mock delays replaced with actual Suspense-based loading (which would require a real backend), or just improved loading UX.
   - Recommendation: Keep the mock delays as-is (they simulate the backend that doesn't exist yet). If the user wants Suspense, note it requires actual async data fetching. The `AuthGuard` skeleton could use Suspense but the current approach is functional.

4. **societies.io references in code comments**
   - What we know: ~20+ files have "societies.io" in comments describing design patterns.
   - What's unclear: Whether to clean these up (they're comments, not user-facing).
   - Recommendation: Include in dead code cleanup for polish. Replace with "Virtuna" or remove the reference where appropriate.

## Sources

### Primary (HIGH confidence)
- `/vercel/next.js` Context7 docs -- opengraph-image.tsx file conventions, ImageResponse API
- Direct codebase inspection -- All findings verified against actual source files in the worktree

### Secondary (MEDIUM confidence)
- Raycast design language rules from `CLAUDE.md` -- Card styling standards, border/shadow tokens

### Tertiary (LOW confidence)
- None. All findings are from direct code inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, everything already in place
- Architecture: HIGH -- OG pattern already established, just needs route-specific additions
- Pitfalls: HIGH -- Common patterns well-documented, verified against codebase
- Dead code inventory: HIGH -- Every file traced through imports and barrel exports
- Mobile responsiveness concerns: MEDIUM -- Identified from code review, not from actual mobile testing. Some issues may not manifest or additional ones may exist

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no fast-moving dependencies)

---

## Appendix: Dead Code Inventory

### Files to Delete (HIGH confidence -- no imports found)

| File | Reason |
|------|--------|
| `src/components/landing/backers-section.tsx` | Not imported, references external backers |
| `src/components/landing/case-study-section.tsx` | Not imported, references Teneo/societies.io |
| `src/components/landing/partnership-section.tsx` | Not imported, references Pulsar/societies.io |
| `src/components/landing/comparison-chart.tsx` | Not imported, references "Artificial Societies" |
| `src/components/landing/persona-card.tsx` | Not imported anywhere |

### Files to Redirect or Remove

| File | Action | Reason |
|------|--------|--------|
| `src/app/(app)/brand-deals/page.tsx` | Redirect to `/referrals` or delete | Orphaned placeholder, sidebar links to `/referrals` |

### Barrel Exports to Clean

| File | Remove Exports |
|------|---------------|
| `src/components/landing/index.ts` | Remove `TestimonialQuote` export if case-study/partnership deleted (check social-proof-section still uses it) |

### Middleware Cleanup

| Item | Action |
|------|--------|
| `PROTECTED_PREFIXES: "/brand-deals"` | Remove or update based on brand-deals page decision |
| `PROTECTED_PREFIXES: "/earnings"` | Remove (no `/earnings` route exists) |
| `PROTECTED_PREFIXES: "/content-intelligence"` | Remove (no `/content-intelligence` route exists) |
| `PUBLIC_PATHS: "/coming-soon"` | Keep (still used by footer links) |
| `PUBLIC_PATHS: showcase/test paths` | Remove if deleting test pages |

### Optional Cleanup (Developer Decision)

| File/Dir | Notes |
|----------|-------|
| `src/app/(marketing)/viz-test/` | Test page for visualization components |
| `src/app/(marketing)/viral-score-test/` | Test page for viral scoring |
| `src/app/(marketing)/viral-results-showcase/` | Showcase for viral results UI |
| `src/app/(marketing)/primitives-showcase/` | Primitives component showcase |
| `src/components/visualization/` | Only used by viz-test page |
| `src/components/motion/page-transition.tsx` | Exported but never used in app |
| `src/components/motion/frozen-router.tsx` | Only used by page-transition.tsx |
| `src/components/effects/` | Only used in showcase utilities page |

### Comments to Update

Files with "societies.io" references in comments (non-breaking but should be cleaned):
- `src/components/layout/header.tsx` (line 13-14)
- `src/components/landing/testimonial-quote.tsx` (line 16)
- `src/components/landing/feature-card.tsx` (line 17)
- `src/components/hive/hive-layout.ts` (lines 2, 48)
- `src/components/hive/hive-renderer.ts` (line 5)
- `src/components/hive/hive-mock-data.ts` (line 39)
- `src/components/hive/hive-constants.ts` (lines 21, 31, 48)
- `src/components/ui/accordion.tsx` (line 14)
- `src/lib/test-types.ts` (line 89)
