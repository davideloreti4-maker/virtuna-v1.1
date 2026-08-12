# HANDOFF — Remix Shoot Sheet lane (2026-08-10)

**Worktree:** `~/virtuna-remix-shoot-sheet` · **Branch:** `lane/remix-shoot-sheet`
**Pushed to origin** (`.githooks/post-commit` auto-pushes). 6 ahead of `origin/main`, 5 behind.
**Base:** branched from `feat/apify-first-sourcing`, merged up to `origin/main` `a8ccfbf4`.

> ⚠️ **`git status -sb` shows no upstream and that is NOT evidence the branch is unpushed.**
> `git push origin HEAD` does not set a tracking ref. Verify with
> `git ls-remote origin lane/remix-shoot-sheet`. This cost a wrong claim twice in session.

---

## Why this lane exists

Owner's framing: the highest-value workflow in Maven is **find an outlier → remix it
faithfully → post**. Investigation found that path is **already built end to end** —
`/feed` → outlier tile's coral "Remix → Read" CTA → `useRemixLaunch` → `/api/tools/remix/run`
→ remix-card in the thread. Nothing about the path needs building.

The problem is the artifact at the end of it: three free-floating text concepts, not a
reproducible copy.

### The finding the whole lane rests on

`analyzeVideoWithOmni` **already returns** everything needed for a faithful copy, on every
remix run, already paid for — and it is all discarded before adapt sees it.

Per segment (`omni-analysis.ts:197-207`): `t_start`, `t_end`, `visual_event`, `audio_event`,
`scene_boundary_reason`, `spoken_text`, `on_screen_text`. Plus `hook_verbatim`, `emotion_arc[]`,
and `factors[]` with `improvement_tip`.

It dies at two collapse points: `runDecode` → 4 prose beats, then
`decodeResultToAdaptInput` → 6 strings. **Fidelity is a contract widening, not new
infrastructure, and it costs zero additional model spend.**

---

## Documents (read in this order)

1. `docs/superpowers/specs/2026-08-10-remix-shoot-sheet-design.md` — the design. 10 owner
   decisions, 2 deliberate policy reversals.
2. `docs/superpowers/plans/2026-08-10-remix-shoot-sheet-phase1.md` — phase 1, 7 tasks, TDD.
3. `.superpowers/sdd/2026-08-10-remix-shoot-sheet-phase1/progress.md` — **the live ledger.
   Trust this and `git log` over any summary, including this file.**

---

## Owner decisions (locked)

| # | Decision |
|---|---|
| D1 | Fix the artifact, move no surfaces. `/feed`, `/home`, `/start` untouched. |
| D2 | Fidelity covers structure, wording, style AND recording. A narrower structure-only option was offered and rejected. |
| D3 | Pre-brief: one optional free-text line. When present it **replaces** the profile niche as the adaptation target. |
| D4 | Simulation ranks, never gives an absolute verdict. |
| D5 | In-chat editing must not re-run the pipeline. |
| D6 | Shoot sheet carries frames AND 2–4s muted clips per beat. |
| D7 | `derive-and-drop` is amended to permit those clips. |
| D8 | D-01's content-leak guard is reversed for the wording lane. |
| D9 | Blueprints persist in their own table, not inline on the block. |
| D10 | Raw segments merge to **at most 8 beats**. |
| — | Mandatory cut at t=3s; **`MAX_BEATS` stays 8** (hook consumes one of the eight). |
| — | Task 5 gains 4 route tests; its step-2 seam pin is deliberate, not broken TDD. |

### Two prior owner decisions this lane deliberately overrules

- **`D-01`** (`decode-types.ts:155`) kept the source's content out of `AdaptInput` at compile
  time. D2 requires adapt to see `spoken_text`. Replaced by the echo guard (Task 2).
- **`derive-and-drop` / `T-03-02`** (`resolve-and-rehost.ts:66`, "source media is not owned")
  — enforced across 3 test files. Phase 4 amends it for ≤4s muted fragments.

### Consistent with

`docs/DECISION-outlier-corpus-2026-08-07.md` — curated shared corpus, not per-user scraping.
This lane touches no sourcing.

---

## Where execution actually is

**Task 1 of 7. Nothing else has started.** Briefs for all 7 are staged in the workspace.

| Task | State |
|---|---|
| 1 Blueprint assembly | implemented; fix round 2 of 5 done, re-review in flight |
| 2 Echo guard | brief staged |
| 3 Widen adapt contract | brief staged |
| 4 `remix_blueprints` + repo | brief staged |
| 5 Runner + route integration | brief staged |
| 6 Read route + beat renderer | brief staged |
| 7 Live verification | brief staged |

### Commits

```
73635843 fix round 2 — snap radius, two-pass factors, hookCutIndex, midpoint turn
660ff616 fix round 1 — merge collapse, real factor names, turn+close always assigned
1d25c6e1 feat — timed blueprint
19adecfe docs — pre-flight rulings
be0bb6cd docs — phase 1 plan
eb2dfaa4 docs — spec review applied
ba39917c docs — design spec
```

Only file built so far: `src/lib/engine/remix/blueprint.ts` + its 25 tests.

---

## What review caught (the reason task 1 took 2 fix rounds)

The plan's own code carried two bugs into the implementation:
- it read `spoken_text` / `on_screen_text` off `OmniStructuralInput["segments"]`, which
  **does not declare them** — would not compile. Fields exist at runtime
  (`decode.ts:256` passes by reference); the TYPE is narrower than the data.
- its `t_start < 3` hook rule failed the plan's **own** test 6.

Then, across two review rounds:
- the merge collapsed **75%** of a 60s video into one beat on the `buildFixedBuckets`
  fallback path (which stamps `scene_boundary_reason` on *every* cell);
- the fix fixed that path and **reintroduced the same collapse** on clustered boundaries
  (70% in one beat on an ordinary talking-head-then-montage shape);
- `/hook|open|first/i` could never match — `HookFactorSchema.name` is a **closed 5-value
  enum**, so a 2/10 Scroll-Stop Power landed on a setup beat;
- factor placement was order-dependent, displacing `Emotional Charge` off `turn`;
- `hookCutIndex` no-opped exactly where overrun was worst — beat 0 = 0–20s labelled `hook`;
- the turn fallback took beat 1, erasing `setup` entirely.

**Lesson worth carrying:** each round's tests only prove the shapes they test. The hook bug
was caught because a test exercised it; the merge bug survived because no test set
`scene_boundary_reason`.

---

## OPEN — needs the owner

**1. `FACTOR_TARGET_ROLE` mapping.** Now unblocked (it did not hold at runtime until round 2).
Real output, 60s fallback grid, peak at 30s, all five factors weak:

```
beat 0   0-3 s  hook    Scroll-Stop Power
beat 1   3-11s  setup   Completion Pull
beat 2  11-19s  setup   Share Trigger      <- fallback, wanted close
beat 3  19-27s  setup   -
beat 4  27-37s  turn    Emotional Charge
beat 5  37-45s  payoff  -
beat 6  45-53s  payoff  -
beat 7  53-60s  close   Rewatch Potential
```

4 of 5 land where intended. `Share Trigger` wants `close`, loses it to `Rewatch Potential`,
and ends up reporting a share problem against a setup beat at 11–19s.

**Proposed (one line, gives 5/5):** unmap `Rewatch Potential` — it is a whole-video property
with no single home — handing `close` to `Share Trigger` and sending Rewatch to longest-free.
Both the reviewer and the implementer independently reached this. **Needs a ruling.**

**2. Task 4 migration must be applied by hand.** `supabase db push` is unsafe here (ledger
drift). SQL is in the plan; verification queries for RLS are in Task 4 Step 6. A table with
RLS on and no policy reads as empty and writes fail silently.

---

## Known residuals carried forward

- **Degenerate shape:** beat 0 can be 5s and still *labelled* `hook` (`opensTheVideo` tags the
  first beat whenever it opens inside the zone). Fixing the label needs a cell split this
  module does not own. Deliberate smaller-misstatement choice. **Task 6 renders this label.**
- **Snap radius is a tuned heuristic** — the two cluster tests pin behaviour, not the number.
- **Everything so far is synthetic.** No real omni response has touched this code.
- **Carry to Task 3:** add `spoken_text?: string | null` and `on_screen_text?: string | null`
  to `OmniStructuralInput["segments"]` and **delete the local widening in `blueprint.ts`**, or
  the two definitions drift. If Task 3 adds them non-nullable, the intersection silently
  narrows instead of erroring.
- **Carry to Task 7:** assert `has_speech === true` on a real talking-head video. If those
  fields stop arriving, `words_per_second` silently goes 0 and the sheet flips to
  on-screen-text-driven. No unit test can catch it — the tests supply their own segments.

### Deferred minors (for the final whole-branch review)

`cuts` counts cells while its doc says boundaries (feeds an LLM prompt + UI) · `audio_event`
keeps only the first cell while `visual_event` joins all · `has_speech: true` with
`words_per_second: 0` on a zero-duration grid · vacuous `.every()` at the old test:70 ·
weak assertions (beat count only bounded, payoff never asserted, `on_screen_text` join and
`improvement_tip ?? rationale` untested, no 8-vs-9 boundary test) · single-beat input gets
`hook` and no `close` · `payoff` unreachable when `emotion_arc` is absent (slideshow/b_roll) ·
`weakness.factor` stores raw casing/whitespace · budget under-use when spread targets collide
(n=9 → 7 beats) · test file now imports `qwen/normalize-segments`, a new cross-package
test dependency.

---

## THE GATE — Task 7

Phase 1 exists to answer one question: **does a duration-matched, beat-mapped remix actually
read as a faithful copy?**

Stop conditions, both hard:
1. `spoken_text` arrives null on a real talking-head video → the core input assumption is
   wrong, phase 1 does not work, **do not proceed to phase 2**.
2. Echo check shows >1 shared content token per beat between source and adapted line → the
   D-01 reversal has failed and the model is paraphrasing the source's topic.

Phases 2–5 (pre-brief + the two bug fixes, frames, clips + the policy amendment,
`revise_remix`) are **not started and not planned in detail**. Phase 4 is the only one
carrying the `derive-and-drop` reversal — if phase 1 doesn't feel like a cheatcode, that cost
is never paid.

---

## Two bugs found in passing, still unfixed (phase 2 scope)

- `/api/discover` + `/api/tools/explore` still call `rankOutliers`, whose baseline is the
  median of the returned set — the same video prints 1.4× or 28.4× purely from
  `resultsPerPage`. `src/lib/discover/author-baseline.ts` has the fix; the call sites were
  never switched. **The label must change with the basis**: `"vs their lifetime average"`,
  never `"vs their usual views"`.
- `use-remix-launch.ts:33` never checks `res.ok`, and `fetch` does not throw on HTTP status.
  A 402 credit refusal or 401 navigates to `/home` with no card and no message. `pendingId`
  also never clears on success.
