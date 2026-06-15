---
phase: 01-foundation-shell
plan: 05
subsystem: ui
tags: [theme06, uat-gate, flat-warm, design-tokens, charcoal-ramp, terracotta-coral, newsreader, score-zones, playwright, phase-exit-gate]

# Dependency graph
requires:
  - phase: 01-01
    provides: The flat-warm @theme token system (charcoal hex ramp, terracotta coral, Newsreader→--font-serif, --shadow-float) — the [UAT] values reviewed and locked here.
  - phase: 01-02
    provides: The lean reskinned collapsible sidebar with the Raycast glass stripped (Layer B) + "Simulations" list + score chips — the active-state surface reviewed here.
  - phase: 01-03
    provides: The clean /home (serif greeting + centered composer + NumenMark stele), no chips — the empty-state surface reviewed here.
  - phase: 01-04
    provides: /home is the genuine post-login landing — so the human reviews the shell users actually hit, not a side route.
provides:
  - THEME-06 SIGNED — the flat-warm visual system is LOCKED for rollout via a live human review on the running shell (verdict approved). The phase exit gate of Phase 1.
  - The locked [UAT] value table (charcoal ramp / lone-accent coral / Newsreader serif / score zones / greeting micro-copy) — downstream phases 2-5 reskin ONTO these as the fixed, no-longer-provisional source of truth.
  - A committed, reusable Playwright UAT capture harness (e2e/uat-theme06.spec.ts) for future screenshot runs once E2E creds + a completed Simulation id are provided.
affects: [phase-02-the-reading (renders ON the locked flat-warm tokens — coral/charcoal/serif/score-zones are now fixed, not Frame-A provisional), phase-03-rich-visuals (board visuals reskin TO these locked tokens), phase-04-stage-reveal, phase-05-followup-demo]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase exit gate = a BLOCKING checkpoint:human-verify on the assembled, running shell after a clean rebuild (Pitfall 3) — the visual system locks only against something real, never the swatch (THEME-06 / D-07)"
    - "Live human review can substitute for the screenshot artifact when the env-gated capture cannot run — the gate is the human sign-off on the running shell, the screenshots are the convenience artifact (the committed harness re-enables them later)"

key-files:
  created:
    - e2e/uat-theme06.spec.ts
    - .planning/phases/01-foundation-shell/uat/.gitkeep
  modified: []

key-decisions:
  - "THEME-06 / D-07 APPROVED via a LIVE human review on the running dev server (localhost:3000), not via the 4 screenshots — the screenshots were env-gated at capture time (no .env.local in this worktree → app 500'd → 0/4 captured). Per the user's chosen gate path the review was done live; the gate is the human sign-off, the screenshots are a convenience artifact. The committed harness re-enables the screenshots for any future run."
  - "Locked the as-shipped Frame-A values (no punch-list adjustments): charcoal ramp app #262624 / sidebar #1a1a18 / composer #1e1d1b / chip #2f2e2b; lone-accent coral oklch(0.68 0.13 33) ≈ #d97757 (text-on-coral #1a0f0a); serif = Newsreader (kept, NOT swapped to Source Serif 4); score zones green oklch(0.68 0.17 145) / amber oklch(0.75 0.15 85) / red oklch(0.60 0.20 25); greeting 'Ready to simulate your audience, [Name]?' (name italic via useProfile, name-less while loading)."
  - "Scope honesty: the /analyze/[id] BOARD route is intentionally untouched by Phase 1 (still the old board) — its reskin to the Reading view is Phase 2+. The gate's 'active /analyze/[id] bottom-pinned composer' expectation was reviewed only to the extent Phase 1 contributes to that route (the reskinned sidebar + page theme); the full active-state review is deferred to Phase 2 when the thread renders there."

patterns-established:
  - "Phase exit gate pattern: the human-UAT gate runs LAST in the phase, on the fully assembled shell after a clean rebuild — downstream phases inherit a signed-off (not provisional) foundation."

requirements-completed: [THEME-01, THEME-03, THEME-06, SHELL-07]

# Metrics
duration: 1min
completed: 2026-06-14
---

# Phase 1 Plan 05: THEME-06 Human-UAT Gate Summary

**The flat-warm visual system is LOCKED for rollout — THEME-06 / D-07 signed off via a live human review on the running shell (the empty /home serif greeting + centered composer + NumenMark, and the flat-warm reskinned sidebar with the "Simulations" list + score chips): charcoal ramp, lone-accent terracotta coral, Newsreader serif, green/amber/red score zones, and the greeting micro-copy are now the fixed source of truth Phase 2-5 reskin onto, no longer Frame-A provisional.**

## Gate Outcome

**THEME-06 / D-07: APPROVED** (the phase exit gate). The human reviewed the running shell live (dev server at `localhost:3000`) and signed off ("looks okay"). The flat-warm system is **locked for rollout** — downstream phases (2-5) now reskin onto a signed-off foundation, not an abstract swatch.

What the human reviewed live:
- **Empty home (`/home`):** serif greeting ("Ready to simulate your audience, [Name]?") + the centered composer + the NumenMark stele glyph — NO starter chips, NO Simulation list under the composer (D-18).
- **Reskinned sidebar (active surface):** the flat-warm sidebar — the "Simulations" list with score chips, the Raycast glass gone (no 137deg gradient / blur / inset shine / glow).

## Locked [UAT] Values (as shipped — now LOCKED for rollout)

These are no longer `[UAT]` / Frame-A provisional. Phase 2-5 treat them as fixed:

| Field | Locked value |
|-------|--------------|
| Charcoal ramp — app | `#262624` |
| Charcoal ramp — sidebar | `#1a1a18` |
| Charcoal ramp — composer | `#1e1d1b` |
| Charcoal ramp — chip | `#2f2e2b` |
| Coral (lone accent) | `oklch(0.68 0.13 33)` ≈ `#d97757` |
| Text-on-coral | `#1a0f0a` |
| Serif typeface | **Newsreader** (via `next/font` → `--font-newsreader` → `@theme --font-serif`) — kept, NOT swapped to Source Serif 4 |
| Score zone — green | `oklch(0.68 0.17 145)` |
| Score zone — amber | `oklch(0.75 0.15 85)` |
| Score zone — red | `oklch(0.60 0.20 25)` |
| Greeting micro-copy | "Ready to simulate your audience, [Name]?" (name italic via `useProfile`; name-less while loading, so no `[Name]` flash) |

## Performance

- **Duration:** ~1 min (close-out only — the gate review itself was interactive/human)
- **Completed:** 2026-06-14
- **Tasks:** 3 (Task 1 auto PASSED, Task 2 auto, Task 3 blocking human-verify APPROVED) → **3/3**
- **Files:** 2 created (Task 2 harness + .gitkeep), 0 modified (this is a gate/close-out plan — no source edits)

## Accomplishments

- **THEME-06 phase exit gate signed (D-07)** — the flat-warm visual system passed an explicit human-UAT review on the *built, running* shell and is locked for rollout. This is the last requirement of Phase 1; the phase is now code-complete with all 13 requirements satisfied.
- **The [UAT] value table is locked** (see above) — the charcoal ramp, the lone-accent coral, the Newsreader serif, the green/amber/red score zones, and the greeting copy graduate from Frame-A provisional to the fixed source of truth. No punch-list adjustments were requested — the as-shipped values were approved.
- **Structural preconditions held (Task 1, PASSED earlier):** the full Vitest suite was green (**1945 passed / 26 skipped / 0 failed**) and a clean `pnpm run build` exited 0 — proving the flat-warm `@theme` compiles after all token edits (THEME-01/03 structural proof; SHELL-07 + all prior tests). The human therefore reviewed a true, working shell.
- **A reusable UAT capture harness committed (Task 2)** — `e2e/uat-theme06.spec.ts` + the `uat/` dir (`.gitkeep`) at `8f8e8acb`, ready to capture the 4 shots (desktop/mobile × empty/active) on any future run once `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` + a completed `UAT_ACTIVE_ANALYSIS_ID` are provided.

## Task Commits

1. **Task 1: Structural precondition (full suite green + clean build)** — no commit (a gate, no source edits); PASSED earlier (1945 passed / 26 skipped / 0 failed; `pnpm run build` exit 0).
2. **Task 2: Capture the 4 UAT screenshots** — `8f8e8acb` (`feat`) — `e2e/uat-theme06.spec.ts` + `.planning/phases/01-foundation-shell/uat/.gitkeep`. 0/4 screenshots auto-captured (env-gated at capture time — see Deviations); the harness is the durable artifact.
3. **Task 3: THEME-06 human-UAT gate (blocking)** — no commit (human review); **APPROVED** via live review on the running shell.

**Plan metadata:** final `docs(01-05)` commit (this SUMMARY + STATE + ROADMAP + REQUIREMENTS).

## Files Created/Modified

- `e2e/uat-theme06.spec.ts` — **Created** (Task 2, `8f8e8acb`). The Playwright UAT capture harness — authenticated login then 4 screenshots (desktop-empty, desktop-active, mobile-empty, mobile-active) into `.planning/phases/01-foundation-shell/uat/`. Ready for future runs once E2E creds + a completed Simulation id are supplied.
- `.planning/phases/01-foundation-shell/uat/.gitkeep` — **Created** (Task 2, `8f8e8acb`). Holds the UAT screenshot directory in git for future captures.
- No source edits in this plan — it is the phase exit gate + close-out.

## Decisions Made

- **Gate signed via live review, not the screenshot artifact.** The 4 Playwright shots could not be auto-captured (this worktree had no `.env.local` at capture time → Supabase env missing → the app 500'd → 0/4 captured). Per the user's chosen gate path the review was done **live** on the running dev server (env since resolved, server boots). The THEME-06 gate is fundamentally the **human sign-off on the running shell**; the screenshots are a convenience artifact, and the committed harness re-enables them later. Recorded honestly as a minor follow-up, not a blocker.
- **Locked the as-shipped values (no punch-list).** The human approved the Frame-A values without adjustment — Newsreader kept (not swapped to Source Serif 4), coral kept at `oklch(0.68 0.13 33)` ≈ `#d97757`, the charcoal ramp and score zones as shipped. See the locked table above.
- **The /analyze/[id] active state was reviewed only to Phase 1's contribution.** The BOARD route is intentionally untouched by Phase 1 (still the old board); its reskin to the Reading view is Phase 2+. So the gate's "active /analyze/[id] bottom-pinned composer" expectation was reviewed only insofar as Phase 1 themes that route (the reskinned sidebar + the page theme) — the full active-state review is deferred to Phase 2, when the thread actually renders there. This is a scope boundary, not a gap in the gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, env-gated] The 4 UAT screenshots could not be auto-captured**
- **Found during:** Task 2 (Capture the 4 UAT screenshots).
- **Issue:** This worktree had no `.env.local` at capture time, so the Supabase env was missing and the app returned 500 on the authed routes — the Playwright harness could not log in or render the shell, so 0 of 4 screenshots were produced.
- **Fix:** Committed the capture harness (`e2e/uat-theme06.spec.ts`) + the `uat/` dir so the artifact is ready for a future run, and substituted a **live human review** on the running shell for the gate (the env was since resolved and the dev server boots). This is the user's chosen gate path — the gate is the human sign-off, the screenshots are a convenience artifact. Not a blocker; recorded as a follow-up below.
- **Files modified:** `e2e/uat-theme06.spec.ts`, `.planning/phases/01-foundation-shell/uat/.gitkeep` (created).
- **Committed in:** `8f8e8acb` (Task 2 commit).

---

**Total deviations:** 1 (env-gated screenshot capture, worked around via live review + a committed harness).
**Impact on plan:** None on the gate outcome — THEME-06 is signed. The only residue is a minor follow-up (run the harness when E2E creds + a completed Simulation id exist) and a Phase-2 nit (below). No scope creep.

## Issues Encountered

None during the planned work beyond the env-gated capture (documented as the deviation above). The structural preconditions (Task 1) passed cleanly earlier.

## Follow-ups (non-blocking)

- **UAT screenshots — 0/4 captured (minor):** run `e2e/uat-theme06.spec.ts` once `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` + a completed `UAT_ACTIVE_ANALYSIS_ID` are provided, to populate `.planning/phases/01-foundation-shell/uat/` with the desktop/mobile × empty/active shots. The live review already satisfied the gate; this is purely to capture the durable artifact.
- **Score-chip token unification (Phase 2 nit):** the sidebar score chips render via Tailwind `emerald-400` / `amber-400`, not the `--color-success` / `--color-warning` / `--color-error` score-zone tokens locked above. Consider unifying to one source of truth when Phase 2 builds the hero's zone-colored score (so the sidebar chip and the hero score share the locked zone palette).

## User Setup Required

None for this plan. (To re-enable the UAT screenshot artifact in future, provide `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` + a completed `UAT_ACTIVE_ANALYSIS_ID` and run `e2e/uat-theme06.spec.ts` — optional, the gate is already signed.)

## Next Phase Readiness

- **Phase 1 is code-complete — all 13 requirements satisfied** (SHELL-01..07 + THEME-01..06). THEME-06, the phase exit gate, is signed; the flat-warm system is locked for rollout.
- **Phase 2 (The Reading) inherits a signed-off foundation:** the charcoal ramp, the lone-accent coral, the Newsreader serif, and the green/amber/red score zones are now FIXED (not Frame-A provisional). The hero's zone-colored `overall_score`, the driver rows, and the deeper-read disclosures all reskin onto these locked tokens. The Reading renders inside the locked shell frame (the bottom-pinned composer + the "Simulations" sidebar) and replaces the old board on the `/analyze/[id]` route reviewed (only thematically) here.
- **Carry into Phase 2:** the active `/analyze/[id]` state still shows the old board (Phase 1 themed it but did not rebuild it) — Phase 2 is where the Reading thread actually renders there; and the sidebar score chips should adopt the locked score-zone tokens (the nit above) when the hero score lands.

## Self-Check: PASSED

- `.planning/phases/01-foundation-shell/01-05-SUMMARY.md` — FOUND (this file; gate APPROVED, [UAT] values locked, scope notes + follow-ups recorded).
- `e2e/uat-theme06.spec.ts` — FOUND (created; the UAT capture harness).
- `.planning/phases/01-foundation-shell/uat/.gitkeep` — FOUND (created; holds the screenshot dir).
- Commit `8f8e8acb` (Task 2, harness + .gitkeep) — FOUND in git log.
- Task 1 precondition (full suite green + clean build) — recorded as PASSED earlier per prior-state facts (1945 passed / 26 skipped / 0 failed; `pnpm run build` exit 0); not re-run per the close-out scope.
- Task 3 (THEME-06 human gate) — APPROVED via live review on the running shell; verdict recorded above.

---
*Phase: 01-foundation-shell*
*Completed: 2026-06-14*
