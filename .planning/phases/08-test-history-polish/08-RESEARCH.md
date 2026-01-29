# Phase 8: Test History & Polish - Research

**Researched:** 2026-01-29
**Domain:** Test history UI, localStorage persistence, Radix UI components
**Confidence:** HIGH

## Summary

Phase 8 implements test history display in the sidebar, view result interactions, delete functionality, and view selector enhancements. The codebase already has all foundational patterns in place:

- **Zustand test store** with `tests: TestResult[]` array already persisted to localStorage
- **Manual hydration pattern** (`_hydrate()`) established for SSR safety
- **Radix Dialog** pattern for modals (used in CreateSocietyModal)
- **Radix DropdownMenu** pattern for menus (used in CardActionMenu, ViewSelector)
- **Icon map pattern** for dynamic Lucide icon rendering

The phase requires composing existing patterns rather than introducing new libraries. The main work involves:
1. Building a `TestHistoryList` component for the sidebar
2. Enhancing test store with `viewResult()` and read-only state
3. Creating a delete confirmation modal using Radix AlertDialog
4. Extending ViewSelector with role levels and legend pills

**Primary recommendation:** Leverage existing patterns and Radix UI primitives. Use `@radix-ui/react-alert-dialog` for delete confirmation (needs installation). Apply established icon map and store patterns.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.10 | State management | Already manages test store with localStorage |
| @radix-ui/react-dialog | ^1.1.15 | Modal dialogs | Established pattern for modals |
| @radix-ui/react-dropdown-menu | ^2.1.16 | Dropdown menus | Established pattern for menus |
| lucide-react | ^0.563.0 | Icons | Established icon system |

### Supporting (Needs Installation)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-alert-dialog | ^1.1.15 | Delete confirmation | Modal with Cancel/Confirm pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AlertDialog | Regular Dialog with custom buttons | AlertDialog has built-in accessibility for destructive actions (focus moves to Cancel) |
| New history store | Extend test store | Test store already has tests array - no need for separate store |

**Installation:**
```bash
npm install @radix-ui/react-alert-dialog
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/app/
│   ├── test-history-list.tsx    # New: History list for sidebar
│   ├── test-history-item.tsx    # New: Individual history item
│   ├── delete-test-modal.tsx    # New: AlertDialog confirmation
│   ├── view-selector.tsx        # Extend: Add role levels
│   └── sidebar.tsx              # Extend: Add history section
├── stores/
│   └── test-store.ts            # Extend: viewResult state, isReadOnly
└── types/
    └── test.ts                  # Already complete
```

### Pattern 1: History List with Store Integration
**What:** Sidebar history list that reads from test store
**When to use:** Displaying persisted test results
**Example:**
```typescript
// Source: Existing pattern from society-selector.tsx
'use client';

import { useTestStore } from '@/stores/test-store';
import { TestHistoryItem } from './test-history-item';

export function TestHistoryList() {
  const tests = useTestStore((s) => s.tests);
  const currentResult = useTestStore((s) => s.currentResult);
  const viewResult = useTestStore((s) => s.viewResult);
  const _isHydrated = useTestStore((s) => s._isHydrated);

  if (!_isHydrated) {
    return <div className="text-xs text-zinc-500">Loading...</div>;
  }

  if (tests.length === 0) {
    return <div className="text-xs text-zinc-500">No tests yet</div>;
  }

  return (
    <div className="flex flex-col gap-1">
      {tests.map((test) => (
        <TestHistoryItem
          key={test.id}
          test={test}
          isActive={currentResult?.id === test.id}
          onClick={() => viewResult(test.id)}
        />
      ))}
    </div>
  );
}
```

### Pattern 2: AlertDialog for Delete Confirmation
**What:** Radix AlertDialog for destructive action confirmation
**When to use:** Delete operations that cannot be undone
**Example:**
```typescript
// Source: Context7 Radix UI AlertDialog documentation
'use client';

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { cn } from '@/lib/utils';

interface DeleteTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  testName?: string;
}

export function DeleteTestModal({
  open,
  onOpenChange,
  onConfirm,
  testName
}: DeleteTestModalProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <AlertDialog.Title className="text-lg font-semibold text-white">
            Delete Test
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-zinc-400">
            Are you sure you want to delete this test? This action cannot be undone.
          </AlertDialog.Description>

          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                Delete
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
```

### Pattern 3: Three-Dot Menu on History Item
**What:** DropdownMenu triggered by MoreVertical icon
**When to use:** Item-level actions (view, delete)
**Example:**
```typescript
// Source: Existing CardActionMenu pattern
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreVertical, Trash2 } from 'lucide-react';

interface TestHistoryItemProps {
  test: TestResult;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}

// Three-dot menu inside TestHistoryItem:
<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    <button onClick={(e) => e.stopPropagation()}>
      <MoreVertical className="h-4 w-4" />
    </button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content>
      <DropdownMenu.Item onSelect={onDelete} className="text-red-400">
        <Trash2 className="h-4 w-4" />
        Delete
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
```

### Pattern 4: Read-Only Form State
**What:** Display form content without editing capability
**When to use:** Viewing past test content
**Example:**
```typescript
// Extend test store with isViewingHistory flag
interface TestState {
  // ... existing
  isViewingHistory: boolean;
}

// In viewResult action:
viewResult: (testId) => {
  const { tests } = get();
  const result = tests.find((t) => t.id === testId);
  if (result) {
    set({
      currentResult: result,
      currentTestType: result.testType,
      currentStatus: 'viewing-results',
      isViewingHistory: true, // Flag for read-only
    });
  }
},

// In ContentForm, check isViewingHistory:
const isViewingHistory = useTestStore((s) => s.isViewingHistory);

<textarea
  value={content}
  readOnly={isViewingHistory}
  className={cn(
    // ... base styles
    isViewingHistory && 'cursor-default opacity-75'
  )}
/>
```

### Pattern 5: View Selector with Role Levels
**What:** Dropdown with role level options and color indicators
**When to use:** Filtering network visualization by role level
**Example:**
```typescript
// Role levels from accumulated decisions (Phase 4)
const ROLE_LEVELS = [
  { id: 'executive', label: 'Executive', color: 'bg-indigo-500' },
  { id: 'senior', label: 'Senior', color: 'bg-emerald-500' },
  { id: 'mid', label: 'Mid', color: 'bg-pink-500' },
  { id: 'entry', label: 'Entry', color: 'bg-orange-500' },
] as const;

// In ViewSelector dropdown items:
{ROLE_LEVELS.map((level) => (
  <DropdownMenu.Item key={level.id}>
    <span className={cn('h-2 w-2 rounded-full', level.color)} />
    {level.label}
  </DropdownMenu.Item>
))}
```

### Pattern 6: Legend Pills
**What:** Color-coded pills showing active view filters
**When to use:** Visual feedback for current view selection
**Example:**
```typescript
// New component or extend FilterPills
interface LegendPillsProps {
  activeViews: string[];
  onToggle?: (viewId: string) => void; // Optional: toggle on click
}

export function LegendPills({ activeViews, onToggle }: LegendPillsProps) {
  return (
    <div className="flex gap-2">
      {ROLE_LEVELS.map((level) => (
        <button
          key={level.id}
          onClick={() => onToggle?.(level.id)}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs',
            activeViews.includes(level.id)
              ? 'bg-zinc-800 text-white'
              : 'bg-zinc-900 text-zinc-500'
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', level.color)} />
          {level.label}
        </button>
      ))}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Separate history store:** Tests already in test store - no new store needed
- **Custom modal without Radix:** Use AlertDialog for delete - has accessibility built in
- **Nested modals:** Dialog sibling pattern established - render modals as siblings
- **SSR hydration without guard:** Always check `_isHydrated` before rendering persisted data

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Delete confirmation | Custom modal with event handlers | Radix AlertDialog | Focus management to Cancel, keyboard support, screen reader announcements |
| Dropdown menus | Custom popover with positioning | Radix DropdownMenu | Collision detection, focus trap, type-ahead support |
| localStorage sync | Custom event listeners | Zustand store with saveToStorage helper | Already established pattern in codebase |
| Icon rendering | Switch statements | Icon map Record<IconName, Component> | Type-safe, established in test-types.ts |

**Key insight:** The codebase already has all necessary patterns. Phase 8 is about composing them, not introducing new solutions.

## Common Pitfalls

### Pitfall 1: SSR Hydration Mismatch
**What goes wrong:** History list shows different content on server vs client
**Why it happens:** localStorage not available during SSR
**How to avoid:**
- Check `_isHydrated` before rendering test history
- Show skeleton/loading state until hydrated
- Use `useEffect` for hydration trigger
**Warning signs:** Console warning about hydration mismatch, flickering on load

### Pitfall 2: Stale Closure in Delete Handler
**What goes wrong:** Delete button deletes wrong test
**Why it happens:** Closure captures stale testId
**How to avoid:**
- Pass testId to handler at render time, not in closure
- Use callback pattern: `onDelete={() => deleteTest(test.id)}`
**Warning signs:** Wrong item deleted, especially after re-ordering

### Pitfall 3: Focus Loss After Delete
**What goes wrong:** Focus disappears after deleting viewed test
**Why it happens:** Element removed from DOM, no focus management
**How to avoid:**
- After delete, either focus "New Test" button or first history item
- Use AlertDialog which manages focus return to trigger
**Warning signs:** Tab key behavior erratic after delete

### Pitfall 4: View State Not Resetting
**What goes wrong:** Form shows stale content after "Run another test"
**Why it happens:** `isViewingHistory` flag not reset
**How to avoid:**
- Reset `isViewingHistory: false` in `reset()` action
- Clear `currentResult` when starting new test
**Warning signs:** Old content appears in new test form

### Pitfall 5: Memory Leak in Network Sync
**What goes wrong:** Network visualization doesn't update when viewing history
**Why it happens:** Canvas animation not re-triggered on result change
**How to avoid:**
- Pass `currentResult` to NetworkVisualization as dependency
- Re-initialize animation when result changes
**Warning signs:** Network dots don't match displayed result

## Code Examples

### History Item with Icon and Preview
```typescript
// Source: Established icon map pattern from test-types.ts
import { TEST_TYPES } from '@/lib/test-types';
import type { TestResult } from '@/types/test';
import {
  ClipboardList, FileText, Globe, Megaphone,
  Linkedin, Instagram, Twitter, Video, Mail, Send, Package
} from 'lucide-react';

const ICON_MAP = {
  ClipboardList, FileText, Globe, Megaphone,
  Linkedin, Instagram, Twitter, Video, Mail, Send, Package
};

function TestHistoryItem({ test, isActive, onClick }: Props) {
  const config = TEST_TYPES[test.testType];
  const IconComponent = ICON_MAP[config.icon];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm',
        isActive
          ? 'bg-zinc-800 text-white'
          : 'text-zinc-400 hover:bg-zinc-800/50'
      )}
    >
      <IconComponent className="h-4 w-4 shrink-0" />
      <span className="truncate">{config.name}</span>
      <span className="ml-auto text-xs text-zinc-500">
        {test.impactScore}%
      </span>
    </button>
  );
}
```

### Delete Flow Integration
```typescript
// In TestHistoryItem - state for modal
const [deleteModalOpen, setDeleteModalOpen] = useState(false);
const deleteTest = useTestStore((s) => s.deleteTest);
const reset = useTestStore((s) => s.reset);
const currentResult = useTestStore((s) => s.currentResult);

const handleDelete = () => {
  deleteTest(test.id);
  // If deleting currently viewed test, reset to new test state
  if (currentResult?.id === test.id) {
    reset();
  }
  setDeleteModalOpen(false);
};

// Render DeleteTestModal as sibling (dialog sibling pattern)
<>
  <TestHistoryItemContent onDeleteClick={() => setDeleteModalOpen(true)} />
  <DeleteTestModal
    open={deleteModalOpen}
    onOpenChange={setDeleteModalOpen}
    onConfirm={handleDelete}
  />
</>
```

### Instant Swap Between Results
```typescript
// In dashboard-client.tsx - no loading state for history viewing
const handleViewHistoryItem = (testId: string) => {
  viewResult(testId); // Instant state update
  // Network visualization will sync via currentResult dependency
};

// viewResult action already sets:
// - currentResult to the selected test
// - currentStatus to 'viewing-results'
// - currentTestType to the test's type
// No async, no loading phase needed
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zustand persist middleware | Manual localStorage | Phase 5 | Avoids SSR hydration loops in Next.js App Router |
| window.confirm() | Radix AlertDialog | Current best practice | Accessibility, consistent styling, focus management |

**Deprecated/outdated:**
- `window.confirm()`: Poor accessibility, no styling control, blocks JS execution
- Zustand persist auto-hydration: Causes issues with Next.js App Router SSR

## Open Questions

1. **History item info display**
   - What we know: Options are icon + preview OR icon + score
   - What's unclear: User hasn't specified preference
   - Recommendation: Use icon + test type name + score (compact, informative)

2. **Selection highlight style**
   - What we know: Need visual distinction for active item
   - What's unclear: Exact style (background, border, indicator)
   - Recommendation: Use bg-zinc-800 with left border accent (similar to active nav)

3. **Clear all history option**
   - What we know: Not explicitly required, not explicitly excluded
   - What's unclear: Whether to include it
   - Recommendation: Skip for MVP - individual delete covers the use case

4. **Legend pill interactivity**
   - What we know: Options are click-to-toggle OR display-only
   - What's unclear: User preference
   - Recommendation: Start with display-only, can add toggle later

5. **View filter persistence**
   - What we know: Option to persist selected view across sessions
   - What's unclear: Whether worth the complexity
   - Recommendation: Persist in localStorage for consistency

## Sources

### Primary (HIGH confidence)
- Context7 `/radix-ui/website` - AlertDialog component documentation
- Context7 `/websites/zustand_pmnd_rs` - Manual hydration patterns
- Existing codebase: `test-store.ts`, `card-action-menu.tsx`, `view-selector.tsx`

### Secondary (MEDIUM confidence)
- Accumulated decisions in STATE.md (Phase 4-7 patterns)
- Radix UI Primitives documentation for focus management behavior

### Tertiary (LOW confidence)
- None - all patterns verified against official sources or existing code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use or official Radix packages
- Architecture: HIGH - Patterns already established in codebase
- Pitfalls: HIGH - Based on direct experience with SSR hydration in this project

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (stable patterns, low churn)
