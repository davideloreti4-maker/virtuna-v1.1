# Phase 5: Society Management - Research

**Researched:** 2026-01-28
**Domain:** React state management, modal dialogs, CRUD operations, local storage persistence
**Confidence:** HIGH

## Summary

Phase 5 completes the society selector and creation flow, building on the existing Radix Dialog foundation from Phase 4. The research focused on three key areas: (1) state management patterns for society selection across the app, (2) CRUD operations with local storage persistence, and (3) the Create Target Society modal with AI matching UI.

The existing codebase already uses Radix UI Dialog for the society selector modal, making the architectural decisions straightforward. The main technical choices involve whether to use Zustand for global state (recommended) vs lifting state with React Context, and implementing the Create Society modal as a nested dialog or separate flow.

**Primary recommendation:** Use Zustand with persist middleware for society state management, keeping the existing Radix Dialog patterns for modals, and implementing CRUD operations with optimistic updates.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-dialog | ^1.1.15 | Modal dialogs | Already used in Phase 4, full accessibility built-in |
| @radix-ui/react-dropdown-menu | ^2.1.16 | Card action menus | Already used for view selector, handles Edit/Delete actions |
| lucide-react | ^0.563.0 | Icons | Consistent with existing codebase |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand | ^5.0.8 | Global state management | Society selection, persisted state |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand | React Context | Context causes unnecessary re-renders; Zustand has selector-based subscriptions |
| Zustand | Redux Toolkit | Overkill for this scope; Zustand is simpler with same features |
| Zustand | useState + lift | Works but requires prop drilling through app shell |

**Installation:**
```bash
npm install zustand
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── stores/
│   └── society-store.ts       # Zustand store with persist
├── components/app/
│   ├── society-selector.tsx   # Enhanced from Phase 4
│   ├── create-society-modal.tsx  # New modal component
│   ├── society-card.tsx       # Extracted card component
│   └── card-action-menu.tsx   # Dropdown menu for cards
├── types/
│   └── society.ts             # Society type definitions
└── lib/
    └── mock-societies.ts      # Mock data (moved from component)
```

### Pattern 1: Zustand Store with Persist
**What:** Global state store with localStorage persistence
**When to use:** App-wide state that needs to persist across sessions
**Example:**
```typescript
// Source: Context7 - Zustand persist middleware
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Society {
  id: string;
  name: string;
  description: string;
  type: 'personal' | 'target';
  // ... other fields
}

interface SocietyState {
  societies: Society[];
  selectedSocietyId: string | null;
  // Actions
  selectSociety: (id: string) => void;
  addSociety: (society: Society) => void;
  updateSociety: (id: string, updates: Partial<Society>) => void;
  deleteSociety: (id: string) => void;
}

export const useSocietyStore = create<SocietyState>()(
  persist(
    (set, get) => ({
      societies: INITIAL_SOCIETIES,
      selectedSocietyId: null,

      selectSociety: (id) => set({ selectedSocietyId: id }),

      addSociety: (society) => set((state) => ({
        societies: [...state.societies, society],
        selectedSocietyId: society.id, // Auto-select after creation
      })),

      updateSociety: (id, updates) => set((state) => ({
        societies: state.societies.map((s) =>
          s.id === id ? { ...s, ...updates } : s
        ),
      })),

      deleteSociety: (id) => set((state) => ({
        societies: state.societies.filter((s) => s.id !== id),
        selectedSocietyId: state.selectedSocietyId === id
          ? state.societies[0]?.id ?? null
          : state.selectedSocietyId,
      })),
    }),
    { name: 'virtuna-societies' }
  )
)
```

### Pattern 2: Radix Dialog with Form State
**What:** Modal with controlled form inputs and submission
**When to use:** Create/Edit modals with validation
**Example:**
```typescript
// Source: Context7 - Radix Dialog with form
import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

function CreateSocietyModal({ open, onOpenChange }) {
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addSociety = useSocietyStore((s) => s.addSociety);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate AI matching delay
    await new Promise((r) => setTimeout(r, 1500));

    addSociety({
      id: crypto.randomUUID(),
      name: extractName(description),
      description,
      type: 'target',
      // ... other fields
    });

    setDescription("");
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <form onSubmit={handleSubmit}>
            {/* Form content */}
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Pattern 3: Dropdown Menu for Card Actions
**What:** Context menu with Edit/Refresh/Delete actions
**When to use:** Card-level actions that need confirmation for destructive operations
**Example:**
```typescript
// Source: Context7 - Radix DropdownMenu
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

function CardActionMenu({ societyId, onEdit, onRefresh, onDelete }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button aria-label="More options">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="...">
          <DropdownMenu.Item onSelect={() => onEdit(societyId)}>
            Edit
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => onRefresh(societyId)}>
            Refresh
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            onSelect={() => onDelete(societyId)}
            className="text-red-500"
          >
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

### Anti-Patterns to Avoid
- **Prop drilling selection state:** Don't pass selectedSociety through AppShell → Sidebar → SocietySelector. Use Zustand selectors.
- **Inline mock data:** Don't keep MOCK_SOCIETIES in component files. Extract to separate module for maintainability.
- **Modal state in URL:** Don't put modal open/close state in URL for these simple modals. Keep in component state.
- **Blocking UI during "AI matching":** Show loading state but don't disable entire modal. Allow cancel.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique IDs | Custom ID generator | `crypto.randomUUID()` | Built into browsers, cryptographically random |
| Focus management | Manual focus handling | Radix Dialog built-in | Focus trap, ESC key, click outside all handled |
| Dropdown positioning | CSS positioning | Radix DropdownMenu | Handles collision detection, portaling |
| State persistence | Custom localStorage sync | Zustand persist middleware | Handles hydration, serialization, key management |
| Form validation | Manual if/else | Zod (already installed) | Type-safe validation with proper error messages |

**Key insight:** The existing Radix primitives already handle accessibility and keyboard navigation. Adding custom handlers will likely break the built-in behavior.

## Common Pitfalls

### Pitfall 1: localStorage Hydration Mismatch
**What goes wrong:** Server-rendered content doesn't match client hydration when using persisted state
**Why it happens:** localStorage is only available on client, SSR returns default values
**How to avoid:** Use Zustand's `skipHydration` option or wrap state consumers in client components
**Warning signs:** React hydration warnings in console, flash of default content

### Pitfall 2: Nested Dialog Focus Issues
**What goes wrong:** Opening Create Society modal from Society Selector doesn't properly transfer focus
**Why it happens:** Two Dialog.Root components fighting for focus management
**How to avoid:** Close the selector before opening create modal, or use single Dialog.Root with content switching
**Warning signs:** Focus jumps unexpectedly, ESC key doesn't work correctly

### Pitfall 3: Optimistic Update Rollback
**What goes wrong:** UI shows created society but it wasn't actually saved
**Why it happens:** With mock data this is less critical, but sets bad patterns for real API
**How to avoid:** For Phase 5 mock data, this is acceptable. In future, implement proper rollback.
**Warning signs:** Data disappears on refresh (shouldn't happen with persist middleware)

### Pitfall 4: Click Event Propagation on Cards
**What goes wrong:** Clicking action menu triggers card selection
**Why it happens:** Event bubbles from menu button to card click handler
**How to avoid:** Call `e.stopPropagation()` on menu trigger click
**Warning signs:** Card highlights when opening dropdown menu

## Code Examples

Verified patterns from official sources:

### Society Type Definitions
```typescript
// src/types/society.ts
export interface PersonalSociety {
  id: string;
  name: string;
  description: string;
  type: 'personal';
  platform: 'linkedin' | 'x';
  needsSetup: boolean;
}

export interface TargetSociety {
  id: string;
  name: string;
  description: string;
  type: 'target';
  societyType: 'custom' | 'example';
  icon: 'briefcase' | 'coins' | 'users';
  members: number;
  createdAt: string;
}

export type Society = PersonalSociety | TargetSociety;
```

### Using Zustand Selectors for Performance
```typescript
// Source: Context7 - Zustand selectors
// Only re-render when selectedSocietyId changes
const selectedId = useSocietyStore((s) => s.selectedSocietyId);

// Only re-render when societies array changes
const societies = useSocietyStore((s) => s.societies);

// Derived: Get selected society object
const selectedSociety = useSocietyStore((s) =>
  s.societies.find((soc) => soc.id === s.selectedSocietyId)
);
```

### Sidebar Integration
```typescript
// src/components/app/sidebar.tsx
import { useSocietyStore } from "@/stores/society-store";

export function Sidebar() {
  const selectedSociety = useSocietyStore((s) =>
    s.societies.find((soc) => soc.id === s.selectedSocietyId)
  );

  return (
    <aside>
      {/* ... */}
      <div className="mt-6">
        <label className="...">Current Society</label>
        <SocietySelector />
        {/* Show current selection */}
        {selectedSociety && (
          <span className="text-xs text-zinc-500">
            {selectedSociety.name}
          </span>
        )}
      </div>
      {/* ... */}
    </aside>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Redux for all global state | Zustand/Jotai for client, TanStack Query for server | 2023-2024 | 30%+ simpler code, better performance |
| Context for everything | Context for DI only, dedicated stores for state | 2024-2025 | Eliminates unnecessary re-renders |
| Custom localStorage sync | Zustand persist middleware | Built-in | Handles edge cases automatically |

**Deprecated/outdated:**
- **Redux for simple state:** Overkill for society selection; Zustand is the 2026 standard
- **Context for mutable state:** Causes re-render storms; use for theme/auth only

## Open Questions

Things that couldn't be fully resolved:

1. **AI Matching Animation Details**
   - What we know: Modal shows loading state during "AI matching"
   - What's unclear: Exact animation style (progress steps vs spinner vs dots)
   - Recommendation: Use v0 MCP to generate UI matching societies.io reference

2. **Post-Creation Behavior**
   - What we know: New society should appear in selector
   - What's unclear: Auto-select new society or return to selector?
   - Recommendation: Auto-select (smoother UX, matches Zustand pattern)

3. **Refresh Action Purpose**
   - What we know: Menu has "Refresh" option
   - What's unclear: What does refresh do with mock data?
   - Recommendation: Show brief loading state, no-op for Phase 5, note for future API integration

## Sources

### Primary (HIGH confidence)
- Context7 `/radix-ui/website` - Dialog and DropdownMenu component patterns
- Context7 `/websites/zustand_pmnd_rs` - Persist middleware, TypeScript patterns
- Reference screenshots: `society-selector-open.png`, `create-target-society.png`

### Secondary (MEDIUM confidence)
- [State Management in React 2026](https://www.c-sharpcorner.com/article/state-management-in-react-2026-best-practices-tools-real-world-patterns/) - Context vs Zustand comparison
- [TkDodo's Blog: Zustand and React Context](https://tkdodo.eu/blog/zustand-and-react-context) - When to use each
- [Building CRUD App with React and Local Storage](https://egghead.io/blog/building-a-crud-app-with-react-and-local-storage) - CRUD patterns

### Tertiary (LOW confidence)
- [React Onboarding Libraries](https://userguiding.com/blog/react-onboarding-tour) - Tooltip hints patterns (if implementing onboarding)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Context7 verified, dependencies already partially installed
- Architecture: HIGH - Patterns verified with Radix docs and Zustand docs
- Pitfalls: MEDIUM - Based on common React patterns, some inferred from architecture

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (stable libraries, low churn expected)
