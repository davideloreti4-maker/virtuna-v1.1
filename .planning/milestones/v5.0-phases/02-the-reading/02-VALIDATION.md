---
phase: 02
slug: the-reading
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` §Validation Architecture (VERIFIED against repo source).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 + @testing-library/react 16 + happy-dom; `vitest-axe` for a11y |
| **Config file** | `vitest.config.ts` (present — no install needed) |
| **Quick run command** | `npx vitest run src/components/reading` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | quick ~5–10s · full suite ~1967 tests (Phase-1 record), must stay green |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/reading`
- **After every plan wave:** Run `npm test` (full suite — currently ~1967 green; must stay green)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10s (quick), ~90s (full)

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; rows are requirement-anchored. Each new component
> gets its test file under `src/components/reading/__tests__/`. Reuse the `PredictionResult`
> factory at `src/lib/engine/__tests__/factories.ts` for fixtures.

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| READ-02 | gauge fill zone = `bandTone(score)` (≥70 green / 40–69 amber / <40 red); band word = `bandFromScore`; NO prose narration | unit + axe | `npx vitest run src/components/reading/__tests__/score-gauge.test.tsx` | ❌ W0 |
| READ-03 | hero layout: thumb strip → gauge \| persona cloud; mobile stacks; gate banner above gauge when `anti_virality_gated` | unit | `npx vitest run src/components/reading/__tests__/hero.test.tsx` | ❌ W0 |
| READ-04 | watch% rendered **exactly once**, owned by hero, from `averageWatchThrough` (0–100) | unit | `npx vitest run src/components/reading/__tests__/reading.watch-pct.test.tsx` | ❌ W0 |
| READ-05/06 | 3 driver rows, 0–100 fill, fixed funnel order; Retention value = `⚠ formatTime(weighted_top_dropoff_t)` **seconds**; only weakest colored | unit | `npx vitest run src/components/reading/__tests__/driver-rows.test.tsx` | ❌ W0 |
| READ-07 | row tap opens `DrillSheet` (bottom mobile / right desktop); "Deeper read" / "N more fixes" expand **inline** (no Sheet) | unit (RTL `userEvent`) | `npx vitest run src/components/reading/__tests__/drill-sheet.test.tsx` | ❌ W0 |
| READ-08 | Fix First: timestamped fixes + copyable hook rewrites (clipboard); D-14 empty → "Nothing urgent to fix" | unit | `npx vitest run src/components/reading/__tests__/fix-first.test.tsx` | ❌ W0 |
| READ-08 / D-13 | `analysis_unavailable` → "couldn't analyze this video", **NEVER** render the fake 0; `partial_analysis` → "partial read"; `apollo_reasoning:null` → degrade gracefully | unit | `npx vitest run src/components/reading/__tests__/reading.degraded.test.tsx` | ❌ W0 |
| READ-10 | no cut field in rendered DOM (`feature_vector`, `*_score` dead signals, `cost_cents`/`latency_ms`, model names, `critique`, `predicted_engagement`) | unit (assert absent) | `npx vitest run src/components/reading/__tests__/reading.no-cut-data.test.tsx` | ❌ W0 |
| a11y | gauge `role=img` + label; cloud sr-only mirror; Sheet focus trap | axe | `vitest-axe` asserted inside each render test | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/reading/__tests__/` directory — none exist yet for the new components.
- [ ] Fixtures: reuse `src/lib/engine/__tests__/factories.ts` (`PredictionResult` factory — VERIFIED present) + `audience-derive.test.ts` patterns.
- [ ] No framework install needed (Vitest configured). Model degraded-state assertions on the existing `AntiViralityHeader.test.tsx` / `.override.test.tsx`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Flat-warm visual fidelity (gauge stroke, cloud density, calm motion) | READ-02/03 | Visual taste — THEME-06 LOCKED, HUMAN-UAT-GATED per milestone | Load `/analyze/[id]` with a real reading; confirm gauge reads as flat stroked arc (no glow), zone color matches band, cloud reads as a "cloud", reduced-motion disables fill animation |
| Mobile bottom-sheet ↔ desktop right-drawer ergonomics + back-button-closes | READ-07 | Device-dependent gesture/history feel | On mobile width: tap a row → bottom sheet; browser/back-gesture closes it. On desktop: right drawer, Reading stays visible at left |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`src/components/reading/__tests__/`)
- [ ] No watch-mode flags (use `vitest run`, not `vitest`)
- [ ] Feedback latency < 90s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
