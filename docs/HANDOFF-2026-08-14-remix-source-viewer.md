# Handoff — remix: the source viewer is built (2026-08-14)

**Read this FIRST.** It supersedes `docs/HANDOFF-2026-08-14-remix-scrub-and-embed.md` entirely for
status, and **corrects its §3 and §4**, which were priced against measurements that turned out
wrong. That document's §1 (what already exists) and §2 (the no-copy-of-the-source constraint) are
still accurate and still worth reading. The design spec for this work is
`docs/superpowers/specs/2026-08-14-remix-scrub-and-embed-design.md`.

**State:** PR **#515** open off `lane/remix-scrub-and-embed`, 6 commits, rebased on `main`
`37427096`. `tsc 0 · build 0 · 6530 passed / 42 skipped / 0 failed`.

---

## 0. What shipped

The owner's 2026-08-14 ruling — *"a way to play the video and a connected filmstrip"*, then *"a
combination of 1 and 3"* — built as one unit inside the shoot-sheet block:

- **A scrub strip.** ~30 stills on an even time grid. **One playhead drives three things**: the
  stage frame, the lit strip cell, and the lit beat row. Clicking a beat row seeks the playhead
  back to it — that reciprocity is what makes the two halves read as one instrument.
- **An embed.** TikTok and Instagram (owner ruling; 96% of the corpus). Plain `<iframe>`, so no
  third-party JS loads, and it **mounts only on click** — a thread can hold three remix cards.
- It sits **inside the shoot-sheet block**, not at the top of the card. The card's `SourceStrip` is
  ~1,400px above the beat rows; a playhead up there would light a row nobody can see.

**No accent anywhere** — emphasis is a left rule, brightness and cream. The dosage rule is LOCKED
and the card already spends its one on the Borrowed chip.

---

## 1. 🔴 Corrections to the previous handoff — do not re-derive these

| It said | Measured 2026-08-14 |
|---|---|
| "Raise `MAX_BEAT_FRAMES` (step 1)" | **A no-op.** `buildBlueprint` merges to `MAX_BEATS = 8`, so there is never a 9th beat for a 9th beat-frame. A strip needs a *time-grid* sampler, which is a different thing from a sample per beat. |
| "4 frames = 2.6s" | **15.6s** (3.9s/frame). But one ffmpeg pass does **115 frames in 5.5s** — cost is the connection, ~O(1) in frame count. |
| "The keyspace question is the owner's call on storage cost" | **Settled by measurement**: ~3MB and ~6s per run. Option 2's "tighter budget" worry does not exist. |
| "`platform` is hardcoded — this lands directly on the embed work" | It **never reaches resolution** (`resolve-and-rehost.ts` has zero references to it). It does not block the embed. Derive platform from `source_video_id` instead. |
| "an Instagram source" (as an edge case) | **Instagram is 63% of the corpus** — 333 IG / 177 TikTok / 22 YouTube. TikTok is the minority path. |
| "`/dev/cards` renders its shell but mounts NO cards" | **It is AUTH-GATED.** That was the sign-in page. Signed in it works: ~81k chars, entries behind a `Skills` tab. |
| "the free probe" (as a working command) | **It could not start** — `scripts/probe-beat-frames.ts` never loaded `.env.local`. Fixed. |

---

## 2. How it is put together

| Piece | Where |
|---|---|
| Single-pass extraction | `src/lib/engine/filmstrip/extract-grid.ts` — `extractFramesAtTimes(url, duration, times[])` |
| Orchestration (both sets, one pass) | `src/lib/remix/beat-frames.ts` — `extractBeatFrames(..., durationS)`, `SCRUB_FRAME_COUNT = 30` |
| Scrub storage | `src/lib/engine/filmstrip/storage.ts` — `uploadScrubFrame`, `signScrubFrames`, `SCRUB_PREFIX` |
| URL → platform + embed | `src/lib/remix/source-platform.ts` — `parseSourceUrl` |
| The strip + playhead | `src/components/thread/remix-source-viewer.tsx` |
| The embed | `src/components/thread/remix-source-embed.tsx` |
| Wiring, lit row, row-click seek | `src/components/thread/remix-beats.tsx` |
| Route | `GET /api/remix/blueprint/[id]` → adds `scrubFrames` + `sourceUrl` |
| Seed tool | `scripts/seed-remix-blueprint.ts` |

**Why the keyspaces cannot collide.** Beat frames keep their existing flat path
`<id>/<beatIndex>.jpg` — moving them would strand everything already written — and scrub frames go
to `<id>/scrub/<i>.jpg`. Probed against real storage rather than assumed: `list()` returns the
subfolder as `name: "scrub", id: null`, which `signAnalysisFrames` drops on its `.jpg` filter. The
regression test in `src/lib/engine/filmstrip/__tests__/storage-scrub-isolation.test.ts` encodes that
measured payload.

**`extractFramesAtTimes` rounds a requested time FORWARD**, never to nearest, so a beat's sample can
never slide onto the cut at its start — which is the whole reason `sampleAt()` exists.

---

## 3. ⚠️ Two traps this lane created, both already tripped once

1. **Never verify the two frame sets by comparing bytes at the same index.** With a 115-frame grid,
   beat 0 (sampled 0.40s) and scrub 0 (sampled 0.476s) round to the SAME source frame, so identical
   bytes are *correct*. A byte-difference assertion reports a collision on a perfectly good run —
   it did, twice in one session. **The real signal is the KEY SET the reader returns**: a flat scrub
   write would make `signAnalysisFrames` return 30 keys instead of the beats'.
2. **A side-by-side layout was built, measured and removed. Do not rebuild it.** At 1440 the stage
   is a 96px tower in a 794px row, so stretching the strip to fill the height looks like the fix.
   It is not: a ~26×171 cell makes `bg-cover` crop a 9:16 frame to its centre band — exactly where
   a TikTok's baked caption sits — and 30 cells print the same caption 30 times as a garbled text
   ribbon. The reasoning is in the component so nobody re-derives the dead end.

---

## 4. Verification — what was actually done

Deploy is OFF and owner-confirmed. Nothing here relies on production.

- **Extraction, real video**: 4/4 beat + 30/30 scrub frames, 115-frame grid, all 34 distinct, and
  the JPEGs were **dumped and looked at** — beat samples land mid-shot, not on transitions.
- **End to end**: a real seeded row read through the route as the signed-in owner — 200, the exact
  5-key contract, `sourceUrl` intact, **4 beat frames keyed `[0,1,2,3]` (not 30)**, 30 scrub frames,
  every URL resolving to a real JPEG. Row and frames dropped afterwards; prod verified back to its
  prior state (1 row, 48 filmstrip objects, 0 leftovers).
- **Browser**, native context per viewport at 390 and 1440: dim-past-playhead `brightness(1)→0.42`,
  timecode `0:00→0:15` on seek, 3 ticks for 4 beats, lit row tracks the playhead, row click seeks,
  **0 iframes before click and 1 after**, no page errors. Card 1764 → **2036px** at 390px; the embed
  adds **612px only when opened**.
- Both embed hosts return 200 and set neither `X-Frame-Options` nor `frame-ancestors` — genuinely
  framable today. **No CSP is set anywhere**; if one is ever added, `frame-src` must allow
  `www.tiktok.com` and `www.instagram.com` or the embed dies silently.

Three defects only the browser caught: a clipped playhead knob, the side-by-side dead end above, and
an embed panel with **no exit** (the spec promised an "Open on X ↗" link the implementation lacked —
it only mattered once the iframe rendered as a 560px black rectangle).

---

## 5. Commands

```bash
# Free — no Apify, no DashScope. PASS/FAIL + per-frame sha, both sets, keyspace check.
node node_modules/tsx/dist/cli.mjs scripts/probe-beat-frames.ts \
  --path "omni-split/59455-447571480576291.mp4"
#   ...add --dump /tmp to write the JPEGs out and LOOK at them.

# Seed a REAL shoot sheet to look at. ⚠️ WRITES TO THE SHARED PROD DATABASE — always --drop after.
node node_modules/tsx/dist/cli.mjs scripts/seed-remix-blueprint.ts \
  --email e2e-test@virtuna.local \
  --path "omni-split/59455-447571480576291.mp4" \
  --source "https://www.tiktok.com/@maritimeinsight.id/video/7671258420019744021"
node node_modules/tsx/dist/cli.mjs scripts/seed-remix-blueprint.ts --drop <blueprintId>

# Signed-in browser. /dev/cards is AUTH-GATED — without this you are screenshotting the login page.
E2E_BASE_URL=http://localhost:3011 E2E_USER_EMAIL='e2e-test@virtuna.local' \
  E2E_USER_PASSWORD='e2e-test-password-2026' \
  node node_modules/@playwright/test/cli.js test --project=setup --config=e2e/playwright.config.ts
NEXT_PUBLIC_CONCEPT_V8=true NEXT_PUBLIC_AMBIENT_V2=true npm run dev -- --port 3011
```

Then raw Playwright with `storageState: e2e/auth/state.json`, importing chromium from
`node_modules/@playwright/test/index.mjs` (`node_modules/playwright` does not exist here). The
shoot-sheet fixture is `/dev/cards` → **Skills** tab → the entry that mounts `[data-beats]`. Always
`page.route()` the paid endpoints: that user is a REAL PROD ACCOUNT.

---

## 6. Open, and honestly owed

- 🔴 **`PLATFORM = "tiktok"` is hardcoded** in `use-remix-launch.ts` while 63% of the corpus is
  Instagram. It does not break remixing and does not affect this surface, but it feeds
  `buildAudienceGroundingLine`, so **every Instagram remix is grounded as if it were TikTok**. Real
  defect, separate lane, nobody's task.
- **The `filmstrips` bucket has never been reaped.** 48 objects today, so it is small; this lane
  makes each run ~4× bigger. Not urgent (deploy off, no real users), still owed. ⚠️ The 8
  unscheduled cron routes are **deliberate** cost control, not rot.
- **Phase 4 (clips)** — the §8 ruling in the older handoff still stands if it is ever picked up; the
  owner deprioritised it and this lane routed around it.
- **Phase 5 (`revise_remix`)** — not started, two comments only.
- `beat.weakness` is stored and rendered to nobody. The stage is its natural home; flagged to the
  owner and deliberately not taken.
- The hero repeats as beat 0 — **left on purpose**; it is a generation problem and hiding it in the
  renderer would mask real model behaviour.
- Three cards → three fetches of the same row (`remix-beats.tsx`).
- A script entry whose `index` matches no beat is dropped silently.

---

## 7. Standing rules that cost time here

- **A single live run proves nothing** — the adapt call is non-deterministic at temperature 0.
  Sample N, report a rate.
- **vitest does not typecheck.** Run `tsc` yourself. A green Vercel check is not a build, and
  **merging does not deploy** (owner-confirmed off).
- Kill the dev server before the suite; `--maxWorkers=3`. The suite flakes 0–5 tests in
  `scraping/resolve-video` + `engine/omni-analysis-*`; **check WHICH file failed before blaming your
  diff** (it flaked once here, and two subsequent full runs were green).
- **A launchd reaper kills idle dev servers after ~10 min** — it killed one mid-session here.
- **`main` moves constantly.** It moved twice during this lane. `git fetch` and re-measure before
  branching AND before merging.
- **`.githooks/post-commit` AUTO-PUSHES.** It pushed pre-rebase commits, so the later push was
  rejected as non-fast-forward on a branch never manually pushed. That is recoverable — check
  `git cherry -v HEAD origin/<branch>` first; every commit prefixed `-` is already yours by
  patch-id — then force **with an explicit lease on the sha you inspected** and read the
  `+ <old>...<new>` line.
- Native browser context per viewport. Resizing a loaded page is not the mobile UI.
