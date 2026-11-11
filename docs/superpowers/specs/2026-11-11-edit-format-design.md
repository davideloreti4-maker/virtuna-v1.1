# Design — auto-edit part 1: the edit format, its compiler and its operations · 2026-11-11

Part 1 of five. The map, the owner rulings (D1 to D8) and the measurements are in
`2026-11-11-auto-edit-overview-design.md`; this document does not repeat them.

**Status when written:** branch `feat/openfilm-edit` = `main` = `0efcddd6`. No product code exists.
Everything below is new code under `src/lib/edit/` and `public/edit-kit/`.

**Status after the build (2026-11-11):** built on `feat/openfilm-edit`. Reviews during the build
found defects in the plan's code and gaps in this document. The fixes and the decisions taken are
worked into the text below and listed in §9 (F7 to F13). What is still open, and before which part
it must be done, is in §10.

---

## 1. What this part is

Three things, all pure code with no database, no storage and no UI:

1. **`EditSpec`**: the saved edit. One JSON document, zod-validated, versioned.
2. **The compiler**: `EditSpec` → the files of an OpenFilm film folder (`film.html`,
   `captions.vtt`). It runs unchanged in the browser (live preview, part 4) and in Node (render,
   part 2).
3. **The operations**: the closed list of changes anyone can make to an `EditSpec`. Buttons, the
   chat and the auto-edit all go through them.

Done means: an `EditSpec` written by hand compiles to a film that OpenFilm's own reader accepts with
no problems and that renders to the right picture on the right frame.

Not in this part: where edits and media are stored, the worker, reference analysis, any screen.

## 2. Rules it is built to

Each comes from a measurement in the overview's §2.

| # | Rule | Reason |
|---|---|---|
| R1 | Positions and lengths on the film are whole frames at 30 frames/s. Positions inside a source file are whole milliseconds. | Rounding a frame time to milliseconds put 5 of 10 cuts a frame late. |
| R2 | A frame becomes a film time by `frameMs(f) = floor(f × 1000 / 30)`, never by rounding. A clip's length is `frameMs(end) − frameMs(start)`. | A clip is on from the first frame at or after its start. |
| R3 | A clip never takes more source than its length allows: source used = `floor(length × speed)` ms. Whether a clip fits its file is judged by `minSourceMs(len, speed) = floor(frameMs(len) × speed)`, the least it takes at any start frame, so where it sits never decides it; at its place its window may pass the file's end by at most ⌈speed⌉ ms, and the compiler cuts it at the file's end. | A too-long clip overlaps the next one on its track, which the film format rejects. Flooring leaves a clip a few ms short of its frames (up to about 5 ms at 0.25×), which no frame samples. A span of `len` frames lasts `floor(len × 1000 / 30)` ms or one more depending on where it starts, so a fit judged at the clip's place made edits to other clips fail. |
| R4 | One compiler for preview and render. The only input that differs is which file stands for each asset. | The preview must show what the render makes. |
| R5 | The film's `<head>` is identical for every edit except the keyframes block. Clip ids are the spec's ids. | The in-page player applies a changed film in place only when the head is unchanged and clips keep their ids (11 to 33 ms instead of a reload). |
| R6 | A film references only files inside its own folder: assets and the kit. | Renders make no network connection; that property is ours to keep. |
| R7 | No identifier, file or folder is named after OpenFilm. | Its trademark terms. |

## 3. The document

`src/lib/edit/spec.ts` holds the zod schema and the inferred types. Frames are `f`, milliseconds
are `ms`. Ids are `[A-Za-z0-9_-]{1,24}`, never a name every object already has (`__proto__`,
`constructor`, `toString`, ...), and unique within their list (`main`, `layers`, `texts`, `sounds`);
an asset's id is its key in `assets`.

```ts
EditSpec = {
  v: 1,
  stage: { w: 1080, h: 1920, fps: 30 },          // fixed in v1
  kit: 'v1',                                      // the kit this edit was made with (§5.6)
  assets: Record<string, Asset>,
  main: Segment[],                                // at least one; plays in order with no gaps
  layers: Layer[],
  texts: TextItem[],
  captions: Captions,
  sounds: Sound[],
  look: { filter: FilterId | null },
  cover: { frame: number } | null,
  ref: { blueprintId: string; cuts: number[]; beats: number[] } | null,   // frames; guides only
}
```

**The film's length is the main sequence**: `total = Σ main[i].len`. Anything that runs past it is
cut off there by the compiler.

### 3.1 Asset

| Field | Type | Meaning |
|---|---|---|
| `id` | string | key in `assets` |
| `kind` | `'video' \| 'image' \| 'audio'` | |
| `origin` | `'filmed' \| 'uploaded' \| 'generated' \| 'kit'` | where it came from; `generated` is what the AI mark in part 2 reads |
| `generator` | string, required when `origin = 'generated'` | the tool or model |
| `at` | `{ bucket, path }` or `{ kit: string }` | the original in storage, or a path inside the kit. Both are `/`-separated segments, none empty, none `.` or `..`, no leading `/`; a kit path is lower-case |
| `ms` | number, video and audio | its length |
| `w`, `h` | number, video and image | pixels as shown, after rotation |
| `sound` | boolean | whether it has a sound track |
| `words` | `{ t0: ms, t1: ms, text }[] \| null` | its transcript, in its own time and in order (`t0 ≤ t1`, no word starts before the one before it); `null` until transcribed or when nothing is said |

Words live inside the document so captions are a pure function of it.

### 3.2 Segment (the main sequence)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `id` | string | | |
| `beat` | number \| null | null | the shoot-sheet beat it belongs to |
| `asset` | asset id (video or image) | | |
| `inMs` | ms | 0 | where in the source it starts |
| `len` | f, ≥ 3 | | its length on the film |
| `speed` | 0.25 to 4 | 1 | video only |
| `volume` | 0 to 2 | 1 | 0 is muted |
| `fit` | `'cover' \| 'blur'` | `'cover'` | `blur` shows the whole picture over a blurred copy of itself |
| `framing` | `{ zoom: 1..4, x: −1..1, y: −1..1 }` | `{1, 0, 0}` | zoom 1 fills the stage; x and y pan across what hangs over, 0 is centred |
| `move` | `{ kind: 'push-in' \| 'push-out' \| 'pan-left' \| 'pan-right' \| 'shake', amount: 0..1 } \| null` | null | a move over the whole clip |
| `filter` | FilterId \| null | null | |
| `cutOut` | `{ kind: 'cut' } \| { kind: 'fade', style: 'dissolve' \| 'dip-black', len: f } \| { kind: 'wipe', id: WipeId, color?: string }` | cut | how it hands over to the next segment |

Source used by a segment: `floor((frameMs(start + len) − frameMs(start)) × speed)` ms from `inMs`
(R2, R3); that is what the compiler takes, cut at the file's end. Whether the segment fits its
asset is judged by `inMs + minSourceMs(len, speed) ≤ ms` (R3), so its position never decides it.

### 3.3 Layer, TextItem, Sound

All three sit on the film by `at` (f) and `len` (f), and may carry **`pin`**: a segment id. A pinned
item's `at` counts from that segment's first frame, so it travels with the segment when earlier
parts are trimmed, and it is removed with the segment. Unpinned items count from frame 0.

```ts
Layer    = { id, pin, at, len, kind: 'clip' | 'sticker', asset, inMs, speed, volume,
             box: { x, y, w, h },      // fractions of the stage; may exceed it
             rotate: number, opacity: 0..1, radius: number, z: number }
TextItem = { id, pin, at, len, text: string /* ≤ 280 */, style: TextStyle,
             box: { x, y, w },         // centre and widest line, fractions of the stage
             rotate: number, in: MotionId | null, out: MotionId | null }
TextStyle = { preset: 'label' | 'outline' | 'plain', font: FontId, weight: number, size: number /* stage px */,
              color: string, fill: string | null, stroke: { color, w } | null,
              align: 'left' | 'center' | 'right', uppercase: boolean }
Sound    = { id, pin, at, len, role: 'music' | 'sfx' | 'voiceover', asset, inMs,
             volume: 0..2, fadeIn: f, fadeOut: f }
```

Layers are in the format now and get their screens in release 2.

### 3.4 Captions

```ts
Captions = { on: boolean, lang: string, style: CaptionStyle,
             fixes: Record<assetId, Record<wordIndex, string | null>> }   // null hides the word; the index has no leading zeros
CaptionStyle = { font: FontId, weight: number, size: number /* stage px */, color: string,
                 highlight: string | null, dimAhead: 0..1, stroke: { color, w } | null,
                 fill: string | null, uppercase: boolean, maxWords: 1..6,
                 y: 0..1 /* centre of the lines, fraction of the stage height */,
                 width: 0..1 /* widest line, fraction of the stage width */ }
```

Captions are not stored as lines. They are worked out from the words of every main segment and
every `voiceover` sound that can be heard (§5.4), so a trim moves them without any re-transcription.
A fix is keyed by the asset and the word's index, so it survives trims and reorders too.

### 3.5 Closed lists

`FilterId`, `WipeId`, `MotionId` and `FontId` are string unions defined in `src/lib/edit/kit.ts`,
which is versioned with the kit (§5.6). v1:

| List | Members |
|---|---|
| `FilterId` | `vivid` = `saturate(1.25) contrast(1.06)` · `warm` = `sepia(.18) saturate(1.12)` · `cool` = `hue-rotate(-10deg) saturate(1.06) brightness(1.02)` · `mono` = `grayscale(1) contrast(1.08)` · `fade` = `contrast(.9) brightness(1.06) saturate(.85)` · `punch` = `contrast(1.18) saturate(1.1)` |
| `WipeId` | `swipe-blur`, `glitch`, `flare-whip`, `shutter`, `rgb-split`, `datamosh`: pages of OpenFilm's bundled library, copied unchanged. Each has its own fixed length (18, 21 or 24 frames), recorded in `kit.ts`. Only `swipe-blur` and `shutter` take a colour. |
| `MotionId` | `pop`, `fade`, `rise`: how a text comes in or goes out, each 9 frames, drawn by the text page from the film time |
| `FontId` | `inter` |

One font is deliberate. Which fonts, filters and motions the product should offer is a look decision
for part 4, made on mock-ups; it lands as kit v2. A document names its kit (`kit: 'v1'`), so an
edit made with v1 keeps compiling against v1's files; v2 adds a value to that field, not a new
document version.

## 4. Checking a document

- `parseEditSpec(json)`: the zod parse. Unknown keys are an error, and so is an own `__proto__` key
  in `assets` or `captions.fixes` (zod would drop it without a word).
- `checkEditSpec(spec)`: the rules zod cannot say, returned as a list of `{ code, at, message }`:
  every referenced asset exists and is the right kind; an asset's key is its id, a generated asset
  names its generator, a picture has a size and a video or sound a length; every segment and video
  layer fits its file by `minSourceMs` (R3); a sound starts inside its file (it ends when the file
  does); pins name a segment; `fixes` name a word that exists; ids are unique within their list;
  the film is at most 18,000 frames (10 minutes, TikTok's API limit).
- `migrate(json)`: brings an older `v` forward. v1 has nothing to migrate; the function exists so
  the stored documents never need a breaking change.

## 5. The compiler

`src/lib/edit/compile/`. One entry point:

```ts
compile(spec: EditSpec, opts: { file: (asset: Asset) => string }): {
  files: { 'film.html': string; 'captions.vtt'?: string },
  assets: { id: string; file: string }[],     // what must be put in the film folder
  kit: 'v1',
  frames: number,
}
```

`opts.file` returns the path inside the film folder for an asset (`assets/<id>.mp4`). The preview
passes the preview copy, the worker the original (R4); either way the path must be a file directly
under `assets/`, and anything else (a URL, a path that climbs out) is refused, which makes R6 a
property of the compiler and not of its callers. Kit assets are not asked about: they are always at
`kit/<the document's kit>/<path>`. The compiler never reads a file and never looks at the clock: the
same input gives the same bytes. It parses its input against the schema and runs `checkEditSpec`
before anything else, and throws on any problem, so nothing downstream ever sees a film made from a
broken document, typed or not.

### 5.1 Tracks, top first

| Track | Holds |
|---|---|
| captions | `<track kind="captions" src="captions.vtt">`, only when captions are on and there is a cue |
| text 1..n | text items, packed so that no two on a track overlap |
| wipes | the wipe pages |
| layers | layers, stacked by `z`: of two that overlap, the higher is nearer the top; at equal `z` the later in the document is on top (painter's order) |
| main B, then its blur track | the main sequence's upper track, used only when there is a dissolve; each blurred copy for `fit: 'blur'` sits directly beneath its own clip, so picture and fill dissolve together |
| main A, then its blur track | the main sequence |
| sound 1..n | sounds, packed the same way |

Packing (texts, wipes, sounds) is first-fit by start frame; stacking (layers) goes by `z`. Either
way the same items always land on the same tracks.

### 5.2 A segment becomes a clip

- Element `<video>` or `<img>`, `id="seg-<id>"`, `at = frameMs(start) / 1000`,
  `src = "<file>#t=<in>,<out>"` with the source window of §3.2, `speed`, `volume` (`muted` at 0).
  An image has no source window: it is always `#t=0,<length>`.
- Box in stage pixels, from `framing`: `c = max(W / w, H / h)`; box is `round(w × c × zoom)` by
  `round(h × c × zoom)`; `left = round(−(boxW − W) × (1 + x) / 2)`, the same for `top` with `y`.
- `move` becomes `animation: <name> var(--clip-length) linear both`, its keyframes in the film's
  keyframes block. Names are derived from kind and amount, so equal moves share one block.
- `filter` becomes a CSS `filter` in the clip's style. A clip without one takes the edit's look
  filter.
- `fit: 'blur'`: the clip is boxed to show the whole picture, and a second clip of the same source
  window fills the stage on the blur track, with the filter its clip shows followed by
  `blur(40px) brightness(.7)`.

### 5.3 Handing over

- **cut**: clips end to end on main A.
- **fade**: the cut stays on its frame. The outgoing clip runs `len / 2` frames past it and the
  incoming one starts `len / 2` frames before it, each as far as its source allows and never past the
  middle of the neighbouring segment; with no spare
  source on either side it compiles to a cut. Segments then alternate between main A and main B.
  Only the clip on the upper track fades (its `overrides` fade), so the lower one is whole beneath
  it: a true dissolve, not two half-transparent pictures over black. `dip-black` fades the outgoing
  clip out and the incoming one in with no overlap, each over at most half its own segment. A
  clip's fades never exceed its own length (a slowed clip is a few ms short of its frames, R3).
- **wipe**: a kit page on the wipes track, centred on the cut, for the length the page itself has
  (listed per wipe in `kit.ts`), its colour set through `overrides`.

### 5.4 Captions

For each source that can be heard, in film order: take the words whose middle falls inside the
source window; move each to film time (`frameMs(start) + (t0 − inMs) / speed`); apply `fixes`;
group up to `maxWords`, closing a group at a sentence end and at the source's end; a cue runs from
its first word to the earlier of its last word's end, the next cue's start and the source's end;
cues under 120 ms are dropped. A word is made one line first: runs of white space and control
characters become one space, and a word left empty is hidden, as a word fixed to null is. A segment
at volume 0 is not heard, and a voiceover is cut at the film's end, as its clip is. The file carries one `STYLE` block made from `CaptionStyle` (font
from the kit, colours, stroke, the rule that dims words still to come and the rule that colours the
word being said) and one cue per group with a timestamp before every word.

### 5.5 Text, layers, sounds

- A text item is one page clip of `kit/v1/text.html` covering the stage. Its words, style,
  position and motions travel in the clip's `overrides` as text and CSS variables, so editing a
  text changes `film.html` only and applies in place (R5).
- A layer is a `<video>` or `<img>` with its box in stage pixels.
- A sound is an `<audio>` with its window, `volume` and an `overrides` fade; fades longer than the
  clip are scaled down in proportion.

### 5.6 The kit

`public/edit-kit/v1/`: `text.html`, `fonts/`, `wipes/`, `sfx/`, and `NOTICE.md` (Inter under the
SIL Open Font License, its text in `fonts/OFL.txt`, which is the font's own licence file taken
unchanged from its repository; wipes and sounds copied from OpenFilm's library, CC0). A script,
`scripts/build-edit-kit.mjs`, copies the library files from the pinned package; its output is
committed, so nothing at run time depends on `node_modules`. A film folder gets the kit at
`kit/v1/`. A kit version is never edited after an edit has been rendered with it; changes make
`v2`. `kit.test.ts` pins the sha256 of every file under `public/edit-kit/v1/`, so a changed, added
or removed file fails the suite.

## 6. The operations

`src/lib/edit/ops.ts`. `applyOps(spec, ops) → spec` is pure and all-or-nothing: the result must
pass `checkEditSpec`, otherwise it throws `EditOpError { code, index }` and the input is untouched.
Every operation is validated against `OpSchema` before any is applied, typed or not, and the edit is
built from the parsed copies, so neither the document nor the caller's operation objects are ever
changed. `index` is the operation's own index for its refusals and for `invalid`; a refusal from the
checks of the result carries the last operation's index, because those checks judge the whole list.

| Operation | Payload | Notes |
|---|---|---|
| `segment.trim` | `id`, `inMs?`, `len?` | |
| `segment.split` | `id`, `at` (f inside it), `newId` | both halves ≥ 3 frames; the first keeps the id; the second starts where the first's source ends (up to ⌈speed⌉ ms earlier at a file's end, so both halves fit) |
| `segment.remove` | `id` | not the last one; removes what is pinned to it |
| `segment.move` | `id`, `to` (index) | a `to` past the last place is refused as `invalid` |
| `segment.insert` | `segment`, `index` | an `index` past the end is refused as `invalid` |
| `segment.replace` | `id`, `asset`, `inMs` | keeps `len` when the new source is long enough, else shortens |
| `segment.set` | `id`, patch of `speed`, `volume`, `fit`, `framing`, `move`, `filter`, `cutOut`, `beat` | a speed change keeps the source window to within half a frame: the new `len` is rounded to the nearest frame, then shortened if the file has no room, never under 3 frames; a still keeps its `len` |
| `text.add` / `text.set` / `text.remove` | item, or `id` + patch | |
| `layer.add` / `layer.set` / `layer.remove` | the same | |
| `sound.add` / `sound.set` / `sound.remove` | the same | |
| `captions.set` | patch of `on`, `lang`, `style` | |
| `captions.fix` | `asset`, `word`, `text` (string, or null to hide, or absent to undo) | |
| `asset.add` / `asset.words` | asset; or `id` + words | words arrive after transcription; new words drop that asset's caption fixes, which were keyed to the old ones |
| `look.set`, `cover.set`, `ref.set` | their value | |

Undo and versions are snapshots of the whole document, kept by parts 2 and 4. A document is a few
tens of kilobytes, so no inverse operations are needed.

## 7. Tests

All in `src/lib/edit/__tests__/`. Nothing of ours is mocked.

| Test | What it proves |
|---|---|
| `kit.test.ts` | every wipe, sound and font named in `kit.ts` has its file in `public/edit-kit/v1/`; the sha256 of every kit file is pinned |
| `spec.test.ts` | valid documents parse; unknown keys, out-of-range values and unknown versions are refused |
| `check.test.ts` | segments sit end to end; each `checkEditSpec` rule fires on a document that breaks exactly that rule |
| `time.test.ts` | for every frame up to 18,000, `frameMs(f) / 1000 ≤ f / 30`, and consecutive clips never overlap at any speed in range |
| `compile.test.ts` | a fixture document compiles to the expected `film.html` and `captions.vtt` byte for byte; **OpenFilm's own reader (`readFilmFile`) reports no problems**; every cue lies inside its source; two edits of the same document differ only below `<head>`; `filmFaults` (`__tests__/film-rules.ts`) holds each compiled film to the rules the reader does not check: no overlap on a track, no clip past its file, sources only under `assets/` and `kit/v1/`, floored frame times, nothing past the film's end |
| `ops.test.ts` | every operation's effect and its refusals; 500 seeded random sequences of operations each leave a document that passes `checkEditSpec` and compiles with no reader problems and no `filmFaults` |
| `render.test.ts` | **a real render**. ffmpeg makes two two-second clips of flat colour with a tone at test time; a two-segment document with a text, captions from given words and a kit sound compiles into a temporary folder; `render()` draws it at a quarter scale. Asserted from the MP4: frame count equals `total`; the frame before the cut is the first colour and the frame of the cut the second; pixels in the caption area differ from the clip colour while a cue is on; the sound track is not silent |

`render.test.ts` needs `ffmpeg`, `ffprobe` and the headless browser. Where one is missing it is
skipped and says which. This part is not done until it has run green on the development Mac, and
part 2 repeats it inside the worker image.

On this Mac the suite runs with `NODE_OPTIONS=--no-experimental-webstorage` (Node 25).

## 8. Files and dependencies

- New: `src/lib/edit/{spec,time,derive,check,kit,ops}.ts`, `src/lib/edit/compile/{index,html,main,items,captions,keyframes}.ts`,
  `src/lib/edit/__tests__/*` (with the guard `film-rules.ts` and the type shim `render-engine.d.ts`,
  named so because of R7), `public/edit-kit/v1/*`, `scripts/build-edit-kit.mjs`,
  `THIRD_PARTY_NOTICES.md`.
- `openfilm@0.3.2` as an exact dev dependency: the tests use its reader and its renderer, and the
  kit script copies from its library. No app code imports it in this part. Its MIT notice goes into
  the repo's third-party notices.
- No database change, no route, no UI, no change to existing code.

## 9. Decisions taken here

| # | Decision | Alternative rejected |
|---|---|---|
| F1 | A gapless main sequence plus pinned items, not free tracks. | Free tracks are more general and far harder to drive from a phone and from an auto-edit. Free-form pictures still exist as layers. |
| F2 | Captions are derived from words, never stored as lines. | Stored lines go stale on every trim. |
| F3 | Text is one kit page driven by `overrides`. | A generated page per text item would need a file fetch on every edit. |
| F4 | Undo is snapshots. | Inverse operations: more code for no gain at this size. |
| F5 | 30 frames/s and 1080×1920 are fixed in v1. | A free stage multiplies cases nobody asked for; the version field leaves the door open. |
| F6 | Music ducking under speech is not in v1's format. | A field the compiler ignores would be a silent no-op. It arrives with its compiler in a later version. |
| F7 | Whether a clip fits its file is judged by `minSourceMs`, wherever the clip sits. | Judging it at the clip's place: a clip that used its take to the last millisecond made trims and moves of other clips fail. |
| F8 | Layers stack by `z`; at equal `z` the later one in the document is on top. | First-fit packing drew a lower layer over a higher one; earlier-on-top at equal `z` would put a newly added sticker under the b-roll. |
| F9 | A speed change rounds the new length to the nearest frame, then fits it to the file. | Rounding down: repeated changes ate the clip (90 frames became 63 over a 1× to 4× to 1× sweep). |
| F10 | Ids never name a member of `Object.prototype`; `applyOps` and `compile` validate everything they are given. | Trusting typed input: an id of `__proto__` wrote into every object in the process. |
| F11 | A document names its kit. | The newest kit for every edit: an old edit would change its look when kit v2 arrives. |
| F12 | The engine's 1 ms tolerances are not ours: the test guard (`filmFaults`) allows floating-point noise only. | A 1 ms overlap is sampled by a frame, and it is exactly what rounding instead of flooring produces. |
| F13 | A place past the end (`segment.move`, `segment.insert`) is refused, not clamped. | Silent clamping hides a caller's mistake. |

## 10. Open points, with the default taken

- **The dissolve's sound.** Only the upper clip's sound fades; the lower one is heard through the
  overlap. Accepted for v1, since dissolves between two spoken clips are rare.
- **Emoji.** Text renders with the system's emoji: Apple's in an iPhone preview, Noto's in the
  render. Accepted for v1; a shipped emoji font is a kit change.
- **Words of kit sounds and images**: always `null`.

### Still open after the build, by deadline

Sorted by the final review of the branch (2026-11-11). Two dates drive the deadlines: the stored
format is free to change until part 2 stores the first document, and kit v1 freezes at part 2's
first production render. The review reports, with file and line for every item, are kept in
`.scratch/openfilm-spike/part1-reviews/` (gitignored).

**Before part 2 (the worker).**

- The render test is what part 2 re-runs inside the worker image as its proof, and today it proves
  less than it says: any browser launch failure skips it, so Linux's "missing dependencies" would
  pass green (only a missing browser may skip); its level check cannot hear the kit sound (the clip
  tones alone pass); the caption's end is checked at frame 40, not frame 20; the label check passes
  an empty pill; the lines `render()` returns (missing files, links outside the folder) are thrown
  away. No test draws a text motion (`pop`, `fade`, `rise`), and a bug found after the kit freezes
  costs a kit v2.
- Seven rules of `checkEditSpec` have no test that breaks them: a layer's missing pin, missing
  asset and wrong asset kind; a duplicate id among layers, texts and sounds; a sound's missing pin
  and a sound that starts after its file ends.
- The worker image needs Node 22.2 or later (the engine's requirement; the repo pins no Node
  version, so check the Vercel project's too), `fonts-noto` with emoji, and the headless browser of
  the engine's own `playwright-core` (1.61.1). The install command in the plan's Task 7 fails
  because that package hides `cli.js`; this form works:
  `node "$(dirname "$(node -p "require.resolve('playwright-core/package.json', { paths: [require.resolve('openfilm/package.json')] })")")/cli.js" install chromium-headless-shell`
- An asset's `ms` must be no longer than both the original and the preview copy: one `ms` serves
  both (R4), and the engine refuses a window more than 1 ms past a file's end.
- Cap request bodies; about 1 MB covers any real edit.
- `asset.words` drops that asset's caption fixes, so the worker sends words only when they have
  changed; sending the same transcript again would throw the user's fixes away.
- Nothing stops two assets from being given the same file by `opts.file`; the worker names files by
  asset id.
- `compile` throws three kinds of error: the schema's own (`ZodError`) for a document that is not an
  `EditSpec`, `EditSpecError` for a broken rule, and a plain `Error` for a `file` result outside
  `assets/`. The worker tells them apart.
- Compiler output is not versioned: a compiler fix changes how an old document renders again. The
  simplest answer is that a render job stores its compiled film.
- `__tests__/render-engine.d.ts` is an ambient declaration the whole repo sees; move it next to the
  code that imports the renderer.

**Before part 3 (a model emits operations).**

- Kit sounds have no recorded length, and nothing checks a kit asset against the kit: a wrong `ms`
  cuts the sound or makes the engine refuse the clip, and any kit path passes as any kind of asset.
  Record the lengths in `kit.ts` (measured: boom 1600, buzz 900, click 60, ding 1400, drop 1400,
  heartbeat 1600, hit 500, kick 450, notify 800, pop 150, rain 8000, riser 2200, shutter 300,
  swish 350, tick 2000, typing 1750, whoosh-low 1200, whoosh 700, wind 8000, zap 400 ms), add a
  factory for a kit sound, and a check rule: an asset at `{ kit }` names a listed kit file of its
  kind, with the kit's length and `origin: 'kit'`.
- `DEFAULT_TEXT_STYLE`, `DEFAULT_CAPTION_STYLE` and the factories share nested objects; freeze or
  clone them before anything builds documents from them at scale.
- Problem messages become a model's feedback: an asset without `ms` also reports a
  `source-overrun` for everything that uses it, and a video without a size is called "a picture".
- The random test covers 13 of the 23 operation kinds, one operation per list, and draws about half
  its moves and inserts past the end.
- `EditOpError.code` is a plain string and the switch over operations has no exhaustiveness check;
  `applyOps` given something that is not a list throws a `TypeError`.

**Before part 4 (the editor panel).**

- Overlapping texts are packed first-fit by start, so a text added later can sit below an earlier
  one, and changing one text's timing can flip two others. Stack them in document order, as layers.
- Changing an item's `pin` keeps its `at`, so the item jumps; an item pinned to a segment that is
  trimmed shorter than its `at` plays into the next segment. The panel converts, or an operation
  does.
- `speed` and `inMs` set on a still are stored and become live when the segment is replaced by a
  video.
- Kit v2, when the look decision brings it: a document already names its kit and the compiler
  writes that kit's paths, but the schema's closed lists (filters, wipes, motions, fonts) still come
  from the one `kit.ts`, and the kit literal in the schema and `KIT` in `kit.ts` are two places to
  change. They must follow the document's kit.
- There is no `asset.remove`: assets and their transcripts only accumulate, which matters once
  parts are re-filmed (part 5).
- For the live preview: the player reads a caption file once per `src`, so serve the new text and
  call the editor's `captions()`; a dip to black relies on the host page's black background; test
  edits that shift track indices (captions on or off, a dissolve added mid-film, a second
  overlapping text) against a fresh load; `public/edit-kit/v1/` never changes, so it can be served
  with immutable cache headers.

**Accepted as they are.**

- A split restarts a `move` on both halves: v1 cannot carry one move across two clips.
- A speed change that would leave under 3 frames keeps 3, and so takes more source.
- Repeated speed changes can wander by a frame of rounding; a continuous control applies its speed
  to the edit as it was before the gesture.
- A voiceover over speech interleaves the cues of both, and a word can keep a timestamp past its
  cut cue (a release-2 path; the engine's caption reader tolerates it).
- `cover.set` past the film's end is accepted; whoever reads the cover clamps it.

