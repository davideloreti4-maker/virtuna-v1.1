# Handoff — the calibration screen, the account's real totals, and the bake watch on flash (2026-08-05)

**Merged + deployed:** PR **#446**, merge commit **`628d8d6e`**. Branch `task/calibration-premium`
(6 commits) rebased onto `0793237d` and landed. **Worktree:** `~/virtuna-slot-a`.
Read refs with `git rev-parse` — `git log --oneline` elides merge commits in this repo.

Continues `docs/HANDOFF-2026-08-05-mobile-walk.md`. That handoff's §10 left six items open; this
session closed four of them and the owner's calibration-screen direction on top.

---

## 0. ⚠️ Corrections to things the previous handoff asserted

1. **"The suite makes 375–485 real connections to `localhost:3000` per run."** That counted log
   **lines** — each `AggregateError` prints the string ~5 times. The real figure is **58–64
   connection attempts**. The conclusion ("never run the suite with a dev server on :3000") still
   stands; the number was 6× too big.
2. **`scrape-waits-are-blind` said competitors was probably not a real wait.** It is. See §5.
3. **My own plan said the same thing.** Recorded here so the next reader does not re-derive it.

---

## 1. What shipped

| # | change | severity | where |
|---|---|---|---|
| **1** | The calibration card rendered the **scrape window** as the account's post count | **high** | `audience-create.tsx` |
| **2** | `/audience/new` **dropped every `stage` SSE frame** the route sent | **high** | `audience-create.tsx` |
| **3** | No avatar, no verified tick, no view counts — all available, none rendered | medium | ↑ |
| **4** | A loading line stated a count **and the count was false** | medium | `progress-checklist.tsx` |
| **5** | The bake watch was the last video call routed to the **audio** model | medium — cost | `enrich-signature.ts` |
| **6** | The explore pull + the paid outlier pull showed nothing for 25s+ | medium | `explore-runner.ts`, `grounding/orchestrator.ts` |
| **7** | `/discover` bookmarks landed on a **5-credit scrape tool** | medium — revenue | `(app)/discover/page.tsx` |
| **8** | The suite fetched a 3D brain mesh over the network, on import | low | `src/test/setup.ts` |

---

## 2. 🔴 THE ONE THAT MATTERED — "12 VIDEOS" for an account with 611

`AudienceCreate`'s streaming phase rendered `evidence.videos.length` — the **12-post scrape
window** — under a "Videos" label. `CalibrationEvidence.videoCount` has carried the profile total
at **both** emit sites since the payload was written, and documents itself at `calibration.ts:165`
as *"the account's total posted videos (profile-level, not the scraped window)"*.

**The test pinned the bug.** It asserted `expect(screen.getByText("12"))` with the comment
`// videos scraped — exact`, against a fixture whose `videoCount` was **610**.

> 🔑 **A fixture that carries the right value while the assertion reads the wrong one is not a
> weak test — it is a test that has been taught the defect.** Grep a suspicious assertion against
> its own fixture before trusting it.

### And the same component dropped every stage frame

`/api/audiences/calibrate` has emitted `send("stage", …)` against `CALIBRATION_PLAN` since
2026-08-02. `calibration-flow.tsx` (`/welcome`) consumed them and drew the spine.
`audience-create.tsx` (`/audience/new`) **had no `case "stage"` at all** — so the fix that made
the longest wait in the product legible reached one of its two clients and nobody noticed.

> 🔑 **When two surfaces run the same pipeline, a fix to one is not a fix.** Both are now
> `CalibrationProgress` (`src/components/audience/calibration-progress.tsx`), so the drift cannot
> return. `/welcome` keeps only what is genuinely its own: the idle form, the fallback and error
> terminals, the done reveal.

---

## 3. The card, measured LIVE signed in (not a fixture)

Real billed run, `@zachking`, prod Supabase, dev server on :3007:

```
  1s  spine: [followers active · watching pending · building pending]   no account yet
 11s  Zach King · avatar ✓ · verified ✓ · 611 POSTS / 86.5M / 1.3B · 12 covers
 68s  followers DONE → watching ACTIVE
 84s  watching DONE → building ACTIVE
106s  all done → /audience/6b1114e6-bae9-462e-9f06-a2964b17ee67
```

**611**, not 12. Component-level measurement first (`getBoundingClientRect`, 390×844 and 1440×900
in **separate contexts opened at that size** — a resized page is not the mobile UI): no overflow,
no wrapping, name truncates, figure row capped at 440px so the numbers read as one set.

Card order is the argument it makes: **WHO** (avatar / name / verified / @handle · platform) →
**WHAT THEY HAVE** (account totals) → **WHAT WE ARE DOING** (the shared spine) → **WHAT WE ARE
WORKING WITH** (covers + measured views).

**Honesty, load-bearing because every figure is scraped:** a zero figure is **omitted**, never
drawn as `0` — Instagram and YouTube expose no profile-level total likes, so a "0 LIKES" tile
would turn a missing measurement into a claim that the account has none. `verified` was the one
field genuinely absent from the payload; it is **optional**, because "we don't know" and "not
verified" render identically (no tick) and it must never be inferred from reach.

---

## 4. The rule: no pipeline counts, and where it STOPS

Owner, verbatim: *"i dont want any numbers shown to the user neither how many posts are pulled or
watched."*

The count that forced it was also **wrong**: `progress-checklist.tsx` rotated
*"Collecting the last 30 posts"* while calibration pulls **12** — 30 belongs to the account read,
a different pipeline.

| was | now |
|---|---|
| `Watching your top videos` | `Watching your videos` |
| `Collecting the last 30 posts` | `Collecting your recent posts` |
| `Reading your last 30 posts` | `Reading your recent posts` |
| `Reading 30 of your posts` (rail) | `Your recent posts` |

### ⚠️ The rule is scoped, and the scope came from the owner's own screenshot

**"Borrowing shape from 5 proven videos" STAYS.** It is the line in the reference screenshot the
owner held up as the target. The distinction that survived contact:

- **A claim about CREATIVE INPUT** — what the model is writing against — is what the creator is
  paying for. Keep the count.
- **A SCRAPE VOLUME** — how much our plumbing hoovered — is process trivia. Drop it.

`slots` on the filmstrip payload is untouched: it is **layout**, not a claim (it makes the strip
draw its width up front instead of reflowing), and it is bounded by `MAX_EVIDENCE_ITEMS` because
it counts tiles DRAWN — which is exactly the number the old headline was wrong to announce as
posts read.

> ⚠️ **Stage names are a WIRE CONTRACT, not display strings.** The route emits them, the spine
> merges live events onto the plan BY NAME, and `RunEvidence.step` routes the evidence rail by
> name. Rename the constant and every emitter in one commit. Bound suites:
> `calibrate/__tests__/route.test.ts`, `input-request-block.test.tsx`,
> `progress-checklist.test.tsx`, `lib/tools/__tests__/evidence.test.ts`.
>
> 🔑 `src/app/api/audiences/__tests__/route.test.ts` contains a **NUL byte** (a deliberate
> sanitization fixture), so `grep -rl` skips it as binary. Use `grep -a` or you will miss it.

---

## 5. The bake watch moves to `qwen3.7-flash` — and the owner was right

I pushed back on this and was **wrong**. `qwen3.7-flash` is sighted; it is only *deaf*. The
platform already runs exactly this arrangement in two places:

- `wave3/fold-prompts.ts:143` — *"the fold runs on qwen3.7-flash and WATCHES the video (sighted;
  deaf — audio is in the text block)"*
- `engine/version.ts:170` (#433) — *"flash takes the video and owns the segment grid, omni takes
  an ffmpeg-extracted mp3"*

The bake watch was the **last** video call routed to omni — an exception to the stated policy
rather than an instance of it, since omni's scope is audio.

**What made it free:** the same Apify bundle scrape that returns the mp4 also returns TikTok's
native subtitles, and this function was **already fetching them** — just afterwards, for the
synthesis payload. Moving the fetch above the watch hands the speech to a deaf model as text.

### 🔴 A NEW CONSTANT, NOT A REPOINT

`QWEN_OMNI_MODEL` has **8 other consumers**, including the engine's **audio leg**
(`qwen/split/run.ts`), SIM-1 Max (`stimulus/tier.ts`) and `profile-bake.ts`. Repointing it would
have moved the one job omni still exists for onto a deaf model, and `ENGINE_VERSION` would not
have noticed. New seam: **`QWEN_WATCH_MODEL`**, rollback `=qwen3.5-omni-flash`.

### Measured live — the suite is blind to this by construction

`enrich-signature.test.ts` **mocks `watchVideo`**, so 5,347 green tests cannot see the swap.

```
bake watch ok  model:qwen3.7-flash  ×5   0 failures   0 schema rejections
total watch cost: $0.0023            watching stage: 16s (cadence map was tuned to ~40s on omni)
sub_coverage 8/12 — IDENTICAL to the recorded 2026-07-13 baseline for this handle
```

The check that mattered — did dropping omni cost the visual read?

> **format_signature:** *"Seamless jump-cut magic, 'behind-the-scenes' reveals, and high-contrast
> cinematic lighting mixed with casual selfie-style intros."*

Pure visual observation. And `writing_style_sample` came back as a real verbatim line from the
footage, proving the transcript reached synthesis through the new ordering.

**What is genuinely lost:** non-speech audio character — music, sfx, delivery tone. The prompt now
**forbids inventing it**: `audio` is scoped to what the transcript supports, `"no speech"` when the
video carries none, `"unknown"` when TikTok published none. Telling a deaf model to "listen" would
have been an instruction to infer sound from the picture.

Three tests pin the ordering and **all three were confirmed failing** against the old call first.

---

## 6. The two blind scrape waits

- **Explore pull** (`explore-runner.ts`) — `Promise.all(sources.map(scrapeVideos))` sat inside one
  active→done pair, so a cache MISS parked the spine then flashed. Now emits as each source
  resolves; a merged competitors pull resolves out of order so the rail **accumulates**, pinned to
  `"Pulling outliers"` by name.
- **The paid outlier pull** (`grounding/orchestrator.ts`, ~25s, **5 credits**) — emits at the
  **SELECTION** boundary, not the scrape boundary. The raw scrape is 30 rows most of which are
  about to be discarded; showing them would advertise material the run then drops. No multiplier
  is claimed there — it needs follower counts that arrive later and must clear the outlier gate
  before it may be spoken.

Five tests, all **confirmed failing** against the un-wired code first.

### ▶ Competitors — the finding my plan got wrong

**"Add channel" DOES scrape.** `useAddChannel` (`hooks/queries/use-channels.ts:76`) POSTs
`/api/channels/ingest`, which runs a full `scrapeProfileBundle` (the 25–126s one) before
`/api/tracked-accounts`. It is **not silent** — the card shows a `CircleNotch` spinner — but it is
a spinner with no stage detail on a wait long enough to deserve the spine.

**Why it was left:** putting it on the spine means converting a JSON POST into an SSE contract.
Bigger than this lane scoped. **Open.**

---

## 7. `/discover` → `/feed`

The route exists ONLY to honour bookmarks saved when `/discover` was the browsable outlier grid:
free, read-only. It pointed at `/feed/discover` — the on-demand **Pull**, a 5-credit Apify scrape.
It answered a request to browse with a request to spend.

The routing guard **caught this change**, which is what it is for. It argued the old target on
"dead 2-hop" grounds — an argument that no longer holds, because `feed/page.tsx` renders a real
page (the `it.each` directly above asserts exactly that). Retargeted with the reasoning recorded;
the 2-hop half of the guard kept.

---

## 8. The suite: one real leak closed, the rest unattributed

**Found and fixed:** `CortexCanvas.tsx` ends with `useGLTF.preload('/brain/cortex.glb')` at
**module scope** — correct in a browser, unconditional under vitest, so it fires on **import**
before any test body (trapped calls recorded `"(outside a test)"`). happy-dom's document URL is
`http://localhost:3000`, so that relative path became a socket. Answered in `src/test/setup.ts`,
scoped to a literal path prefix — a blanket stub would mask the next leak.

**⚠️ NOT fixed, and this is the next investigation's starting point.** The residual
`ECONNREFUSED` noise (~58–64 attempts/run) resisted **three** traps:

| trap | hits |
|---|---|
| `globalThis.fetch` | 2 — both the cortex mesh |
| `XMLHttpRequest` | 0 |
| `net.Socket.prototype.connect` | 0 |

So it is **not** reaching the network through any of those *in the worker where `setup.ts` runs*.
It spans the whole run (output line 4 → 2855), so it is not a startup artifact.

Two consecutive clean full runs: **476 files / 5347 passed / 42 skipped / EXIT=0.** Not claiming
causation — the suite hit 0 roughly one run in three before this.

---

## 9. Gates

```bash
node node_modules/typescript/bin/tsc --noEmit    # 0 errors
node node_modules/vitest/vitest.mjs run          # never pipe through `| tail`
npm run build                                    # Compiled successfully
```

**At `628d8d6e`: tsc 0 · 476 files · 5347 passed · 42 skipped · EXIT=0 ×2 · prod build clean ·
one live billed calibration.**

⚠️ Run the suite with **no dev server on :3000**. ⚠️ `main` moved **three times** during this
session (#443, then #444/#445). `git fetch` + `git rev-parse` before branching AND before merging.

---

## 10. Still open

1. **THE UNHAPPY PATHS (P3) — top item, untouched.** Credit wall, failed scrape, expired session
   mid-stream, offline, empty states. Still **zero verification history on a revenue surface**.
   Per the mobile-walk handoff §14, do it **after** credits→limits, in one pass against the new
   units — the plumbing survives the migration, so verifying now is doing it twice.
2. **credits → LIMITS** — the owner's stated next direction. `pricing.ts` is already
   `{ limit, used }` (`limit: null` = unlimited); largely a re-pricing + relabel.
   ⚠️ Do **not** "simplify" `sealedVisitor` in `chat-agent-loop.ts` back into an inference from
   what is bound — a free tier is exactly what would have disarmed the artefact guard.
3. **Competitors add-channel → the spine** (§6). Needs JSON→SSE.
4. **The unattributed `ECONNREFUSED`** (§8) — three traps already ruled out, documented above.
5. **Lane B is verified on ONE handle** — a talker at 8/12 subtitle coverage, the favourable case.
   The unmet case is a **silent visual creator** (the Khaby class): no speech, no subtitles, where
   `audio` must honestly read `"unknown"`. Unit-tested, never met in the wild.
6. **Pinned chip price** — deliberately NOT shipped despite my own plan saying it would be.
   Credits→limits renames the units; labelling "1 credit" now means relabelling it in weeks. Same
   logic the owner already accepted for the wall. Owner's call.

---

## 11. Ground rules that paid off again

1. **The owner was right about the model and I was wrong.** Two greps (`fold-prompts.ts`,
   `version.ts`) settled it in under a minute. **Check the codebase before arguing from priors.**
2. **A green suite cannot see a mocked seam.** `watchVideo` is mocked, so the model swap was
   invisible to 5,347 tests. One live run was the only real gate.
3. **Confirm a new test FAILS against the old behaviour before keeping it.** Done for all 8 new
   guards here; two would otherwise have been decoration.
4. **A test can be taught the defect.** The `"12"` assertion sat next to a fixture that knew 610.
5. **Instrument, don't guess.** Three traps on the ECONNREFUSED noise produced a *negative* result
   that is genuinely useful to the next reader — far better than a plausible fix that fixes nothing.
6. **Scope a rule by asking what it is FOR.** "No numbers" nearly deleted the line from the
   owner's own reference screenshot.
