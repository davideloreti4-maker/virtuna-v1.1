# Handoff — remix: the scrub strip + the embed (2026-08-14)

**Read this FIRST.** It supersedes `docs/HANDOFF-2026-08-13-remix-card-and-frames.md` for status
(that document's §3.1, §3.2 and §3.3 are all now DONE) and keeps its §1 and §6, which are still
the best description of how phase 3 works and which traps recur.

**State:** `main` at `347b18d8`. Working tree clean. `tsc 0 · build 0 · 6462 passed / 42 skipped /
0 failed` (`--maxWorkers=3`).

---

## 0. ▶️ The decision this session ends on

The owner **replaced phase 4 (clips)** with a simpler shape. Phase 4 is not cancelled; it is not
next, and its §8 ruling still stands if it is ever picked up.

> **Build two things on the remix shoot sheet: a TikTok EMBED so the source can actually be
> watched with sound, and a SCRUBBABLE FRAME STRIP under it — one playhead that swaps the frame
> and lights the matching beat row as it moves.**

Owner's words: *"a way to play the video and a connected filmstrip for all the clips on remix"*,
then, when offered the three options: *"a combination of 1 and 3"* — i.e. the full scrub behaviour
**and** the embed, not the embed alone.

**Why this instead of phase 4.** Clips required reversing a stated policy on retaining fragments
of third-party video, moving `cleanup()` ownership out of the runner's `finally` (the one
invariant the whole pipeline is built around), a new ffmpeg route, and rewriting three test files.
Frames need **no policy work at all** — they are already extracted, already persisted, already
served. The embed retains nothing: TikTok serves its own bytes. So this delivers "see the source,
shot by shot" with zero policy surface.

---

## 1. What already exists — reuse, do not rebuild

| Thing | Where | Note |
|---|---|---|
| Frame extraction | `src/lib/remix/beat-frames.ts` | `MAX_BEAT_FRAMES = 8`, sequential, `EXTRACT_BUDGET_MS = 45_000` |
| Frame storage | `uploadFrameAndGetSignedUrl(blueprintId, index, buffer)` | `filmstrips` bucket, **path prefix** = blueprintId — no `analyses` FK |
| Frame read | `/api/remix/blueprint/[id]/route.ts:81` | `signAnalysisFrames(id)` → `frames: Record<number, string>`, **re-signed every read** |
| Beat rows | `src/components/thread/remix-beats.tsx:133` | `const frame = data.frames?.[beat.index]` |
| **The scrub pattern to copy** | `src/components/reading/retention-scrubber.tsx` | Locked sketch 003-A: *"ONE playhead drives EVERYTHING — the video frame, the curve, the slider, the filmstrip cell"*. This is the interaction the owner is asking for, already designed and shipped once. |
| A static poster | `src/components/reading/thumbnail-strip.tsx` | Its header says *"Inline-playable is deferred; this is a static poster only"* — that deferral is what this lane finally answers |

`RetentionScrubber` plays a real `<video>` via `useUploadedVideoSource` because that video is the
**user's own upload**. Remix cannot do that (§2). Copy its *playhead-drives-everything* structure,
not its video source.

---

## 2. 🔴 The constraint that shapes everything

**There is no copy of the source video to play.** `remix-runner.ts` calls
`resolveAndRehost(url, requestId)` with **no owner `userId`**, so the run takes the orphan-drop
path and `cleanup()` deletes the temp mp4 unconditionally in a `finally` (`remix-runner.ts:529`,
T-03-02). `video_storage_path` is never set for a scraped source.

Verified this session, not inherited. So:

- a real `<video>` of the source is impossible without retaining the mp4 — **that is phase 4's
  policy reversal, and it is what the owner just routed around**;
- the embed must be **TikTok's own iframe**, serving TikTok's bytes;
- the scrub must be **stills**, which are already permitted.

**No CSP is set anywhere** (`next.config.ts`, `vercel.json`, middleware all checked) — a
third-party iframe is not blocked by policy today. If a CSP is ever added, `frame-src` must allow
TikTok or the embed dies silently.

---

## 3. ⚠️ The trap to design around BEFORE writing code

**Scrub frames and beat frames would collide in the same keyspace.**

`uploadFrameAndGetSignedUrl(blueprintId, beat.index, buffer)` writes under the blueprint prefix
keyed by an integer, and `signAnalysisFrames(id)` returns one flat `Record<number, string>`.
Today those integers are beat indices `0–7`. Extracting ~30 evenly-spaced scrub frames as `0–29`
into the same prefix **overwrites the beat frames**, and `remix-beats.tsx:133` would start
rendering a scrub frame where it means a beat frame. Nothing would error.

Three ways out. **Not decided — this is the first real call for the next session:**

1. **One time-indexed set (~30 frames), beats pick the nearest.** Cheapest: 30 extractions total,
   one keyspace, no duplication. ⚠️ Costs the thing `sampleAt()` exists for — it deliberately
   samples *a quarter into* a beat, capped at 400ms, because a beat boundary **is a cut** and the
   frame on it is often a dissolve or a black frame. An even grid will sometimes land exactly
   there, so some beat thumbnails get worse.
2. **Two sets on separate prefixes** (`{id}/beat/{i}` and `{id}/scrub/{i}`). Keeps `sampleAt()`
   intact, ~32 extractions (~20s sequential — still inside the 45s budget, but tighter), and
   **doubles storage in a bucket nothing reaps** (§6).
3. **One time-indexed set + keep the 8 beat frames as an offset range.** Works, but a single map
   holding two meanings is exactly the shape that produces a silently-wrong render later.

I would take **2** and say so in the commit: it is the only one that does not trade away a
deliberate, documented behaviour. But it is the owner's call on storage.

---

## 4. The work, in the order I would do it

1. **Raise the frame count.** `MAX_BEAT_FRAMES` is a `const` in `beat-frames.ts:36` and the
   extraction loop is already sequential with a budget ceiling. Measure the real wall-clock at the
   new count with the free probe (§7) before trusting it — 4 frames took 2.6s, but that is not
   guaranteed to be linear.
2. **Serve them.** `/api/remix/blueprint/[id]` already re-signs the whole prefix on read; if you
   take option 2 it needs to return two maps instead of one.
3. **Build the scrub strip.** Copy `RetentionScrubber`'s playhead structure. One playhead → the
   big frame, the strip cell, and the highlighted beat row. Frame swap on drag, no video element.
4. **Add the embed.** TikTok's oEmbed/blockquote. It exposes **no seek API**, so it cannot be
   driven by the playhead and must not pretend to be — keep it visually separate from the scrub,
   or the UI implies a link that does not exist.
5. **Watch the height.** The card is already **1764px at 390px**. An embed plus a strip could
   roughly double it. Decide up front whether either collapses by default.

---

## 5. ✅ Done this session — do not redo

- **PR #501** — three paid fetch sites swallowed their 402/401 and pushed to `/home`:
  `use-remix-launch.ts`, `feed/discover/discover-client.tsx`, `thread/account-read-block.tsx`.
  All three now `reportCredit402` / `reportSession401` and refuse to navigate. Browser-verified
  before and after. **`pendingId` is deliberately LEFT SET on success** — it is the double-fire
  guard and every consumer unmounts on `/home`; do not "fix" it.
- **PR #505** — the D3 pre-brief (phase 2). Sheet on all four launch points. ⚠️ The empty brief is
  **omitted**, never `null` (the route's `z.string().optional()` 400s on null) and never `""`
  (the runner's `target: input.brief ?? null` would replace the niche with nothing). Second button
  is **Cancel**, not Skip — an earlier draft had Skip *also* start the billed run, leaving no
  visible no-spend exit.
- **§6 is CLOSED.** Its multiplier half resolved the *opposite* way to the old handoff's worry:
  the label already changes with the basis, and the label the design demanded
  (`"vs their lifetime average"`) names `lifetime-avg-likes`, measured broken the day *after* the
  design was written. The design bullet is **annotated in place, not rewritten**, so nobody fixes
  the code back to it.
- **Phases 1, 2, 3 are in. 4 and 5 are not started.**

---

## 6. Open, and honestly owed

- 🔴 **`platform` is hardcoded `"tiktok"`.** `use-remix-launch.ts` has `const PLATFORM = "tiktok"`
  while the corpus carries **Instagram and YouTube** rows — the browser probe POSTed
  `platform: "tiktok"` for `https://www.instagram.com/reel/DZK33LctVEo/`. `v.platform` is on the
  row. **This lands directly on the embed work**: an Instagram source cannot take a TikTok embed,
  so step 4 has to decide what a non-TikTok source shows. Whether those rows should be remixable
  at all is a product call.
- **The `filmstrips` bucket has never been reaped by anything.** Not remix-specific — it predates
  phase 3; the analyze-path filmstrips accumulate too. Both existing reapers
  (`sweep-orphan-videos`, `delete-retained-videos`) target the `videos` bucket only, and nothing
  deletes `remix_blueprints` rows. ⚠️ The 8 unscheduled cron routes are **deliberate** cost
  control (`716b5312` turned all 10 off, `bb2887cc` restored three) — not rot, do not "fix" them.
  More frames per run makes this bigger; it does not make it urgent (deploy is off, no real users).
- `beat.weakness` is stored and rendered to nobody.
- The hero repeats as beat 0 near-verbatim — **left on purpose**, it is a generation problem and
  hiding it in the renderer would mask real model behaviour.
- Three cards → three fetches of the same row (`remix-beats.tsx:79`).
- A script entry whose `index` matches no beat is dropped silently, uncounted.

---

## 7. Free probes (no Apify, no DashScope, no auth)

```
node node_modules/tsx/dist/cli.mjs scripts/probe-beat-frames.ts \
  --path "omni-split/59455-447571480576291.mp4"            # PASS/FAIL + per-frame sha
node node_modules/tsx/dist/cli.mjs scripts/probe-beat-frames.ts \
  --path "omni-split/59455-447571480576291.mp4" --dump /tmp  # write JPEGs to LOOK at
```

It sha1s every frame and **fails unless all are distinct** — the failure it exists to catch is
ffmpeg exiting 0 while ignoring `-ss` and returning frame zero every time. **Raise the frame count
and re-run this first**; N identical JPEGs is exactly how a broken scrub would look correct.

**Signed-in browser probe** (this is how #501 and #505 were verified — copy the shape):

```
E2E_BASE_URL=http://localhost:3007 E2E_USER_EMAIL='e2e-test@virtuna.local' \
  E2E_USER_PASSWORD='e2e-test-password-2026' \
  node node_modules/@playwright/test/cli.js test --project=setup --config=e2e/playwright.config.ts
```

Then raw Playwright with `storageState: e2e/auth/state.json`. Import chromium from
`node_modules/@playwright/test/index.mjs` — **`node_modules/playwright` does not exist here**.
Always `page.route()` the paid endpoint: the e2e user is a REAL PROD ACCOUNT and remix/discover
are billed.

---

## 8. Traps that cost time this session

- **The live Discover surface is `/feed`, not `/feed/discover`.** `/discover` redirects to `/feed`.
  `/feed/discover` is the "Pull live" subpage. A probe pointed at the wrong one finds no cards.
- **`/dev/cards` renders its shell but mounts NO cards** (checked at 20/40/60/90/120s, no page
  errors). It is not a usable way to look at a card right now.
- **Radix aria-hides the rest of the page while a dialog is open.** So `getByRole("textbox")`
  inside a dialog is unambiguous *while open* and matches a background field the instant it
  closes. Assert dismissal on `queryByRole("dialog")`, never on the field.
- **Mock `fetch` by URL, never by call order.** Tiles mount `SaveAffordance`, which GETs
  `/api/saved` on mount and shifts every index.
- **A co-session works this repo in the same worktree.** One ran a blanket `git add` mid-session
  and swept 7 of my uncommitted files into its own commit, then pushed. **Commit early on your own
  branch.** And `--force-with-lease` does *not* protect a commit you never looked at — it only
  checks your tracking ref is current. Read the `+ <old>...<new>` push output.
- **Deleting a base branch on merge CLOSES any PR stacked on it**, and a closed PR whose base is
  gone cannot be reopened or retargeted. Merge the stacked child first, or retarget it to `main`
  before merging the parent.
- **Deploy is OFF, owner-confirmed.** Merging does not deploy. No plan may have "watch it in
  production" as its success criterion.
