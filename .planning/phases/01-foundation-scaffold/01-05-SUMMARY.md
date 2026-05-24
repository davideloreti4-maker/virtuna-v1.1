---
phase: 01-foundation-scaffold
plan: "05"
subsystem: ui-scaffold
tags: [next-app-router, server-components, motion, motion-config, react, accessibility, seo, metadata]

# Dependency graph
requires:
  - "01-01 (marketing layout fragment, motionTokens.ts)"
  - "01-02 (SectionShell, GrainOverlay, SkipToContent)"
  - "01-03 (LandingHeader)"
  - "01-04 (sitemap.ts, robots.ts)"
provides:
  - "src/app/(marketing)/v3/page.tsx — /v3 staging route assembling 9 SectionShell placeholders (FOUND-01)"
  - "src/app/(marketing)/v3/MotionRoot.tsx — client wrapper around MotionConfig reducedMotion=user (FOUND-09)"
affects: [11-cutover, all-phases-2-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server page.tsx + client MotionRoot.tsx split: server component exports metadata while client child wraps motion primitives — no 'use client' needed on the page itself"
    - "DOM order for a11y: SkipToContent → GrainOverlay → LandingHeader → main#main-content ensures Tab key hits skip link before any other focusable element"
    - "MotionConfig reducedMotion='user' wraps only SectionShell children — structural components (Header, GrainOverlay) excluded (no motion behavior needed)"
    - "pt-16 main offset: compensates for 64px fixed LandingHeader so first section content is not hidden under the nav"

key-files:
  created:
    - src/app/(marketing)/v3/page.tsx
    - src/app/(marketing)/v3/MotionRoot.tsx
  modified:
    - src/app/(marketing)/layout.tsx

key-decisions:
  - "Removed old Header import from (marketing)/layout.tsx (Rule 1 bug fix): the layout was wrapping /v3 with the Artificial Societies branding header, inserting a duplicate nav above LandingHeader. Fixed to pure fragment — each page manages its own navigation. This unblocked correct /v3 rendering."
  - "Single-quote 'use client' in MotionRoot.tsx: Next.js accepts both single and double quote syntax for directive strings. Build confirmed MotionRoot compiled as client component and /v3 as static server-rendered page."
  - "FOUND-05 collision-check decision documented in page.tsx JSDoc: marquee.tsx and useCountUp.ts exist in codebase — Magic UI Marquee and NumberTicker deferred to Phase 9+ to avoid collision."
  - "Canonical URL set to https://virtuna.ai/ (not /v3): /v3 is a staging route; search engines should index the production root, not the staging path. Phase 11 cutover replaces root page.tsx with v3 content."

# Metrics
duration: ~15min
completed: 2026-05-24
---

# Phase 01 Plan 05: /v3 Route Assembly Summary

**/v3 staging route assembled: MotionRoot client wrapper + server page.tsx rendering 9 SectionShell placeholders in narrative order under MotionConfig reducedMotion="user", with locked page title and OG metadata, skip-to-content wiring, and FOUND-05 collision-check documentation.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-05-24
- **Tasks:** 3 of 3
- **Files created:** 2 (MotionRoot.tsx, page.tsx)
- **Files modified:** 1 (marketing layout — bug fix)

## Accomplishments

- `MotionRoot.tsx` created as `'use client'` wrapper importing `MotionConfig` from `motion/react` (NOT framer-motion); `reducedMotion="user"` provides single OS kill-switch for all landing motion (FOUND-09)
- `/v3/page.tsx` server component exports `metadata` with locked title "Virtuna | Predict viral before you post", OG/Twitter mirrors, and canonical `https://virtuna.ai/` pointing to production root (not staging)
- All 9 SectionShell instances rendered in narrative order: hero → demo → how-it-works → surfaces → comparison → science → social-proof → pricing → final-cta with correct variant/isHero/shipsInPhase mapping
- DOM order: `<SkipToContent />` first (WCAG Tab-order), `<GrainOverlay />` decorative, `<LandingHeader />` fixed-top, `<main id="main-content" className="pt-16">` wraps MotionRoot + 9 sections
- FOUND-05 collision-check documented in JSDoc: no Magic UI Marquee or NumberTicker installed in Phase 1
- `pnpm build` succeeds; `/v3` compiled as static route with correct HTML (verified via `.next/server/app/v3.html`)
- Dev server smoke-test: `curl /v3` returns all 9 section IDs, lang="en", title, 0 "Artificial Societies" residue

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| Task 1 | Create MotionRoot.tsx client wrapper | `8ba2483` |
| Task 2 | Create /v3 page.tsx server route | `3c90a67` |
| Task 3 (+ Rule 1 fix) | Smoke test + remove old Header from marketing layout | `a843481` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed old Header from (marketing)/layout.tsx**
- **Found during:** Task 3 (dev server smoke test)
- **Issue:** `src/app/(marketing)/layout.tsx` was importing `Header` from `@/components/layout/header` (the legacy "Artificial Societies" branded header). This layout wraps ALL routes in the `(marketing)` group including `/v3`, causing the old header to render above LandingHeader. The rendered HTML contained "Artificial Societies" text and double-stacked navigation.
- **Fix:** Replaced layout.tsx with a pure fragment (`return <>{children}</>`) matching the Plan 01 documented intent ("slim fragment" pattern). Each page in the group now manages its own navigation.
- **Files modified:** `src/app/(marketing)/layout.tsx`
- **Commit:** `a843481`

## Self-Check: PASSED

All files exist:
- `src/app/(marketing)/v3/page.tsx` — FOUND
- `src/app/(marketing)/v3/MotionRoot.tsx` — FOUND
- `src/app/(marketing)/layout.tsx` — modified (FOUND)

All commits exist:
- `8ba2483` — FOUND
- `3c90a67` — FOUND
- `a843481` — FOUND

Build verification:
- `pnpm build` succeeded; `/v3` listed as static `○` route
- `.next/server/app/v3.html` exists with correct title and 9 section IDs

Runtime verification (dev server):
- Title: "Virtuna | Predict viral before you post" (2 occurrences — title + OG meta)
- lang="en": present
- All 9 section IDs: OK
- "Artificial Societies": 0 occurrences
- No hydration errors or React warnings in dev log
- sitemap.xml: 3 virtuna.ai entries
- robots.txt: `Allow: /` present

Static checks:
- `grep -c 'Artificial Societies' v3/page.tsx` = 0
- `grep -c 'id="main-content"' v3/page.tsx` = 1
- `grep -c '"use client"' v3/page.tsx` = 0 (server component)
- `grep -c 'from "motion/react"' MotionRoot.tsx` = 1
- `grep -c 'reducedMotion="user"' MotionRoot.tsx` = 1
- FOUND-05: @magicui/marquee = 0, @magicui/number-ticker = 0
- lang="en" in root layout = 1
