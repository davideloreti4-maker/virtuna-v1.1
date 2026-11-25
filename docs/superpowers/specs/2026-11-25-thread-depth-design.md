# The chat's answers, depth one tap away (step 2, first part)

Date: 2026-11-25. Follows `2026-11-25-thread-feel-design.md` (step 1, the feel). New look only
(`NEXT_PUBLIC_NEW_LOOK`); with the flag off nothing changes.

## 1. Why

The new cards are quiet on purpose, and they left out things a run already sends and a creator
needs to act on the answer: what each beat of a script is, how to film it, and which real video a
hook is built on. The owner's words: "all the old skill cards had way more info but we want a clean
and smooth chat experience". The answer is not to put the old cards back. It is to name what is
there and put the rest one tap away.

The owner approved these three pieces as filmed (the review page's film, scenes "the script" and
"three hooks"): "A script opens at its first line, with its beats named", "How to film it is one
tap away", "Each hook shows the video it is built on".

## 2. What a run sends (checked in the code, 2026-11-25)

- A script's beat always has `label` (Hook, Setup, Turn, Payoff, CTA), `content`, `timing` and
  `retentionMarker`. `filming` (a one-line cue: camera, what is on screen, delivery) is asked for on
  every run and kept when the model gave one: sometimes there, sometimes not.
- A script may have `production`: `shots`, `onScreenText`, `setup` (all three, or the object is
  absent) and sometimes `edit`.
- A hook may have `proof`: the one real video it is built on (`handle`, `coverUrl`, `videoUrl`,
  `views`, and more). Only on runs that found videos, and not on every row of such a run.

Nothing here needs a change to a route, a runner, a prompt or a stored turn.

## 3. The design

### 3.1 A script's beats are named

Above each beat's words, its name: the beat's `label` as sent, trimmed. `CTA` (any case) is written
"Call to action". 12 / 16, weight 640, the secondary ink, 1 under it; the beat's words follow as
today. An empty label draws nothing and takes no room.

A beat is 17 taller than before. The outline of a script (step 1, the wait) grows with it: each
ghost beat gets a short bar where the name will be (about a fifth of the line, 9 tall on the 16
line), so the card still changes height by less than a line of text when the script lands.

Copy still copies the words only: no names, no times.

### 3.2 "How to film it", one tap away

Under "Add your take", one quiet button: a film icon and "How to film it". Full width, 40 tall,
14 / 570, the secondary ink, no fill; on hover and while pressed the sunken fill and the ink. 6 above
it. It is there only when the script has something to show: at least one beat with a `filming`
cue, or `production`. A script with neither has no button and looks as it does today. In a landing
the button comes in with "Add your take".

It opens the look's own sheet (`AnswerSheet`: from the bottom on a phone, a dialog from 768), titled
"How to film it":

- One row for each beat that has a cue: the beat's name (13 / 18, weight 640), its span in the muted
  ink ("0 to 3 s", from `timing`; none when the timing cannot be read), then the cue (14 / 20). A
  hairline between rows, none above the first. A beat without a cue has no row.
- Then, when the script has `production`, the same kind of rows: "Shots", "Text on screen", "Setup",
  and "Edit" when it is there.

The sheet has no button of its own: nothing in it costs anything. Closing it puts the focus back on
"How to film it".

### 3.3 A hook shows the video it is built on

Under a hook's line, when the hook has `proof`: the video's cover (16 by 22, radius 4, the card scale's smallest; the film drew 4.5) and
"@handle · 854K views" (13 / 18, the secondary ink, one line, cut with an ellipsis), 6 under the
hook's line. Without a cover: the words alone. Without views: "@handle" alone. A hook without
`proof` shows nothing more than today.

The row stays one button that opens the hook's sheet; the line is not a link of its own (the sheet
already links to the video). The line is part of what the row's button is described by.

Ideas are unchanged.

## 4. Not in this part

- A card for the account read and the remix's shot list: the second part of step 2, drawn first.
- Why a beat holds attention (`retentionMarker`), a script's `topic` and `format`, a hook's
  first-frame technique: not shown. They were on the old cards; none of them tells the creator what
  to do next.
- Maven's pick (step 3).

## 5. Two defects found while checking it in the real app, fixed with it

Both are older than this part and sit on the path this part makes busier: hooks land, the creator
opens one and scripts it.

- **A script started too early scrambled the thread.** A follow-up from inside the thread ("Script
  this one" in a hook's sheet, a chip) tapped while the last answer's stream was still open (its
  closing words, 2 to 5 s after the cards) cancelled that stream. The first message and its cards
  left the screen for the whole wait, and the stored thread kept the hook cards under the second
  question, after a reload too. Now such a follow-up is held: nothing is sent, the field shows Stop,
  and it goes once the run has closed and folded into the thread (at the latest after 8 s, and never
  while a sheet is open). The same holds after a skill's own run and while the fold is reading the
  thread.
- **A sheet closed by itself.** A hook's sheet opened right after the hooks landed disappeared a
  few seconds later, untouched, when the run was folded into the thread (the fold replaces the live
  turn, which owned the sheet). Now a fold waits while a sheet of the look is open and runs when it
  has closed.

New look only; with the flag off nothing changes.

## 6. How it is checked

Component tests on real markup (no mock of the parts under test); the dev page `/dev/answers` with a
script that has cues and a plan, one that has neither, and a pack with and without proof; a look in
the real app on a phone and a desktop: the script card's names, the button, the sheet, the hook
rows, and the height of the card before and after a script lands.
