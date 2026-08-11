# Task 1 report — Blueprint assembly

**Status:** DONE_WITH_CONCERNS
**Commit:** see below
**Branch:** `lane/remix-shoot-sheet` (worktree `/Users/davideloreti/virtuna-remix-shoot-sheet`)

## What I built

Two files, nothing wired:

- `/Users/davideloreti/virtuna-remix-shoot-sheet/src/lib/engine/remix/blueprint.ts`
- `/Users/davideloreti/virtuna-remix-shoot-sheet/src/lib/engine/remix/__tests__/blueprint.test.ts`

`buildBlueprint(structural: OmniStructuralInput): SourceBlueprint` — a pure function, no I/O, no model
call, no new dependency. Exports `SourceBlueprint`, `BlueprintBeat`, `BeatRole`, `MAX_BEATS = 8`.

It merges the raw segment grid down to at most 8 beats (preferring real `scene_boundary_reason`
cuts, falling back to an even spread), assigns each beat a role, joins verbatim speech across
merged cells, computes `words_per_second` / `has_speech`, and attaches low-scoring factors as
per-beat weaknesses.

`MAX_BEATS = 8` is a hard non-configurable constant, per D10. I did not touch `decode-types.ts`,
the runner, or anything else.

## TDD sequence actually followed

1. Wrote the test file first. Ran it: **FAIL — `Cannot find module '../blueprint'`**. Correct red.
2. Implemented `blueprint.ts` with the brief's logic verbatim, changing only what the compiler
   forced. Ran it: **10 passed, 1 failed** — see Deviation 3, which this step is what exposed.
3. Fixed the hook rule. Ran it: **11 passed**.
4. `npx tsc --noEmit`: clean.

## Deviations from the brief's code

Three. The first two are forced by this repo's compiler settings; the third is a real defect in the
brief's logic that its own test caught.

### 1. Local widened `Segment` type (forced — the brief's code does not compile)

The brief's implementation reads `s.spoken_text` and `s.on_screen_text`, but the `segments` element
type declared in `decode-types.ts:83-90` has neither field. I was told Task 3 owns that file, so I
widened locally instead:

```ts
type Segment = NonNullable<OmniStructuralInput["segments"]>[number] & {
  spoken_text?: string | null;
  on_screen_text?: string | null;
};
```

I verified this is necessary rather than decorative, with a throwaway probe file compiled against
the real tsconfig (probe deleted afterwards):

```
__probe-segment.ts(3,34): error TS2339: Property 'spoken_text' does not exist on type
'{ t_start: number; t_end: number; visual_event: string; audio_event: string;
   scene_boundary_reason?: string | undefined; is_hook_zone?: boolean | undefined; }'.
```

I then confirmed the fields are genuinely present **at runtime**, so the widening reads real data
and not `undefined`:

- `qwen/schemas.ts:112` `SegmentSchema` declares `spoken_text` and `on_screen_text`
  (`.max(500).nullable().optional()`), with a comment explaining they are declared on the exported
  schema precisely so they survive transport.
- `qwen/omni-analysis.ts:260` `normalizeSegments(...)` → `:316` `segments: normalizedSegments`.
- `remix/decode.ts:256` maps `segments: omni.segments` — a **reference pass-through**, not a
  field-by-field reconstruction. Nothing strips the properties.

So the gap is purely in the static type. **This is the one thing Task 3 should fix properly**: add
`spoken_text?: string | null` and `on_screen_text?: string | null` to
`OmniStructuralInput["segments"]` and delete my local widening.

### 2. Non-null assertions for `noUncheckedIndexedAccess` (forced)

This repo sets `"noUncheckedIndexedAccess": true`. Every indexed access in the brief's code — and in
its test file — is `T | undefined` and fails to compile as written. I added `!` at the sites where
non-emptiness is already established (`groups` is `.filter(g => g.length > 0)`'d; `arc[0]!` sits
behind `arc.length`; `beats[0]!` behind the early return). No runtime behaviour changed. This
matches existing repo style (`normalize-segments.ts` uses `segments[i]!`, `adapt.test.ts:113` uses
`result![0]`).

Note this is exactly the failure mode CLAUDE.md warns about: **vitest does not typecheck**. The
tests were green before `tsc` was run.

### 3. The hook rule — a genuine bug in the brief, caught by the brief's own test 6

The brief tags a beat as hook with `b.t_start < 3`. Test 6 feeds `seg(2, 6)` as beat 1. `2 < 3`, so
beat 1 becomes `hook`, but the test requires everything between the hook and the turn to be `setup`:

```
FAIL > tags the final beat close, and splits the rest setup/payoff around the turn
AssertionError: expected false to be true
 ❯ blueprint.test.ts:95:73
     expect(bp.beats.slice(1, turnIdx).every((b) => b.role === "setup")).toBe(true);
```

I implemented the brief verbatim first specifically to confirm this rather than assume it. Fix — a
beat is a hook when it lies inside the 3s window, with beat 0 always qualifying if it opens there:

```ts
const opensTheVideo = i === 0;
const whollyInZone = b.t_end <= HOOK_ZONE_END_S;
if (b.t_start < HOOK_ZONE_END_S && (opensTheVideo || whollyInZone)) roles[i] = "hook";
```

**This changes nothing in production.** `enforceHookZoneBoundary` (`normalize-segments.ts:119`)
splits any raw segment straddling the 3s line, so for normalized input `t_start < 3` and "wholly
inside the zone" are the same set. The rules diverge only on a *merged* beat that spans the
boundary — which is a case this module newly creates — and there, calling 2s→6s "the hook" would
swallow four seconds of body. The `opensTheVideo` clause guarantees a hook still exists when the
first beat spans the whole window.

I also hoisted the bare `3` into `const HOOK_ZONE_END_S = 3` mirroring the normalizer's constant.

## Verification

Test command and result:

```
$ npm test -- src/lib/engine/remix/__tests__/blueprint.test.ts
 Test Files  1 passed (1)
      Tests  11 passed (11)
   Duration  475ms
```

Whole remix engine directory, to confirm nothing regressed:

```
$ npm test -- src/lib/engine/remix/__tests__/
 Test Files  4 passed (4)
      Tests  56 passed (56)
```

Typecheck:

```
$ npx tsc --noEmit
TSC_EXIT=0   (zero lines of output)
```

Baseline `tsc` on the worktree was clean before I started, so exit 0 is attributable.

## What worried me

1. **The `spoken_text` type gap is load-bearing for Task 3.** If Task 3 widens
   `OmniStructuralInput["segments"]`, it should delete my local `Segment` widening in the same
   change, or the two definitions will drift. If Task 3 *doesn't*, my widening is what keeps the
   speech fields readable and must stay.

2. **`words_per_second` degrades silently, it does not fail.** If `spoken_text` ever stops arriving
   (a schema change, a mapper that reconstructs rather than passes through), `has_speech` goes
   `false` and `words_per_second` goes `0` on every video, and the shoot sheet quietly turns
   on-screen-text-driven for talking-head sources. No test can catch that, because the test supplies
   its own segments — it is exactly the mock-shaped blind spot CLAUDE.md flags. Task 7's live
   verification should assert `has_speech === true` on a real talking-head video. I'd treat that as
   the single most valuable live check for this module.

3. **The role assignment is unverified against real perception.** Every test here uses synthetic
   segments. The merge arithmetic and the ms→s conversion are genuinely exercised, but whether
   "emotion peak = the turn" produces a *sensible* turn on real videos is not something these tests
   can establish. It is a heuristic, and it is the kind of thing that reads as correct in a unit
   test and looks arbitrary on a real shoot sheet.

4. **Minor:** `duration_s` is measured as last beat `t_end` minus first beat `t_start`, i.e. the
   span the segment grid covers, not the video's true length. These coincide for normalized input
   (the grid is built from the video duration) but they are not the same quantity, and
   `words_per_second` is derived from it.

---

# Fix round 1 — findings #1–#7

**Status:** DONE
**FIX_BASE:** `1d25c6e1`
**Scope:** all 7 findings fixed. The 7 deferred minors were left alone, with one unavoidable
overlap noted below.

## Verification first

```
$ npm test -- src/lib/engine/remix/__tests__/blueprint.test.ts
 RUN  v4.1.10 /Users/davideloreti/virtuna-remix-shoot-sheet
 Test Files  1 passed (1)
      Tests  20 passed (20)
   Duration  301ms
```

```
$ npm test -- src/lib/engine/remix/__tests__/ src/lib/engine/qwen/__tests__/
 Test Files  6 passed (6)
      Tests  86 passed (86)
```
(qwen included because the new test now imports the real `buildFixedBuckets`.)

```
$ npx tsc --noEmit
TSC_EXIT=0    (zero output)
```

11 tests → 20. I wrote the new tests first and confirmed **8 red** before touching the
implementation. The red output is the independent reproduction of the review's measurements:

| Finding | Red assertion |
|---|---|
| #1 | `expected 45 to be less than or equal to 24` — one beat spanning 45s of a 60s video (75%) |
| #2 | `expected null to deeply equal { factor: 'Scroll-Stop Power', … }` — hook beat had no weakness |
| #3 | `expected [ … ] to have a length of 2 but got 1`, and `length of 5 but got 1` |
| #5 | `expected [ 'hook', 'setup', 'setup', …(2) ] to include 'turn'` — no turn, no payoff |
| #6 | `expected 'turn' to be 'close'` — close suppressed |

## Claims I re-verified independently before implementing

- **#1 premise — confirmed.** `buildFixedBuckets` sets `scene_boundary_reason` on every cell it
  emits: `"fixed_bucket_hook_zone"` (`normalize-segments.ts:227`), `"fixed_bucket"` (`:240`),
  `"fixed_bucket_short"` (`:256`). The ≥8s path emits a 0–3s hook cell then 2s buckets, so a 60s
  video is exactly 30 cells — matching the review's figure.
- **#2 premise — confirmed.** `HookFactorSchema.name` (`qwen/schemas.ts:63-74`) is
  `z.enum(["Scroll-Stop Power","Completion Pull","Rewatch Potential","Share Trigger","Emotional
  Charge"])`. `/hook|open|first/i` matches none of the five.

## What changed

### #1 — merge no longer degenerates (`groupSegments`, rewritten)

Was: keep the earliest `MAX_BEATS-1` preferred boundaries. Now: spend the budget as one hook beat
plus an even spread across the body, each spread target **snapped to the nearest real
`scene_boundary_reason`** still free (`nearestCut`). This keeps the "prefer a real cut" intent
without letting a dense run of boundaries at the start eat the whole budget.

On `buildFixedBuckets(60)`: cuts land at cells `[1,5,9,13,18,22,26]`; the longest beat is 10s
(17% of the video) against 45s (75%) before. Timeline continuity and total `cuts` are asserted in
the same test.

### #4 — 3s is now a mandatory cut (`hookCutIndex`)

Per the owner ruling. `MAX_BEATS` stays 8; the hook consumes one, the body gets 7.

One case the ruling did not specify, which I had to decide: **a grid with no boundary exactly on
3s.** Cutting at the first cell with `t_start >= 3` would push the opening beat *past* 3s — the
exact misstatement #4 exists to prevent — so I cut at the boundary *before* it instead. The hook
beat is then shorter than 3s rather than longer. Normalized input always has the exact boundary
(`enforceHookZoneBoundary`), so this only fires on degenerate input, but it is covered by a test.

### #2 — factor→beat mapping by the real enum (`FACTOR_TARGET_ROLE`)

```
scroll-stop power → hook      completion pull → setup     emotional charge → turn
share trigger     → close     rewatch potential → close
```
Keys are lower-cased because `omniOutputToStructuralInput` (`decode.ts:238`) casts `factors`
through `as unknown` without re-validating, so casing is not actually guaranteed at this boundary.

These five role assignments are a **judgment call**, not something the schema dictates.
Scroll-Stop→hook and Emotional Charge→turn are near-tautological; Completion Pull→setup,
Share Trigger→close and Rewatch Potential→close are defensible but arguable. Flagging them
explicitly because Task 6 renders the result and the owner may have a view.

### #3 — no weak factor is dropped

Candidate list = beats with the wanted role, then all beats longest-first; take the first with
`weakness === null`. Two tests: two factors competing for `close` both land; all five factors land
on five distinct beats.

### #5 / #6 — role order and turn fallback (`assignRoles`)

`close` is now claimed **before** the turn — the turn is a heuristic, the close is structural, and
a climax-at-the-end video was shipping a sheet with no closing beat. The turn then walks peaks
strongest-first (`peaksDesc`) and takes the first free beat, falling back to the first free beat
overall.

**Scoping decision:** the fallback only runs when `emotion_arc` is non-empty. Inventing a turn on
a source with no emotion data would be fabrication, and it would also silently fix the deferred
minor "payoff unreachable when emotion_arc is absent" — which I was told not to touch. So a
no-arc source still gets no turn, exactly as before.

### #7 — the untested branch

Covered by `distributes the timeline when EVERY cell declares a scene boundary (fallback grid)`.
The input is the **real `buildFixedBuckets`**, imported from `../../qwen/normalize-segments`, not
a hand-rolled mirror — so the test tracks the real fallback shape if it ever changes, and the
premise itself is asserted (`> MAX_BEATS * 3` cells, every cell carrying a boundary).

## Deferred minors — one unavoidable overlap

I left all seven alone except one that could not be avoided: the vacuous `.every()` at old
test:70. The required test "a hook-zone peak still yields a turn and a payoff" makes that
scenario produce a turn, so I added the matching `some(role === "turn")` assertion in the same
test. It stops being vacuous as a direct consequence of fixing #5, not as a separate change.

## Still open

1. **The five factor→role assignments are my judgment** (see #2 above). Worth an owner glance
   before Task 6 renders them.
2. **`MAX_BEATS` is now effectively 1 hook + 7 body.** If a later task wants finer body
   resolution, the cap — not the hook — is the thing to renegotiate, and it is tied to the 90s
   timeout.
3. **Everything here is still synthetic.** The merge geometry is now exercised against a real
   producer's output, which is a genuine improvement, but no real video has been through this.
   The Task 7 concern from round 1 stands unchanged: assert `has_speech === true` on a real
   talking-head source.
4. **Correction to the controller's correction.** The round-1 report said the post-commit hook
   pushed the branch. `git ls-remote origin lane/remix-shoot-sheet` returns
   `1d25c6e19f5bffaf756baa6018769f62eb9e83b7 refs/heads/lane/remix-shoot-sheet` — the commit **is**
   on origin. `git status -sb` shows no upstream because `git push origin HEAD` does not set a
   tracking ref; that is not evidence the push did not happen. The branch is remote, and this fix
   commit will be pushed by the same hook.

---

# Fix round 2 — findings #A–#D

**Status:** DONE
**FIX_BASE:** `660ff616`
**Scope:** all 4 findings fixed. Deferred minors untouched this round (including the two new ones:
raw casing on `weakness.factor`, and budget under-use on collision).

## Verification first

```
$ npm test -- src/lib/engine/remix/__tests__/blueprint.test.ts
 Test Files  1 passed (1)
      Tests  25 passed (25)

$ npm test -- src/lib/engine/remix/__tests__/ src/lib/engine/qwen/__tests__/
 Test Files  6 passed (6)
      Tests  91 passed (91)

$ npx tsc --noEmit
TSC_EXIT=0    (zero output)
```

20 tests → 25. Written red-first; **5 red** before any implementation change, independently
reproducing all four measurements:

| Finding | Red assertion | Review's figure |
|---|---|---|
| #A tight cluster | `expected 34 to be less than or equal to 24` | 2–36s, 57% ✓ |
| #A late cluster | `expected 42 to be less than or equal to 24` | 3–45s, 70% ✓ |
| #B | `expected 'setup' to be 'turn'` (Emotional Charge) | displaced to setup ✓ |
| #C | `expected 20 to be 5` | beat 0 = 0–20s ✓ |
| #D | `expected [ 'hook', 'turn', 'payoff', …(5) ] to include 'setup'` | no setup ✓ |

## What changed

### #A — snap radius on `nearestCut`

Added a `maxDistance` parameter, set to **half the even-spread step** (`span / (wanted + 1) / 2`).
A boundary is honoured when it is genuinely near the target; otherwise the target itself is cut.
This bounds any beat at roughly 1.5× its even share, which is what the acceptance assertion
(`longest <= duration * 0.4`) actually needs.

Both measured shapes now pass: tight mid-cluster 34s → 14s; late cluster 42s → 9s. The existing
fallback-grid test is unaffected — when every cell is a boundary, distance is 0 and every target
still snaps to itself.

### #B — two-pass factor placement

Pass 1 places only exact-role matches; pass 2 gives whatever is left the longest free beat. The
single pass let an earlier factor's *fallback* claim outrank a later factor's *exact* claim, and
because `Emotional Charge` is emitted last by the schema, the near-tautological mapping was the
one that lost. Verified on the real 60s grid (see the table below).

### #C — `hookCutIndex` no longer no-ops

`after - 1 > 0 ? after - 1 : 1`. When the first cell is itself wider than the hook zone no cut can
make the opening beat 3s, but isolating that cell (0–5s) beats dropping the cut and letting the
spread merge four cells into a 0–20s "hook".

**Residual, worth stating plainly:** in this shape beat 0 is still 5s and still labelled `hook`,
because `opensTheVideo` tags the first beat whenever it opens inside the zone. The label overstates
by 2s. Fixing that properly means either splitting a cell (this module does not own cell
boundaries) or leaving the video hookless. I took the smaller misstatement; flagging it because
Task 6 renders the label.

### #D — midpoint turn fallback

Per your ruling: first free beat at or after `floor(beats.length / 2)`, falling back to the first
free beat only if the back half is full. Measured on the 60s grid with a hook-zone peak:
`hook, turn, payoff×5, close` → `hook, setup×3, turn, payoff×2, close`.

## The FACTOR_TARGET_ROLE table now holds at runtime

You held the owner ruling pending #B. It is fixed, so here is the actual placement — real output
from `buildBlueprint`, 60s fallback grid, peak at 30s, all five factors weak, in schema emission
order:

```
beat 0     0-3  s  hook    Scroll-Stop Power
beat 1     3-11 s  setup   Completion Pull
beat 2    11-19 s  setup   Share Trigger        <- fallback
beat 3    19-27 s  setup   -
beat 4    27-37 s  turn    Emotional Charge
beat 5    37-45 s  payoff  -
beat 6    45-53 s  payoff  -
beat 7    53-60 s  close   Rewatch Potential
```

Four of five now land on the role they asked for. **The one that does not is the one your
reviewer predicted:** `Share Trigger` wants `close`, loses it to `Rewatch Potential`, and ends up
on a `setup` beat at 11–19s — a share problem reported against the setup.

I did **not** change the table, since it is with the owner. But the data supports the reviewer's
steer, and sharpens it: of the two close-claimants, `Share Trigger` is the more defensible owner of
`close` (a share trigger is typically the closing payoff or CTA), while `Rewatch Potential` is a
whole-video property with no single home. Unmapping `Rewatch Potential` would hand `close` to
`Share Trigger` and send `Rewatch Potential` to the longest beat — one line, and it makes 5/5 land
sensibly. Ready to apply on a ruling.

## Still open

1. **The table ruling** — above. One-line change once the owner decides.
2. **Beat 0 can still be labelled `hook` at 5s** on a degenerate grid (#C residual).
3. **Snap radius is a tuned constant.** Half a step is defensible and testable, but it is a
   heuristic; the two cluster tests pin the behaviour that matters rather than the number.
4. **Still entirely synthetic.** Round 1's Task 7 concern stands unchanged: assert
   `has_speech === true` on a real talking-head video. No real video has been through this module.

---

# Fix round 3 — findings #1–#3

**Status:** DONE
**FIX_BASE:** `73635843`
**Scope:** all 3 items. Deferred minors untouched (including budget under-use on collision, and
raw casing on `weakness.factor`).

## Verification

```
$ npm test -- src/lib/engine/remix/__tests__/blueprint.test.ts
 Test Files  1 passed (1)
      Tests  26 passed (26)

$ npm test -- src/lib/engine/remix/__tests__/ src/lib/engine/qwen/__tests__/
 Test Files  6 passed (6)
      Tests  92 passed (92)

$ npx tsc --noEmit
TSC_EXIT=0    (zero output)
```

25 → 26 tests. The new test was confirmed red first:
`AssertionError: expected 60 to be less than or equal to 55.2` — a 60s beat in a 138s video
(43.5%), reproducing the reported measurement exactly.

## #1 — spread by elapsed time

`indexNearestTime` converts an evenly-spaced *time* target to the cell boundary nearest it;
targets are now `bodyStartTime + k * timeSpan / (wanted + 1)`. Snapping to real boundaries is
unchanged in behaviour. On the reported shape the longest beat goes 60s → 21s (43% → 15%).

## #2 — snapRadius comment

Rewritten to state the real bound (~2×, ~2.3× on a collision) and, per your steer, to record
*why* `step/2` is the value: it is the unique radius at which a cut cannot cross the midpoint
between adjacent targets. Anything larger lets cuts leapfrog and re-cluster, which is round 1's
defect.

## #3 — residual pinned

`expect(bp.beats[0]!.role).toBe("hook")` added to the isolate-first-cell test, with the reasoning
in a comment so the accepted trade lives in the test rather than only in prose.

## Your pre-commit question: snapRadius was in the WRONG domain. Changed.

You were right to make me justify it rather than let it pass. It was incidental, and it was wrong.

The derivation is "a cut cannot cross into a neighbouring target's territory". That holds only in
the domain the targets are evenly spaced in. Once targets became time-derived, adjacent targets sit
at *uneven* index distances, because cells have no maximum width. On the 6×20s + 18×1s shape the
index gap between adjacent targets is ~1 while the index-space radius was 1.64 — a snapped cut
could leapfrog its neighbour. The derivation was silently broken.

`nearestCut` now takes `targetTime` and compares `|segments[p].t_start - targetTime|` against
`timeStep / 2` **in seconds**. Same domain as the targets, derivation intact. The fallback path is
untouched, so the deferred collision/budget-under-use minor behaves exactly as before.

**This is measured, not argued.** 8000 randomised grids (cells 2–61, 15% of cells 1–31s wide, 35%
carrying a scene boundary, hook cell present 80% of the time), comparing the longest beat's share
against the *achievable floor* — the widest single input cell, which no merge strategy can beat
because this module cannot split cells:

| radius domain | integrity failures | beats over cap | >40% cases | of those, algorithmically avoidable | worst excess over floor |
|---|---|---|---|---|---|
| index space (round 3 draft) | 0 | 0 | 296 | **178** | **9.7pp** |
| time space (committed) | 0 | 0 | 249 | **0** | **0.0pp** |

Moving the radius into time space removed *every* algorithm-limited case in the sweep. The
algorithm never does worse than the achievable floor.

## One thing to be precise about: ≤40% is not a universal invariant

249 of 8000 trials still exceed 40%, worst 62.7%. Every one is input-limited — a single cell wider
than 40% of the video, e.g. a 30s cell in a 49s video. `buildBlueprint` cannot fix those without
splitting a cell, which would fabricate a boundary the perception never reported.

So the ≤40% assertions in the distribution tests are correct *for the shapes they pin*, and should
not be read as a guarantee the module holds that bound on all input. The honest invariant is:
**the longest beat never exceeds max(widest input cell, ~2× its even time share).** Flagging it
because "worst 31.3% across 6000 trials" could be read as a universal bound, and Task 7 may meet a
real video with one very long static cell.

## Still open

1. **The FACTOR_TARGET_ROLE ruling** (round 2) — unchanged, one-line change once the owner decides.
2. **Beat 0 can be 5s and labelled `hook`** on a degenerate grid — now pinned by a test, and
   Task 6's `t_start`/`t_end`-beside-the-label steer is the agreed mitigation.
3. **Still entirely synthetic.** Unchanged since round 1: Task 7 should assert
   `has_speech === true` on a real talking-head video.
