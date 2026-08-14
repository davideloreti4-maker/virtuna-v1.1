# Design — remix source viewer: scrub strip + embed (2026-08-14)

Owner ruling 2026-08-14 replaced phase 4 (clips) with: **a way to watch the source with sound, and
a connected filmstrip for the beats** — "a combination of 1 and 3", i.e. the full scrub behaviour
*and* the embed. This spec is the design for that, approved in conversation on 2026-08-14.

Entry-point context: `docs/HANDOFF-2026-08-14-remix-scrub-and-embed.md`. This document **supersedes
that handoff's §3 and §4**, both of which were priced against measurements that turned out wrong.

---

## 0. What was measured before designing

Every row here is a measurement taken this session against prod, free, read-only. Several
contradict the handoff, which is why they lead.

| Measurement | Consequence |
|---|---|
| `MAX_BEAT_FRAMES = 8` is a **no-op backstop** — `buildBlueprint` merges to `MAX_BEATS = 8` | Handoff step 1 ("raise the frame count") changes nothing on its own. A denser strip needs a **new time-grid sampler**. |
| Corpus platforms: **Instagram 333 · TikTok 177 · YouTube 22** | TikTok is 33%. The non-TikTok case is the majority, not an edge. |
| Exactly **1** `remix_blueprints` row exists (2026-08-11, TikTok), and it is `from_fixed_buckets = true` | It renders the *"couldn't read the timing"* branch. **No real beat sheet has ever rendered in prod.** |
| **Zero** beat frames in the `filmstrips` bucket — all 7 prefixes are June/July analyze-path | Phase 3 extraction has **never run** in production. |
| `platform` never reaches resolution — `resolve-and-rehost.ts` does not read it | The hardcoded `PLATFORM = "tiktok"` corrupts only the grounding line. **This lane does not need it fixed.** |
| Per-frame spawn (`-ss` before `-i`, remote URL): **15.6s for 4 frames** | The handoff's "4 frames = 2.6s" is wrong by 6×. 8 frames ≈ 31s against a 45s budget. |
| **Single ffmpeg pass, `fps` filter: 8 frames 7.0s · 16 frames 7.2s · 30 frames 5.6s**, all distinct, 2.8MB | Cost is the connection + sequential read, **~O(1) in frame count**. 30 frames is 3× faster than today's 4. |

The last row is the one the design turns on. The handoff put the frame keyspace to the owner as a
storage-cost trade; measured, it is **~3MB and ~6s per run**, and option 2's "tighter budget" worry
does not exist. It is therefore settled by measurement, not by ruling.

⚠️ The documented probe command in the handoff **does not run as written** —
`scripts/probe-beat-frames.ts` never loads `.env.local` (no `dotenv` import, unlike its sibling
probes) and dies with `supabaseUrl is required`. Use `node --env-file=.env.local`. Fixing the
script is in scope (§7).

---

## 1. Owner decisions

1. **TikTok and Instagram both embed.** YouTube (22 rows, 4%) keeps the existing link-out.
2. Concept approved as specified in §2.

---

## 2. The surface

One **source viewer** unit at the top of the shoot-sheet block — deliberately *not* the top of the
card, because the entire point is that the lit beat row is on screen while you scrub. The card's
existing `SourceStrip` ("The post you're remixing") is ~1,400px above the beat rows; a scrub there
would light a row nobody can see.

```
┌────────────────────────────────────────────┐
│ SHOOT IT BEAT BY BEAT        ♪ Watch ▾     │  ← embed toggle, +0px until clicked
│              ┌──────────┐                  │
│              │  frame   │ 0:04             │  ← STAGE 96×171, timecode chip
│              │    ▶     │                  │     tap = play (silent flipbook)
│              └──────────┘                  │
│  ▓▓▒▒▒░░▓▓▒▒░░░▓▓▒▒▒░░▓▓▒░░░▓▓▒▒          │  ← STRIP ~30 cells, ~12px each
│  │   │      │        │         │           │  ← beat boundary ticks
│  ●─────────────────────────────────────    │  ← ONE playhead
├────────────────────────────────────────────┤
│  0.0–3.2s · HOOK · 2 cuts                  │
├────────────────────────────────────────────┤
│▌ 3.2–9.6s · SETUP                          │  ← LIT: left rule + brighter text
└────────────────────────────────────────────┘
```

**One playhead drives three things** — the stage frame, the strip cell, the lit beat row. This is
the structure of `src/components/reading/retention-scrubber.tsx` (locked sketch 003-A, *"ONE
playhead drives EVERYTHING"*), reused. Its **video source is not** reused: that component plays a
real `<video>` because the file is the user's own upload. There is no copy of a scraped source
(§3).

**Bidirectional.** Clicking a beat row seeks the playhead to that beat's start. The reciprocity is
what makes the two halves read as one instrument rather than two widgets.

**The strip is a track, not a gallery.** At 390px the content box is ~358px, so 30 portrait cells
are ~12px wide. That is correct: the strip communicates *position and rate of visual change*, and
the stage shows the actual frame — the way a video editor's timeline does. It is not trying to be
30 legible thumbnails.

**No accent, anywhere in this unit.** The dosage rule is LOCKED and the card already spends its one
on the Borrowed chip. The lit beat row gets a left rule (`white/[0.10]` → `white/[0.24]`) and
brighter text. The playhead is cream, as in `RetentionScrubber`.

**Height:** +~250px (card 1764 → ~2015 at 390px, +14%), and +0px more until the embed is opened.
The stage carries its own timecode chip and play affordance, so there is no transport row.

### The embed

Opens from the `♪ Watch ▾` toggle in the block header, as its own bordered panel **below** the
strip, labelled for what it is ("Plays on TikTok · sound on").

**It is deliberately not linked to the playhead.** Neither platform exposes a seek API to a plain
iframe, so a UI implying the playhead drives it would advertise a control that does not exist.
Scrubbing never touches the embed; playing the embed never moves the playhead.

- TikTok → `https://www.tiktok.com/embed/v2/{videoId}`
- Instagram → `https://www.instagram.com/reel/{shortcode}/embed`
- YouTube and anything unrecognised → no toggle; the card's existing "Watch the original ↗" stands.

Plain `<iframe>`, so **no third-party JavaScript is loaded** (TikTok's blockquote embed requires
their script; the iframe form does not). The iframe **mounts only after the click** — three remix
cards in a thread must not open three players, and nothing should reach TikTok or Instagram until
the creator asks for it.

**Platform is derived from the source URL**, never from the request flag. `source_video_id` on the
row already holds the real post URL, so the hardcoded `PLATFORM = "tiktok"` (a real defect, see §8)
cannot mislead this surface.

⚠️ **No CSP is set anywhere** (`next.config.ts`, `vercel.json`, middleware — all checked). The
iframes are not policy-blocked today. If a CSP is ever added, `frame-src` must allow
`www.tiktok.com` and `www.instagram.com` or the embed dies silently.

---

## 3. The constraint that shapes it

**There is no copy of the source video to play.** `remix-runner.ts` calls
`resolveAndRehost(url, requestId)` with no owner `userId`, so the run takes the orphan-drop path and
`cleanup()` deletes the temp mp4 unconditionally in its `finally` (`remix-runner.ts:529`, T-03-02);
`video_storage_path` is never set for a scraped source. Retaining it is phase 4's policy reversal,
which this design routes around rather than reopening.

Therefore: the embed serves **TikTok's / Instagram's own bytes**, and the scrub is **stills**, which
are already extracted, already persisted, already served.

---

## 4. Architecture

### 4.1 Extraction — one pass, two sets

`src/lib/remix/beat-frames.ts` gains a single-pass extractor and keeps its public contract
(never throws; returns a count; a sheet with no frames is exactly the phase-1 sheet).

1. One `ffmpeg -i <signedUrl> -vf fps=<n/duration> …` into a temp dir. One connection, one
   sequential read.
2. **Beat frames** — for each beat, pick the temp frame nearest `sampleAt(beat)`; upload to
   `{blueprintId}/{beat.index}.jpg`.
3. **Scrub frames** — pick `SCRUB_FRAMES` evenly spaced temp frames; upload to
   `{blueprintId}/scrub/{i}.jpg`.
4. Delete the temp dir in a `finally`.

The pass runs at a fixed sampling rate dense enough that the nearest-frame error stays inside
`sampleAt()`'s tolerance. `sampleAt()` samples a quarter into a beat capped at 400ms **because a
beat boundary is a cut** and the frame on it is often a dissolve or a black frame; a grid coarser
than that tolerance would silently trade away a deliberate, documented behaviour. This is the
reason the design does not take the handoff's option 1 (one time-indexed set, beats pick nearest).

`EXTRACT_BUDGET_MS = 45_000` stays. The whole pass measured ~6s, so the budget stops being the
binding constraint — but it remains the guard that keeps a hung ffmpeg from holding the temp mp4
open past `cleanup()`, which is the one way this feature could damage the invariant it lives inside.

### 4.2 Storage — why beat frames do not move

**Beat frames keep their existing path** `{blueprintId}/{index}.jpg`. Moving them to
`{id}/beat/{i}` (the handoff's option 2 as written) would strand every frame already written under
the flat path and make the change non-backward-compatible for no gain.

`signAnalysisFrames(id)` lists the prefix and filters `f.name.endsWith(".jpg")`. A Supabase
`list()` returns a subfolder as a pseudo-entry named `scrub` — no `.jpg` suffix — so the scrub set
is **invisible** to the existing reader and the keyspace collision the handoff flagged cannot
happen. This is load-bearing and is **pinned by a regression test** (§6), not left to reasoning.

A sibling `signScrubFrames(id)` lists `{id}/scrub` and returns its own `Record<number, string>`.

### 4.3 API

`GET /api/remix/blueprint/[id]` returns two new fields alongside the existing three:

```
{ script, blueprint, frames,          // unchanged
  scrubFrames: Record<number,string>, // NEW — {} on any storage fault
  sourceUrl: string | null }          // NEW — row.source_video_id, already in BLUEPRINT_COLUMNS
```

`sourceUrl` needs **no schema change**: `source_video_id` is already selected by
`BLUEPRINT_COLUMNS` and already holds `sourcePostUrl ?? url` (`remix-runner.ts:516`). Ownership is
already settled above the read (`getBlueprint` matches id AND user_id), so returning it does not
widen anything — it is a public post URL, returned to the row's owner.

`scrubFrames` degrades to `{}` on any storage fault, exactly as `frames` does. A frame list is an
enhancement and is never worth a 500.

`blueprint.duration_s` already crosses the wire, so the playhead needs no new duration field.

### 4.4 Components

| File | Role |
|---|---|
| `src/components/thread/remix-source-viewer.tsx` (new) | Stage + strip + playhead. Owns `pct` state. Props: `scrubFrames`, `beats`, `durationS`, `activeBeatIndex`, `onSeek`. |
| `src/components/thread/remix-source-embed.tsx` (new) | Toggle + lazily-mounted iframe. Props: `sourceUrl`. Renders nothing for an unrecognised platform. |
| `src/lib/remix/source-platform.ts` (new) | `parseSourceUrl(url) → {platform, embedUrl} | null`. Pure, unit-tested. |
| `src/components/thread/remix-beats.tsx` (edit) | Hoists playhead state, mounts the two new components, lights the active row, makes rows clickable. |

`remix-beats.tsx` owns the playhead because the lit row lives there; the viewer is controlled. That
keeps the viewer free of beat semantics and the row list free of scrub mechanics — each is
understandable and testable without the other.

**`proof-unit.tsx` is shared and must not be edited** — it is not involved here, noted only because
this card renders near it.

---

## 5. Degradation

Every one of these is a normal outcome, not an error state, and none of them may render a broken
box:

| Condition | Behaviour |
|---|---|
| No scrub frames (every pre-existing row) | No viewer. The sheet is exactly today's sheet. |
| Partial scrub frames | Viewer renders; missing cells are empty tone, never broken images. |
| `sourceUrl` null, or YouTube, or unparseable | No embed toggle. "Watch the original ↗" on the card stands. |
| `from_fixed_buckets === true` | Unchanged — the existing "couldn't read the timing" branch, no viewer, no beats. |
| Blueprint fetch fails | Unchanged — renders nothing, silently. |
| Embed iframe blocked/refused | The panel keeps its "Open on TikTok ↗" link, so there is always an exit. |

---

## 6. Testing

Real behaviour, not mocks of the unit under test:

- `source-platform.test.ts` — real TikTok/Instagram/YouTube URL shapes, including `/reel/`, `/p/`,
  `vm.tiktok.com` shortlinks, query strings, and garbage. Pure function, no mocks.
- **Collision regression test** — write a JPEG at `{id}/scrub/0.jpg` and assert
  `signAnalysisFrames(id)` does not return it. This is the trap the handoff named; it gets a test,
  not a comment.
- `remix-source-viewer.test.tsx` — playhead → active cell, playhead → active beat index, row click
  → seek, keyboard seek. Real component, real DOM.
- `remix-beats.test.tsx` — extend: viewer absent with no scrub frames; rows still render.
- Frame-picker unit test — nearest-frame selection stays within `sampleAt()`'s tolerance.

**Mock `fetch` by URL, never by call order** — tiles GET `/api/saved` on mount and shift every index.

**A guard is bounded by its reader.** The collision test above asserts the *reader's* behaviour
(`signAnalysisFrames`), not the writer's path string, because the writer's path is exactly what a
future edit would change.

---

## 7. Verification

Deploy is OFF and owner-confirmed. Nothing here may have "watch it in production" as a success
criterion. Everything is verifiable by probe, by test, or by a browser against local dev.

1. **Free extraction probe.** Fix `scripts/probe-beat-frames.ts` to load `.env.local`, extend it to
   cover the scrub set, and re-run against `omni-split/59455-447571480576291.mp4`. It sha1s every
   frame and fails unless all are distinct — the failure it exists to catch is ffmpeg exiting 0
   while ignoring the seek, which is exactly how a broken scrub would look correct.
2. **Seeded row for the browser walk.** The single prod blueprint is `from_fixed_buckets` and
   renders no beats, so there is nothing real to look at. Seed one blueprint row with real beats
   plus real frames for the e2e user, extracted from the mp4 already in storage. Free — no Apify,
   no DashScope. ⚠️ **This writes to the shared prod database** (dev and prod are one Supabase
   project) and needs owner consent before it runs; it is a single row, deletable by id.
3. **Signed-in browser walk**, native context per viewport at 390px and 1440px. Screenshot the
   viewer, scrub it, confirm the lit row tracks. `page.route()` the paid endpoints — the e2e user
   is a REAL PROD ACCOUNT and remix/discover bill.
4. `tsc` + `npm run build` + the suite at `--maxWorkers=3`, before the push, not after.

Reminders that have cost this repo time: resizing a loaded page is not the mobile UI; a projected
wrap count is not a measurement; `scrollWidth === clientWidth` is not proof of no overflow; believe
the screenshot.

---

## 8. Out of scope, and honestly owed

- 🔴 **`PLATFORM = "tiktok"` is hardcoded** in `use-remix-launch.ts` while 63% of the corpus is
  Instagram. It does not reach resolution, so it does not break remixing and it does not affect
  this lane — but it does feed `buildAudienceGroundingLine`, so every Instagram remix is grounded
  as if it were TikTok. Real defect, separate lane.
- **The `filmstrips` bucket has never been reaped.** Currently 48 objects across 7 prefixes, so it
  is small; this lane makes each run ~4× bigger. Not urgent (deploy off, no real users), still
  owed. ⚠️ The 8 unscheduled cron routes are **deliberate** cost control, not rot.
- `beat.weakness` is stored and rendered to nobody. The stage is its natural home; flagged to the
  owner and deliberately not taken.
- The hero repeats as beat 0 — **left on purpose**, a generation problem; hiding it in the renderer
  would mask real model behaviour.
- Three cards → three fetches of the same row (`remix-beats.tsx:79`).
- A script entry whose `index` matches no beat is dropped silently.
- Phase 5 (`revise_remix`) — not started.
