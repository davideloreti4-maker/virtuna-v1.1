# Contributing to Virtuna Design System

> How to add components, modify tokens, and extend the system.

---

## Adding a New Component

### 1. File Structure

Create the component file following the established directory layout:

```
src/components/
  ui/              # Primary UI components (Button, Card, Input, etc.)
  motion/          # Scroll-reveal and animation wrappers
  effects/         # Visual overlay effects (NoiseTexture, ChromaticAberration)
  primitives/      # Low-level building blocks (GlassPanel, GradientGlow)
  layout/          # Layout-level components (Navbar, Footer, etc.)
  landing/         # Page-specific landing components
```

For a new UI component:

1. Create component file: `src/components/ui/{component-name}.tsx`
2. Export from barrel: `src/components/ui/index.ts`
3. Add showcase demo to the appropriate `/showcase` page

### 2. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Component file | kebab-case | `extension-card.tsx` |
| Component name | PascalCase | `ExtensionCard` |
| Props interface | `{Component}Props` | `ExtensionCardProps` |
| Variant types | `{Component}{Aspect}` | `ButtonVariant`, `BadgeSize` |
| CVA variants | camelCase export | `buttonVariants`, `badgeVariants` |
| Client island demos | `{Component}{Variant}Demo` | `ToggleSizeDemo`, `SelectGroupedDemo` |
| Test files | `{component-name}.test.tsx` | `extension-card.test.tsx` |

### 3. Component Patterns

Follow these patterns established across the codebase:

**forwardRef for DOM-wrapping components:**

```tsx
import { forwardRef } from "react";

interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "accent";
}

const MyComponent = forwardRef<HTMLDivElement, MyComponentProps>(
  ({ variant = "default", className, ...props }, ref) => {
    return <div ref={ref} className={cn(variants({ variant }), className)} {...props} />;
  }
);
MyComponent.displayName = "MyComponent";
export { MyComponent };
```

**CVA for variant management:**

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const myComponentVariants = cva("base-classes", {
  variants: {
    variant: {
      default: "bg-surface text-foreground",
      accent: "bg-accent text-accent-foreground",
    },
    size: {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-base",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
  },
});

export interface MyComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof myComponentVariants> {}
```

**Radix primitives for complex interactions:**

Use Radix UI primitives for components that need focus management, keyboard navigation, or portal rendering (modals, selects, tabs, toggles).

```tsx
import * as RadixDialog from "@radix-ui/react-dialog";
```

**Server components by default:**

Only add `"use client"` when the component requires:
- State (`useState`, `useReducer`)
- Effects (`useEffect`, `useLayoutEffect`)
- Event handlers (`onClick`, `onChange`)
- Browser APIs (`window`, `document`)
- Motion library (`motion/react`)

**Export types alongside components:**

```tsx
export type { MyComponentProps };
export { MyComponent, myComponentVariants };
```

### 4. Token Usage

- **ALWAYS** use Tailwind token classes (`bg-background`, `text-foreground`, `border-border`, etc.)
- **NEVER** hardcode hex, rgb, or pixel values unless:
  - Value has no token equivalent (e.g., macOS system colors in TrafficLights)
  - Value is too complex for a single token (e.g., multi-layer shadows in Kbd)
  - Value is dynamic/computed at runtime (e.g., gradient stops in ExtensionCard)
  - Safari compatibility requires inline styles (e.g., backdrop-filter in GlassCard)
- If you must use a hardcoded value, document the reason with a code comment
- If the value is used across multiple components, create a token in `globals.css` instead

### 5. Showcase Demo

Add a demo section to the appropriate `/showcase` page:

| Component Type | Showcase Page |
|---------------|---------------|
| Interactive (Button, Input, Select, Toggle) | `/showcase/inputs` |
| Navigation (Tabs, Kbd, ShortcutBadge) | `/showcase/navigation` |
| Feedback (Badge, Toast, Dialog, Spinner) | `/showcase/feedback` |
| Data Display (Card, Avatar, ExtensionCard) | `/showcase/data-display` |
| Layout (GlassPanel, Divider) | `/showcase/layout-components` |
| Motion & Effects | `/showcase/utilities` |

**Showcase pattern:**

```tsx
import { ShowcaseSection } from "../_components/showcase-section";
import { CodeBlock } from "../_components/code-block";

<ShowcaseSection
  title="MyComponent"
  description="Brief description of the component."
>
  {/* Live demo */}
  <div className="flex gap-4">
    <MyComponent>Default</MyComponent>
    <MyComponent variant="accent">Accent</MyComponent>
  </div>

  {/* Code example */}
  <CodeBlock
    code={`<MyComponent variant="accent">Accent</MyComponent>`}
    language="tsx"
  />
</ShowcaseSection>
```

**Client island pattern for interactive demos:**

If the demo needs interactivity (state, event handlers), create a client component:

```tsx
// src/app/(marketing)/showcase/_components/my-component-demo.tsx
"use client";

export function MyComponentDemo() {
  const [value, setValue] = useState("default");
  return <MyComponent variant={value} onChange={setValue} />;
}
```

Import the demo into the server-rendered showcase page.

---

## Modifying Tokens

### 1. Edit the theme

All tokens live in the `@theme` block in `src/app/globals.css`.

**Token architecture:**
- **Layer 1 (Primitives):** Raw values (`--color-coral-500`, `--color-gray-800`)
- **Layer 2 (Semantic):** Contextual aliases referencing primitives (`--color-accent: var(--color-coral-500)`)

Always add primitives first, then create semantic mappings.

### 2. Update documentation

After changing tokens:

1. Update `docs/tokens.md` with new/changed values and usage guidance
2. Update `docs/design-specs.json` if token categories changed
3. Run contrast audit: `npx tsx verification/scripts/contrast-audit.ts`

### 3. Important notes

- **Dark grays (lightness < 0.15):** Use hex or rgba values, not oklch. Tailwind v4 compiles oklch to inaccurate hex for very dark colors.
- **Border/state tokens:** Use rgba for predictable alpha compositing.
- **oklch is fine** for mid-range colors (coral scale, status colors) where compilation accuracy is sufficient.

---

## File Organization

```
src/
  app/
    globals.css              # All design tokens (@theme block)
    (marketing)/
      showcase/              # Component showcase pages
        page.tsx             # Tokens showcase
        inputs/page.tsx      # Inputs showcase
        navigation/page.tsx  # Navigation showcase
        feedback/page.tsx    # Feedback showcase
        data-display/page.tsx
        layout-components/page.tsx
        utilities/page.tsx
        _components/         # Shared showcase components
          showcase-section.tsx
          code-block.tsx
          copy-button.tsx
          component-grid.tsx
          sidebar-nav.tsx
          token-swatch.tsx
          *-demo.tsx         # Client island demos
  components/
    ui/                      # Primary component library
      index.ts               # Barrel export (import from @/components/ui)
      button.tsx
      card.tsx
      input.tsx
      select.tsx
      ...
    motion/                  # Motion/animation components
      index.ts
      fade-in.tsx
      fade-in-up.tsx
      slide-up.tsx
      stagger-reveal.tsx
      hover-scale.tsx
      page-transition.tsx
      frozen-router.tsx
    effects/                 # Visual effect components
      index.ts
      noise-texture.tsx
      chromatic-aberration.tsx
    primitives/              # Low-level building blocks
      index.ts
      GlassPanel.tsx
      GradientGlow.tsx
      GradientMesh.tsx
      TrafficLights.tsx
      ...
    layout/                  # Layout-level components
    landing/                 # Page-specific components
docs/
  tokens.md                  # Complete token reference
  components.md              # Component API reference
  component-index.md         # Component source/showcase map
  usage-guidelines.md        # When-to-use guidance
  accessibility.md           # WCAG AA requirements
  motion-guidelines.md       # Animation patterns
  design-specs.json          # Structured token export
  contributing.md            # This file
verification/
  scripts/                   # Automated verification scripts
    contrast-audit.ts        # WCAG AA contrast checker
    hardcoded-values-scan.ts # Token compliance scanner
    token-verification.ts    # Token accuracy checker
  reports/                   # Generated verification reports
```

---

## Code Style

### TypeScript

- Strict mode, no `any` without justification
- Prefer `interface` for object shapes, `type` for unions
- Explicit return types for exported functions
- Use `as const satisfies` for variant objects

### React

- Functional components with hooks
- Props interface: `{Component}Props`
- Server components by default
- Client components only when interactivity requires it

### Imports

Group and order imports:

```tsx
// 1. External libraries
import * as React from "react";
import { cva } from "class-variance-authority";
import * as RadixDialog from "@radix-ui/react-dialog";

// 2. Internal utilities
import { cn } from "@/lib/utils";

// 3. Internal components
import { Button } from "@/components/ui/button";

// 4. Types (if separate)
import type { ButtonProps } from "@/components/ui/button";
```

### CSS / Tailwind

- Use Tailwind utility classes over custom CSS
- Use token-based classes (`bg-background`, `text-accent`) over arbitrary values
- Use `cn()` utility for conditional class merging
- Put complex/compound styles in `globals.css` utility classes

---

## Checklist for New Components

- [ ] Component file created in appropriate directory
- [ ] Props interface exported with `{Component}Props` naming
- [ ] forwardRef used for DOM-wrapping components
- [ ] CVA used for variant management (if applicable)
- [ ] Semantic tokens used (no hardcoded colors/spacing)
- [ ] `prefers-reduced-motion` respected (for motion components)
- [ ] Server component by default, `"use client"` only if needed
- [ ] Exported from barrel file (`index.ts`)
- [ ] Showcase demo added to appropriate `/showcase` page
- [ ] Documentation updated in `docs/components.md`
- [ ] Entry added to `docs/component-index.md`

---

*Last updated: 2026-02-05*
