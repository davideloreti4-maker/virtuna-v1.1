# Phase 46: Forms & Modals Migration - Research

**Researched:** 2026-02-05
**Domain:** React form/modal migration to design system components (Radix Dialog, Tailwind, Zod v4)
**Confidence:** HIGH

## Summary

This phase migrates 5 forms/form-like components and 4 modals from raw Radix primitives and hardcoded Tailwind classes to the existing v2.0 design system components. The codebase already has all required building blocks: `Dialog` (ui/dialog.tsx wrapping Radix), `Button`, `GlassInput` (primitives), `GlassTextarea` (primitives), `Select` (ui/select.tsx), `GlassCard` (primitives), `Badge`, and `Spinner`. No new libraries are needed.

All 5 existing modals (`TestTypeSelector`, `CreateSocietyModal`, `DeleteTestModal`, `LeaveFeedbackModal`, `SocietySelector`) currently import directly from `@radix-ui/react-dialog` or `@radix-ui/react-alert-dialog`, bypassing the design system Dialog wrapper. The migration replaces these raw Radix imports with the design system `Dialog*` components from `@/components/ui/dialog`, which already provide glass styling, z-index tokens, backdrop blur (via inline styles), and consistent animation via `tw-animate-css`.

Form validation is currently absent -- forms use simple `!content.trim()` checks. CONTEXT.md specifies on-blur + on-submit validation with inline error text. Zod v4 (already installed as `zod@^4.3.6`) is the standard validation library. No form library (react-hook-form, etc.) is needed for this scope -- the forms are simple enough for manual state + Zod schemas.

**Primary recommendation:** Replace all raw Radix Dialog imports with design system `Dialog*` components, swap all hardcoded form elements with `GlassInput`/`GlassTextarea`/`Select`/`Button`, add Zod v4 validation schemas, and implement dirty-form confirmation for modal close. Use v0 MCP for UI generation as specified in CONTEXT.md.

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@radix-ui/react-dialog` | ^1.1.15 | Dialog primitive underneath design system `Dialog` | Already used, provides focus trap + scroll lock + close-on-escape for free |
| `@radix-ui/react-alert-dialog` | ^1.1.15 | AlertDialog for destructive confirmation (DeleteTestModal) | Already used, prevents accidental close on overlay click |
| `zod` | ^4.3.6 | Form validation schemas | Already installed, Zod 4 with `{ error: }` syntax |
| `class-variance-authority` | ^0.7.1 | Component variant management | Already used across all design system components |
| `tw-animate-css` | ^1.4.0 | Animation classes (`animate-in`, `fade-in-0`, `zoom-in-95`) | Already imported in globals.css, used by Dialog |
| `@phosphor-icons/react` | ^2.1.10 | Design system icon library | Used by Icon component; TestTypeSelector cards need Phosphor icons |
| `lucide-react` | ^0.563.0 | Legacy icon library still in app components | Existing in all app components, migration to Phosphor is separate scope |

### Supporting (already available)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zustand` | ^5.0.10 | State management | Test store, society store already manage form flow state |
| `framer-motion` | ^12.29.3 | Advanced animations | NOT needed for this phase -- Dialog animations handled by tw-animate-css + Radix data-state |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual state + Zod | react-hook-form + @hookform/resolvers/zod | Overkill for 3-5 field forms; adds dependency, increases bundle |
| tw-animate-css Dialog animations | framer-motion AnimatePresence | Already working via tw-animate-css; framer adds complexity for no gain here |
| Design system `Dialog` (ui/) | Primitives `GlassModal` (primitives/) | `Dialog` wraps Radix (focus trap, scroll lock built-in); `GlassModal` uses manual `createPortal` + manual focus/scroll management -- `Dialog` is strictly better |
| Manual dirty-form tracking | Form library with isDirty | Simple `useRef` comparison sufficient for these forms |

**Installation:** No new packages needed. Everything is already installed.

## Architecture Patterns

### Recommended Component Structure

```
src/components/app/
├── content-form.tsx        # MIGRATE: raw textarea + button -> GlassTextarea + Button
├── survey-form.tsx         # MIGRATE: raw inputs + Radix DropdownMenu -> GlassInput + Select + Button
├── test-type-selector.tsx  # MIGRATE: raw Radix Dialog -> Dialog + GlassCard grid
├── create-society-modal.tsx # MIGRATE: raw Radix Dialog -> Dialog + GlassTextarea + Button
├── delete-test-modal.tsx   # MIGRATE: raw Radix AlertDialog -> Dialog (AlertDialog pattern) + Button destructive
├── leave-feedback-modal.tsx # MIGRATE: raw Radix Dialog -> Dialog + GlassInput + GlassTextarea + Button
├── society-selector.tsx    # MIGRATE: raw Radix Dialog -> Dialog + GlassCard
└── test-creation-flow.tsx  # ORCHESTRATOR: no changes needed (routes between forms/modals)
```

### Pattern 1: Modal Migration (raw Radix -> design system Dialog)

**What:** Replace `import * as Dialog from "@radix-ui/react-dialog"` + manual overlay/content styling with design system `Dialog*` components from `@/components/ui/dialog`.

**When to use:** Every modal in this phase.

**Before (current):**
```tsx
import * as Dialog from "@radix-ui/react-dialog";

<Dialog.Root open={open} onOpenChange={onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm ..." />
    <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md ... rounded-2xl border border-zinc-800 bg-zinc-900 ...">
      <Dialog.Title className="text-lg font-semibold text-white">...</Dialog.Title>
      ...
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

**After (design system):**
```tsx
import {
  Dialog, DialogContent, DialogHeader, DialogFooter,
  DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent size="md">
    <DialogHeader>
      <DialogTitle>...</DialogTitle>
      <DialogDescription>...</DialogDescription>
    </DialogHeader>
    <div className="p-6">
      {/* Form content */}
    </div>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="secondary">Cancel</Button>
      </DialogClose>
      <Button variant="primary">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**What the design system Dialog provides for free:**
- Focus trap (Radix built-in)
- Scroll lock (Radix built-in)
- Escape to close (Radix built-in)
- Overlay click to close (Radix built-in)
- z-index tokens (`--z-modal-backdrop: 300`, `--z-modal: 400`)
- Glass styling (border-border-glass, bg-surface-elevated)
- Backdrop blur via inline styles (Lightning CSS workaround)
- Fade + scale animation via tw-animate-css (`animate-in`/`animate-out`, `fade-in-0`, `zoom-in-95`)
- Duration 200ms already set in `dialogContentVariants`

### Pattern 2: Form Input Migration (raw elements -> design system inputs)

**What:** Replace raw `<textarea>`, `<input>`, and custom dropdowns with `GlassTextarea`, `GlassInput`, and `Select`.

**Key mappings:**
| Current | Design System | Import From |
|---------|---------------|-------------|
| `<textarea className="...border-zinc-800 bg-zinc-900...">` | `<GlassTextarea size="md" autoResize />` | `@/components/primitives/GlassTextarea` |
| `<input className="...border-zinc-700 bg-zinc-800...">` | `<GlassInput size="md" />` | `@/components/primitives/GlassInput` |
| Radix `DropdownMenu` (QuestionTypeDropdown) | `<Select options={...} />` | `@/components/ui/select` |
| `<button className="...bg-orange-500...">` | `<Button variant="primary">` | `@/components/ui/button` |
| `<button className="...bg-red-600...">` | `<Button variant="destructive">` | `@/components/ui/button` |
| `<button className="...border-zinc-700 bg-transparent...">` | `<Button variant="secondary">` | `@/components/ui/button` |
| `<Loader2 className="animate-spin">` | `<Spinner size="sm" />` inside `<Button loading>` | `@/components/ui/spinner` or Button's built-in loading |

### Pattern 3: Zod v4 Validation with On-Blur + On-Submit

**What:** Add validation schemas using Zod v4 syntax. Validate on blur and on submit. Show inline errors below fields.

**Zod v4 syntax (note: `error` replaces `message`):**
```tsx
import { z } from "zod";

const contentFormSchema = z.object({
  content: z.string()
    .min(1, { error: "Required" })
    .min(10, { error: "At least 10 characters" }),
});

const feedbackFormSchema = z.object({
  name: z.string().optional(),
  email: z.string().email({ error: "Enter a valid email" }).optional().or(z.literal("")),
  feedback: z.string().min(1, { error: "Required" }),
});

const createSocietySchema = z.object({
  description: z.string()
    .min(1, { error: "Required" })
    .min(10, { error: "At least 10 characters" }),
});
```

**Validation hook pattern (manual, no library):**
```tsx
const [errors, setErrors] = useState<Record<string, string>>({});

const validateField = (field: string, value: string) => {
  const result = schema.shape[field].safeParse(value);
  setErrors(prev => ({
    ...prev,
    [field]: result.success ? "" : result.error.issues[0]?.message ?? "",
  }));
};

const validateForm = () => {
  const result = schema.safeParse(formData);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string;
      if (!fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    setErrors(fieldErrors);
    return false;
  }
  setErrors({});
  return true;
};
```

### Pattern 4: Dirty Form Confirmation on Modal Close

**What:** Track if form fields have been modified. On close attempt (overlay click, escape, close button), show "Discard changes?" confirmation if dirty.

```tsx
const [isDirty, setIsDirty] = useState(false);
const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

const handleOpenChange = (open: boolean) => {
  if (!open && isDirty) {
    setShowDiscardConfirm(true);
    return; // Don't close yet
  }
  onOpenChange(open);
};

// Track dirty state on any input change
const handleFieldChange = (setter: Function) => (value: string) => {
  setter(value);
  setIsDirty(true);
};
```

### Pattern 5: Character Counter on Textareas

**What:** Show `42/500` counter when within 20% of max length. Position bottom-right.

```tsx
const MAX_LENGTH = 500;
const COUNTER_THRESHOLD = MAX_LENGTH * 0.8; // Show at 80%+

{content.length >= COUNTER_THRESHOLD && (
  <span className={cn(
    "text-sm",
    content.length >= MAX_LENGTH ? "text-error" : "text-foreground-muted"
  )}>
    {content.length}/{MAX_LENGTH}
  </span>
)}
```

### Pattern 6: Submit Button Loading State

**What:** Button shows Spinner and is disabled during submission. Button dimensions maintained.

```tsx
<Button
  type="submit"
  variant="primary"
  loading={isSubmitting}
  disabled={!isValid || isSubmitting}
>
  {isSubmitting ? "Matching AI personas..." : "Create your society"}
</Button>
```

The design system `Button` already has a `loading` prop that renders `<Loader2 className="h-4 w-4 animate-spin" />` and sets `disabled` + `aria-busy`. However, note it uses Lucide's Loader2, not the design system Spinner. This is acceptable -- the loading state already works correctly.

### Anti-Patterns to Avoid

- **Importing raw Radix Dialog:** Always use `@/components/ui/dialog` wrapper. Never `@radix-ui/react-dialog` directly in app components.
- **Hardcoding colors:** No `border-zinc-800`, `bg-zinc-900`, `text-zinc-400`, `bg-orange-500`, `bg-red-600`. Use design tokens: `border-border`, `bg-surface`, `text-foreground-secondary`, `bg-accent`, `bg-error`.
- **Manual scroll lock / focus trap:** The Dialog component handles this via Radix. Never add `document.body.style.overflow = "hidden"` manually.
- **Manual z-index values:** Use CSS variables `var(--z-modal)` (400), `var(--z-modal-backdrop)` (300), `var(--z-dropdown)` (100).
- **Using primitives/GlassModal instead of ui/Dialog:** GlassModal uses manual `createPortal` and manual focus/escape handling. The design system Dialog wraps Radix which is strictly superior.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal overlay + animation | Manual portal + CSS keyframes | Design system `Dialog` + tw-animate-css | Focus trap, scroll lock, z-index, animation all handled |
| Focus trap in modals | Manual `keydown` listener for Tab | Radix Dialog (via design system `Dialog`) | Radix handles edge cases: shift+tab, focus-scope, inert |
| Scroll lock when modal open | `document.body.style.overflow = "hidden"` | Radix Dialog built-in | Handles scroll position restoration, iOS quirks |
| Form validation | Manual regex checks | Zod v4 schemas | Type-safe, composable, consistent error messages |
| Select dropdown keyboard nav | Manual keydown handlers | Design system `Select` component | ArrowUp/Down, Home/End, Enter, Escape, type-ahead all handled |
| Loading spinner in button | Custom spinner component | `Button` `loading` prop | Handles disabled state, aria-busy, spinner placement |
| Error state styling | Per-component conditional classes | `GlassInput error` / `GlassTextarea error` props | Consistent error borders, focus rings, aria-invalid |

**Key insight:** The design system was built to solve exactly these problems. The migration is primarily a replacement operation -- swapping raw elements for design system equivalents. The complexity is in preserving business logic and data flow during the swap, not in building new UI capabilities.

## Common Pitfalls

### Pitfall 1: Two Dialog Systems (ui/ vs primitives/)

**What goes wrong:** The codebase has TWO modal components: `ui/dialog.tsx` (Radix-based, design system) and `primitives/GlassModal.tsx` (manual portal). Using the wrong one causes inconsistent behavior.

**Why it happens:** Both exist from different design system phases. GlassModal was a primitives-layer exploration; Dialog was the final design system solution.

**How to avoid:** ALWAYS use `@/components/ui/dialog` for modals in this phase. Never import from `primitives/GlassModal`.

**Warning signs:** Import path containing `primitives/GlassModal` or manual `createPortal` usage in modal components.

### Pitfall 2: DeleteTestModal Uses AlertDialog, Not Dialog

**What goes wrong:** Replacing `@radix-ui/react-alert-dialog` with the design system Dialog loses the "no close on overlay click" behavior that AlertDialog provides for destructive confirmations.

**Why it happens:** Regular Dialog closes on overlay click; AlertDialog does not. This is intentional -- destructive actions should require explicit user action (click Cancel or Delete).

**How to avoid:** For DeleteTestModal, keep using `@radix-ui/react-alert-dialog` for the Root/Portal/Overlay/Content primitives, but apply the design system's visual styling (glass background, border tokens, z-index tokens). Alternatively, use Dialog with a custom `onInteractOutside={(e) => e.preventDefault()}` handler to prevent overlay close.

**Warning signs:** DeleteTestModal closing when user clicks overlay after migration.

### Pitfall 3: Backdrop-Filter Stripped by Lightning CSS

**What goes wrong:** Adding `backdrop-filter: blur(...)` to CSS classes has no effect because Tailwind v4's Lightning CSS strips it during compilation.

**Why it happens:** Known Lightning CSS limitation documented in project MEMORY.md.

**How to avoid:** Always apply backdrop-filter via React inline styles: `style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}`. The design system Dialog already does this correctly.

**Warning signs:** Glass panels appearing without blur effect.

### Pitfall 4: Icon Library Mismatch (Lucide vs Phosphor)

**What goes wrong:** Inconsistent icon rendering when mixing Lucide icons (currently in app components) with Phosphor icons (design system standard).

**Why it happens:** The TestTypeSelector uses Lucide icons and custom SVGs for X/TikTok logos. The design system Icon wrapper expects Phosphor icons.

**How to avoid:** For this migration phase, keep Lucide icons in components that already use them. Icon library migration is separate scope. Focus on form/modal component structure, not icon swaps.

**Warning signs:** Trying to pass Lucide icon components to the design system `Icon` component (which expects `PhosphorIcon` type).

### Pitfall 5: TestTypeSelector Is NOT a Card Grid Today

**What goes wrong:** Over-engineering the TestTypeSelector migration. The current implementation is a 3-column menu layout with category headers and list items, NOT a card grid.

**Why it happens:** The requirements say "TestTypeSelector renders as a Dialog with a GlassCard grid for type selection." This is a design change, not just a component swap.

**How to avoid:** Recognize this is the one component that changes layout structure (menu -> card grid). Use GlassCard with `hover="lift"` for each test type. The grid changes from 3-column categories to a responsive grid of 11 type cards. This is the most complex individual migration.

**Warning signs:** Trying to map the existing 3-column category layout onto GlassCards 1:1.

### Pitfall 6: SocietySelector Has _hydrate Pattern

**What goes wrong:** Breaking the hydration flow when migrating SocietySelector to use design system Dialog.

**Why it happens:** SocietySelector uses `useSocietyStore()._hydrate()` and checks `_isHydrated` for SSR safety. This is an old pattern that Phase 45 replaced with Zustand persist middleware for the sidebar store.

**How to avoid:** The scope boundary says "does NOT change business logic." Keep the `_hydrate` pattern as-is in this phase. Migrating to Zustand persist is future scope.

**Warning signs:** Removing `_hydrate()` calls or `_isHydrated` checks during the component swap.

### Pitfall 7: Dirty Form Confirmation Interferes with Dialog onOpenChange

**What goes wrong:** The dirty-form confirmation dialog fights with the parent Dialog's onOpenChange handler, causing double-close or no-close scenarios.

**Why it happens:** Radix Dialog's `onOpenChange(false)` fires on overlay click and escape. If you intercept it to show a confirmation, you need to prevent the Dialog from actually closing.

**How to avoid:** Use controlled Dialog state and intercept in `onOpenChange`:
```tsx
const handleOpenChange = (open: boolean) => {
  if (!open && isDirty) {
    // Show confirmation instead of closing
    setShowDiscardConfirm(true);
    return;
  }
  onOpenChange(open);
};
```

**Warning signs:** Modal closing before user confirms discard, or confirmation dialog appearing but parent modal also closing.

### Pitfall 8: Enter Key Submitting Textareas

**What goes wrong:** Enter key behavior differs between input and textarea. If form has `onSubmit` and textarea, pressing Enter in textarea should insert newline, not submit.

**Why it happens:** CONTEXT.md specifies "Enter submits single-line inputs, not textareas." Default `<form>` behavior submits on Enter from any input.

**How to avoid:** Use `onKeyDown` on single-line inputs to trigger submit. Do NOT rely on form's native Enter-to-submit for the entire form. Or, ensure the submit button is `type="submit"` and inputs are `type="text"` (which triggers form submit on Enter) while textareas naturally don't.

**Warning signs:** Pressing Enter in a textarea submitting the form.

## Code Examples

### Example 1: CreateSocietyModal Migration

```tsx
// AFTER migration
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GlassTextarea } from "@/components/primitives/GlassTextarea";

export function CreateSocietyModal({ open, onOpenChange }: CreateSocietyModalProps) {
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      // Show discard confirmation
      return;
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Who do you want in your society?</DialogTitle>
          <DialogDescription>
            Describe the people you want in your society...
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <GlassTextarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setIsDirty(true);
            }}
            onBlur={() => validateField("description", description)}
            error={!!errors.description}
            placeholder="e.g. Founders in London..."
            autoResize
            minRows={3}
          />
          {errors.description && (
            <p className="text-sm text-error" role="alert">{errors.description}</p>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={!description.trim() || isSubmitting}
            className="w-full"
          >
            Create your society
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### Example 2: TestTypeSelector Card Grid

```tsx
// AFTER migration - responsive GlassCard grid inside Dialog
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GlassCard } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";

<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent size="xl">
    <DialogHeader>
      <DialogTitle>What would you like to simulate?</DialogTitle>
      <DialogDescription>Select a test type to begin</DialogDescription>
    </DialogHeader>
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEST_CATEGORIES.flatMap(cat => cat.types).map(typeId => {
          const config = TEST_TYPES[typeId];
          return (
            <GlassCard
              key={typeId}
              hover="lift"
              padding="md"
              onClick={() => handleSelectType(typeId)}
              className="cursor-pointer"
            >
              <div className="flex flex-col gap-2">
                {/* Icon */}
                <IconComponent className="h-8 w-8 text-foreground-secondary" />
                {/* Title */}
                <span className="font-semibold text-foreground">{config.name}</span>
                {/* Description */}
                <span className="text-sm text-foreground-secondary line-clamp-1">
                  {config.description}
                </span>
                {/* Optional badge */}
                {typeId === "survey" && <Badge variant="info" size="sm">Popular</Badge>}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  </DialogContent>
</Dialog>
```

### Example 3: SurveyForm with Design System Select

```tsx
// AFTER migration - uses Select instead of Radix DropdownMenu
import { Select } from "@/components/ui/select";
import { GlassInput } from "@/components/primitives/GlassInput";
import { Button } from "@/components/ui/button";

const QUESTION_TYPE_OPTIONS = [
  { value: "single-select", label: "Single Select" },
  { value: "open-response", label: "Open Response" },
];

<Select
  options={QUESTION_TYPE_OPTIONS}
  value={questionType}
  onChange={(val) => setQuestionType(val as QuestionType)}
  placeholder="Select question type..."
/>

<GlassInput
  value={option}
  onChange={(e) => updateOption(index, e.target.value)}
  placeholder={`Option ${index + 1}`}
  size="md"
/>
```

### Example 4: DeleteTestModal with Destructive Button

```tsx
// Keep AlertDialog for destructive action (prevents overlay close)
// But apply design system visual styling
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "@/components/ui/button";

<AlertDialog.Root open={open} onOpenChange={onOpenChange}>
  <AlertDialog.Portal>
    <AlertDialog.Overlay className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <AlertDialog.Content className="fixed left-[50%] top-[50%] z-[var(--z-modal)] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-xl border border-border-glass bg-surface-elevated shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <div className="p-6 space-y-4">
        <AlertDialog.Title className="text-lg font-semibold text-foreground">
          Delete this test?
        </AlertDialog.Title>
        <AlertDialog.Description className="text-sm text-foreground-secondary">
          This action cannot be undone.
        </AlertDialog.Description>
        <div className="flex justify-end gap-3 pt-2">
          <AlertDialog.Cancel asChild>
            <Button variant="secondary">Cancel</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button variant="destructive" onClick={onConfirm}>Delete</Button>
          </AlertDialog.Action>
        </div>
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
```

## State of the Art

| Old Approach (current codebase) | Current Approach (target) | Impact |
|--------------------------------|---------------------------|--------|
| Raw `@radix-ui/react-dialog` import in every modal | Design system `Dialog*` components from `@/components/ui/dialog` | Consistent glass styling, z-index tokens, animation |
| Hardcoded `bg-zinc-900`, `border-zinc-800`, `text-zinc-400` | Semantic tokens: `bg-surface`, `border-border`, `text-foreground-secondary` | Theme-able, consistent, maintainable |
| `bg-orange-500` for accent buttons | `Button variant="primary"` (uses `bg-accent`) | Brand consistency via design tokens |
| No form validation | Zod v4 schemas with `{ error: }` syntax | Type-safe validation, consistent error messaging |
| `Loader2` spinner in manual JSX | `Button loading` prop or `Spinner` component | Consistent loading states |
| Radix `DropdownMenu` for question type selection | Design system `Select` component | Consistent dropdown behavior, glass styling |
| Manual `document.body.style.overflow` | Radix Dialog built-in scroll lock | Correct scroll position restoration |

**Deprecated/outdated patterns in this codebase:**
- `primitives/GlassModal.tsx`: Superseded by `ui/dialog.tsx`. The GlassModal uses manual portal + manual focus management. Dialog wraps Radix which handles all of this correctly.
- Zod v3 `{ message: }` syntax: Project uses Zod v4 (`^4.3.6`). Use `{ error: }` instead.
- `_hydrate()` pattern in society-store: Phase 45 established Zustand persist middleware as the standard. But migrating SocietyStore is out of scope for this phase.

## Open Questions

1. **GlassInput vs ui/Input -- which to use in migrated forms?**
   - What we know: Two input components exist. `ui/input.tsx` (`Input`, `InputField`) uses semantic tokens (bg-surface, border-border, text-foreground). `primitives/GlassInput.tsx` uses raw CSS variable references (--color-fg, --color-accent-transparent) and inline backdrop-filter.
   - What's unclear: Phase description says "use design system GlassInput". The primitives layer `GlassInput` has more features (leftIcon, rightIcon, showClear, loading) but uses older token patterns. The `ui/InputField` has label + error message built in.
   - **Recommendation:** Use `primitives/GlassInput` as specified in requirements, since it has richer feature set (icons, clear, loading). Wrap with label/error markup pattern similar to `ui/InputField`. The visual difference is minimal (both have glass styling on dark bg).

2. **GlassTextarea error display**
   - What we know: `GlassTextarea` has an `error` boolean prop that adds red border. But it does NOT render error text below the field (unlike `GlassInput` which renders error text when `error` is a string).
   - What's unclear: Should error text be added to GlassTextarea itself or handled externally?
   - **Recommendation:** Handle error text externally (JSX below the component) since the CONTEXT.md scope says "does not redesign layouts." Adding error text rendering to GlassTextarea would be a component enhancement, not a migration.

3. **TestTypeSelector card layout: keep categories or flatten?**
   - What we know: Current TestTypeSelector has 3 columns with category headers (Survey, Marketing Content, Social Media Posts, Communication, Product). Requirements say "GlassCard grid for type selection."
   - What's unclear: Should categories be preserved as section headers in the new grid, or should all 11 types be in a flat grid?
   - **Recommendation:** Flatten into a responsive grid since CONTEXT.md says "Claude decides column count." Category context is less important in a visual card grid where each card is self-explanatory via icon + title + description. 2-col mobile, 3-col desktop for 11 types.

4. **Mobile bottom sheet behavior for complex modals**
   - What we know: CONTEXT.md says "Complex modals with forms (create society, content form) render as bottom sheets taking ~60-70% of screen height" on mobile.
   - What's unclear: The current design system Dialog doesn't have a bottom-sheet variant. It centers all modals.
   - **Recommendation:** For this phase, use the Dialog's existing centered behavior on mobile with appropriate sizing. A true bottom sheet variant would require extending DialogContent, which is a design system enhancement. Flag for future phase. The centered modal with `max-w-[90vw]` is acceptable for v2.1.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/components/ui/dialog.tsx` - Radix Dialog wrapper with focus trap, scroll lock, glass styling, animation
- Codebase analysis: `src/components/ui/button.tsx` - Button with loading state, 4 variants, 3 sizes
- Codebase analysis: `src/components/ui/select.tsx` - Custom Select with keyboard nav, groups, searchable
- Codebase analysis: `src/components/primitives/GlassInput.tsx` - Glass input with icons, clear, error, loading
- Codebase analysis: `src/components/primitives/GlassTextarea.tsx` - Glass textarea with auto-resize, error
- Codebase analysis: `src/components/primitives/GlassCard.tsx` - Card with glow, tint, hover variants
- Codebase analysis: All 5 modal components + 2 form components in `src/components/app/`
- Context7: `/websites/radix-ui` - Dialog focus management with onOpenAutoFocus
- Context7: `/websites/zod_dev_v4` - Zod 4 uses `{ error: }` instead of `{ message: }`

### Secondary (MEDIUM confidence)
- Radix Dialog docs - Focus trap handles Tab/Shift+Tab cycling, inert attribute on background
- Radix Dialog docs - Scroll lock via `removeScroll` prop on DialogContent (enabled by default)
- tw-animate-css - Provides `animate-in`, `animate-out`, `fade-in-0`, `zoom-in-95` classes used by Dialog

### Tertiary (LOW confidence)
- Mobile bottom sheet pattern: No official Dialog bottom-sheet variant found in Radix or current design system. Custom extension would be needed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and verified in codebase
- Architecture: HIGH - Pattern is replacement migration with clear before/after for every component
- Pitfalls: HIGH - All pitfalls identified from direct codebase analysis (two Dialog systems, AlertDialog, Lightning CSS, icon mismatch, hydration)
- Form validation: HIGH - Zod v4 already installed, syntax verified via Context7
- Mobile bottom sheet: LOW - Design system Dialog doesn't support this; flagged as open question

**Research date:** 2026-02-05
**Valid until:** 2026-03-05 (stable - no moving dependencies)
