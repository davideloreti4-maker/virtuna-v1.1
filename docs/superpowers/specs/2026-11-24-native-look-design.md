# The native look (edit tool, the plan after the agent)

**Status:** the default change (3.1, with the lighter weights of 3.2) was approved by the owner on 2026-11-24 ("Yes,
change it"; scope "Default only"); it is built from `docs/superpowers/plans/2026-11-24-native-default.md`. The rest
(3.2 to 3.7) waits for his next word.

## 1. Why this plan exists

Part 3 built an agent that makes a first cut and changes it on request. Its numbers are good and its default look is
wrong. The house style ruled on 2026-11-23 (bold white captions, three words a page, the said word in yellow, eight
punch-ins a minute) is the template look of clipping tools. None of the owner's five approved references use it, and
2026 sources call it dated.

A first draft of this plan listed what the video framework ships (sound effects, emoji, lower thirds, end cards, more
cuts). The owner asked whether that was trash. Checked against evidence, most of it was. This plan is built from the
evidence instead.

**Goal:** a first cut that reads as made by a person in TikTok's or Instagram's own editor, and the looks the owner's
references use, on the kit we have.

**Not the goal:** more things on screen.

## 2. Evidence

Four sources, in the order they are trusted. The files are in `.scratch/tool-belt/` (git-ignored).

### 2.1 The owner's five approved references (strongest)

What each uses, seen on the side-by-side sheets of Task 14. No creator, link or on-screen word is named here.

| Reference | What it uses | How close our styled cut came |
|---|---|---|
| 1 | Thin white sentence captions in the empty space above the head. One custom graphic with a hand-drawn red circle and arrow. A punch-in at a cut. | Partly. Ours are heavier and sit on the hair. |
| 2 | A small red tag above an outlined all-caps headline, both staying. Small typed-on captions with a block cursor, on the chest. | Weak. No tag, no outline headline, no typed-on. |
| 3 | A white label with dark letters that stays. White sentence captions. | Fairly alike. Our captions are smaller. |
| 4 | A two-line white label that stays, in the app's own box shape. White outlined captions in two short rows. | The most alike. Our label is one small pill, our captions 47 px for 65. |
| 5 | B-roll photos, a cut a second, large display-serif words two or three at a time. | Not alike. No pictures, no serif. |

None of the five shows emoji, a lower third, an end card, a cut other than a hard cut, or bold word-by-word captions.
Sound was never analysed in a reference.

### 2.2 What creators, editors and the platforms do in 2026 (`organic-style.md`)

All of its data is correlational, mostly from brand accounts. No video was watched and Reddit could not be reached.

- **Core:** a hook line as text in the first second; clean one-to-two-line captions, white with a dark outline or
  box, one typeface, a stable place above the apps' buttons; pauses removed; one plain sans close to the app's own.
- **Useful:** text styled like the app's own tool; one highlighted keyword; a picture popping up as proof near
  second 3; punch-ins used sparingly; a one-line call to action at the end.
- **Core for explainers and commentary:** green screen (the speaker in front of a screenshot or photo).
- **Dated:** bold colour word-by-word captions; emoji in captions or as stickers; a whoosh on every cut; cuts other
  than a hard cut; designed end cards.
- **Avoid:** music baked into the file; another app's watermark; one word at a time as the main captions; a slick
  grade or smoothed skin.
- **Thin evidence either way:** arrows and circles, typed-on text, sound effects, zooms, progress bars.

### 2.3 Open source and Remotion's own parts (`open-source.md`, `research.md`)

- Usable: `@remotion/rounded-text-box` (the app-style merged text box, pure geometry, runs on the server); a BSD-3
  path routine for the same shape; `roughjs` and `perfect-freehand` (MIT) for hand-drawn marks that compute without a
  browser; openly licensed typefaces (TikTok Sans, Instrument Serif, Jost, Nunito, Courier Prime).
- Not usable: Remotion Elements (no licence stated); 25 of the 32 sounds in Remotion's sound pack; 12 of its 21
  transitions (they do not run in Safari); emoji drawn as text (the phone's emoji font differs from the render's).

### 2.4 Our own code (`seams.md`)

The limits that stand between the kit and those looks:

- Caption weights are 800 and 900 only, title weights 700 and 800. Native captions are lighter.
- Every first-cut title is set in TikTok Sans whatever the style. A style from words cannot change the typeface.
- The widths script refuses a font without a weight axis, which rules out most display serifs.
- A label is one pill round the whole text, not the app's box shape.
- One title at a time: a tag above a headline is an error today.
- A caption page is whole on its first frame: typed-on has no way in.
- One captions place for the whole film: a take whose framing changes ends with captions on the mouth.
- The catalogue the model reads is at 20,655 of its 21,000-character guard.

## 3. What gets built

Six parts, in build order. Each is proven the way part 3 was: tests on the real code, the preview-against-render
proof in Chromium and WebKit, and a sheet judged by eye against the reference it comes from.

### 3.1 The default changes

The house style becomes what references 3 and 4 show. It changes every video and needs little new code: the lighter
weight of 3.2, and until 3.3 is in, the label keeps today's pill shape.

| | Today | New |
|---|---|---|
| Captions | Bold, 96 px, three words a page, the said word in yellow | Plain white with a dark edge, 64 px, weight 600, phrase pages of one or two rows, no colour |
| Hook | Bold white-and-yellow title, 130 px, gone after 2.5 s | A white label with dark letters, in the clear space above the face, staying through the film |
| Punch-ins | 8 a minute at 1.15 | At most 4 a minute at 1.10, only at a cut that tightening made |
| Colour look | The model chooses | Natural, unless a style asks |
| Hook wording | Five words on what the video is about | Up to eight words, a claim or a direct statement, never a question |

Sizes are judged by eye on a sheet at three sizes before they are fixed; 64 px is where the judging starts
(references 3 and 4 measure 65).

A first mock on the owner's take (2026-11-24, `.scratch/native-look/`, today's code with a custom profile) showed the
direction is right and four things still read as a subtitle tool. They are part of this change:

- **Short rows before small letters.** Asked for 64 px with eight-word pages, the code kept the words and shrank the
  letters to 54 px, in one row from edge to edge. On a close-up there is room for one row only. The fit is turned
  round: first fewer words a page (a row of about four or five words), only then smaller letters. And a larger size
  asked never ends smaller than a smaller size asked (72 px came out at 52, under 64's 54).
- **The words' spacing.** Plain captions use the typeface's own space between words; the wide gap of the word-by-word
  looks stays with those looks.
- **The edge.** Plain captions get a thinner dark edge than the bold looks.
- **The label.** About 1.3 times the captions' size, as in reference 4; the mock's label at the captions' size reads
  as too small.

It also showed what no setting fixes: the owner's take is a close-up with nothing above the head and little under the
mouth, so the label sits on hair and the captions sit at the chin. The references leave that room when they film.
That is advice for the capture step (part 5), recorded here.

### 3.2 Lighter type, and two typefaces

- Width tables for weights 400, 500 and 600 of the three typefaces the kit has. Captions and titles take their
  weight from the style.
- The widths script accepts a font without a weight axis.
- Two typefaces are added, each because a reference uses its kind: **Instrument Serif** (reference 5; Open Font
  Licence, checked) and **Jost** (the light geometric captions of reference 1; believed Open Font Licence, to be
  confirmed from its repository before it is added, else it is left out). Both self-hosted, licence file beside the
  font.
- A title's typeface comes from the style. A style from words can name a typeface.

A typewriter face and a rounded face are not added: no reference uses one.

### 3.3 The app's own text shapes

- **The merged box.** A label, and captions on a box, are drawn in the app's shape: each row its own width, the
  joins rounded. The shape is computed by the same function in the kit and in the review.
- **An outlined headline.** A title look with white letters and a dark edge, no box, with capitals as an option.
- **A tag.** A title may carry a small coloured tag above it (white, black or red). The tag belongs to the title,
  so the rule of one title at a time stands.

### 3.4 Typed-on captions

A captions setting: the letters of a page appear in place across the time its words are spoken, with a block cursor
after the last one. The page is laid out whole from its first frame, so no letter moves and the review judges the
same box as today.

### 3.5 Placement

- **Captions get a place per run of shots.** Shots framed alike share one place; a run framed differently gets its
  own. Within a run the place does not move. "Framed alike" is measured from the face boxes (their centre and
  height); the threshold is set in the plan on the two takes we have and named as resting on two takes.
- **Above the head.** Only faces are measured, not hair, so "above the head" means above the face's top by half
  the face's height, and below the apps' top bars. When that band holds two rows, a style may put the captions
  there (reference 1). When it does not, they sit under the mouth and the say tells the creator why.
- **The label** prefers the clear space above the head. It may sit on hair. It never sits between the brow and the
  lower lip.

### 3.6 The styles a creator picks from

Seven, each named in a creator's words. Four come from a reference.

| Style | What it is | From |
|---|---|---|
| Label (the default) | A white label that stays, clean captions | References 3, 4 |
| Top line | Thin captions above the head, no label | Reference 1 |
| Headline | A red tag, an outlined headline that stays, small typed-on captions | Reference 2 |
| Serif | Large serif words, two or three at a time | Reference 5 |
| Boxed | Captions on the app's box | The apps' own caption styles |
| Key words | Clean captions, one coloured key word a page | Rated useful in 2.2 |
| Bold pop | Today's default | Kept, offered last |

One word, Highlighter and Mono leave the picker. Their looks stay reachable by asking in words.

The reading of a reference maps to these: a staying label, a tag above a headline, an outlined headline, typed-on
rows (a row that grows while its left edge holds), the weight of the letters, and serif or sans (the model picks
from a closed list on the sheet).

### 3.7 The agent

- The catalogue's length guard is a cost guard. Stale text is cut first; the guard is then raised only by what the
  new entries need, and the proof's median time and cost per change must stay within 10 % of today's (1.4 s,
  0.039 c).
- The requests of the proof grow by the new abilities: typed-on, a tag, an outlined headline, a label that stays or
  shows only at the start, captions above the head, a typeface by name.
- Two refusals say something useful. Music: "Add your sound in TikTok or Instagram when you post. Music inside the
  file can get the video muted." A sound effect: the kit has none, said plainly.

## 4. What is not built, and why

| Not built | Why |
|---|---|
| Emoji in captions or as stickers | Dated in 2.2; in no reference; drawn as text they differ between phone and render. |
| Lower thirds, designed end cards | In no reference; end cards dated; lower thirds only fit guest clips. |
| More cuts | Hard cuts are the native look; 12 of Remotion's 21 do not run in Safari. |
| A whoosh on cuts, meme sounds | Named as a mark of templated video; most of Remotion's pack is not freely licensed. |
| Music in the file | Muting and reach risk; the apps add it better. |
| More colour looks or effects | "The professional look becomes the tell." |
| A typewriter or rounded typeface | No reference uses one. |
| Remotion Elements' source | No licence stated. |

## 5. The plan after this one: pictures

Recorded here so the order is clear; it gets its own spec.

- A picture popping up over part of the frame as proof (a screenshot, a result).
- B-roll photos and clips with words over them (reference 5 in full).
- A hand-drawn circle and arrow pointing at a picture (reference 1).
- Green screen, first as a picture above the speaker, later as a true cut-out.

It needs what this plan does not touch: uploads of images, more than one picture on stage, and a cut-out model on the
worker.

## 6. How it is proven

- **By eye, against the references.** A side-by-side sheet per reference at three moments. The bar: references 1
  to 4 read as the same kind of video. Reference 5 waits for pictures.
- **Part 3's gates hold.** The requests proof at or above its numbers on both takes; no review error on a first cut;
  every new look and part in the preview-against-render proof.
- **The owner's files.** The default first cut as a film, and the five side-by-sides.
- **Not proven by anyone here:** a real iPhone, and how any of it sounds.

## 7. Rules carried over

Part 3's rules stand: the agent calls only Qwen and writes operations, never code; every change passes the one
door; what is seen is what is posted; the craft is in code; the repository is public, so no real id, link, creator
name, reference wording or word of the owner's take is committed; every font carries its licence file; Remotion
stays pinned at 4.0.545; commits are local on `feat/edit`, never pushed. Modal is capped at $5.00 for this plan.

## 8. Decisions the controller made, for the owner to overturn

1. **The default label stays through the film,** as in references 2, 3 and 4. The other choice is the first 2.5 s
   only.
2. **Bold pop stays in the picker, last.** The other choice is to remove it.
3. **Two typefaces are added, not five.** One per kind that a reference shows.
4. **Sound is left out of this plan.** Nothing in the evidence supports it, and nobody here can listen.
5. **Pictures are the next plan, not this one.** They are the larger value for explainers, and the larger build.
6. **Remotion is not upgraded here.** Version 4.0.546 lists a fix for memory growth in Safari previews; whether it
   fixes the open iPhone problem belongs to part 4.
7. **Modal is capped at $5.00 for this plan,** as it was for part 3 (which stands at $4.12). The money goes on
   deploying the render bundle when the kit changes.
