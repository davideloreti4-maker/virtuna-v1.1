# Handoff — remix: the card rework + phase 3 frames (2026-08-13)

**Everything below is MERGED on `main` at `5612063d` (PR #494).** Working tree clean.
**Supersedes `docs/HANDOFF-2026-08-13-remix-next.md` for status** — three of that document's
claims are measured wrong, see §5.

Gates on merged main: **tsc 0 · build 0 · 6395 passed / 42 skipped / 0 failed** (`--maxWorkers=3`).

---

## 0. ▶️ What shipped

**The card rework** (`1264837a`) — five defects found by opening the card signed-in at a **native
390px and 1440px**, which nobody had ever done. Everything previously on record about this card was
rendered against a stubbed fetch.

**Phase 3 frames** (`b264f2dd`) — a real still from the source video on every beat row. The sheet
used to say *"0.0–3.2s · HOOK — tight crop, talking head"* and show you nothing.

**A live probe** (`6ff49340`) — `scripts/probe-beat-frames.ts`, because the 12 unit tests mock
ffmpeg and mock storage, and this repo's history is a graveyard of green suites over broken
producers.

---

## 1. How phase 3 works (read before touching it)

**The bytes.** The runner holds `signedUrl` — a live signed URL to the rehosted source mp4 — from
Resolve until `cleanup()` fires in its `finally` (T-03-02 derive-and-drop). That window is the only
time the video is reachable. Extraction starts right after `buildBlueprint` **without being
awaited**, and is joined in the `finally` **before** `cleanup()`. The ~50s adapt call therefore pays
for the extraction wall-clock, and the temp mp4 still cannot outlive the run.

⚠️ **The source mp4 is still dropped.** This derives stills and keeps those. `video_storage_path`
is still never set for a scraped source. Deliberately a smaller claim than phase 4's clips.

**No schema change.** `uploadFrameAndGetSignedUrl` / `signAnalysisFrames` take a **path prefix**,
not an `analyses` FK, so `blueprintId` slots straight in. Nothing writes to `analyses`.

**What it refuses to do, and why each refusal is load-bearing:**

- **`from_fixed_buckets` sheets get NO frames.** That grid describes no video at all — evenly
  spaced cells over a very likely invented duration — so its timestamps point at nothing. Real
  pixels under fabricated times is worse than no frames, and it is the same reason `RemixBeats`
  already refuses to print that sheet.
- **Samples INSIDE the beat, never `t_start`.** A beat boundary is a *cut*; the frame on it is
  often the transition — a dissolve or a black frame. Offset is a quarter into the beat, capped at
  400ms so a long beat still shows the shot the source cut **to**.
- **Sequential, not `Promise.all`.** Eight concurrent range-seeks against one signed URL turns a
  graceful degrade into a rate-limited one.
- **Re-signs at READ.** Write-time URLs are 30-day and are never persisted: a stored URL is a dead
  `<img>` on day 31 and a live credential in a shared thread.
- **A signing failure serves the text sheet at 200.** The frames are an enhancement over something
  that was already a complete product; 500ing would delete the shoot sheet over a thumbnail.

A missing frame renders `CoverFill`'s play-tile, so a partial set — the normal shape — reads as a
timeline with a gap. **Every pre-phase-3 sheet renders byte-identically.**

---

## 2. Phase 3 is verified against a REAL video, not a mock

```
node node_modules/tsx/dist/cli.mjs scripts/probe-beat-frames.ts \
  --path "omni-split/59455-447571480576291.mp4"
```

Free: no Apify, no DashScope, no dev server, no auth. Measured 2026-08-13 on merged main:

```
persisted: 4/4 frames in 2.6s
beat 0:  82398 bytes  jpeg=yes  sha=15ab2b5a252c
beat 1:  91353 bytes  jpeg=yes  sha=b0c2ca65906e
beat 2:  90502 bytes  jpeg=yes  sha=caf878c645ae
beat 3: 109729 bytes  jpeg=yes  sha=41c86bb1e50a
distinct frames: 4/4 — PASS
```

**The failure it exists to catch:** ffmpeg exiting 0 while ignoring `-ss`, returning frame zero
every time. That is N identical JPEGs, a clean exit, an INFO log reading `"4 persisted"`, and a
sheet where every beat shows the same picture. No unit test can see it; on a card it reads as a
style choice. The probe sha1s every frame and **fails unless all are distinct**.

`--dump <dir>` writes the JPEGs out, because distinct hashes prove the seek moved and **not** that
the pixels are of the video rather than of a codec error. Two were opened: real 720×1280 frames
with the on-screen caption legible, and beat 3 is a visibly different shot from beat 0 (different
location, phone in hand).

3.2s for four frames sits far inside the 45s budget **and** overlaps the adapt call, so extraction
is free wall-clock in a real run.

---

## 3. 🔴 Open work — verified in code 2026-08-13, not inherited

### 3.1 Phase 2 — the pre-brief has a backend and no UI

`brief` is accepted by the route (`route.ts:73`, `z.string().max(200).optional()`), flows through
`remix-runner.ts:95`, and reaches the adapt call as `target` (`:342`). **Nothing in the UI ever
sends it** — there is no pre-brief surface anywhere in `src/components`. It is a backend field with
no producer, the same silent-no-op shape as the empty profile columns.

### 3.2 Phase 2's second §6 fix — `useRemixLaunch` swallows HTTP errors ⚠️ USER-VISIBLE

`src/components/discover/use-remix-launch.ts:32-39`. **Confirmed still broken today:**

```ts
await fetch(handoff.endpoint, { ... });   // no res.ok check
router.push("/home");                     // navigates regardless
```

`fetch` does not throw on HTTP status, so a **402 credit refusal or a 401 lands the creator on
/home with no card and no message** — it reads as the product being broken. `pendingId` also never
clears on the success path. This is the cheapest real-user-facing fix in the lane.

### 3.3 §6's other fix — the multiplier — appears DONE, one thing unverified

The design asks to switch `rankOutliers` call sites to the per-author denominator. Both sites now
attach the receipt: `discover/route.ts:144` and `explore-runner.ts:179` → `attachOutlierReceipt`,
which replaces `multiplier` + `baselineLabel` from `author-baseline`. Consistent with
[[multiplier-depends-on-scrape-size]] (fixed 2026-08-11).
**Unverified:** the design requires the label to change *with the basis* —
`"vs their lifetime average"`, never `"vs their usual views"`. `outlier-receipt.ts:21` still
documents a `"vs their usual views"` branch for profile pulls. Read that branch before calling §6
closed.

### 3.4 Card defects found and deliberately NOT fixed

- **The hero repeats as beat 0.** Hero: *"…replaced them with 3 prompts."* Beat 0 spoken:
  *"…replaced them with three prompts."* Near-verbatim, ~1000px apart at 390. **I fixed the
  `production.shots` duplication and left this one** — it is a *generation* problem (the adapt call
  writes beat 0 as the hook), not a layout one, so deleting it in the renderer would hide a real
  model behaviour rather than fix it.
- **`beat.weakness` is never rendered.** Grepped again today: zero references in `remix-beats.tsx`.
  The source's diagnosed factor + score are stored and shown to nobody; only adapt's prose `repair`
  surfaces. Bigger than the "raw casing" minor the old ledger recorded.
- **Three cards → three fetches of the same row** (`remix-beats.tsx:79`). Correct and cheap at this
  volume; the obvious fold-in whenever the three cards collapse into one ranked sheet.
- **A script entry whose `index` matches no beat is dropped silently.** Nothing counts or reports
  it. The reverse case renders *"No line was written for this beat."*
- **The card is 1764px tall at 390px** (grew ~56px with frames). Length was never in scope.

### 3.5 Retention — owed, not built

Nothing deletes `remix_blueprints` rows, and the frames inherit that. ≤8 JPEGs per run accumulate
in the `filmstrips` bucket under a `blueprintId` prefix. **No reaper exists.** Flagged in
`beat-frames.ts` and in the commit, not silently left.

### 3.6 Phase 4 (clips) — ⚠️ the owner may have ALREADY ruled

`HANDOFF-2026-08-13-remix-next.md` §4.3 says clips *"need an explicit owner ruling"*. **The design's
own §8 says the ruling was made:**

> **Retaining fragments of third-party video.** Raised twice, including once with the
> enforced-policy finding in hand. **Ruled: clips are worth it.** Mitigations kept: ≤4s, muted,
> source mp4 still deleted, clips die with the thread, ≤8 per source.

So phase 4 may be blocked on *implementation*, not on a decision — the trim route, the
`derive-and-drop`/`T-03-02` amendment, and rewriting three test files that encode the current line
(`analyze/__tests__/derive-and-drop.test.ts`, `analyze/__tests__/decode-route.test.ts` C4 block,
`engine/__tests__/tiktok-url-branch.test.ts`).
**Do not start on the strength of this paragraph** — confirm with the owner that §8 still stands,
since it predates phase 1 and phase 3. But do not repeat "needs a ruling" as though nothing exists.

### 3.7 Phase 5 — `revise_remix` exists only in two code comments

`blocks.ts:520` and `blueprint/[id]/route.ts:5`. Nothing implements it.

---

## 4. 🔴 The two facts that should reorder any plan

**Nothing is deployed, and I could not confirm whether the merge changed that.** The Vercel MCP
returned 502s; `virtuna-v11.vercel.app` answering 200 says nothing about which commit is live.
[[vercel-git-disconnected]] says merging does not deploy. **Reported as unconfirmed, not asserted —
check it before assuming anyone can see any of this.**

**Zero genuine creators have ever produced a remix card.** Measured against prod today, every
`remix-card` block ever written:

| source | cards | proof | shoot sheet |
|---|---|---|---|
| dev-mock seed (`fixtures.ts` gas-station hook) | 7 | 0 | 0 |
| runner, **e2e probe account only** | 24 | 24 | **3** |
| genuine creators | **0** | — | — |

`distinct_users = 1`. Full method in `memory/remix-has-no-real-users.md`. This is enough to verify
a **code path** and not enough to describe creator behaviour at all — never quote 24/24 as a
production rate.

---

## 5. What the previous handoff got wrong

`HANDOFF-2026-08-13-remix-next.md` §4.1, all three measured false today:

1. **"used twice on the card (hero cover + SourceStrip)"** — two call *sites*, mutually exclusive
   branches (`remix-card-block.tsx:119-132` is a ternary). One ever renders.
2. **"a still thumbnail with a play button"** — `CoverFill` stacks its Play glyph *underneath* the
   cover, so it was only visible when the cover was missing or expired. Measured
   `coveredByImg: true`. **Now fixed deliberately**: the badge is a sibling that sits *over* the
   cover, so a loaded cover still says "this is a video you can open".
3. **"Clicking does nothing"** — the strip has been an `<a>` since `51fadaf7` (**2026-08-02**),
   eleven days before that sentence was written. It was true once and was inherited without being
   re-derived.

**The generalisable lesson is in `memory/claims-live-in-denormalized-copies.md`:** a memory entry is
living state (sync the copies); a handoff is a *dated record*, and the fix is that a later document
must **re-derive** a load-bearing claim or cite it as dated. `git log -S'<symbol>' -- <file>` against
the doc's own date is the cheap discriminator — "never true" is an error, "true then fixed" is
inheritance, and inheritance means **every sibling claim in that document is suspect**.

---

## 6. Traps carried forward

- **A single live run proves NOTHING here.** The adapt call is non-deterministic despite
  `temperature: 0` + a fixed seed. Sample N, report a rate. [[adapt-call-is-nondeterministic]]
- **vitest does not typecheck.** It caught nothing in a TS2783 in the new test helper; `tsc` did.
  Run `tsc` yourself; a green Vercel check is not a build.
- **The suite flakes under CPU load.** A composer test failed once with a dev server + browser
  running, passed alone and passed on a clean re-run. Use `--maxWorkers=3` and check *which* file
  failed before blaming your diff. [[suite-flakes-scraping-omni]]
- **Open a NATIVE context per viewport.** Resizing a loaded page does not give you the mobile UI.
  [[screenshot-viewport-must-be-native]]
- **`/dev/cards` needs the flags inline** or you silently audit the flag-off UI:
  `NEXT_PUBLIC_CONCEPT_V8=true NEXT_PUBLIC_AMBIENT_V2=true npm run dev -- --port 3007`
- 🔴 **`[aria-label^="Remix:"]` NO LONGER SELECTS THE CARD.** PR #495 (`d6b2e1af`, F-14, landed
  hours after #494) replaced the card `<div>`'s `aria-label` with an `sr-only <h3>` — correct a11y,
  but every probe written this session used that selector and now matches **nothing**. A Playwright
  locator that matches nothing fails as a *timeout*, which reads as "the card didn't render" rather
  than "your selector is stale". Select the section (`#remix-shoot-sheet`) or the `h3` text instead.
- **The gallery fixture must match what the runner emits.** It didn't, and the one remix card foot
  anyone had ever looked at was a measured-verdict shape the projected path cannot produce. Fixed;
  keep them in step.
- **`git worktree remove` deletes gitignored files**, `.env.local` included.
