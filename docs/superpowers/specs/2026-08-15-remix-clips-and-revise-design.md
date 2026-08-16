# Design — remix phase 4 (clips) + phase 5 (`revise_remix`) · 2026-08-15

Follows `docs/HANDOFF-2026-08-14-remix-live-proof-and-phases-4-5.md` (merged as **#521**). That
handoff is the plan this document replaces; where the two disagree, this one is later and measured.

**Status when written:** `main` = `a6b6d163`. Phases 1–3 shipped and proved live on 2026-08-14
(`wSJ6hI2HHI0P`, the first `from_fixed_buckets: false` row in existence). Phases 4 and 5 not started.

**Revised 2026-08-16** after review + the Gate 0 measurement (§2.1): the remote clip pass was
measured against a real signed URL and won, so `keepLocalCopy` — and every section that existed to
contain it — is gone; `resolveAndRehost` is no longer touched at all. The ffmpeg argv is corrected
(output options are positional, §2.3), the reaper is restructured so it actually runs (§5), the
clip write path is specified end-to-end including the failure cleanups (§2.4, §2.7), and phase 5
gains its two prerequisite channels (§6.7).

---

## 1. The rulings this builds to

Phase 4 exists because of one owner ruling, reaffirmed twice on 2026-08-14:

> **Ruled: clips are worth it.** Mitigations kept: **≤4s, muted, source mp4 still deleted, clips die
> with the thread, ≤8 per source.**

Five owner decisions taken 2026-08-15 turn that into something buildable:

| # | Question | Ruling |
|---|---|---|
| D1 | What "die with the thread" means | **Per-run clips + a TTL reaper.** Not thread-scoped deletion, not source-video dedupe. |
| D2 | TTL and where it runs | **7 days, folded into `/api/cron/delete-retained-videos`** (already daily at 03:00). No new Vercel cron slot. |
| D3 | Where clips appear | **The scrub stage plays them.** No new surface on a 3005px card. |
| D4 | What a revision may change | **Targeted beats only** — as §5.7 of the 2026-08-10 spec already said. |
| D5 | Trigger + billing | **A free chat tool, model-dispatched.** Never reaches the billing gate. |

### 1.1 Why D1 was necessary — the mitigation had no event to hang on

"Clips die with the thread" cannot be implemented literally, for two reasons found by reading:

1. **`DELETE /api/threads/[id]` is an archive, not a delete** (`type` `open` → `archived`, messages
   preserved, reversible). No hard thread delete exists anywhere in the product.
2. **`remix_blueprints.thread_id` is `ON DELETE SET NULL` by explicit design.** The migration says
   so in place: *"SET NULL, never CASCADE: deleting a thread must not destroy the only record of a
   source video we can no longer re-fetch."*

So there is no deletion event, and the one FK that could have carried one was deliberately built not
to. A TTL is a mechanism that actually exists, can be tested without a model or a browser, and gives
the mitigation teeth. **7 days is the mitigation** — the retained-fragment window, not a cache policy.

### 1.2 Why D1 also rejected the migration's own phase-4 note

`source_video_id` carries this comment:

> *The clip dedupe key (phase 4). /feed serves the same ~520 curated rows to every user, so clips
> must be keyed by SOURCE VIDEO, not by remix run, or storage grows with runs instead of with the
> corpus.*

That is cheaper and it directly contradicts the ruling: a clip set shared across users and runs
cannot die with anything, and it accumulates into a small permanent library of third-party video
fragments — the exact object the mitigation exists to prevent. **Clips are keyed per run.** The
comment stays on the column as the record of a rejected alternative; `source_video_id` keeps its
other job (the source post URL the viewer derives its embed platform from).
`remix_blueprints_source_video_idx` was built for the same rejected dedupe and is now
load-bearing for nothing — recorded here so its existence is not read later as evidence of the
design it served; a future migration may drop it.

### 1.3 Two phases, two implementation plans

This document specifies both because the owner asked for both and they share a row, a repo module
and a test suite. They do **not** share a code path: phase 4 is an extraction pipeline plus a
reaper, phase 5 is a chat tool plus a write. **They get separate implementation plans and phase 4
lands first** — it is the one with the ruling attached, and its `clip_uris` write is the only thing
phase 5 could conflict with.

---

## 2. Phase 4 — where the bytes come from

### 2.1 The measured facts that decide it — Gate 0

Two measurements, one conclusion:

1. **The frames pass already streams the whole video over the signed URL.** 115 frames in 5.5s
   against a real rehosted mp4 (`extract-grid.ts`, measured 2026-08-14). The cost of one
   sequential read of a remote video is the connection, not the work done per frame.
2. **Gate 0 (2026-08-16): the full 8-clip re-encode pass, run against a real
   `videos/remix-temp` signed URL on this project.** 7.2s cold, 9.7s on a second run, against
   6.0s for the identical job from local disk — a 30s 1080×1920 source at a TikTok-shaped
   2.5 Mbps (9.9 MB). All 8 outputs correct: one stream, no audio, 360×640, exact durations.
   The network premium is the ~10 MB sequential download and nothing else.

So the clip pass reads **the same signed URL the frames pass already reads**, inside the same
window — alive until `cleanup()` fires in the runner's `finally`. `resolveAndRehost` is not
edited, not parameterised, not touched. Phase 4 adds zero lines to the derive-and-drop module.

An earlier draft of this spec had the opposite design — a `keepLocalCopy` option on
`resolveAndRehost`, writing the already-downloaded bytes (`resolve-and-rehost.ts:95`) to a temp
file — justified by a frame-accuracy argument that does not survive contact with §2.2: keyframe
snapping is a property of *stream-copying* (`-c copy`), not of *remote reads*. A re-encode is
frame-accurate wherever the input lives.

### 2.2 Rejected alternatives, recorded so they are not re-derived

**`keepLocalCopy` on `resolveAndRehost`.** The bytes are in process memory at
`resolve-and-rehost.ts:95`, so keeping them looks free. Measured (Gate 0), it buys back 1–4s on a
7–10s job — and its price was editing the one module this lane must not destabilise, a second
leakable artefact (the temp file), a cleanup extension, a tripwire section, and the largest entry
in §10. The premium does not pay for any of that.

**One remote pass with the `segment` muxer** (`-f segment -segment_times … -c copy`). Rejected
because `-c copy` cuts **only on keyframes**: on a typical TikTok GOP a clip can start up to ~2s
early, showing the tail of the previous shot — precisely the failure `sampleAt` was written to
avoid. Fixing it means re-encoding, which is §2.3.

**Eight remote seeking ffmpegs.** The obvious implementation and the measured anti-pattern: 4
remote seeks cost 15.6s against a real signed mp4, so 8 would blow the budget inside the window
that must close before `cleanup()`. See `[[ffmpeg-per-frame-seeks-are-the-cost]]`.

### 2.3 The trim — one invocation, N outputs, the option block repeated PER OUTPUT

New module `src/lib/remix/beat-clips.ts`, a sibling of `beat-frames.ts` and shaped like it.

⚠️ **ffmpeg output options are positional: each applies only to the NEXT output file.** Written
once at the front — as the earlier draft had it — `-an`/`-crf`/`-vf` bind to output 0 alone.
Measured 2026-08-16: clip 0 came out 360×640 and silent; clip 1 came out **1080×1920 with the
audio track intact**. Seven of eight clips would ship full-size with sound, and a substring test
on the argv stays green throughout. The option block is therefore repeated before every output,
and §7 pins that with a per-output count assertion, never a substring check.

```
ffmpeg -i <signedUrl>
  -an -c:v libx264 -preset veryfast -crf 28 -vf scale=-2:640 -ss <t_0> -t <dur_0> <dir>/0.mp4
  -an -c:v libx264 -preset veryfast -crf 28 -vf scale=-2:640 -ss <t_1> -t <dur_1> <dir>/1.mp4
  …
```

- **One input, one sequential decode, N outputs** — each output's `-ss/-t` keeps only its window.
- `-ss` as an **output** option on a re-encode is frame-accurate, so a clip starts on its beat
  and not on the keyframe up to ~2s before it.
- `-an` **strips the audio track from the file**. This is a stronger mitigation than a muted
  `<video>` attribute, which a viewer can defeat; the delivered bytes contain no audio at all.
- `dur = min(4, beat.duration_s)` — the ≤4s ruling, and a shorter beat keeps its natural length.
  The UI treats this as a *prediction* and re-clamps to the element's own `loadedmetadata`
  duration (§4.2).
- `MAX_BEAT_CLIPS = 8`, matching `MAX_BEAT_FRAMES`. `buildBlueprint` already merges to
  `MAX_BEATS = 8`, so this is a backstop rather than a limit that bites.
- `scale=-2:640` → ~360×640 from a 1080×1920 source. The stage is ~96–112 CSS px, so 640 is past
  3× retina. Gate 0's synthetic clips averaged ~115 KB; real footage at crf 28 runs higher.
  **150–300 KB/clip (~2 MB/run) is an estimate the live run checks (§8), not a measurement.**
- `CLIP_BUDGET_MS = 40_000`, aligned with the grid pass's `PASS_TIMEOUT_MS`, and the module
  **never throws** — a sheet with no clips is exactly today's sheet, which is a complete product.
- Depends on the storage host honouring Range requests — Supabase does, and `extract-grid`
  already relies on it. (A non-faststart mp4 over a Range-less host fails loudly with "Cannot
  determine format"; measured, and not this host.)

### 2.4 Cut inside the window, upload only on success

`cutBeatClips(signedUrl, beats, durationS)` writes its outputs to a `mkdtemp` dir — exactly as
the grid pass does — and resolves to `{ files, dispose }`, where each file carries **its beat's
OWN index** (`beats` can be non-contiguous; same rule as frames). The **upload is a separate
step**, and it runs only when the run is about to return a blueprint:

- **Cut** starts right after `buildBlueprint` (next to `framesPromise`, not awaited) and streams
  the signed URL during the ~50s adapt call — the same overlap the frames pass uses.
- **Upload** (`uploadBeatClips(blueprintId, files)` → the landed storage paths) runs immediately
  before the `return`, and **only when `hasBeats && blocks.length > 0`** — the exact predicate
  the route's row write uses. An `adapt_failed` run therefore leaves the `clips` bucket
  untouched: nothing is ever uploaded that no row will list, so §5's row-driven reaper worklist
  covers every object the bucket holds. On the failure paths the local temp files are simply
  `dispose()`d.
- The await that collects the cut results sits **inside the `try`, immediately before the
  `return`** — by then the adapt call has already paid the wall-clock, so it costs ~0ms, and the
  landed paths ride `result.blueprint.clipPaths` into the route. (The earlier draft awaited only
  in the `finally`, which runs *after* the return value is assembled — a write nothing could
  implement.)

### 2.5 Where it runs in the pipeline — the frames pattern, with the join moved forward

```ts
// after buildBlueprint — started, not awaited (same fixed-buckets gate as frames):
cutPromise =
  hasBeats && blueprint.from_fixed_buckets !== true
    ? cutBeatClips(signedUrl, blueprint.beats, blueprint.duration_s)
    : null;

// immediately before the return — adapt has already paid for this:
const cut = cutPromise ? await cutPromise : null;
const clipPaths =
  cut && hasBeats && blocks.length > 0 ? await uploadBeatClips(blueprintId, cut.files) : [];

// the finally — order matters, and cleanup() stays last and unconditional (T-03-02):
if (framesPromise) await framesPromise.catch(() => {});
if (cutPromise) {
  const c = await cutPromise.catch(() => null);
  await c?.dispose();               // rm of the temp dir — never throws, idempotent
}
await cleanup();                    // T-03-02 — unchanged
```

Both jobs run inside the ~50s the adapt call already costs the creator, and neither can outlive
the run. They run **in parallel**, streaming the same signed URL — they share download bandwidth
rather than contending for different resources (the earlier draft's CPU-vs-network framing died
with the local copy). Measured: a ~5.5s job and a ~7–10s job inside a ~50s window.

### 2.6 Storage — a new `clips` bucket

Private bucket `clips`, path `<blueprintId>/<beatIndex>.mp4`.

Not `filmstrips`. That bucket is for stills, **has never been reaped**, and mixing a second media
type with a different retention policy into it would make the reaper this lane owes ambiguous about
what it may delete. A separate bucket keeps the two retention problems separable — and this lane
solves exactly one of them.

New module `src/lib/remix/clip-storage.ts` — `uploadClip()` and `signClips(paths)`, mirroring
`uploadScrubFrame` / `signScrubFrames`. Deliberately **not** added to
`src/lib/engine/filmstrip/storage.ts`: that module's own `SCRUB_PREFIX` comment records what
happened last time a shared writer was widened to serve a second keyspace.

One deviation from `signScrubFrames`, which lists a bucket prefix and then signs what it finds:
`signClips` takes **the paths** and signs exactly those. The row already carries them (§2.7) and the
route has already read the row, so listing would be a second storage round-trip to rediscover
something in hand. The beat index still comes from the filename, as it does for the frames.

### 2.7 The row — `clip_uris` finally gets written

`remix_blueprints.clip_uris` (`jsonb NOT NULL DEFAULT '[]'`) already exists and is read by nothing.
Phase 4 writes it as **an array of storage paths**, never signed URLs — a signed URL in a durable
column is both a dead link on day 31 and a live credential in a shared row.

The paths are self-describing (`<blueprintId>/<beatIndex>.mp4`), so the column needs no shape beyond
`string[]`. Its jobs:

- the reaper's **worklist** — which rows still own objects, and which paths to remove;
- the reaper's **idempotency marker** — emptied after a successful delete, exactly as
  `delete-retained-videos` nulls `video_storage_path`.

`BLUEPRINT_COLUMNS` gains `clip_uris`, and its comment — which currently explains why the column is
*not* read — is rewritten rather than left to lie.

**The ROUTE writes the column:** `insertBlueprint` gains `clip_uris: result.blueprint.clipPaths`
(§2.4 put the paths in hand before the runner returned). When the row write throws — the existing
non-fatal catch — the route also best-effort-removes the just-uploaded clips, because an object no
row lists sits outside the reaper's worklist forever (§5 sweeps rows, not the bucket). The
residual window — process death between upload and insert — is accepted and named in §10.

### 2.8 The route

`GET /api/remix/blueprint/[id]` returns `clips: Record<number, string>` alongside `frames` and
`scrubFrames`, signed fresh on every read by `signClips(row.clip_uris)` and added to the existing
`Promise.all`. Signed URLs are never persisted, exactly as for the two frame sets — a card rendered
after the TTL would otherwise carry a dead `<video>`, and a card shared in a thread would carry a
live credential.

Degrades to `{}` on any storage fault, like the other two — a missing clip drops the stage back to
its still and nothing else changes. A pre-lane row has `clip_uris: []` and gets `{}` for free.

Ownership is already settled before this line by `getBlueprint` matching `id` **and** `user_id`.

---

## 3. What phase 4 does NOT move

**`resolveAndRehost` — at all.** The clip pass reads the signed URL the way the frames pass does
(§2.1), so the derive-and-drop module gains no parameter, no temp file, no new caller shape. The
earlier draft's `keepLocalCopy` needed this section to argue the analyze path stayed
byte-identical; now it is byte-identical because nothing in its import graph changes.

**The three test files the handoff said would need rewriting therefore stay green unmodified,
trivially.** They are `analyze/__tests__/derive-and-drop.test.ts`,
`analyze/__tests__/decode-route.test.ts` (C4), and `engine/__tests__/tiktok-url-branch.test.ts`,
and what they actually assert is that the **analyze** route's `tiktok_url` branch removes the
`remix-temp` **Supabase object** (`expect(paths[0]).toContain("remix-temp")`, "exactly one remove
call") and never sets `video_storage_path` — none of which phase 4's blast radius ever reaches:
clips are cut in `remix-runner.ts` only, land in a different bucket, and the source mp4 is still
deleted unconditionally in the same `finally`. The handoff's contrary claim was written assuming
clips would retain the **source video**; they retain ≤8 derived fragments in a different bucket
under a 7-day clock, which is a different claim.

A note for anyone reusing them as tripwires: only **two** of the three exercise the real module —
`decode-route.test.ts` mocks `@/lib/engine/remix/resolve-and-rehost` wholesale
(`decode-route.test.ts:99`) and cannot detect any change inside it. "All three stay green" was
never, by itself, proof that the module was safe.

**Also not moving:** the frames path — phase 3 is proved working and this lane does not touch it.
(The earlier draft's follow-up note about frames reading the local copy dies with `keepLocalCopy`:
there is no local copy.)

---

## 4. Phase 4 — the UI

### 4.1 The premise that changes

`remix-source-viewer.tsx` says in its own header why the stage is a flipbook over stills:

> *A scraped remix source is dropped by `cleanup()` before the run ends, so there is nothing to play;
> the "play" here is a flipbook over stills, and the sound lives in the embed below.*

Clips retire that compromise for the ≤8 windows they cover — and only those.

### 4.2 One playhead, one clock, the best source available at each moment

The design rule: **clips are a higher-fidelity source for the parts of the timeline they cover, not
a second playback mode.**

- The rAF clock stays the single source of truth for `pct`, exactly as today.
- At any playhead time `t`, if `t` falls inside a covered window
  (`beat.t_start ≤ t < beat.t_start + clipDuration`) **and** that beat has a clip, the stage renders
  a `<video>` seeked to `t - beat.t_start`. Otherwise it renders the nearest still, as today.
- Pressing Play therefore walks the whole video in real time, rendering motion where there is motion
  and stills where there is not. Nothing is skipped and no gap is papered over — which matters,
  because ≤8 four-second windows are **not** the video, and presenting them as continuous playback
  would misstate the source.
- **One** `<video>` element whose `src` swaps as the active clip changes — not eight. `preload
  ="metadata"`, `muted`, `playsInline`, no controls.
- **The still never leaves.** It stays mounted beneath; the `<video>` becomes visible only once
  `loadeddata` has fired for the current clip. Entering a covered window can therefore never
  flash black or paint a half-loaded frame — the worst case is the still for a few more frames,
  which is exactly the degraded state anyway.
- **Src swaps happen in the gaps.** While the playhead crosses an uncovered stretch, the element
  is already pointed at the NEXT covered beat's clip, so the load cost lands where a still is
  showing anyway. At ~150–300 KB a clip this hides essentially all of it.
- **Scrubbing inside a covered window seeks the paused video** — the exact frame at `t`, strictly
  better than the nearest grid still the flipbook would show. A fully-buffered ≤4s clip makes
  these seeks cheap.
- `clipDuration` starts as §2.3's prediction (`min(4, beat.duration_s)`) and is replaced by the
  element's own duration on `loadedmetadata` — a clip the budget truncated must shrink its
  covered window rather than freeze on its last frame.
- The clock leads; the video follows. Re-seek only when drift exceeds ~0.15s. A muted ≤4s clip
  cannot accumulate meaningful drift, and letting the video drive `pct` would put two clocks in a
  surface built around having one.
- Clicking a beat row already seeks the stage, so it now means "play this beat" for free.
- Playback never starts on mount — only from the creator's Play or a row click, as today.

**Degradation is the pre-lane behaviour, unchanged:** no clips ⇒ every window is uncovered ⇒ the
flipbook, byte-identical. Every sheet written before this lane is in that state.

**No accent.** The dosage rule is LOCKED and the card already spends its one on the Borrowed chip.

---

## 5. Phase 4 — retention

Folded into `GET /api/cron/delete-retained-videos` (daily 03:00, `verifyCronAuth`, service
client) — **as a second independent sweep, not a block appended to the existing body.** The
existing handler returns early when the video sweep has nothing to delete (`paths.length === 0`,
route.ts:58 — the **normal** night) and returns 500 when its storage delete fails; a block placed
after it would be dead code most nights and skipped the rest. Found in review; the restructure is
the fix:

1. the existing body becomes `sweepRetainedVideos()` — behaviour byte-identical;
2. `sweepExpiredClips()`: select `id, clip_uris` from `remix_blueprints` where
   `created_at < now() - CLIP_TTL_DAYS`; keep rows whose `clip_uris` is a non-empty array; flatten
   to paths; `storage.from("clips").remove(paths)` in a batch; `update({ clip_uris: [] })` for
   those ids;
3. the route runs **both, each in its own try/catch** — a failure in one never skips the other —
   and reports `{ videos: …, clips: … }`; 500 only when a sweep failed outright, and both were
   still attempted regardless.

The clip sweep keeps the existing body's idempotency shape: a storage delete that succeeds
followed by a column update that fails logs at ERROR and still counts as swept, because the next
run re-sweeps rows that still carry paths. Idempotent by construction. And because §2.4 uploads
only when the row write is imminent — and §2.7 removes the clips when that write throws — every
object in the bucket is on some row's `clip_uris`: the row sweep IS a bucket sweep.

`CLIP_TTL_DAYS = 7`, exported, and asserted by a test — a TTL that lives only as a literal in a
query is a mitigation nobody can find.

**Scale caveat, stated rather than hidden:** step 2 filters in JS instead of in PostgREST, because
jsonb emptiness predicates over the wire are fragile. The table holds single-digit rows today; if it
reaches thousands this needs a partial index or a generated `has_clips` boolean. Not now.

**Out of scope, still owed:** nothing reaps `filmstrips` or the `remix_blueprints` rows themselves.
This lane adds the first retention mechanism this feature has ever had and covers clips only.

🔴 **Deploy is OFF, owner-confirmed — Vercel crons do not run.** The reaper is verified by invoking
the route locally with `CRON_SECRET`, against seeded rows. "It will run in production" is not
available as evidence and is not claimed.

---

## 6. Phase 5 — `revise_remix`

### 6.1 What it is

The 2026-08-10 spec §5.7 already specified it and this design keeps that shape:

> New chat-agent tool alongside `request_input` / `search_corpus`. Loads the `remix_blueprints` row
> by `blueprintId`, rewrites the targeted beat(s), writes `script` back. One LLM call. Never
> re-resolves, re-Omnis or re-scrapes — the source mp4 is gone by then, and that is the point.

Flow step 6, from the same document: *"beat 3 is too soft" → rewrites that beat from the stored
blueprint · no re-run.*

### 6.2 Registration and cost

A **free** tool bound in `chat-agent-loop.ts` beside `request_input` / `search_corpus`. It never
reaches the billing gate, fires no `onDispatch`, and cannot raise a credit wall.

The reasoning is D5's: the **run** is the billed unit, and a ~200-token rewrite of one beat on a
sheet already paid for costs a fraction of it. `BILLING_ENFORCE_QUOTA` is `true` in prod with the
free tier at `limit: 0`, so a billed revision would mean free-tier creators can never fix a beat on
a sheet they were given.

### 6.3 Arguments

```
blueprintId : string        the row
variant     : integer       WHICH ranked card is asking
beats       : integer[]     which beat indexes to rewrite
note        : string        the creator's own words — "beat 3 is too soft"
```

`variant` is not optional and does not default to 0. **One row serves ALL of a run's ranked cards**
(one source video, one skeleton, N adapted scripts). A revision that guessed the variant would
silently rewrite a different card's sheet — which reads as a sheet, not as a bug.

### 6.4 The call

Load via `getBlueprint(service, id, user.id)` — the existing ownership-scoped read, reused, so the
tool cannot reach another user's row. Then **one** LLM call whose input is:

- `blueprint.beats[i]` for each targeted index — the source's timed skeleton, which is the only
  surviving record of what the source did second by second;
- `script[variant][i]` — the line being replaced;
- `note` — the creator's complaint.

Output is validated `AdaptedBeat[]` for the targeted indexes only, with `index` preserved.
No resolve, no Omni, no adapt, no re-rank.

**Input fencing, not output filtering.** `echo-guard.ts` is imported by nothing at runtime — it is
a measurement used in tests, and `adapt.ts` only mentions it in a comment. The verbatim-echo defect
was fixed at the input (#482, 43%→0%, by fencing the voice role), so the revision prompt uses the
same fencing as the adapt prompt rather than inventing an output guard that has never worked here.

### 6.5 The write — variant isolation by construction

`script` is `AdaptedBeat[][]`. A read-modify-write of the whole array is one concurrent revision
away from clobbering a sibling variant. Instead, a small hand-applied RPC:

```sql
remix_blueprint_set_variant_script(p_id text, p_user_id uuid, p_variant int, p_script jsonb)
-- jsonb_set(script, ARRAY[p_variant::text], p_script), WHERE id = p_id AND user_id = p_user_id
```

`jsonb_set` on a single array element makes "rewrites the other two cards" impossible rather than
merely guarded against, and this codebase already uses an atomic RPC deep-merge for
`persistDecodeToVariants`. `blueprint-repo.ts` gains `updateVariantScript()` and stays the only
module that touches the table.

The row is the single source of truth — which is exactly why the block comment refused to inline
the script in the first place, and why a revision needs no message mutation. But it does need a
cache invalidation, and the earlier draft was wrong to claim otherwise: `RemixBeats` fetches the
row **once per mount** (`remix-beats.tsx`, and its `initialData` branch never touches the network
at all), so a revision written in a later chat turn is invisible to the already-rendered card
until a full reload. §6.7's refresh channel is what closes that.

### 6.6 What a revision may not touch

`adaptedHook`, `angle`, `whoItsFor` and `formatBorrowed` live on the **block**, frozen inside a
persisted thread message. Only `blueprint` and `script` live in the row. So a revision **cannot**
change the hook without a message-mutation path that does not exist.

Per D4 this is accepted, not worked around: the tool rewrites beats and is described to the model as
doing exactly that, so it does not accept a hook revision it would silently drop. Moving
hook/angle/whoItsFor into the row is a separate lane if the owner ever wants hook revision.

### 6.7 Two channels phase 5 must build FIRST — found in review, absent from the flow above

**The address channel (in).** `revise_remix` requires `blueprintId` + `variant`, and §6.3 is right
that `variant` must never default — but as specified above the model can never supply either. A
remix card reaches it only as prose: `on-screen.ts:169` renders
`Remix — adapted hook: "…"; Strong (7/10 stop)` with no address on the live path, and
`replayPriorTurn` replays the same prose a turn later — which is when "beat 3 is too soft"
actually arrives. A guessed variant silently rewrites a sibling card's sheet, and that failure
renders as a sheet, not as a bug. Fix shape: a structured `remix_sheets:
[{ blueprintId, variant, hook }]` field on the tool-result JSON in BOTH paths (live and replay) —
a data field, never part of the prose lines, so it cannot be echoed into chat and is not subject
to the artefact redaction. The exact wiring is the **first task** of the phase 5 plan.

**The refresh channel (out).** §6.5's write lands in the row; the read happens once per mount. The
revise turn must therefore end in a client-visible invalidation keyed on `blueprintId` — the turn
carrying the tool result bumps the thread state, and `RemixBeats` refetches, *including through
the `initialData` branch*, which must not shadow a payload it now knows is stale. **Second task**
of the plan, ahead of the LLM call itself: a revision nobody sees didn't happen.

---

## 7. Testing

Real behaviour, not mocks of the unit under test. ffmpeg and Supabase Storage are I/O boundaries and
may be faked; the trimming maths, the reaper's selection, the stage's source choice and the variant
write are not.

**Phase 4**
- `beat-clips.test.ts` — the argv: exactly one `-i`; **the full option block
  (`-an -c:v -crf -vf`) present once PER OUTPUT — a count equality
  (`argv.filter(a => a === "-an").length === outputs`), never a substring check, which §2.3's
  measured failure passes**; one `-ss/-t` pair per output; `dur = min(4, duration_s)`; ≤8 clips;
  never throws when ffmpeg fails; budget honoured; the temp dir disposed on every path.
- Upload — **only on the success path**: an `adapt_failed` run leaves the bucket untouched (§2.4's
  worklist-coverage guarantee); path shape `<blueprintId>/<beatIndex>.mp4` with the beat's OWN
  index; a partial landing returns exactly what landed.
- Runner — `clipPaths` rides `result.blueprint`; the cut overlaps the adapt call; `dispose()` and
  `cleanup()` both run on the error paths.
- `clip-storage.test.ts` — `signClips` signs the given paths (no listing); `{}` on a storage fault.
- Route test — `clips` present, `{}` on fault, absent-safe for pre-lane rows; on `insertBlueprint`
  failure the just-uploaded clips are removed (§2.7).
- `remix-source-viewer.test.tsx` — inside a covered window the stage mounts a `<video>` with the
  clip's src, `muted`, no `controls`; outside one it mounts the still; the covered window shrinks
  to the element's `loadedmetadata` duration; **no clips ⇒ output identical to today**.
- Reaper test — rows past `CLIP_TTL_DAYS` are swept and only those; `clip_uris` emptied; a failed
  column update still returns 200 and leaves the row re-sweepable; **the clip sweep runs when the
  video sweep found nothing, and when the video sweep failed** — the dead-code regression §5
  exists to prevent.
- The three derive-and-drop files stay green **unmodified** — now trivially, since phase 4 adds no
  line to `resolve-and-rehost.ts` (§3). Still asserted, not assumed.

**Phase 5**
- The address channel: the tool-result JSON carries `remix_sheets` with `{blueprintId, variant}`
  on BOTH the live and replay paths; the prose lines never do.
- The refresh channel: a revise turn ends in a refetch, including through the `initialData` branch.
- Rewrites only `script[variant]`; the sibling variants are byte-identical after the call.
- A revision for a beat index absent from the script is a clean no-op, not an insert.
- Ownership: another user's `blueprintId` resolves to null and the tool refuses.
- The tool is free — no gate call, no `onDispatch`, no credit wall.

**Suite hygiene:** kill the dev server first; `--maxWorkers=3`. It flakes 0–5 tests in
`scraping/resolve-video` + `engine/omni-analysis-*` — check *which file* before blaming this diff.
vitest does not typecheck: run `tsc` separately.

---

## 8. Verification

🔴 **Deploy is OFF. Nothing here may have "watch it in production" as its success criterion.**

1. `tsc` clean; the 40 remix test files green; full suite green.
2. A **live remix run** through the real UI at `localhost:3012`, signed in — `/feed` → click an
   `article` → Remix **in the teardown detail** (the tile's button is a deliberate mouse
   accelerator). **Wait ≥3 minutes**; the run takes ~2.7. Confirm ≤8 clips land in the `clips`
   bucket, `clip_uris` is written, and the route serves signed `clips`. Then pull one clip back
   OUT of the bucket and probe the bytes: **one stream, no audio, 360×640** — the delivered-bytes
   check that catches the option-positionality failure class (§2.3), which no argv assertion can.
3. **Browser measurement of the stage**, not a wire assertion: play through and confirm the `<video>`
   mounts inside a covered window and the still returns outside it. Native viewport context.
4. The reaper invoked locally with `CRON_SECRET` against a seeded row backdated past the TTL.
5. Phase 5 exercised through a real thread, verifying the sibling variants are unchanged **by
   re-reading the row**, not by reading the UI.

A single live run proves the plumbing and **nothing** about generation quality — adapt is
non-deterministic at temperature 0. Any claim about revision quality needs N samples and a rate.

---

## 9. Migrations — both applied BY HAND

`supabase db push` is unsafe in this project (migration-ledger drift). Both go through the SQL
editor, and both are `IF NOT EXISTS` / `DROP … CREATE` so a second paste is not an error:

1. the private `clips` bucket (precedent: `20260710120000_covers_bucket.sql`);
2. `remix_blueprint_set_variant_script()` (precedent: `patch_analysis_variants` — the atomic jsonb
   patch `persistDecodeToVariants` already goes through, `pipeline.ts:254`).

`getBlueprint` already throws rather than returning null on a PostgREST "no such table/function"
code, so an unapplied migration is loud instead of rendering as a feature that looks unbuilt. The
phase 5 write path must keep that property.

---

## 10. Risks

- **ffmpeg option positionality is a regression magnet.** The argv builder must repeat the option
  block per output; a future "cleanup" that hoists it to the front ships full-resolution clips
  with audio while every substring test stays green. Pinned twice: the per-output count assertion
  (§7) and the delivered-bytes probe (§8).
- **Clips uploaded, row write failed.** Upload happens only once the row write is imminent (§2.4)
  and the route removes the clips when `insertBlueprint` throws (§2.7); the residual window —
  process death between upload and insert — is accepted. Single-run objects; a bucket-wide orphan
  sweep is the general fix nothing here precludes.
- **Two readers share the window's bandwidth.** Frames and clips both stream the signed URL during
  the adapt call — measured ~5.5s and ~7–10s inside a ~50s window. Fine today; re-measure before
  growing either.
- **7 days is a policy, not a technical bound.** If the owner later wants clips to persist, the
  ruling changes first, not the constant.
- **`PLATFORM = "tiktok"` is still hardcoded** in `use-remix-launch.ts` while 63% of the corpus is
  Instagram. It does not break remixing and it is not this lane. Separate lane, still open.
- **The card is 3005px at 390px** on a real 8-beat sheet. D3 chose the stage partly to avoid making
  that worse. Card length remains an open decision.
