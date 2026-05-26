---
phase: 02-board-substrate-navigation
reviewed: 2026-05-26T12:00:00Z
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
  critical: 4
  warning: 8
  info: 4
  total: 16
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-26T12:00:00Z
**Depth:** standard
**Files Reviewed:** 49
**Status:** issues_found

## Summary

Phase 2 delivers the board substrate, camera system, sidebar restructure, and the /dashboard sunset redirect. The core state machine logic (board-store) is well-structured and thoroughly tested. The camera math is correct. The middleware redirect is safe against open redirect.

Four blockers stand out: the "Log out" button navigates to `/login` instead of calling Supabase `signOut()`, leaking the authenticated session; the `useCamera` URL-sync effect fires on every camera pan (writing the URL every 200ms), racing with the `window.history.pushState` call in Board.tsx that updates the analysis ID path; the onboarding-redirect query in middleware runs for every authenticated protected-path request including static assets served through Next.js middleware; and the board-store `resetToIdle` spreads `DEFAULT_STATE` but `DEFAULT_STATE` does not include `lastUserInteractionAt` or `currentStageLabel`, silently leaving stale values after a reset.

---

## Critical Issues

### CR-01: "Log out" navigates to /login without signing out — session leak

**File:** `src/components/sidebar/Sidebar.tsx:471`
**Issue:** The sign-out button calls `router.push("/login")` and closes the popover, but never calls `supabase.auth.signOut()`. The Supabase session cookie remains valid. The user lands on `/login`, but the middleware immediately redirects them back to `/analyze` (line 126 in middleware: `if (user && pathname === "/login" || pathname === "/signup")`). The user cannot log out.
**Fix:**
```tsx
// Add a sign-out handler that calls Supabase before navigating
import { createClient } from '@/lib/supabase/client';

const handleSignOut = async () => {
  const supabase = createClient();
  await supabase.auth.signOut();
  setAccountOpen(false);
  router.push('/login');
};

// Replace onClick on the Log out button:
onClick={handleSignOut}
```

---

### CR-02: URL double-write race — history.pushState (Board.tsx) conflicts with replaceState debounce (use-camera.ts)

**File:** `src/components/board/Board.tsx:129-136` and `src/components/board/use-camera.ts:163-172`
**Issue:** Two independent effects both write to `window.history`. When `stream.analysisId` is set, Board.tsx calls `window.history.pushState(null, '', '/analyze/<id>')` (line 133). Simultaneously, the debounced `replaceState` in `useCamera` fires 200ms later with `?focus=...&zoom=...`, overwriting the pathname back to whatever it was before (e.g. `/analyze`), losing the analysis ID from the URL. The user's address bar oscillates: `/analyze/abc123` → `/analyze?focus=overview&zoom=1.00` 200ms later.
**Fix:** The camera URL effect should preserve the current pathname and only update the query string:
```ts
// In use-camera.ts, replaceState effect:
const currentPath = window.location.pathname;   // preserve path
window.history.replaceState(null, '', `${currentPath}?${qs}`);
```

---

### CR-03: board-store `resetToIdle` silently retains `lastUserInteractionAt` and `currentStageLabel`

**File:** `src/stores/board-store.ts:209` and `src/stores/board-store.ts:141-152`
**Issue:** `resetToIdle` spreads `DEFAULT_STATE` (line 209: `set({ ...DEFAULT_STATE })`). But `DEFAULT_STATE` at lines 141-152 does NOT include `lastUserInteractionAt` (defaults to `0`) — it actually does include `lastUserInteractionAt: 0`, but it does NOT include `currentStageLabel: null`. The `DEFAULT_STATE` object on line 141 is missing `currentStageLabel`. After a reset, `currentStageLabel` retains the value from the previous streaming session, causing the command bar to show the stale stage label (e.g. "Synthesizing…") in idle state.

Cross-check: `DEFAULT_STATE` at line 141:
```ts
const DEFAULT_STATE: BoardState = {
  boardState: 'idle',
  preDrawerState: null,
  camera: DEFAULT_CAMERA,
  activePreset: null,
  cameraAutoFollow: false,
  inputDrawerOpen: false,
  selectedNodeId: null,
  cancelConfirmOpen: false,
  lastUserInteractionAt: 0,
  currentStageLabel: null,  // ← missing from the literal; confirmed by reading lines 141-152
};
```
After closer reading, `currentStageLabel` IS missing from `DEFAULT_STATE`. The `BoardState` interface declares it (line 78) but it is not in the `DEFAULT_STATE` object literal (lines 141-152). TypeScript may not catch this if the object is typed as partial internally. Spreading an object missing the field means the existing store value is not overwritten on reset.
**Fix:** Add `currentStageLabel: null` to `DEFAULT_STATE`:
```ts
const DEFAULT_STATE: BoardState = {
  // ... existing fields ...
  lastUserInteractionAt: 0,
  currentStageLabel: null,  // add this line
};
```

---

### CR-04: Middleware onboarding check queries DB on every authenticated protected-path request

**File:** `src/lib/supabase/middleware.ts:131-141`
**Issue:** The `creator_profiles` DB query runs for every authenticated request to any protected path (lines 131-141). This includes every navigation, every `<Link>` prefetch, and every RSC fetch that passes through middleware. The `SELECT onboarding_completed_at` call executes on every page load for authenticated users who have completed onboarding. At scale this adds latency to every page view and will exhaust DB connection pool limits. More critically, if the DB is slow or the query errors, `profile` will be falsy (`data: null` from Supabase on error), and the user will be incorrectly redirected to `/welcome` on every request regardless of their onboarding state, creating an infinite redirect loop to `/welcome`.
**Fix:** Cache onboarding completion in a cookie set at onboarding completion time, and check the cookie in middleware instead of querying the DB:
```ts
// In middleware, replace DB query with:
const onboardingCookie = request.cookies.get('virtuna-onboarding-complete');
if (!onboardingCookie) {
  return NextResponse.redirect(new URL('/welcome', request.url));
}
```
Set the cookie server-side at the end of the `/welcome` flow.

---

## Warnings

### WR-01: `useIsDesktop` in InputDrawer.tsx reads `window.matchMedia` without SSR guard — throws on server

**File:** `src/components/board/InputDrawer.tsx:9-18`
**Issue:** The `useIsDesktop` hook accesses `window.matchMedia` directly inside `useEffect`, which is safe, but the initial `useState(false)` means the sheet always starts rendering `side="bottom"` until hydration, then switches to `side="left"` on desktop. This causes a layout flash on desktop. More importantly, if the Radix `Sheet` SSR-renders the `side` prop before hydration state settles, the initial server-rendered HTML will always have `side="bottom"` which mismatches the client. In a server-components architecture this causes a hydration mismatch warning for desktop users.
**Fix:** Either suppress the mismatch by delaying render until hydrated, or use CSS to handle the side distinction rather than a JS-derived prop.

---

### WR-02: `triggerAntiVirality` called unconditionally after `finishStreaming` — can double-set anti-virality state

**File:** `src/components/board/Board.tsx:113-118`
**Issue:** In the `stream.phase === 'complete'` case, `finishStreaming()` is called first, then `triggerAntiVirality()` is called if `antiVirality` is truthy. The `triggerAntiVirality` action guard (board-store.ts:182) only fires when `boardState === 'complete'`. However, `finishStreaming` uses a state updater (line 177) — the Zustand `set` call with a function. There is no guarantee about the order these two `set` calls are batched in React concurrent mode. If `triggerAntiVirality`'s read of `s.boardState` happens before `finishStreaming`'s write is flushed, the guard `s.boardState === 'complete'` may see `'streaming'` and silently no-op, permanently skipping anti-virality. Then if `stream.phase` stays `'complete'` and the effect re-runs (due to `stream.result` reference change), `finishStreaming` is a no-op (guard: `streaming → complete` only) and `triggerAntiVirality` still sees `boardState !== 'complete'`.
**Fix:** Combine the two transitions into a single store action, or use a `useEffect` with a Zustand `getState()` call to read the already-committed state:
```ts
case 'complete': {
  finishStreaming();
  // Use getState() after the sync call to read the committed state
  const newState = useBoardStore.getState().boardState;
  if (newState === 'complete' && stream.result?.antiVirality) {
    triggerAntiVirality();
  }
  break;
}
```

---

### WR-03: `computeFitCamera` divides by `target.width` and `target.height` without zero-guard — NaN camera on empty frames

**File:** `src/components/board/use-camera.ts:44-45`
**Issue:** `Math.min(availableW / target.width, availableH / target.height)` — if either `target.width` or `target.height` is zero (possible when `CAMERA_PRESET_TARGETS` is extended with a zero-dimension rect), the result is `Infinity`, which then gets clamped to `CAMERA_MAX_SCALE`. This would produce an incorrect camera position. The `x` and `y` calculations also divide by `target.width / 2` and `target.height / 2`. If those are zero, `x` and `y` become `Infinity - Infinity = NaN`, corrupting camera state and crashing Konva.
**Fix:**
```ts
const targetW = Math.max(1, target.width);
const targetH = Math.max(1, target.height);
const scale = clampScale(Math.min(availableW / targetW, availableH / targetH));
const x = viewport.width / 2 - (target.x + targetW / 2) * scale;
const y = viewport.height / 2 - (target.y + targetH / 2) * scale;
```

---

### WR-04: `goToPreset` closes over stale `camera` reference — animated glide starts from wrong position

**File:** `src/components/board/use-camera.ts:116-140`
**Issue:** `goToPreset` is a `useCallback` with `camera` in its dependency array. However, inside the RAF animation loop, `start` captures the `camera` value from the closure at the time `goToPreset` is called (line 130: `const start = camera`). If `goToPreset` is called while a previous glide is running (possible via keyboard shortcut or `activePreset` effect), `cancelGlide()` stops the old RAF, but `start` is still the camera value at call time, not the camera position at the moment the glide was interrupted. This means the new glide always starts from the position when `goToPreset` was _last recreated_ (deps changed), not the current interrupted position. In practice this means switching presets during animation causes a jump.
**Fix:** Capture current camera from the store at the start of each glide:
```ts
const start = useBoardStore.getState().camera; // always fresh
```

---

### WR-05: `InputNode.tsx` — `InputNodeShape` inside `BoardCanvas` but rendered outside a `Layer`

**File:** `src/components/board/Board.tsx:236` and `src/components/board/BoardCanvas.tsx:47`
**Issue:** In `Board.tsx`, `InputNodeShape` is passed as a child of `BoardCanvas` (line 236). In `BoardCanvas.tsx`, the children are rendered inside `<Layer perfectDrawEnabled={false}>{children}</Layer>` (line 47). This Layer does NOT have `listening={false}` (unlike the background Layer at line 43). This means the Layer IS listening to events. However, the background `Rect` (line 45) extends 10000px in all directions as a transparent hit area. The `InputNodeShape`'s `Rect` also has a click handler (`onTap`). The `Node` component (Node.tsx:21) wraps the Rect in a `Group`. In Konva, children in a non-listening layer still receive events via the parent layer's event binding. The transparent background Rect at -10000,-10000 with 20000x20000 size consumes all pointer events on the background layer (listening=false), but the foreground layer is listening. The issue: the foreground Layer has NO background Rect to catch drag events — users can only drag from on top of actual nodes, not from empty canvas areas. This makes panning difficult on a sparse board.
**Fix:** Add a transparent background Rect to the foreground layer as well, or set `draggable` on the Stage and add a background Rect to the listening layer.

---

### WR-06: `EngineGroup` camera auto-pan fires on every re-render when `activeIdx` is stable

**File:** `src/components/board/EngineGroup.tsx:74-90`
**Issue:** The `useEffect` that calls `setActivePreset` has `[activeIdx, boardState, effectiveReducedMotion, setActivePreset]` as dependencies. `setActivePreset` is a Zustand action — it is stable across renders (same reference). `activeIdx` only changes when stream stages change. However, `effectiveReducedMotion` depends on `reducedMotion` (from `usePrefersReducedMotion`) and `tier` (from `usePerfStore`). If `tier` changes (e.g., FPS sampler downgrades mid-stream), `effectiveReducedMotion` changes, re-runs the effect, and calls `setActivePreset` again for the current `activeIdx`, triggering an unwanted camera glide back to the current preset.
**Fix:** The effect should only fire when `activeIdx` changes, not when `effectiveReducedMotion` changes:
```ts
useEffect(() => {
  if (effectiveReducedMotion) return;
  if (boardState !== 'streaming') return;
  // ... rest of logic
}, [activeIdx, boardState]); // eslint-disable-line react-hooks/exhaustive-deps
// Note: intentional omission — effectiveReducedMotion is read for guard only
```

---

### WR-07: `Sidebar.tsx` "Log out" popover has no outside-click or focus-trap dismiss

**File:** `src/components/sidebar/Sidebar.tsx:450-477`
**Issue:** The account popover is a raw `<div>` positioned absolutely, toggled via `accountOpen` state. There is no Escape key handler, no focus trap, and no outside-click handler to close it. Users who open the popover and then click elsewhere on the page (e.g., the board canvas) will have a stuck-open popover covering sidebar content. This is also an accessibility gap — the popover is not a `dialog`, has no `aria-modal`, and screen reader focus is not managed.
**Fix:** Use Radix `DropdownMenu` or add an outside-click overlay div + Escape key handler:
```tsx
useEffect(() => {
  if (!accountOpen) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setAccountOpen(false);
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [accountOpen]);
```

---

### WR-08: `board-store.test.ts` — `beforeEach` setState missing `lastUserInteractionAt` and `currentStageLabel`

**File:** `src/stores/__tests__/board-store.test.ts:26-36`
**Issue:** The `beforeEach` manually resets state via `useBoardStore.setState(...)` but the object does not include `lastUserInteractionAt` or `currentStageLabel`. If a test sets these fields, subsequent tests see dirty state. This is the same root cause as CR-03: `DEFAULT_STATE` in the store is missing `currentStageLabel`. Tests that rely on `currentStageLabel` being `null` after reset will produce false-positive passes if the test order changes.
**Fix:** Add the missing fields to the reset object in `beforeEach`:
```ts
useBoardStore.setState({
  boardState: 'idle',
  preDrawerState: null,
  camera: { x: 0, y: 0, scale: 1 },
  activePreset: null,
  cameraAutoFollow: false,
  inputDrawerOpen: false,
  selectedNodeId: null,
  cancelConfirmOpen: false,
  lastUserInteractionAt: 0,
  currentStageLabel: null,
});
```

---

## Info

### IN-01: `CameraOverlay` renders empty strings for the internal `engine` preset — empty button accessible name

**File:** `src/components/board/CameraOverlay.tsx:11-25` and `src/components/board/CameraOverlay.tsx:27-28`
**Issue:** `PRESET_ORDER` excludes `'engine'` (correct — it's internal-only). However, `PRESET_LABELS['engine']` and `PRESET_KEYS['engine']` are `''`. If this mapping is ever iterated (e.g., in a future refactor that replaces `PRESET_ORDER` with `Object.keys(PRESET_LABELS)`), buttons with empty accessible names would be created, failing WCAG 2.4.6. Low risk now but a maintenance trap.
**Fix:** Remove the `engine` key from `PRESET_LABELS` and `PRESET_KEYS` and use a type-narrowed subset type for the user-facing presets.

---

### IN-02: `InputDrawer.tsx` — `void openInputDrawer` suppresses unused-var warning with a side effect

**File:** `src/components/board/InputDrawer.tsx:68`
**Issue:** `void openInputDrawer;` is used as a comment substitute to suppress an ESLint `no-unused-vars` warning. This pattern leaves dead code in production and is fragile — if the variable is renamed, the suppression silently breaks. The comment says it's "reserved for future," which is fine, but the approach is wrong.
**Fix:** Either remove the import entirely and add it back when needed, or add an eslint-disable comment targeted at the specific line:
```ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const openInputDrawer = useBoardStore((s) => s.openInputDrawer);
```

---

### IN-03: `CommandBar.a11y.test.tsx` — stale `beforeEach` sets wrong state shape

**File:** `src/components/command-bar/__tests__/CommandBar.a11y.test.tsx:13`
**Issue:** `beforeEach(() => useBoardStore.setState({ state: { kind: 'idle' } } as any))` — sets `state.kind` which is not the correct shape for the board store (the store uses `boardState: 'idle'`). The `as any` suppresses the type error. This beforeEach has no effect on the real store shape, meaning each test gets whatever state was left by the previous test. The tests still pass because each test sets `boardState` explicitly before rendering, but the `beforeEach` is misleading and provides no isolation guarantee.
**Fix:**
```ts
beforeEach(() => useBoardStore.setState({ boardState: 'idle' }));
```

---

### IN-04: `supabase/migrations/20260526100000_add_projects.sql` — backfill runs without a transaction, partial failure is silent

**File:** `supabase/migrations/20260526100000_add_projects.sql:56-72`
**Issue:** The seed `INSERT` and backfill `UPDATE` at lines 59-72 run as separate statements outside an explicit transaction. If the migration runner exits between the INSERT and the UPDATE (e.g., network drop, timeout), some users will have a "My Boards" project but analyses still have `project_id = NULL`. Re-running the migration is idempotent for the schema DDL but the INSERT uses `ON CONFLICT DO NOTHING`, so the missing backfill rows will not be fixed on re-run. The UPDATE at line 66 will re-apply (it only touches rows where `project_id IS NULL`), so re-running does fix it, but only if the operator notices.
**Fix:** Wrap the seed+backfill in an explicit transaction, or add a comment documenting the re-run safety:
```sql
BEGIN;
INSERT INTO public.projects ...;
UPDATE public.analysis_results ...;
COMMIT;
```

---

_Reviewed: 2026-05-26T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
