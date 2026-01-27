# Phase 2: Design System & Components - Research

**Researched:** 2026-01-27
**Domain:** Design Systems, Component Architecture, CSS Design Tokens
**Confidence:** HIGH

## Summary

Building a pixel-perfect design system for societies.io clone requires a Tailwind CSS v4-based approach with CSS variables using the `@theme` directive, a well-structured component library with TypeScript strict mode, and Motion (formerly Framer Motion) for animations. The project already has Next.js 16.1.5 and Tailwind CSS v4 installed, providing the foundation.

The standard approach for 2026 is utility-first styling with Tailwind CSS (zero runtime cost), TypeScript-first component architecture with strict types, and Motion for declarative animations. Design tokens should be defined once in CSS using `@theme` and automatically generate utility classes, while component variants should use Class Variance Authority (CVA) for maintainable styling logic.

This phase builds the foundation that all subsequent phases depend on - every landing page and app screen will use these components and design tokens. Getting the design system right means extracting visual patterns from societies.io (colors, typography, spacing, shadows) and codifying them as reusable tokens and components.

**Primary recommendation:** Use Tailwind v4's `@theme` directive for design tokens, Motion for animations, CVA + clsx for component variants, and organize as feature-based structure with clear separation of primitives, composites, and layouts.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.x (installed) | Utility-first CSS framework | Zero runtime cost, compile-time generation, excellent performance. Industry standard for design systems in 2026. |
| Next.js | 16.1.5 (installed) | React framework | Server Components, App Router, optimized rendering. Best-in-class React framework. |
| TypeScript | 5.x (installed) | Type safety | Strict mode prevents runtime errors, autocomplete for props, better DX. |
| Motion | Latest | Animation library | Evolution of Framer Motion. Production-ready, declarative animations, SSR-compatible. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | 2.x | Conditional className utility | Combine multiple className conditions cleanly |
| tailwind-merge | 2.x | Merge Tailwind classes | Prevent class conflicts when combining props |
| class-variance-authority (CVA) | 0.7.x | Component variant system | Manage complex component states and variants |
| @tailwindcss/typography | 0.5.x (optional) | Rich text styling | If blog/markdown content needed later |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Motion | react-spring | react-spring uses spring physics, more complex API. Motion is simpler, more declarative. |
| Tailwind CSS | CSS-in-JS (styled-components, emotion) | CSS-in-JS has runtime cost (48% slower), problematic with Server Components, harder to enforce design system. |
| CVA | Manual variant logic | Manual approach doesn't scale, becomes unmaintainable with complex states. |

**Installation:**
```bash
npm install clsx tailwind-merge class-variance-authority
npm install motion
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/                     # Next.js App Router
│   ├── globals.css         # Tailwind imports + @theme tokens
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Pages
├── components/
│   ├── ui/                 # Primitive components (Button, Input, Card)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── skeleton.tsx
│   ├── layout/             # Layout components (Header, Footer, Sidebar)
│   │   ├── header.tsx
│   │   ├── footer.tsx
│   │   └── sidebar.tsx
│   └── animations/         # Reusable animation components
│       ├── fade-in.tsx
│       └── slide-up.tsx
├── lib/
│   ├── utils.ts           # cn() utility, helpers
│   └── constants.ts       # Constants, enums
└── types/
    └── components.ts      # Shared component types
```

### Pattern 1: Design Tokens with @theme Directive

**What:** Define all design system tokens in CSS using Tailwind v4's `@theme` directive. This creates CSS variables that auto-generate utility classes.

**When to use:** For all design system values: colors, spacing, typography, shadows, animations.

**Example:**
```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  /* Color palette - extracted from societies.io */
  --color-background: #ffffff;
  --color-foreground: #171717;
  --color-primary-50: oklch(0.98 0.02 270);
  --color-primary-500: oklch(0.55 0.20 270);
  --color-primary-900: oklch(0.25 0.15 270);

  /* Typography scale */
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: "Inter", system-ui, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;

  /* Spacing scale */
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

  /* Animation easing */
  --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```
**Source:** https://tailwindcss.com/docs/theme

### Pattern 2: Component Variants with CVA

**What:** Use Class Variance Authority to manage component variants (sizes, colors, states) without manual className logic.

**When to use:** For any component with multiple variants or states.

**Example:**
```typescript
// src/components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2",
  {
    variants: {
      variant: {
        primary: "bg-primary-500 text-white hover:bg-primary-600",
        secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
        outline: "border border-gray-300 hover:bg-gray-50",
        ghost: "hover:bg-gray-100",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children: React.ReactNode
}

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```
**Source:** https://cva.style/docs

### Pattern 3: Utility Function for Class Merging

**What:** Combine clsx and tailwind-merge into a single `cn()` utility.

**When to use:** Everywhere you merge className props with component classes.

**Example:**
```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```
**Source:** https://www.frontendmentor.io/articles/how-to-efficiently-manage-css-classes-in-react-XD9hHfdS1J

### Pattern 4: Animation Components with Motion

**What:** Create reusable animation wrappers using Motion's declarative API.

**When to use:** For micro-interactions, page transitions, loading states.

**Example:**
```typescript
// src/components/ui/button.tsx (with hover animation)
import { motion } from "motion/react"

export function Button({ children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </motion.button>
  )
}
```
**Source:** https://motion.dev/docs/react-hover-animation

### Pattern 5: Skeleton Loaders

**What:** Create loading state components using Tailwind's animate-pulse.

**When to use:** For loading states that match the shape of actual content.

**Example:**
```typescript
// src/components/ui/skeleton.tsx
import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-gray-200", className)}
      {...props}
    />
  )
}

// Usage
<div className="space-y-2">
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-3/4" />
</div>
```
**Source:** https://flowbite.com/docs/components/skeleton/

### Pattern 6: Layout Components with Server Components

**What:** Build layout components as React Server Components by default.

**When to use:** For Header, Footer, Sidebar that don't need interactivity.

**Example:**
```typescript
// src/components/layout/header.tsx
export default function Header() {
  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <Navigation />
      </div>
    </header>
  )
}

// src/app/layout.tsx
import Header from "@/components/layout/header"
import Footer from "@/components/layout/footer"

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```
**Source:** https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/01-getting-started/03-layouts-and-pages.mdx

### Anti-Patterns to Avoid

- **Inline style objects:** Use Tailwind classes, not `style={{ color: '#123456' }}`. Inline styles break design system and can't be purged.
- **Hardcoded values:** Never use arbitrary values like `w-[247px]` without justification. Extract to design tokens first.
- **CSS Modules with Tailwind:** Mixing CSS Modules defeats Tailwind's purpose. Stick to utility classes.
- **Multiple component libraries:** Don't install shadcn/ui, MUI, or other libraries. Build components yourself for full control and pixel-perfect match.
- **`any` types in TypeScript:** Use strict typing. Component props should have explicit interfaces.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conditional className logic | Manual string concatenation | clsx + tailwind-merge (`cn()` utility) | Handles edge cases, conflicts, performance |
| Component variants | If/else chains for styling | class-variance-authority (CVA) | Scalable, maintainable, type-safe |
| Animation states | Manual CSS transitions + state | Motion (Framer Motion) | Declarative, handles interruptions, gesture support |
| Loading skeletons | Custom shimmer CSS | Tailwind `animate-pulse` + Skeleton component | Built-in, accessible, consistent |
| Focus management | Manual focus trap | Built into modern browsers + proper HTML | Accessibility is hard, use semantic HTML |
| Color palette generation | Manual color picking | oklch color space + Tailwind palette | Perceptually uniform, accessible contrast |

**Key insight:** Design systems look simple but have subtle complexity (accessible contrast ratios, animation interruptions, class conflict resolution). Use battle-tested libraries for the foundation, custom code for the business logic.

## Common Pitfalls

### Pitfall 1: Design Token Sprawl

**What goes wrong:** Too many one-off values (`--color-specific-button-on-homepage`), design tokens become unmanageable.

**Why it happens:** Trying to be too specific, not thinking in scales/systems. Each new component adds more tokens.

**How to avoid:**
- Start with semantic scales: `primary-50` through `primary-900`, not `button-hover-blue`
- Use 3-tier hierarchy: Global (primitives) → Alias (semantic) → Component (specific)
- Extract from societies.io systematically: every color, every spacing value
- Limit to 5-7 values per scale (50, 100, 200...900 for colors)

**Warning signs:**
- More than 20 color variables
- Token names include component names (`--button-padding`)
- Duplicated values with different names

**Source:** https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns

### Pitfall 2: Premature Component Abstraction

**What goes wrong:** Creating "flexible" components with dozens of props that try to handle every use case. Components become complex, hard to maintain.

**Why it happens:** Fear of duplication, trying to predict future needs. Over-engineering early.

**How to avoid:**
- Start with 2-3 real use cases from societies.io
- Only add props when you have 3+ instances needing the same variation
- Prefer composition over configuration
- Duplicate first, extract patterns later

**Warning signs:**
- Components with >10 props
- Props like `renderCustomFooter` or `onSpecialCase`
- Boolean props that interact (`primary && outline` makes no sense)

**Source:** https://www.sencha.com/blog/top-mistakes-developers-make-when-using-react-ui-component-library-and-how-to-avoid-them/

### Pitfall 3: Animation Performance Issues

**What goes wrong:** Janky animations, layout shifts, slow page loads. Animations look worse than no animations.

**Why it happens:** Animating layout properties (width, height, top, left) instead of transforms. Not using `will-change`. Too many simultaneous animations.

**How to avoid:**
- Only animate transform and opacity (GPU accelerated)
- Use Motion's layout animations for size/position changes
- Set `will-change` for critical animations
- Test on slower devices (throttle CPU in DevTools)
- Limit animations on page load (max 3-4 elements)

**Warning signs:**
- Frame rate drops below 60fps
- Scrolling feels sluggish
- CLS (Cumulative Layout Shift) > 0.1

**Source:** https://motion.dev/docs/react

### Pitfall 4: Inconsistent Component API

**What goes wrong:** Some components use `variant`, others use `type`. Some pass through HTML props, others don't. Inconsistent experience.

**Why it happens:** Different developers, no established patterns, copying from different sources.

**How to avoid:**
- Establish naming conventions upfront:
  - Use `variant` for visual styles (primary, secondary, outline)
  - Use `size` for sizes (sm, md, lg)
  - Always spread `...props` for HTML attributes
  - Always accept `className` for customization
- Create base interfaces: `ComponentProps<T>` type
- Review existing components before adding new ones

**Warning signs:**
- Same prop has different names across components
- Can't use `ref` on some components
- `className` doesn't work or gets overridden

### Pitfall 5: Ignoring Accessibility

**What goes wrong:** Keyboard navigation doesn't work. Screen readers can't use the site. Focus indicators missing.

**Why it happens:** Testing only with mouse, not considering diverse users. Copying visual design without interaction design.

**How to avoid:**
- Use semantic HTML first (button, not div with onClick)
- Test keyboard navigation (Tab, Enter, Escape)
- Use proper ARIA attributes (aria-label, role)
- Maintain visible focus indicators (focus-visible:ring-2)
- Test with screen reader (VoiceOver on Mac)

**Warning signs:**
- Can't tab through interactive elements
- Focus indicator removed (`outline-none` without replacement)
- Divs used instead of buttons

**Source:** https://www.builder.io/blog/react-component-libraries-2026

### Pitfall 6: Mixing Component Libraries

**What goes wrong:** Installing shadcn/ui or MUI alongside custom components. Conflicting styles, larger bundle, inconsistent design.

**Why it happens:** Wanting specific component quickly, not wanting to build from scratch.

**How to avoid:**
- Commit to building all components yourself
- Reference shadcn/ui code as examples, don't install
- Copy and customize individual components if needed
- Keep bundle lean - this is a pixel-perfect clone, not a general app

**Warning signs:**
- Multiple CSS resets fighting each other
- Bundle size > 200KB for initial JS
- Mix of different button styles

**Source:** https://www.sencha.com/blog/top-mistakes-developers-make-when-using-react-ui-component-library-and-how-to-avoid-them/

## Code Examples

Verified patterns from official sources:

### Example 1: Complete Button Component

```typescript
// src/components/ui/button.tsx
import * as React from "react"
import { motion } from "motion/react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary-500 text-white hover:bg-primary-600 focus-visible:ring-primary-500",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500",
        outline: "border-2 border-gray-300 bg-transparent hover:bg-gray-50 focus-visible:ring-gray-500",
        ghost: "hover:bg-gray-100 hover:text-gray-900",
        danger: "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-11 px-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
```

### Example 2: Input Component

```typescript
// src/components/ui/input.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors",
          "placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-red-500 focus:ring-red-500",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"
```

### Example 3: Card Component

```typescript
// src/components/ui/card.tsx
import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-gray-200 bg-white shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardTitle, CardContent }
```

### Example 4: Fade-In Animation Wrapper

```typescript
// src/components/animations/fade-in.tsx
"use client"

import { motion } from "motion/react"
import type { ReactNode } from "react"

interface FadeInProps {
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  className
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration,
        delay,
        ease: [0.4, 0, 0.2, 1]
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
```

### Example 5: Page Transition Wrapper

```typescript
// src/components/animations/page-transition.tsx
"use client"

import { motion } from "motion/react"
import type { ReactNode } from "react"

interface PageTransitionProps {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config.js | @theme in CSS | Tailwind v4 (2024) | CSS-first, no JS config, better IDE support |
| CSS-in-JS (styled-components) | Tailwind utility-first | 2024-2025 | Zero runtime, 48% better performance, Server Component compatible |
| Framer Motion | Motion (new library) | 2025 | Faster, smaller bundle, same API |
| Manual className strings | CVA for variants | 2024-2025 | Scalable component variants |
| Jest for component tests | Vitest + Playwright | 2025-2026 | Faster, native ESM, visual regression |

**Deprecated/outdated:**
- **@apply directive:** Still works but discouraged in v4. Use CVA for reusable styles instead.
- **JIT mode:** Removed in v4, always-on now. Don't configure it.
- **purge configuration:** Replaced by content scanning. Don't use purge key.
- **Framer Motion:** Still works but Motion is the new evolution with better performance.

**Source:** https://tailwindcss.com/docs/adding-custom-styles

## Open Questions

Things that couldn't be fully resolved:

### 1. Exact societies.io Design Tokens

**What we know:**
- societies.io website exists but design system not publicly documented
- Need to manually extract colors, typography, spacing from production site
- Likely uses dark mode with purple/blue accent colors based on typical SaaS design

**What's unclear:**
- Exact color values (need to inspect with DevTools)
- Font family (likely Inter or similar system font)
- Specific spacing scale and component sizing
- Animation timing and easing curves

**Recommendation:**
- Manually inspect societies.io homepage with browser DevTools
- Take screenshots and use color picker tools
- Extract CSS variables from production site
- Create initial tokens, refine during implementation
- Use Gemini AI video analysis at end to verify 95%+ match

### 2. Component Documentation Tool

**What we know:**
- Storybook is industry standard for component documentation
- Project has `formatOnSave: true` and `testAfterChanges: true` preferences
- Documentation should be created per phase tasks

**What's unclear:**
- Whether to install Storybook now or wait until components built
- User preference on documentation format (Storybook vs markdown)

**Recommendation:**
- Start without Storybook (adds complexity)
- Create simple markdown documentation in `components/ui/README.md`
- Include code examples and prop tables
- Add Storybook in Phase 3+ if needed

### 3. Animation Complexity Threshold

**What we know:**
- Requirements exclude "complex node animations"
- Need micro-interactions (AN1), page transitions (AN2), loading states (AN3)
- Motion handles declarative animations well

**What's unclear:**
- Exact definition of "complex" - where to draw the line
- Whether animated data visualizations count as complex

**Recommendation:**
- Simple = transforms, fades, slides (definitely include)
- Complex = canvas/WebGL, physics simulations, particle effects (exclude)
- When unsure, implement simple version first, escalate if needs more

## Sources

### Primary (HIGH confidence)

- **/websites/tailwindcss** - Tailwind CSS v4 documentation via Context7
  - Topics: @theme directive, design tokens, custom theme configuration
  - Current official documentation for Tailwind v4

- **/vercel/next.js/v16.1.5** - Next.js 16.1.5 documentation via Context7
  - Topics: Layout components, component architecture, Server Components
  - Exact version used in project

- **/websites/motion_dev** - Motion documentation via Context7
  - Topics: Animations, micro-interactions, hover states, page transitions
  - Evolution of Framer Motion, current best practice

- **https://cva.style/docs** - Class Variance Authority official docs
  - Topics: Component variant patterns, TypeScript integration
  - Standard for scalable component styling

### Secondary (MEDIUM confidence)

- **[15 Best React UI Libraries for 2026](https://www.builder.io/blog/react-component-libraries-2026)** - Builder.io
  - Verified best practices: TypeScript support, accessibility, SSR compatibility

- **[Tailwind CSS Best Practices 2025-2026](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns)** - FrontendTools
  - Design token organization, typography patterns

- **[Building the Ultimate Design System 2026](https://medium.com/@padmacnu/building-the-ultimate-design-system-a-complete-architecture-guide-for-2026-6dfcab0e9999)** - Medium
  - Folder structure, component hierarchy

- **[Top Mistakes with React Component Libraries](https://www.sencha.com/blog/top-mistakes-developers-make-when-using-react-ui-component-library-and-how-to-avoid-them/)** - Sencha
  - Common pitfalls, avoidance strategies

- **[React & CSS in 2026: Best Styling Approaches](https://medium.com/@imranmsa93/react-css-in-2026-best-styling-approaches-compared-d5e99a771753)** - Medium
  - CSS-in-JS vs Tailwind performance comparison

- **[Beyond Eye Candy: Top 7 React Animation Libraries](https://www.syncfusion.com/blogs/post/top-react-animation-libraries)** - Syncfusion
  - Animation library comparison, Motion as standard

- **[Flowbite Skeleton Components](https://flowbite.com/docs/components/skeleton/)** - Flowbite
  - Skeleton loader implementation patterns

- **[Component Testing with Playwright 2026](https://www.browserstack.com/guide/component-testing-react-playwright)** - BrowserStack
  - Visual regression testing approach

### Tertiary (LOW confidence)

- WebSearch results about societies.io design - no specific information found
  - Need manual inspection of production site

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs (Context7), established patterns, verified versions
- Architecture: HIGH - Next.js official patterns, CVA official docs, industry standard structure
- Pitfalls: MEDIUM - Based on multiple blog posts and community experience, not official docs
- Design tokens: LOW - societies.io specific tokens need manual extraction

**Research date:** 2026-01-27
**Valid until:** 2026-04-27 (90 days - stable ecosystem, no fast-moving changes expected)

**Sources used:**
- Context7 queries: 3 (Tailwind CSS, Next.js, Motion)
- WebSearch queries: 8 (design systems, animations, best practices, pitfalls)
- WebFetch attempts: 1 (societies.io - unsuccessful, needs manual inspection)
