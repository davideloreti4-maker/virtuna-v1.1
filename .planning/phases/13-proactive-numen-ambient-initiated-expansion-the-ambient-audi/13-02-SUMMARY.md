---
phase: 13-ambient-numen
plan: 02
subsystem: ui
tags: [react, audience-lens, ambient, reaction-at-rest, flat-warm, theme-06, honesty-spine]

# Dependency graph
requires:
  - phase: 09-living-audience
    provides: LensTrigger + AudienceLens (the shipped per-card reaction primitive this promotes), flat-card-reactions cardScrollQuoteReactions (the honest data path + []-collapse degrade)
  - phase: 13-01
    provides: buildReactionPanel + POST /api/tools/react (the type-to-room reaction route; sibling plan, no code dependency for 13-02)
provides:
  - CardReactionAtRest — a shared sub-component rendering the room reacting AT REST (real stop fraction + thin cream-vs-muted sentiment ribbon) inside the existing LensTrigger on each skill card
  - Surface 3 (reaction at rest) shipped on all four generated cards (idea/hook/script/remix) with zero 4-way duplication, reusing the shipped LensTrigger + honest silent degrade
affects: [13-03, 13-04, ambient-presence, spotlight, audience-lens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promote-not-duplicate: a per-card resting readout rendered INSIDE the shipped LensTrigger wrapper (no sibling, no fork) — D-05/D-06 honored"
    - "Honest silent degrade: parse the card's already-emitted fraction with the flat-card-reactions parseFraction contract; return null (render nothing) on unparseable input — in lockstep with the LensTrigger flatPersonas=[] collapse"
    - "flex-col wrapper inside a flex-center LensTrigger row to stack the readout above the verbatim quote without touching the shared trigger"

key-files:
  created:
    - src/components/audience-lens/card-reaction-at-rest.tsx
    - src/components/audience-lens/__tests__/card-reaction-at-rest.test.tsx
  modified:
    - src/components/thread/hook-card-block.tsx
    - src/components/thread/idea-card-block.tsx
    - src/components/thread/script-card-block.tsx
    - src/components/thread/remix-card-block.tsx
    - src/components/thread/__tests__/idea-card-block.test.tsx

key-decisions:
  - "CardReactionAtRest takes only { fraction } and re-parses with the SAME regex contract as flat-card-reactions parseFraction — single honesty gate, no new prop threading (fraction already in scope on every card)"
  - "Stack the readout + blockquote in one `flex w-full flex-col gap-2` block inside the LensTrigger so the UI-SPEC top-to-bottom anatomy (fraction → ribbon → quote) holds WITHOUT forking the flex-center LensTrigger row"
  - "Positive/neutral ribbon reads CREAM (var(--color-foreground)) over a muted track (var(--color-foreground-muted)); zero #FF7F50; coral reserved for the out-of-scope worst-cluster signal only (UI-SPEC §Color)"
  - "Tap seam unchanged (D-05/D-06): no new prop on CardReactionAtRest, LensTrigger NOT forked; Plan 13-04 adds tap-to-focus via a wrapper around each card, not here"

patterns-established:
  - "Surface 3 reaction-at-rest = a promotion of LensTrigger, not a new surface — the resting readout nests inside the same wrapper that already opens the one AudienceLens"
  - "Per-card honesty degrade composes: CardReactionAtRest returns null on bad fraction AND LensTrigger returns plain children on flatPersonas=[] — a no-signal card shows neither ribbon nor a broken cue"

requirements-completed: [AMBIENT-01]

# Metrics
duration: 7min
completed: 2026-06-20
---

# Phase 13 Plan 02: Per-card Reaction at Rest Summary

**Promoted the quiet per-card Lens cue into a resting-state reaction readout — the real `{stop}/{total} stop` fraction + a thin cream-vs-muted sentiment ribbon — on all four generated skill cards via one shared `CardReactionAtRest` rendered inside the shipped `LensTrigger`, with zero new model calls and an honest collapse-to-silence on thin signal.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-20T23:04:00Z
- **Completed:** 2026-06-20T23:11:00Z
- **Tasks:** 2 (Task 1 TDD: RED → GREEN)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Built `CardReactionAtRest` — a single honest, token-correct, ~60-line sub-component that renders the real stop fraction (13px / medium / cream / `tabular-nums`) + a thin `h-[3px] rounded-full` cream-fill-over-muted-track ribbon (fill width = `stop/total`), and renders NOTHING on an unparseable/empty fraction (the honest silent degrade, mirroring `cardScrollQuoteReactions([])`).
- Shipped Surface 3 on all four cards (idea/hook/script/remix) by rendering `CardReactionAtRest` as the first child INSIDE each card's existing `LensTrigger`, immediately above the verbatim quote — no 4-way duplication, the shipped trigger NOT forked.
- Preserved the full honesty spine + determinism gate: zero new model calls (the readout reuses each card's already-emitted `fraction`), ENGINE_VERSION unchanged at 3.19.0, no new `#FF7F50` (THEME-06 token-correct), and the per-card tap still opens the same single `AudienceLens` (D-05/D-06).

## Task Commits

Each task was committed atomically (Task 1 followed the TDD RED → GREEN cycle):

1. **Task 1 (RED): failing test for CardReactionAtRest** - `c056f425` (test)
2. **Task 1 (GREEN): CardReactionAtRest implementation** - `a9ac4cee` (feat)
3. **Task 2: render CardReactionAtRest in all four card blocks** - `276ff266` (feat, includes a Rule 1 test-locator fix)

**Plan metadata:** _(this commit)_ (docs: complete plan)

_Note: Task 1 was TDD — RED (test) then GREEN (feat); no refactor commit was needed (component clean, < 60 lines)._

## Files Created/Modified
- `src/components/audience-lens/card-reaction-at-rest.tsx` - The resting-state reaction readout (stop fraction + thin ribbon); parses the card's fraction with the flat-card-reactions contract and returns null on bad input.
- `src/components/audience-lens/__tests__/card-reaction-at-rest.test.tsx` - 8 tests locking the fraction text, ribbon fill width (60% / 100%), the null-render honest degrade (unparseable + empty), `tabular-nums`, token-correctness (no `#FF7F50`), and no-quote/no-band-chip (no duplication).
- `src/components/thread/hook-card-block.tsx` - Imports + renders `CardReactionAtRest fraction={fraction}` inside the LensTrigger above the blockquote (wrapped in a `flex-col` block).
- `src/components/thread/idea-card-block.tsx` - Same Surface-3 promotion.
- `src/components/thread/script-card-block.tsx` - Same, opener-scoped (Pitfall 5 honesty: the fraction is the opener's, matching the band chip).
- `src/components/thread/remix-card-block.tsx` - Same, adapted-hook-scoped (Pitfall 5 honesty: adapted-hook scroll-stop only).
- `src/components/thread/__tests__/idea-card-block.test.tsx` - Rule 1 fix: disambiguated the now-doubled `7/10 stop` ordering assertion (see Deviations).

## Decisions Made
- **Single `{ fraction }` prop + re-parse with the shared contract.** Rather than thread parsed `stop`/`total` from the cards, `CardReactionAtRest` re-parses `fraction` with the same regex/validation as `flat-card-reactions.ts parseFraction`. `fraction` is already in scope on every card, so no new prop threading; the honesty gate (return null on bad input) lives in one place.
- **`flex-col` wrapper to stack inside the flex-center LensTrigger.** The shipped `LensTrigger` renders children inside a `flex items-center` row. To get the UI-SPEC top-to-bottom anatomy (fraction → ribbon → quote) without forking the trigger (D-05/D-06), the readout + blockquote are wrapped in one `flex w-full flex-col gap-2` block — LensTrigger still receives one logical child and stays byte-identical.
- **Cream ribbon, never coral.** A positive/neutral reaction fill is `var(--color-foreground)` over a `var(--color-foreground-muted)` track; coral would falsely read as alarm (UI-SPEC §Color). Worst-cluster coral is out of scope for v1, so the ribbon stays cream.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Disambiguated a now-stale ordering assertion in the idea-card test**
- **Found during:** Task 2 (rendering CardReactionAtRest in the four cards)
- **Issue:** `idea-card-block.test.tsx` asserts the scroll-quote leads the card by checking `html.indexOf('7/10 stop')` precedes the quote's index — assuming the only `7/10 stop` string is the secondary band chip. Surface 3 legitimately introduces a SECOND `7/10 stop` (the resting readout) ABOVE the quote, so the locator began matching the new readout and the `quoteIdx < fractionIdx` assertion flipped (1525 vs 1107). A DOM-order probe confirmed the actual ordering is correct per UI-SPEC §Surface 3: Surface-3 fraction (937) → ribbon (1085) → quote (1355) → band-chip fraction (1517) → `SIM-1 Flash` (1529). The test's true invariant (quote leads the band-chip row) still holds; only its method of locating "the band fraction" was now ambiguous.
- **Fix:** Anchored the band-fraction assertion on the `SIM-1 Flash` chip row (`lastIndexOf('7/10 stop', bandChipIdx)`) so it targets the secondary band chip unambiguously, and added a complementary assertion that the new Surface-3 readout precedes the quote (the at-rest reaction leads). The test now guards both invariants.
- **Files modified:** `src/components/thread/__tests__/idea-card-block.test.tsx`
- **Verification:** `node ./node_modules/vitest/vitest.mjs run src/components/thread src/components/audience-lens` — 62/62 green; the idea-card suite went 9/9.
- **Committed in:** `276ff266` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug — a stale test locator surfaced by the intended Surface-3 change, not a product defect).
**Impact on plan:** Minimal. The fix preserves the original test's intent (quote-before-band-chip, D-03) and strengthens it (also asserts the at-rest readout leads). No scope creep; no product behavior changed beyond the planned Surface-3 promotion.

## Issues Encountered
- **Source-grep token guard vs doc comments.** The plan's acceptance criterion is `grep "#FF7F50" → nothing`, and one test reads the whole source (comments included). My initial doc comment contained the literal `#FF7F50` ("never the legacy `#FF7F50`") and the literal `scrollQuote`/`blockquote` words, tripping the file-level greps. Reworded the comments to describe the constraint without the literal tokens; the file is now fully grep-clean and all 8 tests pass. Resolved within Task 1, before the GREEN commit's grep checks.

## User Setup Required
None - no external service configuration required (pure client-side UI promotion; no env vars, no routes, no DB).

## Self-Check: PASSED
- `src/components/audience-lens/card-reaction-at-rest.tsx` — FOUND
- `src/components/audience-lens/__tests__/card-reaction-at-rest.test.tsx` — FOUND
- Commit `c056f425` (RED) — FOUND
- Commit `a9ac4cee` (GREEN) — FOUND
- Commit `276ff266` (Task 2) — FOUND
- ENGINE_VERSION — 3.19.0 (unchanged, determinism gate intact)
- `npm run build` — ✓ Compiled successfully
- Regression: thread + audience-lens + board suites — 532/532 green

## Next Phase Readiness
- **Surface 3 is live and honest on all four cards.** The room now reacts at rest (fraction + cream ribbon) the moment a card lands, collapsing to silence on thin signal — "always felt, never summoned" begins at the card.
- **Ready for the persistent presence (Surface 1/2) + spotlight + type-to-room** (Plans 13-03 / 13-04): this plan deliberately did NOT touch focus/tap-to-spotlight. Plan 13-04 adds tap-to-focus via an `onClickCapture` wrapper it places AROUND each card (capture phase fires focus before the LensTrigger opens — both run); `CardReactionAtRest` gained no new prop and the shipped `LensTrigger` was not forked, so that seam is clean.
- **No blockers.** ENGINE_VERSION 3.19.0, zero new model calls, no new dependencies.

---
*Phase: 13-proactive-numen-ambient-initiated-expansion-the-ambient-audi*
*Completed: 2026-06-20*
