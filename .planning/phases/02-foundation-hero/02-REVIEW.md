---
phase: 02-foundation-hero
reviewed: 2026-05-10T23:55:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - src/components/landing/BehavioralHero.tsx
  - src/components/landing/BehavioralCanvas.tsx
  - src/components/landing/behavioral-hero-constants.ts
  - src/components/landing/__tests__/behavioral-hero-constants.test.ts
  - src/components/landing/index.ts
  - src/app/(marketing)/page.tsx
  - src/app/globals.css
  - src/components/ui/button.tsx
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-10T23:55:00Z
**Depth:** deep
**Files Reviewed:** 8 (7 source + 1 test)
**Status:** issues_found

## Summary

Phase 02's stated goal is to ship the "Behavioral Simulation Visual" hero — a coral-particle Canvas 2D animation that converges into an "87%" confidence chip. **The DOM hero composition lands correctly**, but adversarial verification with Playwright proves the **canvas itself paints zero particles** in every tested scenario (desktop, mobile, reduced-motion, after-resize). The flagship visual element of this entire milestone is non-functional.

Root cause: a classic React effect-ordering race — the particle-init `useEffect` reads `sizeRef.current` before `useCanvasResize`'s `ResizeObserver` has fired its first callback, takes the early-return on `width <= 0`, and never re-runs because the effect dependencies (`[reducedMotion, render]`) don't include `sizeRef`. Both motion and reduced-motion branches are gated behind this check, so neither ever executes. Live verification: `await page.goto("/"); await page.waitForTimeout(8000);` then `getImageData(...)` reports `nonZeroPixels: 0` on a 592x520 canvas.

The plan summaries' "Self-Check: PASSED" sections are misleading: they verify file existence, copy strings, and that `pnpm build` exits 0 — but `pnpm build` only validates SSR prerender, which never runs the client effect. The Vitest suite tests numeric invariants on constants, not canvas output. **No automated test exercises the actual hydrated canvas**, which is why this defect shipped through the full plan/execute/verify loop.

The Button asChild Slot fix is correct and well-scoped. The lint output also surfaces two real `react-hooks/immutability` errors in `BehavioralCanvas.tsx` that the project lint config does NOT ignore (unlike `src/components/hive/**`), causing `pnpm lint` to exit 1. Server-component boundaries, XSS surface, secrets, and `prefers-reduced-motion` CSS are all clean.

## Critical Issues

### CR-01: BehavioralCanvas paints zero particles — flagship hero visual is empty

**File:** `src/components/landing/BehavioralCanvas.tsx:155-201`
**Issue:** The particle-init `useEffect` reads `sizeRef.current` from the `useCanvasResize` hook, but on first run `sizeRef.current` is the placeholder `{ width: 0, height: 0, dpr: 1 }` because `ResizeObserver` callbacks fire asynchronously *after* React commits all effects. The early return at line 157 (`if (width <= 0 || height <= 0) return;`) is taken; `particlesRef.current` stays `[]`; the effect deps `[reducedMotion, render]` never change, so the effect never re-runs even when `ResizeObserver` later populates `sizeRef`. Both motion and reduced-motion branches sit *after* this gate, so both are skipped.

Reproduced live with Playwright against `pnpm dev` on `/`:

```
Test 1 (1280x800, 4s wait):       {"w":592,"h":520,"nonZero":0,"total":307840}
Test 2 (reduced motion, 1.5s):    {"w":592,"h":520,"nonZero":0,"total":307840}
Test 3 (mobile 390x844, 4s):      {"w":342,"h":342,"nonZero":0,"total":116964}
Test 4 (1280x800, 8s wait):       {"w":592,"h":520,"nonZero":0,"total":307840}
After viewport resize, 3s wait:   {"w":464,"h":520,"nonZero":0,"total":241280}
```

`getImageData` confirms 0 non-transparent pixels in every case. The `ResizeObserver` log shows it fires for the canvas at `~237ms` with the correct CSS dimensions, but by then the init effect has already run-and-returned. The screenshot at `/tmp/hero-screenshot.png` shows the hero text + 87% DOM chip rendered correctly but a completely empty canvas region — the visual metaphor that anchors the entire BRAND-BIBLE Visual Metaphor Lock is missing from production.

This bug is masked by:
1. `pnpm build` passes (SSR prerender doesn't run client effects).
2. `pnpm test` passes (the Vitest suite at `behavioral-hero-constants.test.ts` only asserts numeric invariants on constants, never renders the canvas).
3. The plan-04 manual verification gate ("open Chrome at 1280x720 viewport, screenshot the hero ... canvas particle convergence point") is still unchecked (`[ ]`) per `02-04-SUMMARY.md` line 189.

**Fix:** Restructure so the init effect runs once `sizeRef` has non-zero dimensions. Two correct shapes:

Option A — drive init from a `useState` size mirror updated by the resize callback:

```tsx
const [size, setSize] = useState({ width: 0, height: 0, dpr: 1 });
const sizeRef = useCanvasResize(canvasRef, useCallback((s) => {
  setSize(s);
  render();
}, [render]));

useEffect(() => {
  const { width, height } = size;
  if (width <= 0 || height <= 0) return;
  // ... existing init + RAF body, with [reducedMotion, render, size.width, size.height] deps
}, [reducedMotion, render, size.width, size.height]);
```

Option B — separate "wait for size" from init, using a tiny effect that re-checks on every render and bails if particles are already initialized:

```tsx
const initializedRef = useRef(false);
useEffect(() => {
  if (initializedRef.current) return;
  const { width, height } = sizeRef.current;
  if (width <= 0 || height <= 0) return;
  initializedRef.current = true;
  // ... init + RAF body
});  // no deps array -- runs every render until size is known
```

Option A is the cleaner React-idiomatic fix and matches how `HiveCanvas` keys re-renders on `[layout, render]`. Whichever path is chosen, add a Playwright test that asserts `nonZeroPixels > 0` on the hydrated canvas after 3 seconds, so this defect cannot reach `main` again.

## Warnings

### WR-01: ESLint `react-hooks/immutability` errors break `pnpm lint`

**File:** `src/components/landing/BehavioralCanvas.tsx:114, 193`
**Issue:** `pnpm lint` exits 1 on `main` after this phase. Two errors are introduced by `BehavioralCanvas.tsx`:

```
  114:36  error  `sizeRef` accessed before it is declared
  193:9   error  `particlesRef` cannot be modified
                 (Modifying a value previously passed as an argument to a hook is not allowed)
```

The `eslint.config.mjs` global-ignore list covers `src/components/hive/**` (which is why the same patterns are tolerated there) but does **not** cover `src/components/landing/BehavioralCanvas.tsx`. The plan-02 summary's "ESLint clean" claim only ran lint against `BehavioralHero.tsx` and `button.tsx`, sidestepping the actual offender. CI / pre-commit lint gating is now red.

**Fix:** Either:
1. Move the `useCanvasResize(canvasRef, render)` call before the `render = useCallback(...)` declaration so `sizeRef` is in scope when `render` is created (requires reading `sizeRef.current` lazily, which the current code already does — only the lexical order needs to flip).
2. Restructure `render` to receive the size via closure parameter so the `useCallback` does not depend on a not-yet-declared variable.
3. Worst case, append `src/components/landing/BehavioralCanvas.tsx` to `eslint.config.mjs` ignore list (matches hive escape hatch). This is a band-aid; the immutability rule is correct that mutating `particlesRef.current[i].x = ...` is non-idiomatic React.

Note: fixing CR-01 likely fixes both errors simultaneously, since the rewrite will reorder and reshape these calls.

### WR-02: `gaussian()` can return `NaN` if `Math.random()` returns 0

**File:** `src/components/landing/BehavioralCanvas.tsx:85-90`
**Issue:** Box-Muller transform `Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random())`. `Math.random()` is documented as `[0, 1)`. If the first call returns exactly 0, `Math.log(0) = -Infinity`, `Math.sqrt(Infinity) = Infinity`, `Infinity * Math.cos(...)` = `Infinity` or `NaN`, and that value lands in `p.vx`/`p.vy`. Once a particle has `NaN` velocity, every subsequent frame propagates `NaN` through `p.x += p.vx * dt` and the particle disappears (`ctx.arc(NaN, NaN, ...)` is a no-op). Probability per call is ~1 / 2^53, but `gaussian()` is called `2 * particles * frames` times per page-view (~2 * 250 * 132 = 66k calls per session), so over a long enough horizon the bug is reachable.

**Fix:** Reject 0 with a tight loop:

```ts
function gaussian(): number {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}
```

### WR-03: Duplicate "87 percent" announcement to assistive tech

**File:** `src/components/landing/BehavioralHero.tsx:151-167` and `src/components/landing/BehavioralCanvas.tsx:251-258`
**Issue:** Both the canvas (`role="img"`, `aria-label="Audience particles aggregating into a confidence score of 87 percent"`) and the chip (`role="status"`, `aria-label="Predicted audience response confidence: 87%"`) carry self-describing aria-labels announcing the same 87 figure. A screen-reader pass over the hero region will announce "87 percent" twice with different phrasings, which is verbose and slightly contradicts the plan-04 stated goal of putting accessibility on the chip ("the canvas-2d text APIs are intentionally avoided so the chip stays accessible to assistive tech").

**Fix:** Make the canvas itself decorative since the chip carries the semantic value:

```tsx
<canvas
  ref={canvasRef}
  className={className}
  style={{ width: '100%', height: '100%', touchAction: 'none' }}
  aria-hidden="true"
/>
```

Drop `role="img"` and the aria-label entirely. The chip's `role="status"` + aria-label already covers SR users. Visual users see the particle motion. This also avoids the "Audience particles aggregating into a confidence score of 87 percent" string failing the future copy-lint guard if "audience" or "confidence" ever become banned vocab.

### WR-04: `aria-live="off"` neutralizes `role="status"` semantics on the chip

**File:** `src/components/landing/BehavioralHero.tsx:152-153`
**Issue:** `role="status"` is a live region that defaults to `aria-live="polite"`. Adding `aria-live="off"` explicitly turns the live-region behavior off, which means changes to the chip will not be announced. If the chip is intentionally static (per plan-04 "value is static after mount"), then `role="status"` is the wrong role; use a plain `<div aria-label="...">` or `<span>`. As written, the role + live combination is internally contradictory.

**Fix:**

```tsx
<div
  aria-label={`Predicted audience response confidence: ${CONFIDENCE_CHIP.label}`}
  className="..."
  // remove role="status" and aria-live="off"
>
  {CONFIDENCE_CHIP.label}
</div>
```

If WR-03 is also adopted (canvas is `aria-hidden`), this becomes the single accessible announcement of the 87 figure.

## Info

### IN-01: `useCanvasResize` typed `RefObject<CanvasSize>` but mutated as `MutableRefObject`

**File:** `src/components/hive/use-canvas-resize.ts:35,85` (NOT modified by this phase, but consumed by new `BehavioralCanvas.tsx`)
**Issue:** Out-of-scope to fix in this phase, but worth noting during cross-file review: `useCanvasResize` returns `React.RefObject<CanvasSize>` (read-only ref type) yet line 85 does `sizeRef.current = { ... }` which only typechecks because `RefObject.current` is mutable in React 19 types. Future React minor could tighten this. Pre-existing issue inherited by the new component.
**Fix:** Out of scope — leave for a `hive/` cleanup pass.

### IN-02: Test suite does not exercise rendered canvas output

**File:** `src/components/landing/__tests__/behavioral-hero-constants.test.ts:1-38`
**Issue:** All four `it()` blocks assert numeric invariants on the exported constants and `easeOutCubic` boundaries. None render `<BehavioralCanvas />` via `@testing-library/react` or simulate a `ResizeObserver` callback. This is exactly why CR-01 reached `main` undetected. The plan-02 RESEARCH.md SC2 (locked-invariant suite) is satisfied for tunables but offers zero protection against rendering regressions.
**Fix:** Add at least one Vitest + happy-dom (or jsdom) integration test that mounts `<BehavioralCanvas />`, mocks `ResizeObserver` to fire synchronously with non-zero dims, and asserts `particlesRef` is populated (or asserts `getImageData` non-transparency in a real-canvas test rig). Alternative: a Playwright smoke that runs in CI.

### IN-03: Magic number `0.12` for cluster radius lacks named constant

**File:** `src/components/landing/BehavioralCanvas.tsx:189`
**Issue:** `Math.min(width, height) * 0.12` — the `0.12` cluster-jitter fraction is hard-coded inline while every other tunable in the same file is exported via `PARTICLE_MOTION` for the Vitest invariant suite. RESEARCH §5 names this as a tunable but it's the only one that didn't make it into `behavioral-hero-constants.ts`.
**Fix:** Add `clusterRadiusFraction: 0.12` to `PARTICLE_MOTION` and reference it. Optionally add a Vitest invariant that the value is in `[0.05, 0.25]` to match the rest of the suite shape.

### IN-04: Branch comment refers to "use-hive-animation.ts:43" but verbatim equivalence is not guaranteed long-term

**File:** `src/components/landing/behavioral-hero-constants.ts:148-165`
**Issue:** JSDoc claims `easeOutCubic` is "verbatim source equivalent to the hive animation easing (use-hive-animation.ts:57)". Today both files contain `1 - Math.pow(1 - t, 3)` — identical. There's no automated check that future edits to either copy stay in sync. If the hive easing is ever tweaked (e.g. to `cubic-bezier(0.215, 0.61, 0.355, 1)` style), the comment becomes stale and a reader could be misled while debugging.
**Fix:** Either drop the "verbatim" wording (and the line-number reference, which is brittle) or import directly from a shared `src/lib/easings.ts` so divergence is impossible. Lowest-cost fix: change wording to "matches the cubic-out shape used elsewhere in the codebase".

---

_Reviewed: 2026-05-10T23:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Live verification: Playwright against `pnpm dev` on `/` -- canvas getImageData reports 0 non-transparent pixels in 5/5 scenarios (desktop, mobile, reduced-motion, post-resize, 8s wait)_
