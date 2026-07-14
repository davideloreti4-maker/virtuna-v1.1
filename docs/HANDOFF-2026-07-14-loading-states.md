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

## ▶ FIRST TASK NEXT SESSION — watch one live run

**Everything above is verified against FIXTURES in `/dev/cards`. The live 2-minute run has never been
watched end-to-end.** That is exactly the failure mode this lane existed to fix, so do not let it
stand. `.env.local` has the Apify/DashScope keys **and** `FILMSTRIP_EXTRACT_SECRET`, so a local run
exercises the whole path for real.

Verify, with the browser open on `/analyze/[id]`:
1. `source` fires within seconds → the post card appears.
2. Frames land **incrementally** (the strip fills) — NOT in one burst. This is the change with the
   most room to be wrong: it depends on the per-frame `patch_analysis_variants` write landing and the
   2s poll picking it up.
3. The `roster` query actually resolves the audience via the row's `society_id`.
4. The spine advances on signals, not on the elapsed-time floor.

Cost: ~2 min, a small API spend, one Reading billed to the ledger.

## 🔴 OWNER — check before this matters in prod

**`FILMSTRIP_EXTRACT_SECRET` must be set in Vercel.** `triggerFilmstripGeneration` **returns
silently** when it is absent (`filmstrip/queue.ts:28`) — no error, no frames, ever. The frame strip
(the best part of the feature) would simply not exist in prod and *nothing would tell you*. Same
failure shape as the dead crons (missing `SUPABASE_SERVICE_ROLE_KEY`, see `RESUME-HERE-2026-07-13`).

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

---

## Still open (untouched — needs real context, don't start it at <50%)

The card backlog from the morning handoff: **Band primitive first** (its coloured band-word-as-hero is
the pattern Simulate and Predict both copied — fixing it unblocks two others), then Simulate / Predict
/ Account Read / Explore, then the 4 owner calls in `ui-skill-cards.md §0.7` (sharpest: the empty
persona slot styled as a verbatim — an absence dressed as something they *said*).
