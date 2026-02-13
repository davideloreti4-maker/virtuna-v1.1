# Coding Conventions

**Analysis Date:** 2026-02-13

## Naming Patterns

**Files:**
- Components: PascalCase - `Button.tsx`, `GlassCard.tsx`, `DashboardClient.tsx`
- Pages: kebab-case - `page.tsx`, `dashboard-client.tsx`, `viral-score-test/page.tsx`
- Utilities: kebab-case - `deal-utils.ts`, `affiliate-utils.ts`, `mock-societies.ts`
- Types: kebab-case - `brand-deals.ts`, `viral-results.ts`, `database.types.ts`
- Stores: kebab-case with `-store` suffix - `test-store.ts`, `society-store.ts`, `settings-store.ts`
- Barrels: `index.ts` (re-exports components/utilities)

**Functions:**
- camelCase - `generateMockData()`, `handleSubmit()`, `waitForStable()`
- Handlers use `handle` prefix - `handleCloseSelector()`, `handleSelectType()`, `handleContentSubmit()`
- Async functions use `async` keyword - `async function submitTest()`
- Utilities use verb prefixes - `generateId()`, `saveToStorage()`, `getImpactLabel()`

**Variables:**
- camelCase - `testStore`, `currentStatus`, `selectedSocietyId`
- Constants: SCREAMING_SNAKE_CASE - `STORAGE_KEY`, `SELECTORS`, `TEST_TYPES`
- React hooks: `use` prefix - `useTestStore()`, `useSocietyStore()`

**Types:**
- PascalCase interfaces - `ButtonProps`, `InputProps`, `TestState`
- PascalCase type aliases - `TestType`, `SimulationPhase`, `InputSize`
- Type guards use `is` prefix - `isPersonalSociety()`, `isTargetSociety()`
- Props suffix for component props - `CardProps`, `GlassCardProps`, `InputFieldProps`

## Code Style

**Formatting:**
- No Prettier config detected - relies on ESLint formatting
- Indent: 2 spaces (inferred from tsconfig.json and source files)
- Semicolons: Always
- Trailing commas: Multi-line arrays/objects
- Line length: No enforced limit (some files have 150+ char lines)

**Linting:**
- ESLint 9 with Next.js config (`eslint-config-next`)
- Config file: `eslint.config.mjs`
- TypeScript integration via `eslint-config-next/typescript`
- Run command: `npm run lint`

**TypeScript:**
- Strict mode enabled (`tsconfig.json` line 7)
- `noUncheckedIndexedAccess: true` (line 8) - enforces checking array/object access
- `noUnusedLocals: true`, `noUnusedParameters: true` (lines 9-10)
- `noFallthroughCasesInSwitch: true` (line 11)
- Target: ES2017
- JSX: react-jsx (automatic runtime, no need to import React)

## Import Organization

**Order:**
1. React/Next.js imports
2. External libraries (Radix UI, Zustand, utilities)
3. Internal components (`@/components`)
4. Internal utilities (`@/lib`)
5. Types (`@/types`)
6. Stores (`@/stores`)
7. Styles (if any)

**Example from `src/app/(app)/dashboard/dashboard-client.tsx`:**
```typescript
"use client";

import { useEffect, useMemo } from "react";
import {
  FilterPillGroup,
  ContextBar,
  TestTypeSelector,
  // ... more imports
} from "@/components/app";
import { HiveCanvas } from "@/components/hive/HiveCanvas";
import { generateMockHiveData } from "@/components/hive/hive-mock-data";
import { useTestStore } from "@/stores/test-store";
import { useSocietyStore } from "@/stores/society-store";
import type { TestType } from "@/types/test";
```

**Path Aliases:**
- `@/*` maps to `./src/*` (defined in `tsconfig.json` line 27)
- Always use absolute imports with `@/` prefix
- Example: `import { cn } from "@/lib/utils"` not `../../lib/utils`

## Error Handling

**Patterns:**
- Try-catch blocks with silent failure for localStorage operations (`src/stores/test-store.ts` lines 46-50, 54-64)
- Optional chaining for nullable values - `state.currentResult?.id`
- Nullish coalescing for defaults - `blur = "md"`, `glow = true`
- Early returns for guard clauses - `if (!currentTestType) return;` (`test-store.ts` line 115)
- Timeout checks in async operations - `if (get().currentStatus !== 'simulating') return;` (line 126)

**No global error boundary detected** - errors handled locally in components/stores

## Logging

**Framework:** Console (standard)

**Patterns:**
- Playwright tests: `console.log(\`Screenshot saved: ${filepath}\`)` (`extraction/fixtures/auth.ts` line 85)
- Debug logs in test helpers: `console.log('View selector not found, skipping')` (`extraction/tests/03-view-selector.spec.ts` line 24)
- No logging framework (Pino, Winston) detected
- No log levels (info/warn/error) convention observed

## Comments

**When to Comment:**
- Component JSDoc with usage examples (all UI components)
- Function JSDoc for public APIs
- Section headers in large files (globals.css uses extensive section comments)
- Inline clarifications for non-obvious logic

**JSDoc/TSDoc:**
- Full JSDoc for all exported components and functions
- `@example` blocks with code snippets
- `@param` and `@returns` tags used consistently
- `@default` tags for optional props

**Example from `src/components/ui/button.tsx`:**
```typescript
/**
 * Button component with Raycast-style design system integration.
 *
 * Features:
 * - 4 variants: primary (coral), secondary (default), ghost, destructive
 * - 3 sizes: sm (36px), md (44px), lg (48px) - all meet touch target requirements
 * - Loading state with spinner and disabled interaction
 * - Full accessibility support (aria-busy, aria-disabled, focus-visible ring)
 * - Composition support via asChild prop (Radix Slot)
 *
 * @example
 * ```tsx
 * // Basic usage (secondary variant is default)
 * <Button>Click me</Button>
 * ```
 */
```

**Section Headers:**
- Used extensively in `globals.css` to organize design tokens
- Block comment style with visual separators
- Example: `/* ============================================ * PRIMITIVE TOKENS (Layer 1) * ============================================ */`

## Function Design

**Size:**
- Small, focused functions preferred
- Handlers typically 5-15 lines
- Store actions 10-50 lines (with async simulation logic)
- Component render functions vary (20-150 lines)

**Parameters:**
- Destructure props immediately - `({ className, variant, size, ...props }, ref)`
- Use object parameters for 3+ args
- Optional parameters use default values - `blur = "md"`, `glow = true`

**Return Values:**
- Explicit return types for exported functions
- Type inference for internal helpers
- Components return JSX.Element (inferred)
- Stores return void for actions, values for selectors

## Module Design

**Exports:**
- Named exports preferred over default exports
- Exception: Next.js pages use default export (required)
- Components export both component and types - `export { Button, buttonVariants }; export type { ButtonProps };`

**Barrel Files:**
- Extensive use of `index.ts` files for re-exports
- Located at: `src/components/app/index.ts`, `src/components/ui/index.ts`, `src/components/visualization/index.ts`, etc.
- Pattern: `export { Component } from "./component";`
- Type exports: `export type { ComponentProps } from "./component";`

**Example from `src/components/app/index.ts`:**
```typescript
export { AppShell } from "./app-shell";
export { AuthGuard } from "./auth-guard";
export { CardActionMenu } from "./card-action-menu";
// ... 30+ more exports
export type { ViewOption, RoleLevelId } from "./view-selector";
export type { SurveySubmission } from "./survey-form";
```

## Client/Server Component Pattern

**Default:** Server components (Next.js 15 App Router)

**Client components marked with:** `"use client";` directive at top of file

**When to use client:**
- Interactive state (useState, useEffect)
- Event handlers (onClick, onChange)
- Browser APIs (localStorage, window)
- Zustand stores
- Third-party libraries requiring client context

**Example:**
- `src/app/(app)/dashboard/page.tsx` - Server component (wrapper for metadata)
- `src/app/(app)/dashboard/dashboard-client.tsx` - Client component (handles state/interactivity)

## Design System Integration

**Utility function:** `cn()` from `@/lib/utils` - combines clsx and tailwind-merge

**Usage pattern:**
```typescript
className={cn(
  "base-classes",
  conditionalClasses && "conditional",
  variant === "primary" && "variant-classes",
  className // user override
)}
```

**Semantic tokens:** Use CSS variables from `globals.css`
- Colors: `var(--color-foreground)`, `var(--color-accent)`, `var(--color-border)`
- Spacing: `var(--spacing-4)`, `var(--spacing-6)`
- Shadows: `var(--shadow-button)`, `var(--shadow-glass)`
- Reference Raycast design language rules in `CLAUDE.md`

## Accessibility

**Patterns observed:**
- ARIA attributes: `aria-invalid`, `aria-describedby`, `aria-busy`, `aria-disabled`, `aria-label`
- Focus management: `focus-visible:ring-2` on interactive elements
- Screen reader text: `className="sr-only"` for hidden labels
- Semantic HTML: `<button>`, `<input>`, `<label>`, `<nav>` over divs
- Role attributes from Radix UI: `[role="dialog"]`, `[role="listbox"]`, `[role="option"]`

**Example from `src/components/ui/input.tsx`:**
```typescript
aria-invalid={hasError || undefined}
aria-describedby={typeof error === "string" && props.id ? `${props.id}-error` : undefined}
```

## State Management

**Framework:** Zustand (`src/stores/`)

**Pattern:**
```typescript
export const useTestStore = create<TestState>((set, get) => ({
  // State
  tests: [],
  currentStatus: 'idle',

  // Actions
  setStatus: (status) => set({ currentStatus: status }),
  submitTest: async (content, societyId) => {
    // ... async logic with get() and set()
  },
}));
```

**Hydration:**
- Manual hydration pattern: `_hydrate()` method and `_isHydrated` flag
- Called in useEffect on mount
- Loads from localStorage and sets hydration flag

## File Organization

**Route groups:** `(app)`, `(marketing)` - organizing routes without affecting URL structure

**Co-location:** Components live in feature folders (`components/app/`, `components/landing/`, `components/ui/`)

**Types:** Centralized in `src/types/` directory

---

*Convention analysis: 2026-02-13*
