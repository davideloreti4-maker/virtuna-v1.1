---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Numen Surface
status: executing
stopped_at: Phase 3 partial — 03-01 Task1 + 03-02 done; SMOKE RUN DEFERRED (03-01 Task2), 03-03 blocked
last_updated: "2026-06-12T08:43:18.537Z"
last_activity: 2026-06-12 -- Phase 03 planning complete
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 12
  completed_plans: 9
  percent: 29
---

# Project State

## Project Reference

See: .planning/PROJECT.md · Vision (authoritative): .planning/NUMEN-SURFACE-VISION.md · Worktree identity: .planning/MILESTONE.md · Research: .planning/research/SUMMARY.md

**Core value:** AI content intelligence that tells TikTok creators whether their content will resonate — re-presented as one thread per video where the AI's first turn is the Reading (verdict = band + why).
**Current focus:** Phase 02 COMPLETE — next: Phase 03 (SMOKE GATE + Verdict-Banding Calibration)

## Current Position

Phase: 02 (view-model-data-contract-eng-06-d-12) — COMPLETE (4/4 plans)
Plan: All 4 plans done. 02-01 Task 2 (real fixture capture) closed via authenticated browser fetch → genuine live `complete` payload + settled persisted row paired (analysis WEkihfOzJphv, score 71). identical-render deep-equal GREEN. Full src/lib/reading suite 31/31.
Status: Ready to execute
Last activity: 2026-06-12 -- Phase 03 planning complete

Progress: [█████████░] 89%

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
| Phase 02 P02 | 3 | 2 tasks | 4 files |
| Phase 02 P03 | 22 | 2 tasks | 3 files |
| Phase 02 P04 | 7 | 3 tasks | 2 files |

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
- Plan 02-01 (DATA-02 fixtures): `persisted-<id>.json` = RAW `analysis_results` row, NOT the `/api/analysis/[id]` enriched output — `fromPersistedRow` (D-11) consolidates the route shims, so it consumes the raw row. Capture reuses the user_id-scoped service-client read (route ownership filter untouched); settle-the-race poll on `variants.apollo` aborts rather than writing a partial fixture. Three RED scaffolds (identical-render/view-model/verdict) collected by vitest, fail on the not-yet-built `../view-model`/`../from-persisted-row`/`../verdict-bands` imports (expected Wave-0).
- Plan 03 (DS-07): StageBlock = the ONE key motion moment. Opacity tween (ease [0.215,0.61,0.355,1]) + high-damping spring on translate (stiffness 220 / damping 30, ratio ≥ 1 → no overshoot); reduced-motion zeroes the translate → static opacity appear (D-14). New `--numen-ease-calm` token added to `.numen-surface`; forbidden `--ease-spring` (1.56 bounce) byte-unchanged + unreferenced by the kit. No presence theater on other primitives.
- Plan 02-02 (D-04): VERDICT_BANDS in `src/lib/reading/verdict-bands.ts` is the single Phase-3 band calibration target (high/70, solid/40, needs-work/0) + total `bandFor(score)`; legacy board copies (BAND_THRESHOLDS, bandLabel) carry drift-redirect comments, numeric logic byte-unchanged (board still compiles).
- Plan 02-02 (D-09/D-13): `ReadingBlock` discriminated union is pure data (no presentation hints) with NO `audio` member (audio_fingerprint live-only → would break the intersection). `CanonicalReading` is the narrow live∩persisted shape that physically excludes live-only fields (predicted-engagement range, optimal_post_window, audio_fingerprint) → compile-time intersection enforcement. Re-exports VerdictBand; field types imported from `@/lib/engine/types`.
- Plan 02-04 (DATA-01/04/D-05/D-09): `view-model.ts` ships the pure `toReadingBlocks(CanonicalReading)` (no React/fetch) + `canonicalFromLive(result)` reading `result.hero`/`result.apollo_reasoning` TOP-LEVEL and mirroring `fromPersistedRow` field-for-field so both paths converge → the DATA-02 deep-equal is meaningful. Verdict = `bandFor(score)` + grounded why (D-05 chain `verdict_line` → `the_one_fix` → top `factor.rationale` → '' band-only) + confidence-in-LANGUAGE (D-06), `/100` demoted to in-body `score`; anti-virality gate folds to "Mixed signals" (D-07 seam for Phase 3). `deriveFixes` accepts both `Suggestion` objects AND bare strings (Rule 2 defensive, satisfies the 02-01 spec). DATA-02 NOT marked complete — deep-equal RED until the 02-01 fixture capture.
- [Phase ?]: Plan 02-03 (D-11/DATA-02): fromPersistedRow(row) → CanonicalReading is PURE + DETERMINISTIC (no Math.random/Date/DB). Absorbs the [id] route's deterministic shims (numeric coercion, degradation derive incl. new partialAnalysis, defensive variants.* reads); DROPS the non-deterministic ones (synthHeatmap Math.random persona ids → heatmap column read-only, null stays null; optimal_post_window recompute + creator_profiles lookup gone). Route now thin caller (256→110 lines); user_id ownership + 401 + ?summary preserved. apolloReasoning narrowed to {rewrites, ceiling_capper?} per D-09.

### Pending Todos

None.

### Blockers/Concerns

- **Plan 02-01 human-action checkpoint RESOLVED (2026-06-12):** the REAL (live, persisted) fixture pair was captured (analysis `WEkihfOzJphv`, score 71) and committed (`4350612f`). The smoke script's `--direct` mode can't authenticate (route requires a session; POST sends no cookie) and its UI mode writes the raw row as the live half (wrong shape for `canonicalFromLive`, which reads `result.hero`/`result.apollo_reasoning` TOP-LEVEL). Resolution: logged in as the e2e test user via Playwright, fired the analysis with an in-browser authenticated `fetch` to `/api/analyze` (tiktok_url mode, ~112s, 18 stages), captured the genuine live `complete` SSE payload, then `scripts/capture-reading-fixture.ts` paired it with the settled persisted row (variants.apollo present). PII-reviewed (no secrets/tokens/emails). DATA-02 deep-equal GREEN; full src/lib/reading suite 31/31.
- Phase 3 GATE is pass/fail: a verdict-banding no-go blocks Phase 4. Band thresholds cannot be hardcoded before the same-video-N-times variance data exists.
- **Phase 3 SMOKE RUN DEFERRED (2026-06-12, user direction):** 03-01 Task 1 (`scripts/gate-assert.ts`, GREEN/RED honesty harness — GREEN on `live-WEkihfOzJphv.json`) DONE + committed; 03-02 (dead-band buffer, `DEAD_BAND_FLOOR=5` + `inDeadBand`, reading suite 37/37, build green) DONE + committed + summary. **OUTSTANDING:** 03-01 Task 2 = the live deployed-Vercel ≥3× batch (variance + ENG-03 latency + human honesty sign-off → `03-GATE-RUNS.md`) + 03-01-SUMMARY; then 03-03 = dated GO/NO-GO (`03-GATE-DECISION.md`, needs the sign-off + BUFFER_HALFWIDTH=5 > measured VARIANCE_HALFWIDTH). Resume: run the smoke batch, then `/gsd-execute-phase 3` picks up 03-01 (continuation) → 03-03. Phase NOT verified, NOT complete.
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

Last session: 2026-06-12T08:07:37.532Z
Stopped at: Phase 3 context gathered
Resume file: .planning/phases/03-smoke-gate-verdict-banding-calibration/03-CONTEXT.md
