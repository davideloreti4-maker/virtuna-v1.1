---
phase: 02-the-reading
plan: 02
subsystem: ui
tags: [react, svg, golden-angle, keyframe, signed-url, re-export, vitest, vitest-axe, flat-warm, persona-cloud, thumbnail, anti-virality]

# Dependency graph
requires:
  - phase: 02-the-reading
    plan: 01
    provides: "src/components/reading/__tests__/fixtures/reading-fixture.ts — shared makeReadingResult PredictionResult fixture (heatmap personas, weighted_completion_pct, counterfactuals); the reading test scaffold + flat-warm matte conventions"
  - phase: 01-foundation-shell
    provides: "THEME-06 flat-warm tokens (--color-accent coral, --color-border, --color-foreground creams)"
provides:
  - "PersonaCloud — static deterministic golden-angle dot-cloud (dots ONLY, no watch caption); coral worst-retention cluster, cream others; omits cleanly on empty personas; onOpen Phase-3 seam (READ-04, D-02)"
  - "ThumbnailStrip — static signed-URL keyframe poster gated on a real video (resolveKeyframeUrl 'first'); fails to nothing; never logs the URL (READ-03, D-03)"
  - "AntiViralityHeader — bare re-export of board verdict/AntiViralityHeader into the Reading namespace; the gate banner (READ-03, D-04)"
affects: [02-05, phase-03-rich-visuals]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies (RESEARCH Package Legitimacy Gate not triggered)
  patterns:
    - "Static SVG dot-cloud = PersonaGraph golden-angle math copied VERBATIM (SSR-safe, no Math.random) minus Canvas/200-dots/links/hover/<animate>; lighter D-02 radius 4+weight*9"
    - "Cream dot fill rgba(236,231,222,0.2+watchThrough*0.5) (NOT PersonaGraph's white rgba(255,255,255,…)) — flat-warm cream, coral reserved for the worst cluster only"
    - "Signed keyframe poster via resolveKeyframeUrl(undefined, segments, 'first') real-video gate → null when no frame (no broken placeholder); plain <img> + onError-removes-self; decorative alt=''"
    - "The gate banner is a bare ES re-export (no fork, no 'use client') — board component already flat-warm + self-managing"

key-files:
  created:
    - src/components/reading/persona-cloud.tsx
    - src/components/reading/thumbnail-strip.tsx
    - src/components/reading/anti-virality-header.tsx
    - src/components/reading/__tests__/persona-cloud.test.tsx
    - src/components/reading/__tests__/thumbnail-strip.test.tsx
  modified: []

key-decisions:
  - "PersonaCloud renders DOTS ONLY — no '{n}% watch' caption. Watch% is hero-owned and rendered ONCE by the container (02-05) so it survives the empty-personas degraded path where the cloud omits itself (READ-04)."
  - "Cream fill uses rgba(236,231,222,…), explicitly NOT PersonaGraph's rgba(255,255,255,…) white — flat-warm creams, coral is the lone accent reserved for the worst-retention cluster (BRAND-BIBLE 'if two things are coral, one is wrong')."
  - "ThumbnailStrip resolves the poster via resolveKeyframeUrl's 'first' target (earliest available frame = the input-video poster usage), not the loose single-arg `resolveKeyframeUrl(segment)` the plan's interface block sketched — the real signature is (filmstrips, segments, target)."
  - "AntiViralityHeader is a bare re-export (plan's default) — no className/placement adjustment was needed, so no thin wrapper. The container (02-05) owns placement above the gauge (D-04)."

patterns-established:
  - "Reading hero atoms are prop-driven leaves fed by the pure audience-derive helpers (buildPersonaNodes / worstBadGroupKey / buildSegmentGroups) + resolveKeyframeUrl — no self-fetching, no store coupling"
  - "Strip-not-fork: PersonaGraph's deterministic layout reused verbatim; its Canvas/hover/animate machinery dropped (a different, lighter static component)"

requirements-completed: [READ-03, READ-04]

# Metrics
duration: ~4min
completed: 2026-06-14
---

# Phase 2 Plan 02: Hero Atoms (PersonaCloud + ThumbnailStrip + AntiViralityHeader) Summary

**The three hero "atoms" that surround the gauge — a static deterministic golden-angle PersonaCloud (READ-04, dots only, coral worst cluster, cream others), a signed-URL ThumbnailStrip gated on a real video (READ-03), and the AntiViralityHeader gate banner as the one clean as-is board re-export (D-04) — all pure-helper-fed prop-driven leaves on the locked flat-warm system with zero new dependencies.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-14T18:13:07Z
- **Completed:** 2026-06-14T18:17:30Z
- **Tasks:** 3 (5 commits — 2 TDD tasks split RED/GREEN + 1 re-export)
- **Files modified:** 5 (5 created, 0 modified)

## Accomplishments
- **PersonaCloud** (READ-04, D-02): the static hero dot-cloud. PersonaGraph's golden-angle Fibonacci layout copied **verbatim** (`VB 320×200`, `golden=Math.PI*(3-√5)`, SSR-safe, no `Math.random`) but reduced to ONE `<circle>` per persona with the lighter D-02 radius (`4 + clamp01(weight)*9` vs PersonaGraph's `6 + weight*13`). The single worst-retention cluster reads coral (`var(--color-accent)`); all others use cream `rgba(236,231,222, 0.2 + watchThrough*0.5)` (**never** PersonaGraph's white). NO Canvas, NO 200 viewer dots, NO links, NO hover card, NO `<animate>`. **Dots only** — renders no aggregate watch caption (hero-owned, 02-05). Omits itself (`return null`) on empty/null personas. `role="img"` + sr-only `<ul>` per-persona watch-through mirror. `onOpen` Phase-3 seam wired as a ≥44px tap target.
- **ThumbnailStrip** (READ-03, D-03): static signed-URL poster gated on a real video via `resolveKeyframeUrl(undefined, segments, 'first')` (earliest available frame). Plain `<img>` (NOT `next/image` — signed dynamic URL), decorative `alt=""`, `onError` removes the img (no broken-image box). Returns `null` when there's no resolvable keyframe (text / tiktok-url modes) — no broken placeholder. The signed URL is **never** logged (info-disclosure mitigation T-02-03). Matte flat-warm (hairline border, `rounded-[12px]`, `object-cover`, no glow).
- **AntiViralityHeader** (READ-03, D-04): bare ES re-export of `board/verdict/AntiViralityHeader` — the one friction-free board-React reuse. Already flat-warm-compatible (token gradient coral→warning, no glow), self-manages localStorage dismissal, returns `null` when not gated. No fork, no restyle, no thin wrapper (none needed). No new test — the board component's own `AntiViralityHeader.test.tsx` covers behavior (verified unaffected).
- **Tests:** 11 new (6 PersonaCloud + 5 ThumbnailStrip), all green; full suite **1992 passed** / 26 skipped / 0 failed (was 1981 at the 02-01 baseline — exactly +11).

## Task Commits

1. **Task 1 (RED): failing PersonaCloud test** — `7ef59e36` (test)
2. **Task 1 (GREEN): PersonaCloud implementation** — `308a95d0` (feat)
3. **Task 2 (RED): failing ThumbnailStrip test** — `e0ba71cd` (test)
4. **Task 2 (GREEN): ThumbnailStrip implementation** — `87e02ac0` (feat)
5. **Task 3: AntiViralityHeader re-export** — `3f5a39ba` (feat)

**Plan metadata:** (final docs commit — this SUMMARY + STATE + ROADMAP + REQUIREMENTS)

_Both TDD tasks ran RED → GREEN as separate commits; neither needed a REFACTOR (each implementation was already minimal). Task 3 is a pure re-export — no TDD, no new test, per the plan._

## Files Created/Modified
- `src/components/reading/persona-cloud.tsx` (125 lines) — static golden-angle dot-cloud; coral worst cluster, cream others; omits on empty; sr-only mirror; `onOpen` seam.
- `src/components/reading/thumbnail-strip.tsx` (55 lines) — signed-URL poster, real-video gate, fails to nothing, never logs the URL.
- `src/components/reading/anti-virality-header.tsx` (16 lines) — bare re-export of the board gate banner.
- `src/components/reading/__tests__/persona-cloud.test.tsx` (102 lines) — 6 tests (4-circle render, coral worst + cream others not-white, radius∝weight, no watch caption, empty/null omit, role=img + sr-only mirror + axe).
- `src/components/reading/__tests__/thumbnail-strip.test.tsx` (64 lines) — 5 tests (signed img + alt='', no-keyframe omit, null heatmap omit, onError removes img, decorative-alt axe).

## Decisions Made
- **PersonaCloud is dots-only — watch% is NOT rendered here.** READ-04 makes watch% a hero-owned field shown exactly once; the container (02-05) renders it so it still appears on the empty-personas degraded path where this cloud returns `null`. The per-persona `watchThrough` still drives fill opacity + the sr-only mirror, but there is no aggregate caption. Tested: the SVG's `textContent` carries no "watch", and "watch-through" appears only inside the sr-only `<ul>`.
- **Cream, not white.** PersonaGraph fills non-accent dots with `rgba(255,255,255,…)`; the flat-warm system bans pure white (D-02 / UI-SPEC). The cloud uses `rgba(236,231,222,…)`. The test asserts at least one dot matches `/rgba\(\s*236,\s*231,\s*222/` and that NO dot is white/`#fff`/`white`.
- **`resolveKeyframeUrl` real signature.** The plan's interface block sketched `resolveKeyframeUrl(segment)`, but the actual export is `resolveKeyframeUrl(filmstrips, segments, target)` (3 args). ThumbnailStrip bridges `heatmap.segments` to `KeyframeSegmentLike[]` and calls it with target `'first'` (the documented "Input video poster" usage = earliest available frame), giving the correct real-video gate. No top-level filmstrips map exists on the heatmap, so a segment's own `keyframe_uri` is the source — the test overrides `segments[0].keyframe_uri` with a signed URL for the real-video case.
- **Bare re-export, no wrapper.** The plan allows a thin wrapper only IF a className/placement tweak is needed; none was, so the module is a one-line `export { AntiViralityHeader } from …`. Placement above the gauge (D-04) is the container's job (02-05).

## Deviations from Plan

None — the plan executed exactly as written. The only judgement call (using `resolveKeyframeUrl`'s real 3-arg `'first'` signature instead of the plan interface block's loose `resolveKeyframeUrl(segment)` sketch) is a faithful read of the actual helper the plan named, not a deviation — see Decisions Made. No bugs, missing functionality, or blocking issues were encountered; no auth gates.

## Threat Surface

All three components stay within the plan's `<threat_model>` register, mitigations applied:
- **T-02-03 (info disclosure — signed keyframe URL):** ThumbnailStrip uses the existing `resolveKeyframeUrl` real-video gate, decorative `alt=""`, and never `console.*`-logs the URL. Asserted: `grep -c "next/image|console.log|console.info"` returns 0 in code.
- **T-02-04 (info disclosure — hero atoms):** PersonaCloud renders only whitelisted fields via `buildPersonaNodes` (`heatmap.personas` + `persona_simulation_results`); no raw `PredictionResult` spread. The sr-only mirror exposes only persona label + watch-through (+ optional segment/dropAt), no ids/telemetry.
- **T-02-05 (spoofing — AntiViralityHeader):** accepted — a re-export of an already-shipped, tested component behind the existing `(app)` auth gate; no new logic.
- **T-02-SC (npm installs):** accepted — zero new dependencies, nothing to vet.

No new security-relevant surface (network endpoints, auth paths, file access, schema) was introduced beyond this register.

## Issues Encountered
- **Pre-existing tsc errors in untouched files (out of scope, NOT fixed).** Carried from 02-01 (logged in `deferred-items.md`): strict-typecheck errors in `lib/engine/wave3/__tests__/*`, `lib/engine/__tests__/stage10-*`, and the board verdict fixture. Per the executor SCOPE BOUNDARY rule, untouched. **All 3 new reading files are tsc-clean** (`tsc --noEmit` reports zero errors under `src/components/reading/persona-cloud|thumbnail-strip|anti-virality-header`).

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- **02-05 (container)** now has all hero atoms: it composes `<ThumbnailStrip heatmap={…}/>` at the top, `<AntiViralityHeader result={data} analysisId={id}/>` above the gauge (when gated, D-04), and `<PersonaCloud heatmap simResults onOpen={…}/>` beside the `ScoreGauge` in the hero grid. The container owns the **single hero watch% caption** (READ-04) and the `DrillSheet` opener passed to `PersonaCloud.onOpen`.
- **Phase 3** mounts the full Canvas `PersonaGraph` into the `DrillSheet` via the `onOpen` seam — no change to PersonaCloud needed (it is the static tap target; the rich component is a separate mount).
- The remaining Wave-2 sibling **02-03 (DriverRows / FixFirstList / DeeperRead)** is independent and composes the same shared fixture; no coupling to this plan's atoms.

## Self-Check: PASSED

All 5 created files verified on disk; all 5 task commits verified in git log
(`7ef59e36`, `308a95d0`, `e0ba71cd`, `87e02ac0`, `3f5a39ba`). Reading + board-AV
suite 34/34 green; full suite 1992 passed / 0 failed (was 1981, +11 new); the 3
new reading files are tsc-clean.

---
*Phase: 02-the-reading*
*Completed: 2026-06-14*
