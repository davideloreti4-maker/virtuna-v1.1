# Closeout handoff — `~/virtuna-explore-a` · everything still open on this worktree

> Written 2026-07-14 at the end of the loading-states lane. **This file is the SSOT for the next
> session.** Its job: close this worktree out. Read this first; the older handoffs are reference.
>
> | doc | status |
> |---|---|
> | `HANDOFF-2026-07-14-loading-states.md` | ✅ shipped (#295 merged `c1f503ff`) + the live-run findings |
> | `HANDOFF-2026-07-14-cards-and-loading.md` | the card backlog — **its §"🥇 1. the loading state" is DONE**, skip it; §0.6/§0.7 are still open |
> | `AUDIT-2026-07-13-cards-remaining-nine.md` | the ranked card worklist behind §0.6 |

---

## The one rule this lane exists to enforce

**Look at the running thing. The tests will not tell you.**

Every real defect this week was found by rendering or running the surface, never by reading code and
never by a green suite. Three separate bugs were live *while every test passed*:

- the roster read `society_id` — **a column nothing writes** (dead in prod, green in tests);
- the cast rendered as `high_engager` instead of Maya;
- a Read whose **entire audience simulation died** shipped as **HIGH confidence**.

The suite was green for all three. Two real runs (~5 min, a few cents) caught all three.
**Budget a live run before you call anything done.**

---

## 1. ✅ DONE — PR #300 merged (engine: the dead-audience confidence fix)

**Merged 2026-07-14.** Two things happened during the merge that are worth carrying forward.

### 1a. The PR had to be REBUILT — it would have reverted three merged PRs

The branch was cut *before* #295 squash-merged. By the time it was reviewed, main had moved four PRs
(#295, #296/#297, #298/#299, #301) and the branch still carried #295's commits unsquashed. Its diff
against main was **−5,229 lines**: merging it would have deleted the structural grounding retrieval
(#297), the per-persona hook targeting (#298/#299), and two applied migrations. GitHub called it
"CONFLICTING", which reads like a formatting problem and is not — **a conflicting long-lived branch is
a revert waiting to happen.** Rebuilt by resetting to `origin/main` and cherry-picking only the three
genuinely-new commits (backup ref: `backup/audience-failure-honesty-pre-rebuild`).

▶ **The lesson for the next lane: a branch that outlives its base is a liability.** Check
`git diff origin/main HEAD --stat` for surprise deletions before you merge *anything* that has sat.

### 1b. The fix had a second door, found in review

The original fix keyed "the audience was supposed to exist" off `foldOutcome !== null`. But the
pipeline had **two** ways to lose a fold and only one sets that field:

| how the fold dies | `foldOutcome` | scored as |
|---|---|---|
| `runFold` returns `fold_success:false` | set | failed ✅ |
| `runFold` **throws** | **null** | **text mode** ❌ — 0.4 bonus, HIGH again |

`getQwenClient()` and `buildFoldUserContent()` run *outside* `runFold`'s per-attempt try/catch, so a
missing or rotated DashScope key throws straight out — **the most likely fold failure in prod, and it
would still have shipped HIGH on zero personas.** Fixed in `2391b41e`: a thrown fold now records the
attempt. And the test that should have caught it *was the bug* — "fold: PipelineResult valid when fold
throws" never mocked a throw; it ran text mode and asserted `foldOutcome === null`. Green, and pinning
the defect in place. (Third green-suite lie this week. See the rule at the top.)

### The original bug, for the record

The fold has three states and the aggregator modelled two, so a fold that **ran and died** took the
*text-mode* branch and its agreement term fell back to apollo-vs-behavioral — two numbers out of the
**same Apollo call**. That is the "self-agreement" the code's own docblock already condemned, and it
handed the broken run the **0.4 maximum agreement bonus** → `0.2 + 0.1 + 0.4 = 0.7 = HIGH`.

Measured live (the control arm that found it):

| run | score | personas | confidence |
|---|---|---|---|
| `VdwSBcf0i3bO` — fold ran, audience DISAGREED | 64 | 10 | **LOW** |
| `iEbgUsLZRSFw` — fold died, nobody watched | 78 | **0** | **HIGH** |

⚠️ **The `ENGINE_VERSION` 3.20.0 → 3.21.0 bump is load-bearing, not cosmetic.** The prediction cache
keys on it. Without it, every already-cached fold-failed row keeps replaying its old HIGH badge on a
cache hit — the fix would never reach the rows that *have* the bug. Do not "tidy" it away.

▶ **Next session picks up at §2.**

---

## 2. The card backlog — Band primitive FIRST

`docs/HANDOFF-2026-07-14-cards-and-loading.md §0.6` + `AUDIT-2026-07-13-cards-remaining-nine.md`.

**Start with the 🟡 Band primitive.** It is *the source of the drift*: band colour applied twice (word
*and* fraction; §1.3 says once), no dot, and its `text-2xl` coloured band-word **is the hero pattern
Simulate and Predict both copied.** Fixing it unblocks two others — do not start with Simulate.

Then, in order:
- **Simulate** (`reaction-distribution`) — fraction stated TWICE from two sources that can disagree ·
  provenance in the eyebrow · band-word-as-hero · no ProofUnit / no "See the room →" · 2-row action
  bar, no cream primary · `text-red-400` (a RETIRED accent).
- **Account Read** (`account-read`) — SIX stacked equal-weight ALL-CAPS labels · no hero · no
  disclosure · forward action is a text link, not the cream primary.
- **Explore** (`outlier-grid`) — the tile has **no card surface**; multiplier/fit/CTA float on the
  thread background. Hero is a number. Save sits above the primary.
- 🟡 **Personas** — `RoomAvatars` is hand-copied from `proof-unit.tsx` (two copies of the flagship
  cue); quote styling diverges from `ProofUnit`.
- 🟡 **Ask** (`SkillResultCard`) — header is `text-xs`, not the contract eyebrow. Load-bearing.

**Predict** (`prediction-gauge`) is an **owner call** — see §3.

---

## 3. 🔴 OWNER CALLS — do not decide these silently

Four information-design calls on the Reading (`ui-skill-cards.md §0.7`). They are design, not drift.

1. **The empty persona slot is wearing a verbatim's clothing.** When a persona didn't speak, the quote
   slot renders *"stopped — no words this time"* — **italic, in the quote position**. It reads as
   something the persona *said*. We are scrupulous about never fabricating a quote, then style the
   **absence** of one to look like a quiet one. **This is the sharpest one** — and the same *class* of
   bug #287 already solved for cards, and that today's fix solved for the failed audience: *state the
   absence, don't dress it up.* The fix pattern exists. Arguably not even a real "call" — just do it.
   ▶ Reproduce: `/dev/cards` → Reading → **"Empty personas"**.
2. **Provenance sits in the hero eyebrow** (`TEST · POWERED BY SIM-1 MAX`). §0.5 says provenance is a
   footnote, never a headline — but Reading is a *page*, not a card, so it has no disclosure row to
   demote onto. A hero restructure, not a class swap.
3. **Two entity types in one undifferentiated list** — segments (*Loyal fans*) and named personas
   (*Maya*) share identical anatomy, but only personas are askable and nothing says why.
4. **The replay action exists twice** — `▶ Replay the room` link and a `Replay reactions` button,
   same block, ~300px apart.

**Predict card:** renders `~35–60%`, which §0.5b forbids and its own UI-SPEC *requires*. Also uses
Unlikely/Toss-up/Lean/Likely vs Strong/Mixed/Weak everywhere else. Needs the owner to pick.

---

## 4. 🔴 OWNER — blocked on Vercel access (noted 2026-07-14, owner had none)

**`FILMSTRIP_EXTRACT_SECRET` must be set in Vercel prod.** `triggerFilmstripGeneration` **returns
silently** without it (`src/lib/engine/filmstrip/queue.ts:28`) — no error, no frames, ever. The frame
strip (the best part of the loading work) simply **would not exist in production**, and *nothing would
tell you*. Same failure shape as the dead crons (missing `SUPABASE_SERVICE_ROLE_KEY`).

---

## 5. Loose ends found today (small, real)

- **Dead code — the `partial` SSE event has never once fired.** `extractPartialPersonas`
  (`src/app/api/analyze/[id]/stream/route.ts`) reads `row.analysis_results.partial.personas`, and
  **there is no `analysis_results` column** on that table (fields are top-level: `personas`,
  `variants`, …). Harmless today (the fold only produces personas at the end, so there is no partial
  state to stream) but it is a progressive-reveal hook that silently does nothing. **Delete it or wire
  it to something real.**
- **The calibrated-audience roster path was never watched live.** Today's roster fix is proven on a
  *General* (uncalibrated) audience — the default, and the broken case. The calibrated branch is
  covered by a unit test but never rendered in a real run. If the account has a calibrated audience,
  give it one look.
- **`Your N people`** (`10px/1.2px`) — the last off-contract label on the Reading, but it lives in
  `audience-lens/AmbientRoom.tsx`, which the Room *also* uses (elevated in #257). **Do not reach
  across that boundary without checking the Room.**
- **`@phosphor-icons/react` is barrel-imported** — ~1.4s just to evaluate the module graph. Deep
  per-icon imports would cut that and the bundle. Real refactor, many files.
- **72 pre-existing test failures** — `api/tools/*` route tests + `billing/quota` (`cookies()` in the
  mock-skills gate). **NOT from this lane** — identical on a clean tree. Nobody owns them, and they
  make the suite useless as a gate. Worth fixing precisely *because* this lane's lesson is that a
  green suite is the thing you trust when you shouldn't.

---

## How to work here (the traps that will waste your session)

```bash
# dev server — MUST be port 3000, see below
NODE_OPTIONS=--max-old-space-size=2048 node ./node_modules/next/dist/bin/next dev -p 3000

# tests — `npm test` / `npx vitest` print FAKE results in this repo
node ./node_modules/vitest/vitest.mjs run <path>
```

- 🔴 **Run dev on `:3000`, not `:3001`.** The filmstrip trigger POSTs to `${NEXT_PUBLIC_APP_URL}`,
  which `.env.local` pins to **:3000**. On 3001 the frames fire into a dead port and you will
  "verify" a false negative. (This nearly cost me the whole finding.)
- 🔴 **A repeat URL is a silent cache replay** (`cache_hit — silent replay` in the log) — it returns in
  ~700ms, never navigates, and looks like a broken button. **Use a fresh video for a real run.**
  Real URLs live in `scripts/urls-{1,5,10}.txt`.
- **To force a fold failure** (to exercise the §1 fix): `FOLD_ATTEMPT_TIMEOUT_MS=1` on the dev server.
- **Playwright screenshots hang on this app** — the ambient animations never settle. Use
  `animations: 'disabled'` element-scoped shots, or assert via `getComputedStyle`. **MEASURE, don't
  eyeball** — every real finding this week came from reading values off the rendered surface.
- **A cheap way to exercise the stream without paying for a Read:** insert an in-flight row
  (`overall_score: null`) for your user and open `/api/analyze/<id>/stream`. Real route, real auth,
  real audience resolution, zero engine spend. Delete the row after.
- `/dev/cards#reading` previews all 12 Reading states (9 + the 3 loading states) with the REAL
  components — the cheapest visual gate in the repo.
