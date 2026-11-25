# The chat's answers, depth one tap away (step 2, second part)

Date: 2026-11-25. Follows `2026-11-25-thread-depth-design.md` (first part: a script's beat names,
"How to film it" on a script, the video behind a hook). New look only (`NEXT_PUBLIC_NEW_LOOK`); with
the flag off nothing changes.

## 1. Why

Two answers still show less than a run sends. The account read costs 5 credits and lands as a card
titled "Your account" with three cut lines of text. The remix card has nothing behind it: why the
original worked and how to film your version are in the run and are not shown. The owner approved
both as drawn on the review page (section "Depth, one tap away": "The account read, as a card" and
"A remix: the same quiet button").

Nothing here needs a change to a route, a runner, a prompt or a stored turn.

## 2. What a run sends (checked in the code, 2026-11-25)

**Account read** (`account-read`, `src/lib/tools/blocks.ts`): `handle`; `profile` (`displayName`,
`avatarUrl` which may be empty or expired, `followerCount`, `videoCount`); `analyzedVideos` (each
`caption`, `views`, `videoUrl`, sometimes `coverUrl`; up to 30, most viewed first); `patterns`:
`working`, `fix`, `recurringHooks`, `formatMix`, `dropPoints` (always empty today); `trackRecord`
(null below three compared posts).

The runner's lines are mechanical, not prose (`src/lib/account-read/account-read.ts`):

- `fix` holds up to three fixed lines, each led by a viewer type: `scanner: hooks aren't surviving
  the first beat — sharpen your openers`, `lurker: retention drops mid-video — tighten the middle and
  cut dead air`, `skeptic: viewers aren't convinced — add proof/specifics earlier`. Empty for a
  creator with no compared posts.
- `recurringHooks` holds lines like `"How I…" (3 posts)`. Empty when no opening recurs.
- `formatMix` holds two entries, `Short-form (≤30s)` and `Long-form (>30s)`, each with a `count`.

**Remix** (`remix-card`): `sourceDecode` (`hookPattern`, `theTurn`, `structure`, `emotionalBeat`),
on every card a run wrote; `production` (`shots`, `onScreenText`, `setup`, sometimes `edit`),
sometimes; `blueprintId` and `blueprintVariant`, only when the original's timing could be read. The
beats are read from `GET /api/remix/blueprint/[id]`: the original's beats (`role`, `t_start`,
`t_end`) and, for each variant, your version of each beat (`spoken`, `shot`, `on_screen_text`,
sometimes `repair`: what to do differently where the original was weak).

## 3. The account read, as a card

An `account-read` block draws its own card, in this order. A part with nothing to show is left out
and takes no room.

1. **Who was read.** The avatar (40, round; when there is no picture or it fails to load: the first
   two letters of the name on the sunken fill, 13 / 560, the secondary ink), then "@handle" (15 / 21,
   weight 640) and under it "12.4K followers · 86 videos" (13 / 18, the secondary ink; each half only
   when its number is there). 11 between avatar and words; 12 above and under.
2. **"What works".** A hairline, then the label (12 / 16, weight 640, the secondary ink, 6 under it)
   and the two most viewed of `analyzedVideos`: the cover (30 by 40, radius 6, on the sunken fill), the caption on one line cut with an ellipsis (15 / 21, weight 520) and
   "854K views" under it (13 / 18, the secondary ink, tabular figures). 9 between the two. The
   caption is shown without the hashtags at its end; a caption that is only hashtags is shown whole.
   Rows are not links. No videos: no group. A cover that is missing or does not load (a stored
   read's cover addresses expire) leaves its tile in place with the look's video mark in it (16, the
   secondary ink), as a chat's tile on Home does: an empty tile reads as a broken picture, and
   taking the tiles away after a failed load would move the titles.
3. **"To fix".** A hairline, the label, then one plain sentence pair for each `fix` line (15 / 21,
   6 between):
   - `scanner:` "Your openings lose people in the first seconds. Sharpen the first line."
   - `lurker:` "The middle loses people. Tighten it and cut the dead air."
   - `skeptic:` "Viewers are not convinced. Show proof or specifics earlier."
   - Any other line: its leading `word:` dropped, " — " made a full stop, each sentence capitalised
     and ended with a full stop.
   No `fix` lines: no group.
4. **Habits**, one line (13 / 19, the secondary ink) above a hairline: "21 of 30 videos are 30 s or
   shorter." (or "… are longer than 30 s." when those are the larger part; the seconds are read from
   the entry's label) and, when an opening recurs, "Three videos open with “How I…”." (the first of
   `recurringHooks`; two to nine as words, 10 and up as figures). Neither: no line.
5. **One button**, the card's primary: "Ideas from what works", with its price as on every button
   that costs (the price of an Ideas run). It sends, from inside the thread and as an Ideas run:
   "Give me ideas built on what already works on my account:" followed by one line for each of the
   two videos, "- caption (854K views)". It goes through the thread's one way to send a follow-up, so
   it is held like any other while the last run is still closing. No videos: no button.

The card lands like the others: its parts come in one after another in this order.

Not shown, on purpose: the strip of all covers, the short and long split as a chart, `working` as
text (the two videos say it), `dropPoints` (always empty), the track record.

The old fallback for this block ("Your account" and loose lines) goes.

## 4. A remix: "How to film it"

The remix card gets the script card's quiet button, "How to film it", under "Script it": full width
and 6 under it on a phone, on the primary's row and 8 to its right from 768. It belongs to the page
shown (a run of three remixes has three). It is there when the page has `sourceDecode` with a
`hookPattern` or a `theTurn`, or has `production`. In a landing it comes in with "Script it".

It opens the look's sheet, titled "How to film it", rows as in the script's sheet (name 13 / 18,
weight 640; text 14 / 20; a hairline between rows, none above the first):

1. **"Why the original worked"**: `hookPattern`, then `theTurn` under it in the secondary ink. One
   of the two missing: the other alone. Both missing: no row. Real runs write several long sentences
   here, so the row is folded the way a hook's sheet folds its text: each of the two shows its lead
   (its first sentence), and one "More" under them opens both whole. Short texts show whole and
   there is no "More".
2. **Your version, beat by beat**, when the card has a `blueprintId` and the read returns beats for
   its variant: one row for each of your beats, named by the original beat's role (Hook, Setup, Turn,
   Payoff, Close) with its span in the muted ink ("3 to 9 s"; a beat shorter than a second reads
   "3 s"); first what to say, in quotes; then, in
   the secondary ink and as one paragraph, the shot, "On screen: …" when there is text on screen, and
   what to do differently (`repair`) when the original was weak there. Each piece ends with a full
   stop. A beat with nothing to say and nothing to shoot has no row.
   The read starts when the sheet first opens. While it runs, two ghost rows stand where the beats
   will be. When it fails, returns no beats, or says the timing could not be read, there are no beat
   rows and no message. A read that failed is tried again the next time the sheet opens; one that
   answered is not.
3. **The plan**, when the card has `production`: "Shots", "Text on screen", "Setup", and "Edit" when
   it is there.

The sheet has no button of its own. Closing it puts the focus back on "How to film it".

Not shown, on purpose: `structure` and `emotionalBeat` (the four-part breakdown of the original),
`angle`, `whoItsFor`, the original's frames and clips.

## 5. How it is checked

Component tests on real markup (the beat read is passed in, so a test hands it a fixed answer; no
mock of the parts under test); the dev page `/dev/answers` with an account read that has
everything, one with no `fix` and no covers, a remix with a decode, beats and a plan, and one with a
decode only; a look in the real app on a phone and a desktop.
