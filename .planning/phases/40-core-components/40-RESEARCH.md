# Phase 40: Core Components - Research

**Researched:** 2026-02-03
**Domain:** React component library with TypeScript, CVA variants, Radix UI accessibility
**Confidence:** HIGH

## Summary

Phase 40 builds foundational UI components (Button, Card, GlassCard, Input, Badge, Typography, Icon system, Spinner) on top of the token system established in Phase 39. The codebase already has partial implementations in both `src/components/ui/` (shadcn-style) and `src/components/primitives/` (Glass-prefixed components). The challenge is consolidating these into a unified component API that matches Raycast's styling 1:1, uses coral only where Raycast uses their accent red, and meets all accessibility requirements.

Key patterns established in the codebase:
- **CVA (class-variance-authority)** for variant management with TypeScript
- **Radix UI primitives** for accessible behavior (accordion, dialog, dropdown)
- **forwardRef pattern** for all components needing ref access
- **cn() utility** (clsx + tailwind-merge) for class composition
- **Semantic tokens** via CSS variables in `globals.css`

**Primary recommendation:** Enhance existing `src/components/ui/` components rather than creating new ones. Add missing variants, improve TypeScript types, add JSDoc documentation, and ensure 44x44px touch targets on all interactive elements.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| class-variance-authority | 0.7.1 | Type-safe variant management | Already in codebase, provides VariantProps type extraction |
| @radix-ui/react-slot | 1.2.4 | asChild prop pattern for composition | Already in Button, enables polymorphic components |
| tailwind-merge | 3.4.0 | Tailwind class conflict resolution | Already in cn() utility |
| clsx | 2.1.1 | Conditional class joining | Already in cn() utility |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @phosphor-icons/react | 2.1.10 | Icon system | Already installed, used in existing components |
| lucide-react | 0.563.0 | Alternative icon set | Already installed, used alongside Phosphor |
| @radix-ui/react-* | various | Accessible primitives | For complex interactive components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CVA | Tailwind variants plugin | CVA is already established in codebase |
| Phosphor Icons | Heroicons | Phosphor already used throughout, more macOS-aligned |
| Manual ARIA | Radix primitives | Radix provides battle-tested accessibility |

**Installation:**
```bash
# All dependencies already installed - no new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/ui/
├── index.ts           # Re-exports all components and types
├── button.tsx         # Button with variants (CVA pattern)
├── card.tsx           # Card + GlassCard variants
├── input.tsx          # Input with label/helper/error
├── badge.tsx          # Badge with semantic colors
├── typography.tsx     # Heading, Text, Caption, Code
├── spinner.tsx        # Loader with sizes/modes
└── icon.tsx           # Icon wrapper pattern
```

### Pattern 1: CVA Component with forwardRef
**What:** Standard pattern for variant-based components with TypeScript
**When to use:** All components with visual variants

```typescript
// Source: Existing button.tsx pattern in codebase
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base classes always applied
  "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
        secondary: "bg-surface border border-border hover:bg-hover",
        ghost: "bg-transparent hover:bg-hover",
        destructive: "bg-error text-white hover:bg-error/90",
      },
      size: {
        sm: "h-9 min-w-[36px] px-3 text-sm rounded-md",
        md: "h-11 min-w-[44px] px-4 text-sm rounded-md", // 44px min height
        lg: "h-12 min-w-[48px] px-6 text-base rounded-lg",
      },
    },
    defaultVariants: {
      variant: "secondary", // NOT primary - follow Raycast accent usage
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render as child element for composition */
  asChild?: boolean;
  /** Show loading spinner */
  loading?: boolean;
}

/**
 * Button component with Raycast-style variants
 *
 * @example
 * <Button variant="primary">Get Started</Button>
 *
 * @example
 * <Button variant="ghost" size="sm">Cancel</Button>
 *
 * @example
 * <Button loading disabled>Processing...</Button>
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <Spinner className="mr-2 h-4 w-4" aria-hidden="true" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

### Pattern 2: Compound Component (Card with sub-components)
**What:** Components with related sub-components exported together
**When to use:** Card, Form fields, complex layouts

```typescript
// Pattern from existing card.tsx + enhancement
const Card = React.forwardRef<HTMLDivElement, CardProps>(/* ... */);
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(/* ... */);
const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(/* ... */);
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(/* ... */);

// Export together
export { Card, CardHeader, CardContent, CardFooter };
```

### Pattern 3: Input with Field Wrapper
**What:** Input component wrapped with label, helper text, error message
**When to use:** Form inputs requiring accessible labeling

```typescript
export interface InputFieldProps extends InputProps {
  label?: string;
  helperText?: string;
  error?: string | boolean;
}

/**
 * Input field with label, helper text, and error state
 *
 * @example
 * <InputField
 *   label="Email"
 *   helperText="We'll never share your email"
 *   type="email"
 * />
 *
 * @example
 * <InputField
 *   label="Password"
 *   type="password"
 *   error="Password must be at least 8 characters"
 * />
 */
```

### Pattern 4: Icon Integration
**What:** Wrapper pattern for consistent icon sizing and accessibility
**When to use:** All icon usage in components

```typescript
import { type Icon as PhosphorIcon } from "@phosphor-icons/react";

export interface IconProps {
  /** Phosphor icon component */
  icon: PhosphorIcon;
  /** Size in pixels (default: 20) */
  size?: 16 | 20 | 24 | 32;
  /** Icon weight (default: regular) */
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  /** Accessible label (required if not decorative) */
  label?: string;
  className?: string;
}

/**
 * Icon wrapper for consistent sizing and accessibility
 *
 * @example
 * // Decorative icon (hidden from AT)
 * <Icon icon={MagnifyingGlass} />
 *
 * @example
 * // Meaningful icon
 * <Icon icon={Warning} label="Warning" className="text-warning" />
 */
```

### Anti-Patterns to Avoid

- **Hardcoding colors:** Never use raw colors like `bg-red-500`. Always use semantic tokens: `bg-error`, `text-foreground`, `border-border`.
- **Missing touch targets:** All interactive elements MUST be minimum 44x44px. Use `min-h-11 min-w-11` (44px) or larger.
- **Primary button default:** Raycast does NOT make accent color the default button. Use `secondary` as default variant.
- **Missing loading state:** Buttons should support `loading` prop with aria-busy.
- **Inline styles for tokens:** Use Tailwind classes that reference CSS variables, not inline style objects.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus management | Manual focus trap | Radix Dialog/AlertDialog | Focus trap, escape handling, scroll lock |
| Keyboard navigation | Custom key handlers | Radix primitives | Arrow keys, home/end, typeahead |
| Class merging | String concatenation | cn() with tailwind-merge | Handles Tailwind conflicts correctly |
| Variant types | Manual union types | VariantProps<typeof variants> | Auto-extracted from CVA definition |
| Loading spinner | CSS animation | Existing Spinner or lucide Loader2 | Accessible, performant |
| Form validation | Manual validation | zod (already installed) | Type-safe schema validation |

**Key insight:** The codebase already has solutions for most infrastructure. Focus on enhancing existing patterns, not creating parallel implementations.

## Common Pitfalls

### Pitfall 1: Coral as Default Button Color
**What goes wrong:** Making coral (#FF7F50) the primary/default button color
**Why it happens:** Assuming "brand color = default button color"
**How to avoid:** Follow Raycast's pattern - accent color is used sparingly, not as default button background. Default should be `secondary` variant (surface color with border).
**Warning signs:** Button component has `primary` as defaultVariant

### Pitfall 2: Sub-44px Touch Targets
**What goes wrong:** Buttons/inputs smaller than 44x44px fail accessibility
**Why it happens:** Using only padding without min-height/min-width
**How to avoid:** Always include `min-h-11` (44px) on interactive elements. For small visual buttons, increase touch target with padding.
**Warning signs:** `h-9` (36px) or smaller heights without compensating padding

### Pitfall 3: Missing aria-label on Icon Buttons
**What goes wrong:** Icon-only buttons have no accessible name
**Why it happens:** Assuming visual icon is sufficient
**How to avoid:** Always provide aria-label on icon-only buttons: `<button aria-label="Close">`
**Warning signs:** Button with only Icon child and no text or aria-label

### Pitfall 4: Primitive Tokens in Components
**What goes wrong:** Using `bg-gray-900` instead of `bg-surface`
**Why it happens:** Copying Tailwind examples directly
**How to avoid:** Always use semantic tokens from globals.css. Check available tokens in STATE.md.
**Warning signs:** Tailwind classes with numeric color scales (gray-900, coral-500) instead of semantic names

### Pitfall 5: Duplicate Component Implementations
**What goes wrong:** Creating new components when similar ones exist
**Why it happens:** Not checking src/components/primitives/ alongside src/components/ui/
**How to avoid:** Before creating new component, search entire codebase for existing implementations
**Warning signs:** Multiple Button.tsx or GlassButton.tsx files in different directories

### Pitfall 6: Missing Loading/Error States
**What goes wrong:** Components lack visual feedback for async operations
**Why it happens:** Only implementing happy path
**How to avoid:** Include loading, error, disabled states in initial implementation
**Warning signs:** Component only has default/hover states, no loading spinner support

## Code Examples

Verified patterns from existing codebase:

### Button with Loading State
```typescript
// Pattern from extraction + accessibility requirements
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);
```

### GlassCard with Raycast Glassmorphism
```typescript
// Source: 39-EXTRACTION-DATA.md + existing GlassCard.tsx
// Navbar glass pattern (most common)
const glassStyles = {
  backdropFilter: "blur(5px)", // Navbar uses 5px
  WebkitBackdropFilter: "blur(5px)", // Safari support
  background: "linear-gradient(137deg, rgba(17, 18, 20, 0.75) 4.87%, rgba(12, 13, 15, 0.9) 75.88%)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  boxShadow: "rgba(255, 255, 255, 0.15) 0px 1px 1px 0px inset",
};
```

### Badge with Semantic Variants
```typescript
// Based on existing GlassBadge.tsx pattern
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full font-medium text-xs",
  {
    variants: {
      variant: {
        default: "bg-surface text-foreground-secondary border border-border",
        success: "bg-success/10 text-success border border-success/20",
        warning: "bg-warning/10 text-warning border border-warning/20",
        error: "bg-error/10 text-error border border-error/20",
        info: "bg-info/10 text-info border border-info/20",
      },
      size: {
        sm: "h-5 px-2 text-[10px]", // Min 20px height
        md: "h-6 px-2.5 text-[11px]", // Min 24px height
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);
```

### Typography Components
```typescript
// Based on extraction data typography scale
interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

const headingStyles: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
  1: "text-5xl font-semibold leading-tight tracking-tight font-display", // 48px
  2: "text-4xl font-semibold leading-tight tracking-tight font-display", // 36px
  3: "text-2xl font-medium leading-snug", // 24px
  4: "text-xl font-medium leading-snug", // 20px
  5: "text-lg font-medium leading-normal", // 18px
  6: "text-base font-medium leading-normal", // 16px
};

/**
 * Semantic heading component with proper heading level
 *
 * @example
 * <Heading level={1}>Page Title</Heading>
 * <Heading level={2}>Section Title</Heading>
 */
```

### Spinner/Loader Component
```typescript
// Based on GlassProgress circular pattern
interface SpinnerProps {
  /** Size in pixels */
  size?: "sm" | "md" | "lg";
  /** Determinate progress (0-100) or undefined for indeterminate */
  value?: number;
  /** Accessible label */
  label?: string;
}

const sizeMap = { sm: 16, md: 24, lg: 32 };

/**
 * Loading spinner with determinate/indeterminate modes
 *
 * @example
 * // Indeterminate (loading)
 * <Spinner size="md" label="Loading..." />
 *
 * @example
 * // Determinate (progress)
 * <Spinner value={75} label="75% complete" />
 */
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| className strings | CVA with VariantProps | 2023 | Type-safe variants |
| Manual ARIA | Radix UI primitives | 2022 | Battle-tested accessibility |
| CSS modules | Tailwind v4 @theme | 2024 | CSS variable tokens |
| Custom blur | backdrop-filter | Safari 15+ (2021) | Native glassmorphism |
| 36px touch targets | 44px minimum | WCAG 2.2 (2023) | Level AA compliance |

**Deprecated/outdated:**
- Using `@apply` heavily: Tailwind v4 recommends @theme tokens over @apply
- Custom focus rings: Use Tailwind's focus-visible: utilities
- Manual scroll lock: Use Radix Dialog which handles this

## Open Questions

1. **Component Location**
   - What we know: Both `src/components/ui/` and `src/components/primitives/` exist
   - What's unclear: Should Phase 40 enhance ui/ or create in primitives/?
   - Recommendation: Enhance ui/ components (they're the primary exports), mark primitives/ Glass* components as internal/advanced

2. **Icon System Choice**
   - What we know: Both @phosphor-icons and lucide-react are installed
   - What's unclear: Should we standardize on one?
   - Recommendation: Phosphor for app icons (matches macOS aesthetic), Lucide for utility icons (close, chevron)

3. **Loading State Animation**
   - What we know: CSS animations work, framer-motion is available
   - What's unclear: Performance impact of many spinners
   - Recommendation: Use CSS animations for spinners (already in GlassProgress), reserve framer-motion for page transitions

## Sources

### Primary (HIGH confidence)
- `/Users/davideloreti/virtuna-v1.1/src/components/ui/button.tsx` - Existing CVA pattern
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassCard.tsx` - Glass pattern
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassBadge.tsx` - Badge variants
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassInput.tsx` - Input with states
- `/Users/davideloreti/virtuna-v1.1/src/app/globals.css` - Token system (two-tier architecture)
- `/Users/davideloreti/virtuna-v1.1/.planning/phases/39-token-foundation/39-EXTRACTION-DATA.md` - Raycast extraction values

### Secondary (MEDIUM confidence)
- [Radix UI Accessibility Documentation](https://www.radix-ui.com/primitives/docs/overview/accessibility) - ARIA patterns, focus management
- [WCAG 2.5.5 Target Size Enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) - 44x44px requirement
- [WCAG 2.5.8 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) - 24x24px minimum (AA)

### Tertiary (LOW confidence)
- General CVA best practices from search (verify with actual CVA documentation)
- React component patterns (well-established, but verify specific implementations)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used in codebase
- Architecture: HIGH - Patterns extracted from existing codebase
- Pitfalls: HIGH - Derived from CONTEXT.md decisions and codebase analysis
- Touch targets: MEDIUM - WCAG requirement verified, implementation patterns inferred

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable domain)
