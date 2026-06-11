---
phase: "01"
plan: "04"
subsystem: design-system
tags: [showcase, a11y, serif, glass, deployed-build, DS-04, DS-05, DS-07, DS-08]
dependency_graph:
  requires: [01-01, 01-02, 01-03, 01-05]
  provides: [deployed-kit-showcase, serif-voice-locked, DS-05-proof, DS-08-structural-guard]
  affects: [phase-02-reading-components]
tech_stack:
  added:
    - "tests/**/*.test.tsx glob in vitest.config.ts (was tests/**/*.test.ts only)"
  patterns:
    - "next/font/google mock — explicit named-export map, not a catch-all Proxy (thenable Proxy hangs await import)"
    - "(kit) route group parallel to (marketing) — keeps showcase separate per D-01"
    - "second next/font/google instance (Newsreader --font-serif-alt) scoped to single page"
    - "client island pattern: KitStageDemo splits StageBlock interactivity from server page"
key_files:
  created:
    - src/app/(kit)/numen-kit/page.tsx
    - src/app/(kit)/numen-kit/stage-demo.tsx
    - tests/numen/showcase.a11y.test.tsx
  modified:
    - vitest.config.ts
decisions:
  - "Serif voice pick: Source Serif 4 (confirmed on deployed prod build via Playwright; Newsreader specimened side-by-side and rejected; layout.tsx unchanged)"
  - "DS-05 proof: Glass backdrop-filter:blur(12px) LIVE on deployed build — Lightning CSS did NOT strip the inline-style form (confirmed Playwright 2026-06-11)"
  - "next/font/google mock must be an explicit named-export object — a catch-all Proxy returns a function for `then`, making the mocked module thenable and hanging await import() forever"
  - "vitest.config.ts include glob extended to tests/**/*.test.tsx (Rule 3 blocking fix — plan-mandated .tsx test could not run)"
metrics:
  duration: "~150 min (including Playwright-assisted deployed-build human checkpoint)"
  completed: "2026-06-11"
  tasks_completed: 3
  files_created: 4
---

# Phase 01 Plan 04: Kit Showcase Route + Deployed-Build Verification Summary

**One-liner:** Kit showcase at `/numen-kit` proves all Numen primitives + Glass blur(12px) survive the production Lightning CSS pass; Source Serif 4 locked as the voice serif; all DS-04/05/07/08 criteria verified on deployed build.

## What Was Built

### Task 1 — Kit showcase route + a11y test (commit dc41e526)

`src/app/(kit)/numen-kit/page.tsx` — server component under the `(kit)` route group (parallel to `(marketing)/primitives-showcase`, separate per D-01). Root wrapper `<div className="numen-surface dark min-h-screen bg-bg ...">` so all eight primitives resolve against live warm tokens.

Sections built:

1. **Token swatch grid** — `bg-bg / bg-panel / bg-panel-2 / text / text-muted / accent` with hex labels; proves no pure black, warm-neutral.
2. **Verdict scale** — all three `VerdictSwatch` (good/mixed/bad) with labels; muted, calm, amber "mixed" first-class.
3. **Surface + Glass** — `Surface` card beside a `Glass` panel over a cool-toned keyframe background; the Glass is the D-05 deployed-build blur check.
4. **Tool chips** — `PillChip` in `instant` (×2) and `agentic` (×2) intents; visually distinct.
5. **Icon buttons** — three `IconButton`s with Lucide icons; 44px hit-area confirmed.
6. **Serif specimen (D-13)** — Source Serif 4 vs Newsreader side-by-side at 28px/600 on `#1a1714` for the voice pick. Newsreader wired via a second `next/font/google` instance (`--font-serif-alt`) scoped to this page only.
7. **Stage-reveal demo (DS-07)** — `KitStageDemo` client island toggles a `StageBlock`; reduced-motion note included.
8. **Keyframe-as-chroma panel (DS-08)** — `data-testid="ds08-keyframe-chroma"`: sample cool-toned SVG keyframe directly adjacent to a near-neutral `bg-panel / border-border` chrome container; the keyframe carries the chroma, the chrome recedes.

`src/app/(kit)/numen-kit/stage-demo.tsx` — client island (`"use client"`, `useState`) that owns the toggle state and renders `StageBlock`. Keeps the page as a server component.

`tests/numen/showcase.a11y.test.tsx` (`@vitest-environment happy-dom`):
- Non-conditional `vi.mock("next/font/google", ...)` — explicit named-export map (`{ Inter, Source_Serif_4, Newsreader }`), each returning `fontStub()` with `className`/`variable`/`style`.
- **axe test** — renders the page, asserts `axe(container)` has no violations. ✅ GREEN.
- **DS-08 structural guard** — queries `[data-testid="ds08-keyframe-chroma"]`, asserts: present, contains `img[alt]`, and the keyframe image shares a flex-row parent with a `.bg-panel.border-border` chrome sibling. Cheap, non-perceptual; the perceptual gate is the Task 3 human checkpoint. ✅ GREEN.

`vitest.config.ts` — added `tests/**/*.test.tsx` to the `include` glob (Rule 3 fix — see Deviations).

### Task 2 — Full-suite + APCA + production build gate (no separate commit — no source changed)

All three gates run and pass after Task 1:

- `pnpm test` → EXIT 0: 1938 passed, 26 skipped, 0 failed across 185 files (including `tests/numen/showcase.a11y.test.tsx` 2/2).
- `pnpm tsx scripts/check-apca.ts` → EXIT 0: body 94.1 / muted 60.1 / accent 48.5 / verdict-good 51.4 / verdict-mixed 58.2 / verdict-bad 46.7 — all meet targets.
- `pnpm build` → EXIT 0: `/numen-kit` prerendered static (`○`); Lightning CSS pass ran.

### Task 3 — Deployed-build human checkpoint (APPROVED 2026-06-11)

User verified `/numen-kit` on the production build via `pnpm start` + Playwright. All 7 checkpoints PASS:

| Checkpoint | Result |
|-----------|--------|
| Glass blur (DS-05) | `backdrop-filter: blur(12px)` LIVE — Lightning CSS did NOT strip the inline-style form |
| Warm tokens / no pure black (DS-01) | `bg-bg` resolves `rgb(26,23,20)` = `#1a1714`; no pure black; chrome warm-neutral |
| Verdict scale (DS-02) | good `#7faf7a` / mixed `#d6a85a` / bad `#d4866f` / accent `#d98a5e` — muted, calm |
| Serif pick (DS-04) | **Source Serif 4 confirmed** as voice serif; Newsreader specimened and not chosen; `layout.tsx` unchanged |
| Keyframe-chroma (DS-08) | Keyframe carries color/energy; chrome recedes |
| Stage-reveal (DS-07) | Toggle calm (no bounce); reduced-motion degrades to static appear |
| No AI-spaceship FX (D-07) | 0 console errors; no neon/gradient/beam/glow/shimmer |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking config] `tests/**/*.test.tsx` missing from vitest include glob**

- **Found during:** Task 1 verification (test ran `pnpm vitest run tests/numen/showcase.a11y.test.tsx` → `PASS (0)` — zero tests collected).
- **Issue:** `vitest.config.ts` include list was `["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"]` — no `.tsx` extension for the `tests/` directory. The plan-mandated `tests/numen/showcase.a11y.test.tsx` could not run.
- **Fix:** Added `"tests/**/*.test.tsx"` to the include array.
- **Files modified:** `vitest.config.ts`
- **Committed with Task 1:** `dc41e526`

**2. [Rule 1 — Bug] `next/font/google` Proxy mock hung `await import()`**

- **Found during:** Task 1 (showcase test run hung at module-load phase for >60s).
- **Issue:** Initial mock used `new Proxy({}, { get: () => fontStub })`. A Proxy that returns a function for every property access also returns one for `then` — making the mocked module thenable. `await import("next/font/google")` therefore tried to chain on the fake `then` and hung forever.
- **Fix:** Replaced the catch-all Proxy with an explicit map `{ Inter: fontStub, Source_Serif_4: fontStub, Newsreader: fontStub }` — no `then` property, no hang.
- **Files modified:** `tests/numen/showcase.a11y.test.tsx`
- **Committed with Task 1:** `dc41e526`

## Known Stubs

None — showcase uses an inline SVG data-URI as the sample keyframe (self-contained, no real user data, intentional placeholder for the kit showcase). Clearly labelled in source. Later phases replace with real video thumbnails when the Reading thread ships.

## Threat Surface Scan

No new trust-boundary surfaces: the showcase route is a static server component (`○`) with no user input, no auth paths, no API calls, no file access. T-04-02 (`accept` disposition) confirmed — no new threats.

## Self-Check: PASSED

- `src/app/(kit)/numen-kit/page.tsx` — FOUND
- `src/app/(kit)/numen-kit/stage-demo.tsx` — FOUND
- `tests/numen/showcase.a11y.test.tsx` — FOUND
- Task 1 commit `dc41e526` — FOUND (git log confirmed)
- `pnpm test` 1938 passed — CONFIRMED
- `pnpm tsx scripts/check-apca.ts` EXIT 0 — CONFIRMED
- `pnpm build` EXIT 0 — CONFIRMED
- Deployed-build checkpoint APPROVED — CONFIRMED
