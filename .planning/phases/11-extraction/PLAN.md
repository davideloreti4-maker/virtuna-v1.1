# Phase 11 Extraction — Replan

**Created:** 2026-01-30
**Based on:** EXTRACTION-PLAN.md (comprehensive spec)

## Problem with Current Implementation

The current scripts are plain TypeScript files run via `npx tsx`. The EXTRACTION-PLAN.md specifies **Playwright tests** with proper test structure (`test.describe`, `test()`).

Current issues:
1. No dark mode enforcement
2. Not using Playwright test framework
3. Incomplete coverage per EXTRACTION-PLAN.md
4. No video recording for flows
5. No GIF generation

---

## New Implementation Plan

### Test File Structure

**Note:** App is desktop-only (1440x900). No mobile viewport.

```
extraction/
├── tests/
│   ├── 01-dashboard.spec.ts       # Dashboard states & layout
│   ├── 02-society-selector.spec.ts # Society management
│   ├── 03-view-selector.spec.ts    # View dropdown
│   ├── 04-test-type-selector.spec.ts # All 11 test types
│   ├── 05-forms.spec.ts            # Form states
│   ├── 06-simulation.spec.ts       # Loading phases
│   ├── 07-results.spec.ts          # Results panel sections
│   ├── 08-history.spec.ts          # Test history
│   ├── 09-settings.spec.ts         # Settings tabs
│   ├── 10-modals.spec.ts           # All modals
│   └── 11-flows.spec.ts            # Detailed video recordings
├── fixtures/
│   └── auth.ts                     # Auth fixture with dark mode
├── playwright.config.ts            # Updated config
└── package.json scripts
```

### Wave 1: Infrastructure Update

**Files:**
- `extraction/playwright.config.ts` — Update for proper test dir, video recording
- `extraction/fixtures/auth.ts` — Auth fixture with dark mode injection
- `extraction/tests/helpers.ts` — Shared test helpers

### Wave 2: Core Tests (Parts 1-4)

**Files:**
- `extraction/tests/01-dashboard.spec.ts` — Dashboard states, app shell
- `extraction/tests/02-society-selector.spec.ts` — Society modal, create flow
- `extraction/tests/03-view-selector.spec.ts` — View dropdown submenus
- `extraction/tests/04-test-type-selector.spec.ts` — All 11 types

### Wave 3: Forms & Simulation (Parts 5-6)

**Files:**
- `extraction/tests/05-forms.spec.ts` — Content forms, survey form
- `extraction/tests/06-simulation.spec.ts` — Loading phases, states

### Wave 4: Results & History (Parts 7-8)

**Files:**
- `extraction/tests/07-results.spec.ts` — All results sections
- `extraction/tests/08-history.spec.ts` — History list, actions

### Wave 5: Settings & Modals (Parts 9-10)

**Files:**
- `extraction/tests/09-settings.spec.ts` — All settings tabs
- `extraction/tests/10-modals.spec.ts` — Feedback, delete, etc.

### Wave 6: Detailed Flows (Part 12)

**Files:**
- `extraction/tests/11-flows.spec.ts` — 6 detailed flow videos with scene breakdowns

---

## Execution Order

1. **PLAN-01**: Infrastructure — Config, fixtures, helpers
2. **PLAN-02**: Dashboard & Selectors — Parts 1-4
3. **PLAN-03**: Forms & Simulation — Parts 5-6
4. **PLAN-04**: Results & History — Parts 7-8
5. **PLAN-05**: Settings & Modals — Parts 9-10
6. **PLAN-06**: Detailed Flows & GIFs — Part 12 + post-processing

---

## Key Changes from Current

| Aspect | Current | New |
|--------|---------|-----|
| Structure | Plain scripts | Playwright test files |
| Dark mode | Missing | Injected via fixture |
| Video | Not implemented | 6 detailed flow videos |
| Execution | `npx tsx script.ts` | `npx playwright test` |
| Viewport | Desktop + Mobile | Desktop only (1440x900) |
| Reports | Console only | HTML + JSON reports |

---

## Commands

```bash
# Run all extraction tests
pnpm extraction:all

# Run specific test file
npx playwright test tests/01-dashboard.spec.ts

# Run with UI mode for debugging
pnpm extraction:ui

# Generate GIFs from videos
pnpm extraction:gifs

# View report
pnpm extraction:report
```

---

*Replan created: 2026-01-30*
*Ready for PLAN-01 execution*
