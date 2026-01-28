# Phase 2: Design System & Components - Research

**Researched:** 2026-01-28
**Domain:** React Design System with Tailwind CSS v4, CVA, Motion
**Confidence:** HIGH

## Summary

This phase builds a pixel-perfect design system matching societies.io. The project already has the core dependencies installed (motion@12.29.2, class-variance-authority@0.7.1, tailwind-merge@3.4.0, clsx@2.1.1, @radix-ui/react-slot@1.2.4). The key findings are:

1. **Tailwind CSS v4** uses CSS-first configuration via `@theme` directive instead of JavaScript config files
2. **Motion (Framer Motion)** requires special handling in Next.js App Router due to AnimatePresence limitations
3. **CVA + cn() pattern** is the standard for variant-based components with Tailwind
4. **Fonts** need updating: Reference uses Funnel Display (Google Fonts) + Satoshi (Fontshare), not Inter

**Primary recommendation:** Set up design tokens in globals.css with @theme directive, create cn() utility, implement FrozenRouter pattern for page transitions, and self-host fonts via next/font/local.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.29.2 | Animations, page transitions | Renamed from framer-motion, declarative animation API |
| class-variance-authority | 0.7.1 | Component variants | Type-safe variant definitions with Tailwind |
| tailwind-merge | 3.4.0 | Class conflict resolution | Intelligently merges conflicting Tailwind classes |
| clsx | 2.1.1 | Conditional classes | Lightweight, pairs with tailwind-merge |
| @radix-ui/react-slot | 1.2.4 | Composition primitive | Enables asChild pattern for component composition |
| lucide-react | 0.563.0 | Icon library | Already installed, modern icon set |

### Required Additions
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @phosphor-icons/react | latest | Additional icons | Societies.io uses Phosphor Icons (Crosshair, Lightning, UsersThree, Brain) |

### Fonts (Need Setup)
| Font | Source | Purpose |
|------|--------|---------|
| Funnel Display | Google Fonts (via next/font/google or self-host) | Display/headings font |
| Satoshi | Fontshare (self-host via next/font/local) | Body text font |

**Installation:**
```bash
npm install @phosphor-icons/react
```

**Font Downloads:**
- Funnel Display: https://fonts.google.com/specimen/Funnel+Display (variable font available)
- Satoshi: https://www.fontshare.com/fonts/satoshi (variable font, free for commercial use)

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── ui/                    # Base UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── skeleton.tsx
│   │   └── index.ts           # Re-exports
│   ├── layout/                # Layout components
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   ├── container.tsx
│   │   └── index.ts
│   └── motion/                # Animation components
│       ├── fade-in.tsx
│       ├── slide-up.tsx
│       ├── page-transition.tsx
│       ├── frozen-router.tsx  # For page transitions
│       └── index.ts
├── lib/
│   └── utils.ts               # cn() utility
└── app/
    ├── globals.css            # Tailwind + @theme tokens
    └── layout.tsx             # Font setup
```

### Pattern 1: The cn() Utility Function
**What:** Combines clsx and tailwind-merge for class name management
**When to use:** Every component that accepts className prop
**Example:**
```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Pattern 2: CVA Component Pattern
**What:** Type-safe variant definitions for components
**When to use:** Any component with multiple visual variants
**Example:**
```typescript
// src/components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center rounded text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white hover:bg-accent/90",
        secondary: "bg-background-elevated text-white hover:bg-background-elevated/80",
        ghost: "hover:bg-white/10",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };
```

### Pattern 3: Tailwind v4 CSS-First Configuration
**What:** Design tokens defined in CSS via @theme directive
**When to use:** All custom colors, fonts, spacing
**Example:**
```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  /* Colors - from societies.io design tokens */
  --color-background: #0D0D0D;
  --color-background-elevated: #1A1A1A;
  --color-foreground: #FFFFFF;
  --color-foreground-secondary: #F5F5F5;
  --color-foreground-muted: #CCCCCC;
  --color-accent: #E57850;
  --color-border: rgba(255, 255, 255, 0.1);

  /* Typography */
  --font-display: "Funnel Display", sans-serif;
  --font-sans: "Satoshi", ui-sans-serif, system-ui, sans-serif;

  /* Custom font sizes */
  --text-hero: 52px;
  --text-section: 40px;
  --text-card-title: 18px;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;

  /* Easing functions */
  --ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1);
  --ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);
}
```

### Pattern 4: Motion Import for Next.js App Router
**What:** Correct import path for Motion in React Server Components environment
**When to use:** All animation components
**Example:**
```typescript
// For Client Components (default)
"use client";
import { motion, AnimatePresence } from "motion/react";

// For Server Components (if needed)
import * as motion from "motion/react-client";
```

### Pattern 5: FrozenRouter for Page Transitions
**What:** Workaround for AnimatePresence in Next.js App Router
**When to use:** Page transition animations
**Example:**
```typescript
// src/components/motion/frozen-router.tsx
"use client";

import { useContext, useRef, useEffect } from "react";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useSelectedLayoutSegment } from "next/navigation";

function usePreviousValue<T>(value: T): T | null {
  const prevValue = useRef<T | null>(null);

  useEffect(() => {
    prevValue.current = value;
    return () => {
      prevValue.current = null;
    };
  });

  return prevValue.current;
}

export function FrozenRouter({ children }: { children: React.ReactNode }) {
  const context = useContext(LayoutRouterContext);
  const prevContext = usePreviousValue(context);

  const segment = useSelectedLayoutSegment();
  const prevSegment = usePreviousValue(segment);

  const changed = segment !== prevSegment &&
    segment !== undefined &&
    prevSegment !== undefined;

  return (
    <LayoutRouterContext.Provider value={changed ? prevContext : context}>
      {children}
    </LayoutRouterContext.Provider>
  );
}
```

### Pattern 6: Font Setup with next/font/local
**What:** Self-hosted fonts with automatic optimization
**When to use:** Custom fonts not in Google Fonts (Satoshi)
**Example:**
```typescript
// src/app/layout.tsx
import localFont from "next/font/local";
import { Funnel_Display } from "next/font/google";

const satoshi = localFont({
  src: [
    { path: "../fonts/Satoshi-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/Satoshi-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Satoshi-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-satoshi",
});

const funnelDisplay = Funnel_Display({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-funnel-display",
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${satoshi.variable} ${funnelDisplay.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

### Anti-Patterns to Avoid
- **String interpolation for classes:** Never use `'bg-' + color + '-500'` - Tailwind cannot detect these at build time
- **motion.create() in render:** Creates new component every render, breaks animations
- **Skipping cn() utility:** Direct className concatenation causes unpredictable class conflicts
- **Using tailwind.config.js in v4:** Use @theme directive in CSS instead

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Class merging | Custom merge logic | cn() with tailwind-merge | Edge cases with specificity, breakpoints, states |
| Component variants | Switch statements | CVA (class-variance-authority) | Type-safe, compound variants, default variants |
| Skeleton animation | Custom keyframes | Tailwind animate-pulse or motion | Handles reduced-motion, consistent timing |
| Button composition | Wrapper divs | Radix Slot with asChild | Preserves refs, event handlers, accessibility |
| Icon sizing | Manual SVG styling | Phosphor Icons props | size, weight, color props built-in |

**Key insight:** The CVA + cn() + Radix Slot combination handles 90% of component variant needs. Building custom solutions leads to type safety gaps and inconsistent behavior.

## Common Pitfalls

### Pitfall 1: AnimatePresence Not Working in App Router
**What goes wrong:** Exit animations don't fire, pages switch instantly
**Why it happens:** Next.js App Router wraps pages in providers that break AnimatePresence's child detection
**How to avoid:** Use FrozenRouter pattern to freeze context during transitions
**Warning signs:** exit prop animations never trigger

### Pitfall 2: Tailwind v4 Config File Confusion
**What goes wrong:** tailwind.config.ts changes have no effect
**Why it happens:** v4 uses @theme in CSS, not JavaScript config by default
**How to avoid:** Define all theme values in globals.css with @theme directive
**Warning signs:** Custom colors/fonts not generating utility classes

### Pitfall 3: Font Loading Flash (FOUT)
**What goes wrong:** Text flashes with system font before custom font loads
**Why it happens:** Font not preloaded or wrong display strategy
**How to avoid:** Use next/font which handles preloading automatically; set display: swap
**Warning signs:** Visible font change after page load

### Pitfall 4: Motion Bundle Size
**What goes wrong:** Large JavaScript bundle from motion library
**Why it happens:** Importing entire library instead of specific features
**How to avoid:** Import only what you need; motion tree-shakes well
**Warning signs:** Bundle analyzer showing large motion chunks

### Pitfall 5: Skeleton Layout Shift
**What goes wrong:** Content jumps when skeleton replaced with real content
**Why it happens:** Skeleton dimensions don't match loaded content
**How to avoid:** Match skeleton dimensions exactly to final content; use fixed heights
**Warning signs:** CLS (Cumulative Layout Shift) issues in Lighthouse

### Pitfall 6: CVA Types Not Working
**What goes wrong:** VariantProps type is empty or incorrect
**Why it happens:** Importing type incorrectly or cva definition malformed
**How to avoid:** Use `type VariantProps` import; ensure cva returns before defining type
**Warning signs:** TypeScript not catching invalid variant props

## Code Examples

Verified patterns from official sources:

### Skeleton Component with Reduced Motion
```typescript
// src/components/ui/skeleton.tsx
"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-foreground-muted/10 rounded-md",
        "animate-pulse motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  );
}
```

### FadeIn Animation Component
```typescript
// src/components/motion/fade-in.tsx
"use client";

import { motion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

const fadeInVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.215, 0.61, 0.355, 1], // ease-out-cubic
    }
  },
};

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function FadeIn({ children, className, delay = 0 }: FadeInProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeInVariants}
      transition={{ delay }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
```

### Page Transition Wrapper
```typescript
// src/components/motion/page-transition.tsx
"use client";

import { motion, AnimatePresence } from "motion/react";
import { useSelectedLayoutSegment } from "next/navigation";
import { FrozenRouter } from "./frozen-router";

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const segment = useSelectedLayoutSegment();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={segment}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.215, 0.61, 0.355, 1] }}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </motion.div>
    </AnimatePresence>
  );
}
```

### Input Component with States
```typescript
// src/components/ui/input.tsx
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex h-10 w-full rounded-sm border bg-background px-3 py-2",
          "text-sm text-foreground placeholder:text-foreground-muted",
          "border-border focus:border-accent focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500 focus:border-red-500",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
```

### Phosphor Icons Usage (SSR-safe)
```typescript
// For Next.js Server Components
import { Lightning, Brain, UsersThree } from "@phosphor-icons/react/dist/ssr";

// Usage
<Lightning size={28} weight="light" className="text-accent" />

// For Client Components
"use client";
import { Lightning, Brain, UsersThree } from "@phosphor-icons/react";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| framer-motion package | motion package | 2025 | New import paths: `motion/react` |
| tailwind.config.js | @theme in CSS | Tailwind v4 (2025) | CSS-first configuration |
| @tailwind directives | @import "tailwindcss" | Tailwind v4 (2025) | Single import statement |
| bg-opacity-* utilities | bg-black/50 syntax | Tailwind v4 (2025) | Opacity modifiers |
| Pages Router transitions | FrozenRouter pattern | Next.js 13+ App Router | AnimatePresence workaround |
| Inter font (default) | Funnel Display + Satoshi | societies.io design | Match reference exactly |

**Deprecated/outdated:**
- `@tailwind base/components/utilities`: Use `@import "tailwindcss"` in v4
- `framer-motion` package name: Now called `motion`
- JavaScript tailwind.config.ts: Use @theme in CSS for v4 projects
- `bg-opacity-*` utilities: Use opacity modifier syntax (e.g., `bg-black/50`)
- `shadow-sm` naming: Renamed to `shadow-xs` in v4

## Open Questions

Things that couldn't be fully resolved:

1. **FrozenRouter Stability**
   - What we know: Pattern works but relies on Next.js internals (`LayoutRouterContext`)
   - What's unclear: Whether this breaks with Next.js updates
   - Recommendation: Implement but test on each Next.js upgrade; consider next-view-transitions as alternative

2. **Satoshi Font Weight 450**
   - What we know: Reference uses font-weight: 450 for body text
   - What's unclear: Whether Satoshi variable font supports 450 or needs approximation
   - Recommendation: Test with variable font; fall back to 400 if 450 not supported

3. **v0 MCP Tool Integration**
   - What we know: User wants to use v0 MCP for component generation
   - What's unclear: Exact workflow for feeding reference images to v0
   - Recommendation: Planner should include v0 MCP usage in component creation tasks

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide) - @theme directive, breaking changes
- [Tailwind CSS v4 Font Family Docs](https://tailwindcss.com/docs/font-family) - Custom font configuration
- [CVA Documentation](https://cva.style/docs/getting-started/variants) - Variants, compoundVariants, TypeScript
- [Next.js Font Optimization](https://nextjs.org/docs/app/getting-started/fonts) - next/font/local setup
- [Motion Documentation](https://motion.dev/docs/react) - Motion/Framer Motion React integration

### Secondary (MEDIUM confidence)
- [Anatomy of shadcn/ui](https://manupa.dev/blog/anatomy-of-shadcn-ui) - cn() pattern, CVA + Radix architecture
- [Framer Motion Page Transitions in App Router](https://www.imcorfitz.com/posts/adding-framer-motion-page-transitions-to-next-js-app-router) - FrozenRouter pattern
- [Phosphor Icons GitHub](https://github.com/phosphor-icons/react) - SSR import, props API
- [Fontshare Satoshi](https://www.fontshare.com/fonts/satoshi) - Font licensing, variable font availability
- [Google Fonts Funnel Display](https://fonts.google.com/specimen/Funnel+Display) - Variable font, OFL license

### Tertiary (LOW confidence)
- WebSearch results on Next.js 16 page transitions - No specific v16 docs found; patterns from v14+ should work

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs
- Architecture: HIGH - Patterns verified via Context7, official docs, and established community usage
- Pitfalls: HIGH - Well-documented issues with official workarounds
- Page transitions: MEDIUM - FrozenRouter relies on Next.js internals

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - stable ecosystem, check for Next.js/Tailwind updates)
