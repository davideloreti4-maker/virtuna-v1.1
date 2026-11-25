# Custom animations in the editor: design

2026-11-25. Follows the editor's screens (`2026-11-24-editor-screens-design.md`). The owner's direction,
in his words: "just the standard ugc instagram and tiktok but also the ability to do more", and on the
trial film of 2026-11-24: "pretty nice".

## 1. What a creator gets

The first cut stays what it is today: the standard look (cuts, captions, a label). Nothing animated is
added unless the creator asks.

Then, in the same editor and the same field:

- **Ask in words.** "When I say ten thousand, count up to it." "Show the three steps as a list while I
  name them." With slice B's moment: pause the video and write "an app icon here".
- **Or pick a proposal.** A chip "Animate a moment" opens two to four proposals made from what was said
  (a number that is spoken, a list that is named, a product or a name, the last line as an end card).
  Each names the moment and what would be drawn. One tap makes it. Proposals cost one cheap text call
  and are made once per cut.
- **Wait, told how long.** "Drawing it…", then "Checking it on your video…". The field is held as for
  any change.
- **See it.** The video goes to the animation's first frame and plays it. One line says what was added
  and where. Chips under it: "Bigger", "Move it", "Another style", "Remove it". Undo takes it away.
- **Export.** The file shows the same frames as the preview.

What the creator never does: choose a template, set keyframes, place boxes.

## 2. Decisions

| | Decision | Why |
|---|---|---|
| A1 | No animation by default. | The owner's word; the typical self-edited short is a plain cut with captions. |
| A2 | An animation is one **scene**: a graphic for one moment, 0.6 to 6 s, written by the model as HTML + CSS + inline SVG with no script. | The trial: such a scene renders the same bytes twice and the same picture in two browser engines. |
| A3 | A scene is a kit part: `item.add {part: "scene"}` on the edit, through the door, stored in the turn's document like every other change. | Undo, Redo, the export, the chat card and the review then need nothing new. |
| A4 | One scene on stage at a time. At most 6 a film. Scenes that shrink the speaker cover at most 40 % of the film, and never more than 6 s in a row. | The trial's worst fault: three requests in a row left the speaker a small tile for most of the film. Products in the field space their graphics 8 s apart. |
| A5 | Three places, chosen by the model per scene: `over` (speaker full, graphic beside or below the face), `lower` (speaker lower and smaller, graphic above the head), `tile` (speaker a small tile, graphic takes the stage). | The trial's layouts. A close-up has no free room above the head, so "above my head" needs `lower`. |
| A6 | Behind a `lower` or `tile` scene the ground is the take's own picture, blurred and dimmed, drawn by the film. A scene does not paint a full-stage colour. | The trial's flat dark ground with a purple accent is the look creators call generic. |
| A7 | A scene takes its accent colour and its font from the edit's captions. The contract bans: gradients on text, purple-to-blue grounds, glow, bounce, typewriter text unless asked for, a graphic on every sentence, text under 40 px. | One style per film. The bans are the tells named by creators and viewers. |
| A8 | The area to keep clear is the face box grown upward by 35 % of its height (the hair), the apps' buttons, the captions and the label. | The trial: the code check passed a window that lay on the hair. |
| A9 | Every scene goes through a look-and-fix loop that needs no person: write, clean, check by code, draw five frames, the model looks at them with the code's faults, fix. Two fix rounds at most. | The trial: no arm got it right blind, and each got close once it was shown its frames. |
| A10 | A scene with a hard fault after the loop is not added, and the creator is told so in one sentence. A scene with a soft fault is added and shows under "N to check". | A half-broken graphic in a film is worse than none. |
| A11 | Which model writes and looks is decided by a trial with numbers (section 5), not by name. Ordinary changes stay on the model they use today. | The trial: the product's fast model made 1 of 3 good; the next one up 2 of 3, and only from fault lists a person wrote. |
| A12 | The scene text is treated as hostile: an allow-list cleaner runs when the change is applied and again when it is drawn; it is drawn in a closed shadow root; no script, no link, no outside file. | Model-written markup runs in the creator's browser and in the render. |
| A13 | Limits on how many scenes a creator may have made per day are part of opening the editor to users, which the owner keeps open. Until then only accounts on the editor's list can use it, and the per-film limit of A4 holds. | The owner, 2026-11-25. |

## 3. How it works

### 3.1 The scene part

A new item part beside `title`, `callout`, `progress`, `cutaway`, `sound`:

```ts
z.strictObject({ ...item, part: z.literal("scene"), props: SceneProps })

const SceneProps = z.strictObject({
  html: z.string().min(1).max(20_000),        // one <style>, then one root <div>; cleaned before it is stored
  layout: z.enum(["over", "lower", "tile"]),
  label: z.enum(["keep", "hide"]),            // whether the cut's label fades while the scene is on
  why: z.string().max(200),                   // the model's one sentence, for the review and the answer
});
```

Timing is the item's own (`anchor`, `at`, `frames`), 18 to 180 frames. The edit's document version stays
1: the part is new, nothing existing changes, and an edit without scenes reads as before.

### 3.2 Drawing it, the same in the preview and in the file

The film draws scenes between the footage and the cut's text. For each scene on stage: a closed shadow
root holds the cleaned markup over a 1080 by 1920 box; every animation is held paused; on each frame the
film sets each animation's time to `(frame - scene's first frame) / 30` seconds. The animations are
collected once, when the scene is mounted, because one that has run out is no longer listed.

For `lower` and `tile` the film moves the speaker over the scene's first 8 frames and back over its last
8, and draws the blurred ground. Two scenes that touch pass the speaker straight from one place to the
next.

The trial's host (`.scratch/motion/trial/host/`) is the starting point; it moves into the kit with its
own tests: the same frame drawn twice is the same bytes; a frame asked for after a later one is right.

### 3.3 The cleaner

One pure function, used by the door and by the film. It keeps: `div span p b i em strong br style` and
the SVG shapes, gradients, clip paths, masks and text; class, id, style, `data-` and the SVG drawing
attributes. It removes without a word: every other tag, every `on…` attribute, `@import`, `@font-face`,
`url()` other than `url(#id)` and `url(data:image/…)`, `position: fixed`, `transition`, and
`animation-play-state`. A scene whose cleaned text differs from what was sent is still accepted; one
that is empty after cleaning is refused. Its tests are a list of hostile inputs.

### 3.4 What the model is given

The trial's contract (`.scratch/motion/trial/contract.md`) with A6, A7 and A8 written in, and the film's
facts filled in by code: the words with their film times, the boxes to keep clear per time range, the
caption look's colour and font, the scenes already in the film, and the moment when the request has one.
The model answers with one scene: start, length, layout, markup, one sentence why.

### 3.5 The loop

1. **Write.** One call.
2. **Clean** (3.3) and **check by code**: every readable box is on the stage and clear of the boxes to
   keep clear on every frame it is visible; text is at least 40 px; every element is visible on at
   least one frame; the scene starts no later than 0.2 s after the word it is for and ends inside the
   film; A4 holds. The boxes come from the worker's browser, not from reading the CSS.
3. **Draw** five frames of the film with the scene (the worker's existing stills call).
4. **Look.** The same model gets the five frames and the code's faults, and either says "good" or
   returns a corrected scene. Back to 2.
5. After two fix rounds: hard faults (off the stage, on the face or hair, unreadable, never visible,
   on the captions) mean the scene is not added. Anything else is added with a finding.

The whole loop is one turn of the edit. Its wait is told in the page as slice A tells the others.

### 3.6 The agent's part

The edit agent gets one more tool, "make a scene", which it calls with the creator's request, the
moment if there is one, and the words it is for. The loop above runs behind that tool. A request that
is not about a graphic never reaches it. "Bigger", "Move it" and "Another style" call it again with the
scene in place and the wish; "Remove it" is `item.remove` with no model.

## 4. What it does not do yet

- Text or pictures **behind** the speaker (needs the person cut out on every frame).
- The creator's own pictures in a scene: a screenshot of their app, a logo, a product photo. This is
  the second most wanted kind in the field and is the next slice: an uploaded image becomes an asset
  and a scene may name it.
- Sound on a scene's entrance. Also the next slice: every source says a graphic needs one.
- Stock or generated footage, charts from a data file, 16:9.
- A style taught from the creator's reference videos. First the caption look's colour and font (A7).

## 5. What must be measured before a plan is written

The first trial showed the technique works and that it does not work blind. It did not show that a
model can run the loop alone. That is the one thing to find out, on real takes, before any of section 3
is built.

**Trial 2: the loop with no person in it.**

- The trial's host and contract, with A6, A7 and A8 added and step 2's checks written as code.
- Twelve requests on two takes, covering the kinds creators ask for most: a counter, a list that
  builds, an app or product named, a key phrase, an end card, a small diagram; three of them with a
  paused moment and "here".
- Arms: each model the app has a key for that can look at pictures, and, as a yardstick only, one run
  with a model of the next class up through a helper. The loop is identical for all arms.
- Judged from the rendered frames against a written list, by someone who did not write the scenes:
  clear of face and hair; readable at a third of the size; on the word within 0.2 s; gone before the
  next thought; not the generic look; the speaker not small for more than 6 s.
- Measured per scene: rounds, seconds from request to done, cents.

**The bar:** nine of twelve good after at most two automatic rounds, half of them in under 60 s, under
5 cents each. An arm that meets it is the product's scene model. If none does: the numbers, the
yardstick's numbers and what its key would cost go to the owner, and nothing is built on hope.

## 5b. Trial 2: what it found (2026-11-25)

Twelve requests on two takes, the loop of 3.5 with no person in it, frames drawn on this Mac. Judged from the frames by
the controller, who wrote none of the scenes. The whole trial cost $1.12.

| Arm | How it ran | No hard fault by code | Good by eye | Seconds a scene | Cents a scene |
|---|---|---|---|---|---|
| Qwen 3.7 flash (the app's model today) | automatic | 3 | 0 | 46 | 0.1 |
| Qwen 3.7 plus | automatic | 5 | 4 | 67 | 1.3 |
| Qwen 3.8 max (the provider's best) | automatic | 8 | 5 to 6 (its own builder said 8) | 58 | 5.4 |
| Gemini | not run: the key in this worktree is refused | | | | |
| Claude Haiku 5.5 | by hand, blind | 11 | 8, and 2 borderline | not measured | not measured |
| Claude Sonnet 5.5 | by hand, blind | 12 | 10 to 11 | not measured | not measured |
| Claude Opus 5.5 | by hand, 4 requests, by the trial's builder | 4 of 4 | 4 of 4 | not measured | not measured |

"By hand, blind" means a fresh helper of that class, which had seen nothing of the trial, was given exactly what the
automatic arms got (the filled contract, the code's faults, the five frames) and ran the same steps with the same limit of
two fix rounds. It is evidence of quality, not of time or cost: those need a run through the provider's API, and the app
has no key for it.

What the frames show:
- **No model the app can pay for today meets the bar.** Qwen's best makes small, timid graphics, cannot make a counter
  that counts, draws words over each other and on hair.
- **The Claude arms do.** A counter that reaches its number and holds, a list that builds on each word with its marks, a
  key phrase that builds word by word, an end card with a button, a drawn shelf with an arrow. The middle tier keeps the
  speaker large (it chose the small tile twice in twelve); the cheapest tier chose the tile eight times and failed the
  list's marks and the arrow.
- **The look step works for a model that can see.** The Claude arms fixed what they saw (an exit that collided with the
  returning label, a word cut off, an unreadable dark card); the Qwen arms mostly did not repair from the same frames.

What changes in this design:
- **A11 is decided in kind:** the scene writer is a Claude model. Which tier is the default is decided by a measured run
  once a key exists (list prices put a scene at well under a cent on the cheapest tier and at several cents on the
  middle one: estimates, not measurements). The app needs a key for it; that is the owner's to create.
- **The loop keeps the best round by the code check, not the last,** and looks once more after the last fix (the trial's
  builder found every run ended on a fix nobody had looked at).
- **The check gains:** scene text over scene text; hair to the sides of the face, not only above it; shapes, not only
  text, under the apps' buttons; a least size for the main graphic.
- **A4 gains a default:** on a close-up the speaker stays large (`over` or `lower`); `tile` only when the graphic needs
  the stage.
- **A7 holds and showed a cost:** one arm drew a white badge where gold was asked for, because the film's style allowed
  only its own colours. A request that names a colour wins over the style.

## 6. Order of work

1. Trial 2 (section 5). No change under `src/`.
2. The scene part: the schema, the cleaner, the film's drawing, the door, the code checks. Proved by a
   scene written by hand that plays in the page and is in the exported file.
3. The loop and the agent's tool, the waits, the answer and its chips.
4. Proposals ("Animate a moment").
5. Next slices, each with its own design: the creator's pictures, sound, a style from references.

Piece 2 does not wait for the trial's result in full: the part, the cleaner and the drawing are needed
whichever model wins. Pieces 3 and 4 start only when an arm has met the bar.

## 7. Risks

- **No model the app can pay for meets the bar.** Then the feature is not offered; the part and the
  cleaner stay for scenes made by hand (templates of our own) and the question of a stronger model's
  key goes to the owner with its price per scene.
- **Sameness.** One contract makes one look. A7 ties the look to each film's captions; a style from the
  creator's references is the real answer and comes later.
- **Time.** A loop of three calls and two drawings can pass a minute. The wait must say so, and a
  proposal tapped must not hold the field longer than a first cut does.
- **Hostile markup.** The cleaner is the only wall; its test list is reviewed like a security change.
- **The preview on a phone.** A scene with many animations must not make the player stutter; trial 2
  counts animations per scene and the first build measures the player's frame time on a phone.
