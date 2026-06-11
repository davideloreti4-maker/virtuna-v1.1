---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Numen Surface
status: planning
stopped_at: Phase 2 context gathered
last_updated: "2026-06-11T21:52:00.005Z"
last_activity: 2026-06-11
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md · Vision (authoritative): .planning/NUMEN-SURFACE-VISION.md · Worktree identity: .planning/MILESTONE.md · Research: .planning/research/SUMMARY.md

**Core value:** AI content intelligence that tells TikTok creators whether their content will resonate — re-presented as one thread per video where the AI's first turn is the Reading (verdict = band + why).
**Current focus:** Phase 2 — view model + data contract (eng 06 d 12)

## Current Position

Phase: 2
Plan: Not started
Status: Ready to plan
Last activity: 2026-06-11

Progress: [██████████] 100% (Phase 01)

## Performance Metrics

**Velocity:**

- Total plans completed: 10
- Average duration: ~66 min
- Total execution time: ~330 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 design-system | 5/5 | ~330 min | ~66 min |
| 01 | 5 | - | - |

*Updated after each plan completion*
| Phase 01 P05 | 10 | 1 tasks | 1 files |
| Phase 01 P02 | 18 | 2 tasks | 5 files |
| Phase 01 P03 | 11 | 1 tasks | 2 files |
| Phase 01 P04 | 150 | 3 tasks | 4 files |

## Accumulated Context

### Decisions

Recent decisions affecting current work:

- Milestone: Presentation-layer only — engine v4.1 / ENGINE_VERSION 3.19.0 is FROZEN; no `lib/engine/` edits.
- Milestone: Mobile ships first; desktop instrument (Konva keep-vs-retire) is the LAST phase.
- Forced ordering: DATA (view-model crux) early → GATE (SMOKE + verdict-banding calibration) hard precondition → READ. DS runs early/parallel to DATA.
- Scope: iOS share-target OUT (WebKit #194593 → Capacitor milestone); ingestion = upload + paste-URL + Android share_target.
- Stack: repo is Next.js 16.1.5 / React 19.2.3; SSE transport already exists (READ reshapes events, doesn't build transport); Serwist for PWA (not next-pwa).
- Plan 01: D-11 palette locked (Option B) — muted #bab2a5 (Lc 60.1), verdict-bad #d4866f (Lc 46.7); all other hexes as proposed. APCA gate exits 0.
- Plan 01: colorParsley not re-exported by apca-w3; use calcAPCA(textHex, bgHex) wrapper in all contrast scripts — accepts hex strings, bundles colorParsley internally.
- Plan 01: framer-motion retained (D-04 deferral) — 4 OLD files untouched; standardize new code on motion; defer removal to surface-rebuild phases.
- [Phase ?]: Plan 05 (DS-06): chat dock FOUND via widened grep at command-bar/CommandBar.tsx ('bottom-pinned dock' / unified expert chat panel) — Q8 'absent' caveat resolved; absorbed into thread, owned Phase 4/5.
- Plan 02 (DS-05): kit primitives expose their tailwind-variants `tv()` result as a NAMED export (`surface`/`pillChip`/`iconButton`/`verdictSwatch`) + an ergonomic wrapper component — tests import the tv function directly.
- Plan 04 (DS-04): voice serif = Source Serif 4 (confirmed on deployed prod build, Newsreader specimened + rejected; layout.tsx unchanged).
- Plan 04 (DS-05): Glass `backdrop-filter: blur(12px)` LIVE on deployed build — Lightning CSS does NOT strip the inline-style form (Playwright-verified 2026-06-11).
- Plan 04 (testing): next/font/google mock must be an explicit named-export object, NOT a catch-all Proxy — Proxy returns a function for `then`, making the mock thenable and hanging `await import()` forever.
- Plan 04 (config): vitest.config.ts `include` must cover `tests/**/*.test.tsx` (not just `.ts`) for a11y tests in the tests/ directory.
- Plan 02 (D-05): Glass blur still needs DEPLOYED-build verification (Plan 04); happy-dom/dev don't exercise the Lightning CSS pass. Documented in glass.tsx header.
- Plan 03 (DS-07): StageBlock = the ONE key motion moment. Opacity tween (ease [0.215,0.61,0.355,1]) + high-damping spring on translate (stiffness 220 / damping 30, ratio ≥ 1 → no overshoot); reduced-motion zeroes the translate → static opacity appear (D-14). New `--numen-ease-calm` token added to `.numen-surface`; forbidden `--ease-spring` (1.56 bounce) byte-unchanged + unreferenced by the kit. No presence theater on other primitives.

### Pending Todos

None.

### Blockers/Concerns

- Phase 3 GATE is pass/fail: a verdict-banding no-go blocks Phase 4. Band thresholds cannot be hardcoded before the same-video-N-times variance data exists.
- Phase 7 (Desktop): Konva-keep-vs-retire is open (vision §9), dense-linear successor undefined — plan with `/gsd-plan-phase --research-phase`.

## Deferred Items

Carried forward from v4.1 MVP Ready close (2026-06-11) into this milestone:

| Category | Item | Status | Note |
|----------|------|--------|------|
| precondition | SMOKE GATE (real-video E2E, honest output, ENG-03 latency) | scheduled | becomes Phase 3 GATE-01 |
| precondition | UAT sign-off (F42 permalink + measure-pipeline) | scheduled | becomes Phase 3 GATE-03 |
| design step | ENG-06 D-12 (consumed-vs-dead field prune) | scheduled | becomes Phase 2 DATA (view-model) |
| value cluster | F36/F38/F40/F41/F43/F45 | resolving | resolved BY the new surface (READ + DATA); F40 still deferred |

From Plan 01 execution:

| Category | Item | Status | Note |
|----------|------|--------|------|
| cleanup | framer-motion removal (D-10) | deferred | 4 OLD files use framer-motion; defer to surface-rebuild phases (D-04) |

## Session Continuity

Last session: 2026-06-11T21:51:59.999Z
Stopped at: Phase 2 context gathered
Resume file: .planning/phases/02-view-model-data-contract-eng-06-d-12/02-CONTEXT.md
