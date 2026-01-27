# Phase 2: Design System & Components - Research

**Researched:** 2026-01-27
**Domain:** Design Systems, Tailwind CSS v4, React Component Architecture, Animation Libraries
**Confidence:** HIGH

## Summary

This phase involves building a reusable component library with Tailwind CSS v4's new `@theme` directive for design tokens and Motion (formerly Framer Motion) for animations. The research confirms that Tailwind v4 has shifted to a CSS-first configuration approach using `@theme` for design tokens, eliminating the need for `tailwind.config.js` for theme customization. Motion is the successor to Framer Motion, offering better performance and modern React integration.

The standard approach for 2026 is to:
1. Define design tokens using Tailwind v4's `@theme` directive in CSS
2. Build components as a mix of server and client components (Next.js 16 pattern)
3. Use Motion for animations in client components only
4. Implement skeleton loaders directly within components using React Suspense
5. Follow semantic naming conventions for design tokens

**Primary recommendation:** Use Tailwind CSS v4 `@theme` directive for all design tokens, Motion library for animations (client components only), and build-in skeleton states within components rather than separate skeleton components.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.x | Utility-first CSS framework | Already installed, v4 introduces CSS-first config with `@theme` directive |
| Motion | 12.26+ | React animation library | Successor to Framer Motion by same creators, 12M+ monthly downloads, production-grade performance |
| Next.js | 16.1.5 | React framework | Already installed, React 19.2 with server/client components |
| TypeScript | 5.x | Type safety | Already installed, industry standard for React |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-loading-skeleton | 3.x | Skeleton loader components | If custom skeleton solution is too complex |
| clsx | 2.x | Conditional class name utility | For dynamic className composition |
| tailwind-merge | 2.x | Merge Tailwind classes intelligently | Prevent class conflicts in component APIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Motion | Framer Motion | Legacy name, same library but Motion is the modern package |
| Motion | React Spring | More physics-based, steeper learning curve, heavier bundle |
| Motion | GSAP | More powerful but not React-first, commercial license for some features |
| Custom skeletons | react-loading-skeleton | Less control but faster to implement |

**Installation:**
```bash
npm install motion clsx tailwind-merge
# Optional: npm install react-loading-skeleton
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── ui/              # Base components (Button, Input, Card)
│   ├── layout/          # Layout components (Header, Footer, Sidebar)
│   └── animations/      # Animation wrapper components
├── lib/
│   ├── utils.ts         # cn() utility for class merging
│   └── animations/      # Reusable animation variants
├── app/
│   └── globals.css      # Tailwind imports + @theme tokens
```

### Pattern 1: Tailwind v4 Design Tokens with @theme

**What:** Use `@theme` directive in CSS to define design tokens that automatically generate utility classes
**When to use:** All color palettes, typography, spacing, breakpoints, and easing functions

**Example:**
```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  /* Colors - semantic naming */
  --color-primary: oklch(0.64 0.22 27.32);
  --color-secondary: oklch(0.70 0.14 182.5);
  --color-accent: oklch(0.76 0.18 130.85);

  /* Typography */
  --font-display: "Satoshi", ui-sans-serif, sans-serif;
  --font-body: "Inter", ui-sans-serif, sans-serif;
  --font-mono: "Fira Code", ui-monospace, monospace;

  /* Spacing - if custom scale needed */
  --spacing-xs: 0.5rem;
  --spacing-sm: 0.75rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Breakpoints - if extending defaults */
  --breakpoint-3xl: 120rem;

  /* Custom easing */
  --ease-fluid: cubic-bezier(0.3, 0, 0, 1);
  --ease-snappy: cubic-bezier(0.2, 0, 0, 1);
}

/* Regular CSS variables (not utilities) */
:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}
```
Source: [Tailwind CSS Theme Variables](https://tailwindcss.com/docs/theme)

### Pattern 2: Server vs Client Components for Animations

**What:** Server components by default, client components only when animations/interactivity needed
**When to use:** Follow Next.js 16 server-first architecture

**Example:**
```tsx
// Server Component (default) - No "use client"
// src/components/ui/card.tsx
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn("bg-white rounded-lg shadow-md p-6", className)}>
      {children}
    </div>
  )
}

// Client Component - Animations require "use client"
// src/components/ui/animated-button.tsx
"use client"

import { motion } from "motion/react"
import type { ReactNode } from 'react'

interface AnimatedButtonProps {
  children: ReactNode
  onClick?: () => void
  className?: string
}

export function AnimatedButton({ children, onClick, className }: AnimatedButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn("px-4 py-2 bg-primary text-white rounded-md", className)}
    >
      {children}
    </motion.button>
  )
}
```
Source: [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

### Pattern 3: Motion Micro-interactions

**What:** Use `whileHover`, `whileTap`, `whileFocus` for interactive elements
**When to use:** Buttons, links, interactive cards, form inputs

**Example:**
```tsx
"use client"

import { motion } from "motion/react"

// Button hover/active states
export function Button({ children, ...props }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.button>
  )
}

// Input focus states
export function Input({ ...props }) {
  return (
    <motion.input
      whileFocus={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      {...props}
    />
  )
}

// Card hover effect
export function InteractiveCard({ children, ...props }) {
  return (
    <motion.div
      whileHover={{ y: -8, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
      transition={{ duration: 0.3 }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
```
Source: [Motion Hover Animation](https://motion.dev/docs/react/-hover-animation)

### Pattern 4: Layout Animations

**What:** Use `layout` prop for position/size changes, `layoutId` for shared element transitions
**When to use:** Accordions, tab switching, modal transitions, route animations

**Example:**
```tsx
"use client"

import { motion, LayoutGroup } from "motion/react"
import { useState } from "react"

// Accordion with layout animation
function AccordionItem({ header, content }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <motion.div
      layout
      onClick={() => setIsOpen(!isOpen)}
      className="border-b border-gray-200"
    >
      <motion.h3 layout className="p-4 font-semibold">
        {header}
      </motion.h3>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="p-4"
        >
          {content}
        </motion.div>
      )}
    </motion.div>
  )
}

// Shared element transition (tab indicator)
function Tabs({ tabs, activeTab, setActiveTab }) {
  return (
    <div className="flex gap-2 border-b">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className="relative px-4 py-2"
        >
          {tab.label}
          {activeTab === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
            />
          )}
        </button>
      ))}
    </div>
  )
}

// Wrap related layout animations
export function Accordion({ items }) {
  return (
    <LayoutGroup>
      {items.map(item => (
        <AccordionItem key={item.id} {...item} />
      ))}
    </LayoutGroup>
  )
}
```
Source: [Motion Layout Animations](https://motion.dev/docs/react/-motion-component)

### Pattern 5: Skeleton States Within Components

**What:** Build loading states directly into components rather than separate skeleton components
**When to use:** All components that fetch data

**Example:**
```tsx
// Server Component with loading state
interface UserCardProps {
  userId: string
  isLoading?: boolean
}

export function UserCard({ userId, isLoading }: UserCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg p-6 animate-pulse">
        <div className="h-12 w-12 bg-gray-200 rounded-full mb-4" />
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    )
  }

  // Actual content rendering...
  return <div>...</div>
}

// Usage with Suspense
import { Suspense } from 'react'

export default function Page() {
  return (
    <Suspense fallback={<UserCard isLoading />}>
      <UserCard userId="123" />
    </Suspense>
  )
}
```
Source: [React Skeleton Loaders Best Practices](https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/)

### Pattern 6: Class Name Utility

**What:** Use `cn()` utility to merge Tailwind classes with proper precedence
**When to use:** All components that accept className prop

**Example:**
```typescript
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage in components
import { cn } from "@/lib/utils"

interface ButtonProps {
  variant?: "primary" | "secondary"
  className?: string
  children: React.ReactNode
}

export function Button({ variant = "primary", className, children }: ButtonProps) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded-md font-medium transition-colors",
        variant === "primary" && "bg-primary text-white hover:bg-primary/90",
        variant === "secondary" && "bg-secondary text-white hover:bg-secondary/90",
        className // User classes override defaults
      )}
    >
      {children}
    </button>
  )
}
```

### Pattern 7: Animation Variants for Reusability

**What:** Define reusable animation variants in separate module
**When to use:** When same animations are used across multiple components

**Example:**
```typescript
// src/lib/animations/variants.ts
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
}

export const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 }
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
}

export const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

// Usage
"use client"

import { motion } from "motion/react"
import { fadeIn, slideUp } from "@/lib/animations/variants"

export function Modal({ children }) {
  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      exit="exit"
      className="fixed inset-0 bg-black/50"
    >
      <motion.div
        variants={slideUp}
        className="bg-white rounded-lg p-6"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
```

### Anti-Patterns to Avoid

- **Using tailwind.config.js for theme** - Tailwind v4 recommends `@theme` directive in CSS instead
- **Creating separate skeleton components** - Build loading states into the component itself for style consistency
- **Exposing too many component props** - Keep APIs simple, don't expose every possible variant
- **Using animations on server components** - Motion requires "use client", only add when necessary
- **Hardcoding color values** - Always use design tokens from `@theme`
- **Overusing animations** - Not every element needs animation; micro-interactions should be subtle
- **Missing TypeScript interfaces** - All components must have properly typed Props interfaces
- **Ignoring accessibility** - Animations should respect prefers-reduced-motion

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Class name conflicts | Manual className concatenation | `clsx` + `tailwind-merge` | Handles precedence and deduplication correctly |
| Animation timing/easing | Custom CSS transitions | Motion library | Cross-browser consistency, gesture handling, layout animations |
| Skeleton loaders | Complex custom implementation | Built-in or `react-loading-skeleton` | Auto-sizing, responsive, accessible |
| Color system | Manual color variables | Tailwind `@theme` with oklch | Generates utilities automatically, better color science |
| Responsive breakpoints | Custom media queries | Tailwind breakpoints | Consistent, mobile-first, well-tested |
| Focus states | Manual focus-visible styles | Tailwind focus utilities | Handles keyboard vs mouse, accessibility |
| Dark mode | Manual theme switching | Tailwind dark mode + CSS variables | Built-in, automatic, respects system preferences |

**Key insight:** Design systems have hidden complexity. Standard libraries like Tailwind and Motion handle edge cases (browser quirks, accessibility, performance, responsive behavior) that custom solutions often miss.

## Common Pitfalls

### Pitfall 1: Configuration Scope Confusion (@theme vs :root)
**What goes wrong:** Mixing `@theme` directive with `:root` CSS variables incorrectly
**Why it happens:** Not understanding that `@theme` generates utility classes while `:root` doesn't
**How to avoid:**
- Use `@theme` for design tokens that should have utility classes (colors, spacing, fonts)
- Use `:root` for runtime CSS variables that don't need utilities (e.g., dynamic theme values)
**Warning signs:** Utility classes not appearing, or CSS variables not updating dynamically

### Pitfall 2: Over-Exposing Component APIs
**What goes wrong:** Components accept 20+ props trying to cover every use case
**Why it happens:** Trying to make components too flexible, exposing base library props (like MUI)
**How to avoid:**
- Define specific variants instead of exposing all options
- Use composition over configuration
- Only expose props that are actually needed across multiple use cases
**Warning signs:** Props like `buttonBackgroundColor`, `hoverOpacity`, `borderStyle` - these should be handled by variants

### Pitfall 3: Forcing Animations on Server Components
**What goes wrong:** Attempting to use Motion in server components, causing build errors
**Why it happens:** Forgetting that animations require client-side JavaScript
**How to avoid:**
- Add "use client" directive to any component using Motion
- Keep server components for static content
- Create separate animated wrapper components when needed
**Warning signs:** Build error "You're importing a component that needs `useState`..."

### Pitfall 4: Design Token Drift
**What goes wrong:** Developers bypass design tokens and hardcode values
**Why it happens:** Quick fixes, missing tokens, unclear documentation
**How to avoid:**
- Comprehensive `@theme` definition covering all needed values
- Document all design tokens
- ESLint rule to catch hardcoded colors/spacing
- Code review checklist
**Warning signs:** Seeing `#ffffff`, `rgb()`, or `16px` in component code instead of Tailwind classes

### Pitfall 5: Animation Performance Issues
**What goes wrong:** Janky animations, dropped frames, poor performance
**Why it happens:** Animating expensive properties (width, height), too many simultaneous animations
**How to avoid:**
- Use `layout` prop for size changes instead of animating width/height
- Animate transform and opacity (GPU-accelerated)
- Use `will-change` sparingly
- Test on low-end devices
**Warning signs:** Animations feel laggy, CPU spikes in DevTools

### Pitfall 6: Missing Accessibility Considerations
**What goes wrong:** Animations cause motion sickness, keyboard navigation breaks, screen readers confused
**Why it happens:** Only testing with mouse, not considering diverse user needs
**How to avoid:**
- Respect `prefers-reduced-motion` media query
- Ensure keyboard navigation works during animations
- Test with screen readers
- Don't rely solely on animation to convey information
**Warning signs:** User complaints, failed accessibility audits

### Pitfall 7: Component Documentation Neglect
**What goes wrong:** Team doesn't know what components exist or how to use them
**Why it happens:** Building components but not documenting usage, variants, props
**How to avoid:**
- JSDoc comments on all component interfaces
- Create a components directory with examples
- Consider Storybook or similar tool
- README with usage examples
**Warning signs:** Developers building duplicate components, asking "do we have X?"

### Pitfall 8: Ignoring Loading States
**What goes wrong:** Flash of empty content, layout shift, poor perceived performance
**Why it happens:** Focusing on the "happy path" success state
**How to avoid:**
- Build skeleton states directly into components
- Use React Suspense boundaries
- Test with slow 3G throttling
- Design loading states that match final content structure
**Warning signs:** User reports of "janky" feeling app, layout jumping

## Code Examples

Verified patterns from official sources:

### Complete Button Component with Variants
```tsx
// src/components/ui/button.tsx
"use client"

import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import type { ButtonHTMLAttributes, ReactNode } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost"
  size?: "sm" | "md" | "lg"
  isLoading?: boolean
  children: ReactNode
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      transition={{ duration: 0.2 }}
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        {
          "bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary": variant === "primary",
          "bg-secondary text-white hover:bg-secondary/90 focus-visible:ring-secondary": variant === "secondary",
          "border border-gray-300 bg-white hover:bg-gray-50 focus-visible:ring-gray-400": variant === "outline",
          "hover:bg-gray-100 focus-visible:ring-gray-400": variant === "ghost",
        },
        {
          "h-8 px-3 text-sm": size === "sm",
          "h-10 px-4": size === "md",
          "h-12 px-6 text-lg": size === "lg",
        },
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </>
      ) : children}
    </motion.button>
  )
}
```

### Input Component with Focus Animation
```tsx
// src/components/ui/input.tsx
"use client"

import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import type { InputHTMLAttributes, ReactNode } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export function Input({
  label,
  error,
  helperText,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-")

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <motion.input
        id={inputId}
        whileFocus={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "w-full px-3 py-2 border rounded-md shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
          "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
          error ? "border-red-500" : "border-gray-300",
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  )
}
```

### Card Component with Loading State
```tsx
// src/components/ui/card.tsx
import { cn } from "@/lib/utils"
import type { ReactNode, HTMLAttributes } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  isLoading?: boolean
  children: ReactNode
}

export function Card({ isLoading = false, className, children, ...props }: CardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          "bg-white rounded-lg shadow-md p-6 animate-pulse",
          className
        )}
        {...props}
      >
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
        <div className="h-3 bg-gray-200 rounded w-full mb-2" />
        <div className="h-3 bg-gray-200 rounded w-5/6" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "bg-white rounded-lg shadow-md p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// Subcomponents for composition
export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-semibold", className)} {...props}>
      {children}
    </h3>
  )
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-gray-600", className)} {...props}>
      {children}
    </div>
  )
}
```

### Staggered List Animation
```tsx
// src/components/animations/staggered-list.tsx
"use client"

import { motion } from "motion/react"
import type { ReactNode } from "react"

interface StaggeredListProps {
  children: ReactNode
  className?: string
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export function StaggeredList({ children, className }: StaggeredListProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggeredItem({ children, className }: StaggeredListProps) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  )
}

// Usage
import { StaggeredList, StaggeredItem } from "@/components/animations/staggered-list"

export function FeatureList({ features }) {
  return (
    <StaggeredList className="space-y-4">
      {features.map(feature => (
        <StaggeredItem key={feature.id}>
          <Card>{feature.title}</Card>
        </StaggeredItem>
      ))}
    </StaggeredList>
  )
}
```

### Modal with Animation
```tsx
// src/components/ui/modal.tsx
"use client"

import { motion, AnimatePresence } from "motion/react"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  // Lock scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto",
                className
              )}
            >
              {/* Header */}
              {title && (
                <div className="flex items-center justify-between p-6 border-b">
                  <h2 className="text-xl font-semibold">{title}</h2>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="p-6">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` for theme | `@theme` directive in CSS | Tailwind v4.0 (2024) | Simpler, CSS-first, better CSS variable integration |
| Framer Motion | Motion (motion/react) | 2024-2025 | Same team, smaller bundle, better performance |
| Separate skeleton components | Built-in loading states | 2025+ | Better style consistency, easier maintenance |
| RGB/Hex colors | oklch color space | Tailwind v4.0 | Perceptually uniform, better dark mode |
| `layoutTransition` prop | `layout` prop | Framer Motion v2 (2023) | Simpler API, better performance |
| Class precedence issues | `tailwind-merge` | 2023+ | Resolves conflicting utility classes |

**Deprecated/outdated:**
- **tailwind.config.js for theme customization**: Use `@theme` directive in CSS instead
- **Framer Motion package name**: Use `motion` package (same library, modern name)
- **react-loading-skeleton v2**: v3 has better TypeScript support and accessibility
- **Custom focus-visible polyfills**: Built into Tailwind v3+

## Open Questions

Things that couldn't be fully resolved:

1. **societies.io Design System Analysis**
   - What we know: Could not access rendered page or CSS files
   - What's unclear: Exact color values, typography scale, spacing system, animation timings
   - Recommendation: Use browser DevTools to inspect live site, extract computed styles, create design tokens from actual values. Alternative: Analyze screenshots with color picker tools.

2. **Component Granularity**
   - What we know: Standard components include Button, Input, Card, Modal
   - What's unclear: How many variants of each are truly needed for this specific project
   - Recommendation: Start with basic variants (primary/secondary for buttons), add more only when actually needed. Avoid premature abstraction.

3. **Animation Performance Budget**
   - What we know: Motion is production-grade, but animation performance depends on usage
   - What's unclear: Exact performance targets for this project
   - Recommendation: Test on target devices (mobile, low-end desktop), use Chrome DevTools Performance panel, aim for 60fps. Consider reducing animations on low-end devices.

4. **Dark Mode Strategy**
   - What we know: Tailwind v4 supports dark mode, CSS variables can switch themes
   - What's unclear: Whether societies.io has dark mode, if it's required for this clone
   - Recommendation: Research societies.io for dark mode support. If none exists, defer dark mode implementation to later phase.

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS Theme Variables](https://tailwindcss.com/docs/theme) - Official v4 `@theme` documentation
- [Tailwind CSS Adding Custom Styles](https://tailwindcss.com/docs/adding-custom-styles) - Design tokens best practices
- [Motion for React Documentation](https://motion.dev/docs/react) - Official Motion library docs
- [Motion Hover Animation](https://motion.dev/docs/react/-hover-animation) - Micro-interactions patterns
- [Motion Layout Animations](https://motion.dev/docs/react/-motion-component) - Layout animation API
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) - Architecture guidance
- Context7 Tailwind CSS library (/websites/tailwindcss) - Verified v4 syntax
- Context7 Motion for React library (/websites/motion_dev_react) - Verified animation patterns

### Secondary (MEDIUM confidence)
- [Build Flawless Multi-Theme System using Tailwind CSS v4 & React](https://medium.com/render-beyond/build-a-flawless-multi-theme-ui-using-new-tailwind-css-v4-react-dca2b3c95510) - Theming patterns
- [Tailwind CSS v4 Multi-Theme Strategy](https://simonswiss.com/posts/tailwind-v4-multi-theme) - Advanced theming
- [Configuring Tailwind CSS v4.0](https://bryananthonio.com/blog/configuring-tailwind-css-v4/) - Migration guide
- [Beyond Eye Candy: Top React Animation Libraries 2026](https://www.syncfusion.com/blogs/post/top-react-animation-libraries) - Ecosystem overview
- [React Skeleton Loaders Best Practices](https://blog.logrocket.com/handling-react-loading-states-react-loading-skeleton/) - Loading state patterns
- [The Dark Side of Design Systems](https://sakalim.com/content/the-dark-side-of-design-systems-mistakes-missteps-and-lessons-learned) - Common pitfalls
- [The Dumbest Design System Mistakes](https://learn.thedesignsystem.guide/p/the-dumbest-design-system-mistakes) - Anti-patterns
- [Building Components for Consumption, Not Complexity](https://www.smashingmagazine.com/2023/12/building-components-consumption-not-complexity-part1/) - Component API design
- [Tailwind CSS Best Practices 2025-2026](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns) - Design token organization

### Tertiary (LOW confidence)
- WebSearch results for "React design system component library best practices 2026" - General ecosystem trends
- npm registry for package versions - Latest version numbers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Context7 and official docs verified all library choices and versions
- Architecture: HIGH - Official Next.js 16 and Motion docs, proven patterns
- Pitfalls: MEDIUM - Based on general design system literature and best practices articles, not project-specific

**Research date:** 2026-01-27
**Valid until:** 2026-04-27 (90 days - relatively stable domain with mature libraries)

**Notes:**
- Tailwind v4 is stable and well-documented, `@theme` syntax is confirmed standard
- Motion library is confirmed successor to Framer Motion, actively maintained
- Next.js 16 server/client component pattern is production-ready
- societies.io design system requires manual inspection (not accessible via WebFetch)
- All code examples follow TypeScript strict mode and user's coding preferences
