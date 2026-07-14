# Handoff — 2026-07-14 (evening) · the loading states

> Written at the close of `lane/explore-a` → `feat/reading-loading-evidence` (**PR #295**, 5 commits,
> 12 files, 748 tests green, reviewed + 2 real bugs fixed).
> Companion SSOT for the cards work: `docs/HANDOFF-2026-07-14-cards-and-loading.md` (the ranked card
> backlog in its §0.6/§0.7 is still open and untouched).

---

## The one idea worth carrying forward

**The product already had the proof. It was throwing it away.**

Both of the product's ~2-minute waits showed almost nothing — while the server sat on real,
user-specific artifacts the whole time:

| Wait | What the server had | What the user saw |
|---|---|---|
| `/analyze` ~5s | the post's cover, author, view count | discarded (pipeline kept only `mp4Url`) |
| `/analyze` mid-run | **real keyframes of their own video**, *already streamed* with `keyframe_uri` | discarded — rendered as the number "7" |
| `/analyze` the ~60s sim | the reactors are their **own calibrated audience**, in the DB | nothing |
| calibration ~5s | the creator's avatar, follower count, every video cover | used, then hidden |

`filmstrip_segment_ready` had **always** carried `keyframe_uri`. The client parsed out the index,
**dropped the picture**, and kept a tally. We rendered *"7 frames read"* instead of the seven frames.

Almost none of this needed new data. **Before building a loading state, ask what the server already
knows and is silently discarding.**

---

## SHIPPED — PR #295

**`/analyze`:** the post we fetched → its frames filling in as we read it → the #207 spine (which
shipped for the *skills* and never reached the flagship) → their audience arriving to watch.
**Calibration:** the account we scraped → the posts we're about to watch, filling in beneath it.

- `pipeline.ts` — `publishSourceReceipt()` (fire-and-forget → `variants.source`).
- `filmstrip/extract` — publishes **each frame as it is cut** (was: one write after the loop, so
  frames arrived in a burst and the strip could never fill *while* the video was being read).
  Seeds the grid up front so the client knows how many are coming.
- `analyze/[id]/stream` — new `source`, `roster`, `filmstrip_plan` events. Poll budget is now a
  **280s wall-clock deadline** (was 45 attempts = 90s, on a ~120s run — every Read outlived its own
  progress stream and only recovered because EventSource silently reconnects).
- `calibration.ts` — new `onEvidence` dep, fired the instant the scrape returns, **before**
  enrichment. That ordering is the point (it is proof *during* the wait) and is pinned by a test.
- `/dev/cards#reading` — 3 new states: **source landed · frames landing · audience watching**.

### The honesty guards (do not remove them)

- A frame that failed to extract **keeps its slot and shows nothing** — never a broken image.
- `video_upload` scrapes nothing → **no source card**. Never dress an absence as a source.
- A thin account falls back to a niche search and **synthesises** a profile → evidence is **not**
  emitted there (showing it would put a face on screen we never scraped). **Guarded by a test.**
- The roster shows the **cast, never their reactions** — those are what the Read is *for*.

Pacing/stagger/step-ordering are presentation and are fair game (owner call, 2026-07-14). Inventing a
*specific fact* — a thumbnail of a video we didn't fetch, a reaction the sim hasn't produced — is not.

---

## ✅ THE LIVE RUN — DONE (2026-07-14, two real runs)

Two real Reads, watched end-to-end, DOM measured (not eyeballed). **It found two bugs that had
shipped green — and one much bigger thing that is not ours.**

| # | claim | live verdict |
|---|---|---|
| 1 | `source` fires "within seconds" | ✅ fires — but at **24s**, not "seconds" (that is the Apify scrape). The opening 24s of the wait still has no source card. |
| 2 | frames land incrementally | ✅ confirmed — 3 poll ticks (79s → 81s → 83s), not one burst. But extraction only *starts* at ~77s and the whole strip fills in **~4s** of a ~150s run. |
| 3 | `roster` resolves via `society_id` | ❌ **DEAD.** Fixed → `53bea342`. |
| 4 | spine advances on signals | ✅ steps advanced on real signals; a mid-run reload correctly re-shows the spine (not a stale verdict). |

### The two bugs (both shipped green, both invisible to the suite)

1. **The roster could never fire.** It read `row.society_id` — **nothing writes that column.** The
   submit path sends only `input_mode`/`content_type`/`tiktok_url`, so `/api/analyze` stores
   `society_id: null` on every live row. The "your audience is watching" state — the whole point of
   the emptiest 60s — did not exist in the real app. It now resolves the audience the way the engine
   does (`resolveThreadAudience`, the same helper every generative route uses).
   *`society_id` was deliberately NOT written to fix it: it is the cohort key for the niche-percentile
   RPC, so populating it would silently reshape niche rankings.*
2. **The cast rendered as engine slugs.** `label ?? archetype` printed `high_engager` for every
   persona without a creator-set label — on a General audience that is all ten, i.e. the default.

Now proven live: the wait shows **Maya, Dev, Priya, Sam, Jordan, Alex, Theo, Nadia, Elena, Robin**.

**The generalisable lesson, again:** a fixture cannot tell you that the *column your query reads* is
one nothing writes. Both bugs were in the seam between two subsystems that each looked correct.

---

## ✅ THE BIG ONE — a failed audience shipped as HIGH confidence (FIXED, `d6b15bc0`)

Two runs, same session, same user — a natural control:

| run | score | personas | confidence | warnings |
|---|---|---|---|---|
| `VdwSBcf0i3bO` (fold OK) | 64 | **10** | **LOW** — "limited signal data" | — |
| `iEbgUsLZRSFw` (fold died) | 78 | **0** | **HIGH** | `Request was aborted` ×2 |

The Read whose **entire audience simulation failed** — both fold attempts timed out at 45s
(`FOLD_ATTEMPT_TIMEOUT_MS`), zero personas — presented itself as **78 / HIGH confidence**. The run
that actually simulated ten people called itself LOW. The only tell for the user was one quiet line
mid-page: *"No audience reaction landed for this video."*

### The cause — the fold has three states and the aggregator modelled two

1. fold ran and produced an audience → agree against it (a real independent signal);
2. fold **never applicable** (text mode) → fall back to apollo-vs-behavioral;
3. fold **ran and died** → was ALSO taking branch 2. **That is the bug.**

Branch 2's counterpart is derived from the *same Apollo call* as the thing it is compared against —
`calculateConfidence`'s own docblock already called it *"self-agreement, a fake trust anchor that
pinned the term at its 0.4 max"*. So the broken run was handed the **maximum agreement bonus**:
`0.2 base + 0.1 video + 0.4 fake agreement = 0.7 = HIGH`.

### The fix (`d6b15bc0`, branch `fix/audience-failure-honesty`)

- A fold that was **attempted and failed** scores agreement **0** — there is no counterpart — and is
  **capped so it can never read HIGH**, explicitly, so a future bump to the signal component cannot
  quietly buy the HIGH back.
- It **says so** in `warnings` instead of leaving the user to infer it from a missing section.
- The Read stops implying the room watched and shrugged. *"No audience reaction landed for this
  video"* reads as a verdict; it now says **"Your audience didn't get to watch this one — the
  simulation failed… the score above is an expert read only, with no audience behind it."**
- **Text mode is untouched.** It never promised an audience, so its fallback is legitimate.
- The **score is kept** (Apollo genuinely ran). What changes is the *claim made about it*.

**`ENGINE_VERSION` 3.20.0 → 3.21.0 — required, not cosmetic.** The prediction cache keys on it;
without the bump every already-cached fold-failed row keeps replaying its old HIGH badge on a cache
hit, and the fix never reaches the rows that have the bug.

**Verified live, not just in tests:** forced the fold to fail (`FOLD_ATTEMPT_TIMEOUT_MS=1`) on a real
Read → engine 3.21.0, 0 personas, confidence **LOW**, and the honest note on screen. The 3
behavioural guards fail without the change; the text-mode guard passes both ways by design (that is
its job).

## 🔴 OWNER — still open

**`FILMSTRIP_EXTRACT_SECRET` must be set in Vercel.** `triggerFilmstripGeneration` **returns
silently** when it is absent (`filmstrip/queue.ts:28`) — no error, no frames, ever. Same failure
shape as the dead crons (missing `SUPABASE_SERVICE_ROLE_KEY`).

**Local gotcha for the next live run:** the trigger POSTs to `${NEXT_PUBLIC_APP_URL}/api/filmstrip/extract`,
and `.env.local` pins that to **:3000**. Run the dev server on **3000**, not 3001, or the frames fire
into a dead port and you will "verify" a false negative. Also: a repeat of the same URL is a
**cache hit** ("silent replay") — use a fresh video for a real run.

---

## Two bugs the review caught — both would have shipped

1. **The spine could freeze for 2 minutes, then snap.** Every step was anchored on a real signal —
   and *not one of those signals is guaranteed*: an upload emits no `source`; the filmstrip trigger
   no-ops without its env var; a video whose frames all fail emits a plan and then nothing. The spine
   parked on one step for the whole run, then flipped all three to done in a single frame — **worse
   than the shimmer it replaced.** Fixed with an elapsed-time **floor** (`STEP_FALLBACK_MS`): signals
   still win and still advance it earlier; time only stops it stalling. Regression-tested.
2. **The poll counted attempts, not time.** 145 × 2s assumed its own DB read was free — but it
   re-reads the full row incl. a `variants` blob this PR makes *grow*. 7–15s of unbudgeted drift,
   enough to be force-killed by `maxDuration` mid-frame. Now a wall-clock deadline.

**Lesson: "anchored on a real signal" is only as strong as the signal's delivery guarantee.** Ask what
happens when the signal never comes — on this codebase that is usually a silent env-var no-op.

## Verified, so you don't re-derive it

`patch_analysis_variants` (`supabase/migrations/20260706130000_atomic_variants_merge.sql`) **deep-merges
by top-level key**; arrays are replaced wholesale. So `source` / `filmstrip_segments` / `craft` /
`apollo` / `remix` patches **cannot clobber each other**, and the per-frame array write is safe
(single writer per analysis). The roster query is RLS-bound and IDOR-clean.

**Now confirmed on a live row, not just by reading the migration** — `iEbgUsLZRSFw` ended the run with
all six keys intact side by side: `hero`, `craft`, `apollo`, `source`, `engagement_range`,
`filmstrip_segments`. The concurrent per-frame writes clobbered nothing.

**Dead code found while tracing:** `extractPartialPersonas` (stream/route.ts) reads
`row.analysis_results.partial.personas` — **there is no `analysis_results` column** on the table (the
fields are top-level: `personas`, `variants`, …). So the `partial` event has never once fired. It is
harmless today (the fold only produces personas at the end, so there is no partial state to stream)
but it is a progressive-reveal hook that silently does nothing. Delete it or wire it to something real.

---

## ▶ Next session

1. ✅ **#295 merged** (`c1f503ff`) — loading states + the roster fix.
2. **Merge `fix/audience-failure-honesty`** (`d6b15bc0`) — the confidence fix above. Note the
   `ENGINE_VERSION` bump invalidates the prediction cache by design.
3. 🔴 **OWNER — `FILMSTRIP_EXTRACT_SECRET` in Vercel prod** (still open; owner had no Vercel access
   2026-07-14). Without it the frame strip silently does not exist in production.
4. Then the card backlog below.

**Two timing facts worth designing around** (both measured today, neither is a bug):
- the source card cannot appear before ~24s (the scrape is the floor), so the *opening* of the wait
  is still the thinnest part;
- the frame strip only exists for the last ~4s of a ~150s read (extraction starts at ~77s, after
  wave-0). The strip is real, but it is not what fills the wait — the spine is.

## Still open (untouched — needs real context, don't start it at <50%)

The card backlog from the morning handoff: **Band primitive first** (its coloured band-word-as-hero is
the pattern Simulate and Predict both copied — fixing it unblocks two others), then Simulate / Predict
/ Account Read / Explore, then the 4 owner calls in `ui-skill-cards.md §0.7` (sharpest: the empty
persona slot styled as a verbatim — an absence dressed as something they *said*).
