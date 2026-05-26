---
phase: 02-board-substrate-navigation
reviewed: 2026-05-26T12:00:00Z
depth: standard
files_reviewed: 54
files_reviewed_list:
  - e2e/dashboard-redirect.spec.ts
  - src/__mocks__/konva-node.ts
  - src/__mocks__/react-konva.tsx
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
  - src/components/board/__tests__/BoardCanvas.drag-sync.test.tsx
  - src/components/board/__tests__/EngineGroup.test.tsx
  - src/components/board/__tests__/GroupFrame.test.tsx
  - src/components/board/__tests__/InputDrawer.test.tsx
  - src/components/board/__tests__/Node.test.tsx
  - src/components/board/__tests__/OrientationHint.test.tsx
  - src/components/board/__tests__/board-constants.test.ts
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
  warning: 6
  info: 4
  total: 14
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-26T12:00:00Z
**Depth:** standard
**Files Reviewed:** 54
**Status:** issues_found

## Summary

Phase 2 delivers the board substrate: Konva canvas, camera/preset system, 6-frame overlay layout, board state machine, command bar, sidebar restructure, perf-tier detection, and the projects schema migration. Architecture is sound and the code is generally well-structured. Four blockers were found: a stale-closure that can emit a one-frame visual glitch during animated camera glides, a `replaceState`/`pushState` ordering race during streaming, a cross-user `project_id` write path left open in the migration, and an account popover with no outside-click or Escape dismissal. Six warnings cover logic gaps in streaming state transitions, initial viewport sizing, and the drag-zoom race.

---

## Critical Issues

### CR-01: Stale `camera` closure produces one-frame visual glitch during animated glide

**File:** `src/components/board/use-camera.ts:129-139`

**Issue:** `goToPreset` captures `camera` (the prop value at creation time) as `start` for the RAF animation. When the user pans while a glide is in progress, `setCamera` fires, React re-renders, `goToPreset` is recreated with the new `camera` value, and the `activePreset` effect fires a new `goToPreset` call. The new call invokes `cancelGlide()` before starting the new chain — correctly stopping the old RAF id via the shared `rafRef`.

However, there is a one-tick window: the old `tick` function already scheduled via `requestAnimationFrame` may have been handed to the browser's RAF queue before `cancelGlide` ran. If the browser fires that queued tick before JavaScript processes the cancel (possible in some browsers when the RAF queue is drained before microtasks), `setCamera(easeCameraTowards(oldStart, final, t))` fires once with the stale `oldStart` — snapping the camera back one frame before the new glide takes over.

**Fix:** Move the `start` snapshot inside the RAF loop rather than closing over the prop at call time, or use a ref to always read the latest camera:

```typescript
// use-camera.ts — goToPreset
const cameraRef = useRef(camera);
useEffect(() => { cameraRef.current = camera; }, [camera]);

const goToPreset = useCallback((key: CameraPresetKey) => {
  const target = CAMERA_PRESET_TARGETS[key];
  if (!target) return;
  const final = computeFitCamera(target, viewport);
  setActivePreset(key);
  cancelGlide();

  if (args.reducedMotion) {
    setCamera(final);
    return;
  }

  const start = { ...cameraRef.current }; // always fresh at call time
  const startedAt = performance.now();
  const DURATION = 300;
  const tick = (now: number) => {
    const t = Math.min(1, (now - startedAt) / DURATION);
    setCamera(easeCameraTowards(start, final, t));
    if (t < 1) rafRef.current = requestAnimationFrame(tick);
    else rafRef.current = null;
  };
  rafRef.current = requestAnimationFrame(tick);
}, [setCamera, setActivePreset, viewport, args.reducedMotion, cancelGlide]);
// Remove `camera` from deps — read via ref instead
```

---

### CR-02: `replaceState` / `pushState` ordering race corrupts URL during streaming

**File:** `src/components/board/use-camera.ts:165-174` and `src/components/board/Board.tsx:129-136`

**Issue:** Two concurrent URL mutation paths can interleave:

1. `Board.tsx` line 130-136: `window.history.pushState(null, '', '/analyze/${analysisId}')` fires synchronously when `stream.analysisId` is first set during streaming.
2. `use-camera.ts` line 167-170: debounced `replaceState` fires 200ms after any `camera.scale` or `activePreset` change.

During streaming, `setActivePreset` fires on each wave boundary (EngineGroup lines 87-94), which triggers `goToPreset` (Board.tsx lines 208-210), which calls `setActivePreset` again (use-camera.ts line 120) — resetting the 200ms debounce on every wave boundary.

Race: `pushState` executes at t=0 changing pathname to `/analyze/abc`. The debounce was scheduled at t=-50ms (before analysisId arrived). At t=150ms the debounce fires, calling `replaceState(null, '', '?focus=engine&zoom=0.52')` — **without the pathname**. This strips the `/analyze/abc` segment, reverting the URL back to just `?focus=engine&zoom=0.52` on the current path (which is now `/analyze/abc`, so `?focus=engine&zoom=0.52` is correctly applied relative to it). Actually this is safe because `replaceState` only replaces state on the *current* URL — it would produce `/analyze/abc?focus=engine&zoom=0.52`.

However if the debounce fires *before* `pushState` (race in the other direction): at t=50ms `replaceState` fires on `/analyze` producing `/analyze?focus=engine&zoom=0.52`. At t=100ms `pushState` fires, producing `/analyze/abc?focus=engine&zoom=0.52` (pushState appends to current URL's path). This is correct by accident.

The actual broken case: `replaceState` constructs the URL as `` `?${qs}` `` (a relative URL with only query string). On some browsers, a relative `?...` URL in `replaceState` is resolved relative to the current `document.URL`, not the current `history` state URL. If `pushState` was the last navigation, the relative resolution is correct. But since both operations run asynchronously, this depends on which history entry is "current" at debounce execution time.

**Fix:** Merge both URL updates into one place. Introduce a single `useEffect` in `Board.tsx` that writes both the pathname and query string atomically:

```typescript
useEffect(() => {
  if (!stream.analysisId) return;
  const qs = serializeCamera({ preset: activePreset, zoom: camera.scale });
  const target = `/analyze/${stream.analysisId}?${qs}`;
  if (window.location.pathname + window.location.search !== target) {
    window.history.replaceState(null, '', target);
  }
}, [stream.analysisId, activePreset, camera.scale]);
```

And remove the separate `pushState` effect and the `replaceState` debounce in `useCamera`.

---

### CR-03: Migration leaves cross-user `project_id` write path open on `analysis_results`

**File:** `supabase/migrations/20260526100000_add_projects.sql:47-73`

**Issue:** The migration adds `project_id UUID NULL REFERENCES public.projects(id) ON DELETE SET NULL` to `analysis_results`. The FK validates existence of the referenced project but does not validate that `projects.user_id = analysis_results.user_id`. 

If a future UPDATE RLS policy is added to `analysis_results` (there is none now, so this is not exploitable today), a user could set their own `analysis_results.project_id` to a UUID of a project owned by a different user. The FK constraint allows this because the project UUID exists. Any query that joins `analysis_results` with `projects` without re-checking `projects.user_id = auth.uid()` would then surface User A's project metadata to User B.

**Fix:** Add an ownership check to the FK side, enforced via a trigger or a check constraint:

```sql
-- Add a trigger to prevent cross-user project assignment:
CREATE OR REPLACE FUNCTION check_project_ownership()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = NEW.project_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'project_id must belong to the same user as the analysis';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_project_ownership
  BEFORE INSERT OR UPDATE OF project_id ON public.analysis_results
  FOR EACH ROW EXECUTE FUNCTION check_project_ownership();
```

This should be added now before any client-side update path for `project_id` is opened.

---

### CR-04: Account popover in `Sidebar.tsx` has no outside-click or Escape dismissal

**File:** `src/components/sidebar/Sidebar.tsx:451-479`

**Issue:** The account popover is a plain `<div>` controlled by `accountOpen` state. There is no mechanism to close it by clicking outside the popover or pressing Escape. The popover has no ARIA role (`role="menu"` or `role="dialog"`), so screen readers cannot identify it as a popup region or navigate it with keyboard shortcuts for menus.

Practical consequence: once opened, the popover can only be closed by clicking one of its two action buttons (Settings or Log out), both of which navigate away. Clicking anywhere else on the page (including the board canvas) does nothing. This fails basic UX expectations and WCAG 2.1 criterion 1.3.1 (info and relationships — popup structure must be programmatically determinable).

**Fix:** Use Radix `DropdownMenu` instead of a hand-rolled popover, or add a click-outside + Escape listener:

```typescript
useEffect(() => {
  if (!accountOpen) return;
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAccountOpen(false); };
  const onClick = (e: MouseEvent) => {
    if (!(e.target as Element).closest('[data-account-menu]')) setAccountOpen(false);
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('mousedown', onClick);
  return () => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mousedown', onClick);
  };
}, [accountOpen]);
```

Add `data-account-menu` to the popover container div and `role="menu"` / `role="menuitem"` to elements inside.

---

## Warnings

### WR-01: `finishStreaming` + `triggerAntiVirality` can fire against stale `stream.result` on reconnect

**File:** `src/components/board/Board.tsx:103-127`

**Issue:** The effect depends on `[stream.phase, stream.result]`. If the SSE connection drops and reconnects, `stream.phase` may briefly return to `'analyzing'` then `'complete'` again. On the second `'complete'`, `finishStreaming()` is a no-op (board is already `complete` or `anti-virality`). But `triggerAntiVirality()` is called again: `triggerAntiVirality` only fires from `complete` state, so if board is `anti-virality` it is also a no-op. Safe on nominal paths.

Unsafe path: user calls `resetToIdle()`, then immediately starts a new analysis. The new stream starts, but if `stream.result` is not cleared synchronously (it may be stale from the previous run for one render), the `phase === 'complete'` branch fires with the old `result` — potentially triggering anti-virality for a new analysis that has not finished yet.

**Fix:** Guard the anti-virality trigger with `stream.analysisId` matching the board's current analysis ID, or verify `stream.result` is non-null and correlates with the current `analysisId` before acting on it.

---

### WR-02: `useIsDesktop` in `InputDrawer.tsx` always starts as `false`, causing mobile → desktop animation flash

**File:** `src/components/board/InputDrawer.tsx:9-18`

**Issue:** `useState(false)` means the drawer always renders with `side='bottom'` on the first paint, even on desktop. After the `useEffect` fires and detects a desktop viewport, `setDesktop(true)` triggers a re-render with `side='left'`. Radix `Sheet` animates based on the `side` prop determined at first render — changing it post-mount causes a stutter or remount of the sheet animation.

**Fix:** Initialize with the real value on client:
```typescript
const [desktop, setDesktop] = useState<boolean>(() =>
  typeof window !== 'undefined'
    ? window.matchMedia('(min-width: 768px)').matches
    : false,
);
```

---

### WR-03: `EngineGroup` calls `setActivePreset` unconditionally, can cancel in-progress glides

**File:** `src/components/board/EngineGroup.tsx:78-94`

**Issue:** Every time `activeIdx` changes, `setActivePreset(presetKey)` fires. `Board.tsx` reacts to `activePreset` changes by calling `goToPreset(activePreset)`, which calls `cancelGlide()`. If `activeIdx` changes rapidly (multiple stage events in quick succession), each change cancels the previous glide and starts a new one — resulting in stuttering camera behavior rather than a smooth transition to the destination.

**Fix:** Debounce the `setActivePreset` call in `EngineGroup`, or skip the call when `presetKey` equals the current `activePreset`:
```typescript
const currentPreset = useBoardStore((s) => s.activePreset);
// ...inside effect:
if (presetKey !== currentPreset) {
  setActivePreset(presetKey as Parameters<typeof setActivePreset>[0]);
}
```

---

### WR-04: `handleDragMove` in `BoardCanvas.tsx` spreads stale `camera.scale` in simultaneous zoom+drag

**File:** `src/components/board/BoardCanvas.tsx:33-42`

**Issue:** `setCamera({ ...camera, x, y })` spreads the `camera` prop from the closure. During simultaneous touch-zoom and drag (multi-touch on mobile), `handleWheel` and `handleDragMove` can both fire in the same event loop turn. `handleWheel` calls `setCamera` with a new scale. React batches the update. `handleDragMove` then fires, still reading the pre-zoom `camera.scale` from the closure, and calls `setCamera({ ...oldCamera, x, y })` — overwriting the scale update from `handleWheel` with the stale scale.

**Fix:** Read scale from the Konva stage itself rather than the closed-over `camera` prop:
```typescript
const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
  const stage = e.target.getStage();
  if (!stage) return;
  const x = stage.x();
  const y = stage.y();
  if (x === camera.x && y === camera.y) return;
  // Read scale from stage to avoid stale closure issue during simultaneous zoom+drag
  setCamera({ x, y, scale: stage.scaleX() });
};
```

---

### WR-05: Initial camera fit applied at 800×600 default viewport for URL-preset loads

**File:** `src/components/board/use-camera.ts:145-158`

**Issue:** The one-shot URL preset effect fires on mount. At mount time, `viewport` is the default `{ width: 800, height: 600 }` (Board.tsx line 165). `computeFitCamera(target, viewport)` is called with this default, producing a camera fit for an 800×600 viewport. The `initialFitApplied` guard in `Board.tsx` lines 214-223 only re-fits to `overview` when the camera is at the absolute default (x=0, y=0, scale=1). Since the URL preset set a different camera, the guard's condition is false — the board remains fitted to the default viewport, not the real one.

**Fix:** Defer URL preset application until `viewport` is real:
```typescript
// In Board.tsx, pass viewportReady to useCamera
const viewportReady = !(viewport.width === 800 && viewport.height === 600);

// In use-camera.ts, gate the one-shot URL preset on viewportReady:
useEffect(() => {
  if (!viewportReady) return; // wait for real viewport
  if (appliedInitialRef.current) return;
  appliedInitialRef.current = true;
  // ...apply preset
}, [viewportReady]); // eslint-disable-line react-hooks/exhaustive-deps
```

---

### WR-06: `NodeSpec.tabIndex` optional field allows positive tabIndex values via type

**File:** `src/components/board/board-types.ts:44` and `src/components/board/NodeOverlay.tsx:33`

**Issue:** `NodeSpec.tabIndex?: number` is typed as any number. `NodeOverlay.tsx` uses `spec.tabIndex ?? 0`, so the default is 0 (correct). But if a caller passes `tabIndex: 3` in a `NodeSpec`, this produces a positive tabIndex that disrupts natural tab order — a known WCAG anti-pattern. The `GroupFrameOverlay` correctly restricts its `tabIndex` prop to `0 | -1` via TypeScript, but `NodeOverlay` uses the untyped `NodeSpec.tabIndex`.

**Fix:** Restrict the type:
```typescript
export interface NodeSpec {
  // ...
  tabIndex?: 0 | -1; // explicit, never positive
}
```

---

## Info

### IN-01: `detectInitialTier` fails open at `'high'` on GPU detection error

**File:** `src/lib/perf-tier.ts:53-55`

Default `'high'` on unknown GPU means animations run at full quality on slow devices until the FPS sampler detects low FPS (after ~3 seconds of low frame rate). Consider `'medium'` as a more conservative fail-open default.

---

### IN-02: Dead `void openInputDrawer` suppression

**File:** `src/components/board/InputDrawer.tsx:68`

```typescript
void openInputDrawer;
```

Dead code. Replace with a `// TODO(plan-2.13): openInputDrawer reserved for re-open after submit` comment and remove the `void` expression — it suppresses the linter but adds noise.

---

### IN-03: `FRAME_CORNER_RADIUS - 4` magic subtraction in `Node.tsx`

**File:** `src/components/board/Node.tsx:27`

The comment explains the math but a named constant (`NODE_CORNER_RADIUS = 8`) would be more maintainable than an inline arithmetic expression against another constant.

---

### IN-04: `Board.a11y.test.tsx` uses `setTimeout(0)` to await dynamic import

**File:** `src/components/board/__tests__/Board.a11y.test.tsx:63`

```typescript
await new Promise((r) => setTimeout(r, 0));
```

This is a fragile test pattern: it relies on a microtask flush happening within a single event loop tick. If the dynamic import mock resolves asynchronously beyond a single tick, the axe check runs before the BoardCanvas mounts. Use `waitFor` from `@testing-library/react` or `act` with a proper flush instead:

```typescript
await act(async () => { await new Promise(r => setTimeout(r, 50)); });
```

---

_Reviewed: 2026-05-26T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
