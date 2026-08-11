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

Task 4 (2026-08-11): remix_blueprints migration + blueprint-repo.ts, 9 tests. 88 -> 97 tests
   (6 files), tsc clean, eslint clean, `npm run build` clean. Red was proven TWICE: first the
   import ("Cannot find module '../blueprint-repo'"), then BEHAVIOURALLY — the brief's own
   Step 4 implementation was written verbatim first and 3 tests failed against it.

🔴 TASK 4: THE MIGRATION IS PENDING HUMAN APPLICATION. Nothing in this commit touched the
   database. `public.remix_blueprints` DOES NOT EXIST until someone pastes
   supabase/migrations/20260810120000_remix_blueprints.sql into the SQL editor and runs it.
   The SQL is UNEXECUTED and hand-reviewed only — there is no postgres in this environment, so
   its syntax has never been parsed by a server. Verified offline instead: 9 statements, quotes
   balanced outside comments, no trailing fragment.
Task 4: DEVIATION — `getBlueprint` no longer returns null on ANY error. The brief's
   `if (error || !data) return null` is wrong in the one way this lane is most exposed to.
   The migration is applied BY HAND, so an unapplied one is a live possibility on any deploy;
   PostgREST answers an unknown table with PGRST205 and an ungranted one with 42501, and
   collapsing either into null gives Task 6 a 404, gives RemixBeats its silent no-render path,
   and prints a remix card with no shoot sheet and NO ERROR ANYWHERE. The feature would look
   unbuilt rather than broken. Now: PGRST116 -> null (the only code that means "no row"; the
   pk makes its >1-row meaning unreachable), everything else throws. Same shape as
   `getAudience` (audience-repo.ts:441), which the brief had silently departed from.
Task 4: DEVIATION — the SELECT names its columns instead of `*`, exported as
   `BLUEPRINT_COLUMNS`. With `*`, a column missing from the table returns `undefined` on a
   successful read; named, it is a PostgREST error, which now throws. The test derives its
   expectation from `Object.keys()` of a `BlueprintRow`-typed literal, so adding a required
   field to the interface fails tsc on the literal and then fails the column test until the
   SELECT is widened. `clip_uris` and `created_at` are deliberately NOT read.
Task 4: DEVIATION — `DROP POLICY IF EXISTS` before `CREATE POLICY`. Postgres has no
   CREATE POLICY IF NOT EXISTS, so the brief's migration ERRORS on a second paste while every
   other statement in it is idempotent. For a file a human applies by hand that is the wrong
   half to leave sharp. Matches library_projects.
Task 4: DEVIATION — `thread_id` gained `REFERENCES public.threads(id) ON DELETE SET NULL`
   (the saved_items idiom; threads.id is uuid, confirmed at 20260617000000:27). SET NULL, never
   CASCADE: derive-and-drop deletes the source mp4, so this row is the only surviving record of
   what that video did and deleting a thread must not destroy it. Residual risk accepted: a
   thread deleted between createOpenThreadLazy and the insert now fails the write instead of
   storing a dangling pointer — same-request, effectively impossible, and non-fatal (Task 5
   catches, strips the id, ships the cards).
Task 4: DEVIATION — `FOR SELECT TO authenticated` rather than an untargeted policy, and the
   brief's rationale for the policy is CORRECTED IN THE FILE. Its comment says RLS-with-no-
   policy makes writes "fail silently" and reads empty — not true for this table: both phase-1
   call sites use `createServiceClient()`, which bypasses RLS entirely. The policy is defence
   in depth for a future user-scoped read, not phase-1 access control. What actually enforces
   ownership today is the repo's `user_id` predicate on the read. Anyone who deletes that
   predicate believing RLS has their back is wrong, and the module header says so.
Task 4: column set VERIFIED IN BOTH DIRECTIONS. Insert: every `BlueprintRow` key is a real
   column, and every NOT NULL column without a default (id, user_id, blueprint) is in the
   interface — so `insert(row)` is complete. script/clip_uris/created_at all carry defaults, so
   the row stays insertable as the table grows. Read: `BLUEPRINT_COLUMNS` is exactly
   Object.keys(BlueprintRow), pinned by a test.
Task 4: note: the call seam was compile-probed, not assumed — a throwaway file passing
   `createServiceClient()` (a TYPED `SupabaseClient<Database>`) into these bare-`SupabaseClient`
   params typechecks clean, and `.from("remix_blueprints")` is fine because the param is
   untyped. Tasks 5 and 6 will not hit a generics wall. Probe deleted before commit.
Task 4: note: tsc caught a `noUncheckedIndexedAccess` error in the new TEST that all 9 tests
   passed straight through — the standing "vitest does not typecheck" trap, live again.
TASK 5 MUST KNOW: `insertBlueprint` throws on ANY write error, which is what the brief's
   try/catch already expects — keep it. `thread_id` is now a real FK, so it must be a genuine
   `threads.id`; a made-up uuid is now a failed insert (loud) rather than a stored orphan.
   `source_video_id` receives a URL, not a canonical video id — documented on the column.
TASK 6 MUST KNOW: `getBlueprint` CAN THROW. The brief's route calls it bare
   (`const row = await getBlueprint(...)`), which is now an unhandled throw -> 500. That is the
   intended outcome for a missing table, but wrap it: catch, `Sentry.captureException`, return
   500. Do NOT catch it back into a 404 — that restores exactly the silence this deviation
   exists to remove. `null` still means 404, and only that.
TASK 7 MUST KNOW: if the migration was never applied, the symptom is NOT an error the user
   sees. The run succeeds, the cards render, and the sheet is absent; the only evidence is one
   `log.warn` + Sentry event from the route's catch. Before blaming the renderer, check the
   table exists.
Task 4: addendum — the formal task assignment named a case the first commit had no test for
   ("a stored row must survive a concept with no script"). Added as a REGRESSION PIN, stated as
   such: it passes against a pass-through repo and always would. `script: [[], [], []]` on an
   `emptyBlueprint()` is the no-video path and nothing may reject it; the obvious future tidy-up
   is a non-empty guard, which would throw on the quietest legitimate case. 97 -> 98.
Task 4: the assignment's line "RLS on with no policy reads as empty and writes fail silently"
   is NOT true of this table and should not be carried forward — it is the brief's claim, and
   both phase-1 call sites use the service client, which bypasses RLS. See the DEVIATION note
   above. The table does NOT constrain beats to MAX_BEATS=8 either, and must not: the cap is
   buildBlueprint's, and a CHECK would break the day D10 is retuned. `blueprint jsonb NOT NULL`
   is what forces emptyBlueprint() rather than NULL for a no-video row. Nothing enforces
   AdaptedBeat.index -> BlueprintBeat.index; that join is the renderer's (Task 6).

TASK 4: MIGRATION APPLIED (2026-08-11), project virtuna-v1.1 / qyxvxleheckijapurisj.
   Applied with the Supabase MCP `execute_sql`, NOT `apply_migration` and NOT `supabase db push`.
   Deliberate: execute_sql is the SQL-editor equivalent and leaves the migration ledger
   untouched, which is the whole point of this project's hand-apply rule. apply_migration would
   have written a remote ledger row into a ledger already known to be drifted.
   Project identity confirmed by CONTENT before writing (threads present at 240 rows,
   remix_blueprints absent) — the .env.local read was denied, so identity was established from
   the table list rather than assumed.
   Verified after, not assumed:
     row_count 0 · rls_enabled t · policy_count 1 (remix_blueprints_select_own:SELECT)
     foreign keys BOTH present — thread_id -> threads, user_id -> auth.users
     index_count 4 (the 3 explicit + the PK)
   NOTE for anyone re-reading the file: dev and prod share ONE Supabase project here, so this
   table is live in production from now on. It is additive DDL — no existing table was touched.
TASK 4: CLOSED.

Task 5 (2026-08-11): runner assembles + stamps, route persists + emits. 98 -> 111 tests
   (700 across the four gate paths), tsc clean, eslint clean, `npm run build` clean
   ("Compiled successfully", /api/tools/remix/run present in the route table). Red was real:
   9 failures across the two files before the implementation — 5 runner (`Cannot read
   properties of undefined (reading 'beats')`, `…(reading 'id')`, `expected undefined to be
   +0`, `expected undefined to be null` x2) and 4 route (the SSE face missing the id, the
   write order `['message']` vs `['blueprint','message']`, insertBlueprint called 0 times,
   the strip leaving `'bp1234567890'` in place). The seam pin passed on the first run, which
   is what it is for.
Task 5: DEVIATION — the blueprint write moved ABOVE `send("content", …)`. The brief put it
   immediately before `insertMessage`, and its own comment says why that is wrong: "a card
   carrying a blueprintId whose row does not exist would render a permanent skeleton". The id
   leaves this process on the CONTENT frame, not on the persisted message, so the brief's
   placement writes the row AFTER the live card is already on the wire carrying it. The
   failure it describes is exactly what the brief's ordering ships — the creator watches a
   sheet that can never resolve, and only a reload fixes it. Proved by mutation: moving the
   block back to the brief's position turns the strip test red with the id still in the frame
   (`"blueprintId":"bp1234567890"` inside `event: content`). The ordering test the brief asked
   for (`['blueprint','message']`) passes either way — it could not have caught this.
Task 5: DEVIATION — new `blueprintVariant` on the block, the runner and the SSE face. ONE row
   serves ALL of a run's ranked cards (one video, one skeleton, N scripts), so the id alone
   does not identify a script. Task 6's brief hard-codes `variantIndex={0}` on every card and
   justifies it with "the runner writes one script array per card in rank order" — which is
   the reason it CANNOT be 0 for cards 2 and 3. Left alone, all three cards render the rank-1
   shoot sheet: a plausible sheet, not a visible bug. TASK 6: read
   `props.blueprintVariant ?? 0`, do not hard-code.
Task 5: DEVIATION — `script[]` is pushed IN LOCKSTEP with `blocks`, not mapped from `rated`
   afterwards as the brief had it. The D-14 gate can `continue` past a card, and a mapped
   array would then be one longer than `blocks` with every later index shifted — each card
   silently rendering its neighbour's sheet. Same class of defect as the variant above.
Task 5: DEVIATION — the decode guard is SPLIT (`if (!structural)` then `if (!decode)`) instead
   of the existing `structural ? await runDecode(structural) : null`. The brief's Step 4 wrote
   an inline `{ duration_s: 0, … }` literal for the no-structural case; the dispatch corrected
   that to `emptyBlueprint()`. Neither is needed: `buildBlueprint` already returns
   `emptyBlueprint()` on a segment-less source, and the only OTHER caller of that branch is a
   null `structural`, which cannot reach it — a null structural returns decode_failed. Folded,
   TypeScript still demands the dead branch (it cannot narrow `structural` from `decode`);
   split, it does not. So the runner imports neither the literal nor the factory, and there is
   no unreachable code pretending to be a fallback. Same two error discriminants, one extra
   warning string.
Task 5: DEVIATION — the route test mocks `@/lib/supabase/service` as well as the repo. Probed,
   not assumed: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are BOTH undefined
   under vitest and `createServiceClient()` throws "supabaseUrl is required." Without the mock
   the route's write takes its non-fatal catch on every run in that file, so all four new tests
   would have asserted the FAILURE path while reading as coverage of the happy one — the
   brief's Step 6 mock list is one module short. (`billUsage` builds its own service client and
   swallows everything, so the stub is inert for it; the pre-existing `[quota] count failed —
   failing open` stderr is unchanged.)
Task 5: DEVIATION — the SSE-face test PARSES the content frame and asserts
   `payload.blocks[0].props.blueprintId`, rather than the brief's `toContain("bp1234567890")`
   on the raw line. A substring match on a frame that also carries the id in some field nobody
   reads is a false pass, and this is the one assertion the lane cannot afford to have lying.
   Load-bearing, proved by mutation: deleting the two face lines from route.ts turns it red
   with `expected undefined to be 'bp1234567890'`.
Task 5: the brief's Step 1 fixture does not compile as written — it annotates an inline literal
   whose `segments` carry `spoken_text`/`on_screen_text`, which `OmniStructuralInput` does not
   declare (blueprint.ts widens them locally), so excess-property checking rejects it. Built
   through a `seg()` helper instead, the way Task 1's own fixture does. vitest would never have
   told us; tsc does.
Task 5: note — `makeStructuralInput()` in the pre-existing runner test carries NO `segments`,
   so every one of the 13 tests that existed before today runs the no-video shape and none of
   them could ever have seen a real blueprint reach adapt. `makeStructuralInputWithSegments()`
   is what covers the normal path; the segment-less case is now asserted deliberately rather
   than by accident.
TASK 6 MUST KNOW: the card carries TWO fields, not one — `blueprintId` AND `blueprintVariant`.
   Render `<RemixBeats blueprintId={…} variantIndex={props.blueprintVariant ?? 0} />`. Both
   ride the SSE content face and both are stripped together when the write fails, so a card
   that has one always has the other. `getBlueprint` CAN THROW (Task 4) — that note still holds.
TASK 7 MUST KNOW: `brief` is now accepted on `POST /api/tools/remix/run` (`z.string().max(200)
   .optional()`) and becomes `AdaptInput.target`. NOTHING IN THE UI SENDS IT — the composer has
   no brief field. A live run therefore exercises `target: null` and the niche fallback unless
   you post the body by hand. Worth one hand-posted run with a brief, because the D3 path has
   never executed against a real model.
Task 5: RESIDUAL, stated rather than omitted — a `remix_blueprints` row is written on every
   successful remix run from now on and NOTHING deletes it. There is no retention story and no
   cascade from `threads` (Task 4 chose SET NULL on purpose). Rows accumulate. Phase 1 does not
   need a policy; someone eventually does.
Task 5: RESIDUAL — the runner is proved against MOCKED omni/decode/adapt. Whether a real
   `analyzeVideoWithOmni` response yields non-empty `segments` at all is unverified here, and
   if it does not, every live card ships with no blueprintId and the feature looks unbuilt with
   nothing red anywhere. That is Task 7's assertion, and it is the one that matters most.
