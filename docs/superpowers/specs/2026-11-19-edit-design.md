# Design — the edit tool, built fresh · 2026-11-19

The edit tool turns a creator's takes into a finished short vertical video, lets an AI agent change
it from plain requests, and lets the creator adjust it on a phone. This document is the map for all
of it. Each part gets its own plan.

**Status:** the owner ruled the engine and the approach on 2026-11-19 and said to continue on the
recommendation. Built so far: the edit document, its checks and its operations (`src/lib/edit/`,
the first half of part 1). Decisions X14 to X28 were taken while building it and the owner has not
read them yet.

**Built fresh.** An earlier attempt on another engine exists on branch `feat/openfilm-edit` (draft
PR 560). The owner's ruling: "we dont want to reuse anything we had lets build it fresh in the best
form". No code, format or kit is taken from it. What is taken are facts it measured, each cited
below, and two accounts that exist: Modal and a Cloudflare R2 bucket.

**Evidence:** the trial of three toolkits on the owner's take, the player test, and the research
report `~/reports/Remotion best practice November 2026.md` ("the report").

---

## 1. The rulings this builds to

Owner, 2026-11-19, in his words:

| # | Ruling |
|---|---|
| E1 | "i want the ai agent to be able to edit it to the requirements of the user for example with animations etc. this editor needs to be good, clean and smooth" |
| E2 | "we want whats get us the absulte best result inside the app when integrated" |
| E3 | "lets go with remotion" |
| E4 | "we dont want to reuse anything we had lets build it fresh in the best form" |
| E5 | "we want the best tool this needs to be good" |

Product rulings that stand (2026-11-11 and 2026-11-16): the launch user is a solo creator on a
phone; talking-to-camera videos for TikTok and Instagram Reels; the owner's own and the fleet's
videos come first; credits per finished video; no platform music inside the exported file; export
is one MP4 that both platforms accept, plus a cover and the caption text.

## 2. The shape

Five pieces. Each is built and tested alone.

1. **The edit.** One JSON document per video, checked by zod, counted in frames. It is the stored
   truth. Only named operations change it, all or none. Undo is the document before.
2. **The kit.** React parts that draw an edit: a shot, caption looks, a title, a call-out, an end
   card, small marks, transitions, sounds. One code base draws the preview and the posted file.
3. **Upload analysis.** Run once per take on the worker. It leaves what the agent and the checks
   need: the words timed to the sound, the pauses, where the face and the mouth are, the loudness.
4. **The agent.** It turns a plain request into operations, sends them through the door a button
   uses, runs the checks, looks at stills when something moved, and repairs.
5. **Two ways to see it.** Remotion's Player in the app, live. `renderMedia` on the worker for the
   file that is posted.

## 3. Rules it is built to

| # | Rule | Why |
|---|---|---|
| N1 | What is seen is what is posted. Preview and render run the same parts, fonts and CSS. A feature that cannot show on a phone is not in the kit. | The report: 12 transitions, motion blur and effects on text need a desktop Chrome with a flag on and do not work in Safari. |
| N2 | The agent writes operations, never code that runs. | Safety and speed; the Remotion licence forbids end users bringing their own Remotion code; everything three trial agents made fits a fixed kit. |
| N3 | Nothing is placed from a transcript alone. Words are re-timed to the sound at upload, and a cut lands in a measured pause. | All three trial agents found the transcript 0.4 s early; on the one public benchmark Whisper's word times score lowest. |
| N4 | Every change passes one door: parse, apply all or none, check. A button, the agent and the first cut use the same door. | Remotion 4 draws invalid input with only a warning, and a model's structured output does not enforce number or length limits. |
| N5 | Facts about a file are measured once on the server and stored: length, size, loudness. Never a browser's number, never the agent's. | Safari reads AAC files 23 ms shorter than Chrome; a trial agent was handed a wrong length. |
| N6 | The preview stays light and looks the same: one colour pass per clip, decoded frames no larger than shown. | Measured: a heavy per-frame effect dropped a preview to 9 frames a second in Safari's engine. |
| N7 | Every font, sound and picture in the kit has a licence that allows a creator's commercial post, written down beside it. | The report: 23 of Remotion's 32 bundled sounds are clips from other people's media. |
| N8 | The craft is in code, not in the model's arithmetic. Where a cut goes, where a caption sits and how loud the mix is are computed from the analysis; the model chooses what and why. | The trial agents spent twenty minutes each working these out by hand, and made mistakes only measuring caught. |
| N9 | Nothing in the product is named after the engine. | It must be replaceable. |

## 4. What is used and what is not

From the report; each line there carries its source. All Remotion packages are pinned to one exact
version, first `4.0.545`.

| Job | Use | Not |
|---|---|---|
| Preview and media | `remotion`, `@remotion/player`, `@remotion/media` (`<Video>`, `<Audio>`) | the older video tags as the main tag; `@remotion/media-parser`; `@remotion/preload` |
| Captions and text | `@remotion/captions`, `@remotion/layout-utils`, `@remotion/rounded-text-box`, `@remotion/fonts` with font files of our own | community caption packages; fonts a creator uploads |
| Motion | `interpolate`, `spring`, `Easing` | GSAP (its free licence bars visual animation builders), Framer Motion, CSS transitions, Tailwind `animate-*` |
| Cuts between shots | `@remotion/transitions`: `none`, `pushCut`, `fade`, `slide`, `wipe`, `iris`, `clockWipe` | the 12 that need a flagged Chrome; `motionBlur` |
| Look | `@remotion/effects`: one `colorCorrection()` or `lut()` per clip, on the footage | effects on text |
| Sound | CC0 sound files of our own with their lengths measured | `@remotion/sfx`; any music in the file |
| Words | ElevenLabs Scribe, then a forced aligner | `@remotion/openai-whisper` (its model shuts down 2027-02-26); Whisper's own word times |
| Render | `@remotion/renderer`, `@remotion/bundler`, in the worker image only | either inside a Next route or a Vercel function; rendering in the creator's browser |
| The editor's screens | our own, in the app's new look | the $600 Editor Starter as a drop-in; AGPL editors |

The film's parts are styled inline, without Tailwind, so the same CSS exists in the app and in the
render bundle.

## 5. The edit document

A stretch of a file is stored in whole milliseconds, exactly as asked. The film is counted in
whole frames at 30 a second, and frames are worked out, never stored.

```
Edit   = { v: 1, kit: "1", stage: { w: 1080, h: 1920, fps: 30 },
           assets: Asset[], shots: Shot[], items: Item[],
           captions: Captions, look: Look, cover: { shot, atMs } | null }

Asset  = { id, kind: "video", origin, at, ms, w, h, sound, words: Word[] | null }
       | { id, kind: "image", origin, at, w, h }
       | { id, kind: "audio", origin, at, ms }
         origin = "filmed" | "uploaded" | "generated" | "kit"     at = { bucket, path } | { kit: path }
Word   = { text, startMs, endMs, hidden?: true, stress?: true }

Shot   = { id, asset, startMs, endMs, speed, volume,
           framing: { from: Frame, move: { to: Frame, ease, part: [t0, t1] } | null },
           look: { preset | null, adjust } | null, out: Cut, marks: Mark[] }      Frame = { zoom, x, y }
Cut    = { kind: "cut" } | { kind: "fade" | "punch" | "iris" | "clock", frames }
       | { kind: "push" | "wipe", frames, from: "left" | "right" | "top" | "bottom" }
Mark   = { id, part, asset?, atMs, lenMs, props }                 on a shot: from a moment of its file, for lenMs of film
Item   = { id, part, asset?, anchor, at, frames | null, props }   on the film: frames from its start, or back from its end
Captions = { on, look, font, size, y, width, maxWords, highlight }
Look   = { preset, adjust: Adjust }                               one colour pass; "natural" with nothing adjusted is none
Adjust = { exposure, warmth, tint, shadows, highlights, contrast, saturation, vibrance }
                                                                  each -1 to 1; 0 changes nothing
```

Why this form:

- **A shot is a stretch of its file, and its frames are worked out.** The document says what the
  creator means: from this moment to that one. So a trim sets exactly what was asked and leaves
  the other end alone, a new speed keeps the stretch, and a change taken back gives the same
  document. No operation has to round what is stored.
- **A run is footage that plays on unbroken:** one shot, or several where each starts exactly
  where the one before stops (the same file, the same speed, a plain cut). Frames are counted on
  the run's clock: a moment falls on the frame nearest to it. Marks, captions and the cover are
  placed by that clock, so cutting a shot in two changes nothing a viewer sees or hears. Tests
  hold this over more than a thousand single cuts and over repeated random cuts of clips and
  pictures at several speeds, with transitions.
- **Everything placed is a kit part, and it has one of two homes.** A **mark** rides on a shot: it
  starts at a moment of the shot's file, like a word, and lasts a length of film. A call-out on
  "Virtuna", a cutaway over a sentence, a whoosh on a moment. Its start follows what is said
  through every trim, split and move; its length is what a viewer sees, and a sound or a clip
  plays at its own pace whatever the shot's speed. It shows when its run shows its moment,
  whichever piece of the run holds it. An **item** sits on the film and is timed in frames,
  counted from the film's start, or back from its end so that an end card stays at the end. A
  sound is a part like any other, so there is no separate list of sounds.
- **A part either belongs to the picture or runs on.** A call-out ends when its run does. A sound,
  a cutaway and a title run on over the cuts that follow, as a sound rings out and a cutaway hides
  a cut.
- **No operation removes what it was not asked to remove.** A trim leaves the shot's marks, the
  film's items and the cover as they are. What the film no longer reaches does not show, and it is
  back when the footage is. A mark whose moment was cut off at the front is already running when
  its footage starts. So nothing far away can stop a trim, and the same operations in another
  order give the same film.
- **The cover is a moment of a shot,** not a film frame, so it does not drift when something before
  it is cut.
- **Framing is one thing.** A framing, and a move if it moves: where the move ends, how it eases,
  and the part of the move this shot shows, at an even pace from its first moment to its last. A
  split or a trim changes the part and nothing else, so a move keeps its pace across pieces, one
  move can run over several shots, and a shot made longer than its move holds still before or
  after it. A punch-in on a word is a split at the word and a new framing on the second piece.
- **A look is a preset and adjustments on top.** "Warm, a bit brighter" keeps the preset. The eight
  adjustments are the ones one colour pass can make, each on one scale. The film always has a
  look. A shot may change it: a preset of its own, and adjustments added to the film's. So a look
  set on the film reaches every shot, tweaked or not.
- **Words live in the edit.** A fixed word is a changed `text`; a hidden one has `hidden`; one to
  stress has `stress`. Caption pages are made per run as the film is drawn, with
  `createTikTokStyleCaptions`, breaking on pauses. A word counts for a run when its middle falls
  inside what the run shows, and lands on the same frame as a mark at the same moment.
- **A part's settings are typed by the part.** A mark and an item are each one of a closed set of
  shapes, one per part, so a wrong setting is refused at its exact place, the kit gets typed
  settings, and the operations can be given to a model as a schema with no setting left open. A
  file a part plays is named in `asset`. The parts' schemas live with the edit
  (`src/lib/edit/parts.ts`) and their components with the kit; a test holds the two lists equal.
- **A file has the facts its kind has,** and comes into an edit only from the list the server
  offers (N5): `asset.add` names a file on that list and nothing else.
- **An id names one thing in the whole edit,** so an operation names a shot, a mark or an item by
  its id alone, and a problem names what it is about by id.
- **Where everything lands is one set of functions** (`src/lib/edit/derive.ts`): the runs, each
  shot's frames, the film's length, where every mark and item shows, the words, the framing of a
  moment, the frame of a moment and the moment on a frame, the cover, the look a shot is drawn
  with. The Player, the render and the checks all call the same ones, so they cannot disagree.
  The kit draws a run as one piece of footage, and what is drawn over what is its rule, by kind
  of part and by when a thing starts.

A take's analysis (pauses, face and mouth boxes, loudness) is not needed to draw. It stays with
the take in the database, where the agent and the checks read it.

### 5.1 Operations

The closed list of changes. Each is small, says what it means, and sets exactly what it is given.

| Group | Operations |
|---|---|
| Shots | `shot.insert`, `shot.split`, `shot.trim`, `shot.remove`, `shot.move`, `shot.set` |
| Marks and items | `mark.add`, `mark.set`, `mark.remove`, `item.add`, `item.set`, `item.remove` |
| Words and captions | `word.set`, `captions.set` |
| Film | `asset.add`, `asset.remove`, `look.set`, `look.clear`, `cover.set` |

A shot is cut by the time of its file (`shot.insert` and `shot.trim` take a stretch, `shot.split`
a moment), because that is where the measured pauses are (N3). A new speed keeps the stretch of
file, so the shot fills fewer or more frames.

The door refuses a change whose new thing would not show in the film the operations leave: a mark
at a moment its footage does not show, an item that starts past the film's end, a cover on a
moment that is not there. It judges at the end, so the order of the operations does not matter.
What a later trim hides is left alone.

**Recipes** are not operations at the door. A recipe is a function the app runs on a take's
analysis (N8) that gives back basic operations: `tighten` cuts every pause to a given length,
inside the measured silence; `place.captions` sets the caption line clear of the face and the
apps' buttons; `level.voice` sets each shot's volume from its measured loudness. What is stored
and undone is always basic. They come with the worker, which makes the analysis. The kit fades a
run's sound in and out over a frame or two where it starts and ends, so a cut never clicks;
nothing is stored for that.

### 5.2 Checks

- **`check`** must pass or the change is refused. It refuses only what cannot be drawn: the wrong
  shape; an id used twice; a file that is missing or of the wrong kind; a shot, a cutaway or a
  sound that asks for more of its file than there is; a shot that fills fewer than three frames;
  a cut longer than the footage on either side of it, measured as the whole run (the engine's
  own rule); a film over three minutes; a part's settings and smallest sizes. Each problem names
  the thing by id as well as by place, and a refusal about a cut says whose cut it is.
- **`review`** reads the take's analysis and returns findings, each with a place and a severity: a
  caption or part on the face or the mouth, something under the apps' buttons, text that does not
  fit, two titles at once, a shot fading in and out at once, a cut outside a pause, an empty first
  frame, a mark that no longer shows. The agent must clear the errors and tries to clear the rest. A person sees them as marks
  on the strip.

## 6. The kit, first version

A part is a React component, a zod schema for its settings, the smallest sizes it allows, where it
may sit (a shot, the film, or both), and a thumbnail drawn by the component itself. Parts animate
with `interpolate` and `spring` only, load their own fonts and fit their text.

| Part | What it is |
|---|---|
| Shot | A stretch of a take: framing, speed, volume, look. |
| Caption looks | Four to start: a pill, a popping word, a highlighted word, plain. Each shows the word being said. |
| Title | The hook over the first second. |
| Call-out | One or two words that land with emphasis on a moment. |
| End card | A closing card with a line. |
| Progress bar, arrow, sticker | Small marks. |
| Cutaway | A clip or a picture over the speaker while the voice goes on. |
| Transitions | A plain cut and six of §4. In the edit they are named for what a viewer sees: `fade`, `push` (the engine's `slide`: the next shot pushes this one out), `wipe`, `punch` (the engine's `pushCut`), `iris`, `clock` (`clockWipe`). |
| Sound | An effect on a moment or a voice over the film. The kit's first sounds are CC0, each with its measured length and its licence. |

The edit knows five of these parts so far: title, call-out, progress bar, cutaway and sound. The
end card, the arrow and the sticker get their schemas together with their components, in the kit's
plan.

Fonts: three to start, Inter, Montserrat and TikTok Sans, all under the SIL Open Font License, each
a file of our own with its licence beside it. The captions and each text part name one of them.

Limits the trial taught are built in: the first caption is at full strength on frame 0; a held
picture is a still. A punch-in on a 720p take stopped near 1.18 in the trial; measured on the kit
(2026-11-19) a take turns soft from about twice its own pixels, 1.33 on a 720p take, and that is a
rule for `review`, not something the kit refuses.

**Built so far (part 1b, 2026-11-19):** the shot, the four caption looks, the title (which also
serves as the end card: an item counted back from the film's end), the call-out, the progress
bar, the cutaway, the seven cuts and the sound part. **Not built yet:** an end card of its own,
the arrow, the sticker, the kit's own first sounds with their licences, and the thumbnails.

## 7. Upload analysis

Run once per take, on Modal's CPU containers.

| Step | Tool | Leaves |
|---|---|---|
| Two copies | ffmpeg: H.264 and AAC; one for the render, one small with a keyframe every half second for the preview | files in R2; the measured length |
| Words | ElevenLabs Scribe | the words (about half a cent per 90 s) |
| Word times | a forced aligner: WhisperX first, because it ships German and Italian; MFA measured against it | each word's start and end on the sound |
| Pauses | Silero VAD plus sound energy | where a cut may land |
| Face and mouth | MediaPipe Face Landmarker, a few frames a second | boxes per moment |
| Loudness | ffmpeg | level per stretch |
| Voice clean-up | DeepFilterNet, only when asked | a cleaned sound file |

Every upload is transcoded: HEVC makes `@remotion/media` fall back to a tag that is not
frame-exact. After the render the final mix is brought to -14 LUFS with one gain and a true-peak limiter
under -1 dBTP (X49), because Remotion does not do it.

## 8. The agent

- **It answers with** `{ say, ops }`. Graphics are parts of the kit placed by operations.
- **It is given** the edit, each take's analysis, the kit's catalogue (made from the parts' own
  schemas) and the request.
- **The loop:** operations, the door (N4), `review`, stills only when something moved or appeared,
  a repair. At most three rounds, then `say`. A change is a targeted list of operations, never a
  rewritten document.
- **Stills** come from the warm render worker, so each look also proves that preview and render
  agree. Measured on a Mac: 0.6 to 1.0 s a still, 3.6 s for a sheet of eleven.
- **A first cut is the same agent** with recipes: the recipes place the cuts and the captions; the
  model chooses the hook, the words to stress, the look and the moments.
- **Aims, not yet proved:** a change in under ten seconds; a first cut of a 90 s video in under two
  minutes.
- **Where it runs:** in the app's server code, in TypeScript, beside the operations and checks it
  uses. Its limits on time are checked when its plan is written.

## 9. The Player in the app

The film is a React component of our own that takes the edit and the files' addresses. No
model-written code runs in the browser.

- **Settings:** `inputProps` memoised; controls beside the Player, driven through its ref; play
  from a real tap; `defaultPremountInSeconds` 1 to 2; no remount on a layout change;
  `maxCanvasSinkFrameSize` to keep decoded frames small; `acknowledgeRemotionLicense`.
- **As built, 2026-11-19** (`src/edit/player/EditPlayer.tsx`): props memoised; one second of lead
  (X35); a change sent through the door shows in 24 to 33 ms with nothing mounted again and the
  playhead where it was; the frame cap is not set (X35); the licence note is the owner's to
  answer. Controls of our own come with the editor's screens.
- **What is seen is what is posted, measured** (X34): on 129 frames of 53 edits (every look, cut,
  caption look, title and call-out look, two speeds, a camera move, and 26 edits with awkward
  text) the Player's picture and the rendered still are at worst 0.29 % of pixels and 1.1 levels
  of 255 apart in Chromium, and 0.34 % and 1.7 levels in WebKit. A title drawn one frame late is
  0.5 to 2 % apart.
- **Files:** signed R2 addresses to the preview copy; the bucket answers CORS and byte ranges.
- **Measured, phone-size on a Mac:** first frame in 0.3 to 0.6 s, a jump in 69 to 119 ms, a change
  shown in 22 to 40 ms, 25 to 29 of 30 film frames a second.
- **Open on iPhone** (GitHub, 2026-11-19): a preview of many short clips grows in memory with
  every loop until the tab freezes (pull request 12982, not merged); sound and picture can stay 100
  to 180 ms apart after a stall (issue 11439). Test 1 decides what follows: the fix applied as a
  patch, the browser's own video tag on iPhone only, or the Player rebuilt between loops.

The screens around the Player are their own design, in the app's new look: a card in the thread
that opens to a page with the video and one strip of clips.

## 10. The render

- **Where:** Modal, with `renderMedia`. The bundle is built once with the image. Debian 12 or
  newer. WebGL in software. `licenseKey: "free-license"` from the first render.
- **The same worker draws stills** for the agent.
- **Jobs:** a row per analysis and per render, with progress the app can read again after a
  reload. Designed with part 2.
- **Not now:** AWS Lambda. Remotion's example renders a one-minute video with footage in 19 s for
  1.7 cents there. It is the way out if Modal is too slow.
- **Test 3, measured 2026-11-20** (worker plan, Task 1): the 90.9 s film with the warm look took
  667 s on an 8-core container in one browser, and the same with no look, because one browser's
  one GPU process queues every page's drawing in software. Rendered in slices of 120 frames by
  eight browsers on a 16-core container and joined with `combineChunks`, it took 143 s (about 4
  cents), with frames and sound matching the one-piece film. Software GL draws what the Mac's GPU
  draws (0.017 % of pixels, 0.6 levels). A container without WebGL fails the render. So Lambda is
  not needed (X50).

## 11. Tests before the building they gate

| # | Test | Settles | Needs the owner | Gates |
|---|---|---|---|---|
| 1 | A real iPhone and a mid-range Android: an 18-clip edit looped ten times, memory watched | the open iPhone problem; the real frame rate | his phone, on a Wi-Fi he trusts | the Player's settings in part 1; part 4 |
| 2 | The same through wireless earphones | the sound offset | yes | part 4 |
| 3 | A 90 s film on Modal with one colour pass | render time and cost | no | part 2 |
| 4 | Player picture against rendered still at every cut, Chromium and WebKit | N1 | no | every part of the kit, as its own test |
| 5 | Scribe and an aligner on the 12.7 s take, against the measured sound | N3 | an ElevenLabs key | part 2 |
| 6 | An iPhone HEVC take through transcode, R2, Player and render with fallback off | codecs, CORS, ranges | his take | part 2 |

## 12. Parts and order

| # | Part | Done when |
|---|---|---|
| 1 | The edit (document, operations, checks), the kit, and a page that plays an edit | an edit written by hand plays in the Player on a phone and renders to the same frames; test 4 runs in the suite |
| 2 | The worker: upload analysis, render, stills, jobs, storage | a take uploaded from the app comes back analysed, and an edit becomes an MP4 with progress that survives a reload |
| 3 | The agent: first cut and changes | the owner's takes come back cut, captioned and reviewed, and a plain request changes it in seconds |
| 4 | The editor's screens | a creator adjusts the edit on a phone |
| 5 | Capture and hand-off | from shoot sheet to a posted video |

Parts 1 to 3 serve the owner's own and the fleet's videos.

## 13. Decisions taken here

Mine, listed so they can be overturned.

| # | Decision | Why |
|---|---|---|
| X1 | The edit document is the centre and Remotion draws it. | N1, N2; a change shows in 22 to 40 ms this way. |
| X2 | Marks ride on the shot's source time; items sit on film time. | A graphic tied to a word must survive every trim and move. |
| X3 | One framing concept (start, optional end, ease) instead of framing plus moves. | Fewer ideas, same results. |
| X4 | Words live in the edit; caption pages are made as it is drawn. | A fix is a plain change, and trims never re-make captions. |
| X5 | Recipes are functions that work out basic operations in code from the analysis. | N8. |
| X6 | Two checks: one that refuses, one that reviews. | A refusal protects the document; a review is how quality is seen and repaired. |
| X7 | The kit's parts are styled inline, without Tailwind. | One CSS for preview and render. |
| X8 | Scribe for the words, then WhisperX; MFA measured against it. Without a key, a local model with the aligner. | Best hosted word timing for half a cent; German and Italian. |
| X9 | Render on Modal first. | The account exists; Lambda stays the way out. |
| X10 | No music in the file; only CC0 or licensed sounds. | The platforms' terms; N7. |
| X11 | The caption looks are written here, not copied from Remotion's gallery. | Its licence is not stated. |
| X12 | Code lives in `src/lib/edit/` (the edit), `src/edit/film/` (the kit and the film) and `src/edit/player/` (the Player in the app). | N9. |
| X13 | Commits stay local on `feat/edit`, made without the repo's push hook, until the owner says push. | His rule: pushes only when asked. |
| X14 | A sound is a kit part. A mark on a shot and an item on the film are the only two homes for anything placed. | A sound tied to a moment must follow it through every cut, as a graphic does; one concept less. |
| X15 | No operation removes what it was not asked to remove. What the film no longer reaches does not show, and is back with the footage. | A trim must never be blocked by something far away or lose something without saying; the same operations in any order give the same film. |
| X16 | The cover is a moment of a shot. | A film frame drifts as soon as anything before it is cut. |
| X17 | A look is a preset plus eight adjustments, each from -1 to 1. The film always has one; a shot changes it with a preset of its own and adjustments added on top. | "Warm, a bit brighter" must keep the preset; a look set on the film must reach a shot that was tweaked. |
| X18 | Assets are a list, and an id names one thing in the whole edit. | Operations and problems name things by id alone; one rule for every list. |
| X19 | A shot stores its stretch of file in milliseconds; its frames are worked out. | With stored frames every trim, split and speed change had to round, and the rounding leaked: an end moved by 10 ms, a speed set and taken back lost a frame, pieces drifted apart. |
| X20 | A mark starts at a moment of its shot's file and lasts a length of film. | Its start must follow what is said; its length is what a viewer sees, and a sound plays at its own pace whatever the shot's speed. |
| X21 | Marks, captions and the cover are placed by runs of unbroken footage, not by single shots, and a mark shows when its run shows its moment. | A split must change nothing, and moving the cut between two pieces must not hide what the footage still shows. |
| X22 | A move says which part of itself a shot shows, and the part may reach before the move or past it. | A split or a trim keeps the move's pace; a trim taken back gives the move back; one move can run over several shots. |
| X23 | A file comes into an edit only from the list the server offers. | N5 at the one door: neither a browser nor a model can give a file a length or a place. |
| X24 | `check` refuses only what cannot be drawn; how a film looks is `review`'s. | X15: two titles at once is a fault to show, not a reason to refuse a trim. |
| X25 | A mark and an item are typed per part, and so are the settings a set operation takes. | The agent's answer can be held to a schema; the kit gets typed settings; a wrong setting is named at its place, with its part. |
| X26 | The door judges "would it show" at the end of a list of operations, not at each one. | The order of operations in a list must not decide whether it is accepted. |
| X27 | An item counts its frames from the film's start or back from its end. | An end card must stay at the end whatever is cut before it. |
| X28 | A cut may not be longer than the footage on either side of it, measured as the whole run. A shot fading in and out at once is drawn, and is `review`'s to flag. | It is the engine's own rule, found by running it on 2026-11-19; X24. Measured per run, a split never makes a cut too long. |
| X29 | The edit names a cut for what a viewer sees, not for the engine's function, and says which side the next shot comes from. | N9; the engine's `slide` pushes and its `pushCut` has no direction, so its names would mislead a person and a model. |
| X30 | Where a browser cannot run the colour pass (it needs WebGL 2), the preview shows a stand-in made of two plain colour matrices and tells the app so. What is posted always runs the pass itself. The film gives the pass up only when the pass itself failed, not when a clip did. | Found by running it on 2026-11-19: without WebGL 2 the engine leaves the footage black, then drops without a word to a picture with no look at all. The stand-in is within 0.5 to 1.6 levels of 255 of the real pass on each preset, measured on renders of the owner's take. |
| X31 | The film takes nothing from the page it is shown on. Its root starts every style a page hands down again and sets how letters are smoothed itself (thin); text is measured with the same plain values it is drawn with. | Found by comparing preview with render: the app smooths its letters thin and the renderer's page did not, so every letter of the film was 7 % fuller in the posted file than in the preview. Thin is how letters are drawn where films are rendered and on a phone. |
| X32 | The kit sets its type in whole pixels: sizes, line heights, places. | Chrome and Safari round a part of a pixel differently; the third line of a title sat two pixels from where the renderer put it. |
| X33 | No preset uses vibrance, and the vibrance adjustment reaches the colour pass at 12 % on the way up, in full on the way down. | The engine's vibrance adds colour, most to what has least: at a third of its range a grey wall went orange and a dark laptop came out in blotches. Seen on renders of the owner's take. |
| X34 | Preview against render (test 4) is a script with its own command, not part of the default suite: `scripts/edit-preview-vs-render.ts`, in Chromium and in WebKit, with two measures and stated limits. | It needs the dev server, the real renderer and a take. Counting far-apart pixels alone cannot see a look left out (0.00 % on a film rendered warm and shown plain), so the colours' average distance is measured as well. |
| X36 | The kit breaks its own lines, from measured widths, and draws each line as it decided: a title on the fewest lines that let its type be as large as asked, evened out; captions in the fewest rows that fit. A difference of under half a percent between two ways of breaking does not decide. Every box in the film counts its padding into its width. | Left to the browser, the same title broke after one word in Chrome and before it in Safari, so a preview could differ from the posted film; a label's boxes overlapped; and the app's page and the renderer's page size a padded box differently. |
| X37 | The kit measures words without kerning and draws them with it, centred in the box the measurement gave. | Chrome kerns a hyphen with the letter after it and Safari does not: the same call-out measured 0.2 % apart and was set at 49 pixels in one and 48 in the other. Unkerned, both browsers give the same width to a hundredth of a pixel, so the sizes and line breaks decided from it are the same in every browser. |
| X35 | The Player makes a run, a cutaway and a sound ready one second before the film gets to them. It does not cap the size of decoded frames. | Measured: with no lead the film stood still for about 200 ms at a cutaway and at a fade, with one second not at all. The preview copy already bounds the size of a frame; a second cap would only soften a zoomed preview. |
| X38 | One Modal app, two images: *media* for analysis, *render* for films and stills. Three functions (`analyse`, `render`, `stills`) and one web address. | The two need different worlds (Python models; Node and a browser). One app, one deploy, one secret. |
| X39 | Each pipeline is a function from files to files and facts. Storage and the database are an outer layer. | Everything but the outer layer is proved on the real take with no key; the outer layer is small and is proved end to end once the keys are there. |
| X40 | The film is bundled on the deploying machine from this repo, with `public/edit` as its only public folder, and the image holds the bundle, never the repo. | The bundle is what the Player runs, from the same pinned packages; the app's 11 MB public folder has no place in a render. |
| X41 | The app starts a job by writing its row and calling the worker's web address with a shared secret (`Authorization: Bearer`, compared in constant time). The worker reads the job's kind from the row, not from the call. It writes progress at most every two seconds. A running job not touched for two minutes reads as failed. | No Modal token in the app; a forged call can only start a job the app already wrote. Progress survives a reload because it lives in the row. A worker that dies cannot leave a job running for ever. |
| X42 | Two tables, `edit_takes` and `edit_jobs`. An owner reads their own rows; only the service role writes. | The worker writes; the app reads with the creator's session. No edits table yet: a render job keeps the edit it rendered. |
| X43 | R2 keys: `u/<user>/takes/<take>/{source,full.mp4,preview.mp4,poster.jpg}` and `u/<user>/films/<job>.{mp4,jpg}`. The browser uploads straight to R2 with a signed PUT. Signed reads last two hours. | The app streams no media; a render of three minutes reads its files long after it was asked. |
| X44 | Every take is transcoded. Full copy: H.264 High, CRF 18, constant frame rate (30 or 60 as filmed, anything else 30), SDR (HDR tone-mapped), long side at most 1920, AAC 48 kHz 192 kb/s, fast start, a keyframe every second and none at scene cuts (amended 2026-11-20: the render starts slices of 120 frames anywhere, and x264's default spacing of up to 250 frames would have each start decode up to 249 frames first). Preview copy: long side 960, CRF 28, a keyframe every half second. A poster at one second. | HEVC and variable frame rates make the engine fall back to a tag that is not frame-exact (design §7); the Player jumps fast with a keyframe every half second; iPhones film HDR by default. |
| X45 | A take's stored length is the shortest of what ffprobe, Chromium and WebKit give for both copies; Task 3 measures which and writes it as a rule. | Safari reads AAC files about 23 ms shorter than Chrome (N5); a film that asks past the end of a file is refused by the engine's host. |
| X46 | Words: Scribe when the ElevenLabs key is there, faster-whisper `large-v3-turbo` on CPU when not; then the aligner either way. | X8 said a local model without a key; the aligner is what gives the times (N3), so the first model only gives the text. |
| X47 | Pauses: Silero VAD's speech segments; a pause is a gap of at least 120 ms; each carries its quietest 10 ms as where a cut lands. | N3, N8: a cut lands in a measured pause, and the quietest point inside it, computed in code. |
| X48 | Face and mouth: MediaPipe Face Landmarker on the preview copy, five samples a second, boxes as shares of the picture. | Enough for `review` and `place.captions` to keep text off the face; the preview copy is smaller and the boxes are shares. |
| X49 | The posted file's sound: -14 LUFS integrated, or up to 1 LU under it where the limiter must hold a voice's peaks; never over -1 dBTP; one gain, then a true-peak limiter at -1.5 dBTP (4× oversampled); the picture copied untouched (amended 2026-11-20, Task 2 fix round 1: it said two passes of loudnorm to -14 LUFS and -1 dBTP). Where the posted file measures over -1 dBTP, the levelling is done once more with the ceiling lowered by the overshoot and 0.2 dB; never a loop. | Design §7; the demo render was -28.3 LUFS. loudnorm's one-gain mode gives way to its dynamic mode wherever one gain would push a peak over the ceiling, which on a voice is always (its peaks stand 15 to 20 dB over its loudness): the voice was compressed (loudness range 4.6 to 2.8 LU on the demo film). One gain keeps the voice's rise and fall; the limiter holds its loudest syllables, which on the owner's voice costs 0.8 LU (-14.8 LUFS), accepted rather than limit it harder. The half decibel under -1 is for the AAC encode, which puts peaks back up; dense sound (noise, music) can go further, hence the one guard. |
| X50 | A film is rendered in slices, each by a browser of its own with two pages and `gl: "swangle"`, and joined with `combineChunks` (the engine's documented recipe). The slices follow the film (amended 2026-11-20, Task 2 fix round 1; it said slices of 120 frames): as many as there are 60 frames, up to 32, all the same length but the last, which is never under 5 frames; eight browsers to a 16-core container, every browser drawing one slice, at most four containers (`worker/render/plan.py`). A 90 s film is 32 slices of 86 frames over four full containers; a 9 s film five slices in one. Target: a 90 s film under a minute. | Test 3 (Task 1): one browser renders the 90 s film in 667 s whatever its pages, because its one GPU process queues every page's drawing; slices in separate browsers take 143 s on the same container and match the one-piece film. |
| X53 | The film is encoded with BT.709's matrix and primaries (`colorSpace: "bt709"` on every slice), and its transfer is tagged as sRGB's (`h264_metadata` on the posted file's stream copy). | Measured on the demo against this Mac's stills (Task 2 fix round 1): the engine's default (matrix untagged) is 2.1 levels off in Chromium; plain BT.709 tags are 1.2 off in Chromium but 7.6 off in WebKit, which converts BT.709's transfer; BT.709 with the transfer called sRGB's is within 1.4 in both. How the platforms' transcoders read the tags is not measured yet (N1, the first real post). |
| X51 | The worker's secrets are one Modal secret, `edit-worker`, made by a script the owner runs that copies only the named keys out of `.env.local`. | `modal secret create --from-dotenv .env.local` would send every secret of the app to Modal. |
| X52 | Recipes (`tighten`, `place.captions`, `level.voice`) come with the agent in part 3, not here; the worker only stores what they read. | They are the agent's tools; the handoff of 2026-11-19 already said so. |

X38 to X53 were taken on 2026-11-20 in the worker's plan (`docs/superpowers/plans/2026-11-20-edit-worker.md`), which says how each was measured.

**Left open on purpose:**

- A cut that carries its own sound, centred on the cut by the kit. Today a whoosh at a cut is a
  sound mark on the shot it leads into or out of.
- Merging, splitting and re-timing words. They come with the worker, where the words are made.
- A font per word or per caption look beyond the one the captions have.
- Where the caption line sits per shot. Today it is one place for the film.
- Rules `review` is to have, found while building the kit (2026-11-19): a zoom above twice a
  file's own pixels (2 x file width / stage width: 1.33 for a 720p take) is soft; a volume above
  1 on a loud take clips; a call-out whose moment falls inside a transition; captions of more
  than two rows; text under the platforms' own buttons.
- A longer fade of a shot's sound than the kit's own at every cut.
- What the renderer does where it cannot run the colour pass. It must fail, never post a film
  without its look. To be proved on the worker's own image, where the browser draws in software.
- A browser that says it has WebGL 2 and cannot give a working context on the very first frame:
  the engine reports that only on the next frame, so the footage is black until the playhead
  moves. From the second frame on the film goes on with the stand-in (X30). Seen only by forcing it.
- A call-out whose moment falls inside a transition is drawn over the whole stage, not only over
  its own picture as it comes in. `review`'s to flag.
- A colour pass of our own, or looks from lookup tables. The engine has both (`lut`, `curves`, a
  way to write an effect). Wanted if looks should be more than one pass's eight adjustments give.
- How long ahead things are made ready on an iPhone (X35): more lead costs memory there. Test 1.
- A file that is not there or cannot be read: the engine falls back to the browser's own video
  tag, which fails too, and the page gets an error. What the editor shows then is the editor's
  screens' to design. (The film does not mistake it for a failed colour pass: X30.)
- Where text may sit under the platforms' own buttons is `review`'s to flag. The kit only keeps
  every title, call-out and caption on the stage.
- Inside a line, two browsers still place letters a part of a pixel apart, and Safari does not
  kern across a hyphen. Neither moves a line, a box or a size (X36, X37).

## 14. What the owner owes

- **His phone for tests 1 and 2,** and one take filmed on it in its default format for test 6.
- **An ElevenLabs key** for test 5.
- **The R2 token** (the steps were given on 2026-11-19).
- **A word on the old branch and draft PR 560:** left untouched until he says.
- **The price.** Set after the agent's cost is measured in part 3.

**Not verified:** what the colour pass costs on a CPU worker; any German or Italian word-timing
benchmark; what the agent costs per edit.
