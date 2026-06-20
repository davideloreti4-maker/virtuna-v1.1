---
phase: 13-ambient-numen
plan: 03
subsystem: ui
tags: [react, audience-lens, ambient-presence, dot-cloud, spotlight, type-to-room, flat-warm, honesty-spine]

# Dependency graph
requires:
  - phase: 09-living-audience
    provides: AudienceLens (the one shipped Lens every door opens), LensTrigger (the mount precedent), cardScrollQuoteReactions (the honest data path + []-collapse degrade)
  - phase: 13-01
    provides: POST /api/tools/react (the type-to-room reaction route returning { fraction, scrollQuote }) — consumed by the type-to-room input
  - phase: 13-02
    provides: CardReactionAtRest + the per-card LensTrigger promotion (sibling Wave-2 plan; no code dependency for 13-03)
provides:
  - "AmbientPresence — the persistent living-audience presence (Surfaces 1/2/4): a thin always-docked persona-cloud strip that spotlights ONE in-focus concept, idles honestly when nothing is in focus, and carries a type-to-room input firing POST /api/tools/react on explicit submit"
  - "AmbientFocus + AmbientPresenceProps — the focus contract the composer (Plan 13-04) drives the spotlight with (scroll-spy + tap + type-to-room callback)"
affects: [13-04, ambient-numen, spotlight, type-to-room, composer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reuse-not-rebuild presence: the dot-cloud strip derives the PersonaCloud/PersonaGraph visual family (mulberry32 deterministic layout, cream-alpha fill, worst-cluster coral, <animate> pulse gated on reducedMotion, sr-only <ul> mirror) at strip scale — no new visual language"
    - "effectiveFocus = typedFocus ?? focus: a just-typed type-to-room result wins locally (drives subject + dot toning + Lens immediately) over the composer-driven focus prop, while onFocusChange notifies the parent — so all three doors (tap, scroll-spy, type-to-room) open the SAME Lens scoped right"
    - "Honest type-to-room: explicit-submit-only (button/Enter, never keystroke) single POST /api/tools/react; client fetches the SERVER route only (no client-side Qwen); the reaction is ephemeral (never persisted, RESEARCH Open Q3)"
    - "Honesty spine as a render constraint: exactly one labeled `reacting to: {concept}` subject when focused (never aggregated), the calm roster + idle copy when focus=null (never fabricate a reaction to nothing), and the non-red quiet Retry on failure"

key-files:
  created:
    - src/components/audience-lens/ambient-presence-types.ts
    - src/components/audience-lens/ambient-presence.tsx
    - src/components/audience-lens/__tests__/ambient-presence.test.tsx
  modified: []

key-decisions:
  - "AmbientFocus = { conceptText, fraction, scrollQuote } | null (null = honest idle); AmbientPresenceProps = { audience, focus, reducedMotion?, onFocusChange? } — minimal driven contract: the composer (13-04) owns scroll-spy/tap and passes focus down + receives type-to-room focus via the optional callback"
  - "Dot toning mirrors the shipped worst-cluster semantics: when focused, a `stop` persona reads brighter cream (0.7α), a `scroll` dimmer cream (0.28α), and the FIRST scroll slot (the worst) reads var(--color-accent) coral — exactly as PersonaCloud/PersonaGraph paint it; at idle ALL dots are one calm uniform cream (0.45α), no coral on the roster"
  - "effectiveFocus (typedFocus ?? focus) lets the isolated-build type-to-room result drive the spotlight + Lens immediately even when the parent has not yet updated `focus` (built without the composer) — onFocusChange still notifies 13-04"
  - "AudienceLens mounted exactly as LensTrigger does it: heatmap={null} simResults={undefined} flatPersonas={cardScrollQuoteReactions(...)} conceptText={effectiveFocus.conceptText} reducedMotion open onOpenChange — no fork, no restyle (D-05)"
  - "General/empty-personas audience (or a null audience) → the `General audience · default panel` subtitle + a small calm default roster (DEFAULT_ROSTER_DOTS=10); guarded against divide-by-zero on the even-spacing layout (count===1 ⇒ 0.5)"
  - "Coral FORBIDDEN on the container/border/title/subject/liveness (UI-SPEC §Color) — liveness reads via the <animate> motion + cream opacity only; the focus-visible ring is the one allowed accent-on-focus, consistent with shipped CTAs"
  - "Outside-click/Escape collapses the expanded panel — the verbatim composer-controls.tsx L389-403 effect, gated on `expanded` (RESEARCH Open Q2: local component state, not session-persisted)"

patterns-established:
  - "Pattern: the ambient presence is THREE doors into the one shipped AudienceLens (cue tap, type-to-room result, and — in 13-04 — scroll-spy/tap focus), never a fourth Lens; cardScrollQuoteReactions is the single honesty gate for both dot toning and the Lens flatPersonas"
  - "Pattern: comment-strip the source before file-level grep guards in tests (readCode) so honesty-framing prose that NAMES a forbidden token to explain the rule never trips the guard — and reword component comments to avoid the literal token so the literal AC grep also passes"

requirements-completed: [AMBIENT-01]

# Metrics
duration: 12min
completed: 2026-06-20
---

# Phase 13 Plan 03: Persistent Living-Audience Presence + Type-to-Room Summary

**Built `AmbientPresence` — a thin always-docked persona-cloud strip that spotlights ONE in-focus concept with a `reacting to: {concept}` subject (never aggregated), idles honestly when nothing is in focus, and carries a type-to-room input that fires the Wave-1 `POST /api/tools/react` route on explicit submit — every open door routing to the SAME shipped `<AudienceLens>` scoped to the concept, reusing the dot-cloud family + the honest data path + zero new engine. ENGINE_VERSION stays 3.19.0.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-20T21:18:44Z
- **Completed:** 2026-06-20T21:31:29Z
- **Tasks:** 2 (both `type="auto"` — not TDD)
- **Files modified:** 3 (3 created, 0 modified)

## Accomplishments

- **`AmbientPresence` (Surfaces 1/2/4 — D-01/D-02/D-04)** — a persistent thin persona-cloud strip (48px collapsed) that:
  - renders the calibrated roster as cream-alpha dots **always** (the audience felt even between cards), deriving the shipped `PersonaCloud`/`PersonaGraph` visual family at strip scale (mulberry32 deterministic layout, cream-alpha fill, `<animate>` pulse gated on `reducedMotion`, sr-only `<ul>` mirror);
  - **spotlights exactly ONE** in-focus concept with a `reacting to: {concept}` subject (muted prefix + foreground concept, `truncate` one line) and tones the dots to that concept's **real** reaction via `cardScrollQuoteReactions(focus.fraction, focus.scrollQuote)` (the worst scroll slot reads coral, exactly as the shipped clouds paint the worst cluster) — **never aggregating** across concepts (D-02);
  - **idles honestly** when `focus` is null: all dots at one calm uniform cream, NO reaction, the idle copy `Your people are here. Make something — or type a thought to test it.` — it never invents a reaction to nothing (D-01 honesty spine);
  - opens the **ONE shipped `<AudienceLens>`** scoped to the in-focus concept on cue tap (≥44px `role="button"`, Enter/Space), a no-op at idle (D-05 — no fork, no restyle).
- **Type-to-room input (Surface 4, D-04)** inside the expanded panel — a 42px textarea (`Type a thought — see how the room reacts`) + a `Test this →` send disabled until ≥1 non-whitespace char. Reuses the `PersonaChatDrawer` keydown idiom (Enter submits, Shift+Enter newline). On **explicit submit only** (never keystroke): fires **one** `POST /api/tools/react` with `{ text }`, shows `Reading the room…` in an `aria-live="polite"` region, then on success sets the spotlight subject to the typed thought (local `typedFocus` + `onFocusChange` to the composer), tones the dots, shows the honesty caption `A quick SIM read on your {audienceName} — not a full Test.`, and auto-opens the Lens scoped to the thought. On failure: the verbatim honest copy + a **quiet non-red** `Retry →` (cream-secondary) that re-submits the preserved text. **No client-side Qwen** (fetch-only); the reaction is **ephemeral** (never persisted).
- **Honesty + engine posture preserved:** coral FORBIDDEN on the container/border/title/subject/liveness (liveness = motion + cream opacity only); deterministic only (no `Math.random`/`Date.now`); **zero model calls on render/re-focus** (reads driven `focus` data) — the only model call is one explicit type-to-room submit via the server route; **ENGINE_VERSION 3.19.0 unchanged** (pure client work, no engine bytes touched).

## Task Commits

Each task was committed atomically:

1. **Task 1: AmbientPresence shell — dot-cloud strip + spotlight + idle + Lens door** — `f5da07a4` (feat)
2. **Task 2: type-to-room input — explicit-submit Flash reaction (D-04)** — `d50f81d4` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified

- `src/components/audience-lens/ambient-presence-types.ts` — **(created)** The focus contract: `AmbientFocus` (`{ conceptText, fraction, scrollQuote } | null`, null = idle) + `AmbientPresenceProps` (`{ audience, focus, reducedMotion?, onFocusChange? }`). The minimal driven contract the composer (Plan 13-04) supplies.
- `src/components/audience-lens/ambient-presence.tsx` — **(created)** `'use client'` `AmbientPresence`. The persistent persona-cloud strip + spotlight subject + idle state + expand toggle + the type-to-room input, all reusing shipped primitives. Mounts the one `<AudienceLens>` via the `LensTrigger` construct. ~485 lines (under the 500-line CLAUDE.md cap).
- `src/components/audience-lens/__tests__/ambient-presence.test.tsx` — **(created)** 24 happy-dom tests: idle (roster + idle copy + NO subject), focused (exactly one subject, dot count, sr-mirror), General/null audience (subtitle + no crash), Lens-door (opens scoped / no-op at idle), and the full type-to-room flow (disabled-gate, no-fetch-on-keystroke, one POST with the typed text, Enter-vs-Shift+Enter, success → subject + onFocusChange + caption + Lens, loading aria-live, error → verbatim copy + Retry, never error-red) + source token/determinism/no-client-Qwen guards.

## Decisions Made

- **`effectiveFocus = typedFocus ?? focus`** — a just-typed type-to-room result wins locally so the subject/dots/Lens update immediately even in the isolated build (no composer yet); `onFocusChange` still notifies Plan 13-04. This keeps all three doors converging on the one Lens, scoped right.
- **Dot toning mirrors the shipped worst-cluster semantics** — `stop` brighter cream, `scroll` dimmer cream, first scroll slot = `var(--color-accent)` coral (the only data-driven coral, only when focused). Idle = one calm uniform cream, never coral.
- **AudienceLens mounted exactly as `LensTrigger` does it** (`heatmap={null}`, `simResults={undefined}`, `flatPersonas`, `conceptText`, `reducedMotion`, `open`, `onOpenChange`) — byte-identical depth, no fork (D-05).
- **General/empty/null audience** → the `General audience · default panel` subtitle + a small calm default roster; the even-spacing layout guards `count===1 ⇒ 0.5` against divide-by-zero.
- **Local collapsed/expanded state + the verbatim composer-controls outside-click/Escape effect** (RESEARCH Open Q2 — not session-persisted in v1).

## Deviations from Plan

None - plan executed exactly as written.

Both tasks followed the plan's `<action>` and `<acceptance_criteria>` precisely. No Rule 1-4 deviations were needed; no architectural decisions arose. (One non-product test-hygiene adjustment is noted under Issues — it is not a plan deviation.)

## Issues Encountered

- **Source-grep token guards vs honesty-framing doc comments (resolved within each task, before commit).** Three of the plan's `<acceptance_criteria>` are literal source greps (`grep "Math.random|Date.now" → nothing`, `grep "runFlashTextMode|getQwenClient" → nothing`). My doc comments legitimately NAMED those tokens to explain the determinism / no-client-Qwen rules, which tripped both the file-level test greps and a literal `grep`. Following the 13-02 precedent, I (a) reworded the component comments to describe the constraint **without** the literal tokens (so the literal AC grep passes) and (b) made the test guards strip comments first (`readCode`) so they assert against **code**, not prose. The component genuinely makes zero `Math.random`/`Date.now`/client-Qwen calls — these were never product issues, only comment/grep collisions. Resolved before each task's commit; final literal greps are clean.

## User Setup Required

None - no external service configuration required. The component is pure client-side UI; the type-to-room input fetches the already-shipped `POST /api/tools/react` (Plan 13-01), which reuses the existing Supabase auth + Qwen (`FLASH_MODEL`) infrastructure. No env vars, no new routes, no DB.

## Next Phase Readiness

- **The presence is built in isolation and ready for the composer to wire (Plan 13-04).** It is driven entirely by the `focus` prop + `audience` prop and exposes `onFocusChange` for the type-to-room result. Plan 13-04 adds the scroll-spy (IntersectionObserver over `composer-thread-region`) + tap-to-focus + mount in `composer.tsx`, passing `selectedAudience` + `reducedMotion` + the focus state down and listening to `onFocusChange`.
- **All three doors converge on the one Lens** — the cue tap, the type-to-room result, and (in 13-04) the scroll-spy/tap focus all open the same `<AudienceLens>` scoped to their concept (D-05). `cardScrollQuoteReactions` is the single honesty gate.
- **No blockers.** ENGINE_VERSION 3.19.0 held, zero new model calls on render, no new dependencies; `npm run build` green; full audience-lens suite 51/51 green (new ambient-presence 24 + existing 27 unaffected).

## Self-Check: PASSED

- Created files exist: `ambient-presence-types.ts`, `ambient-presence.tsx`, `__tests__/ambient-presence.test.tsx` — all FOUND.
- Commits exist: `f5da07a4` (Task 1), `d50f81d4` (Task 2) — both in `git log`.
- ENGINE_VERSION — 3.19.0 (unchanged; pure client work, no engine bytes touched).
- `npm run build` — ✓ Compiled successfully (exit 0).
- Verification grep (`#FF7F50|255,127,80|Math.random|Date.now|getQwenClient|runFlashTextMode` across both component files) — returns nothing.
- Regression: full `src/components/audience-lens` suite — 51/51 green (6 files: new ambient-presence 24 + existing 27 unaffected).

---
*Phase: 13-proactive-numen-ambient-initiated-expansion-the-ambient-audi*
*Completed: 2026-06-20*
