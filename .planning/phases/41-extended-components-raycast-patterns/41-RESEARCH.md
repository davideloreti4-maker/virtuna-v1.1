# Phase 41: Extended Components + Raycast Patterns - Research

**Researched:** 2026-02-05
**Domain:** Extended React UI components (Modal, Select, Toast, Tabs, Avatar, Divider, Toggle) + Raycast-specific visual patterns (KeyCap, ShortcutBadge, ExtensionCard, TestimonialCard, CategoryTabs)
**Confidence:** HIGH

## Summary

Phase 41 builds secondary UI components and Raycast-specific visual patterns on top of the core component layer delivered in Phase 40. The codebase already contains comprehensive prototype implementations in `src/components/primitives/` covering every component required by this phase: GlassModal, GlassSelect, GlassToast, GlassTabs, GlassToggle, GlassTooltip, GlassAvatar, GlassAlert, Kbd, KbdCombo, Divider, and CommandPalette. These primitives are feature-rich but exist outside the canonical `src/components/ui/` directory and do not follow the established CVA/forwardRef/semantic-token patterns from Phase 40.

The primary work of Phase 41 is therefore **not greenfield development** but **consolidation and promotion**: migrating the best patterns from `src/components/primitives/` into proper `src/components/ui/` components that integrate with the two-tier token system, use Radix UI primitives for accessibility where installed (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-switch`, `@radix-ui/react-avatar`), follow the CVA variant pattern, and achieve pixel-level Raycast fidelity using coral (#FF7F50 / oklch 0.72 0.16 40) as the accent color.

For the Raycast-specific patterns (RAY-01 through RAY-05), the existing `Kbd` and `KbdCombo` components provide a solid foundation for key cap visualization. ShortcutBadge, ExtensionCard, TestimonialCard, and CategoryTabs are new components to be built in `src/components/ui/` using the established patterns.

**Primary recommendation:** Promote existing `src/components/primitives/` implementations to `src/components/ui/` by refactoring them to use Radix UI primitives (for Dialog, Tabs, Switch, Avatar), CVA for variant management, semantic tokens from `globals.css`, and proper forwardRef/JSDoc patterns established in Phase 40. Do NOT install new packages -- all needed Radix packages are already installed.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-dialog | 1.1.15 | Modal/Dialog accessibility | Already installed, provides focus trap, scroll lock, portal, ESC dismiss |
| @radix-ui/react-tabs | 1.1.13 | Tabs keyboard navigation | Already installed, provides roving tabindex, arrow key navigation |
| @radix-ui/react-switch | 1.2.6 | Toggle/Switch accessibility | Already installed, provides proper role="switch" and state management |
| @radix-ui/react-avatar | 1.1.11 | Avatar image loading/fallback | Already installed, handles img loading states |
| @radix-ui/react-alert-dialog | 1.1.15 | Confirmation dialogs | Already installed, prevents accidental dismissal |
| class-variance-authority | 0.7.1 | Type-safe variant management | Established pattern from Phase 40 |
| @phosphor-icons/react | 2.1.10 | Icon system | Established icon library, used throughout primitives |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion | 12.29.3 | Toast enter/exit animations | Already installed, for toast slide-in/out |
| tailwind-merge | 3.4.0 | Class conflict resolution | Via cn() utility |
| @radix-ui/react-slot | 1.2.4 | asChild composition | For polymorphic components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom GlassSelect | @radix-ui/react-select (not installed) | Custom already works well, Radix Select has opinionated positioning; keep custom but consider installing Radix Select for searchable variant |
| Custom GlassToast | sonner / react-hot-toast | Custom is already built and matches glass aesthetic; external libs require theme overrides |
| Custom GlassTooltip | @radix-ui/react-tooltip (not installed) | Custom works but lacks collision detection; acceptable for Phase 41 scope |
| Manual modal focus trap | @radix-ui/react-dialog | Radix is already installed and provides battle-tested focus management -- USE Radix |

**Installation:**
```bash
# No new packages needed - all Radix primitives already installed
# Optional: npm install @radix-ui/react-select  (if SearchableSelect needs robust positioning)
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/ui/
├── index.ts              # Re-exports all components (update with new exports)
├── dialog.tsx            # Modal/Dialog using Radix Dialog (CMX-02)
├── select.tsx            # Select/Dropdown (CMX-01)
├── toast.tsx             # Toast/Alert notifications (CMX-03)
├── tabs.tsx              # Tabs component using Radix Tabs (CMX-04)
├── avatar.tsx            # Avatar using Radix Avatar (CMX-05)
├── divider.tsx           # Divider component (CMX-06)
├── toggle.tsx            # Toggle/Switch using Radix Switch
├── kbd.tsx               # KeyCap visualization (RAY-01)
├── shortcut-badge.tsx    # Shortcut badge Cmd+K displays (RAY-02)
├── extension-card.tsx    # Extension/feature card with gradient (RAY-03)
├── testimonial-card.tsx  # Testimonial card pattern (RAY-04)
├── category-tabs.tsx     # Category tab navigation (RAY-05)
├── button.tsx            # (existing)
├── card.tsx              # (existing)
├── input.tsx             # (existing)
├── badge.tsx             # (existing)
├── typography.tsx        # (existing)
├── spinner.tsx           # (existing)
├── icon.tsx              # (existing)
├── skeleton.tsx          # (existing)
└── accordion.tsx         # (existing)
```

### Pattern 1: Radix Primitive + Glass Styling
**What:** Wrap Radix UI primitives with Raycast glass styling
**When to use:** Dialog, Tabs, Switch, Avatar -- any component with an installed Radix primitive
**Why:** Radix handles all ARIA, focus management, keyboard navigation, scroll lock. We only add styling.

```typescript
// Source: Radix UI Dialog docs + existing GlassModal pattern
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { X } from "@phosphor-icons/react";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-modal-backdrop",
      "bg-black/60 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: "sm" | "md" | "lg" | "xl" | "full";
  }
>(({ className, children, size = "md", ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-modal translate-x-[-50%] translate-y-[-50%]",
        "w-full",
        size === "sm" && "max-w-sm",
        size === "md" && "max-w-md",
        size === "lg" && "max-w-lg",
        size === "xl" && "max-w-xl",
        size === "full" && "max-w-[90vw] max-h-[90vh]",
        "rounded-xl border border-border-glass",
        "bg-surface-elevated",
        "shadow-xl",
        "focus:outline-none",
        className
      )}
      style={{
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;
```

### Pattern 2: Custom Interactive Component (no Radix available)
**What:** Hand-built component following existing GlassSelect pattern
**When to use:** Select/Dropdown (no Radix Select installed), Toast system
**Why:** Custom implementation already exists and works well

```typescript
// Source: Existing GlassSelect pattern refactored to ui/ conventions
// Key: keep keyboard navigation, click-outside, search filtering
// Add: CVA variants, semantic tokens, forwardRef, proper z-index tokens
const selectVariants = cva(
  "w-full rounded-lg flex items-center justify-between border transition-all cursor-pointer",
  {
    variants: {
      size: {
        sm: "h-8 px-3 text-sm gap-2",
        md: "h-10 px-4 text-base gap-2",
        lg: "h-12 px-5 text-lg gap-3",
      },
    },
    defaultVariants: { size: "md" },
  }
);
```

### Pattern 3: Keyboard Key Visualization (Raycast pixel-match)
**What:** 3D keycap rendering with precise shadows matching Raycast
**When to use:** RAY-01 (KeyCap) and RAY-02 (ShortcutBadge)
**Why:** Keycaps are an iconic Raycast element requiring pixel-level fidelity

```typescript
// Source: Existing Kbd.tsx extracted shadow values
// Raycast exact 3D key shadow (from extraction):
const keycapShadow = `
  rgba(0, 0, 0, 0.4) 0px 1.5px 0.5px 2.5px,
  rgb(0, 0, 0) 0px 0px 0.5px 1px,
  rgba(0, 0, 0, 0.25) 0px 2px 1px 1px inset,
  rgba(255, 255, 255, 0.2) 0px 1px 1px 1px inset
`;

// Background gradient (dark keycap):
const keycapGradient = "linear-gradient(180deg, rgb(18, 18, 18), rgb(13, 13, 13))";

// Border: 1px solid rgba(255, 255, 255, 0.1)
// Highlighted: add ring-1 ring-accent + glow shadow
```

### Pattern 4: Gradient Background Cards (Raycast extension style)
**What:** Cards with radial gradient top glow (like Raycast feature/extension cards)
**When to use:** RAY-03 (Extension card), feature showcases

```typescript
// Source: globals.css --gradient-feature
// Raycast feature card glow:
const extensionCardGradient = `radial-gradient(
  85.77% 49.97% at 51% 5.12%,
  rgba(255, 148, 148, 0.11) 0px,
  rgba(222, 226, 255, 0.08) 45.83%,
  rgba(241, 242, 255, 0.02) 100%
)`;
// Customized with coral tint for Virtuna brand:
const virtunaGradient = `radial-gradient(
  85.77% 49.97% at 51% 5.12%,
  oklch(0.72 0.16 40 / 0.11) 0px,
  oklch(0.90 0.06 40 / 0.08) 45.83%,
  oklch(0.97 0.03 40 / 0.02) 100%
)`;
```

### Anti-Patterns to Avoid

- **Re-implementing Radix behavior:** When Radix Dialog, Tabs, Switch, Avatar are already installed, do NOT hand-roll focus traps, keyboard navigation, or scroll lock. Wrap Radix and style it.
- **Using primitives/ components in pages directly:** The Glass* components in primitives/ should be internal/advanced; canonical API is via ui/ components.
- **Hardcoding z-index values:** Use the token scale from globals.css: `z-dropdown: 100`, `z-modal-backdrop: 300`, `z-modal: 400`, `z-toast: 500`, `z-tooltip: 600`.
- **Missing `WebkitBackdropFilter`:** Safari requires the `-webkit-` prefix. Always include both `backdropFilter` and `WebkitBackdropFilter`.
- **Using oklch inline in JSX:** Tailwind v4 supports oklch in `@theme`, but inline `style=` attributes should use oklch sparingly. Prefer Tailwind classes referencing tokens.
- **Creating duplicate Toast context:** There's already a `ToastProvider` in primitives/. The ui/ version should replace it, not coexist.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal focus trap | Manual focus tracking with refs | @radix-ui/react-dialog | Battle-tested focus trap, scroll lock, portal, ESC handling |
| Tab keyboard navigation | Custom ArrowLeft/Right handlers | @radix-ui/react-tabs | Roving tabindex, Home/End, orientation support |
| Switch/Toggle state | Manual checked state + aria | @radix-ui/react-switch | Proper role="switch", controlled/uncontrolled |
| Avatar image loading | Custom img onError handler | @radix-ui/react-avatar | Handles loading states, fallback timing, img optimization |
| Dialog scroll lock | Manual body overflow toggle | Radix Dialog | Handles scroll bar width compensation, multiple dialogs |
| Class composition | String concatenation | cn() (clsx + tailwind-merge) | Tailwind conflict resolution |
| Variant TypeScript types | Manual union types | VariantProps<typeof cvaFn> | Auto-extracted from CVA definition |
| Toast auto-dismiss | setInterval + state tracking | Keep existing pattern | The GlassToast implementation is solid |

**Key insight:** Four Radix primitives are already installed but UNUSED in the primitives/ implementations (GlassModal uses manual focus, GlassTabs uses manual state, GlassToggle uses manual state, GlassAvatar uses manual img). Phase 41 should leverage these Radix primitives for accessibility guarantees.

## Common Pitfalls

### Pitfall 1: Not Using Installed Radix Primitives
**What goes wrong:** Building custom focus traps, keyboard handlers when Radix is already `node_modules/`
**Why it happens:** The primitives/ components were built before Radix was installed, or without awareness of installed packages
**How to avoid:** Check `node_modules/@radix-ui/` before implementing behavior. Dialog, Tabs, Switch, Avatar are all installed.
**Warning signs:** Manual `useEffect` for ESC key, manual body scroll lock, custom roving focus

### Pitfall 2: Inconsistent Token Usage Between Primitives and UI Components
**What goes wrong:** Primitives use `var(--color-bg-100)`, `var(--color-fg)`, `var(--color-grey-200)` while ui/ components use semantic Tailwind classes like `bg-surface`, `text-foreground`
**Why it happens:** Primitives were built with direct CSS variable references, ui/ components use Tailwind semantic tokens
**How to avoid:** When promoting primitives to ui/, convert all `var(--color-*)` references to Tailwind semantic classes where available. Only use inline `style=` for values without Tailwind equivalents (specific shadows, gradients).
**Warning signs:** Mix of `style={{ color: "var(--color-fg-300)" }}` and `className="text-foreground-secondary"` in same component

### Pitfall 3: Missing Z-Index Token Usage
**What goes wrong:** Modals, toasts, tooltips overlapping incorrectly
**Why it happens:** Using `z-50` instead of token-based z-index
**How to avoid:** Use the z-index scale: `z-[var(--z-dropdown)]` (100), `z-[var(--z-modal-backdrop)]` (300), `z-[var(--z-modal)]` (400), `z-[var(--z-toast)]` (500), `z-[var(--z-tooltip)]` (600). Or use Tailwind v4 z-index classes that reference these tokens.
**Warning signs:** Hardcoded `z-50`, `z-[9999]` in component code

### Pitfall 4: Toast Provider Duplication
**What goes wrong:** Two toast systems coexisting (primitives/ and ui/)
**Why it happens:** Creating new toast without removing/deprecating old one
**How to avoid:** The ui/ toast should be the single source of truth. Update all imports. Mark primitives/ GlassToast as deprecated.
**Warning signs:** Multiple `ToastProvider` components in the app tree

### Pitfall 5: Select Dropdown Clipping
**What goes wrong:** Select dropdown gets clipped by parent `overflow: hidden`
**Why it happens:** Dropdown rendered inside a container with overflow constraints
**How to avoid:** Render dropdown in a portal (like the existing GlassSelect does with `absolute z-50`), or use Radix Popper for collision-aware positioning.
**Warning signs:** Dropdown cut off at bottom of cards or sections

### Pitfall 6: Key Cap Shadow Not Matching Raycast
**What goes wrong:** Keycaps look flat or wrong
**Why it happens:** Missing the multi-layer shadow that creates 3D depth
**How to avoid:** Use the exact 4-layer shadow from extraction: outer shadow (depth), border shadow, bottom inset (3D recess), top inset (highlight). Keep the gradient background.
**Warning signs:** Single box-shadow, or missing inset shadows

### Pitfall 7: Animation on Reduced Motion
**What goes wrong:** Toast slide animations, modal scale-in play for users with `prefers-reduced-motion`
**Why it happens:** Not checking motion preference
**How to avoid:** The codebase has `usePrefersReducedMotion` hook. Use it, or use Tailwind's `motion-reduce:` modifier. Toast auto-dismiss should still work, just skip animation.
**Warning signs:** No `motion-reduce:` classes or `prefers-reduced-motion` checks

## Code Examples

Verified patterns from existing codebase and official documentation:

### Modal/Dialog with Radix (CMX-02)
```typescript
// Source: Radix Dialog docs (Context7 /websites/radix-ui-primitives)
// + Existing GlassModal styling values
import * as DialogPrimitive from "@radix-ui/react-dialog";

// Radix provides: Portal, Overlay, Content, Title, Description, Close
// We add: Glass styling, size variants, coral focus ring

// Overlay: bg-black/60 backdrop-blur-sm (from existing GlassModal)
// Content: bg-surface-elevated border-border-glass rounded-xl
//          backdropFilter: blur(20px), shadow-xl
// Close button: X icon from Phosphor, same pattern as GlassModal
```

### Select with Keyboard Navigation (CMX-01)
```typescript
// Source: Existing GlassSelect.tsx (fully implemented)
// Key features to preserve:
// - Arrow key navigation (up/down/home/end)
// - Enter/Space to select, Escape to close
// - Optional searchable (type-to-filter)
// - Option groups with labels
// - Controlled/uncontrolled value
// - Click outside to close
// - Scroll highlighted item into view

// Refactoring needed:
// - Convert CSS var() references to Tailwind semantic tokens
// - Add CVA size variants
// - Add forwardRef
// - Use z-[var(--z-dropdown)] instead of z-50
// - Use accent color from tokens instead of hardcoded oklch
```

### Tabs with Radix (CMX-04)
```typescript
// Source: Radix Tabs docs (Context7 /websites/radix-ui-primitives)
import * as TabsPrimitive from "@radix-ui/react-tabs";

// Radix provides: Root (controlled/uncontrolled), List (roving tabindex),
//                  Trigger (aria-selected), Content (tabpanel)
// We add: Glass pill styling from existing GlassTabs
// Active tab: bg-white/5, border-white/10, text-foreground
// Inactive tab: text-foreground-secondary, transparent border
// List track: bg-surface-elevated, rounded-full, border-white/5
```

### Toggle/Switch with Radix (already installed)
```typescript
// Source: Radix Switch docs (Context7 /websites/radix-ui-primitives)
import * as SwitchPrimitive from "@radix-ui/react-switch";

// Radix provides: Root (role="switch"), Thumb
// We add: Coral accent when checked, glass track, spring animation
// Checked track: bg-accent/20, border-accent/30
// Checked knob: bg-accent with glow shadow
// Unchecked track: bg-surface, border-border-glass
// Unchecked knob: bg-foreground
```

### KeyCap Component (RAY-01)
```typescript
// Source: Existing Kbd.tsx (verified pixel values from extraction)
// Preserve exact shadow values:
const KEYCAP_SHADOW = [
  "rgba(0, 0, 0, 0.4) 0px 1.5px 0.5px 2.5px",    // outer depth
  "rgb(0, 0, 0) 0px 0px 0.5px 1px",                // border shadow
  "rgba(0, 0, 0, 0.25) 0px 2px 1px 1px inset",     // bottom recess
  "rgba(255, 255, 255, 0.2) 0px 1px 1px 1px inset", // top highlight
].join(", ");

// Highlighted variant: add coral glow
const KEYCAP_SHADOW_HIGHLIGHTED = KEYCAP_SHADOW +
  ", 0 0 8px var(--color-accent) / 0.3";

// Background: linear-gradient(180deg, rgb(18, 18, 18), rgb(13, 13, 13))
// Border: 1px solid rgba(255, 255, 255, 0.1)
// Font: system font, medium weight
```

### ShortcutBadge (RAY-02)
```typescript
// New component combining Kbd with modifier key display
// Pattern: inline-flex container with Kbd children
// Modifier symbols: { cmd: "⌘", shift: "⇧", alt: "⌥", ctrl: "⌃" }

interface ShortcutBadgeProps {
  keys: string[];           // e.g., ["cmd", "K"] or ["shift", "alt", "P"]
  separator?: "+" | "none"; // visual separator between keys
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Renders: <Kbd>⌘</Kbd><Kbd>K</Kbd> with proper gap
// Uses existing KbdCombo pattern as foundation
```

### Extension Card with Gradient (RAY-03)
```typescript
// New component for Raycast-style extension/feature cards
// Gradient top glow using --gradient-feature or coral variant
// Structure: icon area (with gradient) + title + description + metadata

interface ExtensionCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  gradient?: "coral" | "purple" | "blue" | "green" | "cyan";
  metadata?: ReactNode; // e.g., badge, category label
  className?: string;
}

// Background: bg-surface border border-border rounded-xl
// Gradient glow: positioned absolutely at top, height ~50%
// Icon: centered in gradient area, larger size (32-40px)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual focus traps | Radix Dialog built-in | 2022+ | Zero custom focus code needed |
| Custom roving focus | Radix Tabs built-in | 2022+ | Arrow key nav handled automatically |
| Manual switch ARIA | Radix Switch | 2022+ | Proper role="switch" guaranteed |
| img onError fallback | Radix Avatar | 2022+ | Loading state + timed fallback |
| CSS @keyframes toast | Framer Motion AnimatePresence | 2023+ | Exit animations, layout animations |
| z-index: 9999 | Token-based z-index scale | Phase 39 | Predictable stacking |
| rgba() colors | oklch() colors | Tailwind v4 | Perceptually uniform, better interpolation |

**Deprecated/outdated:**
- Custom focus management when Radix primitive is installed
- Manual `body.style.overflow = "hidden"` for modal scroll lock (Radix handles this)
- Hardcoded rgba() for new theme colors (use oklch via tokens)

## Open Questions

1. **Select: Install @radix-ui/react-select or keep custom?**
   - What we know: Custom GlassSelect is fully functional with keyboard nav, search, groups
   - What's unclear: Whether Radix Select's positioning engine is needed
   - Recommendation: Keep custom for now. The existing implementation is solid and matches the glass aesthetic. Install Radix Select only if dropdown clipping becomes an issue in practice.

2. **Toast: Use Framer Motion or CSS animations?**
   - What we know: Framer Motion (12.29.3) is installed. CSS keyframes exist for slide-in/out.
   - What's unclear: Whether AnimatePresence is needed for proper exit animations
   - Recommendation: Use CSS animations for simplicity. The existing toast uses CSS `animate-slide-in-right` / `animate-slide-out-right`. Only switch to Framer Motion if smooth exit animations are required.

3. **CommandPalette: Include in Phase 41 or defer?**
   - What we know: CommandPalette.tsx exists in primitives/ and is fully functional
   - What's unclear: Whether it's a "building block" (Phase 41) or a "feature" (later)
   - Recommendation: Defer full CommandPalette to a later phase. Phase 41 delivers the building blocks (Kbd, ShortcutBadge) that the palette will eventually use. The existing primitives/ CommandPalette remains available as-is.

4. **Tooltip: Include or defer?**
   - What we know: GlassTooltip.tsx exists in primitives/ with portal rendering
   - What's unclear: Whether Tooltip is within Phase 41 scope (not in requirements list)
   - Recommendation: Defer. Not in CMX-01 through CMX-06 or RAY-01 through RAY-05. Can be promoted to ui/ in a future phase.

5. **Toggle/Switch: Separate component or part of another?**
   - What we know: GlassToggle exists in primitives/, Radix Switch is installed
   - What's unclear: Whether Toggle belongs in CMX scope (not explicitly listed but CONTEXT.md mentions it)
   - Recommendation: Include it. CONTEXT.md specifically calls out "Toggle/Switch: pixel-match Raycast's exact styling." Build it as `toggle.tsx` in ui/.

## Sources

### Primary (HIGH confidence)
- `/websites/radix-ui-primitives` (Context7) - Dialog anatomy, accessibility, keyboard interactions, Tabs vertical orientation, Switch usage
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassModal.tsx` - Existing modal with glass styling, ESC/click-outside behavior
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassSelect.tsx` - Complete select with keyboard nav, search, groups (700 lines)
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassToast.tsx` - Toast with provider, auto-dismiss, progress bar, variants
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassTabs.tsx` - Tabs with Raycast pill styling, controlled/uncontrolled
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/Kbd.tsx` - KeyCap with exact Raycast shadow extraction values
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/Divider.tsx` - Horizontal/vertical/labeled divider
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassAvatar.tsx` - Avatar with sizes, fallback, status, group
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassToggle.tsx` - Toggle with coral accent, spring animation
- `/Users/davideloreti/virtuna-v1.1/src/components/primitives/GlassAlert.tsx` - Alert/toast variant configurations
- `/Users/davideloreti/virtuna-v1.1/src/app/globals.css` - Full token system (two-tier: primitive + semantic)
- `/Users/davideloreti/virtuna-v1.1/src/types/design-tokens.ts` - TypeScript token types including ZIndexToken
- `/Users/davideloreti/virtuna-v1.1/package.json` - Confirms all Radix packages installed
- `/Users/davideloreti/virtuna-v1.1/node_modules/@radix-ui/` - Verified: react-dialog, react-tabs, react-switch, react-avatar installed

### Secondary (MEDIUM confidence)
- [Radix UI Dialog WAI-ARIA pattern](https://www.radix-ui.com/primitives/docs/components/dialog) - Focus trap, keyboard interactions
- [Radix UI Select group items](https://www.radix-ui.com/primitives/docs/components/select) - Group/Label pattern
- [Radix UI Tabs vertical orientation](https://www.radix-ui.com/primitives/docs/components/tabs) - Orientation prop, keyboard nav
- [Radix UI Switch usage](https://www.radix-ui.com/primitives/docs/components/switch) - Root/Thumb pattern
- Phase 40 Research (`40-RESEARCH.md`) - Established CVA/forwardRef/semantic-token patterns

### Tertiary (LOW confidence)
- [Raycast blog: A fresh look and feel](https://www.raycast.com/blog/a-fresh-look-and-feel) - Design philosophy, keycap icon inspiration
- [CSS keycap styling techniques](https://codepen.io/kelsS/pen/bGvEYdQ) - Multi-layer shadow approach for 3D keys
- [Raycast developers keyboard API](https://developers.raycast.com/api-reference/keyboard) - Modifier key naming conventions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and verified in node_modules
- Architecture: HIGH - Patterns established in Phase 40 + existing primitives provide clear templates
- Component behavior: HIGH - Existing primitives/ implementations cover all required behaviors
- Raycast pixel-fidelity: HIGH - Extraction values already captured in Kbd.tsx shadow values
- Pitfalls: HIGH - Derived from analysis of primitives/ vs ui/ inconsistencies

**Research date:** 2026-02-05
**Valid until:** 2026-03-07 (30 days - stable domain, all deps locked)
