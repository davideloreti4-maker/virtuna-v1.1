# SDD ledger — plan: docs/superpowers/plans/2026-08-10-remix-shoot-sheet-phase1.md

Worktree: /Users/davideloreti/virtuna-remix-shoot-sheet
Branch: lane/remix-shoot-sheet
BASE at start: be0bb6cda658e614ed5875ca25c3a69dd1c08514

Pre-flight rulings (owner, before Task 1) — commit 19adecfe:
- Task 5 gains 4 route tests (blueprintId on the SSE face, write-order,
  insert-failure fallback, no-blueprint case). Reason: proof/production/
  provenance each shipped missing from that exact face.
- Task 5 step 2 is a SEAM PIN, not a TDD red step. Documented in the plan.
  Carry this to the Task 5 reviewer so it is not flagged as a defect.

CARRY-FORWARD (must reach the named task's dispatch):
- Task 3: add `spoken_text?: string | null` and `on_screen_text?: string | null` to
  OmniStructuralInput["segments"] in decode-types.ts, then DELETE the local type
  widening in blueprint.ts. Two definitions of the same shape will drift otherwise.
  Root cause: the plan's Task 1 code did not compile — verified by the controller.
- Task 7: assert `has_speech === true` on a real talking-head video. If spoken_text
  stops arriving, words_per_second silently goes 0 and the sheet flips to
  on-screen-text-driven. No unit test can catch it — the tests supply their own segments.

PUSH STATE — the branch IS on origin. `git ls-remote origin lane/remix-shoot-sheet`
returns the current head; `.githooks/post-commit` auto-pushes (core.hooksPath).
An earlier controller note claimed the branch was local because `git status -sb`
shows no upstream — that inference was WRONG. `git push origin HEAD` does not set a
tracking ref, so absence of an upstream is not evidence of absence of a push.
Verify pushes with ls-remote, never with status -sb.

Tasks:
1. Blueprint assembly — BASE 19adecfe, implemented 1d25c6e1, 56/56 green,
   tsc clean (controller-verified). 3 deviations, all justified.
   Review: spec ✅, quality NOT approved — 1 Critical, 6 Important, 7 Minor.
   Controller verified the two load-bearing claims: buildFixedBuckets DOES set
   scene_boundary_reason on every cell (normalize-segments.ts:227,240,256), and
   HookFactorSchema.name IS a closed 5-value enum (schemas.ts:63-74).
   OWNER RULING on Important #4: mandatory cut at t=3 in groupSegments;
   MAX_BEATS STAYS 8 (D10 untouched, hook consumes 1 of the 8).
Task 1: fix round 1/5 dispatched (FIX_BASE 1d25c6e1) — findings #1 merge
   degenerates/#2 dead hook-factor branch/#3 weak factors dropped/#4 hook width/
   #5 hook-zone peak kills turn+payoff/#6 final-beat peak kills close/#7 no test
   on the scene_boundary_reason branch.
Task 1: minor (deferred): `cuts` counts cells, doc says boundaries — feeds an LLM prompt + UI.
Task 1: minor (deferred): audio_event keeps only the first cell while visual_event joins all.
Task 1: minor (deferred): has_speech true with words_per_second 0 on a zero-duration grid.
Task 1: minor (deferred): test:70 `.every()` is vacuous — zero turn beats in that scenario.
Task 1: minor (deferred): weak assertions — beats.length only bounded, payoff never asserted,
   on_screen_text join and `improvement_tip ?? rationale` untested, no 8-vs-9 boundary test.
Task 1: minor (deferred): single-beat input gets hook and no close — flag for Task 6 renderer.
Task 1: minor (deferred): payoff unreachable when emotion_arc is absent (slideshow / b_roll).
Task 1: fix round 1/5 (7 addressed, 0 open; commits 1d25c6e1..660ff616). Longest beat on a
   60s fallback grid 45s/75% -> 10s/17%. 11 tests -> 20, written red-first.
Task 1: fix round 2/5 dispatched (FIX_BASE 660ff616) — 4 NEW Importants from the fix diff:
   #A nearestCut has no distance cap, clustered boundaries reproduce the collapse (70% in one
      beat on a talking-head-then-montage shape);
   #B factor placement is order-dependent — Emotional Charge (last in the enum) is displaced
      off `turn` by Share Trigger's fallback claim, defeating what #2 existed to create;
   #C hookCutIndex no-ops when cell 0 is wider than the hook zone — beat 0 = 0-20s labelled
      hook, worse than the case the owner ruling exists to prevent;
   #D CONTROLLER RULING: turn fallback takes the first free beat (always beat 1), so `setup`
      vanishes — falls back to the first free beat at or after the MIDPOINT instead.
Task 1: fix round 2/5 (4 addressed, 0 open; commits 660ff616..73635843). 20 -> 25 tests,
   red-first. Snap radius = half the spread step (cluster 70% -> 15%); two-pass factor
   placement; hookCutIndex returns 1 (beat 0 20s -> 5s); turn falls back to midpoint.
   Re-review dispatched.
Task 1: OPEN RESIDUAL (implementer-flagged, not a review finding): in the degenerate
   cell-0-wider-than-3s shape, beat 0 is 5s and still LABELLED `hook` — opensTheVideo tags
   the first beat whenever it opens inside the zone. Fixing the label needs a cell split,
   which this module does not own. Smaller misstatement chosen deliberately. Task 6 renders it.
Task 1: fix round 2 re-review — all 4 ADDRESSED, MAX_BEATS still 8, integrity intact across
   6000 fuzz trials (0 failures, worst body beat 31.3% vs a 40% threshold). No new
   Critical/Important. Reviewer recommended closing Task 1.
Task 1: fix round 3/5 dispatched (FIX_BASE 73635843) — CONTROLLER OVERRODE the reviewer's
   "out of scope, defer" call on one item:
   #1 the even spread distributes by cell INDEX, not elapsed time. 24 cells (6x20s then
      18x1s) -> longest beat 60s of 138s = 43%, over the module's own 40% assertion, on the
      MODEL path, invisible to every current test. Same symptom as #A/#1 via a third
      mechanism. Deferring it means Task 7 shows a lopsided sheet with no pointer to cause.
      Fix: spread against cumulative duration, not cell index.
   #2 snapRadius comment states ~1.5x; real bound is 2x (2.33x on a rounding collision).
      Comment only — step/2 is DERIVED, not fitted (unique value where a cut cannot cross
      into a neighbouring target's territory).
   #3 pin the accepted 5s-hook residual with a role assertion in its test.
Task 1: reviewer answered both implementer questions in its favour — the 5s-beat-labelled-
   hook trade is correct (splitting a cell fabricates a boundary and breaks the exactly-once
   invariant; a hookless blueprint is worse), and the snap radius is principled.
CARRY TO TASK 6: render t_start/t_end BESIDE the role label, never the label alone. Then a
   0-5s "hook" is self-describing. No blueprint flag needed — the fields already exist.
Task 1: note: snap radius pinned by behaviour tests, not by asserting the constant (correct —
   asserting snapRadius === step/2 would restate the implementation and catch nothing).
Task 1: fix round 3/5 (3 addressed; commits 73635843..2836f36f). Time-space spread: the
   6x20s+18x1s shape went 43% -> 15%. 25 -> 26 tests, new test confirmed red first.
   Controller caught pre-commit that snapRadius was still INDEX space while targets had moved
   to TIME space — the implementer confirmed this was incidental and silently broke the
   derivation (adjacent targets sit at uneven index distances, so a snapped cut could leapfrog
   its neighbour: index gap ~1 against a radius of 1.64). nearestCut now compares seconds.
   Measured on 8000 randomised grids against the ACHIEVABLE FLOOR (widest input cell):
     index space  — >40% cases 296, algorithmically avoidable 178, worst excess 9.7pp
     time space   — >40% cases 249, algorithmically avoidable   0, worst excess 0.0pp

⚠️ CORRECTION — "<=40% longest beat" is NOT a universal invariant, and an earlier ledger line
   ("worst body beat 31.3% across 6000 trials") reads as if it were. 249 of 8000 grids exceed
   it, worst 62.7% — ALL input-limited (e.g. a single 30s cell inside a 49s video). This module
   cannot split cells, so the honest invariant is:
       longest beat <= max(widest input cell, ~2x its even time share)
   TASK 7 IMPLICATION: a real video with one long static cell will produce a lopsided sheet.
   That is expected behaviour, NOT a regression. Do not spend a fix round on it.
Task 1: minor (deferred): weakness.factor stores raw casing/whitespace; Task 6 renders it.
Task 1: minor (deferred): budget under-use when spread targets collide (n=9 -> 7 beats).
Task 1: note: the test file now imports qwen/normalize-segments — a new cross-package test
   dependency (right trade: it tracks the real producer, not a mirror of it).

HELD PENDING #B: the FACTOR_TARGET_ROLE table is with the owner, but must not be ruled on
   until #B lands — the mapping does not currently hold at runtime. Reviewer's steer:
   rewatch potential -> close is the weakest (a whole-video property, and it collides with
   share trigger, which is what forces the fallback); consider `turn` or leaving it unmapped.
2. Echo guard
3. Widen the adapt contract
4. remix_blueprints table + repo
5. Runner + route integration
6. Read route + beat renderer
7. Live verification

OWNER RULING (2026-08-11): FACTOR_TARGET_ROLE — `Rewatch Potential` is UNMAPPED. It is a
   whole-video property with no single home; mapped to `close` it raced `Share Trigger` (which
   genuinely IS about the ending) and won on emission order, pushing Share Trigger to the
   longest-free fallback where it reported a share problem against a mid-video setup beat.
   Unmapped, it takes the fallback itself. Mapping is now 4 entries; placement 4/5 -> 5/5.
   Red-first: new test "gives close to Share Trigger" failed with 'setup' — the exact reported
   symptom — before the mapping changed. The pre-existing 5-factor test asserted the retired
   behaviour and was updated with it. 71 -> 72 tests, remix suite green, tsc clean.
OWNER RULING (2026-08-11): round-3 re-review is NOT re-dispatched. The round-2 reviewer already
   recommended closing Task 1; round 3 was a controller override whose evidence (8000 randomised
   grids, avoidable failures 178 -> 0) is stronger than a review round would produce. The
   73635843..2836f36f diff is FOLDED INTO the whole-branch review before merge — it is saved at
   .superpowers/sdd/2026-08-10-remix-shoot-sheet-phase1/review-73635843..2836f36f.diff and MUST
   be read there. This is the one round in the lane no independent reviewer has seen.
TASK 1: CLOSED.

Task 2 (2026-08-11): echo-guard.ts + 6 tests, commit a63c8002. 72 -> 78 tests, remix suite
   green (5 files), tsc clean, eslint clean. Red-first: "Cannot find module '../echo-guard'".
   NO DEVIATION from the brief — its implementation compiled and passed unaltered. Unusually
   for this lane, the plan-prescribed code carried no bug.

⚠️ Task 2: the ES2017 alarm on `\p{L}` is a FALSE one — do not "fix" the tokenizer regex.
   tsconfig targets ES2017 and unicode property escapes are an ES2018 feature, so the regex
   reads like the third compile-breaking bug the plan handed us. It is not. TS 5.9 gates
   property escapes on the `u` flag, not on `target` — verified both ways in isolation: a
   bogus `\p{NotAReal}` IS rejected (TS1529) at the same target, so the checker is live and
   genuinely accepts `\p{L}\p{N}\s`. Runtime is Node, which has had `\p` since ES2018.

TASK 3 MUST KNOW: `sharedContentTokens(a: string, b: string, exclude?: string)` takes
   NON-nullable strings, but every field Task 3 will feed it is nullable —
   `BlueprintBeat.spoken` is `string | null` (blueprint.ts:59) and the widened `Segment`
   has `spoken_text?: string | null` (blueprint.ts:84). Under `strict` those are a compile
   error at the call site; coalesce with `?? ""`. The runtime guard already returns [] for
   null/undefined — this is purely the signature. The signature was left exactly as the
   brief published it, since Task 3 was planned against that contract; widening it later is
   a one-line change if the call sites turn out to want it.
Task 2: note: numerals survive tokenization ("40" is a content token), so a shared statistic
   counts as a topical echo. Believed correct — a borrowed stat IS the echo we want caught —
   but it is a judgement call the brief did not state, and Task 7 will see it fire on live
   text. Single characters are dropped (`length > 1`), so "5 reps" leaks its number only when
   the numeral is 2+ digits. Both are the stopword approximation working as designed.
Task 2: note: result order follows argument `a`'s token order, which is what makes the
   `toEqual(["creatine"])` assertions stable. Any future dedup/sort would break those two
   tests — that is the guard doing its job, not a flake.
TASK 2: CLOSED.

Task 3 (2026-08-11): the adapt contract carries the timed beat map. 78 -> 88 tests, remix
   suite green (5 files), tsc clean, eslint clean, `npm run build` clean, whole suite 5908
   passing. Red-first: 7 of the 9 new tests failed, incl. "expected 'VIRAL VIDEO STRUCTURAL
   ANATOMY:\nHook...' to contain 'HOOK'" and "expected undefined to be null" on `target`.

⚠️ Task 3: THE BRIEF IS WRONG ABOUT THE ROUTE, and its own back-compat guarantee did not
   hold. It states `/api/remix/adapt` "builds AdaptInput via decodeResultToAdaptInput(decode,
   niche)", so keeping that adapter two-arg was said to be sufficient. The route does NOT use
   the adapter — it builds the object literally at route.ts:139 from its zod-validated body.
   Making `blueprint`/`target` required therefore broke the route, and `npm run build` is what
   would have caught it. FOUR construction sites needed the two new fields, not one:
   route.ts:139, drop-adapt-input.ts:55 (the drops pipe), decodeResultToAdaptInput, and the
   test's makeAdaptInput.
Task 3: kept `blueprint` REQUIRED rather than optional, and that is the load-bearing choice.
   Optional would have let Task 5 wire the runner, forget the blueprint, and ship the old
   concept-only prompt with every test still green. The three callers that genuinely have no
   video now say so: `emptyBlueprint()` (blueprint.ts), a FACTORY not a shared const — `beats`
   is mutable and one instance across three AdaptInputs is a corruption waiting to happen.
Task 3: new `AdaptWireDecode = Omit<AdaptInput, "niche"|"blueprint"|"target">` names the wire
   body, replacing two hand-written `Omit<AdaptInput,'niche'>` (use-adapt-concepts.ts,
   decode.fixture.ts) that would each have had to be widened by hand. `blueprint` is
   SERVER-SUPPLIED on purpose: it reaches the prompt as verbatim text, so accepting a
   client-declared one is a prompt-injection lane straight past the D-01 wire guard (T-04-04).
Task 3: DEVIATION — `max_tokens` was 1200 and is now `beats.length > 0 ? 3000 : 1200`. Three
   concepts x MAX_BEATS(8) script entries x ~65 tokens is ~1560 tokens ON TOP of the ~600 the
   concepts already cost; at 1200 every real video truncates mid-JSON, fails the parse, and
   retries into the same truncation — adapt_failed on the whole feature. The concept-only
   callers keep their exact existing budget. TASK 7 WATCH ITEM: this trades truncation for
   latency against the 90s TIMEOUT_MS. If live runs abort, the timeout is the next dial, not
   the token cap.
Task 3: DEVIATION — added `stripInvalidScript`, the `stripPartialProduction` treatment for the
   new field. A script is up to 8 entries of 4 required fields each, so the fumble the
   production block cost us live (adapt.ts:100-107, two shelf rows) is strictly likelier here,
   and failing the response would trade 3 valid concepts for a garnish. All-or-nothing per
   concept: half a sheet reads as a bug, a missing one reads as a missing feature. It shares
   `ScriptZodSchema` with the parse so the two cannot drift.
Task 3: the "drops a malformed script" test is the ONE test here not written red-first — it was
   written after its implementation. Red was proven by mutation instead: removing the
   `stripInvalidScript` call makes it fail with "Target cannot be null or undefined" (the whole
   response goes null). Stated rather than omitted.
Task 3: HAZARD 1 (silent narrowing of the local `Segment` widening in blueprint.ts:83) DID NOT
   ARISE — the canonical `OmniStructuralInput["segments"]` was not touched. `spoken_text` /
   `on_screen_text` still have exactly one declaration, the local one. Anyone later adding them
   to decode-types.ts must delete that local widening in the same change: adding them
   NON-nullable intersects to a silent narrowing, with no compile and no test failure.
Task 3: HAZARD 2 (nullable args to `sharedContentTokens`) is NOT Task 3's — grep says the only
   planned call site is task-7-brief.md:32. Left the signature alone. TASK 7 NEEDS: `spoken` is
   `string | null` on `BlueprintBeat` but plain `string` on `AdaptedBeat`, so the call is
   `sharedContentTokens(sourceBeat.spoken ?? "", adaptedBeat.spoken)` — coalesce the SOURCE side
   only.
Task 3: fixture honesty — the brief's `weakness.factor: "pacing"` is a name HookFactorSchema
   cannot emit (the same defect that hid a dead branch in Task 1). Used "Completion Pull",
   which FACTOR_TARGET_ROLE maps to the `setup` beat the fixture puts it on.
Task 3: note: two of the nine tests ("falls back to niche when target is null", "omits the beat
   map entirely") passed BEFORE the implementation — they assert the pre-D2 behaviour still
   holds, so a trivial pass is what they are for. They are regression pins, not drivers.
Task 3: note: `decode-types.ts` now imports a VALUE (`emptyBlueprint`) from `blueprint.ts`,
   which imports back from `decode-types.ts` — but `import type` only, so it erases and there is
   no runtime cycle. Keep it that way: a real value import back into blueprint.ts closes the
   loop.
TASK 4 MUST KNOW: what you persist is `SourceBlueprint` (blueprint.ts) — `duration_s`,
   `words_per_second`, `has_speech`, `beats[]`. The adapt side of the round trip is
   `AdaptedBeat[]` on `AdaptConcept.script`, OPTIONAL, so a stored row must survive a concept
   that has no script at all. `emptyBlueprint()` is the honest "no video" row, not NULL.
