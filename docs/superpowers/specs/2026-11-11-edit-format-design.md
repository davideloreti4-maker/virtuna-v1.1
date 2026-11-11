# Design — auto-edit part 1: the edit format, its compiler and its operations · 2026-11-11

Part 1 of five. The map, the owner rulings (D1 to D8) and the measurements are in
`2026-11-11-auto-edit-overview-design.md`; this document does not repeat them.

**Status when written:** branch `feat/openfilm-edit` = `main` = `0efcddd6`. No product code exists.
Everything below is new code under `src/lib/edit/` and `public/edit-kit/`.

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
| R3 | A clip never takes more source than its length allows: source used = `floor(length × speed)` ms. | A too-long clip overlaps the next one on its track, which the film format rejects; a 1 to 2 ms gap is never sampled by a frame. |
| R4 | One compiler for preview and render. The only input that differs is which file stands for each asset. | The preview must show what the render makes. |
| R5 | The film's `<head>` is identical for every edit except the keyframes block. Clip ids are the spec's ids. | The in-page player applies a changed film in place only when the head is unchanged and clips keep their ids (11 to 33 ms instead of a reload). |
| R6 | A film references only files inside its own folder: assets and the kit. | Renders make no network connection; that property is ours to keep. |
| R7 | No identifier, file or folder is named after OpenFilm. | Its trademark terms. |

## 3. The document

`src/lib/edit/spec.ts` holds the zod schema and the inferred types. Frames are `f`, milliseconds
are `ms`, ids are short strings unique inside the document.

```ts
EditSpec = {
  v: 1,
  stage: { w: 1080, h: 1920, fps: 30 },          // fixed in v1
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
| `at` | `{ bucket, path }` or `{ kit: string }` | the original in storage, or a path inside the kit |
| `ms` | number, video and audio | its length |
| `w`, `h` | number, video and image | pixels as shown, after rotation |
| `sound` | boolean | whether it has a sound track |
| `words` | `{ t0: ms, t1: ms, text }[] \| null` | its transcript, in its own time; `null` until transcribed or when nothing is said |

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
(R2, R3). It must fit inside the asset.

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
             fixes: Record<assetId, Record<wordIndex, string | null>> }   // null hides the word
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
for part 4, made on mock-ups; it lands as kit v2 without touching the format.

## 4. Checking a document

- `parseEditSpec(json)`: the zod parse. Unknown keys are an error.
- `checkEditSpec(spec)`: the rules zod cannot say, returned as a list of `{ code, at, message }`:
  every referenced asset exists and is the right kind; every source window fits its asset; pins
  name a segment; `fixes` name a word that exists; the film is at most 18,000 frames (10 minutes,
  TikTok's API limit).
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
passes the preview copy, the worker the original (R4). Kit assets are not asked about: they are
always at `kit/v1/<path>`. The compiler never reads a file and never looks at the clock: the same
input gives the same bytes. It runs `checkEditSpec` first and throws `EditSpecError` on any
problem, so nothing downstream ever sees a film made from a broken document.

### 5.1 Tracks, top first

| Track | Holds |
|---|---|
| captions | `<track kind="captions" src="captions.vtt">`, only when captions are on and there is a cue |
| text 1..n | text items, packed so that no two on a track overlap |
| wipes | the wipe pages |
| layers | layers, highest `z` first, packed the same way |
| main B, then its blur track | the main sequence's upper track, used only when there is a dissolve; each blurred copy for `fit: 'blur'` sits directly beneath its own clip, so picture and fill dissolve together |
| main A, then its blur track | the main sequence |
| sound 1..n | sounds, packed the same way |

Packing is first-fit by start frame, so the same items always land on the same tracks.

### 5.2 A segment becomes a clip

- Element `<video>` or `<img>`, `id="seg-<id>"`, `at = frameMs(start) / 1000`,
  `src = "<file>#t=<in>,<out>"` with the source window of §3.2, `speed`, `volume` (`muted` at 0).
  An image has no source window: it is always `#t=0,<length>`.
- Box in stage pixels, from `framing`: `c = max(W / w, H / h)`; box is `round(w × c × zoom)` by
  `round(h × c × zoom)`; `left = round(−(boxW − W) × (1 + x) / 2)`, the same for `top` with `y`.
- `move` becomes `animation: <name> var(--clip-length) linear both`, its keyframes in the film's
  keyframes block. Names are derived from kind and amount, so equal moves share one block.
- `filter` becomes a CSS `filter` in the clip's style.
- `fit: 'blur'`: the clip is boxed to show the whole picture, and a second clip of the same source
  window fills the stage on the blur track with `filter: blur(40px) brightness(.7)`.

### 5.3 Handing over

- **cut**: clips end to end on main A.
- **fade**: the cut stays on its frame. The outgoing clip runs `len / 2` frames past it and the
  incoming one starts `len / 2` frames before it, each as far as its source allows; with no spare
  source on either side it compiles to a cut. Segments then alternate between main A and main B.
  Only the clip on the upper track fades (its `overrides` fade), so the lower one is whole beneath
  it: a true dissolve, not two half-transparent pictures over black. `dip-black` fades the outgoing
  clip out and the incoming one in with no overlap.
- **wipe**: a kit page on the wipes track, centred on the cut, for the length the page itself has
  (listed per wipe in `kit.ts`), its colour set through `overrides`.

### 5.4 Captions

For each source that can be heard, in film order: take the words whose middle falls inside the
source window; move each to film time (`frameMs(start) + (t0 − inMs) / speed`); apply `fixes`;
group up to `maxWords`, closing a group at a sentence end and at the source's end; a cue runs from
its first word to the earlier of its last word's end, the next cue's start and the source's end;
cues under 120 ms are dropped. The file carries one `STYLE` block made from `CaptionStyle` (font
from the kit, colours, stroke, the rule that dims words still to come and the rule that colours the
word being said) and one cue per group with a timestamp before every word.

### 5.5 Text, layers, sounds

- A text item is one page clip of `kit/v1/text.html` covering the stage. Its words, style,
  position and motions travel in the clip's `overrides` as text and CSS variables, so editing a
  text changes `film.html` only and applies in place (R5).
- A layer is a `<video>`, `<img>` or kit page with its box in stage pixels.
- A sound is an `<audio>` with its window, `volume` and an `overrides` fade.

### 5.6 The kit

`public/edit-kit/v1/`: `text.html`, `fonts/`, `wipes/`, `sfx/`, and `NOTICE.md` (Inter under the
SIL Open Font License; wipes and sounds copied from OpenFilm's library, CC0). A script,
`scripts/build-edit-kit.mjs`, copies the library files from the pinned package; its output is
committed, so nothing at run time depends on `node_modules`. A film folder gets the kit at
`kit/v1/`. A kit version is never edited after an edit has been rendered with it; changes make
`v2`.

## 6. The operations

`src/lib/edit/ops.ts`. `applyOps(spec, ops) → spec` is pure and all-or-nothing: the result must
pass `checkEditSpec`, otherwise it throws `EditOpError { code, index }` and the input is untouched.

| Operation | Payload | Notes |
|---|---|---|
| `segment.trim` | `id`, `inMs?`, `len?` | |
| `segment.split` | `id`, `at` (f inside it), `newId` | both halves ≥ 3 frames; the first keeps the id |
| `segment.remove` | `id` | not the last one; removes what is pinned to it |
| `segment.move` | `id`, `to` (index) | |
| `segment.insert` | `segment`, `index` | |
| `segment.replace` | `id`, `asset`, `inMs` | keeps `len` when the new source is long enough, else shortens |
| `segment.set` | `id`, patch of `speed`, `volume`, `fit`, `framing`, `move`, `filter`, `cutOut`, `beat` | a speed change keeps the source window and changes `len` |
| `text.add` / `text.set` / `text.remove` | item, or `id` + patch | |
| `layer.add` / `layer.set` / `layer.remove` | the same | |
| `sound.add` / `sound.set` / `sound.remove` | the same | |
| `captions.set` | patch of `on`, `lang`, `style` | |
| `captions.fix` | `asset`, `word`, `text` (string, or null to hide, or absent to undo) | |
| `asset.add` / `asset.words` | asset; or `id` + words | words arrive after transcription |
| `look.set`, `cover.set`, `ref.set` | their value | |

Undo and versions are snapshots of the whole document, kept by parts 2 and 4. A document is a few
tens of kilobytes, so no inverse operations are needed.

## 7. Tests

All in `src/lib/edit/__tests__/`. Nothing of ours is mocked.

| Test | What it proves |
|---|---|
| `kit.test.ts` | every wipe, sound and font named in `kit.ts` has its file in `public/edit-kit/v1/` |
| `spec.test.ts` | valid documents parse; unknown keys, out-of-range values and unknown versions are refused |
| `check.test.ts` | segments sit end to end; each `checkEditSpec` rule fires on a document that breaks exactly that rule |
| `time.test.ts` | for every frame up to 18,000, `frameMs(f) / 1000 ≤ f / 30`, and consecutive clips never overlap at any speed in range |
| `compile.test.ts` | a fixture document compiles to the expected `film.html` and `captions.vtt` byte for byte; **OpenFilm's own reader (`readFilmFile`) reports no problems**; every cue lies inside its source; two edits of the same document differ only below `<head>` |
| `ops.test.ts` | every operation's effect and its refusals; 500 seeded random sequences of operations each leave a document that passes `checkEditSpec` and compiles with no reader problems |
| `render.test.ts` | **a real render**. ffmpeg makes two one-second clips of flat colour with a tone at test time; a two-segment document with a text, captions from given words and a kit sound compiles into a temporary folder; `render()` draws it at a quarter scale. Asserted from the MP4: frame count equals `total`; the frame before the cut is the first colour and the frame of the cut the second; pixels in the caption area differ from the clip colour while a cue is on; the sound track is not silent |

`render.test.ts` needs `ffmpeg`, `ffprobe` and the headless browser. Where one is missing it is
skipped and says which. This part is not done until it has run green on the development Mac, and
part 2 repeats it inside the worker image.

On this Mac the suite runs with `NODE_OPTIONS=--no-experimental-webstorage` (Node 25).

## 8. Files and dependencies

- New: `src/lib/edit/{spec,time,derive,kit,ops}.ts`, `src/lib/edit/compile/{index,tracks,clips,handover,captions,keyframes}.ts`,
  `src/lib/edit/__tests__/*`, `public/edit-kit/v1/*`, `scripts/build-edit-kit.mjs`.
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

## 10. Open points, with the default taken

- **The dissolve's sound.** Only the upper clip's sound fades; the lower one is heard through the
  overlap. Accepted for v1, since dissolves between two spoken clips are rare.
- **Emoji.** Text renders with the system's emoji: Apple's in an iPhone preview, Noto's in the
  render. Accepted for v1; a shipped emoji font is a kit change.
- **Words of kit sounds and images**: always `null`.
