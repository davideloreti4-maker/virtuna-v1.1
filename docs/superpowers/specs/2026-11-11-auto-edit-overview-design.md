# Design — auto-edit: scope, split and shared model · 2026-11-11

Follows the handoff "integrate OpenFilm into Maven (full integration)" of 2026-11-11. That handoff
planned one spec. This document replaces that plan with five parts and is the map for all of them;
each part gets its own spec, plan and build. Part 1 is
`2026-11-11-edit-format-design.md`.

**Status when written:** worktree `~/virtuna-openfilm`, branch `feat/openfilm-edit` = `main` =
`0efcddd6`, nothing committed. The render path and the live preview are proved in a throwaway
spike (`.scratch/openfilm-spike/`, gitignored; results in `results/report.html`). No product code
exists yet.

---

## 1. The rulings this builds to

Owner decisions, 2026-11-11. Quotes are the owner's words.

| # | Question | Ruling |
|---|---|---|
| D1 | Engine | OpenFilm (MIT), exact pin `0.3.2`. Maven owns the edit format; OpenFilm is a backend behind a compiler. Render runs off Vercel. Nothing in Maven is named after it. (Handoff, "do not re-open".) |
| D2 | Footage input | One take per beat of the shoot sheet. ("your recommenation sounds good") |
| D3 | Filming | "a interactive filming mode in the app so you dont need the camera app and have your script". Upload stays for clips made elsewhere. |
| D4 | First user | The owner's own and the fleet's videos first, "with progress ui". |
| D5 | Infrastructure | "release it to users asap so we need to build the right infrastructure from the start". Read as: Modal for the worker, user-ready from day one. The owner has not said "Modal" himself. |
| D6 | Billing | Credits per finished video ("A"), in the existing `CREDIT_COSTS` model. |
| D7 | Timeline | "some basic timeline on the edits ... for desktop and mobile users need to make quick adjustments", opening "in the same place as the brian/simulatio sidebar next to the standard thread". |
| D8 | Scope | "we need full functionality for tiktok and instagram with everything. analyze yourself". |

D7 overrides a ruling recorded in code. `home-page-layout.tsx:118-120` says "nothing else ever
mounts this column (2026-08-09 rail ruling)". From 2026-11-11 the edit panel is the one other thing
that does.

Decisions taken under D8, mine to make and listed so they can be overturned:

| # | Decision | Why |
|---|---|---|
| M1 | "Full" means: a creator finishes a TikTok or Reel inside Maven without opening another editor, for talking-to-camera videos with b-roll, captions, text, sound and music. | It is the product's own spine: outlier → remix → shoot → edit → post. |
| M2 | The saved edit can express everything in §3 from day one. The screens ship in two releases. | No format break later; users get a complete editor for the common case first. |
| M3 | Trending and licensed music never goes into the exported file. | No licence allows a third-party editor to do it (§4). |
| M4 | First release exports one MP4 and hands it to the phone's share menu. Direct posting is release 2. | TikTok keeps unaudited apps private and at five users a day; Instagram needs app review (§4). |
| M5 | Exports in release 1: MP4, cover image, caption text. Transparent video and editing-program timelines are release 2. | They serve professional editors, not posting. |
| M6 | Five parts, built in the order of §5. | Each is testable alone and the first three already give the owner end-to-end videos. |

## 2. What is measured

All from the spike; numbers and frames are in `results/report.html`.

| Fact | Evidence | Consequence |
|---|---|---|
| `render()` from `openfilm/render` works with no CLI and no Studio. The CLI starts a background Studio server on any project it has not seen. | `scripts/render.mjs`; container run of the CLI | The worker calls the library. |
| A render makes no network connection and completes with no network interface. | Node socket hook, Chromium net-log, `--network none` | Films use local files only; the worker can run without egress. |
| linux/arm64 has no H.264, HEVC or AAC decoder in the render browser; linux/x64 gets Chrome's build. | `scripts/codec-check.mjs`; Playwright's download table. **x64 not run for real.** | The worker is x64. First task there: run the codec check. |
| Linux without a GPU: 150 to 226 s for a 30 s film at 1080×1920 on 4 CPUs; about 1.5 GB per browser; more than two browsers gains nothing. | 10 measured runs | Renders are minutes, so progress must survive a reload. A GPU worker is untested. |
| OpenFilm picks one browser by default on Linux. | `defaultWorkers` | The worker passes `workers`. |
| Film times are milliseconds; rounding a frame time up puts the cut one frame late. | 5 of 10 cuts late, then 10 of 10 after flooring | The edit format counts frames. |
| An ordinary browser can host the film: 60 frames/s playback, an edit applied in place in 11 to 33 ms, in Chrome 157 and WebKit 26.5, desktop and phone-size. | `scripts/preview-check.mjs`. **No real iPhone yet.** | The timeline previews live; the server renders only the final file. The compiler must also run in the browser. |
| OpenFilm's own editor is desktop-only: no touch gestures, no small-screen layout. | Source read at tag `v0.3.2` | The timeline UI is ours. Its pure modules (`film-doc.mjs`, `ops.mjs`) and its player approach are reusable under MIT. |
| The remix source video is deleted at the end of every run. | `resolve-and-rehost.ts` | Reference analysis runs inside the remix run. |
| Maven has no job table and no reconnecting progress for tool runs; `sweep-orphan-videos` deletes any `videos` object older than 24 h that no analysis references. | Code map | Part 2 adds a job table, a durable progress read and its own bucket. |

## 3. What the editor does

**Release 1, the first version users get.**

- Clips: trim, split, delete, reorder, replace or re-film a part, speed, volume, mute.
- Framing: zoom and position per clip, punch-in and slow-push moves, blurred fill for clips that
  are not vertical.
- Cuts: hard cut, dissolve, and a small set of wipes from OpenFilm's bundled library.
- Captions: made from speech with word timing, word highlight, fix a word, hide a word, style
  presets, position, on or off. They follow every trim without being re-made.
- Text on screen: add, edit, style presets including the label look, drag to place, timing.
- Sound: voice level, the creator's own uploaded music with level and fades, sound effects from the
  bundled set, loudness evened to one target at export.
- Look: a few filters.
- Guides: safe areas for TikTok and Reels over the picture, a warning past three minutes.
- Undo, redo, autosave, versions.
- Changes by chat ("bigger captions") as the same operations the buttons use.
- Auto-edit to match the reference: cut points and pacing, framing rhythm, caption style, text
  placement, where effects and sounds fall.
- Export: one 1080×1920 MP4 (H.264, AAC) that both platforms accept, a cover frame, the caption
  text; share menu on phones, download on desktop.

**Release 2.** Extra picture layers (b-roll over the main clip, images, stickers), the effects
library, keyframed moves, voice-over recording, noise cleanup, removing silences and filler words,
beat tools, face-following reframe, caption translation, saved styles, direct posting (including
TikTok drafts, where the creator adds the sound in the app), transparent and editing-program
exports.

**Left out.**

- Platform music in the export (M3). The editor shows where the reference's beat falls instead.
- Video generation, avatars, dubbing. The fleet has its own pipeline; the editor takes its clips
  like any other.
- Green screen, speed curves, 4K, 60 frames/s output. Rare for this format; revisit on demand.

## 4. Platform facts the design rests on

Collected by a research pass on 2026-11-11 from the pages linked in each line; I have not re-read
them by hand.

- **One file fits both.** TikTok accepts MP4/H.264 at 23 to 60 frames/s, up to 4 GB and 10 minutes
  by API ([media transfer guide](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide)).
  Instagram Reels accepts MP4/H.264 with AAC, the index at the front of the file, up to 25 Mbps,
  3 s to 15 min and 300 MB by API
  ([media reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media)).
  Our render already writes the index first.
- **Safe areas.** Instagram documents 14% top, 35% bottom, 6% each side for Reels ads
  ([ads guide](https://www.facebook.com/business/ads-guide/update/video/instagram-reels)). TikTok
  publishes only ad templates. We set one conservative shared guide and label it ours.
- **Music.** TikTok's and Meta's library terms allow use inside their apps only
  ([TikTok terms](https://www.tiktok.com/legal/page/global/commercial-music-library-user-terms/en),
  [Meta](https://www.facebook.com/business/help/402084904469945)). The TikTok posting API has no
  music field for videos. That no licence covers a third-party editor is a reading of those terms;
  no clause names third-party editors.
- **Posting.** TikTok: unaudited apps post private-only for at most five users a day
  ([direct post](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post),
  [guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines)). Instagram: Business
  or Creator accounts; publishing for other people's accounts needs app review and business
  verification ([publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)).
- **AI labels.** TikTok reads C2PA metadata and has `is_aigc` on its API
  ([support](https://support.tiktok.com/en/using-tiktok/creating-videos/ai-generated-content)).
  Instagram has `is_ai_generated` (June 2026) and, since 31 August 2026, stops recommending
  accounts that show an AI-made person without the label
  ([Instagram](https://creators.instagram.com/blog/ai-generated-profile-label)). The fleet's footage is AI-made, so every asset carries where it
  came from, and that reaches the export and the post.

Not confirmed: TikTok's safe areas for ordinary posts, Instagram's feed crop, whether Instagram
reads C2PA on video.

## 5. The five parts

| Part | What it is | Depends on | When it is done, this works |
|---|---|---|---|
| 1. Edit format | The saved edit (`EditSpec`), the compiler to a film folder, the edit operations. Pure code that runs in the browser and on the worker. | nothing | A hand-written edit renders locally to the right frames. |
| 2. Worker | Modal app: prepare media (preview copy, thumbnails, waveform, transcript), render, job table, durable progress, own bucket with expiry, credits, AI mark. | 1 | An edit queued from Maven becomes an MP4 with a progress view that survives a reload. |
| 3. Auto-edit | Reference analysis inside the remix run, takes + blueprint → `EditSpec`, chat changes as operations. | 1, 2 | The owner's own takes come back edited like the reference. |
| 4. Editor panel | Live preview engine, timeline, controls; the rail at ≥1280 px, a full-screen sheet below. | 1, 2 | A user adjusts the edit and sees every change at once. |
| 5. Capture and hand-off | Filming mode with the script on screen, upload, export, share, cover. | 2, 4 | A user goes from shoot sheet to a posted video. |

Parts 1 to 3 serve D4. Parts 4 and 5 are the user release. Part 4's layout needs mock-ups before
its spec is written.

## 6. The shared model

- **`EditSpec`**: one JSON document per edit, zod-validated, versioned, counted in frames. It is the
  stored truth. Part 1 defines it.
- **Assets**: every clip, image and sound an edit uses, with its origin (`filmed`, `uploaded`,
  `generated`, `kit`). Originals live in a new private bucket, not in `videos`, because of the
  24-hour orphan sweep.
- **The kit**: the static files every film needs (text page, fonts, wipes, sounds), versioned so an
  old edit renders the same later. A document names the kit it was made with (`kit: 'v1'`).
- **Operations**: every change, from a button, the chat or the auto-edit, is one of a closed list of
  operations on an `EditSpec`.
- **Jobs**: one row per prepare or render job with status and progress, read by the thread block.

## 7. What can still change the design

- A real x64 run of the codec check, and a real iPhone run of the preview.
- Render speed on Modal's CPUs, and whether a GPU brings it near the Mac's 40 s.
- How well a vision pass reads caption style and transitions from a reference. Cut detection is
  exact but sees neither.
- OpenFilm is five weeks old. The preview uses its in-page player's editor object, which is not a
  documented interface. The pin and our own tests are the protection.

## 8. What the owner owes

- A Modal account and token.
- `.env.local` copied into the worktree (a deny rule blocks the agent from doing it).
- An iPhone for the preview test, when part 4 starts.
- The new Vercel account: production deploy has been off since 2026-08-07 and blocks any user
  release.
- TikTok and Meta developer apps, before release 2's direct posting.
