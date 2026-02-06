# Pitfalls Research: Brand Deals & Affiliate Page UI

**Domain:** Brand deals & affiliate page with tabbed layout, card grids, copy-to-clipboard, earnings charts
**Researched:** 2026-02-05
**Overall Confidence:** HIGH
**Scope:** UI-only milestone with mock data, built via v0 MCP guided by existing Virtuna design system

---

## Executive Summary

**Top 5 Risks to Watch:**

1. **v0 MCP Design System Drift** - v0 generates beautiful components that use its own styling conventions (shadcn defaults, arbitrary Tailwind values) rather than Virtuna's design tokens. Every generated component will need a token-alignment pass or the page will look "almost right" but subtly wrong.

2. **Glassmorphism Performance on Card Grids** - A deals/affiliates grid of 12-20+ GlassCards, each with `backdrop-filter: blur()`, will trigger GPU compositing per card. Mobile devices and even desktop Safari will stutter if every card has glass effects.

3. **Tab State/URL Desync** - The three-tab layout (Deals / Affiliates / Earnings) must sync with URL search params for shareability and back-button support. The existing Settings page uses Radix Tabs with `searchParams` -- but the Brand Deals page has different routing concerns (sidebar nav vs. URL tabs).

4. **Recharts Dark Mode Token Mismatch** - Recharts ships with light-mode defaults. Axis lines, tick labels, tooltip backgrounds, and grid lines will render as dark-on-dark unless every element is manually themed to match Virtuna's token system.

5. **Inconsistent Card Heights in Grid** - Deal cards have variable content (brand logo, offer text length, payout info). CSS Grid with `auto-fill` or fixed columns creates uneven row heights unless explicitly managed.

---

## Critical Pitfalls

Mistakes that cause visual regressions, rewrites, or significant rework.

### Pitfall 1: v0 MCP Generates Components That Look Right But Use Wrong Tokens

**What goes wrong:** v0 generates polished components with hardcoded Tailwind classes like `bg-zinc-900`, `border-zinc-800`, `text-zinc-400` instead of Virtuna's semantic tokens (`bg-surface`, `border-border`, `text-foreground-secondary`). Components render similarly in development but break token system integrity. Future theme changes won't propagate. Worse, v0 may generate its own `rounded-xl`, `shadow-lg` values that differ from Virtuna's `radius-lg` (12px) and `shadow-lg` specs.

**Why it happens:**
- v0 defaults to shadcn/ui conventions and generic Tailwind values
- BRAND-BIBLE.md context helps but v0 doesn't enforce token usage -- it interprets the intent
- v0 has no access to the actual `globals.css` @theme block unless explicitly provided
- Subtle differences (Virtuna's `gray-950: #07080a` vs Tailwind's default `zinc-950: #09090b`) appear identical but aren't
- Generated components look correct visually, so the drift goes unnoticed

**Warning Signs:**
- Generated code contains `zinc-` classes instead of `surface`, `foreground-secondary`, `border`
- Hardcoded `rounded-xl` instead of `rounded-[var(--radius-lg)]` or `rounded-lg`
- Components use `shadow-lg` from Tailwind defaults rather than Virtuna's custom `--shadow-lg`
- Inline `backdrop-filter` values that don't match glass-blur utility classes
- Components import from `@/components/ui/card` (shadcn default) instead of using `GlassCard`/`GlassPanel`
- Font families defaulting to Inter/system fonts instead of Satoshi/Funnel Display

**Prevention:**
1. **Include globals.css @theme block in every v0 prompt** - Not just BRAND-BIBLE.md, but the actual token definitions
2. **Provide explicit component imports** - Tell v0 "Use `GlassCard` from `@/components/primitives`, not a custom card"
3. **Token replacement pass after every v0 generation** - Systematic find-and-replace: `zinc-950` -> `background`, `zinc-900` -> `surface`, etc.
4. **Create a v0 prompt template** with the token mapping table baked in
5. **Review generated `className` strings character by character** -- don't just check visual output

**Phase to Address:** Every phase -- establish v0 prompt template and review checklist before generating any component

**Confidence:** HIGH -- this is the most consistently observed issue when using AI code generation with custom design systems

---

### Pitfall 2: Glassmorphism Performance Degradation on Card Grids

**What goes wrong:** The Deals tab shows a grid of 8-16+ deal cards. If each card is a `<GlassCard>` with `backdrop-filter: blur(12px)` via GlassPanel, the browser must composite each card separately on the GPU. On mobile (where blur is already capped at 8px), scrolling stutters. On desktop Safari, fans spin up. The existing BRAND-BIBLE.md already warns: "Max 2-3 glass layers per viewport" -- but a card grid violates this by definition.

**Why it happens:**
- GlassCard wraps GlassPanel which applies `backdrop-filter: blur()`
- Each glass element is a separate GPU compositing layer
- Card grids naturally contain 6-16+ items in view
- Ambient glows (`GradientGlow`) behind each card compound the issue
- Developers use GlassCard for everything because it looks great in isolation

**Warning Signs:**
- Page scroll feeling "heavy" or janky on grid pages
- Safari Activity Monitor showing high GPU usage
- Mobile devices getting warm on the deals page
- `will-change` properties accumulating on multiple elements
- Fan noise on MacBooks when scrolling

**Prevention:**
1. **Use GlassCard sparingly** - Only for featured/hero deal cards (top 1-3), not every card in the grid
2. **Use solid surface cards for the grid** - `bg-surface-elevated` with `border-border` -- no backdrop-filter
3. **Reserve glassmorphism for the page header/tab bar** - One glass layer per viewport section
4. **Remove `glow` prop from grid cards** - GradientGlow behind each card is expensive
5. **Test on real mobile hardware** - Not just Chrome DevTools device simulation
6. **Use the existing `.glass-base` utility** as a cheaper alternative -- it uses `rgba()` background without blur

**Phase to Address:** Phase 1 (Card component design) -- decide glass vs solid card strategy before building grid

**Confidence:** HIGH -- backed by BRAND-BIBLE.md's own "Max 2-3 glass layers" rule and documented backdrop-filter performance concerns

---

### Pitfall 3: Recharts Renders Invisible on Dark Background

**What goes wrong:** Recharts defaults assume light backgrounds: axis lines are dark gray, tick labels are `#666`, tooltip backgrounds are white, grid lines are `#ccc`. On Virtuna's `#07080a` background, the chart appears blank or shows only the data line. The earnings chart looks broken on first render.

**Why it happens:**
- Recharts v3 has no built-in dark mode
- Default stroke/fill colors assume white/light canvas
- Tooltip and legend components use their own internal defaults
- CSS-variable-based theming requires explicit prop overrides on every chart element
- v0 MCP may generate a chart with default Recharts props, assuming theme inheritance

**Warning Signs:**
- Chart area appears empty except for the data line
- Axis labels invisible (dark gray on near-black)
- Tooltip appears as a bright white box
- Grid lines invisible
- Legend text unreadable

**Prevention:**
1. **Create a Recharts theme config object** mapping Virtuna tokens to chart props:
   ```typescript
   const CHART_THEME = {
     axis: { stroke: 'var(--color-foreground-muted)' },  // gray-500
     tick: { fill: 'var(--color-foreground-secondary)' }, // gray-400
     grid: { stroke: 'rgba(255,255,255,0.06)' },         // border-glass
     tooltip: {
       bg: 'var(--color-surface-elevated)',               // #222326
       border: 'rgba(255,255,255,0.08)',                  // border
       text: 'var(--color-foreground)',                    // gray-50
     },
     cartesianGrid: { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.06)' },
   };
   ```
2. **Wrap Recharts in a themed component** - `<VirtunaChart>` that applies all dark-mode defaults
3. **Explicitly set every color prop** - Don't rely on any Recharts default
4. **Use the existing semantic colors** - `--color-success` (green) for positive earnings, `--color-accent` (coral) for main line
5. **Test tooltip rendering** specifically -- it's a separate DOM element with its own styling

**Phase to Address:** Phase 3 (Earnings tab) -- build chart wrapper before any chart component

**Confidence:** HIGH -- Recharts dark mode limitations are well-documented; the project already has Recharts v3.7.0 installed

---

### Pitfall 4: Tab Navigation Doesn't Sync with URL or Sidebar

**What goes wrong:** Three failure modes:
1. User clicks "Brand Deals" in sidebar, lands on Deals tab. Switches to Earnings tab. Clicks sidebar "Brand Deals" again -- still shows Earnings (stale tab state).
2. User shares a URL to the Earnings tab. Recipient opens it, sees Deals tab (no URL persistence).
3. User on Earnings tab hits browser back button. Expected: go to previous tab. Actual: navigates away from page entirely.

**Why it happens:**
- Radix Tabs manages state internally by default (client-side only)
- URL search params (`?tab=earnings`) require explicit sync via `useSearchParams` or `router.replace`
- The existing Settings page handles this via server-side `searchParams` prop -- but the Brand Deals page lives under a different route and the sidebar navigation uses `setActiveNav` (client-side state), not URL routing
- Next.js 16 (installed) makes `searchParams` a Promise in server components, adding complexity
- Updating search params can trigger unnecessary server component re-renders

**Warning Signs:**
- Tab state resets on sidebar re-click
- Shared URLs don't open to the expected tab
- Browser back button navigates away instead of switching tabs
- Full page flash/reload when switching tabs (server re-render triggered)

**Prevention:**
1. **Follow the Settings page pattern** - Server component reads `searchParams`, passes `defaultTab` to client component
2. **Use `router.replace` with `scroll: false`** to update URL when tab changes without full navigation
3. **Validate tab param** against allowed values (`deals`, `affiliates`, `earnings`) with fallback to `deals`
4. **Sidebar `Brand Deals` link should navigate to `/brand-deals`** (or whatever route), not just toggle `activeNav`
5. **Don't use `router.push`** for tab changes -- `replace` prevents polluting browser history with every tab switch
6. **Wrap tab content in `<Suspense>`** if searchParams changes trigger server-side work (here it won't since mock data, but defensive)

**Phase to Address:** Phase 1 (Page setup) -- establish route + tab sync pattern before building any tab content

**Confidence:** HIGH -- verified against existing Settings page pattern in codebase; Next.js 16 `searchParams` as Promise is confirmed in installed version

---

### Pitfall 5: Card Grid Heights and Content Overflow

**What goes wrong:** Deal cards have variable content: some brands have long names, some offers have 2-line descriptions, some have both "Apply" and "Claim" CTAs. In a CSS Grid, cards in the same row stretch to match the tallest card. Cards with less content have awkward empty space. Cards with more content may overflow or clip.

**Why it happens:**
- CSS Grid rows default to `stretch` alignment, matching tallest item
- Content-driven height creates visual inconsistency across rows
- Brand logos at different aspect ratios create uneven visual weight
- Payout amounts ("$500" vs "$5,000/month + 15% commission") have drastically different text lengths
- CTA buttons at different vertical positions look messy

**Warning Signs:**
- Some cards in a row have large empty bottom sections
- CTA buttons at different vertical heights across a row
- Brand logos appearing at different sizes or cropped
- Long offer descriptions pushing cards much taller than neighbors
- Grid layout looking "ragged" on certain screen widths

**Prevention:**
1. **Fix card heights with consistent structure** - Use flex column layout with spacer: header (fixed), body (flex-grow), footer (fixed CTA)
2. **Truncate offer descriptions** - 2-line max with `line-clamp-2` and "View details" expansion
3. **Standardize brand logos** - Fixed-size container (e.g., 48x48px or 64x32px) with `object-contain`
4. **Pin CTAs to card bottom** - `mt-auto` on the CTA section within a `flex flex-col` card
5. **Use `grid-template-rows: masonry` or equal-height rows** depending on design direction
6. **Test with realistic mock data** - Include edge cases: very long brand names, no brand logo, multi-line payouts

**Phase to Address:** Phase 2 (Deals tab card grid) -- define card anatomy before building variants

**Confidence:** HIGH -- standard CSS grid card layout challenge; well-documented solutions

---

## Moderate Pitfalls

Mistakes that cause delays, rework, or technical debt.

### Pitfall 6: v0 Generates Components That Duplicate Existing Primitives

**What goes wrong:** v0 generates a `<DealCard>` that reimplements glassmorphism effects inline instead of composing with `GlassCard`. Generates a `<TabBar>` instead of using the existing `Tabs`/`TabsList`/`TabsTrigger` from `@/components/ui/tabs`. Generates a custom badge instead of using `Badge`. Result: duplicate components with slightly different styling, growing maintenance burden.

**Why it happens:**
- v0 doesn't know the project's existing component inventory unless told
- AI tends to generate self-contained components rather than composing from existing ones
- Easier for v0 to create from scratch than to import and extend
- Prompts that describe desired outcome without specifying available components

**Warning Signs:**
- New components in `components/app/brand-deals/` that shadow existing UI primitives
- Multiple implementations of the same visual pattern (glassmorphic pill, card, tab)
- Import paths pointing to local inline components instead of `@/components/ui/` or `@/components/primitives/`
- Generated files containing `backdrop-filter` directly instead of using `GlassPanel`

**Prevention:**
1. **Include component inventory in v0 prompts**: "Available components: GlassCard, GlassPanel, GlassPill, Tabs/TabsList/TabsTrigger/TabsContent, Button, Badge, Icon, Text, Caption"
2. **Specify exact import paths** in prompts: "Import GlassCard from @/components/primitives"
3. **Review imports first** when evaluating v0 output -- check what it's importing before checking visuals
4. **Reject and re-prompt** rather than editing if core primitives aren't being used

**Phase to Address:** Every phase -- include component list in every v0 generation prompt

**Confidence:** HIGH -- directly observed in AI code generation workflows

---

### Pitfall 7: Copy-to-Clipboard Without Proper Feedback UX

**What goes wrong:** Affiliate link copy button copies to clipboard but provides no visual feedback, or provides feedback that's easy to miss. Users click multiple times because they don't know it worked. Alternatively, using a toast for copy feedback is overkill and creates notification noise.

**Why it happens:**
- `navigator.clipboard.writeText()` is async and silent
- The existing CopyButton in `/showcase/_components/copy-button.tsx` swaps icons (Copy -> Check) but only for 2 seconds
- Toast notifications for copy are accessible overkill -- the button itself already confirms
- Clipboard API requires HTTPS or localhost (will fail on HTTP staging environments)
- v0 may generate copy functionality without checking for existing CopyButton pattern

**Warning Signs:**
- Users repeatedly clicking copy button
- No visual change after clicking copy
- Toast appearing for every copy action (noise)
- Copy failing silently on HTTP environments
- No accessible announcement for screen readers

**Prevention:**
1. **Reuse the existing CopyButton pattern** - Icon swap (Copy -> Check) with 2-second timeout is the established project pattern
2. **Add `aria-live="polite"` region** or use `aria-label` swap: "Copy affiliate link" -> "Copied!"
3. **Inline feedback, not toast** - The button state change IS the feedback. Research confirms: "When a toast is shown after something was copied to the clipboard, the button already includes a confirmation so the toast is entirely unnecessary."
4. **Handle clipboard API failure** - Fallback to selecting text in a hidden input for older browsers
5. **Test on HTTPS** - Clipboard API requires secure context

**Phase to Address:** Phase 2 (Affiliates tab) -- decide on feedback pattern before building affiliate cards

**Confidence:** HIGH -- existing CopyButton pattern in codebase provides direct reference

---

### Pitfall 8: Sidebar Active State Doesn't Update for Brand Deals Page

**What goes wrong:** The sidebar shows "Brand Deals" as a nav item (`{ label: "Brand Deals", icon: Briefcase, id: "brand-deals" }`), but `activeNav` is managed via local `useState` in `Sidebar.tsx`, not derived from the current URL route. Navigating directly to `/brand-deals` (via URL) won't highlight the sidebar item. Clicking a sidebar item doesn't actually navigate -- it just sets `activeNav` state.

**Why it happens:**
- Sidebar navigation uses `useState("content-intelligence")` with no URL binding
- `navItems` have `id`s but no `href` links -- clicking them only changes local state
- The dashboard currently renders all content in a single page with sidebar toggling views
- Adding Brand Deals as a separate route page breaks the current sidebar navigation model
- No `usePathname()` check to derive active state from URL

**Warning Signs:**
- Sidebar "Brand Deals" not highlighted when navigating via URL
- Clicking "Brand Deals" in sidebar doesn't navigate to a new page
- Multiple sidebar items appearing active simultaneously
- Back button behavior unexpected after sidebar clicks

**Prevention:**
1. **Add `href` to navItems** - Each sidebar item needs a route: `{ label: "Brand Deals", icon: Briefcase, id: "brand-deals", href: "/brand-deals" }`
2. **Derive active state from `usePathname()`** - `const pathname = usePathname(); const isActive = pathname.startsWith(item.href)`
3. **Use `<Link>` for sidebar navigation** instead of `onClick` with `setActiveNav`
4. **Keep backward compatibility** - If other pages (Content Intelligence) still use the old toggle model, handle both patterns
5. **Coordinate with v2.1 Dashboard Rebuild** - That parallel milestone may also change sidebar routing

**Phase to Address:** Phase 1 (Page setup and routing) -- resolve sidebar navigation model before building page

**Confidence:** HIGH -- directly verified by reading sidebar.tsx source code

---

### Pitfall 9: Mock Data That Doesn't Exercise Edge Cases

**What goes wrong:** Mock data uses 5 identical deal cards with "Brand Name", "$100", "Apply" button. Everything looks perfect. Real data arrives later with: brands that have no logo, offers with 200-character descriptions, $0 payouts, expired deals, pending approval states, affiliate links with 150+ character URLs, $0.00 earnings months. UI breaks in production because mock data was too uniform.

**Why it happens:**
- Developers create "happy path" mock data
- v0 MCP generates sample data that demonstrates the concept, not edge cases
- Testing with uniform data feels complete but isn't
- Nobody thinks to test "what if the brand logo is missing?" during UI development
- Edge cases only surface when real API data arrives

**Warning Signs:**
- All mock cards have the same visual height
- All mock data has images/logos
- No empty states in the UI
- All numbers are round (100, 200, 500) with no decimals or zeros
- No "loading", "expired", "pending" states visible

**Prevention:**
1. **Design mock data with intentional edge cases**:
   - Deal with no brand logo (fallback to initials or placeholder)
   - Deal with extremely long offer text (200+ chars)
   - Deal with $0 payout (free product, not monetary)
   - Expired deal (different visual treatment)
   - Pending approval deal (disabled CTA)
   - Affiliate link with 150+ character URL (truncation in display)
   - Month with $0 earnings (chart handles zero gracefully)
   - Only 1 deal available (grid with single item)
   - 0 active affiliate links (empty state)
2. **Create a mock data generator** - TypeScript factory with randomized edge cases
3. **Include empty states in design** - "No deals available", "No affiliate links yet", "No earnings data"
4. **Add TypeScript interfaces for data shapes first** - Forces thinking about optional fields, nullable values

**Phase to Address:** Phase 1 (Data types and mock setup) -- define interfaces with optional/nullable fields before any UI

**Confidence:** HIGH -- universal UI development pitfall, amplified by mock-data-only milestone

---

### Pitfall 10: Color Semantic Misuse in Deals/Affiliates Context

**What goes wrong:** Per BRAND-BIBLE.md, each feature section gets ONE accent color with semantic meaning (purple = AI, blue = data, green = growth, orange = content creation). Brand Deals doesn't clearly map to one existing semantic color. Developer picks `green` because "money = green" but then earnings positive change indicators also use green, creating ambiguity. Or uses `orange` (the brand coral) for everything, losing the accent-for-emphasis principle.

**Why it happens:**
- Brand Deals spans multiple semantics: deals (offers), affiliates (links), earnings (money)
- The BRAND-BIBLE.md color semantic system was designed for feature sections, not multi-tab pages
- "Green for positive" conflicts with "green as section accent"
- v0 MCP may assign random colors without understanding the semantic system
- Coral/orange as primary CTA color can conflict with orange as section accent

**Warning Signs:**
- Multiple accent colors used on the same tab
- Green used for both "earnings section" AND "+15% growth" indicator
- Coral buttons competing visually with orange section glow
- Charts using random colors unrelated to token system
- Cards with different tint colors in the same grid (visual chaos)

**Prevention:**
1. **Assign one accent color per tab**, not per page:
   - Deals tab: `orange` (brand offers, content creation)
   - Affiliates tab: `cyan` (performance, links/tracking)
   - Earnings tab: `green` (growth, money)
2. **Use neutral (untinted) GlassCards for the grid** - Color only on the tab header/accent elements
3. **Reserve coral for CTAs only** - Primary buttons (Apply, Generate Link) use coral; section accents use assigned gradient color
4. **Positive/negative indicators** use `--color-success` / `--color-error` regardless of tab accent color
5. **Document the color mapping** in the component file header comment

**Phase to Address:** Phase 1 (Design decisions) -- agree on color mapping before v0 generates any components

**Confidence:** HIGH -- BRAND-BIBLE.md Section 2 explicitly defines this system

---

## Minor Pitfalls

Mistakes that cause polish issues or minor rework.

### Pitfall 11: Icon Weight Inconsistency Across Generated Components

**What goes wrong:** Virtuna uses Phosphor Icons with specific weight rules (regular for most UI, fill for active states, bold for emphasis). v0 may generate components with Lucide icons (already partially used in codebase -- `lucide-react` is installed alongside `@phosphor-icons/react`) or use inconsistent Phosphor weights. Result: some icons are `thin`, others `fill`, others `regular` on the same page.

**Prevention:**
1. **Specify in v0 prompts**: "Use @phosphor-icons/react, weight='regular' for default, weight='fill' for active states"
2. **Audit generated imports** - Reject `lucide-react` imports in new brand-deals components
3. **Standardize icon size** per BRAND-BIBLE.md: 20px for standard UI, 24px for navigation, 16px inline

**Phase to Address:** All phases -- include icon rules in every v0 prompt

**Confidence:** HIGH -- both icon libraries exist in `package.json`, creating ambiguity

---

### Pitfall 12: Missing Loading/Skeleton States for Tab Content

**What goes wrong:** Switching between Deals/Affiliates/Earnings tabs shows empty content flash before data "loads" (even with mock data, simulated loading states are important for UI-readiness). When real data replaces mock data later, there's no skeleton state to show during fetch.

**Prevention:**
1. **Build skeleton variants for each tab** - Card grid skeleton, chart skeleton, stat card skeleton
2. **Use the existing `Skeleton` component** from `@/components/ui/skeleton.tsx`
3. **Design the empty-to-loaded transition** now, even with instant mock data
4. **Add artificial delay option** in mock data for testing loading states

**Phase to Address:** Phase 3 (Polish) -- add skeleton states after primary UI is built

**Confidence:** MEDIUM -- important for production readiness but not blocking for mock-data milestone

---

### Pitfall 13: Earnings Chart Tooltip Clipping at Container Edge

**What goes wrong:** Recharts tooltips are absolutely positioned. When hovering data points near the left or right edge of the chart container, the tooltip clips outside the visible area or gets cut off by `overflow: hidden` on a parent GlassPanel/card.

**Prevention:**
1. **Add padding to chart container** - Minimum 16px on each side
2. **Don't set `overflow: hidden` on the chart's parent** GlassPanel
3. **Use Recharts `wrapperStyle` on Tooltip** to constrain position
4. **Test tooltip at first and last data points** specifically
5. **Consider using `position="top"` or a custom tooltip** that's portal-mounted

**Phase to Address:** Phase 3 (Earnings chart) -- test edge tooltip positions

**Confidence:** MEDIUM -- common Recharts issue but straightforward to fix

---

### Pitfall 14: Font Inconsistency in v0 Output

**What goes wrong:** v0 generates headings with default `font-bold` but without `font-display` (Funnel Display). Body text renders in the browser default or Inter instead of Satoshi. The layout.tsx already sets `--font-satoshi` and `--font-funnel-display` variables and the global CSS applies `font-display` to h1/h2 -- but v0-generated h3/h4 or custom heading elements won't inherit this.

**Prevention:**
1. **Tell v0 about font classes** in prompts: "Headings use `font-display` (Funnel Display), body uses `font-sans` (Satoshi)"
2. **Apply `font-display` class explicitly** to any h1/h2 that isn't a raw `<h1>`/`<h2>` (since only those inherit from globals.css)
3. **Review generated typography** - Check that section headers use the display font

**Phase to Address:** All phases -- include typography rules in v0 prompt template

**Confidence:** HIGH -- globals.css only targets `h1, h2` with `@apply font-display`

---

## v0 MCP Prompt Anti-Patterns

Common prompt mistakes that lead to poor v0 output for this project.

### Anti-Pattern 1: Vague Design References

**Bad:** "Create a deals page that looks like our design system"
**Good:** "Create a deals grid using GlassCard from @/components/primitives with color='orange', padding='md', hover='lift'. Use Button from @/components/ui/button with variant='primary' for CTAs. Background is bg-background (#07080a). Cards use bg-surface-elevated border-border."

### Anti-Pattern 2: Missing Token Context

**Bad:** "Use dark colors for the background"
**Good:** "Background: bg-background (--color-background: #07080a). Surface: bg-surface (#18191c). Elevated: bg-surface-elevated (#222326). Text: text-foreground (#FAFAFA). Secondary text: text-foreground-secondary (#9c9c9d). Muted: text-foreground-muted (#848586). Borders: border-border (rgba(255,255,255,0.08))."

### Anti-Pattern 3: Not Specifying Existing Components

**Bad:** "Create tabs for Deals, Affiliates, Earnings"
**Good:** "Use Tabs, TabsList, TabsTrigger, TabsContent from @/components/ui/tabs (Radix-based, glass pill styling already implemented). TabsTrigger supports size='md'. TabsList is inline-flex rounded-full with bg-surface-elevated."

### Anti-Pattern 4: Omitting State/Interaction Specs

**Bad:** "Add a copy button for affiliate links"
**Good:** "Copy button pattern: useState for copied state, swap between Copy and Check icons from @phosphor-icons/react, 2-second timeout, aria-label switches from 'Copy affiliate link' to 'Copied!'. Reference existing pattern in src/app/(marketing)/showcase/_components/copy-button.tsx"

---

## Phase-Specific Warning Summary

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|----------------|------------|
| 1 - Setup | Page routing | Sidebar nav doesn't route to new page (#8) | Add href to navItems, derive active from usePathname |
| 1 - Setup | Tab sync | Tabs don't sync with URL (#4) | Follow Settings page searchParams pattern |
| 1 - Setup | Color mapping | No agreed accent per tab (#10) | Document color assignments before generating |
| 1 - Setup | Data types | Mock data too uniform (#9) | Define TS interfaces with optional/nullable fields |
| 2 - Deals tab | Card grid | Inconsistent heights (#5) | Flex column with pinned CTA, line-clamp |
| 2 - Deals tab | Glassmorphism | Too many glass cards (#2) | Use solid surface cards, glass only for hero |
| 2 - Deals tab | v0 output | Wrong tokens/components (#1, #6) | Token checklist, specify imports in prompt |
| 2 - Affiliates tab | Copy UX | Missing/noisy feedback (#7) | Reuse CopyButton pattern, no toast |
| 2 - Affiliates tab | v0 output | Icon weight mismatch (#11) | Specify Phosphor icons in prompt |
| 3 - Earnings tab | Chart theming | Invisible on dark bg (#3) | Create Recharts theme config with tokens |
| 3 - Earnings tab | Tooltip | Clips at edges (#13) | Padding, no overflow:hidden on parent |
| 3 - Polish | Loading states | No skeletons (#12) | Build skeleton variants per tab |
| 3 - Polish | Typography | Wrong fonts (#14) | Explicit font-display on headings |
| All | v0 generation | Design drift (#1) | Include full token table in every prompt |

---

## Pre-Generation Checklist

Before every v0 MCP prompt for this milestone:

- [ ] Included BRAND-BIBLE.md (or key sections) as context
- [ ] Listed available components with import paths
- [ ] Specified exact design tokens (backgrounds, text, borders)
- [ ] Named accent color for this section
- [ ] Specified icon library (Phosphor) and weight
- [ ] Specified font families (Funnel Display for headings, Satoshi for body)
- [ ] Described interaction states (hover, active, disabled, loading)
- [ ] Included edge case data examples
- [ ] Specified existing patterns to follow (CopyButton, Settings tabs)

## Post-Generation Checklist

After every v0 MCP output:

- [ ] No `zinc-` or default Tailwind color classes -- all mapped to Virtuna tokens
- [ ] Imports from `@/components/primitives` and `@/components/ui/` -- not inline reimplementations
- [ ] Uses `@phosphor-icons/react` not `lucide-react`
- [ ] Headings use `font-display` class
- [ ] Body text uses `font-sans` (inherited, but verify)
- [ ] Border radius matches token system (rounded-lg = 12px, rounded-md = 8px)
- [ ] Shadow values match `--shadow-*` tokens
- [ ] Spacing follows 4px base unit
- [ ] No more than 2-3 backdrop-filter elements per viewport
- [ ] All interactive elements have hover/focus states

---

## Research Gaps / Open Questions

1. **Sidebar routing model** - The v2.1 Dashboard Rebuild (parallel milestone) may also change how sidebar navigation works. Coordinate to avoid conflicting patterns.

2. **Recharts v3 CSS variable support** - Recharts v3 may have improved dark mode support since last checked. Worth verifying current API before building chart wrapper.

3. **v0 MCP current capabilities** - v0's ability to consume custom design tokens may have improved. Test with a small component first to calibrate prompt strategy.

4. **ToastProvider availability** - The AppShell doesn't appear to wrap children in ToastProvider. If copy-to-clipboard feedback uses toast (not recommended, but possible), ToastProvider must be added to the app layout.

---

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| v0 Design System Drift | HIGH | Universal AI code generation challenge, verified against codebase tokens |
| Glassmorphism Performance | HIGH | BRAND-BIBLE.md explicitly warns about this, browser behavior documented |
| Recharts Dark Mode | HIGH | Recharts docs confirm no built-in dark mode; project uses v3.7.0 |
| Tab/URL Sync | HIGH | Verified against Settings page pattern and sidebar.tsx source |
| Card Grid Heights | HIGH | Standard CSS Grid challenge, well-documented solutions |
| Sidebar Routing | HIGH | Directly verified by reading sidebar.tsx -- uses useState, no routing |
| Copy-to-Clipboard UX | HIGH | Existing CopyButton pattern in codebase provides reference |
| Mock Data Edge Cases | HIGH | Universal UI dev pitfall |
| Color Semantics | HIGH | BRAND-BIBLE.md Section 2 defines the system explicitly |
| Font Consistency | HIGH | globals.css only targets h1/h2 for font-display |

---

## Sources

### Project Sources (Primary)
- BRAND-BIBLE.md -- Virtuna design system rules, color semantics, glassmorphism limits
- `src/app/globals.css` -- Actual token definitions (@theme block)
- `src/components/primitives/GlassCard.tsx` -- GlassCard API surface
- `src/components/ui/tabs.tsx` -- Existing Radix Tabs implementation
- `src/components/ui/toast.tsx` -- ToastProvider pattern
- `src/components/app/sidebar.tsx` -- Sidebar navigation model (useState, no routing)
- `src/app/(app)/settings/page.tsx` -- Tab + searchParams pattern
- `src/app/(marketing)/showcase/_components/copy-button.tsx` -- Copy-to-clipboard pattern
- `package.json` -- Confirmed dependencies: Recharts 3.7.0, Next.js 16.1.5, Radix Tabs

### Design System + AI Generation
- [AI Design System with MCP](https://medium.com/design-bootcamp/how-to-build-an-ai-design-system-6d80d7aa200d)
- [Design Systems and AI: Why MCP Servers Are The Unlock (Figma)](https://www.figma.com/blog/design-systems-ai-mcp/)
- [Can AI Keep Low-Code Tools From Breaking Design Consistency?](https://arbisoft.com/blogs/can-ai-keep-low-code-tools-from-breaking-design-consistency)
- [AI-Powered Prototyping with Design Systems (Vercel)](https://vercel.com/blog/ai-powered-prototyping-with-design-systems)

### Next.js Tabs / URL Sync
- [Next.js useSearchParams](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [Shallow routing searchParams issue](https://github.com/vercel/next.js/discussions/49540)
- [Next.js searchParams sync params](https://nextjs.org/docs/messages/next-prerender-sync-params)

### Recharts Dark Mode
- [Recharts with Reshaped (Dark Theming)](https://www.reshaped.so/docs/getting-started/guidelines/recharts)
- [shadcn/ui Chart (Recharts Dark Mode)](https://ui.shadcn.com/docs/components/chart)
- [Polished Dashboards with Recharts](https://www.amolsidhu.com/blog/frontend-charts)

### Card Grid / CSS Grid
- [Auto-Sizing Columns: auto-fill vs auto-fit (CSS-Tricks)](https://css-tricks.com/auto-sizing-columns-css-grid-auto-fill-vs-auto-fit/)
- [CSS Grid Auto Height Rows](https://www.codegenes.net/blog/css-grid-auto-height-rows-sizing-to-content/)

### Glassmorphism Performance
- [Dark Glassmorphism (Medium)](https://medium.com/@developer_89726/dark-glassmorphism-the-aesthetic-that-will-define-ui-in-2026-93aa4153088f)
- [12 Glassmorphism UI Features and Best Practices](https://uxpilot.ai/blogs/glassmorphism-ui)

### Copy-to-Clipboard UX
- [Replacing Toasts with Accessible Feedback Patterns](https://dev.to/miasalazar/replacing-toasts-with-accessible-user-feedback-patterns-1p8l)
- [Toasts are Bad UX](https://maxschmitt.me/posts/toasts-bad-ux)

### Dashboard Design
- [Dashboard Design Principles (DesignRush)](https://www.designrush.com/agency/ui-ux-design/dashboard/trends/dashboard-design-principles)
- [Dashboard Design Principles (UXPin)](https://www.uxpin.com/studio/blog/dashboard-design-principles/)
