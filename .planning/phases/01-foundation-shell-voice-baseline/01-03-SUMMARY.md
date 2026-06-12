---
phase: 01-foundation-shell-voice-baseline
plan: 03
subsystem: marketing-route-composition
tags: [layout, page, og, numen-surface, scope-mount, a11y, anti-snake-oil, wave-2]
requires:
  - "Nav @/components/numen-landing/nav (Plan 02)"
  - "Footer @/components/numen-landing/footer (Plan 02)"
  - "SectionShell @/components/numen-landing/section-shell (Plan 02)"
  - ".numen-surface bridged token scope (globals.css:356-392)"
  - ".planning/VOICE.md voice baseline (Plan 01)"
provides:
  - "Valid no-html marketing layout mounting the .numen-surface scope on one wrapper div (Option B / D-02)"
  - "Composed seven kero-ordered SectionShell slots with a single hero <h1> (D-10)"
  - "De-hyped in-voice marketing metadata + OG card copy (D-08 / D-11 / CONTENT-01)"
affects:
  - "Phase 2 (fills hero/how-it-works slot children — real Reading)"
  - "Phase 3 (fills honesty/gallery/proof/cta slots)"
  - "Phase 4 (OG art redesign + final token swap)"
tech-stack:
  added: []
  patterns:
    - "No-html passthrough layout (Option B): scope mounts on a marketing wrapper div, root body untouched"
    - "@theme inline scope resolution: bridged bg-bg/text-text resolve only under the .numen-surface ancestor"
    - "Single-h1 contract: hero renders explicit <h1> (no heading= prop); non-hero slots use heading= → <h2>"
    - "SectionShell heading made optional to support the h1-only hero slot"
key-files:
  created: []
  modified:
    - "src/app/(marketing)/layout.tsx"
    - "src/app/(marketing)/page.tsx"
    - "src/app/(marketing)/opengraph-image.tsx"
    - "src/components/numen-landing/section-shell.tsx"
    - ".planning/phases/01-foundation-shell-voice-baseline/deferred-items.md"
decisions:
  - "D-02 / Option B honored: .numen-surface mounts on the marketing layout wrapper div; root body stays scope-free"
  - "SectionShell heading prop made optional (Rule 3 unblock) so the hero renders an explicit h1 with no internal h2 — keeps exactly one h1, no level skip"
  - "CTA label 'Try Numen' reused in the hero, consistent with Plan 02 nav/footer"
  - "OG card art/colors left untouched (copy-only de-hype); full OG redesign + token swap deferred to Phase 4"
metrics:
  duration: "~7m"
  completed: "2026-06-12"
  tasks: 3
  files: 5
requirements: [DS-01, DS-02, NAV-01, CONTENT-01, MOT-02, PERF-02]
---

# Phase 01 Plan 03: Shell Composition + Scope Mount Summary

Wired the Wave-1 shell + voice deliverables into the live marketing route: converted `(marketing)/layout.tsx` from the invalid dual-`<html>` stale state into a no-html passthrough whose single wrapper `<div>` mounts the `.numen-surface` token scope (Option B / D-02) around one Nav / one `<main>` / one Footer; rebuilt `(marketing)/page.tsx` to compose the seven kero-ordered `SectionShell` slots with exactly one hero `<h1>`; and de-hyped the live OG card copy. `npm run build` green.

## What Shipped

### Task 1 — Marketing layout → no-html `.numen-surface` passthrough (`src/app/(marketing)/layout.tsx`)
- Removed the second `<html lang="en"><body>`, the local `Inter()` re-import, and the stale `@/components/layout/header` `Header` import + "Artificial Societies" metadata.
- Renders a single top-level wrapper `<div className="numen-surface min-h-screen bg-bg text-text">` — the ONE place the warm-neutral scope mounts — around `<Nav />`, `<main>{children}</main>`, `<Footer />` in order (exactly one of each landmark).
- Exports the in-voice `metadata` override: title `Numen — an honest verdict on your content, before you post`, description `Numen reads your video like your sharpest audience would and gives you an honest verdict you can act on. No hype score.`
- Root `src/app/layout.tsx` confirmed scope-free (`grep -q 'numen-surface' src/app/layout.tsx` → no match) — Option B asserted.
- **Commit:** `76077b31`

### Task 2 — Page → ordered `SectionShell` composition with single hero `<h1>` (`src/app/(marketing)/page.tsx`)
- Replaced the stale `@/components/landing` barrel + `@/components/layout/footer` imports (orphaned per D-04; Footer now lives in the layout).
- Hero `<SectionShell id="hero" className="pt-28 pb-24 md:pt-40 md:pb-32">` with NO `heading=` prop renders an explicit `<h1>` ("Know if your content will land — before you post.") + subhead + a `href="#cta"` `Try Numen` CTA.
- Five non-hero slots use `heading=` → SectionShell's internal `<h2>`, locked id order: `how-it-works`, `honesty`, `gallery`, `proof`, `cta`. Exactly one `<h1>` on the page, no heading-level skip; nav/footer anchors resolve to real on-page ids.
- **Commit:** `f2fd176d`

### Task 3 — De-hype OG card copy (`src/app/(marketing)/opengraph-image.tsx`)
- `alt` → `Numen — an honest verdict on your content, before you post`.
- Tagline → `An honest verdict on your content — before you post.`
- Subtitle → `Numen reads your video like your sharpest audience would and gives you a verdict you can act on.`
- SVG mark, dimensions, `runtime`, `size`, `contentType`, and colors untouched (art redesign is Phase 4 / D-11).
- **Commits:** `518c6250` (OG copy edit, auto-wip hook — see Deviations) + `00c62bc1` (deferred-items log + commit message).

## Verification

| Gate | Result |
|------|--------|
| `(marketing)/layout.tsx` no `<html>` / no `<body>` | confirmed (0 / 0 in JSX) |
| `grep -q 'numen-surface' "(marketing)/layout.tsx"` | match (scope mounts here) |
| `grep -q 'numen-surface' src/app/layout.tsx` | NO match (Option B — root body scope-free) |
| no `Artificial Societies` / `components/layout/header` in layout | confirmed gone |
| imports `numen-landing/nav` + renders `<main>` | confirmed |
| `(marketing)/page.tsx` single `<h1>` | `grep -c '<h1'` = 1 |
| ordered ids hero→how-it-works→honesty→gallery→proof→cta | confirmed |
| no `@/components/landing` barrel import on page | confirmed orphaned |
| OG image hype-free (`go viral\|predict\|AI-powered\|virality\|% accuracy`) | no matches |
| three in-scope files hype-free | all clean |
| `npx tsc --noEmit` on the 4 changed source files | clean (no errors in changed files) |
| `eslint` on each changed file | exit 0, no issues |
| `npm run build` | ✓ Compiled successfully; 55/55 static pages; `/` + `/opengraph-image` routes present; dual-html bug gone |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Made `SectionShell` `heading` prop optional**
- **Found during:** Task 1 / Task 2 (the hero slot requires an h1-only section with no internal h2).
- **Issue:** As shipped in Plan 02, `SectionShell` declared `heading: string` (required) and ALWAYS rendered an internal `<h2>`. The plan's hero contract requires the hero to pass NO `heading=` and render its own explicit `<h1>` child — impossible with a required-heading component that force-emits an h2 (would produce a duplicate/extra heading and break the single-h1 gate). The plan's own `<interfaces>` note already describes the intended behavior: "when `heading` is passed it renders an internal `<h2>`" (i.e. conditional).
- **Fix:** Changed `heading?: string` (optional) and wrapped the `<h2>` in `{heading ? (…) : null}`. Non-hero slots unchanged; hero now renders only its explicit `<h1>` child.
- **Files modified:** `src/components/numen-landing/section-shell.tsx`
- **Commit:** `76077b31` (with Task 1).

### Tooling / hook behavior (not a code deviation)

**2. Repo `chore(auto-wip)` post-commit hook split the OG image edit into its own commit**
- **Observed during:** Task 3 commit. The Task 3 OG copy edit landed in `518c6250` (`chore(auto-wip): ui — opengraph-image.tsx`) — the repo's auto-wip/post-commit hook committed the file between the Write and the explicit `git add`. My follow-up `00c62bc1` then carried the deferred-items log + the descriptive Task 3 message. Net: the de-hyped OG content is correct in HEAD (`git diff HEAD -- opengraph-image.tsx` → empty); the work is split across two commits rather than one. Known repo behavior (MEMORY: git-autocommit-during-merge). No content lost or duplicated.

### Whole-project gate reconciliation (consistent with Plans 01-01 / 01-02)
- The per-task `<verify>` chains end with whole-project `npx tsc --noEmit && npm run lint`. The repo carries 14 pre-existing `tsc` errors in 8 unrelated engine/board/numen TEST + fixture files (documented in Plan 01-02's deferred-items) — present on HEAD, independent of this plan. Per SCOPE BOUNDARY these were NOT fixed; each changed file was instead verified tsc+lint clean in isolation, and the authoritative `npm run build` wave gate is **green**.

## Deferred Issues (out of scope — SCOPE BOUNDARY)

**Pre-existing hype string in a dev/showcase route** — `src/app/(marketing)/board-preview/page.tsx:281` renders `label="Virality score"`. `board-preview/` is a pre-existing dev/showcase route (last touched by unrelated commit `a6add456`), explicitly UNTOUCHED by this phase per the plan `<interfaces>` note + D-04 ("dev/showcase routes untouched"). The plan's route-wide anti-snake-oil grep in `<verification>` is broader than the plan's stated scope and surfaces this pre-existing dev-label leak. The three in-scope files are hype-free. Logged to `deferred-items.md` (Plan 01-03 entry); suggested owner = Phase 4 polish / dedicated dev-route de-hype pass. The other `(marketing)` dev/test routes (`showcase/`, `primitives-showcase/`, `viral-score-test/`, `viz-test/`, `coming-soon/`, `pricing/`) are likewise out of scope.

## Authentication Gates

None.

## Threat Mitigations Applied

- **T-01-06 (Spoofing / SEO injection):** layout `metadata` title/description + OG `alt`/tagline/subtitle are all static string literals — no interpolated user/query data, no metadata-injection vector. Verified in-voice + hype-free by grep gate.
- **T-01-07 / T-01-08 (accept):** page slot copy is static placeholder text with internal `#` anchors only; OG image is a pure static edge render with no fetch/user input. No new injectable surface introduced.

## Known Stubs

The five non-hero SectionShell slots (`how-it-works`, `honesty`, `gallery`, `proof`, `cta`) render heading-only skeletons with no children — INTENTIONAL per phase scope (D-10): they are structural slots whose real media/artifacts are filled by Phase 2 (hero/how-it-works real Reading) and Phase 3 (honesty/gallery/proof/cta). The hero CTA + nav/footer CTAs point at the placeholder `#cta` anchor (live wiring is CTA-01/CTA-02, Phases 2–3 per Plan 02). These are documented phase-scoped placeholders, not blocking stubs — the plan's goal (valid scoped shell + ordered slots + in-voice metadata) is fully achieved.

## Threat Flags

None. No new network endpoints, auth paths, file access, or schema changes introduced — static marketing markup + edge OG render only.

## Self-Check: PASSED

- Files: `src/app/(marketing)/layout.tsx`, `src/app/(marketing)/page.tsx`, `src/app/(marketing)/opengraph-image.tsx`, `src/components/numen-landing/section-shell.tsx`, `01-03-SUMMARY.md` — all FOUND.
- Commits: `76077b31`, `f2fd176d`, `518c6250`, `00c62bc1` — all FOUND in git log.
