# Handoff — Phase 2's multiplier switch MERGED, and everything still open (2026-08-11)

**Worktree:** `~/virtuna-v1.1` (trunk) · **Branch:** `main` · **main at handoff:** `cec553ba`
**Apify:** $3.37 / $5.00 used, cycle ends `2026-08-20T23:59:59.999Z` (format that date in **UTC**).
**Deploy state:** 🔴 nothing below is live. Git has been disconnected from Vercel since 2026-08-08 —
**merging does NOT deploy**, contra `CLAUDE.md`.

Read this file, then `docs/HANDOFF-2026-08-10-phase3-governance-designed.md`. This one supersedes
that file's §4 ("what to do next") only — its §2, §3, §5 and §6 all still hold.

---

## 1. What landed today

**PR #470** — `fix(discover): the printed multiplier stops moving with the size of the pull`.
This was the item the previous handoff called *"the one thing that is NOT done"*.

`src/lib/discover/outlier-receipt.ts` (`attachOutlierReceipt`) replaces each tile's
`multiplier` + `baselineLabel` with a per-author receipt at **three** call sites — the spec named
two:

| site | path |
|---|---|
| `/api/discover` | cold |
| `explore-runner` | cache MISS |
| `/api/tools/explore` → `buildBlockFromRanked` | **cache HIT** |

⚠️ **The third is the one to remember.** It is a duplicate block builder, and every route test
forces a cache MISS, so it had *zero* coverage. Fixing only the runner would have printed the
receipt on a cold pull and the old within-set median on a warm one — same video, same day. There is
now a cache-HIT test; it was confirmed to fail against the unfixed route before being kept.

**`rankOutliers` is unchanged and still correct as a SELECTION signal.** `rankKey` orders the pull
and `explore-rank.ts:142`'s `tileTempDemand` reads `multiplier` as a reach proxy. The receipt
therefore attaches **after** `rankWithAudienceFit` — receipting first silently retunes the fit
estimate. The return type is `Omit<T,"multiplier"|"baselineLabel"> & {…}`, so the selection figure
is structurally unavailable to a renderer rather than merely discouraged.

### Basis by mode (owner ruling, on live measurement)

- **niche → `views ÷ followers`, "vs followers"** — fully N-invariant.
- **profile → own-median-views, "vs their usual views"** — grouped BY AUTHOR, because explore's
  CR-02 `mergeInputs` competitors pull is also `mode:"profile"` but spans several handles.

The spec's plan (apply `author-baseline.ts` as written) turned out to be **unexecutable for niche
mode**. See §2.

Verified: `tsc` clean · 5896 tests pass · prod build compiles · one live Apify pull N-invariant at
three pull sizes · four badge states measured in a real browser.

---

## 2. Facts measured today — do not re-derive, do not re-pay for

Raw payloads were dumped so the analysis re-runs for $0.00. Tooling, both cost-guarded and both
refusing to start without Apify headroom:

| script | what it does |
|---|---|
| `scripts/probe-author-baseline-coverage.ts` | coverage + all bases side by side; `--from <dump>` re-analyses free |
| `scripts/verify-outlier-receipt.ts` | runs the REAL tile path over a real dump; fails on niche N-drift |

### `own-median-views` is degenerate in niche mode

A live 20-post "startup founder" pull returned **18 distinct authors, 16 contributing exactly one
post**. A one-post median IS the post being measured → nearly every tile prints `1.0×`. This is why
niche mode could not use the corpus's basis.

### 🔴 `lifetime-avg-likes` is BROKEN — never put it on a badge

`heart` is lifetime likes across every post **ever**; `videoCount` counts only **currently-public**
posts. They do not divide. Live: `thepodcaster_clipper` = `heart 585k ÷ videoCount 2` → "292k average
likes" on a post with **1k likes** → `0.0×`. Output ranged 0.0× → 33.3× with no consistent meaning.

The older memory note calling this basis "stable at every N" is true and irrelevant — it is *stably
wrong*. `outlier-receipt.ts` refuses to fall back to it and `author-baseline.ts` now says so in its
header.

### `author.fans` is inline on a niche pull — 20/20 coverage

This makes `grounding/outlier-gate.ts`'s header **stale**. It says the durable `views ÷ followers`
receipt is *"computable only after a per-survivor profile scrape (§14: follower_count is not inline
on a niche/search pull, and VideoData carries none)"*. Phase 1's `VideoData.author.fans` changed
that. The comment was not updated — someone will trust it.

### Cost reality

A niche **search** scrape of 20 is ~$0.001. A **profile** scrape of 20 is ~$0.075 — the difference
is the actor's media-download step. Budget accordingly; the $0.0513/run figure in
`verify-apify-first.ts` averages over both.

---

## 3. Carried forward from today — real, unfixed, deliberately out of scope

1. **`storeDecode` can still write the broken basis into the shared corpus** (`decode-cache.ts:154`).
   It takes an `AuthorBaseline` and writes `multiplierFor(video, baseline)` into `outlier_teardowns`
   whenever no durable followers receipt exists. **No production caller today** — only tests and
   `scripts/verify-apify-first.ts` — so it is latent, not live. **Phase 3 is what makes it live**,
   because Phase 3 wires Phase 1 into a request path. Handle it *inside* Phase 3, not before.
2. **Profile mode keeps a ~8% sample wobble.** Its own-median denominator is arithmetically what
   already shipped — today was a label change there, not a stabilisation. Measured 1.4× → 1.3× at
   N=20 vs N=10 on @moniify. Both call sites use a fixed `SCRAPE_LIMIT=30`, so it does not move in
   production. Closing it needs a fixed baseline N. Low priority.
3. **`chat-agent-loop.ts:1266`** — `return { text: unbound ? guard.flush() : fullText, … }` while the
   guard arms on `guardArtefacts`. A **sealed visitor who is not `unbound`** streams redacted text and
   persists the RAW text, so the leak reappears on reload and lands in the next turn's replayed
   transcript as precedent. One-word fix (`guardArtefacts`, not `unbound`); already folded into Phase
   3's plan Task 6, marked as a bug fix so a reviewer does not "clean it up" back. Latent only
   because `FREE_SKILL_TOOLS` is empty.

---

## 4. The Apify lane — what is left

### 4a. Phase 3 — spend governance. DESIGNED, NOT BUILT. The obvious next lane.

Spec + 9-task plan committed at `c7f2c3ee`:
- `docs/superpowers/specs/2026-08-10-apify-governance-phase3-design.md`
- `docs/superpowers/plans/2026-08-10-apify-governance-phase3.md`

Tasks: SpendAuthority → warm coverage gate → deterministic copy module → proposal slot (**Task 4
needs a MANUAL SQL-editor migration — `supabase db push` is unsafe here**) → `skill-proposal` block +
renderer → dispatcher gate chain → `POST /api/chat/confirm` → replay the grid as a tool run → one
real end-to-end verification.

⚠️ **Two things about the plan are now out of date because of #470:**

- **§3.8's "the tool result must NOT carry `multiplier`" rule was written against the broken
  denominator.** Its stated reason — that putting `rankOutliers`' figure in the transcript promotes a
  display bug into something the agent asserts in prose — no longer applies. **Re-read §3.8 and
  decide; do not implement it verbatim.**
- The handoff's "do Phase 2's two call sites first" recommendation is **done**. That quality ceiling
  is lifted.

Also still true from the Phase 3 handoff: **ten other doors drain the same $5 cap** (`/api/discover`,
`/api/analyze`, `/api/profile`, `connected-accounts/connect`, `channels/ingest`, `explore-runner`,
`account-read`, five crons). Phase 3 wires only the chat dispatcher. That is fine by design —
`SpendAuthority` reads the true remaining budget — but it is a tracked follow-up.

### 4b. Phase 2's OTHER half — the `composed-card` output layer. DESIGNED, NO PLAN.

`writing-plans` has never been run on it. Spec §4.2 of
`docs/superpowers/specs/2026-08-10-apify-first-composed-output-design.md`.

**What it is:** today Maven answers open-ended asks in prose. This replaces that with one block type
whose slot tree the model composes and a **recipe registry validates** — the recipe *is* the schema.
10 slots, 7 recipes. It exists because all 16 hand-built cards drifted: `ui-skill-cards.md` §0.6
marks 5 🔴 STRUCTURAL and 3 🟡, cause stated as *"cards drifted precisely because each was built
alone with nothing to conform to."*

Three decisions carry the design, all from a real spike (`scripts/spike-slot-composer.ts`, retained
as the regression harness):
- **D6** — the payoff is a typed required field, not a free-text `hero`. Both models failed the hero
  rule; on the hooks case **neither** put the actual hook line in the hero, and all of it passed
  schema validation.
- **D7** — the model names a teardown row id and the **server materializes** the numbers. Moves
  fabrication-safety from empirical (0/31, luck) to structural.
- **`actions` is a closed enum** — nothing that spends a credit is model-authored.

**Sequencing note:** it depends on Phase 1 (shipped) but **not** on Phase 3, and unlike Phase 3 it
does not need the paid-Apify decision — a composer over the existing corpus works without new
scrapes. It is independently buildable *now*.

---

## 5. Decisions the owner still owes

1. **A paid Apify plan.** At $5/month the whole platform gets ~97 scrapes across all users. Gates
   *shipping* Phase 3, not building it — governance can be built and tested against the free cap.
2. **Warm-hit rate is unmeasured.** `outlier_teardowns` holds 524 `curated`/`extracted` rows and
   **zero `scraped`**, so Phase 3's gate 1 leans entirely on cosine hits against a curated library —
   strong for broad niches, empty for narrow ones. The architecture calls warm-first "the common
   path"; today it may not be. **Measuring this is cheap and de-risks Phase 3 before you build it.**
3. **`remix` as a proposal** stays deferred (spec §3.1) — its pipeline lives inside its own SSE route
   and would need extracting. Keeps its working `request_input` field meanwhile.

---

## 6. Other lanes — measured, not remembered

`git cherry -v origin/main <branch>` counts, taken at `cec553ba`. ⚠️ A high count means
**superseded**, not missing — patch-ids, not content. Check `git cat-file -e main:<path>` before
merging anything old.

| branch | not in main | state |
|---|---|---|
| `feat/audience-sim-v2` | 20 | unknown to me — not touched this session |
| `audit/e2e-walkthrough` | 18 | ditto |
| `lane/in-thread-chat` | 18 | A+B merged; session 7 built on the lane, live-measured, unmerged. ⚠️ `creator_profiles.writing_voice_sample` **does not exist in the DB** — widening the zod schema before applying the migration BREAKS profile saving. Read its own HANDOFF-2026-08-10-session-7 doc. |
| `lane/remix-shoot-sheet` | 13 | not touched |
| `feat/thread-cards` | 12 | not touched |
| `feat/per-persona-ideas-script` | 3 | not touched |
| `polish/cards-next` | 2 | not touched |
| `feat/grounding-reference-cards` | 2 | not touched |
| `milestone/onboarding` | 2 | lane open on `task/onboarding-ui-refinement`, no worktree. Blocked on an owner ruling on obs. 1 + 6; obs. 2 is a straight bug. |
| `design/start-composer-v2` | 2 | not touched |
| `milestone/ui-opt` | 2 | not touched |
| `docs/handoff-make-card-polish` | 1 | not touched |
| `feat/trial-hero-rework` | **0** | fully merged (#460). UI production-quality; placeholder copy/assets by design. Open: `/signup` doesn't read the CTA's query params; `/terms` + `/privacy` don't exist. |
| `lane/platform-concept` | **0** | fully merged, v8, six owner rounds. Read `docs/HANDOFF-2026-08-13-mobile-dock-and-room-line.md`. Phases 4+6 SKIPPED. |
| `lane/analyze-401` | **0** | fully merged (#456). Open part: 4 paid sites still deferred behind an exact-set ratchet. |

**One stale open PR:** #376 `cursor/dev-environment-setup-5316`. Nobody has touched it; close or merge.

**Also open, no branch:** the outcome loop has never closed — `reconciliations` is 0 rows and the
only capture affordance is stranded on the dead start-page, so any accuracy-ledger UI renders empty
forever. And insight-drill parity still needs a scope call on the last two templates (no producer
exists).

---

## 7. Traps that will cost you time

- **`npx tsc --noEmit` before every commit.** vitest does not typecheck, and a green Vercel check is
  not a build (`ignoreCommand` skips and still posts success).
- **vitest:** `node node_modules/vitest/vitest.mjs run <path>` — npx output is swallowed here and a
  passing run reads as a failure. **tsx:** `node node_modules/tsx/dist/cli.mjs`, script must live
  inside the repo.
- **Playwright:** the package is `@playwright/test`, not `playwright`. A probe script must run from
  the repo root to resolve it. Use `animations:'disabled'` + `caret:'hide'`.
- **Live scrapes need the sandbox OFF** — the sandbox drops the Apify/TikTok network.
- **For component verification, skip auth entirely**: a throwaway `src/app/zz-preview/page.tsx` sits
  OUTSIDE the `(app)` group, needs no login and compiles in seconds. **Delete it before committing.**
- **Check which worktree owns a port before assuming a dev server is yours** — `:3000` is
  platform-concept. `lsof -ti:3000`, then `--port 300X`.
- **The post-commit hook AUTO-PUSHES.** Amending after it fires needs a force-push.
- **`supabase db push` is UNSAFE here** (migration-ledger drift). Single migrations via the SQL
  editor. Project `qyxvxleheckijapurisj`.
- **Co-sessions move `main` underneath you.** `git fetch` + re-measure with `git rev-parse` before
  branching AND before merging — `git log --oneline` elides merge commits here.
- **At the Apify cap, Apify 403s and the app disguises it as "check your handle is public."** Check
  the ACCOUNT before debugging any scrape failure.
- **Trunk never holds a long-lived branch.** Multi-session work → its own worktree + branch. Quick fix
  → `git switch -c fix/<thing>`, PR + merge + delete the same session.
