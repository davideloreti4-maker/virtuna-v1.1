# The chat's feel (thread, step 1 of 3)

Date: 2026-11-25 · Status: approved by the owner 2026-11-25 on a film of the flow that plays by itself
("sounds good, review and continue with your recommendation": the wait as "card fills in", the order
feel → depth → Maven's pick). This spec is what is built; §9 lists where it departs from the film, each
with its reason. Replaces §4.8 of `2026-11-21-thread-answers-design.md` ("one waiting row, no stage
list") and adds to its §3.

Seams with file and line: `.scratch/next-look/part11/thread-ux/seam-map.md` (HEAD `e380aa3f`). The film's
source: `.scratch/next-look/part11/thread-ux/proto/index.html`. Ledger:
`.superpowers/sdd/2026-11-25-thread-feel/`.

## 1. Where this sits

The new look's thread shows answers as cards (step 1 and 2 of the thread answers, 21 to 23 Nov). What it
lacks is everything between a send and a card. Measured on the real app on 2026-11-25, new look, test
account, phone and desktop:

| Ask | From Send to the card |
|---|---|
| Hooks, typed in chat | 22.3 s (7.6 s of "Thinking" before the run is named) |
| Hooks, skill picked | 21.1 s |
| Ideas, skill picked | 27.4 s |
| Script from a hook | 31.2 s |
| A plain answer, first word | 10.7 s and 19.1 s (two asks) |

For all of that time the screen holds three grey dots and two words. Then the card appears in one frame,
and when it is taller than the screen the view is thrown to its end. The owner's ask the same day: the
old cards had more, the new chat must be clean and smooth, and the old loading states are gone.

The work is in three steps. This is step 1, the feel. Step 2 is depth one tap away (beat names and "How
to film it" on a script, the proven video on a hook, a card for the account read, the remix's shot list).
Step 3 is Maven's pick (the closing line, rewritten short and plain, shown under a pack).

## 2. Rulings this rests on (owner)

- 2026-11-18: consumer-simple, about a dozen things on a screen; copy short and plain; one primary per
  card; the thread matters most.
- 2026-11-21: one system, one renderer for the thread; ink and greys, coral only on the Maven mark.
- 2026-11-25: the film ("sounds good, review and continue with your recommendation").
- 2026-08-13 and 2026-08-15 (carried by the code): a line shown during a wait describes what is being
  read, never what the result will be; "proven" only where the retrieval earned it. The run's own
  evidence headline is shown as sent.

## 3. What does not change

The cards themselves, their sheets, the chips, the field's look, the video's running card
(`video-running.tsx`: the simulating screen is being redrawn in another part), every flag-off screen.

## 4. The design

### 4.1 A new turn sits at the top

On every send (the field, a chip, a card's "Script …" button) the new message moves to the top of the
thread's window and stays there while the answer grows under it. The view no longer follows the growing
end.

- Each turn (a persisted one, the live one, the composer's video run) is one element in the column,
  `data-turn`. Spacing stays as drawn: a turn's parts are the column's gap apart, and a turn that has a
  question sits 14 further down than the gap, as its bubble did.
- The turn sent in this visit is the last turn and takes the room: its least height is the window's
  height less the room kept for the field, so its top can reach the window's top however short the
  answer is. A chat opened from Home, Library or the sidebar has no such turn: it opens at its end, as
  today, with no empty room under it.
- After the scroll the view is free: growth does not move it. If the creator scrolls to the end
  themselves, the view follows the end again until the next send, as today.
- When the answer is in (cards landed, or a plain answer ended) and its end is under the field by
  150 px or less, the view moves down by that much, so the last line and the chips are not half hidden.
  When more than that is hidden, the view stays and a round button "Go to the latest" (a down arrow)
  shows centred above the field; it scrolls to the end and goes when the end is in view.
- The scroll to the top takes 380 ms, eased; with reduced motion it is at once.

### 4.2 The wait

Under the "Maven" label, while a run is live and its answer is not in:

1. **Before the run is named** (a typed ask the router has not placed, a plain answer before its first
   word): one line, the word "Thinking", in the secondary ink with a slow light passing over it. No dots.
2. **Once the run is named**, for the kinds that end in a card of their own (hooks, ideas, script,
   remix): the answer's card is drawn at once as an outline (§4.3) and the line moves into its header.
   For the other kinds (explore, the account read, anything else): the line alone.

The line says what the run is doing, in the words below, taken from the stage the run reports. A stage
with no words of its own keeps the words before it.

| Run | Until a stage says more | Stage → words |
|---|---|---|
| hooks | Writing hooks | "Finding proven outliers" → Looking for videos on this topic · "Generating" → Writing hooks |
| ideas | Finding ideas | "Finding proven outliers" → Looking for videos on this topic · "Generating" → Finding ideas |
| script | Writing your script | "Finding proven outliers" → Looking for videos on this topic · "Generating" → Writing your script |
| remix | Reworking the video | "Resolving" → Getting the video · "Decoding" → Working out why it worked · "Adapting" → Reworking it for your audience |
| explore | Scanning for outliers | "Pulling outliers" → Finding videos · "Scoring for your audience" → Checking them against your audience |
| account | Reading your account | (its stages do not reach the turn) |
| any other | Thinking | |

"Ranking" has no words: it is a sort that takes no time. "Simulating your audience" is never said: no
generation simulates.

At the line's right end, in the muted ink, how long such a run takes: "about 20 s" for hooks, "about
30 s" for ideas and for a script (measured above; round on purpose). Past twice that: "taking longer".
Other kinds: nothing. No counting clock.

**What the run reads.** When the run sends its evidence (the videos a grounded run was shown, the post a
remix fetched), one row shows under the line: up to five small covers, overlapping, then the run's own
headline word for word ("Reading 3 real videos matched to this subject"). No handle, no number, no link:
the row says that real videos are being read, the cards say which. A remix's one post is not drawn as
this row: its outline's source row becomes the real one (§4.3).

### 4.3 The outline, and the landing

The outline is the answer's own card (`AnswerCard`) with what is known and grey bars for what is not:

- **A pack (hooks, ideas):** the header row with the line (§4.2); the evidence row when there is one;
  three rows, each a pale ring where the gauge will be and three bars. No bar where the button will be.
- **A script:** the header row with the line; five beats on the time rail, bars for their words.
- **A remix:** the source row (a grey tile and two bars until the post is fetched, then the real cover,
  handle and views), two bars for the hook, the header line above them.

A slow light passes over the bars while the run is live (one sweep in 1.6 s). With reduced motion the
bars are still.

When the cards arrive they take the outline's place in the same turn: the header's words change to the
card's own, the rows come in one after another (each fades in and rises 6 px over 420 ms, 70 ms apart,
at most ten staggered, the rest with the tenth), the button after the last row, the chips 240 ms after
the button. Nothing changes height by animation: the card takes its new height at once and its rows fade
in. The line outside a card (kinds without an outline) is replaced by the answer, which comes in the same
way.

The landing is drawn once per answer: a run that finishes while the creator watches lands this way; a
chat opened later, and the same turn after it is folded into history a moment later, are drawn at rest.

### 4.4 A score counts up

When a text simulation finishes on a gauge the creator is looking at (the gauge was running or waiting
and becomes done while mounted): the arc draws from nothing to its value and the number counts from 0,
both in 700 ms, eased. A gauge that is drawn done (a stored score, a reload) is at rest. The gauge's
name, its `data-value` and what a screen reader hears are the final value from the first frame. With
reduced motion: at rest.

### 4.5 A plain answer

- Before its first word: the "Thinking" line (§4.2).
- While it streams: each new word fades in over 240 ms. Words already shown do not move or fade again.
  With reduced motion: no fade.
- When it has ended: one quiet action under it, Copy (the answer's text; a check for a moment after).
  Under it the chips, as today.

### 4.6 The field while a run finishes

The field shows Stop only while there is something to stop that the creator can see coming: until the
answer is in. For a run the chat dispatched, the stream stays open after the cards (billing, the closing
line that this look does not draw): the field then shows its send arrow again, not pressable until the
stream closes, and Enter stays blocked for that moment, as today; if the stream stays open for more than
8 s, Stop is shown again, so a stalled closing line can be ended. A run started from a skill reports
done right after its cards; from then on the field is at rest and a new message can be sent, as today.

### 4.7 Words

- A pack's header before any row is simulated: "3 hooks" / "4 ideas" at the left (the number of rows),
  "1 credit each" at the right. While a row simulates and after: "Would stop to watch" at the left, as
  today, and "out of 100" once every row has its number.
- The message a pack's script button sends: "Write the script for hook 2." / "Write the script for
  idea 3." (the row's number). From a sheet, a remix or anywhere with no row number: "Write the script
  from this hook.", as today.

## 5. Fixes found in the same test

1. **The chat stays named "New chat" until a reload.** The first message of an untitled chat names it at
   once in the header (the server's own title rule, `cleanThreadTitle`), through the header's existing
   hint; the list of chats is read again when a run has been folded into history, so the sidebar and
   Home's Recent show the stored title.
2. **A message sent with Hooks, Ideas or Script picked shows twice after a reload.** The fix that is on
   main (the composer no longer posts a second copy of the question for the three routes that store it
   themselves) is applied here unchanged, so this branch behaves the same before it lands.
3. **After a run started from a skill, Maven cannot see its own cards.** The chat's context builder
   handed a run's cards to the model only when the line after them was stamped as the chat agent's.
   Cards from a run started directly have an unstamped line, or none yet. Rule now: such cards are handed
   to the model as what is on the creator's screen (the app's own note about results the creator ran
   themselves, the channel the other skill results already use), before the line or question that follows
   them, or at the thread's end. They are not replayed as a tool call the chat agent never made. A field
   asking for input still cannot pass as a run: only card blocks count.
4. Done before this spec, in the same tree: a pasted link wraps inside its bubble; the "Ahead" tag no
   longer shifts its row's text.

## 6. How it is built (units)

| Unit | File | What it does |
|---|---|---|
| The scroll | `src/components/app/home/use-thread-autoscroll.ts` | Besides today's rule: `anchorNextTurn()` (the next turn that appears goes to the top; the pin is released), `settle()` (§4.1's 150 px rule), `scrollToLatest()`, `hiddenBelow` (for the button), and the window's height written to the region as `--thread-room`. Called only by new-look code; the old calls are untouched. |
| The turns | `src/components/thread/persisted-thread-stream.tsx` | Under the flag each turn in an element `data-turn`; the last one takes the room when `anchored`. Flag off: as today, byte for byte. |
| The words of a run | `src/lib/thread-next/run-status.ts` | Pure: the line's words from the kind, its stages and the guess; the usual length and its note. |
| The line, the evidence row | `src/components/thread-next/run-status.tsx` | `RunStatus` (a polite status, as the waiting row was), `EvidenceRow`. Replaces `waiting-row.tsx`. |
| The outline | `src/components/thread-next/answer-outline.tsx` | The three outlines of §4.3. |
| The landing | `src/lib/thread-next/landing.ts` | Remembers when an answer landed (by the answer's first card line) so that the turn drawn in its place within the landing's time carries on where it was, and any later one is at rest. |
| The turn | `src/components/thread-next/thread-turn-next.tsx` | Draws the line, the outline, the landing. |
| The gauge | `src/components/thread-next/answer-gauge.tsx` | §4.4. |
| A streamed answer | `src/components/thread-next/streamed-text.tsx` | Words wrapped as they arrive (a small rehype step after the sanitiser); Copy under an ended answer. |
| The field | `src/components/thread-next/thread-field.tsx`, the composer | §4.6: a third state beside streaming and at rest. |
| Motion | `src/app/globals.css` | Five keyframes, each with its reduced-motion rule, used only by the classes above. |
| To look at it | `src/app/(app)/dev/answers/` | States for the wait, the outlines, and one that plays a landing. |

The composer (`src/components/app/home/composer.tsx`) changes in five places: the sends call
`anchorNextTurn()` where they called `scrollThreadToBottom()` under the flag; `anchored` is kept and
handed to the stream; the landing calls `settle()`; the field gets its third state; the first send sets
the title hint and the fold reads the list again. Plus the two-line change of fix 2.

## 7. Reduced motion, and what a screen reader hears

Every animation above has a rest state under `prefers-reduced-motion: reduce` and none carries meaning
that the rest state lacks. The line is a polite status and is read when its words change; the covers and
the bars are hidden from a screen reader; a landing announces nothing beyond the cards' own headings; the
"Go to the latest" button is a button with that name.

## 8. Not in this step

- "Try again" under a plain answer: sending the question again stores a second copy of it and a second
  answer; it needs a way to replace an answer on the server. Parked with the wiring.
- Hooks arriving one by one: the routes send all cards in one frame at the end; it needs the runners to
  send each as it is written.
- What opens on a fresh visit: today the chat last open (a pointer the app keeps on purpose), or the
  newest chat when there is no pointer. Left as it is; a change is the owner's ruling.
- The video's running card and the simulating screen.
- Everything of steps 2 and 3.

## 9. Where this departs from the film

1. **No counting clock; "about 20 s" instead.** An independent design review of the film's frames held
   that a clock running to 0:25 points at the slowness. The video's running card already says "of about a
   minute" and "taking longer": the same words here.
2. **The covers get a row of their own with the run's headline, word for word.** The film wrote "Reading 3
   videos that worked" in the header. The code's own rule (2026-08-15) forbids claiming "proven" for the
   common kind of retrieval, and its headline is too long for the header beside anything else. In the
   film the covers also pushed the words sideways when they came in.
3. **No grey bar where the button will be**, so the outline is a third shorter (same review: the outline
   should promise less while it waits 20 to 30 seconds).
4. **No height animation** (the film let each row's height glide): the design system forbids animating
   height. The card takes its height at once; the rows fade in.
5. **Copy without "Try again"** (§8).
6. **Not from the film's script and hook cards:** the proven video under each hook, the beat names, "How
   to film it". They are step 2, as the page said.

## 10. Checks before it is called done

- Unit tests for each unit above, written first; the changed tests of the thread turn and the pack card.
- The whole suite, `tsc`, lint on changed files, production builds with the flag on and off, the
  flag-off comparison against the recorded baseline.
- In the running app with the new look, phone 393 and desktop 1440, light and dark: a typed hooks ask and
  a picked one (the line's words in order, the outline, the evidence row when the run is grounded, the
  landing, where the view rests); "Simulate all" (counting up); a script from a pack's button (the view
  at the script's first line, the button to the latest); a plain question (the fade, Copy); the title
  right after the first send; a question about the cards after a picked run; reduced motion on; a chat
  opened from the sidebar (at its end, no empty room).
