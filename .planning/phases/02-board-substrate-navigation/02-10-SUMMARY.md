---
phase: 02-board-substrate-navigation
plan: 10
subsystem: perf-tier
tags: [performance, gpu-detection, fps-sampler, zustand, localStorage, toast]

# Dependency graph
requires:
  - phase: 02-board-substrate-navigation (Plan 01)
    provides: Board.tsx scaffold
  - phase: 02-board-substrate-navigation (Plan 04)
    provides: board-store + camera state in Board.tsx
dependency_graph:
  provides:
    - src/lib/perf-tier.ts
    - src/lib/__tests__/perf-tier.test.ts
  affects:
    - src/components/board/Board.tsx
    - src/components/board/__tests__/Board.test.tsx
    - src/components/board/__tests__/GroupFrame.test.tsx

# Tech tracking
tech-stack:
  added:
    - "@pmndrs/detect-gpu@6.0.6 — GPU tier detection via UA + WebGL benchmark"
  patterns:
    - "usePerfStore: Zustand store exposing tier (high|medium|low) + detected flag"
    - "detectInitialTier: async import of @pmndrs/detect-gpu, 7-day localStorage cache"
    - "startFpsSampler: RAF-based 1Hz sampler, fires onDrop once after 3 sustained <40fps windows"
    - "effectiveReducedMotion = reducedMotion || tier === 'low' — tier coerces motion gates"
    - "vi.stubGlobal('localStorage', ...) pattern for happy-dom 20.x tests"

key-files:
  created:
    - "src/lib/perf-tier.ts — detectInitialTier + startFpsSampler + usePerfStore + nextLowerTier"
    - "src/lib/__tests__/perf-tier.test.ts — 11 passing tests"
  modified:
    - "src/components/board/Board.tsx — perf detection + FPS sampler wired post-mount"
    - "src/components/board/__tests__/Board.test.tsx — wrapped in ToastProvider"
    - "src/components/board/__tests__/GroupFrame.test.tsx — wrapped in ToastProvider"

key-decisions:
  - "vi.stubGlobal localStorage instead of relying on happy-dom 20.x --localstorage-file flag — aligns with sidebar-store.test.ts pattern already in codebase"
  - "FPS simulation uses 34ms frame intervals (not 33ms) so 30 frames cross the 1000ms window check (30*34=1020>1000)"
  - "toast called with variant: 'default' — ToastData requires variant field, plan snippet omitted it"
  - "Board tests wrapped in ToastProvider (Rule 1 auto-fix) — useToast throws outside provider"

# Metrics
duration: ~15min
completed: 2026-05-26T10:47:00Z
tasks_completed: 3
files_created: 2
files_modified: 3
---

# Phase 02 Plan 10: Performance Tier Detection Summary

**`@pmndrs/detect-gpu`-based initial tier detection + RAF FPS sampler + `usePerfStore` Zustand store; `tier=low` coerces reduced-motion gates in Board.tsx.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-05-26T10:47:00Z
- **Tasks:** 3 of 3
- **Files created:** 2 (perf-tier.ts, perf-tier.test.ts)
- **Files modified:** 3 (Board.tsx, Board.test.tsx, GroupFrame.test.tsx)

## Accomplishments

### perf-tier module (`src/lib/perf-tier.ts`)

| Export | Description |
|--------|-------------|
| `usePerfStore` | Zustand store: `{ tier: 'high'\|'medium'\|'low', detected: boolean, setTier }`. Initial state: `tier='high', detected=false`. |
| `detectInitialTier()` | Async. Checks localStorage cache (7-day TTL). If miss/expired, calls `getGPUTier()` from `@pmndrs/detect-gpu`. Maps GPU tier 0-1→low, 2→medium, 3+→high. Writes result + timestamp to localStorage. Fail-open: returns 'high' on any error. |
| `startFpsSampler(onDrop)` | RAF-based 1Hz sampler. Counts consecutive seconds with <40fps. After 3 consecutive low windows, calls `onDrop` exactly once and stops. Returns `cancel()` function. |
| `nextLowerTier(t)` | `high→medium`, `medium→low`, `low→low`. |

### localStorage keys

| Key | Value | TTL |
|-----|-------|-----|
| `virtuna-perf-tier` | `'high'` / `'medium'` / `'low'` | 7 days |
| `virtuna-perf-tier-at` | Unix timestamp (ms) string | 7 days |

### Board.tsx wiring

```tsx
// Post-mount GPU detection (Pitfall 5: never block first paint)
useEffect(() => {
  let cancelled = false;
  detectInitialTier().then((t) => { if (!cancelled) setTier(t); });
  return () => { cancelled = true; };
}, [setTier]);

// Runtime FPS sampler — one-shot downgrade
useEffect(() => {
  const cancel = startFpsSampler(() => {
    const dropped = nextLowerTier(usePerfStore.getState().tier);
    usePerfStore.getState().setTier(dropped);
    localStorage.setItem('virtuna-perf-tier', dropped);
    toast({ title: 'Optimized for your device', variant: 'default' });
  });
  return cancel;
}, [toast]);

// tier=low coerces reduced-motion
const effectiveReducedMotion = reducedMotion || tier === 'low';
// passed to useCamera + GroupFrameOverlay
```

### Contract for downstream phases

**Phase 4 (Audience node):** Read `usePerfStore((s) => s.tier)` to tune heatmap render budget:
- `'high'` — full resolution, all particles
- `'medium'` — reduce particle count by 50%
- `'low'` — minimal render, no particles, static fallback

### 4× CPU throttle test recipe (empirical validation)

1. Open `/analyze` in Chrome
2. DevTools → Performance tab → CPU: 4× slowdown
3. Wait ~5 seconds — "Optimized for your device" toast fires
4. Reload — `localStorage.getItem('virtuna-perf-tier')` → should show `'medium'` or `'low'`
5. Note: Phase 2 ships plumbing only; full empirical validation deferred to Phase 4 when Audience node adds GPU load

## Task Commits

| # | Commit | Type | Description |
|---|--------|------|-------------|
| 1 | `5caa2fa` | feat | Install @pmndrs/detect-gpu@6.0.6 |
| 2 (RED) | `c9eb3d5` | test | Failing tests for perf-tier (RED) |
| 2 (GREEN) | `d0a43d1` | feat | Implement perf-tier module |
| 3 | `f5f3884` | feat | Wire perf-tier into Board.tsx |

## Tests

11 Vitest tests in `src/lib/__tests__/perf-tier.test.ts` — all pass:

| Suite | Tests |
|-------|-------|
| detectInitialTier — cache hit | 1 |
| detectInitialTier — tier mapping (3/2/1/0) | 3 |
| detectInitialTier — TTL expiry | 1 |
| detectInitialTier — localStorage write | 1 |
| startFpsSampler — 3 consecutive low-fps | 1 |
| startFpsSampler — cancel function | 1 |
| usePerfStore — initial state | 1 |
| usePerfStore — setTier | 1 |
| nextLowerTier — high→medium→low→low | 1 |

Board suite: 27/27 passing (3 Board.test.tsx + 4 GroupFrame.test.tsx + 11 use-camera + 9 use-camera.reduced-motion).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] toast() call missing required variant field**
- **Found during:** Task 3 (build error)
- **Issue:** `ToastData` type requires `variant` field; plan snippet omitted it
- **Fix:** Added `variant: 'default'` to toast call
- **Files modified:** `src/components/board/Board.tsx`

**2. [Rule 1 - Bug] Board.test.tsx + GroupFrame.test.tsx: useToast outside ToastProvider**
- **Found during:** Task 3 (board test run)
- **Issue:** `useToast()` throws when rendered outside `<ToastProvider>`. Tests render `<Board />` directly.
- **Fix:** Wrapped renders in `<ToastProvider>` via `renderBoard()` helper in both test files
- **Files modified:** `src/components/board/__tests__/Board.test.tsx`, `src/components/board/__tests__/GroupFrame.test.tsx`

**3. [Rule 1 - Bug] localStorage not available in test environment + FPS frame timing**
- **Found during:** Task 2 GREEN phase (test failures)
- **Issue 1:** happy-dom 20.x requires `--localstorage-file` path for localStorage; without it `localStorage.clear` is not a function. Used `vi.stubGlobal('localStorage', ...)` pattern consistent with `sidebar-store.test.ts`.
- **Issue 2:** 30 frames × 33ms = 990ms < 1000ms threshold — window never triggered. Fixed to 34ms frames (30 × 34 = 1020ms > 1000ms).
- **Files modified:** `src/lib/__tests__/perf-tier.test.ts`

## Known Stubs

None. The perf-tier system is fully functional. Visual degradations (heatmap render budget, particle reduction) are intentionally deferred to Phase 4 per UI-SPEC §Performance Tier Visual Degradations note. The `tier=low → effectiveReducedMotion` coercion ships now as the first concrete degradation.

## Threat Surface Scan

No new security-relevant surface. `usePerfStore` is client-side ephemeral state only. localStorage writes contain only tier strings (`'high'`/`'medium'`/`'low'`) and timestamps — no PII, no auth tokens. No network calls introduced. No threat flags.

## Self-Check: PASSED

**Files exist:**
- `src/lib/perf-tier.ts` — FOUND
- `src/lib/__tests__/perf-tier.test.ts` — FOUND
- `src/components/board/Board.tsx` — FOUND (modified)
- `.planning/phases/02-board-substrate-navigation/02-10-SUMMARY.md` — FOUND (this file)

**Commits exist:**
- `5caa2fa` — FOUND (install)
- `c9eb3d5` — FOUND (RED test)
- `d0a43d1` — FOUND (GREEN implementation)
- `f5f3884` — FOUND (Board wiring)

**Tests:** 11/11 perf-tier passing, 27/27 board tests passing, build green.

---
*Phase: 02-board-substrate-navigation*
*Plan: 10*
*Completed: 2026-05-26*
