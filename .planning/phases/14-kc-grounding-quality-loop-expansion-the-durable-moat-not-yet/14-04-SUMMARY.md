---
phase: 14-kc-grounding-quality-loop-expansion-the-durable-moat-not-yet
plan: 04
subsystem: thread-renderers
tags: [kcq-09, kcq-04, idea-card, hook-card, fixed-renderer, theme-06, made-for-you, flop-reveal, vitest]

# Dependency graph
requires:
  - phase: 14-kc-grounding-quality-loop (plan 02)
    provides: predictedFailureMode optional-nullable field on IdeaCardBlockSchema + HookCardBlockSchema (populated by the rubric-critic, null on clean pass)
  - phase: 03-ideas-tool
    provides: IdeaCardRenderer + whyItFits grounding line already on the card props
  - phase: 04-hooks-tool
    provides: HookCardRenderer with the tap-to-expand disclosure pattern
provides:
  - inline made-for-you rationale (KCQ-09) surfacing whyItFits on the idea card face
  - opt-in predicted-failure-mode drill reveal (KCQ-04) on both idea + hook renderers
  - idea-card-block.test.tsx render-test suite (9 assertions)
affects: [12-library-field-legibility, kc-grounding, quality-loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Surface-lane presentational edit: consume existing/14-02 card props in the fixed typed renderer — no new schema field, no model markup"
    - "Two-stage opt-in reveal: the flop affordance lives INSIDE the disclosure (off the face), and a second drill gates the failure-mode text itself (opt-in, never silent-only)"
    - "Honesty-spine tone via --color-warning (never coral, never error-red) for failure-mode foresight"

key-files:
  created:
    - src/components/thread/__tests__/idea-card-block.test.tsx
  modified:
    - src/components/thread/idea-card-block.tsx
    - src/components/thread/hook-card-block.tsx

key-decisions:
  - "KCQ-09 reframed the EXISTING whyItFits grounding line into inline 'Made for you — {whyItFits}' micro-copy (a <p> with a muted label prefix), replacing the prior boxed grounding panel. Plain-language, muted THEME-06 tokens, no coral, no pill (D-04/D-14). whyItFits is a required prop so the line always renders for ideas."
  - "KCQ-04 uses a TWO-stage opt-in: the flop affordance is rendered only inside the expand/disclosure (never on the face), and a second drill (flopOpen state) gates the failure-mode TEXT. Satisfies both 'never always-visible' and 'never silent-only' (D-10) — the path exists but nothing is shoved at the user."
  - "Renders the affordance with `predictedFailureMode != null` (loose null check) → covers both null AND absent (older rehydrated cards), so no crash and no empty affordance on legacy blocks."
  - "Hooks gets the SAME flop reveal but NO made-for-you line — HookCardBlock has no whyItFits prop and the plan forbids adding one or fabricating a rationale (KCQ-09 primary surface is Ideas)."

patterns-established:
  - "Surface-lane renderer edits consume the 14-02 critic texture (predictedFailureMode) without any engine/schema change — pure client render, no ENGINE_VERSION bump"

requirements-completed: [KCQ-09, KCQ-04]

# Metrics
duration: 8min
completed: 2026-06-20
---

# Phase 14 Plan 04: Surface Lane — Made-for-You Rationale + Opt-In Flop Reveal Summary

**The moat is now legible on the cards: the idea renderer surfaces the existing `whyItFits` grounding line as inline plain-language "Made for you — …" micro-copy (KCQ-09, personalization-trust + steering lever, NOT a citation), and BOTH the idea + hook renderers gain an opt-in two-stage drill that reveals the 14-02 rubric-critic's `predictedFailureMode` foresight only on demand (KCQ-04) — warning-toned, never on the face, never silent-only, scroll-quote still leading; pure client render, no schema/engine change.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-20
- **Completed:** 2026-06-20
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **KCQ-09 made-for-you rationale (Task 1):** the idea card already carried `whyItFits` as a boxed grounding panel; reframed it into inline plain-language micro-copy — a muted `<p>` reading `Made for you — {whyItFits}` with a label-prefix span. This is the personalization-trust + steering-lever surface (D-04) — NOT source-citation, no pills (D-14). Muted THEME-06 tokens (`text-muted/70`, label `text-muted/50`), no coral. The scroll-quote still LEADS the card (renders above the band fraction, D-03). `whyItFits` is a required schema prop, so the line always renders for ideas. Hooks carry no `whyItFits` prop → per the plan, NO rationale line is added to hooks and none is fabricated.
- **KCQ-04 opt-in flop reveal (Task 2):** both `IdeaCardRenderer` and `HookCardRenderer` now destructure `predictedFailureMode` and, when it is non-null, render a two-stage opt-in affordance INSIDE the existing expand/disclosure: a small `If this could flop →` toggle (`--color-warning`) that, on a second drill, reveals the failure-mode text. When `predictedFailureMode` is null or absent (older rehydrated cards), NOTHING renders — no empty affordance. The affordance is never on the always-visible face (preserves the positive-but-honest tone, D-10) and never silent-only (it IS reachable via the drill). Warning-toned, never coral, never error-red (honesty spine). Pure client render — no engine call, no `ENGINE_VERSION` bump.
- **Render-test suite (created):** `idea-card-block.test.tsx` (9 assertions) — KCQ-09: rationale derives from the `whyItFits` prop (not hardcoded), "Made for you" framing, different prop → different text, scroll-quote precedes the band fraction (D-03). KCQ-04: no affordance when null, no affordance when absent (legacy rehydration), affordance gated behind disclosure (not on the face), text revealed only after the second opt-in drill, affordance is `--color-warning` and contains no coral RGB.

## Task Commits

Each task committed atomically:

1. **Task 1: inline made-for-you rationale on idea card (KCQ-09)** — `dd138324` (feat)
2. **Task 2: opt-in predicted-failure-mode reveal on idea/hook cards (KCQ-04)** — `0899d8a5` (feat)

**Plan metadata:** _(final docs commit)_

## Files Created/Modified

- `src/components/thread/__tests__/idea-card-block.test.tsx` (created) — 9 assertions across KCQ-09 (rationale derivation + scroll-quote lead) and KCQ-04 (null/absent → no affordance, disclosure gating, two-stage opt-in reveal, warning tone). happy-dom env, QueryClientProvider wrapper (SaveAffordance dependency).
- `src/components/thread/idea-card-block.tsx` (modified) — boxed grounding panel → inline `Made for you — {whyItFits}` micro-copy; destructure `predictedFailureMode` + `flopOpen` state; warning-toned opt-in flop drill inside the expand block (renders only when non-null).
- `src/components/thread/hook-card-block.tsx` (modified) — destructure `predictedFailureMode` + `flopOpen` state; same warning-toned opt-in flop drill inside the expand block (renders only when non-null). No made-for-you line (no whyItFits prop on hooks).

## Decisions Made

- **Reframe, don't add — KCQ-09 is thin (D-04).** The whyItFits line already existed; the work was presentational (panel → inline "Made for you" micro-copy). No new prop, no model markup, full field-legibility surface deferred to P12 (D-04).
- **Two-stage opt-in resolves the D-10 paradox.** "Never always-visible" + "never silent-only" are satisfied by putting the affordance inside the disclosure (off the face) and gating the TEXT behind a second drill. The reveal path exists; nothing is shoved at the user.
- **`!= null` (loose) over `!== null` (strict).** The loose check treats absent (older rehydrated cards) and null identically → no empty affordance and no crash on legacy blocks. Consistent with the 14-02 "absent ≡ null" schema contract.
- **Hooks get the flop reveal but not the rationale.** HookCardBlock has no whyItFits; the plan forbids adding one or fabricating it, so the made-for-you surface stays Ideas-only while the flop reveal lands on both.

## Deviations from Plan

None — plan executed as written. The idea card's `whyItFits` was already rendered (as a boxed panel from Phase 3); Task 1 reframed it into the specified inline "Made for you" micro-copy rather than adding a net-new line, which is exactly the thin-surface intent of D-04.

## Issues Encountered

None.

## Verification

- `npx vitest run src/components/thread/__tests__/idea-card-block.test.tsx` → PASS (9).
- `npx vitest run src/components/thread` → PASS (23) (full thread component suite, no regressions).
- `grep -c "dangerouslySetInnerHTML" idea-card-block.tsx` = 0 (no model-generated markup).
- `grep -n "color-warning" idea-card-block.tsx` → hit inside the flop affordance (lines 260, 269).
- `grep -c predictedFailureMode idea-card-block.tsx hook-card-block.tsx` → 4 each (both renderers reference it).
- **No engine bump:** `git diff --name-only HEAD` over the plan span touched only the 2 renderers + 1 test — `version.ts`, `run-flash-text-mode.ts`, `flash-prompts.ts`, `persona-registry.ts`, `blocks.ts` all untouched. ENGINE_VERSION unchanged (3.19.0).
- `npx eslint` on all 3 touched files → No issues found.
- `npm run build` → succeeded (full route table compiled).
- Post-commit deletion check → no deletions.

## Next Phase Readiness

- The moat is now legible on the cards: every idea leads with a "Made for you" rationale (KCQ-09), and every gated idea/hook offers honest, opt-in failure-mode foresight (KCQ-04) without breaking the positive-but-honest tone.
- **P12 handoff:** full field-legibility surface (the heavier whyItFits + grounding treatment) is deferred to Phase 12 (D-04); this plan deliberately ships the thin surface only.
- **Carry-over (none code-side):** the flop reveal's CONTENT quality depends on the live rubric-critic verdict (14-02), which is not exercised in this env (no DASHSCOPE_API_KEY). The render wiring, null/absent handling, and opt-in gating are fully unit-tested.

## Self-Check: PASSED

- FOUND: `src/components/thread/__tests__/idea-card-block.test.tsx`
- FOUND: `src/components/thread/idea-card-block.tsx`
- FOUND: `src/components/thread/hook-card-block.tsx`
- FOUND: commit `dd138324` (Task 1 KCQ-09)
- FOUND: commit `0899d8a5` (Task 2 KCQ-04)

---
*Phase: 14-kc-grounding-quality-loop-expansion-the-durable-moat-not-yet*
*Completed: 2026-06-20*
