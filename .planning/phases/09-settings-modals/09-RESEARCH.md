# Phase 9: Settings & Modals - Research

**Researched:** 2026-01-29
**Domain:** Settings UI, Modals, Form State Management
**Confidence:** HIGH

## Summary

This research covers the implementation of settings pages and modals for Phase 9 of the Virtuna v1.1 project. The phase involves building user profile, account settings, notification preferences, billing UI (linking to Stripe), team management UI, a Leave Feedback modal, and a Product Guide link.

Based on the established project patterns, the implementation will use Radix UI Dialog for modals (already in use), manual localStorage for state persistence (established SSR-safe pattern from Phase 5), and Tailwind CSS for styling. All UI design must go through v0 MCP for pixel-perfect accuracy as per user directive.

The key insight is that this phase is primarily UI-focused with mock/local state - no real backend persistence. The Stripe billing UI redirects to an external Stripe Customer Portal rather than building custom subscription management.

**Primary recommendation:** Build settings as a single page with tabbed sections using Radix Tabs (consistent with project's Radix usage pattern), modals as siblings using established Dialog sibling pattern, and all form state persisted to localStorage following the manual hydration pattern.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-dialog | ^1.1.15 | Modal dialogs | Already installed, accessibility built-in |
| @radix-ui/react-tabs | ^1.1.x | Settings tabs | Radix pattern consistency, keyboard navigation |
| zustand | ^5.0.10 | State management | Already used for society-store, test-store |
| lucide-react | ^0.563.0 | Icons | Established icon library in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.3.6 | Form validation | Complex form validation if needed |
| @radix-ui/react-switch | latest | Toggle switches | Notification preferences toggles |
| @radix-ui/react-avatar | latest | User avatar display | Profile page avatar |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Tabs | Routes (/settings/profile, /settings/billing) | Routes allow bookmarking but add complexity; tabs simpler for this use case |
| Manual localStorage | Zustand persist | Already rejected in Phase 5 due to SSR hydration issues |
| Custom form | react-hook-form | Overkill for mock forms with no real validation |

**Installation:**
```bash
npm install @radix-ui/react-tabs @radix-ui/react-switch @radix-ui/react-avatar
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── app/
│       ├── settings/
│       │   ├── settings-page.tsx        # Main settings container with tabs
│       │   ├── profile-section.tsx      # User profile tab content
│       │   ├── account-section.tsx      # Account settings tab content
│       │   ├── notifications-section.tsx # Notification prefs tab content
│       │   ├── billing-section.tsx      # Billing UI with Stripe link
│       │   └── team-section.tsx         # Team management tab content
│       ├── leave-feedback-modal.tsx     # Feedback modal
│       └── index.ts                     # Export barrel
├── stores/
│   └── settings-store.ts                # Settings state (optional, can use local state)
└── app/(app)/
    └── settings/
        └── page.tsx                     # Settings route (or modal from sidebar)
```

### Pattern 1: Settings Page with Radix Tabs
**What:** Single settings page with tabbed navigation for different sections
**When to use:** When settings are related but warrant separate views
**Example:**
```typescript
// Source: Radix UI Tabs documentation
import * as Tabs from "@radix-ui/react-tabs";

export function SettingsPage() {
  return (
    <Tabs.Root defaultValue="profile" orientation="vertical">
      <Tabs.List className="flex flex-col border-r border-zinc-800">
        <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
        <Tabs.Trigger value="account">Account</Tabs.Trigger>
        <Tabs.Trigger value="notifications">Notifications</Tabs.Trigger>
        <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
        <Tabs.Trigger value="team">Team</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="profile"><ProfileSection /></Tabs.Content>
      <Tabs.Content value="account"><AccountSection /></Tabs.Content>
      {/* ... */}
    </Tabs.Root>
  );
}
```

### Pattern 2: Modal Sibling Pattern (Established)
**What:** Modals rendered as siblings rather than nested children
**When to use:** All modals to avoid Radix focus trap issues
**Example:**
```typescript
// Source: Project STATE.md - Dialog sibling pattern
export function SidebarWithModals() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <Sidebar onFeedbackClick={() => setFeedbackOpen(true)} />
      <LeaveFeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
```

### Pattern 3: Manual localStorage Hydration (Established)
**What:** SSR-safe state persistence using manual localStorage with hydration flag
**When to use:** Any persisted state in Next.js App Router
**Example:**
```typescript
// Source: Project society-store.ts pattern
const STORAGE_KEY = 'virtuna-settings';

interface SettingsState {
  notifications: NotificationPrefs;
  _isHydrated: boolean;
  _hydrate: () => void;
}

// In component:
useEffect(() => {
  settingsStore._hydrate();
}, []);
```

### Anti-Patterns to Avoid
- **Nested Radix Dialogs:** Causes focus trap issues - use sibling pattern instead
- **Zustand persist middleware:** Causes SSR hydration loops - use manual localStorage
- **Building custom Stripe UI:** Stripe Customer Portal handles subscription management - just redirect
- **useLayoutEffect for hydration:** Causes SSR warnings - use useEffect

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscription management | Custom billing UI | Stripe Customer Portal redirect | Stripe handles PCI compliance, payment updates, invoices |
| Tab navigation | Custom tabs with useState | Radix Tabs | Keyboard nav, ARIA roles, focus management |
| Toggle switches | Checkbox styled as switch | Radix Switch | Proper accessibility, state management |
| Form validation | Manual validation | Zod schemas | Type safety, reusable, comprehensive |
| Avatar placeholder | Custom initials logic | Radix Avatar with fallback | Handles loading states, fallback gracefully |

**Key insight:** The billing UI should NOT attempt to replicate Stripe's subscription management. The reference screenshot shows societies.io redirects to the Stripe Customer Portal - this is the correct pattern for handling payments securely.

## Common Pitfalls

### Pitfall 1: SSR Hydration Mismatch with localStorage
**What goes wrong:** Component renders different content on server vs client due to localStorage values
**Why it happens:** localStorage not available during SSR, causing hydration mismatch
**How to avoid:** Use _isHydrated flag pattern, render skeleton/placeholder until hydrated
**Warning signs:** Console errors about hydration mismatch, UI flicker on page load

### Pitfall 2: Settings Access Point Confusion
**What goes wrong:** Building settings as an avatar dropdown or wrong location
**Why it happens:** Common SaaS pattern is avatar dropdown, but societies.io uses sidebar
**How to avoid:** Per CONTEXT.md - settings accessed from sidebar bottom area near logout
**Warning signs:** Putting settings in header or as avatar menu

### Pitfall 3: Stripe Portal Blocking Popup
**What goes wrong:** Stripe portal opens in same tab, user loses context
**Why it happens:** Not considering UX of redirect flow
**How to avoid:** Research societies.io behavior - open in new tab is cleaner
**Warning signs:** User complaints about losing their place

### Pitfall 4: Form State Loss on Tab Switch
**What goes wrong:** User loses unsaved changes when switching tabs
**Why it happens:** Each tab content unmounts, losing local state
**How to avoid:** Either lift state to parent/store OR save on field blur (onBlur pattern)
**Warning signs:** User edits lost without warning

### Pitfall 5: Forgetting v0 MCP Verification
**What goes wrong:** UI doesn't match societies.io design
**Why it happens:** Building directly without v0 design verification
**How to avoid:** Query v0 MCP with reference screenshots BEFORE implementing
**Warning signs:** Visual differences from reference, multiple design iterations

## Code Examples

Verified patterns from official sources and project conventions:

### Leave Feedback Modal
```typescript
// Source: Project reference/.reference/app/modals.md
"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X, ArrowRight } from "lucide-react";

interface LeaveFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaveFeedbackModal({ open, onOpenChange }: LeaveFeedbackModalProps) {
  const [name, setName] = useState("Davide Loreti"); // Pre-filled mock
  const [email, setEmail] = useState("davide.loreti4@gmail.com"); // Pre-filled mock
  const [feedback, setFeedback] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Feedback submitted:", { name, email, feedback });
    setFeedback("");
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold text-white">
              Leave feedback
            </Dialog.Title>
            <Dialog.Close className="text-zinc-500 hover:text-zinc-400">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          {/* Form content per reference */}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Stripe Portal Redirect Button
```typescript
// Source: Stripe Customer Portal best practices
export function BillingSection() {
  const handleManagePlan = () => {
    // In real app: API call to create portal session, then redirect
    // For mock: Open external URL in new tab
    window.open('https://billing.stripe.com/session/test', '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white">Current Plan</h3>
        <p className="text-sm text-zinc-400">Pro - $55.00/month</p>
      </div>
      <button
        onClick={handleManagePlan}
        className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
      >
        Manage subscription
      </button>
    </div>
  );
}
```

### Settings Store Pattern (if needed)
```typescript
// Source: Project society-store.ts pattern
import { create } from 'zustand';

const STORAGE_KEY = 'virtuna-settings';

interface NotificationPrefs {
  emailUpdates: boolean;
  testResults: boolean;
  weeklyDigest: boolean;
}

interface SettingsState {
  notifications: NotificationPrefs;
  _isHydrated: boolean;
  _hydrate: () => void;
  updateNotifications: (prefs: Partial<NotificationPrefs>) => void;
}

function saveToStorage(notifications: NotificationPrefs) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ notifications }));
  } catch {
    // Ignore storage errors
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  notifications: {
    emailUpdates: true,
    testResults: true,
    weeklyDigest: false,
  },
  _isHydrated: false,

  _hydrate: () => {
    const stored = loadFromStorage();
    if (stored) {
      set({ notifications: stored.notifications, _isHydrated: true });
    } else {
      set({ _isHydrated: true });
    }
  },

  updateNotifications: (prefs) => {
    set((state) => {
      const newNotifications = { ...state.notifications, ...prefs };
      saveToStorage(newNotifications);
      return { notifications: newNotifications };
    });
  },
}));
```

### Product Guide Link
```typescript
// Source: Reference screenshot - external docs site
export function ProductGuideLink() {
  const handleProductGuide = () => {
    // Opens external documentation site
    window.open('https://docs.societies.io', '_blank');
  };

  return (
    <SidebarNavItem
      label="Product Guide"
      icon={BookOpen}
      onClick={handleProductGuide}
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom subscription UI | Stripe Customer Portal | 2024+ | No PCI compliance burden, automatic updates |
| useState for persistence | Zustand with manual localStorage | Phase 5 | SSR-safe, consistent pattern |
| Custom tabs | Radix UI Tabs | Established | Accessibility, keyboard navigation |
| Form libraries for mock data | Simple useState | Current | Less overhead for mock-only forms |

**Deprecated/outdated:**
- Zustand persist middleware: Causes SSR issues in Next.js App Router
- Building own subscription management: Security/compliance risk

## Open Questions

Things that couldn't be fully resolved:

1. **Settings page vs modal layout**
   - What we know: societies.io has settings accessible from sidebar, could be page or modal
   - What's unclear: Exact layout (full page with tabs, or modal-based)
   - Recommendation: Use v0 MCP to research societies.io settings layout before implementation

2. **Team management empty state**
   - What we know: Need to handle case when no team members exist
   - What's unclear: Exact empty state messaging and design
   - Recommendation: Claude's discretion per CONTEXT.md, verify with v0

3. **Save mechanism (auto-save vs explicit)**
   - What we know: Both patterns are valid in SaaS
   - What's unclear: What societies.io uses
   - Recommendation: Per CONTEXT.md, match societies.io pattern via v0 research

## Sources

### Primary (HIGH confidence)
- Radix UI Dialog documentation - https://www.radix-ui.com/primitives/docs/components/dialog
- Radix UI Tabs documentation - https://www.radix-ui.com/primitives/docs/components/tabs
- Project codebase: src/stores/society-store.ts - manual localStorage pattern
- Project codebase: src/components/app/create-society-modal.tsx - modal pattern
- Project codebase: src/components/app/delete-test-modal.tsx - AlertDialog pattern
- Project reference: .reference/app/modals.md - Leave Feedback modal spec

### Secondary (MEDIUM confidence)
- Stripe Customer Portal integration patterns - https://stripe.com/docs/customer-management/portal
- Next.js App Router routing patterns - https://nextjs.org/docs/app
- Form state management patterns 2026 - WebSearch verified with official docs

### Tertiary (LOW confidence)
- Settings page vs routes architectural decision - community patterns, validate with v0

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using established project libraries
- Architecture: HIGH - Following established project patterns
- Pitfalls: HIGH - Based on documented project decisions and common issues
- Settings layout specifics: MEDIUM - Need v0 verification for exact societies.io design

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days - stable domain, established patterns)
