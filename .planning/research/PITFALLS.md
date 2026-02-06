# Domain Pitfalls: Landing Page Redesign

**Domain:** Raycast-style dark SaaS landing page with v0 generation workflow
**Researched:** 2026-02-06
**Project:** Virtuna v3.1 Landing Page

---

## Critical Pitfalls

Mistakes that cause rewrites, broken production builds, or fundamental UX failures.

---

### CRIT-1: v0 Generated Code Ignores Existing Design System Tokens

**What goes wrong:** v0 generates sections using its default shadcn/ui palette (`--background`, `--foreground`, `--primary`, etc.) and Tailwind v3/v4 default utilities. The generated code does NOT use Virtuna's semantic tokens (`--color-accent`, `--color-surface-elevated`, `--color-foreground-muted`, `--color-border`, etc.), its custom font families (`font-display`, `font-sans`), its shadow scale (`shadow-button`, `shadow-glass`), or its radius scale (`radius-lg`, `radius-md`). You paste in a hero section and get `bg-slate-900 text-white` instead of `bg-background text-foreground`. Every section needs a manual token replacement pass.

**Why it happens:** v0 is trained on default shadcn/ui and standard Tailwind classes. Even with a custom design system uploaded, v0 struggles with customizations and may fall back to defaults. The Virtuna token layer (primitive + semantic in `globals.css`) is non-standard enough that v0 will not reproduce it.

**Consequences:**
- Visual inconsistency between v0-generated sections and existing components (feature cards, buttons, header)
- Hardcoded color values scattered across sections instead of centralized tokens
- Breaks dark theme cohesion -- some sections will look "off" with wrong grays/opacities
- The `border-white/10` in existing `FeatureCard` vs v0's `border-gray-800` creates visible mismatch

**Warning signs:**
- Seeing `bg-gray-*`, `text-gray-*`, `border-gray-*` in generated code (Virtuna uses `white/[0.06]` borders and custom gray scale)
- Seeing `rounded-lg` without awareness that Virtuna's `radius-lg` = 12px
- Font classes like `font-bold` instead of `font-[350]` (Virtuna uses non-standard weights)
- Missing `font-display` on headings, missing `font-sans` on body text

**Prevention:**
1. Create a "v0 migration checklist" before any section integration:
   - Replace all color classes with semantic tokens
   - Replace font classes with `font-display`/`font-sans`
   - Replace border classes with `border-white/[0.06]` pattern
   - Replace shadows with design system shadows
   - Replace radius with `rounded-lg` (12px cards), `rounded-md` (8px inputs)
2. After each v0 generation, diff against existing `FeatureCard`/`HeroSection` to confirm visual language matches
3. Consider providing v0 with a prompt prefix containing the token map
4. Keep the existing `cn()` utility and `tailwind-merge` for class composition

**Phase to address:** Every phase that generates a new section. Build the migration checklist in Phase 1 (scaffold) and enforce it as a gate for each section integration.

**Confidence:** HIGH -- observed directly in codebase analysis. v0 docs confirm custom design systems are partially supported at best.

---

### CRIT-2: Tailwind v4 Lightning CSS Strips `backdrop-filter` from CSS Classes

**What goes wrong:** Any `backdrop-filter: blur()` or `-webkit-backdrop-filter: blur()` declared in CSS classes (including the `.glass-blur-*` utilities already in `globals.css`) is silently stripped by Lightning CSS during the Tailwind v4 build. The compiled CSS output contains empty rule blocks. Glass/blur effects appear to work in dev (browser reads source CSS), then vanish in production builds.

**Why it happens:** Tailwind v4 replaced PostCSS with Lightning CSS as its build engine. Lightning CSS has an optimization pass that strips certain vendor-prefixed or non-standard properties it considers redundant. `backdrop-filter` gets caught in this stripping behavior.

**Consequences:**
- Glass panels, navbar blur, section overlays all render as flat opaque backgrounds in production
- The entire Raycast aesthetic depends on glass effects -- losing blur destroys the premium feel
- Debugging is frustrating because dev mode works fine (browser reads raw CSS)
- This is ALREADY a known issue in this project (documented in MEMORY.md)

**Warning signs:**
- Elements with `.glass-blur-*` classes have no visible blur in production
- Inspecting compiled CSS shows empty rule blocks where blur should be
- "It works in dev but not in production" for any blur/glass effect

**Prevention:**
1. NEVER use CSS classes for `backdrop-filter`. Always apply via React inline styles:
   ```tsx
   style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
   ```
2. Wrap the pattern in a reusable component or utility function:
   ```tsx
   function glassStyle(blur: number) {
     return { backdropFilter: `blur(${blur}px)`, WebkitBackdropFilter: `blur(${blur}px)` };
   }
   ```
3. v0 generated code WILL use Tailwind's `backdrop-blur-*` utility classes -- these MUST be replaced with inline styles during integration
4. Test production builds (`next build && next start`) for every section that uses blur, not just dev mode

**Phase to address:** Establish the inline-style glass pattern in Phase 1 (scaffold). Every subsequent section phase must use it. Add a production build verification step at the end of each section phase.

**Confidence:** HIGH -- documented from direct experience in this project (MEMORY.md), confirmed by Tailwind v4 architecture.

---

### CRIT-3: Every Landing Section Marked `"use client"` Destroys SEO and Bundle Size

**What goes wrong:** All existing landing components (`HeroSection`, `FeaturesSection`, `StatsSection`, `BackersSection`, etc.) are marked `"use client"`. v0-generated sections will also default to `"use client"` because they include animation or minor interactivity. This means the ENTIRE landing page is client-rendered: zero server-rendered HTML for crawlers, full Framer Motion + React bundle shipped to every visitor, no SSG/ISR benefits.

**Why it happens:**
- Framer Motion's `motion.*` components and hooks (`useReducedMotion`, `useInView`) require client context
- `FadeIn` wrapper is `"use client"` and wraps nearly everything
- Developers default to `"use client"` at the section level instead of isolating interactive leaves
- v0 generates `"use client"` by default for any component with state or effects

**Consequences:**
- Google sees empty `<div>` tags instead of semantic content when JavaScript is disabled or slow to load
- First Contentful Paint (FCP) delayed because entire page waits for React hydration
- Bundle includes all of Framer Motion (~40KB gzipped) plus component code for every section
- Missing structured data and server-rendered metadata hurts SEO rankings
- CLS increases because layout shifts during hydration

**Warning signs:**
- `view-source:` on the landing page shows empty `<main>` with no text content
- Lighthouse SEO score below 90
- Large JS bundle (>200KB) on landing page
- All section files start with `"use client"`

**Prevention:**
1. Keep section text content in Server Components. Only wrap animated elements in a thin client `FadeIn` boundary:
   ```tsx
   // server component (NO "use client")
   export function FeaturesSection() {
     return (
       <section>
         <h2>Research that was impossible is now instant</h2>
         <p>Access high-value audiences...</p>
         <AnimatedFeatureGrid features={features} /> {/* client boundary */}
       </section>
     );
   }
   ```
2. Move `"use client"` to the leaf-level animation wrappers, not the section level
3. Use CSS animations (via `@keyframes` already in `globals.css`) for simple fade-in effects instead of Framer Motion where possible
4. The marketing layout already correctly uses `generateMetadata` -- ensure sections don't break this by wrapping the entire page in client boundaries

**Phase to address:** Phase 1 (scaffold) must establish the server/client component boundary pattern. Each section phase must follow it. Final polish phase must audit with `view-source:` and Lighthouse.

**Confidence:** HIGH -- verified by reading every existing landing component (all have `"use client"` at top).

---

### CRIT-4: Glass/Blur Effects Destroy Mobile Performance

**What goes wrong:** `backdrop-filter: blur()` is GPU-intensive. A landing page with 6-8 sections each containing glass panels, blurred backgrounds, and glow effects causes visible jank, battery drain, and dropped frames on mobile devices -- especially mid-range Android phones and older iPhones.

**Why it happens:**
- Each `backdrop-filter` creates a new compositor layer
- Blur radius > 12px is expensive; the existing code goes up to `blur(48px)` (`.glass-blur-2xl`)
- Multiple overlapping blur layers compound the GPU cost
- Scroll-triggered animations running simultaneously with blur compositing creates frame drops
- iOS Safari has known bugs with nested `backdrop-filter` elements

**Consequences:**
- Sub-60fps scrolling on mobile (perceived as laggy/janky)
- Battery drain complaints from users
- iOS Safari rendering glitches (blank areas, flickering)
- CLS increases as GPU-composited layers shift during load

**Warning signs:**
- Chrome DevTools > Performance tab shows long composite times
- Mobile Lighthouse performance score below 70
- Visual glitches on iOS Safari (white flash, element disappearing)
- Fan/heat on mobile devices during scroll

**Prevention:**
1. The codebase already has mobile blur reduction (lines 390-398 in `globals.css` cap blur at 8px for `max-width: 768px`) -- ensure v0-generated sections use `.glass-blur-*` classes (via inline style equivalent) so this media query applies
2. Limit glass effects to max 3-4 elements visible simultaneously (navbar + 1-2 section accents)
3. Use `will-change: transform` on blurred elements to hint GPU layer creation ahead of time
4. Prefer `background: rgba()` with slight opacity over `backdrop-filter` for decorative elements that don't truly need blur-through transparency
5. Test on real mid-range Android device (not just Chrome DevTools throttling)
6. For glow effects (`.animate-glow-*`), use `transform: translateZ(0)` to force GPU acceleration

**Phase to address:** Establish performance budget in Phase 1. Test on real mobile after each section phase. Final performance audit in polish phase.

**Confidence:** HIGH -- confirmed by existing mobile blur media query (project already encountered this), corroborated by Safari/shadcn-ui GitHub issues.

---

## Moderate Pitfalls

Mistakes that cause delays, rework, or technical debt.

---

### MOD-1: v0 Generates Duplicate Component Abstractions

**What goes wrong:** v0 generates each section as a self-contained unit with its own inline button styles, card patterns, badge components, etc. When you have 7+ sections, you end up with 7 different button implementations, 4 different card borders, 3 different heading size scales -- all slightly different from each other AND from the existing `Button`, `Card`, `Badge` components in `src/components/ui/`.

**Why it happens:** v0 generates in isolation. Each prompt produces a standalone section unaware of what was generated before. Even with design system context, v0 tends to inline styles rather than reference shared components.

**Prevention:**
1. After generating each section, immediately replace inline UI elements with existing components:
   - Buttons -> `<Button variant="primary">` / `<Button variant="secondary">`
   - Cards -> use `border-white/[0.06]` + `rounded-lg` pattern from `FeatureCard`
   - Badges -> `<Badge>` from `src/components/ui/badge.tsx`
2. Create a "component mapping" reference before starting v0 generation that maps common patterns to existing components
3. Never accept v0 output as-is. Treat it as a layout/structure scaffold, not finished code

**Phase to address:** Every section integration phase. The v0 migration checklist from CRIT-1 should include a component deduplication step.

**Confidence:** HIGH -- this is a universal v0 workflow issue confirmed by Vercel community discussions.

---

### MOD-2: Inconsistent Section Spacing and Max-Width

**What goes wrong:** When sections are generated independently, each gets its own `max-w-*`, `px-*`, and `py-*` values. The page ends up with jarring jumps in content width and uneven vertical rhythm between sections.

**Why it happens:** v0 defaults to various container widths (`max-w-7xl`, `max-w-6xl`, `max-w-5xl`) depending on the prompt. The existing codebase uses `max-w-6xl mx-auto px-6` consistently (confirmed in `FeaturesSection`, `StatsSection`, `BackersSection`).

**Prevention:**
1. Enforce a single container pattern: `max-w-6xl mx-auto px-6`
2. Standardize vertical section padding: `py-24` (confirmed as the existing pattern)
3. Create a `SectionWrapper` component that enforces these constraints:
   ```tsx
   function SectionWrapper({ children, className }) {
     return (
       <section className={cn("py-24", className)}>
         <div className="mx-auto max-w-6xl px-6">{children}</div>
       </section>
     );
   }
   ```
4. Add this to the v0 migration checklist: verify container matches standard pattern

**Phase to address:** Phase 1 (scaffold) should extract the `SectionWrapper` if it doesn't exist. Every section phase uses it.

**Confidence:** HIGH -- verified from existing section code patterns.

---

### MOD-3: Hydration Mismatches from Scroll-Based Animations

**What goes wrong:** Framer Motion's `whileInView`, `useScroll`, and `useMotionValueEvent` hooks produce different initial states on server vs client. The server renders elements at their "hidden" state (opacity: 0, y: 20), but the client immediately calculates viewport intersection and may show a different state, causing React hydration errors.

**Why it happens:**
- `IntersectionObserver` (used by `whileInView`) doesn't exist on the server
- `window.scrollY` doesn't exist on the server
- Chrome extensions can modify DOM before React hydrates (documented in MEMORY.md)
- Initial animation state on server may differ from client if element is already in viewport on load

**Prevention:**
1. The existing `FadeIn` component handles this correctly with `initial="hidden"` + `whileInView="visible"` + `viewport={{ once: true }}` -- reuse this pattern, don't reinvent
2. For new scroll-based effects (parallax, scroll-linked transforms), wrap in a client component and use `useEffect` to initialize after mount:
   ```tsx
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   if (!mounted) return <StaticFallback />;
   ```
3. Never use `useScroll` or `useMotionValue` in the initial render of a server component tree
4. Test with `next build && next start` (not just `next dev`) to catch SSR mismatches

**Phase to address:** Any phase introducing scroll-linked animations (parallax hero, sticky sections, scroll progress indicators).

**Confidence:** HIGH -- confirmed by existing `FadeIn` pattern (project already solved basic case), Next.js GitHub issues document the broader problem.

---

### MOD-4: CTA Hierarchy Collapse Across Multiple Sections

**What goes wrong:** Each v0-generated section includes its own CTA button. After assembling 7 sections, the page has 7+ CTAs all competing for attention, with no clear hierarchy. The primary action ("Book a Meeting" / "Get in touch") gets lost in a sea of "Learn more", "See how", "Start now" buttons.

**Why it happens:** v0 generates sections as standalone marketing blocks, each with its own conversion goal. When assembled sequentially, there's no page-level CTA strategy.

**Prevention:**
1. Define CTA hierarchy before generation:
   - **Primary CTA** (coral accent, `variant="primary"`): Max 2 per page (hero + final section)
   - **Secondary CTA** (`variant="secondary"`): Supporting actions in feature/stats sections
   - **Text links**: In-content navigation ("Read the report", "See case study")
2. Strip excess CTAs during integration -- most mid-page sections need a text link, not a button
3. The existing page has "Get in touch" as primary (hero) and "Book a Meeting" (header) -- maintain this focus

**Phase to address:** Section integration phases. Establish CTA hierarchy document during Phase 1.

**Confidence:** MEDIUM -- based on SaaS landing page best practices research, not direct codebase observation.

---

### MOD-5: Contrast Failures on Glass Surfaces

**What goes wrong:** Text placed on glass/semi-transparent backgrounds fails WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text). Glass panels with `rgba(28, 29, 33, 0.65)` background (`.glass-base`) can drop below contrast when the blurred content behind them is light-colored or varies across the page.

**Why it happens:**
- Glass transparency means the effective background color depends on what's behind it
- Dark theme gives false confidence ("white on dark is always high contrast")
- The `text-foreground-muted` token (`--color-gray-500: #848586`) is already at the edge of WCAG AA on `#07080a` (5.4:1 contrast) -- on glass it drops below
- v0 often generates `text-white/60` or `text-gray-400` which fail on transparent backgrounds

**Prevention:**
1. On glass surfaces, use `text-white` or `text-foreground` (gray-50) for body text, never `text-foreground-muted`
2. For glass panel backgrounds, ensure minimum opacity of 70% (`rgba(x, y, z, 0.7)` or higher)
3. Add a subtle solid fallback: `background-color` + `backdrop-filter` so there's a guaranteed minimum contrast even without blur
4. Use the `wcag-contrast` dev dependency already in the project to verify ratios during development
5. Test on external monitor with different calibration -- OLED vs LCD shows glass differently

**Phase to address:** Every section that uses glass surfaces. Final polish phase should run a full contrast audit.

**Confidence:** HIGH -- the project already has `wcag-contrast` as a dev dependency, confirming this is a known concern.

---

### MOD-6: Spline/Three.js 3D Elements Bloat Initial Bundle

**What goes wrong:** The project includes `@splinetool/react-spline`, `@react-three/fiber`, `@react-three/drei`, and `three` in dependencies. If any landing page section imports a 3D visualization, Three.js (~600KB minified) gets included in the landing page bundle, destroying load times.

**Why it happens:** v0 or developers might add a 3D hero animation, interactive product demo, or the existing `GlassOrb` visualization to landing sections. These imports are heavy.

**Prevention:**
1. NEVER import Three.js/Spline directly in landing page sections
2. If 3D is needed on landing, use `next/dynamic` with `ssr: false` and a loading skeleton:
   ```tsx
   const HeroVisualization = dynamic(
     () => import('@/components/visualization/GlassOrb'),
     { ssr: false, loading: () => <div className="h-[400px] bg-surface animate-pulse" /> }
   );
   ```
3. Prefer CSS/SVG animations over 3D for landing page decorative elements
4. Check bundle size with `next build` -- Three.js inclusion will show as a ~600KB chunk

**Phase to address:** Phase 1 (scaffold) should establish the dynamic import pattern. Hero and any visualization section phases must use it.

**Confidence:** HIGH -- Three.js is confirmed in `package.json`, `GlassOrb` component exists in the codebase.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without major rework.

---

### MIN-1: Missing `priority` on Hero Image Causes LCP Delay

**What goes wrong:** The hero section's main visual (currently `network-visualization.svg`) is the Largest Contentful Paint (LCP) element. If `priority` is missing from the `<Image>` component, Next.js lazy-loads it, causing a 200-500ms LCP delay.

**Why it happens:** Next.js `<Image>` defaults to lazy loading. Developers forget to add `priority` on above-the-fold images.

**Prevention:**
1. The existing `HeroSection` already has `priority` on the hero image (line 58) -- maintain this in the redesign
2. For any new hero visual (video, animation, large graphic), ensure it loads immediately
3. Only ONE image on the page should have `priority` -- the hero LCP element

**Phase to address:** Hero section phase.

**Confidence:** HIGH -- verified in existing code.

---

### MIN-2: Font Loading Flash (FOIT/FOUT) on Custom Fonts

**What goes wrong:** The page uses two custom fonts: Satoshi (local woff2) and Funnel Display (Google Fonts). If fonts load slowly, text either flashes from fallback to custom font (FOUT) or is invisible until loaded (FOIT).

**Why it happens:** Both fonts use `display: "swap"` which causes FOUT. Satoshi is self-hosted (fast) but Funnel Display loads from Google Fonts (slower).

**Prevention:**
1. `display: "swap"` is already set (correct) -- this prevents invisible text
2. Funnel Display is already loaded via `next/font/google` which automatically self-hosts via Next.js -- no external request needed
3. If adding new fonts from v0 output (v0 often generates with `inter` or `geist`), replace with `font-sans`/`font-display` classes
4. Preload critical fonts in the layout head if needed

**Phase to address:** Phase 1 (scaffold) -- ensure font configuration carries over correctly.

**Confidence:** HIGH -- verified in layout code.

---

### MIN-3: v0 Uses Lucide Icons Instead of Phosphor Icons

**What goes wrong:** v0 generates sections using Lucide React icons. The existing codebase uses `@phosphor-icons/react` for all icons, plus `lucide-react` only for the `Loader2` spinner in `Button`. Mixing icon libraries creates visual inconsistency (different stroke weights, sizes, visual language).

**Why it happens:** v0 defaults to Lucide because it ships with shadcn/ui. The project uses Phosphor for its broader icon set and `weight="light"` aesthetic.

**Prevention:**
1. After v0 generation, replace all Lucide imports with Phosphor equivalents:
   - `<ArrowRight>` (Lucide) -> `<ArrowRight weight="light">` (Phosphor)
   - `<Check>` (Lucide) -> `<Check weight="light">` (Phosphor)
2. Maintain `weight="light"` across all Phosphor icon usage (established pattern in `FeaturesSection`)
3. Icon size standard: 28px for feature cards, 16-20px for inline elements (from existing code)
4. Add to v0 migration checklist: "Replace all Lucide icons with Phosphor"

**Phase to address:** Every section integration phase.

**Confidence:** HIGH -- both icon libraries confirmed in `package.json`.

---

### MIN-4: Missing Structured Data and Social Metadata

**What goes wrong:** The landing page has basic `<title>` and `<meta description>` but lacks Open Graph images, Twitter cards, JSON-LD schema markup, and canonical URL. Social shares show generic previews instead of branded cards.

**Why it happens:** Developers focus on visual design and forget metadata. v0 does not generate metadata.

**Prevention:**
1. In the marketing layout, expand the metadata export:
   ```tsx
   export const metadata: Metadata = {
     title: "Artificial Societies | Human Behavior, Simulated",
     description: "...",
     openGraph: {
       title: "...",
       description: "...",
       images: [{ url: "/og-image.png", width: 1200, height: 630 }],
       type: "website",
     },
     twitter: {
       card: "summary_large_image",
       title: "...",
       description: "...",
       images: ["/og-image.png"],
     },
   };
   ```
2. Create an OG image (1200x630px) matching the dark theme
3. Add JSON-LD for Organization schema:
   ```tsx
   <script type="application/ld+json" dangerouslySetInnerHTML={{
     __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", ... })
   }} />
   ```

**Phase to address:** Final polish phase or dedicated SEO phase.

**Confidence:** HIGH -- verified that current metadata is minimal in marketing layout.

---

### MIN-5: Dev Server CSS Cache Creates Ghost Bugs

**What goes wrong:** After changing Tailwind tokens, glass styles, or CSS variables, the dev server continues showing old styles. Developers think their changes aren't working and add hacky overrides.

**Why it happens:** Next.js dev server + Tailwind v4 + browser cache triple-cache CSS aggressively. Old compiled CSS persists in `.next/` and `node_modules/.cache/`.

**Prevention:**
1. When CSS changes don't appear: kill dev server, delete `.next/`, clear browser cache, restart
2. This is documented in MEMORY.md -- all team members should know this workflow
3. Consider adding a `clean` script: `"clean": "rm -rf .next node_modules/.cache"`

**Phase to address:** Note in project README/contributing docs. Not phase-specific.

**Confidence:** HIGH -- documented from direct experience (MEMORY.md).

---

### MIN-6: `overflow-x: hidden` on Body Breaks Sticky Navigation

**What goes wrong:** The existing `globals.css` sets `overflow-x: hidden` on `html, body` (line 407). This can interfere with `position: sticky` on the header in some browsers, causing the sticky header to stop working or creating scroll jank.

**Why it happens:** `overflow: hidden` on ancestors can break `position: sticky` in certain browser/OS combinations. The header uses `sticky top-0 z-50`.

**Prevention:**
1. Test sticky header behavior across Chrome, Safari, Firefox on the landing page
2. If sticky breaks, move `overflow-x: hidden` to a wrapper div inside body instead of on body/html directly
3. Alternatively, use `clip-path` or `overflow: clip` (supported in modern browsers) which doesn't break sticky positioning

**Phase to address:** Phase 1 (scaffold) -- verify sticky header works before proceeding with section content.

**Confidence:** MEDIUM -- known CSS interaction, not yet observed as broken in this project.

---

## Phase-Specific Warning Matrix

| Phase | Likely Pitfall | Severity | Mitigation |
|-------|---------------|----------|------------|
| Scaffold/Setup | MOD-2 (spacing), CRIT-3 (client boundaries), MIN-6 (sticky) | High | Establish `SectionWrapper`, server/client pattern, verify sticky |
| Hero Section | CRIT-2 (backdrop-filter), MOD-6 (Three.js bundle), MIN-1 (LCP) | High | Inline blur styles, dynamic import, `priority` on image |
| Feature Sections | CRIT-1 (token mismatch), MOD-1 (duplicate components), MIN-3 (icons) | Medium | v0 migration checklist, reuse existing components |
| Social Proof / Backers | CRIT-1 (tokens), MOD-5 (contrast on glass) | Medium | Verify contrast on glass surfaces |
| Stats / Case Study | MOD-3 (hydration), CRIT-3 (client boundary) | Medium | Server-render text, client-render animated charts |
| CTA / Partnership | MOD-4 (CTA hierarchy) | Medium | Max 2 primary CTAs per page |
| FAQ / Footer | CRIT-1 (tokens) | Low | Standard token replacement |
| Performance / Polish | CRIT-4 (mobile blur), MIN-4 (metadata) | High | Real device testing, full metadata, Lighthouse audit |

---

## v0 Integration Checklist (Per Section)

A consolidated checklist to run after every v0 generation before committing:

- [ ] **Tokens:** Replace all `bg-gray-*`, `text-gray-*`, `border-gray-*` with Virtuna semantic tokens
- [ ] **Fonts:** Replace any `font-*` classes with `font-display` (headings) / `font-sans` (body)
- [ ] **Icons:** Replace Lucide imports with `@phosphor-icons/react` equivalents, add `weight="light"`
- [ ] **Components:** Replace inline buttons/cards/badges with `src/components/ui/*` components
- [ ] **Borders:** Use `border-white/[0.06]` (rest) / `border-white/[0.1]` (hover), not `border-gray-*`
- [ ] **Shadows:** Use design system shadows (`shadow-button`, `shadow-glass`, `shadow-xl`), not `shadow-lg`
- [ ] **Radius:** Cards = `rounded-lg` (12px), inputs = `rounded-md` (8px)
- [ ] **Blur:** Replace `backdrop-blur-*` Tailwind classes with inline `style={{ backdropFilter: 'blur(Xpx)', WebkitBackdropFilter: 'blur(Xpx)' }}`
- [ ] **Container:** Ensure `max-w-6xl mx-auto px-6` and `py-24` section padding
- [ ] **Client boundary:** Move `"use client"` to leaf animation components, keep section text in server components
- [ ] **CTA:** Verify primary (coral) vs secondary (transparent border) variant matches page hierarchy
- [ ] **Production build:** Run `next build && next start` and verify section visually

---

## Sources

**Official / HIGH confidence:**
- Existing codebase analysis (`globals.css`, landing components, layout files)
- Project MEMORY.md (backdrop-filter bug, dev cache, hydration notes)
- [Next.js Metadata API docs](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Tailwind CSS v4 Backdrop Filter](https://tailwindcss.com/docs/backdrop-filter)

**WebSearch / MEDIUM confidence:**
- [v0 Design Systems docs](https://v0.app/docs/design-systems)
- [Vercel blog: Working with custom design systems in v0](https://vercel.com/blog/working-with-figma-and-custom-design-systems-in-v0)
- [shadcn/ui CSS Backdrop Filter performance issue #327](https://github.com/shadcn-ui/ui/issues/327)
- [Safari backdrop-filter performance fix](https://graffino.com/til/how-to-fix-filter-blur-performance-issue-in-safari)
- [Dark Mode Glassmorphism tips](https://alphaefficiency.com/dark-mode-glassmorphism)
- [SaaS Landing Page Mistakes - UX Planet](https://uxplanet.org/i-reviewed-250-saas-landing-pages-avoid-these-10-common-design-mistakes-a1a8499e6ee8)
- [Next.js SEO Optimization Guide 2026](https://www.djamware.com/post/697a19b07c935b6bb054313e/next-js-seo-optimization-guide--2026-edition)
- [CTA Placement Strategies 2026](https://www.landingpageflow.com/post/best-cta-placement-strategies-for-landing-pages)
- [Framer Motion + Next.js App Router hydration issue](https://github.com/vercel/next.js/issues/49279)
- [Next.js client component bundle issue #69865](https://github.com/vercel/next.js/issues/69865)
