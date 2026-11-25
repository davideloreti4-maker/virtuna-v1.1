# The result page: the video in focus (new look)

Status: direction given by the owner 2026-11-25, after three drawings. His words: "Remove the node
circle completely from the hero. So the hero is just focus on the video. And below as usual, and improve
the drawing of the brain engagement page better ui, ux user value etc and users need to be able to play
the video and see the changes on all 3 tabs. As well as the number, which is directly below the video,
change that to the format ... how many viewers from 1,000 have been watching. on desktop change to video
focus aswell."; on the Audience, Engagement and Brain pages: "I want everything like to be the same as it
was before"; on the film strip: "bring back the film strip"; on the simulating screen: "let's do a bit
better animations on the simulation screen. Maybe something different then the nodes circle." Drawn: the
fourth sheet he saw that day (three pictures) and an animated prototype of the simulating screen.
Section 8 holds his two answers.

Behind `NEXT_PUBLIC_NEW_LOOK`. Flag off renders exactly as before. The page is `/simulation/[id]`.

## 1. What changes, in one paragraph

The top of a video's result puts the video in focus: larger, centred, with one number under it that
says how many of 1,000 viewers are watching. The gauge leaves the page. Everything under it stays where
and as it is: the line, the film strip, the sentence, the three tabs in their order. The Engagement and
Brain pages are redrawn so a creator can read them; the Audience page is not touched. Playing the video
moves all three pages. The screen shown while a simulation runs is redrawn without the circle of dots.

## 2. The rules everything follows

- When a simulation has finished the app knows: about ten simulated viewers, each of one group, each
  with a weight (together 100) and the scene in which they leave or that they stay; the scenes with
  their times and frames; the share still watching at the end of every scene; the sentence; the average
  watch; four values from 0 to 100 for how likely viewers are to share, comment, save and watch again.
- **1,000** is how those weighted viewers are counted on screen: a count is a share times ten, rounded.
  At the clip's end it is the stored share at the end of the last scene; at any other moment it is the
  line's value at that moment (the line runs straight between the ends of the scenes).
- Nothing else is shown as a number. No likes, comments, saves or shares as counts: the simulation has
  none. No count while a simulation is still running.

## 3. The hero

### 3.1 On a phone

The first card, top to bottom:

- **The video**, upright, centred, about half the card's width (176 wide on a 393 phone; never more
  than 200, never less than 140), with the corner and shadow the result's video has today and a play
  mark. A tap plays and stops it in place, with its sound, exactly as today's player does.
- **The count**, centred under it: at rest at the clip's end `460` large and `of 1,000 watched to the end`
  beside it; at any other moment (playing, or the line dragged to a moment) `652` and
  `of 1,000 still watching`.
- A hairline, then **the line**, **the film strip** and their two times: as they are today.

The gauge ("46% watch to the end") is no longer on this page.

The small player that pins to the top when the card has scrolled away stays; it shows the count's
number where it shows the percent today.

### 3.2 On a wide window

The two columns stay. Left: the video as large as today, and centred under it the count. Right: the
first card holds the sentence alone (its frame, the sentence, the line under it), where the gauge stood
beside it; then the card with the line and the film strip, the tabs and the open page, all as today.

### 3.3 What plays

Playing is today's playing: the video at its own speed with its sound, the line's dot moving with it,
the film strip, stepping by scene, the sentence's tap that plays from its scene. New is only that the
count and the three pages follow (section 4).

## 4. The three pages under the tabs

The tabs keep their order (Brain, Engagement, Audience) and Audience is open first, as today.

### 4.1 Audience

Not touched: the ring with its number, the two lists, the line under them. It follows the video today.

### 4.2 Engagement

Two cards.

**"Of 1,000 viewers"**, three rows, each a name and a figure:

- `Past the first 3 seconds`: the count at 0:03 (at the clip's end for a clip shorter than that).
- `Watched to the end`: the count at the end.
- `Average watch`: `0:16` and `of 0:29`, and under it the bar it has today, filled to the average watch.

While the video is not at rest (playing, or stopped at a moment) a row appears above them, `Now, at 0:07`
with `571 still watching`, and a marker on the bar shows where the video is. At rest both are gone.

**"What viewers are likely to do"**: the four rows and bars as today (Share, Comment, Rewatch, Save in
today's order, no numbers). The row with the highest value carries a small tag, `Most likely`; with a
tie for the highest there is no tag.

### 4.3 Brain

- The card with the brain picture: as today (it follows the video today).
- The card with the four signals:
  - On top, **one sentence** worked out from the Focus signal: `Focus is highest at 0:02` and then
    either ` and falls when the scene changes at 0:03.` (when its largest fall from one second to the
    next lands within a second of a scene's start) or ` and lowest at 0:19.` A clip whose Focus never
    moves by more than a small step gets `Focus stays level through the video.`
  - A small line: `At 0:07 · the dashed line is at rest` (the time follows the video; at rest it is the
    clip's end).
  - The four rows. Each: the signal's name and under it what it stands for (`Eyes` · `what there is to
    look at`; `Focus` · `how closely they follow`; `Feeling` · `how much it moves them`; `Wandering` ·
    `how far the mind drifts`); its curve over the clip against its resting level, as today, with a
    line at the video's moment; and at the right, in place of today's bare number, a word: `above rest`,
    `at rest` (within three points of the resting level) or `below rest`.
- Under the cards: `A model of attention, not a scan.`, as today.

## 5. The screen while a simulation runs

Without the circle of dots. Three options were shown as an animated prototype
(`simulating-options.html`): A, the result's first card builds itself (the clip plays; the film strip's
tiles fill with the scenes' frames as they arrive; where the count will stand it says
`Building your 1,000 viewers` with the time since the start; when the result lands the count resolves,
the line draws itself and the rest of the page fades in); B, the clip large with a progress line running
round it; C, 1,000 viewers taking their seats in rows under the clip. **The owner chose A** (section 8),
because the wait then becomes the result with no change of
screen and it shows only things the app really has (the clip, the frames as they arrive, the time).

Whichever is built: the clip shows for a simulation started from a file in this tab; for one brought by
link the post's cover when it is known, else the first frame that arrives, else an empty tile; nothing
is shown as a number except the time since the start; a simulation that does not finish or is not found
ends as today; with reduced motion nothing moves by itself.

## 6. Words

New: `of 1,000 watched to the end`, `of 1,000 still watching`, `Of 1,000 viewers`,
`Past the first 3 seconds`, `Watched to the end`, `Average watch`, `Now, at 0:07`, `still watching`,
`Most likely`, the Brain card's sentence in its three forms, `the dashed line is at rest`,
`what there is to look at`, `how closely they follow`, `how much it moves them`,
`how far the mind drifts`, `above rest`, `at rest`, `below rest`, and for the wait
`Building your 1,000 viewers` and `Usually about a minute`.
Gone from this page: `watch to the end` under the gauge's percent.
Everything else as it is.

## 7. Not in this part

The Audience page; the tabs' order; the sentence and how it is worked out; a next step under the
sentence; any estimated count of likes, comments, saves or shares; the small card in the chat while a
video simulates; the result page of a hook or a script; the old look. A circle of dots at the video.

## 8. The owner's answers (2026-11-25)

1. The hero, the Engagement page and the Brain page as drawn on the fourth sheet: "yes".
2. The simulating screen: "lets go with A" (the result's first card builds itself).

## 9. Done when

- On a phone (320, 375, 393) and a wide window (1024, 1440), light and dark: the video is in focus with
  the count under it; the count always equals the line at the video's moment; the gauge is gone; the
  line, the film strip, the sentence, the tabs and the Audience page are as before.
- Playing the video moves the count, the Audience ring, the Engagement page's "Now" row and marker, and
  the Brain page's moment line and words; at rest they show the end.
- The Engagement and Brain pages read as drawn and say nothing the simulation did not produce.
- The simulating screen as chosen; a result that arrives while it is open takes its place without a
  jump.
- Reduced motion, keyboard and a screen reader work as on the page today.
- Types, the whole test suite, lint and both production builds pass; flag off matches the baseline.

## 10. As built (2026-11-25): where the page differs from the text above

Built from the pictures the owner approved; where a number or a rule in sections 1 to 9 differs from
this list, this list is what stands.

- The numbers in sections 3 and 4 were samples. On the recorded run the page says `461` (46.07 of 100,
  times ten), `708` past the first 3 seconds and `562` at 0:07.
- Section 6 lists `Usually about a minute`: not shown. The chosen simulating screen (A) has one line,
  `Building your 1,000 viewers`, with the time since the start.
- The simulating screen on a wide window is the result's two columns building themselves: the large
  tile with the line of words under it, the sentence's card empty, the line's card with a dotted base
  and the strip's tiles. Under the strip no times are shown while it runs.
- The count under the video and the small pinned player's number are the same number at every moment.
  On a card under 290 wide (a 320 phone) the words stand under the number, at rest and while playing.
- Engagement: `Past the first 3 seconds` is not drawn for a clip shorter than that. All four bars are
  drawn on tracks of one length (the rows without `Most likely` keep its room), so the bars compare;
  `Most likely` goes to the single longest bar as drawn, none on a tie.
- The marker on Engagement's bar and the line on the Brain's curves are coral, as drawn, and only
  while the video is away from rest.
- Brain, the sentence (section 4.3): the lowest second is read from the highest second on (the model
  starts every clip at rest), and it is the first second Focus is down within 3 points of that low;
  a lowest under 3 points below the highest is not named (`Focus is highest at 0:07.`); a scene change
  is named only for a fall of 3 points or more that lands at that scene's start or within the second
  after it.
- Brain on a wide panel: the two cards side by side as tall as the signals card, the brain at the
  phone's size.
- The landing (section 5): the count rolls from 1,000 in 1.5 s, the line draws itself, the dot at its
  end comes in when the line has reached it, the rest fades in after 0.9 s; the video tile keeps the
  picture the simulating screen showed until the player's own is there.

