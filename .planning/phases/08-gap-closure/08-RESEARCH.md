# Phase 8: Gap Closure - Research

**Researched:** 2026-02-17
**Domain:** UI gap closure, bug fixes, tech debt cleanup
**Confidence:** HIGH

## Summary

Phase 8 closes all gaps found during the v1.0 milestone audit. There are 3 broken E2E flows (add competitor, remove competitor, self-benchmarking) plus 4 tech debt items. The work is entirely within existing code patterns -- no new libraries, no new architectural decisions. Every fix has a clear code path and verified target.

The self-benchmarking bug is a confirmed one-line fix: `compare/page.tsx` line 138 queries `.eq("id", user.id)` on the `creator_profiles` table, but `user.id` is the Supabase auth UUID. The table's PK `id` is a separate UUID; the correct column is `user_id` (which references `auth.users(id)`). This was verified against the database schema migration and TypeScript types.

The add/remove competitor UI components are the only new files needed. All server actions, server components, and data flows already exist and are verified working from phases 2-7. The work is purely UI wiring.

**Primary recommendation:** Execute as 2 plans: Plan 08-01 handles all code-level fixes (self-benchmarking bug, error handling, skeleton wiring, Phase 1 VERIFICATION.md). Plan 08-02 creates the two new UI components (AddCompetitorDialog, RemoveCompetitorButton) and wires them into existing pages.

## Standard Stack

### Core (already installed -- zero new packages)

| Library | Version | Purpose | Already Used In |
|---------|---------|---------|-----------------|
| `@radix-ui/react-dialog` | ^1.1.15 | Add Competitor dialog | `src/components/ui/dialog.tsx` |
| `@radix-ui/react-alert-dialog` | ^1.1.15 | Remove confirmation dialog | `src/components/app/delete-test-modal.tsx` |
| `react` (useTransition) | 19.2.3 | Non-blocking async actions | `src/components/competitors/scrape-error-banner.tsx` |
| `lucide-react` | ^0.563.0 | Icons (Plus, Trash2, etc.) | Used across 20+ components |
| `@phosphor-icons/react` | ^2.1.10 | Icons (UsersThree in empty state) | Used in empty state, toast, sidebar |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/cache` (revalidatePath) | 16.1.5 | Cache invalidation after add/remove | Already used in both server actions |
| `zod` | ^4.3.6 | Handle validation (if client-side validation added) | Already used in schemas |

### Alternatives Considered

None. Zero new packages per prior decision. Everything needed is already installed.

**Installation:** None required.

## Architecture Patterns

### Existing Project Structure (relevant files)

```
src/
├── app/
│   ├── actions/competitors/
│   │   ├── add.ts               # addCompetitor(handle) -- EXISTS, returns ActionResult
│   │   └── remove.ts            # removeCompetitor(competitorId) -- EXISTS, returns ActionResult
│   └── (app)/competitors/
│       ├── competitors-client.tsx  # Dashboard client -- needs Add button + remove wiring
│       ├── page.tsx               # Server component -- no changes needed
│       ├── loading.tsx            # Uses CompetitorCardSkeletonGrid -- needs table skeleton
│       └── compare/
│           └── page.tsx           # Self-benchmarking bug on line 138
├── components/
│   ├── competitors/
│   │   ├── competitor-card.tsx            # Needs remove button
│   │   ├── competitor-table.tsx           # Needs remove button per row
│   │   ├── competitor-table-skeleton.tsx  # EXISTS but never imported
│   │   └── competitor-empty-state.tsx     # Needs onClick for CTA button
│   └── ui/
│       ├── dialog.tsx                     # Radix Dialog wrapper -- reuse for add dialog
│       └── input.tsx                      # InputField component -- reuse for handle input
└── .planning/phases/
    └── 01-data-foundation/               # Needs VERIFICATION.md (process gap)
```

### Pattern 1: Server Action with useTransition (Existing Pattern)

**What:** Call server actions from client components using React 19's `useTransition` for non-blocking UI updates.
**When to use:** Every async action triggered by user interaction (add competitor, remove competitor).
**Example from codebase:**

```typescript
// Source: src/components/competitors/scrape-error-banner.tsx (existing pattern)
"use client";
import { useTransition } from "react";
import { retryScrape } from "@/app/actions/competitors/retry-scrape";

export function ScrapeErrorBanner({ handle }: { handle: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await retryScrape(handle);
        });
      }}
    >
      {isPending ? "Retrying..." : "Retry"}
    </button>
  );
}
```

### Pattern 2: Dialog Component (Existing Pattern)

**What:** Radix Dialog with opaque dark bg, inset shadow highlight, size variants.
**When to use:** The add competitor dialog.
**Example from codebase:**

```typescript
// Source: src/components/ui/dialog.tsx (existing component)
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Form content */}
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="secondary">Cancel</Button>
      </DialogClose>
      <Button variant="primary">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Pattern 3: AlertDialog for Destructive Confirmation (Existing Pattern)

**What:** Radix AlertDialog for destructive actions -- prevents close on overlay click.
**When to use:** Remove competitor confirmation.
**Example from codebase:**

```typescript
// Source: src/components/app/delete-test-modal.tsx (existing pattern)
<AlertDialog.Root open={open} onOpenChange={onOpenChange}>
  <AlertDialog.Portal>
    <AlertDialog.Overlay className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/60 ..." />
    <AlertDialog.Content
      className="fixed left-[50%] top-[50%] z-[var(--z-modal)] ..."
      style={{ backgroundColor: "rgba(17, 18, 20, 0.95)", ... }}
    >
      <AlertDialog.Title>Delete this?</AlertDialog.Title>
      <AlertDialog.Description>This cannot be undone.</AlertDialog.Description>
      <div className="mt-6 flex justify-end gap-3">
        <AlertDialog.Cancel asChild><Button variant="secondary">Cancel</Button></AlertDialog.Cancel>
        <AlertDialog.Action asChild><Button variant="destructive" onClick={onConfirm}>Delete</Button></AlertDialog.Action>
      </div>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
```

### Pattern 4: Toast Notifications (Existing Pattern)

**What:** Toast system for success/error feedback after async actions.
**When to use:** After add/remove competitor to confirm success or show error.
**Example:**

```typescript
// Source: src/components/ui/toast.tsx (existing hook)
const { toast } = useToast();
toast({ variant: "success", title: "Competitor added!" });
toast({ variant: "error", title: "Failed to add competitor", description: error });
```

**Note:** `ToastProvider` is already in the app layout (`src/app/(app)/layout.tsx`), so `useToast()` is available in all competitor components.

### Anti-Patterns to Avoid

- **Creating new modal components from scratch:** Reuse existing Dialog/AlertDialog primitives. The dialog.tsx and delete-test-modal.tsx have all the styling patterns.
- **Calling server actions without useTransition:** Always wrap in `startTransition()` for non-blocking UI. The Button component has a `loading` prop for pending state.
- **Adding onClick to server components:** The empty state CTA and header button live in client components (`competitors-client.tsx`, `competitor-empty-state.tsx` is already "use client"). No server/client boundary issues.
- **Ignoring server action return values:** The `addCompetitor` action returns `{ error?: string; data?: { competitorId: string; handle: string } }`. Always check the return and surface errors via toast.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialog | Custom portal/overlay | `@radix-ui/react-dialog` (already installed) | Focus trap, scroll lock, keyboard handling, accessible by default |
| Destructive confirmation | Custom confirm() | `@radix-ui/react-alert-dialog` (already installed) | Prevents accidental dismissal, proper a11y roles |
| Handle normalization | Custom regex parsing | `normalizeHandle()` from `src/lib/schemas/competitor.ts` | Already handles URLs, @prefix, lowercase |
| Non-blocking async UI | Manual isPending state | `React.useTransition` | Built into React 19, concurrent rendering, automatic batching |
| Toast notifications | Custom alert/banner | `useToast()` from `src/components/ui/toast.tsx` | Already wired into app layout, has variants, auto-dismiss |

**Key insight:** Every building block already exists in this codebase. This phase is assembly, not creation.

## Common Pitfalls

### Pitfall 1: Event Propagation on Table Row Remove Button

**What goes wrong:** Clicking "Remove" on a table row triggers the row's `onClick` (which navigates to the detail page) AND the remove action.
**Why it happens:** The table row has `onClick={() => router.push(...)}` and the remove button is inside the row.
**How to avoid:** Call `e.stopPropagation()` on the remove button's click handler before triggering the action.
**Warning signs:** Clicking remove navigates away instead of showing the confirmation dialog.

### Pitfall 2: Dialog State in Rendered Lists

**What goes wrong:** Opening a dialog for one card/row opens it for all, or the wrong competitor gets removed.
**Why it happens:** A single dialog state is shared across all items in a `.map()`.
**How to avoid:** Track which competitor is selected (by ID) in state, render a single dialog instance outside the loop, pass the selected competitor's data to it.
**Warning signs:** Wrong competitor name appears in confirmation dialog.

### Pitfall 3: CompetitorCard is Wrapped in a Link

**What goes wrong:** The remove button click navigates to the detail page instead of triggering removal.
**Why it happens:** `CompetitorCard` is wrapped in a `<Link href={/competitors/${handle}}>` tag. Any click inside the card triggers navigation.
**How to avoid:** Use `e.preventDefault()` and `e.stopPropagation()` on the remove button. Or restructure the card so the link wraps only the content area, not the action buttons.
**Warning signs:** Clicking remove button navigates to detail page.

### Pitfall 4: Server Action Revalidation Race Condition

**What goes wrong:** After adding a competitor, the list doesn't update because `revalidatePath` fires before the UI re-renders.
**Why it happens:** Next.js server actions already call `revalidatePath("/competitors")` in both `add.ts` and `remove.ts`. The dialog should close and the `useTransition` pending state resolves, but the new data may not be in the UI yet if there's a client-side cache.
**How to avoid:** Close the dialog on success, rely on `revalidatePath` (already implemented in both actions), and use `router.refresh()` as a fallback only if needed.
**Warning signs:** Competitor appears in database but not in the UI until manual refresh.

### Pitfall 5: Self-Benchmarking "me" Value Requires userHandle to Be Non-Null

**What goes wrong:** After fixing `.eq("user_id", user.id)`, the "You" option still doesn't appear in the comparison selector.
**Why it happens:** The `showSelfOption` prop on `ComparisonSelector` requires `selfHandle` to be truthy (see line 38 of comparison-selector.tsx: `{showSelfOption && selfHandle && ...}`). If the user hasn't set their TikTok handle during onboarding, `userHandle` is null.
**How to avoid:** This is expected behavior -- only show "You" when the user has a TikTok handle. The bug fix is still correct; the null check is defensive by design.
**Warning signs:** None -- this is intentional.

## Code Examples

### Fix 1: Self-Benchmarking Bug (one-line fix)

```typescript
// File: src/app/(app)/competitors/compare/page.tsx, line 138
// BEFORE (broken):
.eq("id", user.id)

// AFTER (fixed):
.eq("user_id", user.id)
```

**Why:** The `creator_profiles` table has:
- `id` (UUID PK, auto-generated) -- NOT the auth user ID
- `user_id` (UUID FK to auth.users, UNIQUE) -- the auth user ID

The code passes `user.id` (from `supabase.auth.getUser()`), which is the auth UUID. It must match against `user_id`, not `id`.

**Verified against:**
- Migration: `supabase/migrations/20260202000000_v16_schema.sql` lines 9-11 (PK `id`, FK `user_id`)
- TypeScript types: `src/types/database.types.ts` lines 457-477 (separate `id` and `user_id` fields)
- RLS policy: `creator_profiles FOR SELECT USING (user_id = (SELECT auth.uid()))` confirms `user_id` is the auth column

### Fix 2: addCompetitor Return Value Error Handling

```typescript
// File: src/app/(app)/competitors/compare/page.tsx, line 200
// BEFORE (silently ignores error):
await addCompetitor(userHandle);

// AFTER (checks for error):
const result = await addCompetitor(userHandle);
if (result.error) {
  console.error("[ComparePage] Self-tracking setup failed:", result.error);
}
```

**Note:** This is a server component, so no toast available. Console error is appropriate. The page still renders -- the user just won't see their data in comparison until the profile exists.

### Fix 3: CompetitorTableSkeleton Wiring

```typescript
// File: src/app/(app)/competitors/loading.tsx
// The loading page currently only shows card skeleton.
// Need to import and conditionally render table skeleton.
// However, loading.tsx is a server component with no access to Zustand store.
// Best approach: show card skeleton (default view mode is "grid" in store).
// Alternative: render both skeletons, hide one with CSS.
// Simplest: just import and render the table skeleton below the card skeleton,
// wrapped in a display toggle or as a standalone component.
//
// Since loading.tsx can't read Zustand (server component), and default is "grid",
// the card skeleton is correct default. The table skeleton should be imported
// as a fallback or used in the client component during transition.
```

### Example: AddCompetitorDialog (new component)

```typescript
// New file: src/components/competitors/add-competitor-dialog.tsx
"use client";

import { useState, useTransition } from "react";
import { addCompetitor } from "@/app/actions/competitors/add";
import { useToast } from "@/components/ui/toast";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AddCompetitorDialogProps {
  trigger: React.ReactNode;
}

export function AddCompetitorDialog({ trigger }: AddCompetitorDialogProps) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await addCompetitor(handle.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      toast({ variant: "success", title: `Now tracking @${result.data!.handle}` });
      setHandle("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setHandle(""); setError(null); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent size="sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Competitor</DialogTitle>
            <DialogDescription>
              Paste a TikTok @handle or profile URL to start tracking.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 pt-4">
            <Input
              placeholder="@username or tiktok.com/@username"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              error={error ?? undefined}
              id="add-competitor-handle"
              autoFocus
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" type="button">Cancel</Button>
            </DialogClose>
            <Button variant="primary" type="submit" loading={isPending} disabled={!handle.trim()}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### Example: RemoveCompetitorButton (new component)

```typescript
// New file: src/components/competitors/remove-competitor-button.tsx
"use client";

import { useState, useTransition } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Trash2 } from "lucide-react";
import { removeCompetitor } from "@/app/actions/competitors/remove";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";

interface RemoveCompetitorButtonProps {
  competitorId: string;
  handle: string;
}

export function RemoveCompetitorButton({ competitorId, handle }: RemoveCompetitorButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleRemove() {
    startTransition(async () => {
      const result = await removeCompetitor(competitorId);
      if (result.error) {
        toast({ variant: "error", title: "Failed to remove competitor", description: result.error });
        return;
      }
      toast({ variant: "success", title: `Stopped tracking @${handle}` });
      setOpen(false);
    });
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <button
          type="button"
          className="p-1.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-white/[0.05] transition-colors"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
          aria-label={`Remove @${handle}`}
        >
          <Trash2 size={14} />
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
        />
        <AlertDialog.Content
          className="fixed left-[50%] top-[50%] z-[var(--z-modal)] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-xl border border-white/[0.06] p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{
            backgroundColor: "rgba(17, 18, 20, 0.95)",
            boxShadow: "0 20px 25px rgba(0,0,0,0.3), 0 10px 10px rgba(0,0,0,0.2), rgba(255,255,255,0.1) 0px 1px 0px 0px inset",
          }}
        >
          <AlertDialog.Title className="text-lg font-semibold text-foreground">
            Stop tracking @{handle}?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-foreground-secondary">
            This competitor will be removed from your tracked list. You can add them back later.
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="destructive" onClick={handleRemove} loading={isPending}>
                Remove
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual isPending state management | React 19 `useTransition` | React 19 (stable 2024) | Built-in concurrent rendering, automatic batching |
| `useRouter().refresh()` after mutations | `revalidatePath()` in server actions | Next.js 14+ | Server-side cache invalidation, no client-side trigger needed |
| Custom modal implementations | Radix UI primitives | Already adopted in this codebase | Focus trap, scroll lock, accessible by default |

**Deprecated/outdated:**
- None relevant. All existing patterns in this codebase are current.

## Open Questions

1. **Table skeleton in loading.tsx**
   - What we know: `loading.tsx` is a server component and can't read the Zustand `viewMode` store. Default view is "grid". The card skeleton grid is already shown.
   - What's unclear: Should we also show the table skeleton somewhere? The store defaults to "grid" so users will see card skeleton first.
   - Recommendation: Import `CompetitorTableSkeleton` in `loading.tsx` but only render the card skeleton (matching the default "grid" mode). Alternatively, the `competitors-client.tsx` could show the table skeleton via Suspense/transition when switching view modes, but this is a polish item. The minimum fix is just ensuring the import exists somewhere it can be used -- even if the loading page only shows cards. The audit gap is "defined but never imported" so the fix is to import and render it in the loading page as a hidden-unless-table-mode element, OR to simply accept that the card skeleton covers the default case.

2. **CompetitorCard link wrapper vs remove button**
   - What we know: `CompetitorCard` is wrapped in `<Link href={...}>`. Adding a button inside requires `e.preventDefault()` and `e.stopPropagation()`.
   - What's unclear: Should the remove button be inside the card or revealed on hover?
   - Recommendation: Show remove button on hover (top-right corner of card, absolute positioned) with `e.preventDefault()` + `e.stopPropagation()`. This matches common dashboard patterns and doesn't clutter the default card view.

## Sources

### Primary (HIGH confidence)

- **Codebase inspection** - All findings verified by reading actual source files:
  - `src/app/(app)/competitors/compare/page.tsx` line 138 (self-benchmarking bug)
  - `src/app/actions/competitors/add.ts` (addCompetitor server action API)
  - `src/app/actions/competitors/remove.ts` (removeCompetitor server action API)
  - `src/components/ui/dialog.tsx` (Dialog component pattern)
  - `src/components/app/delete-test-modal.tsx` (AlertDialog confirmation pattern)
  - `src/components/competitors/scrape-error-banner.tsx` (useTransition pattern)
  - `src/components/ui/toast.tsx` (Toast system API)
  - `src/components/ui/input.tsx` (Input component with error handling)
  - `src/components/ui/button.tsx` (Button with loading prop)
  - `src/components/competitors/competitor-table-skeleton.tsx` (unused skeleton)
  - `src/components/competitors/competitor-empty-state.tsx` (CTA button without onClick)
  - `src/components/competitors/competitor-card.tsx` (Link wrapper)
  - `src/components/competitors/competitor-table.tsx` (row click navigation)
  - `src/app/(app)/competitors/competitors-client.tsx` (dashboard layout)
  - `src/app/(app)/competitors/loading.tsx` (current loading skeleton)
  - `src/types/database.types.ts` lines 457-477 (creator_profiles schema)
  - `supabase/migrations/20260202000000_v16_schema.sql` lines 9-11 (table definition)
  - `.planning/v1.0-MILESTONE-AUDIT.md` (audit findings)

### Secondary (MEDIUM confidence)

- None needed. All research is codebase-internal.

### Tertiary (LOW confidence)

- None. No external research required.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used in codebase
- Architecture: HIGH - All patterns verified from existing code in this project
- Pitfalls: HIGH - Identified from reading the actual component implementations
- Bug fix: HIGH - Verified against database schema, TypeScript types, and migration SQL

**Research date:** 2026-02-17
**Valid until:** Indefinite (codebase-internal research, no external dependencies)
