# Phase 43: Showcase Enhancement - Research

**Researched:** 2026-02-05
**Domain:** Design system documentation / component showcase (Next.js App Router)
**Confidence:** HIGH

## Summary

Phase 43 replaces the existing `/ui-showcase` page with a comprehensive showcase system demonstrating all Virtuna design system components, their variants, states, and design tokens. The existing showcase is a single monolithic page in `src/app/(marketing)/ui-showcase/page.tsx` with two companion files (`phase-41-demos.tsx`, `phase-42-demos.tsx`) totaling ~700 lines. It lacks code snippets, token visualization, and consistent section patterns.

The project already has everything needed infrastructure-wise: Next.js 16.1.5 with App Router, Tailwind CSS v4, `class-variance-authority` for variants, Radix UI primitives, `framer-motion`/`motion` for animations, and Phosphor Icons. The only new dependency needed is `sugar-high` (~1KB) for syntax highlighting of code snippets. No other new libraries are required.

**Primary recommendation:** Build a multi-page showcase under `src/app/(marketing)/showcase/` with sidebar navigation, using server components for layout and client components only for interactive demos (toasts, toggles, dialogs). Use `sugar-high` for lightweight syntax highlighting with CSS variable theming that matches the dark design system tokens. Each component section follows a strict pattern: title, description, variant grid, state demos, and code snippets.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.5 | App Router, server components, file-based routing | Already the project framework |
| Tailwind CSS | v4 | Styling via `@theme` tokens in globals.css | Already the project styling system |
| class-variance-authority | 0.7.1 | Variant definitions (CVA) for components | Already used by all components |
| framer-motion / motion | 12.29.x | Animation for motion components | Already installed |
| @phosphor-icons/react | 2.1.10 | Icons throughout the UI | Already installed |

### New (To Install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sugar-high | latest | Syntax highlighting for code snippets | ~1KB gzipped, CSS-variable theming, JSX/TSX support, zero runtime deps, works in server components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sugar-high | shiki | Shiki is more powerful (language support, themes) but 10x heavier; overkill for a single-language showcase |
| sugar-high | prism-react-renderer | Heavier, requires React wrappers; sugar-high returns plain HTML |
| sugar-high | Manual `<pre><code>` with no highlighting | Works but looks unprofessional for a design system showcase |
| Multi-page routes | Single long page | Single page would be 3000+ lines; multi-page keeps each page focused and fast |

**Installation:**
```bash
pnpm add sugar-high
```

## Architecture Patterns

### Recommended Project Structure
```
src/app/(marketing)/showcase/
  layout.tsx              # Sidebar nav + content area (server component)
  page.tsx                # /showcase — token visualization (SHW-01)
  inputs/page.tsx         # /showcase/inputs (SHW-02)
  navigation/page.tsx     # /showcase/navigation (SHW-03)
  feedback/page.tsx       # /showcase/feedback (SHW-04)
  data-display/page.tsx   # /showcase/data-display (SHW-05)
  layout-components/page.tsx  # /showcase/layout (SHW-06)
  utilities/page.tsx      # /showcase/utilities (SHW-07)
  _components/
    showcase-section.tsx     # Consistent section wrapper (SHW-10)
    code-block.tsx           # Syntax-highlighted code snippet component
    component-grid.tsx       # Variant/state grid layout helper
    sidebar-nav.tsx          # Showcase sidebar navigation
    token-swatch.tsx         # Token visualization component
```

### Pattern 1: Consistent Section Pattern (SHW-08, SHW-09, SHW-10)
**What:** Every component demo section follows an identical structure: heading, description, variant demos, state demos, code snippets.
**When to use:** Every component showcase section across all pages.
**Example:**
```tsx
// Reusable showcase section wrapper
interface ShowcaseSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function ShowcaseSection({ title, description, children }: ShowcaseSectionProps) {
  return (
    <section className="mb-16">
      <Heading level={2} className="mb-2">{title}</Heading>
      <Text size="sm" muted className="mb-8">{description}</Text>
      {children}
    </section>
  );
}

// Usage pattern per component:
// 1. Variants subsection
// 2. Sizes subsection (if applicable)
// 3. States subsection (disabled, loading, error, etc.)
// 4. Code snippets for each variant/state
```

### Pattern 2: Code Block with sugar-high
**What:** Server-renderable syntax-highlighted code blocks with dark theme matching design tokens.
**When to use:** Every code snippet in the showcase (SHW-08, SHW-09).
**Example:**
```tsx
// _components/code-block.tsx
import { highlight } from "sugar-high";

interface CodeBlockProps {
  code: string;
  title?: string;
}

function CodeBlock({ code, title }: CodeBlockProps) {
  const html = highlight(code.trim());

  return (
    <div className="rounded-lg border border-border-glass bg-surface overflow-hidden">
      {title && (
        <div className="px-4 py-2 border-b border-border-glass">
          <span className="text-xs text-foreground-muted font-mono">{title}</span>
        </div>
      )}
      <pre className="p-4 overflow-x-auto text-sm font-mono">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}
```

### Pattern 3: Showcase Layout with Sidebar Navigation
**What:** A dedicated layout for `/showcase/*` routes with a fixed sidebar for navigation between category pages.
**When to use:** The showcase `layout.tsx` wrapping all showcase pages.
**Example:**
```tsx
// showcase/layout.tsx (server component)
import { SidebarNav } from "./_components/sidebar-nav";

const NAV_ITEMS = [
  { href: "/showcase", label: "Tokens", icon: "palette" },
  { href: "/showcase/inputs", label: "Inputs", icon: "textbox" },
  { href: "/showcase/navigation", label: "Navigation", icon: "compass" },
  { href: "/showcase/feedback", label: "Feedback", icon: "bell" },
  { href: "/showcase/data-display", label: "Data Display", icon: "table" },
  { href: "/showcase/layout-components", label: "Layout", icon: "layout" },
  { href: "/showcase/utilities", label: "Utilities", icon: "sparkle" },
];

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SidebarNav items={NAV_ITEMS} />
      <main className="flex-1 p-8 md:p-16">{children}</main>
    </div>
  );
}
```

### Pattern 4: Token Visualization (SHW-01)
**What:** Visual representation of the two-tier token architecture from globals.css.
**When to use:** The main `/showcase` page.
**Example:**
```tsx
// Color swatch showing primitive -> semantic mapping
function TokenSwatch({ name, value, semantic }: { name: string; value: string; semantic?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-md border border-border-glass"
        style={{ backgroundColor: value }}
      />
      <div>
        <span className="text-sm font-mono text-foreground">{name}</span>
        {semantic && (
          <span className="text-xs text-foreground-muted block">
            = {semantic}
          </span>
        )}
      </div>
    </div>
  );
}
```

### Pattern 5: Client Component Islands for Interactive Demos
**What:** Keep pages as server components, extract only interactive demos (toast triggers, toggle state, dialog open/close) into small client components.
**When to use:** Toast demo, Toggle demo, Dialog demo, Select demo, Spinner determinate demo.
**Example:**
```tsx
// Page is server component
export default function FeedbackPage() {
  return (
    <div>
      <ShowcaseSection title="Toast" description="...">
        {/* Static examples render server-side */}
        <CodeBlock code={`toast({ variant: "success", title: "Saved!" })`} />
        {/* Interactive demo is a client component island */}
        <ToastDemo />
      </ShowcaseSection>
    </div>
  );
}

// _components/toast-demo.tsx
"use client";
// ... interactive toast trigger buttons
```

### Anti-Patterns to Avoid
- **Monolithic single-file page:** The existing ui-showcase is ~700 lines across 3 files. The new showcase will have 7+ pages and shared components. Don't put everything in one file.
- **"use client" on entire pages:** Only mark interactive demo wrappers as client components. Code blocks, token swatches, and layout are all server-renderable.
- **Duplicating component implementations:** Showcase should import and use actual components from `@/components/ui`, `@/components/primitives`, `@/components/motion`, and `@/components/effects` -- never recreate them.
- **Hardcoding token values:** Read token names from the token system structure rather than hardcoding hex values. Show the variable names and their resolved values.
- **Raycast attribution:** Per CONTEXT.md, present everything as Virtuna's own system. No mentions of Raycast anywhere.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Syntax highlighting | Custom regex tokenizer | sugar-high | 1KB, handles JSX/TSX, CSS-variable theming, battle-tested |
| Variant enumeration | Manual list of all variants | Read CVA variant definitions from component source | Components already define their variants via CVA; document from source of truth |
| Navigation highlighting | Custom active-link detection | `usePathname()` from `next/navigation` | Next.js built-in, handles nested routes |
| Copy-to-clipboard | Custom clipboard API wrapper | `navigator.clipboard.writeText()` | Browser API, no library needed; wrap in a 5-line utility |
| Tab/section navigation | Custom scroll-spy | Anchor links with `scroll-margin-top` | CSS-native, no JS needed for within-page navigation |

**Key insight:** This phase is about presentation and documentation, not component creation. Every component already exists and is fully implemented. The showcase merely imports and demonstrates them. Resist the urge to build anything that isn't directly about showcasing.

## Common Pitfalls

### Pitfall 1: Oversized Client Bundles
**What goes wrong:** Marking entire showcase pages as `"use client"` ships all component code + sugar-high + motion to the client, defeating server component benefits.
**Why it happens:** Convenient to add `"use client"` at the top when a single section needs interactivity.
**How to avoid:** Keep pages as server components. Extract only interactive demos (ToastDemo, ToggleDemo, DialogDemo, SelectDemo, SpinnerDeterminateDemo) into small client component files in `_components/`.
**Warning signs:** Page JS bundle > 50KB; sugar-high appearing in client bundle (it should only run server-side).

### Pitfall 2: Stale Code Snippets
**What goes wrong:** Code snippets in the showcase don't match actual component APIs. Props change, snippets become wrong.
**Why it happens:** Code snippets are hardcoded strings, not validated against component types.
**How to avoid:** Define code snippets as template literal strings close to where the component is actually rendered. If the rendered demo works, the code snippet showing the same props is correct. Use a consistent pattern: render the component, then show the code that produces it.
**Warning signs:** Visual demo shows different props than the code snippet below it.

### Pitfall 3: Token Visualization Drift
**What goes wrong:** Token showcase shows different values than globals.css actually defines.
**Why it happens:** Tokens are hardcoded in the showcase page instead of referencing the actual CSS custom properties.
**How to avoid:** For color tokens, use the actual CSS variable as the swatch background (e.g., `var(--color-coral-500)`). For non-visual tokens (spacing, font sizes), display the variable names and their defined values. The showcase should reference, not duplicate, the token values.
**Warning signs:** Adding a token to globals.css but it doesn't appear in the showcase.

### Pitfall 4: Missing Dark Background Context for Glass Components
**What goes wrong:** GlassPanel, GlassCard, and glass-effect components look wrong because they need a colorful background behind them to show the blur effect.
**Why it happens:** Glass components use `backdrop-filter` which blurs what's behind them. On a flat dark background, they look like opaque dark boxes.
**How to avoid:** For glass component demos, always include decorative background elements (gradient blobs, colored circles) behind the glass panel so the blur effect is visible. The existing ui-showcase already does this correctly (see GlassCard section with `bg-gradient-to-br` and colored circles).
**Warning signs:** GlassPanel/GlassCard demos look identical to regular Card demos.

### Pitfall 5: Inconsistent Section Heights and Spacing
**What goes wrong:** Different component pages look visually inconsistent — different spacing between sections, different heading sizes, different demo padding.
**Why it happens:** Each page is authored independently without a shared section component.
**How to avoid:** Use the `ShowcaseSection` wrapper component for ALL sections. Enforce consistent spacing via the wrapper (mb-16 between sections, mb-2 for title-to-description, mb-8 for description-to-content).
**Warning signs:** Visually comparing two showcase pages side-by-side shows different rhythms.

### Pitfall 6: Primitives vs UI Component Confusion
**What goes wrong:** The codebase has two parallel component systems — `@/components/ui` (the design system) and `@/components/primitives` (Glass* prefixed components from an earlier iteration). The showcase should focus on the `@/components/ui` exports, with primitives (GlassPanel, GradientGlow, GradientMesh, TrafficLights) shown in the utilities/layout section.
**Why it happens:** Historical evolution of the component library.
**How to avoid:** Use the barrel exports from `@/components/ui/index.ts`, `@/components/primitives/index.ts`, `@/components/motion/index.ts`, and `@/components/effects/index.ts` as the canonical list of what to showcase. Do NOT showcase the Glass* primitives (GlassInput, GlassSelect, etc.) — only showcase their `@/components/ui` counterparts.
**Warning signs:** Importing from `@/components/primitives/GlassInput` instead of `@/components/ui/input`.

## Code Examples

### sugar-high Dark Theme CSS Variables
```css
/* Add to globals.css — dark theme matching Virtuna tokens */
:root {
  --sh-class: #e5a869;       /* warm amber for classes/numbers */
  --sh-identifier: #c9d1d9;  /* light gray for identifiers */
  --sh-sign: #6a6b6c;        /* muted for operators/signs */
  --sh-property: #7ee787;    /* green for properties */
  --sh-entity: #d2a8ff;      /* purple for entities */
  --sh-jsxliterals: #ff9f7f; /* coral-adjacent for JSX literals */
  --sh-string: #a5d6ff;      /* blue for strings */
  --sh-keyword: #ff7b72;     /* red-coral for keywords */
  --sh-comment: #58595a;     /* muted for comments */
}
```

### Copy-to-Clipboard Utility
```tsx
"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="text-foreground-muted hover:text-foreground transition-colors"
      aria-label={copied ? "Copied" : "Copy code"}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}
```

### Sidebar Navigation with Active State
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
}

function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="w-64 border-r border-border p-6 sticky top-0 h-screen overflow-y-auto">
      <Heading level={3} className="mb-6">Showcase</Heading>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-foreground-secondary hover:text-foreground hover:bg-hover"
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

## Component Inventory for Showcase

Complete inventory of what each page must demonstrate:

### /showcase (Tokens) — SHW-01
- **Color tokens:** Coral scale (100-900), Gray scale (50-950), Semantic status colors (success, warning, error, info)
- **Semantic mapping:** background, surface, foreground, accent, border tokens with their primitive references
- **Typography tokens:** Font families (display, sans, mono), sizes (xs-display), weights, line heights, letter spacing
- **Spacing tokens:** 0-24 scale with visual representation
- **Shadow tokens:** sm, md, lg, xl, glass, glow-accent, button
- **Radius tokens:** none through full
- **Animation tokens:** Durations, easings, z-index scale
- **Gradient tokens:** coral, card-bg, overlay, glow-coral, navbar, feature

### /showcase/inputs — SHW-02
- **Input:** Default, focus, error, disabled states
- **InputField:** With label, with helper text, with error message, disabled
- **Select:** Basic, grouped options, disabled
- **SearchableSelect:** With search, disabled
- **Toggle:** sm/md/lg sizes, with label, without label, checked, unchecked, disabled

### /showcase/navigation — SHW-03
- **Tabs/TabsList/TabsTrigger/TabsContent:** Default, sm/md/lg sizes
- **CategoryTabs:** With icons, with counts
- **Kbd:** sm/md/lg sizes, highlighted variant
- **ShortcutBadge:** Various key combos, separator variants

### /showcase/feedback — SHW-04
- **Toast:** success, error, warning, info, default variants (via ToastProvider + useToast)
- **Dialog:** sm/md/lg/xl/full sizes, with header/footer/description
- **Spinner:** sm/md/lg sizes, indeterminate, determinate with progress
- **Badge:** default, success, warning, error, info variants; sm/md sizes

### /showcase/data-display — SHW-05
- **Avatar:** xs/sm/md/lg/xl sizes, with fallback text
- **AvatarGroup:** With max truncation
- **Skeleton:** Various shapes (circle, rectangle, text lines)
- **Card/GlassCard:** With header/content/footer, blur variants, glow
- **ExtensionCard:** coral/purple/blue gradients, with metadata
- **TestimonialCard:** Default, featured variant

### /showcase/layout-components — SHW-06
- **Container:** default/narrow/wide sizes, different element types
- **GlassPanel:** All 7 blur levels, tint colors, borderGlow, innerGlow, opacity
- **Divider:** Horizontal, vertical, with label
- **GlassCard (primitives):** Blur variants, glow

### /showcase/utilities — SHW-07
- **FadeIn:** With configurable delay, duration, distance
- **FadeInUp:** With delay/duration/distance, as different elements
- **SlideUp:** With delay/duration/distance
- **StaggerReveal + StaggerReveal.Item:** Grid stagger demo
- **HoverScale:** With custom scale/tapScale
- **NoiseTexture:** Different opacity/frequency/octave settings
- **ChromaticAberration:** Different offset/intensity settings
- **GradientGlow:** All 6 colors, 3 intensities, positions, animations
- **GradientMesh:** Multi-color blends, animated
- **TrafficLights:** sm/md/lg sizes, disabled, interactive

## Decisions (Claude's Discretion Recommendations)

Based on codebase analysis, these are my recommendations for the discretion areas:

| Area | Recommendation | Rationale |
|------|---------------|-----------|
| Page structure | Multi-page with 7 routes | 30+ components with variants = too much for one page; category grouping matches SHW-02 through SHW-07 |
| Navigation | Sidebar (fixed left, scrollable) | Best for 7 pages; tabs would be too many; sidebar is standard for design system docs |
| Layout | Marketing layout (with header) | Showcase is public-facing documentation; reuse existing header for consistent branding |
| Interactivity | Static variant grids + interactive demos where needed | Most components can be shown statically; only Toast, Dialog, Toggle, Select, Spinner need client interactivity |
| Section pattern | Strict — ShowcaseSection wrapper for all sections | Consistency is the entire point of SHW-10 |
| Variant display | Curated highlights covering all variants/sizes/states | Show every variant value and every size, but don't show every permutation (e.g., don't need 4 variants x 3 sizes = 12 buttons; show all 4 variants + all 3 sizes separately) |
| Copy-to-clipboard | Yes, small CopyButton on each CodeBlock | Minimal implementation cost; high usability value |
| Syntax highlighting | sugar-high with dark CSS variables | 1KB, CSS-variable theming matches design system approach |
| Props tables | No — code snippets are sufficient | Props tables add maintenance burden; JSDoc is already in component source files |
| Token color format | Swatch grid with variable name + resolved value | Visual swatches for colors, structured lists for non-visual tokens |
| Two-tier architecture display | Yes — show primitive->semantic mapping arrows/labels | This is a key design system concept worth visualizing |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Storybook for component docs | Custom showcase pages in Next.js | 2024+ | No extra tool needed; showcase is part of the app itself |
| PrismJS/Highlight.js | sugar-high / shiki | 2024+ | Much smaller bundles, CSS-variable theming |
| Single monolithic showcase | Multi-page with shared layout | Current | Better organization, faster page loads |
| Client-side everything | Server components + client islands | Next.js 13+ (App Router) | Smaller JS bundles, faster initial load |

**Deprecated/outdated:**
- The existing `/ui-showcase` page and `/primitives-showcase` page are being replaced by the new `/showcase` system
- The Glass* prefixed primitives (GlassInput, GlassModal, etc. in `@/components/primitives/`) are NOT part of the design system showcase — only the barrel-exported components from the four canonical index files

## Open Questions

1. **What happens to `/primitives-showcase` and `/viz-test`?**
   - What we know: These are test/development pages at `src/app/(marketing)/primitives-showcase/` and `src/app/(marketing)/viz-test/`
   - What's unclear: Whether they should also be removed as part of the "one source of truth" cleanup
   - Recommendation: Keep them for now; removing test pages is a separate cleanup task

2. **Should the showcase sidebar be collapsible on mobile?**
   - What we know: The marketing layout has a mobile hamburger menu for the main header
   - What's unclear: How the showcase sidebar should behave on mobile screens
   - Recommendation: Hide sidebar on mobile, show a horizontal tab/pill navigation at the top instead (responsive pattern)

## Sources

### Primary (HIGH confidence)
- Context7: `/huozhi/sugar-high` — API, theming, usage patterns (verified 2026-02-05)
- Codebase inspection: All component files in `src/components/{ui,primitives,motion,effects}/` — full prop interfaces, variant definitions, exports
- Codebase inspection: `src/app/globals.css` — complete token architecture (primitive + semantic layers)
- Codebase inspection: `src/app/(marketing)/ui-showcase/` — existing showcase pattern, 3 files, ~700 lines

### Secondary (MEDIUM confidence)
- Next.js App Router patterns for server/client component composition (well-established pattern)
- sugar-high npm package documentation (verified via Context7)

### Tertiary (LOW confidence)
- None. All findings verified against codebase or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed except sugar-high (verified via package.json and Context7)
- Architecture: HIGH — patterns derived from existing codebase structure (App Router route groups, component organization)
- Pitfalls: HIGH — identified from actual codebase issues (Glass* dual system, client/server boundary, glass background requirements)

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days — stable domain, no fast-moving dependencies)
