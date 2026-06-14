---
phase: 03
slug: rich-visuals-as-drill-downs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `03-RESEARCH.md` § Validation Architecture (Nyquist enabled). SC-2 is the spine:
> every transplanted visual renders **real engine output with no throw and no grey-cell fallback**.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` (env `node`; component/hook tests opt into `happy-dom` via `/** @vitest-environment happy-dom */` pragma; `@/` alias → `src/`; Konva aliased to stubs — irrelevant, charts are Konva-free) |
| **Quick run command** | `npx vitest run src/components/reading` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | quick ~3–6s · full ~60–90s (~2035 green baseline per STATE.md — must not regress) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/components/reading`
- **After every plan wave:** Run `npm test` (full suite must stay ≥ ~2035 green)
- **Before `/gsd:verify-work` + the D-07 human-UAT gate:** Full suite green **and** clean `npm run build` (precondition, same shape as 01-05)
- **Max feedback latency:** ~6 seconds (quick run)

---

## Per-Task Verification Map

> Task IDs populate after `/gsd-plan-phase 3` produces PLAN.md files. This is the
> behavior→test map the planner must honor (every behavior below maps to an
> `<automated>` verify or a Wave-0 dependency). Threat refs carried from P2.

| Behavior | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists |
|----------|------|-------------|------------|-----------------|-----------|-------------------|-------------|
| `score` panel opens from gauge `onOpen` tap → renders `ScoreDistribution`; `PANEL_TITLE.score === 'Score'` | 1 | READ-09 | T-02-12 | `setPanel('score')` literal only; no raw key reflected | component | `npx vitest run src/components/reading/__tests__/reading.test.tsx` | ⚠️ extend |
| Each of the 5 panels renders its rich visual with real fixture data (no throw) | 1 | READ-09 | — | N/A | component | `npx vitest run src/components/reading` | ❌ W0 |
| Each panel degrades to `PanelEmpty` on null/thin data (no grey-cell, no throw) | 1 | READ-09 | — | N/A (correctness, SC-2) | component | `npx vitest run src/components/reading` | ❌ W0 |
| Closed-union safety: `PanelId` type-enforced, no raw-key reflection | 1 | READ-09 | T-02-12 | `Record<PanelId,string>` compiler-enforced allow-list | type/compile | `npx tsc --noEmit` | ✅ |
| No-cut-data guard holds (never spread raw `PredictionResult` into a drill-down) | 1 | READ-09 / READ-10 | READ-10 | whitelisted field reads only | component | `npx vitest run src/components/reading/__tests__/reading.no-cut-data.test.tsx` | ✅ |
| Derive helpers produce correct chart props (0–10 vs 0–100 vs deciles) | — | READ-09 | — | N/A | unit | `npx vitest run src/components/board/audience src/components/board/verdict src/components/board/content-analysis` | ✅ |
| Reskin matte: no `box-shadow: 0 0`, no `backdrop-filter`, no `#FF7F50`, no `linear-gradient(137deg` in transplanted charts | 2 | READ-09 (reskin) | — | N/A | static (grep) | grep-based lint test (recommended) | ⚠️ add |
| Reskinned visuals read flat-warm + consistent with the Reading (live surface) | close | READ-09 (reskin) | — | N/A | **manual UAT** | D-07 blocking human gate | manual |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky/extend*

---

## Wave 0 Requirements

- [ ] `src/components/reading/__tests__/reading.panels.test.tsx` — **the coverage gap.** Each of the 5 panels (score, personas, retention, shareability, hook) renders its rich visual with `makeReadingResult()` (no throw) **and** degrades to `PanelEmpty` on empty/null-heatmap/apollo-null fixtures. The SVG charts (`RetentionChart` / `SegmentTable` / `PersonaGraph` / `CraftFilmstrip` / `ScoreDistribution` / `StatTile`) have **no direct render tests today**.
- [ ] Extend `src/components/reading/__tests__/reading.test.tsx` — gauge `onOpen` → `setPanel('score')` → `ScoreDistribution` mounts; assert `PANEL_TITLE.score === 'Score'`.
- [ ] Extend `src/components/reading/__tests__/fixtures/reading-fixture.ts` — add empty-data helpers (`makeReadingResult({ heatmap: null })`, empty-personas, empty-segments) for the degradation assertions. Reuse existing `makeUnavailableResult` / `makePartialResult` / `makeApolloNullResult`.
- [ ] (Recommended) Reskin lint — a grep/static test asserting transplanted chart files contain no `box-shadow: 0 0`, no `backdrop-filter`, no `#FF7F50`, no `linear-gradient(137deg`. Catches matte regressions cheaply before the UAT gate.
- [ ] No framework install needed — Vitest + RTL present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reskinned charts read flat-warm — no glass/glow/shine, footage grading preserved, consistent with the rest of the Reading | READ-09 (D-07) | Matte "taste bar" is a visual judgment a grep can't fully make; milestone has burned twice on craft → blocking live gate | Open each of the 5 drill-down panels on a real running surface (a live Simulation), mobile + desktop widths; confirm no Raycast glass/137deg gradient, no `0 0` glows, no coral `#FF7F50`; confirm filmstrip still reads as filmed video (grade/grain kept), `--color-frame` artifact gone. Same shape as the THEME-06 / 01-05 gate. Blocks phase close. |
| RetentionPlayer include/exclude decision | READ-09 | Real-world signed-URL `ready` rate (A1/Open-Q2) only observable on live reads | If shipping the player: on a reloaded `video_upload` permalink, confirm `status==='ready'` resolves and the scrubber works; otherwise keep static `RetentionChart` + filmstrip + table (clean degrade, no SC-2 risk). |
| CraftFilmstrip richness on reload (audio band / grading) | READ-09 | `emotion_arc`/`audio_signals` top-level-vs-`variants` persistence (A2/Open-Q1) only visible on reloaded uploads | On a reloaded upload, confirm the filmstrip's audio band isn't flat; if flat, add a `variants` dual-read for `emotion_arc`/`audio_signals`/`video_signals` (one-line helper like `readApollo`). Degrades cleanly if unaddressed — not an SC-2 blocker. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the `reading.panels.test.tsx` gap)
- [ ] No watch-mode flags
- [ ] Feedback latency < 6s (quick run)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
