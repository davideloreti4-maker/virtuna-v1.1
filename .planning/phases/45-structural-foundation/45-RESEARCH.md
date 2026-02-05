# Phase 45: Structural Foundation (AppShell + Sidebar) - Research

**Researched:** 2026-02-05
**Domain:** Layout restructuring, glassmorphic sidebar, responsive collapse behavior, Zustand persistence
**Confidence:** HIGH

## Summary

This phase rebuilds the AppShell layout to use a floating glassmorphic sidebar that pushes main content on desktop, hides behind a hamburger toggle on mobile, and persists collapse state across sessions. The existing codebase already has all required building blocks: `GlassPanel` primitive with tint/blur/opacity support, design system `Button` (ghost variant), `Select`, `Typography` (Text, Caption), `Icon`, and a Zustand store pattern with manual localStorage hydration.

The current sidebar (`src/components/app/sidebar.tsx`) is a 240px fixed panel with inline backdrop-blur and hardcoded colors. It needs to be rebuilt as a floating `GlassPanel` (inset from all edges, ~300px wide), with the `SocietySelector` and `ViewSelector` removed, navigation restructured around "Content Intelligence" / "Trending Feed" / "Brand Deals" items, and all internal elements migrated to design system primitives. The current `AppShell` (`src/components/app/app-shell.tsx`) is a simple flex container that needs to gain sidebar collapse state management and animated content push behavior.

**Primary recommendation:** Rebuild the sidebar as a `GlassPanel` rendered inside AppShell with CSS transitions (no Framer Motion needed for sidebar slide -- use `transition-all duration-300 ease-out-cubic`), add a new `useSidebarStore` with Zustand `persist` middleware for collapse state, and establish a z-index layer for the sidebar at `--z-sidebar: 50` between base and dropdown.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | Component framework | Already installed |
| Next.js | 16.1.5 | App router, layouts | Already installed |
| Zustand | 5.0.10 | Sidebar state management + persistence | Already installed, `persist` middleware built-in |
| Tailwind CSS | 4.x | Styling, responsive breakpoints, transitions | Already installed |
| class-variance-authority | 0.7.1 | Variant-driven component styles | Already installed, used in Button/Select |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Framer Motion | 12.29.x | AnimatePresence for mobile overlay fade | Only for mobile overlay enter/exit -- sidebar slide uses CSS transitions |
| Lucide React | 0.563.0 | Sidebar icons (Menu, PanelLeftClose, ChevronRight, etc.) | Already installed, used for current sidebar icons |
| @phosphor-icons/react | 2.1.10 | Alternative icon set (used by design system Icon component) | Already installed, use via `<Icon>` wrapper |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS transitions for sidebar slide | Framer Motion `motion.aside` | Framer Motion adds JS overhead for something CSS handles natively; only use FM for AnimatePresence (exit animations) |
| New `useSidebarStore` | Extend existing `useSettingsStore` | Settings store is user preferences (profile, billing); sidebar collapse is UI state -- separate store is cleaner |
| Manual localStorage + `_hydrate()` | Zustand `persist` middleware | The existing stores use manual `_hydrate()` pattern, but Zustand persist is the standard approach and handles edge cases (SSR hydration, storage errors). Use `persist` for the new store. |

### Installation

No new packages required. Everything is already installed.

## Architecture Patterns

### Recommended Component Structure

```
src/
├── stores/
│   └── sidebar-store.ts           # NEW: Zustand persist store for sidebar state
├── components/
│   └── app/
│       ├── app-shell.tsx          # MODIFY: Add sidebar collapse logic, content push
│       ├── sidebar.tsx            # REBUILD: Floating GlassPanel, new nav structure
│       ├── sidebar-nav-item.tsx   # MODIFY: Use Button ghost + Icon
│       ├── sidebar-toggle.tsx     # NEW: Floating toggle button (top-left)
│       ├── mobile-nav.tsx         # MODIFY: Merge with sidebar-toggle for consistency
│       ├── test-history-list.tsx   # MODIFY: Use Typography (Text, Caption)
│       └── test-history-item.tsx   # MODIFY: Use Typography (Text, Caption)
└── app/
    └── globals.css                # MODIFY: Add --z-sidebar token
```

### Pattern 1: Floating GlassPanel Sidebar

**What:** Sidebar rendered as a `<GlassPanel as="aside">` with inset spacing from all viewport edges, creating a floating panel effect (Raycast style).

**When to use:** When the sidebar needs to appear as an elevated, distinct panel rather than flush with the viewport edge.

**Example:**
```tsx
// Source: Existing GlassPanel API (src/components/primitives/GlassPanel.tsx)
<GlassPanel
  as="aside"
  blur="lg"           // 20px blur -- Raycast sidebar level
  opacity={0.7}       // Slightly more opaque than default for readability
  borderGlow           // Subtle border glow
  tint="neutral"       // Neutral tint matching app aesthetic
  className={cn(
    // Floating panel: inset from viewport edges
    "fixed top-3 left-3 bottom-3 w-[300px]",
    // Flex layout for internal structure
    "flex flex-col p-4",
    // Transition for collapse animation
    "transition-transform duration-300 ease-[var(--ease-out-cubic)]",
    // Hidden state
    !isOpen && "-translate-x-[calc(100%+12px)]",
  )}
>
  {children}
</GlassPanel>
```

### Pattern 2: Content Push with CSS Margin

**What:** Main content area uses a dynamic left margin/padding that matches the sidebar width + inset, animated with CSS transitions synchronized to the sidebar.

**When to use:** Desktop viewport where sidebar pushes content rather than overlaying it.

**Example:**
```tsx
// Source: Standard CSS layout pattern
<main
  className={cn(
    "flex-1 overflow-auto transition-[margin-left] duration-300 ease-[var(--ease-out-cubic)]",
    // Push content when sidebar is open on desktop
    isOpen ? "md:ml-[324px]" : "md:ml-0",
    // No push on mobile (sidebar overlays)
    "ml-0",
  )}
>
  {children}
</main>
```

The `324px` value = 300px sidebar width + 12px left inset + 12px gap between sidebar and content.

### Pattern 3: Zustand Persist for Collapse State

**What:** A dedicated Zustand store using the built-in `persist` middleware to automatically save/restore sidebar collapse state to localStorage.

**When to use:** When UI state needs to survive page refresh without manual `_hydrate()` boilerplate.

**Example:**
```tsx
// Source: Zustand v5 persist middleware (Context7 /pmndrs/zustand/v5.0.8)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,  // Default: sidebar expanded
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: 'virtuna-sidebar',  // localStorage key
      // localStorage is the default, no need to specify storage
    },
  ),
);
```

### Pattern 4: Unified Toggle Button (Desktop + Mobile)

**What:** A single floating toggle button component in the top-left corner that serves as both the mobile hamburger and the desktop collapse toggle. Same position, same component, different visibility rules.

**When to use:** Per the context decision -- toggle button is always in the same position regardless of viewport.

**Example:**
```tsx
// Source: Design decision from 45-CONTEXT.md
<Button
  variant="ghost"
  size="sm"
  onClick={toggle}
  className={cn(
    "fixed left-4 top-4 z-[var(--z-sidebar)]",
    // Only show when sidebar is hidden on desktop, always show on mobile
    isOpen ? "md:hidden" : "flex",
  )}
  aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
>
  <Icon icon={List} size={24} />
</Button>
```

### Anti-Patterns to Avoid

- **Using `position: absolute` for the sidebar inside a flex container:** The sidebar must be `position: fixed` to float independently from page scroll. Using absolute positioning would break when main content scrolls.
- **Animating width for collapse:** Animating `width` triggers expensive layout reflows. Use `transform: translateX()` for GPU-accelerated sidebar slide, with margin on the main content for the push effect.
- **Multiple `backdrop-filter` layers on mobile:** The sidebar's `GlassPanel` already uses 1 of the 2 allowed backdrop-filter slots on mobile. Do not add a backdrop-filter to the overlay/dimmer -- use a solid `bg-black/50` instead.
- **Using Framer Motion for sidebar open/close:** CSS transitions handle this perfectly. Reserve Framer Motion for AnimatePresence (exit animations that need to remain in DOM during exit) or complex orchestration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glass panel with blur/border | Custom `<aside>` with inline backdrop-filter styles | `<GlassPanel as="aside">` primitive | GlassPanel handles Safari prefixes, mobile blur reduction, tint colors, border glow, and opacity -- all tested |
| Persist sidebar state to localStorage | Manual `localStorage.setItem/getItem` + `_hydrate()` | Zustand `persist` middleware | persist handles SSR, storage errors, and automatic rehydration cleanly |
| Accessible navigation items | Custom `<button>` with hover styles | `<Button variant="ghost">` + `<Icon>` | Button has focus-visible ring, disabled state, aria attributes, touch target sizing built in |
| Select/dropdown for future nav needs | Radix DropdownMenu with custom styles | Design system `<Select>` component | Select has keyboard navigation, groups, glassmorphic styling all built-in |
| Responsive breakpoint detection | `window.matchMedia()` listeners | Tailwind responsive classes (`md:`, `lg:`) | CSS-based responsive is faster and avoids hydration mismatches |

**Key insight:** The v2.0 design system already provides every primitive needed. This phase is about composition and layout restructuring, not building new components.

## Common Pitfalls

### Pitfall 1: Z-Index Conflicts Between Sidebar and Modals

**What goes wrong:** Sidebar at z-50 collides with modal overlays, dialog content, and dropdown menus that are also at z-50.
**Why it happens:** The current codebase uses hardcoded `z-50` for the sidebar, mobile nav, modals, and dialogs (found in 15+ places). The design system z-index scale (`--z-base` through `--z-tooltip`) exists but isn't used consistently.
**How to avoid:** Add `--z-sidebar: 50` to the z-index scale in globals.css. Sidebar and its toggle use `z-[var(--z-sidebar)]`. Mobile overlay (dimmer) uses `z-[calc(var(--z-sidebar)-1)]` (49). Modals/dialogs remain at `z-[var(--z-modal)]` (400) which is above everything. The existing hardcoded `z-50` on modals should eventually be migrated to `var(--z-modal)` but that is outside this phase's scope.
**Warning signs:** Sidebar appearing above modal overlays, or disappearing behind the main content area.

### Pitfall 2: Hydration Mismatch with Zustand Persist

**What goes wrong:** Server renders sidebar as expanded (default), but localStorage has it collapsed. React hydration detects the mismatch.
**Why it happens:** Zustand persist rehydrates from localStorage after initial render, causing a flash or hydration error.
**How to avoid:** Use `skipHydration: true` in persist config or use the `onRehydrateStorage` callback. Alternatively, render sidebar in a consistent default state (expanded) and only apply persisted state after hydration is complete (matching the existing `_isHydrated` pattern used by other stores). The simplest approach: always render the server-side default, and let the persist middleware update state after mount. Since the sidebar transition is animated, the user sees a smooth transition rather than a flash.
**Warning signs:** Console hydration warnings, sidebar flickering on page load.

### Pitfall 3: Mobile Backdrop-Filter Budget Exceeded

**What goes wrong:** More than 2 elements with backdrop-filter visible simultaneously on mobile, causing frame drops and janky scrolling.
**Why it happens:** The sidebar's `GlassPanel` uses backdrop-filter. If the mobile overlay dimmer also uses backdrop-filter (e.g., `backdrop-blur-sm`), plus any dialog that might be open, the budget is exceeded.
**How to avoid:** Mobile overlay must use `bg-black/50` without any backdrop-filter. Count active glass elements: sidebar GlassPanel (1 slot) + any other visible glass element = max 2. The existing globals.css already reduces mobile blur to 8px max, but element count matters more than blur radius.
**Warning signs:** Laggy sidebar open/close animation on iPhone, high GPU memory usage in Safari Web Inspector.

### Pitfall 4: Content Push Jank from Layout Reflows

**What goes wrong:** Animating the main content's `margin-left` causes visible reflows and choppy performance.
**Why it happens:** `margin-left` is a layout property that triggers reflow on every animation frame.
**How to avoid:** Two options: (A) Use `transform: translateX()` on the main content for GPU-accelerated movement (but this doesn't actually push the content -- it visually shifts it while layout remains). (B) Accept the margin-left approach with `will-change: margin-left` as a hint to the browser, and test performance. The margin approach is simpler and matches the "push" behavior exactly. At 300ms duration with ease-out-cubic, the reflow cost is acceptable on modern hardware. Alternative: use CSS `padding-left` with `transition` which may be slightly cheaper than margin in some engines.
**Warning signs:** Stuttering during sidebar open/close on lower-powered devices.

### Pitfall 5: Collapse Button Inside Sidebar Unreachable When Hidden

**What goes wrong:** If the only way to open the sidebar is a button inside the sidebar, users can never re-open it.
**Why it happens:** Oversight -- collapse button hides with the sidebar.
**How to avoid:** Per the context decision, a persistent floating toggle button stays in the top-left corner when the sidebar is hidden. This toggle is a separate component rendered in AppShell (not inside the sidebar), always visible when sidebar is collapsed.
**Warning signs:** Sidebar collapsed with no visible way to re-open.

## Code Examples

### Sidebar Store with Zustand Persist

```typescript
// Source: Zustand v5 persist middleware (Context7)
// File: src/stores/sidebar-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: 'virtuna-sidebar',
    },
  ),
);
```

### Floating Sidebar with GlassPanel

```tsx
// Source: Existing GlassPanel API + Context decision
// File: src/components/app/sidebar.tsx (rebuilt)
import { GlassPanel } from '@/components/primitives';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text, Caption } from '@/components/ui/typography';
import { useSidebarStore } from '@/stores/sidebar-store';
import { X, List } from '@phosphor-icons/react';

export function Sidebar() {
  const { isOpen, close } = useSidebarStore();

  return (
    <>
      {/* Mobile overlay - NO backdrop-filter (budget slot saved) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[calc(var(--z-sidebar)-1)] bg-black/50 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <GlassPanel
        as="aside"
        blur="lg"
        opacity={0.7}
        borderGlow
        className={cn(
          "fixed top-3 left-3 bottom-3 z-[var(--z-sidebar)] w-[300px]",
          "flex flex-col overflow-hidden",
          "transition-transform duration-300 ease-[var(--ease-out-cubic)]",
          isOpen ? "translate-x-0" : "-translate-x-[calc(100%+12px)]",
        )}
      >
        {/* Sidebar internals */}
      </GlassPanel>
    </>
  );
}
```

### AppShell with Content Push

```tsx
// Source: Existing app-shell.tsx structure + layout pattern
// File: src/components/app/app-shell.tsx (modified)
import { useSidebarStore } from '@/stores/sidebar-store';

export function AppShell({ children }: { children: React.ReactNode }) {
  const isOpen = useSidebarStore((s) => s.isOpen);

  return (
    <AuthGuard>
      <div className="flex h-screen bg-[#0A0A0A]">
        <SidebarToggle />
        <Sidebar />
        <main
          className={cn(
            "flex-1 overflow-auto",
            "transition-[margin-left] duration-300 ease-[var(--ease-out-cubic)]",
            isOpen ? "md:ml-[324px]" : "md:ml-0",
          )}
        >
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
```

### Nav Item Migration to Design System

```tsx
// Source: Existing Button ghost variant + Icon component
// Before: Custom <button> with inline hover styles
// After: Design system Button + Icon
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/typography';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

interface SidebarNavItemProps {
  icon: PhosphorIcon;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function SidebarNavItem({ icon, label, isActive, onClick }: SidebarNavItemProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "w-full justify-start gap-3",
        isActive && "bg-hover text-foreground",  // Filled background for active (Raycast style)
      )}
    >
      <Icon icon={icon} size={20} weight={isActive ? "fill" : "regular"} />
      <Text as="span" size="sm" className="truncate">
        {label}
      </Text>
    </Button>
  );
}
```

### Z-Index Scale Addition

```css
/* Source: Existing globals.css z-index scale */
/* File: src/app/globals.css */
@theme {
  /* --- Z-Index Scale --- */
  --z-base: 0;
  --z-sidebar: 50;           /* NEW: Floating sidebar + toggle */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal-backdrop: 300;
  --z-modal: 400;
  --z-toast: 500;
  --z-tooltip: 600;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `_hydrate()` + `loadFromStorage()` | Zustand `persist` middleware | Zustand v4+ (stable in v5) | Eliminates boilerplate; automatic rehydration, SSR-safe |
| `width` animation for sidebar collapse | `transform: translateX()` for hide/show | CSS3 GPU compositing maturity | GPU-accelerated, no layout reflow |
| Sidebar as page-edge element (`left-0 top-0`) | Floating inset panel (`top-3 left-3 bottom-3`) | Raycast/macOS design trend | Visual elevation, modern aesthetic |
| Hardcoded `z-50` everywhere | CSS custom property z-index scale | Design system best practice | Predictable stacking, zero conflicts |

**Deprecated/outdated:**
- The existing `SocietySelector` and `ViewSelector` in the sidebar are being removed per context decision (navigation restructured to page-level items).
- The current 240px sidebar width is being widened to ~300px per context decision.
- The existing `SidebarNavItem` component (label-left, icon-right layout) is being redesigned (icon-left, label-right to match Raycast style).

## Open Questions

1. **Exact inset spacing values for the floating panel**
   - What we know: Context says "inset from all viewport edges" with "visible gap on all sides, Raycast style"
   - What's unclear: Exact pixel values (12px? 16px? Tailwind `3` = 12px, `4` = 16px)
   - Recommendation: Use `12px` (Tailwind `3`) as the starting value -- this is Claude's discretion per context. Matches Raycast's tight but visible gap. Easy to adjust later.

2. **Collapse button icon and placement within sidebar**
   - What we know: Dedicated collapse button within the sidebar triggers hide
   - What's unclear: Which icon, where exactly (top-right? next to logo?)
   - Recommendation: Use a `PanelLeftClose` or `Sidebar` icon from Lucide/Phosphor, placed in the sidebar header row (top-right, next to the logo -- matching the current `Columns2` button position). This is Claude's discretion per context.

3. **Test history item density and scroll behavior**
   - What we know: Test history list renders below nav items, filling remaining sidebar space
   - What's unclear: How many items before scroll, line clamping, date display
   - Recommendation: Use `overflow-y-auto` on the test history section with `flex-1` to fill remaining space. Each item shows truncated title (existing `getDisplayTitle` pattern) with `<Caption>` for timestamp. This is Claude's discretion per context.

4. **Main content push animation timing relative to sidebar**
   - What we know: Smooth transition (~200-300ms ease curve)
   - What's unclear: Should content push be perfectly synchronized, slightly delayed, or slightly ahead?
   - Recommendation: Use identical `duration-300 ease-[var(--ease-out-cubic)]` on both sidebar transform and main content margin-left. Identical timing = naturally synchronized. This is Claude's discretion per context.

5. **Icon library for nav items (Lucide vs Phosphor)**
   - What we know: Design system `Icon` component wraps Phosphor icons. Current sidebar uses Lucide.
   - What's unclear: Should migrated nav items use Phosphor (via `<Icon>`) or Lucide (existing pattern)?
   - Recommendation: Migrate to Phosphor via `<Icon>` wrapper for consistency with the design system. The `Icon` component provides standardized sizing and accessibility. Both libraries are installed.

## Sources

### Primary (HIGH confidence)
- Zustand v5.0.8 persist middleware -- Context7 `/pmndrs/zustand/v5.0.8`, topics: persist middleware, localStorage, partialize, hydration
- Framer Motion AnimatePresence -- Context7 `/grx7/framer-motion`, topics: exit animations, layout animations
- Existing codebase analysis -- Direct file reads of all relevant components, stores, globals.css

### Secondary (MEDIUM confidence)
- [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter) -- CSS specification reference
- [shadcn/ui backdrop-filter performance issue #327](https://github.com/shadcn-ui/ui/issues/327) -- Real-world performance reports on multiple backdrop-filter elements

### Tertiary (LOW confidence)
- [Glassmorphism guide 2026](https://tutorialsbynitin.com/modern-ui-with-glassmorphism-effects/) -- General glassmorphism patterns (verified against codebase implementation)
- [CSS properties performance impact](https://www.f22labs.com/blogs/how-css-properties-affect-website-performance/) -- Layout property animation cost considerations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already installed, APIs verified via Context7
- Architecture: HIGH -- Patterns derived from existing codebase structure and verified GlassPanel API
- Pitfalls: HIGH -- Z-index conflicts verified by grepping codebase (15+ hardcoded z-50 usages found), hydration pattern confirmed from existing stores
- Code examples: HIGH -- Based on existing component APIs read directly from source files

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (stable -- no fast-moving dependencies)
