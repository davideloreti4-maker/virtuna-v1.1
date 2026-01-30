# Phase 11 Extraction Replan Summary

**Date:** 2026-01-30
**Status:** Ready for execution

## What Changed

The Phase 11 extraction was replanned to convert from **plain TypeScript scripts** to **proper Playwright test files** based on EXTRACTION-PLAN.md.

### Previous Implementation (Old PLAN files 11-01 through 11-04)

- Used `npx tsx extraction/scripts/*.ts` scripts
- No dark mode enforcement
- Limited coverage
- No proper test framework structure
- Basic screenshot capture only

### New Implementation (PLAN-01 through PLAN-06)

- Uses `@playwright/test` framework with `test.describe`/`test()` syntax
- Dark mode forced via CSS injection and color scheme emulation
- Comprehensive coverage matching EXTRACTION-PLAN.md (12 parts)
- Video recording for user flows
- GIF generation post-processing
- Both desktop (1440x900) and mobile (375x812) viewports

## New Plan Structure

| Plan | Wave | Content |
|------|------|---------|
| PLAN-01 | 1 | Infrastructure: config, fixtures, helpers |
| PLAN-02 | 2 | Dashboard & Selectors (Parts 1-4) |
| PLAN-03 | 3 | Forms & Simulation (Parts 5-6) |
| PLAN-04 | 4 | Results & History (Parts 7-8) |
| PLAN-05 | 5 | Settings & Modals (Parts 9-10) |
| PLAN-06 | 6 | Mobile & Flows (Parts 11-12) |

## File Changes

### To Create

```
extraction/
├── fixtures/
│   └── auth.ts              # Auth fixture with dark mode
├── tests/
│   ├── helpers.ts           # Shared test helpers
│   ├── auth.setup.ts        # Manual login setup
│   ├── 01-dashboard.spec.ts
│   ├── 02-society-selector.spec.ts
│   ├── 03-view-selector.spec.ts
│   ├── 04-test-type-selector.spec.ts
│   ├── 05-forms.spec.ts
│   ├── 06-simulation.spec.ts
│   ├── 07-results.spec.ts
│   ├── 08-history.spec.ts
│   ├── 09-settings.spec.ts
│   ├── 10-modals.spec.ts
│   ├── 11-mobile.spec.ts
│   └── 12-flows.spec.ts
└── scripts/
    └── generate-gifs.ts     # Post-process videos to GIFs
```

### To Update

- `extraction/playwright.config.ts` — Test directory, dark mode, video options
- `extraction/.gitignore` — Report artifacts
- `package.json` — New scripts

## Execution Commands

```bash
# 1. Setup auth (manual login)
pnpm extraction:auth

# 2. Run all tests
pnpm extraction:all

# 3. Run specific test file
npx playwright test tests/01-dashboard.spec.ts

# 4. Debug with UI mode
pnpm extraction:ui

# 5. Generate GIFs from videos
pnpm extraction:gifs

# 6. View report
pnpm extraction:report
```

**Note:** App is desktop-only (1440x900). Mobile viewport tests removed.

## Old Files (Can Be Archived)

The following old PLAN files are superseded:
- `11-01-PLAN.md` → Infrastructure setup (now PLAN-01)
- `11-02-PLAN.md` → Dashboard capture
- `11-03-PLAN.md` → Selectors
- `11-04-PLAN.md` → Remaining captures

These can be moved to `.planning/phases/11-extraction/archive/` if needed.

## Next Steps

1. Execute PLAN-01 to set up infrastructure
2. Run auth setup to save login session
3. Execute PLAN-02 through PLAN-06 sequentially
4. Run GIF generation after videos captured
5. Verify output matches EXTRACTION-PLAN.md spec

---

*Replan completed: 2026-01-30*
