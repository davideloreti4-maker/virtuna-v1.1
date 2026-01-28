# Phase 4: App Layout & Navigation - Research

**Researched:** 2026-01-28
**Domain:** Next.js App Router layouts, responsive navigation, route protection
**Confidence:** HIGH

## Summary

This phase builds the app shell and navigation structure: a fixed sidebar with selectors and actions, a main content area featuring an animated dot visualization, and route protection for the authenticated experience. The project already uses Next.js 16.1.5 with App Router, Tailwind CSS 4, and has Radix UI primitives available.

The standard approach leverages Next.js route groups to separate the landing site layout from the app layout, using a `(marketing)` group for the landing pages and an `(app)` group for the authenticated dashboard. The sidebar follows the reference design precisely (248px fixed width), with Radix UI primitives for dropdown menus and dialog modals. Mobile responsiveness uses a slide-out drawer pattern triggered by a hamburger menu.

For the network visualization placeholder, a simple CSS/Canvas animated dots effect is recommended over heavy libraries like tsParticles, keeping bundle size minimal while delivering visual polish. Route protection in Phase 4 is mock-only (always logged in), with a brief skeleton loading state for polish.

**Primary recommendation:** Use Next.js route groups `(marketing)` and `(app)` with separate root layouts, Radix UI for dropdowns/modals, and a lightweight canvas-based dot animation for the visualization placeholder.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.5 | Layout system, route groups | Already in project, native nested layouts |
| Tailwind CSS | 4.x | Styling | Already in project, responsive utilities built-in |
| Radix UI Primitives | Latest | Dropdown Menu, Dialog | Already have @radix-ui/react-slot, consistent with existing patterns |
| Lucide React | 0.563.0 | Icons | Already in project, tree-shakeable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-dropdown-menu | ^2.1.x | View selector dropdown | Sidebar view selector |
| @radix-ui/react-dialog | ^1.1.x | Society selector modal | Full-screen society picker |
| motion | 12.29.2 | Animations | Already in project, use for sidebar transitions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas dots | tsParticles | tsParticles is heavier (~50KB+), overkill for placeholder |
| Radix Dialog | Headless UI | Radix already in project, consistency matters |
| Custom dropdown | Radix Dropdown | Radix handles accessibility, focus management properly |

**Installation:**
```bash
npm install @radix-ui/react-dropdown-menu @radix-ui/react-dialog
```

## Architecture Patterns

### Recommended Project Structure
```
src/app/
├── (marketing)/           # Landing site group (existing)
│   ├── layout.tsx         # Root layout with Header
│   ├── page.tsx           # Landing page
│   ├── coming-soon/
│   └── showcase/
├── (app)/                 # Authenticated app group (new)
│   ├── layout.tsx         # App shell with Sidebar
│   ├── page.tsx           # Dashboard (redirects or main view)
│   └── dashboard/
│       └── page.tsx       # Main dashboard with network viz
├── layout.tsx             # REMOVE - move to route groups
└── globals.css            # Keep at root

src/components/
├── app/                   # App-specific components (new)
│   ├── sidebar.tsx
│   ├── sidebar-nav-item.tsx
│   ├── society-selector.tsx
│   ├── view-selector.tsx
│   ├── user-menu.tsx
│   └── network-visualization.tsx
├── ui/                    # Shared UI (existing)
├── layout/                # Landing layout (existing)
└── motion/                # Animations (existing)
```

### Pattern 1: Route Groups for Separate Layouts
**What:** Use `(marketing)` and `(app)` folders to have completely different root layouts
**When to use:** Landing site needs Header/Footer, App needs Sidebar only
**Example:**
```typescript
// src/app/(marketing)/layout.tsx
// Source: https://nextjs.org/docs/app/getting-started/layouts-and-pages
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}

// src/app/(app)/layout.tsx
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

### Pattern 2: Radix Dialog for Society Selector Modal
**What:** Full-screen modal with card grid for society selection
**When to use:** Society selector needs more space than a dropdown
**Example:**
```typescript
// Source: https://www.radix-ui.com/primitives/docs/components/dialog
import * as Dialog from "@radix-ui/react-dialog";

export function SocietySelector() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="w-full bg-zinc-900 border border-zinc-800 ...">
          Zurich Founders
          <ChevronDown className="h-4 w-4" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-800 rounded-xl p-6 min-w-[600px]">
          <Dialog.Title className="text-sm font-semibold text-white mb-4">
            Personal Societies
          </Dialog.Title>
          {/* Society cards grid */}
          <Dialog.Close asChild>
            <button className="absolute top-4 right-4">
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Pattern 3: Radix Dropdown for View Selector
**What:** Simple dropdown menu for view selection (Country, City, Role Level, etc.)
**When to use:** Limited options, doesn't need full modal
**Example:**
```typescript
// Source: https://www.radix-ui.com/primitives/docs/components/dropdown-menu
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

export function ViewSelector() {
  const [view, setView] = useState("Country");

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white text-sm text-left">
          {view}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="bg-zinc-900 border border-zinc-800 rounded-lg py-2 min-w-[160px]">
          <DropdownMenu.Label className="px-4 py-2 text-xs text-zinc-500 uppercase tracking-wide">
            Views
          </DropdownMenu.Label>
          {["Country", "City", "Generation", "Role Level", "Sector", "Role Area"].map((v) => (
            <DropdownMenu.Item
              key={v}
              className="px-4 py-2.5 text-sm text-zinc-200 cursor-pointer hover:bg-zinc-800 outline-none"
              onSelect={() => setView(v)}
            >
              {v}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

### Pattern 4: Mock Auth Guard with Skeleton
**What:** Simulate auth check with brief loading state, always resolve to "logged in"
**When to use:** Phase 4 mock auth, provides polish for real auth later
**Example:**
```typescript
// src/components/app/auth-guard.tsx
"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock auth check - always "logged in" after brief delay
    const timer = setTimeout(() => setIsLoading(false), 350);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <AppShellSkeleton />;
  }

  return <>{children}</>;
}

function AppShellSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-[248px] border-r border-zinc-800 p-4">
        <Skeleton className="h-8 w-24 mb-6" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
      </div>
      <div className="flex-1 p-4">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    </div>
  );
}
```

### Pattern 5: Responsive Sidebar with Mobile Drawer
**What:** Fixed sidebar on desktop, slide-out drawer on mobile
**When to use:** All viewport sizes, breakpoint at md (768px)
**Example:**
```typescript
// src/components/app/sidebar.tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger trigger */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-6 w-6 text-white" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen w-[248px] bg-[#0A0A0A] border-r border-zinc-800 flex flex-col p-4 transition-transform duration-200",
          "md:translate-x-0 md:static",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile close button */}
        <button
          className="absolute top-4 right-4 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-5 w-5 text-zinc-400" />
        </button>

        {/* Sidebar content */}
        {/* ... */}
      </aside>
    </>
  );
}
```

### Anti-Patterns to Avoid
- **Prop drilling auth state:** Don't pass isAuthenticated through many layers; use context or check at layout level
- **Blocking renders on auth:** Don't show blank page; always show skeleton or loading state
- **CSS-only hamburger:** Don't use checkbox hacks; use React state for proper accessibility
- **Hardcoded breakpoints:** Use Tailwind's responsive prefixes (md:, lg:) instead of magic numbers
- **Multiple root layouts with shared state:** Navigation between `(marketing)` and `(app)` causes full page reload; this is expected and acceptable

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown menu | Custom div with click handlers | Radix DropdownMenu | Focus management, keyboard nav, screen readers |
| Modal/dialog | Custom portal with overlay | Radix Dialog | Focus trapping, ESC handling, accessibility |
| Icon system | Inline SVGs everywhere | Lucide React | Consistent sizing, tree-shaking, TypeScript types |
| Responsive breakpoints | Media queries in JS | Tailwind responsive prefixes | SSR-safe, no hydration mismatch |
| Layout persistence | Redux/context for layout state | Next.js App Router layouts | Built-in partial rendering, state preservation |

**Key insight:** Radix UI primitives handle the hardest parts of UI (accessibility, focus management, keyboard interactions) while giving full styling control. Don't rebuild these behaviors.

## Common Pitfalls

### Pitfall 1: Route Group URL Conflicts
**What goes wrong:** Two route groups resolve to same URL path
**Why it happens:** Both `(marketing)/about/page.tsx` and `(app)/about/page.tsx` create `/about`
**How to avoid:** Plan URL structure before creating folders; use different paths for each section
**Warning signs:** Build errors about conflicting routes

### Pitfall 2: Full Page Reload Between Root Layouts
**What goes wrong:** Navigation from landing to app causes flash/reload
**Why it happens:** Different root layouts = different html/body = full reload required
**How to avoid:** This is expected behavior; ensure both layouts have consistent theme to minimize visual disruption
**Warning signs:** White flash when navigating between sections

### Pitfall 3: Modal Pointer Events Issue
**What goes wrong:** Opening dialog from dropdown leaves `pointer-events: none` on page
**Why it happens:** Radix modal behavior conflicts with dropdown modal behavior
**How to avoid:** Set `modal={false}` on DropdownMenu when opening Dialog from within it
**Warning signs:** Can't click anything after closing dialog

### Pitfall 4: Mobile Menu Not Closing
**What goes wrong:** Navigation in mobile menu doesn't close the drawer
**Why it happens:** Links don't trigger close callback
**How to avoid:** Add `onClick={() => setMobileOpen(false)}` to all navigation links
**Warning signs:** Menu stays open after navigating

### Pitfall 5: Hydration Mismatch with Mobile Detection
**What goes wrong:** Server renders desktop, client renders mobile (or vice versa)
**Why it happens:** `window.innerWidth` check on initial render
**How to avoid:** Use CSS responsive classes (md:hidden), not JS for initial render
**Warning signs:** React hydration warnings in console

### Pitfall 6: Sidebar Width Inconsistency
**What goes wrong:** Main content jumps when sidebar renders
**Why it happens:** Sidebar width not accounted for in layout
**How to avoid:** Use flex layout with fixed sidebar width, not CSS Grid with auto
**Warning signs:** Content shift on page load

## Code Examples

Verified patterns from official sources:

### Sidebar Nav Item with Icon
```typescript
// Source: Reference design .reference/app/sidebar.md
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SidebarNavItemProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  active?: boolean;
}

export function SidebarNavItem({ icon: Icon, label, onClick, active }: SidebarNavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between py-3 text-sm transition-colors",
        active ? "text-white" : "text-zinc-400 hover:text-white"
      )}
    >
      <span>{label}</span>
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
```

### Network Visualization Placeholder (Canvas Dots)
```typescript
// Source: Research on lightweight particle effects
"use client";

import { useEffect, useRef } from "react";

interface Dot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export function NetworkVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Respect reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize dots
    const dots: Dot[] = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 3 + 2,
    }));

    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Update and draw dots
      dots.forEach((dot) => {
        if (!prefersReducedMotion) {
          dot.x += dot.vx;
          dot.y += dot.vy;

          // Bounce off edges
          if (dot.x < 0 || dot.x > canvas.offsetWidth) dot.vx *= -1;
          if (dot.y < 0 || dot.y > canvas.offsetHeight) dot.vy *= -1;
        }

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#6366F1"; // indigo-500
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
```

### Filter Pills (Role Level Legend)
```typescript
// Source: Reference .reference/app/view-selector.md
interface FilterPillProps {
  label: string;
  color: string;
  active?: boolean;
  onClick?: () => void;
}

export function FilterPill({ label, color, active, onClick }: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors",
        active
          ? "border-zinc-600 bg-zinc-800/50 text-white"
          : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white"
      )}
    >
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </button>
  );
}

// Usage
const ROLE_LEVELS = [
  { label: "Executive Level", color: "#6366F1" },
  { label: "Mid Level", color: "#EC4899" },
  { label: "Senior Level", color: "#10B981" },
  { label: "Entry Level", color: "#F97316" },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router getServerSideProps | App Router layouts | Next.js 13+ | Layouts persist state across navigation |
| Context for layout state | URL + server components | Next.js 14+ | Less client JS, better SSR |
| Heavy particle libs (particles.js) | Lightweight Canvas/CSS | 2024+ | Smaller bundles, better perf |
| Custom modal implementations | Radix Dialog primitive | Radix 1.0+ | Accessibility built-in |

**Deprecated/outdated:**
- `getServerSideProps` / `getStaticProps`: Use App Router server components
- `next/router`: Use `next/navigation` hooks
- `@headlessui/react` in Radix projects: Mix causes bundle bloat, pick one

## Open Questions

Things that couldn't be fully resolved:

1. **Exact v0 MCP workflow for pixel-perfect cloning**
   - What we know: CONTEXT.md specifies using v0 MCP for generation from screenshots
   - What's unclear: Exact v0 MCP API and prompting patterns
   - Recommendation: During implementation, experiment with v0 prompts; fall back to manual coding if needed

2. **Network visualization performance on low-end mobile**
   - What we know: 50 dots at 60fps should be fine on modern devices
   - What's unclear: Performance on older phones, battery impact
   - Recommendation: Test on real devices; reduce dot count or disable animation if issues arise

3. **Exact collapsed sidebar behavior**
   - What we know: Reference shows 64px collapsed width with icons only
   - What's unclear: Whether collapse is used in MVP or deferred
   - Recommendation: Build collapsible structure but default to expanded; add collapse toggle later if needed

## Sources

### Primary (HIGH confidence)
- [Next.js Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) - Layout patterns, nested layouts
- [Next.js Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) - Route organization
- [Radix UI Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) - Modal patterns
- [Radix UI Dropdown Menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu) - Dropdown patterns
- [Lucide React](https://lucide.dev/guide/packages/lucide-react) - Icon usage

### Secondary (MEDIUM confidence)
- [Tailwind CSS Sidebar Patterns](https://flowbite.com/docs/components/sidebar/) - Responsive sidebar patterns
- [CSS Script Particle Libraries](https://www.cssscript.com/best-particles-animation/) - Lightweight visualization options

### Tertiary (LOW confidence)
- Community patterns for auth loading states (general consensus, not official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using libraries already in project or well-documented
- Architecture: HIGH - Next.js route groups are well-documented official patterns
- Pitfalls: MEDIUM - Based on common issues in React/Next.js community, some from experience
- Network visualization: MEDIUM - Canvas approach is standard but specific implementation varies

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - Next.js and Radix are stable)
