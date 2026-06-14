---
phase: 01-foundation-shell
plan: 05
subsystem: ui
tags: [footer, nav, flat-warm, server-component, react, nextjs, numen-logo, vitest, happy-dom]

# Dependency graph
requires:
  - phase: 01-foundation-shell (01-01)
    provides: flat-warm @theme token port (charcoal/cream/terracotta), Newsreader wiring, route mount + (marketing)/page.tsx skeleton that mounts <Footer/>
  - phase: 01-foundation-shell (01-04)
    provides: <Header/> NAV_LINKS anchor set (#how-it-works/#the-simulation/#pricing/#faq) that the footer mirrors
provides:
  - Flat-warm compact 3-column <Footer/> (brand + tagline, product anchors, legal/social placeholders) replacing the old plagiarized societies footer
  - NAV-02 satisfied — brand, in-page section links mirroring the nav, legal/social stub links
  - happy-dom unit coverage for the footer contract
affects: [02-the-simulation, 04-proof-convert, 05-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Footer is a STATIC server component (no use client) — anchors + placeholder stub links only"
    - "Footer product-link set is a const array mirroring header.tsx NAV_LINKS (single nav-anchor SSOT per surface)"
    - "Legal/social placeholders are labelled href='#' stubs (D-22) — swappable, human fills real targets later"

key-files:
  created:
    - src/components/layout/__tests__/footer.test.tsx
  modified:
    - src/components/layout/footer.tsx

key-decisions:
  - "Footer kept as a static server component (no use client) — flat tone-step surface (#1a1a18) + hairline TOP border, no glass/gradient/shine"
  - "Tagline = 'Know if it'll pop before you post.' (UI-SPEC suggested copy, kept verbatim — one line, sentence case, hybrid voice)"
  - "Brand wraps NumenLogo in text-foreground so the mark inherits cream via currentColor (matches header pattern)"

patterns-established:
  - "Footer mirrors the header nav anchors via a parallel const array — both surfaces point at the same scroll-skeleton section ids"
  - "Placeholder legal/social links use href='#' stubs with labelled text (Privacy/Terms/X/TikTok), ready for one-line swap"

requirements-completed: [NAV-02]

# Metrics
duration: 4min
completed: 2026-06-14
---

# Phase 01 Plan 05: Footer Chrome Summary

**Flat-warm compact 3-column `<Footer/>` (NumenLogo + tagline · product anchors mirroring the header nav · Privacy/Terms/X/TikTok placeholder stubs), rebuilt from scratch on flat-warm and fully de-societies'd — satisfies NAV-02.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-14T18:30:06Z
- **Completed:** 2026-06-14T18:33:57Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 rewritten)

## Accomplishments
- NAV-02 footer: Numen brand (NumenLogo + one-line tagline), a "Product" column of in-page anchors mirroring the header nav, and "Legal" + "Social" placeholder stub columns (Privacy/Terms/X/TikTok).
- Stripped the entire old plagiarized "Artificial Societies" footer (calendly CTA, founders@societies.io, LinkedIn societies.io, "Subprocessors", phosphor SSR icons) — replaced wholesale (D-22).
- Footer remains a static server component on the flat-warm theme: tone-step surface, hairline top border, no glass/gradient/shine; cream-secondary links, cream-muted fine print.
- happy-dom unit test encodes the NAV-02 contract (brand present + societies absent, anchor mirror, legal/social labels) — RED → GREEN.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Wave-0 failing footer test (NAV-02)** - `7f07dc65` (test)
2. **Task 2: Rebuild footer.tsx flat-warm — GREEN** - `a9acc6b0` (feat)

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

## Files Created/Modified
- `src/components/layout/footer.tsx` - Rewritten wholesale: flat-warm static-server `<Footer/>` — brand (NumenLogo + tagline), product anchors (header-nav mirror), legal/social placeholder stubs. All societies content removed.
- `src/components/layout/__tests__/footer.test.tsx` - New happy-dom unit test covering NAV-02 (brand present + "Artificial Societies" absent, `#how-it-works`/`#the-simulation`/`#pricing`/`#faq` anchor mirror, Privacy/Terms/X/TikTok labels).

## Decisions Made
- **Tagline kept verbatim** from the UI-SPEC suggestion ("Know if it'll pop before you post.") — one line, sentence case, "Simulation"-aligned hybrid voice; no refinement needed.
- **Surface = `bg-background-elevated` (#1a1a18)** (the secondary tone-step, same as the header bar) with a hairline TOP border — keeps header/footer chrome visually consistent.
- **Column layout:** 3 logical columns (Brand / Product / Legal+Social), with Legal and Social as sub-stacks inside the third column on desktop; collapses to a single column on mobile (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded JSDoc so the plan's literal negative-grep verify passes**
- **Found during:** Task 2 (footer rebuild — GREEN)
- **Issue:** The Task-2 verify command negatively greps the source for `Artificial Societies|societies.io|calendly|Subprocessors|use client`. My initial JSDoc *described* the stripped content ("no calendly, no founders@societies.io … no 'Subprocessors' … no 'use client'"), so the grep matched my own comment prose and the as-written verify failed — even though the rendered footer carries none of that content (unit test was already GREEN, 10/10).
- **Fix:** Reworded the two JSDoc comment blocks to convey the same intent ("every trace of the old plagiarized footer is gone", "no booking CTA, no email, no external brand links, no phosphor SSR icons"; "static chrome only"; "target blank") without echoing the forbidden literals. No behavior change — comments only.
- **Files modified:** src/components/layout/footer.tsx
- **Verification:** Re-ran the Task-2 verify command verbatim → `GREEN`. Scoped vitest still 10/10. `npx eslint` on the file → No issues found.
- **Committed in:** `a9acc6b0` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — comment-only, no behavior change)
**Impact on plan:** Cosmetic. The fix only makes the as-written verify command pass; the footer's behavior, structure, and the NAV-02 contract are exactly as planned. No scope creep.

## Issues Encountered
None — planned work executed as written. (The forbidden-literal-in-comment collision above is documented as a deviation, not a problem during planned work.)

## Known Stubs
The footer's legal/social links are **intentional placeholders** (`href="#"`), explicitly specified by CONTEXT D-22 and the UI-SPEC Copywriting Contract ("placeholder links … labelled, swappable"). These are NOT goal-blocking stubs — NAV-02 requires *placeholders*, and the human fills real Privacy/Terms/X/TikTok targets later (real-asset integration pass is deferred to v2, EXPND-02). No data is stubbed; the footer is static chrome.

## Verification
- `pnpm vitest run src/components/layout/__tests__/footer.test.tsx` → GREEN (10/10).
- `pnpm vitest run src/components/marketing src/components/layout` → 27/27 PASS (wave-merge scoped run).
- `pnpm build` (`next build`, includes type-check) → `✓ Compiled successfully in 11.2s`; `/`, `/pricing` (both import `Footer`) compile clean.
- `npx eslint` on the two changed files → No issues found. (Repo-wide lint has 58 pre-existing errors / 68 warnings in unrelated files — out of scope, not introduced here.)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 (Foundation & Shell) NAV-02 chrome is complete: header (01-04) + footer (01-05) both flat-warm, both mirroring the same scroll-skeleton anchor set.
- Footer anchors point at `#how-it-works`/`#the-simulation`/`#pricing`/`#faq` — Phases 2–4 must ensure the corresponding section `id`s exist on the assembled `/` (01-01 skeleton already carries them).
- Plan 01-03 (MotionConfig + CSS reduced-motion, FOUND-04) remains the only outstanding Phase-1 plan.
- No blockers. The `href="#"` legal/social stubs await real targets (deferred to v2 EXPND-02).

## Self-Check

- FOUND: src/components/layout/footer.tsx
- FOUND: src/components/layout/__tests__/footer.test.tsx
- FOUND: commit 7f07dc65 (test)
- FOUND: commit a9acc6b0 (feat)

## Self-Check: PASSED

---
*Phase: 01-foundation-shell*
*Completed: 2026-06-14*
