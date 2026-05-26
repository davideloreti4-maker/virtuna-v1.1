---
phase: 02-board-substrate-navigation
reviewed: 2026-05-26T00:00:00Z
depth: standard
files_reviewed: 49
files_reviewed_list:
  - e2e/dashboard-redirect.spec.ts
  - src/app/(app)/analyze/[id]/page.tsx
  - src/app/(app)/analyze/layout.tsx
  - src/app/(app)/analyze/page.tsx
  - src/components/app/app-shell.tsx
  - src/components/board/Board.tsx
  - src/components/board/BoardCanvas.tsx
  - src/components/board/CameraOverlay.tsx
  - src/components/board/EngineGroup.tsx
  - src/components/board/EngineStageGlyph.tsx
  - src/components/board/GroupFrame.tsx
  - src/components/board/GroupFrameOverlay.tsx
  - src/components/board/InputDrawer.tsx
  - src/components/board/InputNode.tsx
  - src/components/board/Node.tsx
  - src/components/board/NodeOverlay.tsx
  - src/components/board/OrientationHint.tsx
  - src/components/board/__tests__/Board.a11y.test.tsx
  - src/components/board/__tests__/Board.test.tsx
  - src/components/board/__tests__/EngineGroup.test.tsx
  - src/components/board/__tests__/GroupFrame.test.tsx
  - src/components/board/__tests__/InputDrawer.test.tsx
  - src/components/board/__tests__/Node.test.tsx
  - src/components/board/__tests__/OrientationHint.test.tsx
  - src/components/board/__tests__/use-camera.reduced-motion.test.ts
  - src/components/board/__tests__/use-camera.test.ts
  - src/components/board/board-constants.ts
  - src/components/board/board-types.ts
  - src/components/board/use-board-keyboard.ts
  - src/components/board/use-camera.ts
  - src/components/command-bar/CommandBar.tsx
  - src/components/command-bar/CommandBarChip.tsx
  - src/components/command-bar/__tests__/CommandBar.a11y.test.tsx
  - src/components/command-bar/__tests__/CommandBar.test.tsx
  - src/components/command-bar/__tests__/command-bar-state.test.ts
  - src/components/command-bar/command-bar-state.ts
  - src/components/sidebar/Sidebar.tsx
  - src/components/sidebar/__tests__/Sidebar.a11y.test.tsx
  - src/components/sidebar/use-sidebar-queries.ts
  - src/lib/__tests__/perf-tier.test.ts
  - src/lib/perf-tier.ts
  - src/lib/supabase/middleware.ts
  - src/stores/__tests__/board-store.test.ts
  - src/stores/__tests__/sidebar-store.test.ts
  - src/stores/board-store.ts
  - src/stores/sidebar-store.ts
  - src/test/setup.ts
  - src/types/database.types.ts
  - supabase/migrations/20260526100000_add_projects.sql
findings:
  critical: 3
  warning: 3
  info: 4
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 49
**Status:** issues_found

## Summary

Phase 2 delivers the board substrate (Konva canvas + DOM overlay), camera system, command bar, sidebar restructure, and database migration for the projects table. The state machine, camera math, and URL serialization are well-structured. Three blockers were found: the logout function is completely broken (no session clearance), the middleware silently treats DB errors as "no profile" forcing all users to /welcome on outage, and EngineGroup never auto-expands when a second analysis starts. Three warnings cover an orphaned `aria-controls` reference, dual `aria-live` regions causing double screen-reader announcements, and missing test isolation in board-store tests.

---

## Critical Issues

### CR-01: Logout navigates to /login without clearing Supabase session — user cannot log out

**File:** `src/components/sidebar/Sidebar.tsx:470`
**Issue:** The "Log out" button calls `router.push("/login")` but never calls `supabase.auth.signOut()`. The Supabase session cookie remains active. Middleware (line 126–128 of `middleware.ts`) immediately redirects authenticated users away from `/login` back to `/analyze`, making logout a complete no-op. No `signOut` call exists anywhere in the codebase.

**Fix:**
```typescript
// Option A — call API route that runs signOut server-side
onClick={() => {
  fetch('/api/auth/logout', { method: 'POST' }).then(() => {
    router.push('/login');
    setAccountOpen(false);
  });
}}

// Option B — use supabase client directly in Sidebar
import { createClient } from '@/lib/supabase/client';
// (inside component)
const supabase = createClient();
onClick={async () => {
  await supabase.auth.signOut();
  router.push('/login');
  setAccountOpen(false);
}}
```

---

### CR-02: Middleware discards Supabase query error — DB outage locks all authenticated users to /welcome

**File:** `src/lib/supabase/middleware.ts:132-139`
**Issue:** The `creator_profiles` query destructures only `{ data: profile }`, silently discarding the `error` field. When the query fails (network error, Supabase downtime), `data` is `null` and `error` is non-null — but the code treats null data identically to "no profile row exists", redirecting every authenticated user to `/welcome`. During any Supabase outage, all logged-in users with completed onboarding are blocked from every protected route.

**Fix:**
```typescript
const { data: profile, error: profileError } = await supabase
  .from("creator_profiles")
  .select("onboarding_completed_at")
  .eq("user_id", user.id)
  .maybeSingle();

// Fail open on DB error — don't lock users out of the app
if (profileError) {
  return supabaseResponse;
}

if (!profile || !profile.onboarding_completed_at) {
  return NextResponse.redirect(new URL("/welcome", request.url));
}
```

---

### CR-03: EngineGroup never auto-expands when a second analysis starts — engine stages hidden on repeat runs

**File:** `src/components/board/EngineGroup.tsx:53-56`
**Issue:** `collapsed` is set to `true` when `stream.phase === 'complete'` but there is no corresponding effect to reset it to `false` when a new analysis begins. On any second or subsequent run: `startStreaming()` fires, the board transitions to `'streaming'`, but `EngineGroup.collapsed` remains `true`. The user sees "View pipeline →" instead of the five stage glyphs for the entire duration of the new analysis, unless they manually click the button. The EngineGroup test suite covers the initial flow but does not test this re-run path.

**Fix:**
```typescript
useEffect(() => {
  if (stream.phase === 'complete') {
    setCollapsed(true);
  } else if (stream.phase === 'analyzing' || stream.phase === 'reconnecting') {
    setCollapsed(false);
  }
}, [stream.phase]);
```

---

## Warnings

### WR-01: `aria-controls="cmd-bar-suggestions"` references a non-existent DOM element — broken ARIA combobox

**File:** `src/components/command-bar/CommandBar.tsx:124`
**Issue:** The `<input>` element has `role="combobox"` and `aria-controls="cmd-bar-suggestions"`, but no element with `id="cmd-bar-suggestions"` exists anywhere in the rendered tree or codebase. Per the ARIA spec, `aria-controls` on a combobox must reference an existing listbox/grid element. Assistive technologies will report a broken relationship; some will warn users that the combobox owns an empty or missing popup.

**Fix:** Remove `aria-controls` until a suggestions list element exists, or add a hidden placeholder list:
```tsx
<input
  type="text"
  role="combobox"
  aria-label="Analysis command bar"
  aria-expanded={false}
  {/* Remove aria-controls until suggestions list is implemented */}
  autoComplete="off"
  ...
/>
```

---

### WR-02: Two `aria-live="polite"` regions for the same stage label — double announcement for screen readers

**File:** `src/components/board/GroupFrameOverlay.tsx:111` and `src/components/board/EngineGroup.tsx:106`
**Issue:** Both `GroupFrameOverlay` (when `isLive` is true, i.e. engine frame + streaming) and `EngineGroup` contain separate `aria-live="polite"` spans for the stage label. Currently `GroupFrameOverlay`'s span is empty (marked as "text injected by plan 2.13"), while `EngineGroup`'s is populated. Once plan 2.13 populates the `GroupFrameOverlay` span, every stage transition will be announced twice in rapid succession by screen readers — a disorienting experience for AT users.

**Fix:** Remove the `aria-live` region from `GroupFrameOverlay`'s engine frame placeholder (lines 107–116) and rely solely on `EngineGroup`'s own live region:
```tsx
// GroupFrameOverlay.tsx — delete the isLive block:
// {isLive && (
//   <span data-testid={`live-${layout.id}`} aria-live="polite" className="sr-only">
//   </span>
// )}
```

---

### WR-03: `board-store` test `beforeEach` does not reset `lastUserInteractionAt` or `currentStageLabel` — shared mutable state between tests

**File:** `src/stores/__tests__/board-store.test.ts:26-36`
**Issue:** The `beforeEach` `setState` call omits `lastUserInteractionAt` and `currentStageLabel`. Since `vi.resetModules()` is never called, all tests share the same Zustand store instance. The `userOverrideCameraFollow` test (line 203) writes `lastUserInteractionAt = Date.now()`, leaving a non-zero timestamp that persists into subsequent tests. Any future test that exercises the 3-second auto-pan suppression logic (which reads `lastUserInteractionAt`) will get false results without any obvious cause.

**Fix:**
```typescript
useBoardStore.setState({
  boardState: 'idle',
  preDrawerState: null,
  camera: { x: 0, y: 0, scale: 1 },
  activePreset: null,
  cameraAutoFollow: false,
  inputDrawerOpen: false,
  selectedNodeId: null,
  cancelConfirmOpen: false,
  lastUserInteractionAt: 0,    // add
  currentStageLabel: null,     // add
});
```

---

## Info

### IN-01: `CommandBar.a11y.test.tsx` `beforeEach` sets wrong property name — dead code

**File:** `src/components/command-bar/__tests__/CommandBar.a11y.test.tsx:13`
**Issue:** `useBoardStore.setState({ state: { kind: 'idle' } } as any)` sets a key `state` that does not exist in `BoardState`. The correct field is `boardState`. The `as any` cast silences the TypeScript error. Individual tests then call `setState({ boardState: '...' })` correctly, so tests pass, but the `beforeEach` does nothing.

**Fix:**
```typescript
beforeEach(() => useBoardStore.setState({ boardState: 'idle' } as any));
```

---

### IN-02: `AppShell` JSDoc comment says collapsed offset is 64px but code uses 68px

**File:** `src/components/app/app-shell.tsx:25`
**Issue:** JSDoc line 25 states `"collapsed: 52px + 12px left margin = 64px offset"` but the code at line 36 applies `"md:pl-[68px]"` with inline comment `"52px sidebar + 16px gap"`. The sidebar is fixed at `left-3` (12px) with `w-[52px]`, so its right edge is at 64px from the viewport. The 68px padding leaves a 4px gap between sidebar right edge and main content. The JSDoc comment references a 12px margin (wrong) instead of the actual 16px gap.

**Fix:** Update the JSDoc comment to match the code:
```typescript
// collapsed: 52px sidebar + 12px left-3 position + 4px gap = 68px total padding
? "md:pl-[68px]"
```

---

### IN-03: `use-camera.ts` URL sync omits `camera.x` and `camera.y` — pan position lost on page refresh

**File:** `src/components/board/use-camera.ts:172`
**Issue:** The `useEffect` that writes camera state to the URL has dependency array `[camera.scale, activePreset]`, intentionally or not omitting `camera.x` and `camera.y`. A user who pans the board, then refreshes, will return to the default pan position even though their zoom level and preset are preserved. If this is intentional (only preset/zoom are URL-synced), a comment should say so; if pan position should be persisted, `x` and `y` must be added.

**Fix (document intent):**
```typescript
// Note: camera.x and camera.y are intentionally not URL-synced.
// Only zoom level and preset survive a page refresh.
}, [camera.scale, activePreset]);
```

---

### IN-04: `/dashboard` sunset uses 307 Temporary Redirect — legacy route stays valid in search engine indexes

**File:** `src/lib/supabase/middleware.ts:59`
**Issue:** The `/dashboard` → `/analyze` redirect uses HTTP 307 (Temporary Redirect). A sunset implies permanent removal; using 307 signals to search engines and HTTP clients that `/dashboard` is still the canonical URL and they should continue using it. A 308 Permanent Redirect would update indexed URLs and browser bookmarks automatically.

**Fix:**
```typescript
return NextResponse.redirect(url, 308); // Permanent redirect for sunset route
```

---

_Reviewed: 2026-05-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
