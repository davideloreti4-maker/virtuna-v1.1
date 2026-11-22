# The thread's answers as one system (part 3, rework step 1)

Date: 2026-11-21 · Status: drawing approved by the owner 2026-11-21 ("visually review and continue where the
last session left off", after the sheet and its two open decisions were put to him; both decided as
recommended) · Replaces the per-component slices 2 to 4 of part 3 · Slice 1 (field + frame):
`docs/superpowers/specs/2026-11-20-thread-field-design.md`

Drawing: `.scratch/next-look/part3/answers/answer-system.png` (19 full screens; single renders
`answers/renders/ax-*.png`; source `answers/answers.html`, rules `answers/BRIEF.md`). Seams with file:line:
`.scratch/next-look/part3/answers/seam-map-step1.md` (HEAD `d4204a91`). Earlier maps:
`part3/seam-map.md` (slice 1, composer lines stale), `part3/slice2/seam-map.md` (seals, `react`).

## 1. Where this sits

On 2026-11-21 the owner said the built thread was "really poorly" done against the reference. True: slice 1
swapped the field, bubble, label and chips, but every card between them was legacy, the old narration stayed,
and the 400 px side panel still mounted on desktop. Ruled the same day: the thread is ONE system with ONE new
renderer, base first, then depth; a step is done only after full-window side-by-sides against the drawing,
phone and desktop, plus an independent critic. This spec is step 1, the base. Step 2 is the depth of a hook
(the sheet and the hook result page).

## 2. Rulings this rests on (owner)

- 2026-11-16: nothing is simulated unless the creator fires it; drafts arrive without a score.
- 2026-11-18: "Simulate", never "Test"; one primary per card, next steps quiet; consumer-simple; copy short and
  plain; the thread matters most; no result opens beside the chat.
- 2026-11-20: the field (slice 1); "+" adds a video to simulate.
- 2026-11-21: one system, one renderer; the answer-system drawing; hook details in a bottom sheet (step 2);
  "For {audience}" under the thread title; no Cut / fix button on the video card ("Open simulation" until the
  editor ships).

## 3. The system (every answer)

1. The user turn (slice 1), the "Maven" label, ONE card per result, at most one sentence, the chips. No intro
   line, no run receipt, no outro paragraph, no forward chip, no offer chip, no warnings list.
2. One ink primary per card, its price in the button's `em` ("2 credits"); free actions carry no price.
3. Inter only. No uppercase labels. Ink and greys; coral only on the Maven mark and the one named scene of a
   video curve. No green, no red, no "usual".
4. The gauge on everything that can be simulated as text (hooks, ideas, a script's opening line, a remix hook):
   empty track + pulse glyph (not simulated; tap = simulate, 1 credit), dotted ring (simulating), ink arc +
   number (simulated). The number is `population.stopPct` rounded, "would stop to watch". Never `seal.pct`,
   `fraction`, `band` or a projected score.
5. Simulating several runs one after another ("2 of 3"), never in parallel. One text simulation at a time in
   the whole thread; a second request waits its turn.
6. "Best" only when every row of the pack is simulated and the leader is at least 10 points ahead of the second.
   The sentence under a fully simulated pack is computed: "Hook 3 leads by 15 points." or "No clear winner."
   (ideas: "Idea 2 leads by …"). The app has no source for a reason, so none is written.
7. Chips: two of the existing curated follow-ups per kind (§4.7), under the last answer only (slice 1). No "···".

## 4. Step 1: what each answer becomes

Consecutive cards of one kind form one card: a run of `hook-card` blocks is a hook pack, a run of `idea-card`
blocks an idea pack, a run of `remix-card` blocks one remix card with a pager. Grouping happens at render time;
nothing is migrated. A turn with two runs shows two cards.

### 4.1 Hook pack (P3, P4, P5, D2)

Header "Would stop to watch", and "1 credit each" while any row is not simulated. Rows: gauge (left) + hook
text (`hookLine`). Primary: "Simulate all N" with "N credits" (N = rows not simulated) while any row is not
simulated ("Simulate the rest" once some are; no chips while rows simulate, as P4); while a queue runs, a thin progress line and "2 of 3" replace the primary; once all are simulated,
"Script the best" (with a clear best) or "Script hook K" (K = highest, first on a tie), "2 credits", which runs
today's write-script turn (`useOnWriteScriptHook`). A failed row shows "Couldn't simulate" under its text and
keeps its empty gauge. Rows have no chevron and a simulated gauge is not a link until step 2.

### 4.2 Idea pack (P12)

The hook pack's component. Row text: `title` (wraps, never cut) and one grey line: the first sentence of
`take`, else of `angle`, else none (changed in step 1's checks: stored `angle`s are paragraphs, median ~200
characters, some with segment ids; `take` is never empty, ~80 characters, and the drawing's line is its first
sentence). Seal key and fire text: `title`; framing "idea". Primary after all simulated: "Script the best" /
"Script idea K" with the idea's `seedHook` (else its title) through the same write-script turn.

### 4.3 Script (P10)

Header "Script" and the total length when the last beat's timing parses ("0:24"); beats on a time rail with
their start ("0:03") when it parses, else no time. Beat text: `content`. Under the opening beat the gauge row
"Simulate the opening" · "1 credit" (fire and seal text = `openingBeatSeed || beats[0].content`, no framing).
Primary "Add your take" (upload icon, free): today's `useOnTestScript(opener, brief)`.

### 4.4 Remix (P11)

Source row: cover (`proof.coverUrl ?? coverUrl`), `@handle`, and "{multiplier}× {basis} · {views} views" when
`proof.multiplier` exists, else "{views} views" (runner cards store no multiplier). The adapted hook as the
card's headline in quotes; under it the gauge row "Simulate the hook" · "1 credit" (text `adaptedHook`, kind
"remix" as today: the route's default framing). Format steps: `formatBorrowed` split on "→", up to four, numbered on grey discs. Primary "Script it"
· "2 credits": the write-script turn with `adaptedHook`. Several remix cards: one card, a pager (dots + previous
/ next, 44 px targets) under it.

### 4.5 Video (P8 running, P9 / D3 done)

Done (`video-test-card`): thumbnail (first scene frame, else `filmstrip[0].keyframeUrl`, else a neutral tile),
the result page's gauge ("watch to the end", `headlineOf`), a static mini curve of `audience.points` with the
named scene (`verdictOf(...).scene`) banded in coral, the sentence (`verdictOf(...).sentence`), primary "Open
simulation" (free, `resultHref(analysisId)`). Data: `useSimulationRow(analysisId)` → `videoStateOf`, the cache
the result page uses. While the row loads: the thumbnail and a gauge track with no number. With no audience or
an unreadable row: thumbnail + "Open simulation" only. Desktop: picture left; gauge + sentence + curve right.

Running (the composer's live video turn): thumbnail of the staged file, a clock from the moment the creator sent
it ("0:41", label "running"; "uploading" until the run has an id), primary "Watch it run" (free, opens
`resultHref(id)`, absent until the id exists). It renders AFTER the thread history (today it renders above it).
A failed run keeps today's error and retry.

### 4.6 Chat answer and the fallback card (P13)

A turn with no result card renders its markdown as plain text (no card). Markdown inside a turn that has a
result card is narration and is not shown (persisted chat-agent prose, the live closing line, a live
preamble). `input-request` and `outlier-grid` keep their legacy renderers (they are interactive), inside the
new frame. Every other block type renders as the fallback card: a title, up to three lines, and "Show all"
(when there are more) which lists every line in place. Folded, each line shows its first sentence, and "Show
all" also appears when one was shortened (changed in step 1's checks: stored composed answers are paragraphs;
three of them filled a phone screen). `run-header` renders nothing.

| Type | Title | Lines |
|---|---|---|
| composed-card | `deliverable.text` | first three body lines (bullets, note, column titles, timeline lines, beats) |
| account-read | "Your account" | `patterns.working`, then `patterns.fix` |
| profile-read | `subjectName` | `identity.traits`, `howTheyReact` |
| multi-audience-read | `concept` | per audience: name · lever |
| corpus-references | "Sources" | handle · views per source (Sources blocks in a row are one card, repeats dropped) |
| reaction-distribution | `audienceName` | verdicts |
| prediction-gauge | `scenario` | factor drivers |
| persona-chat-turn | archetype name | `text` |
| brought-card | `stimulus` | `scrollQuote` |
| band, personas | (no producer; fallback with type-free title "Answer") | — |

### 4.7 Chips per kind (existing curated entries, by label)

hooks: More hooks · Punch them up · ideas: More ideas · Sharper angles · script: Make it punchier · Different
angle · remix: More like this · Write hooks · video (test): Rewrite the hook · Fix the pacing · chat: Give me
ideas · Write hooks. Other kinds: their first two.

### 4.8 While a run is live

Under the Maven label one waiting row: three soft dots and the run's name ("Writing hooks", "Finding ideas",
"Writing your script", "Reworking the video", "Scanning for outliers", "Reading your account"; "Thinking" before
the run is named). No stage list, no "Simulating your audience" (generation does not simulate), no live
preamble. A plain chat answer streams as text, as today. Errors keep today's copy and Retry.

## 5. The frame

- **Side panel off** under the flag: the desktop rail and its column, the phone room sheet and its header slot,
  the legacy docked presence. `openRoomForCard` is null under the flag, so nothing can open or pay for the
  room. The thread column uses the full width the drawing shows (720 on desktop).
- **Desktop header** (≥ md, in a thread): 68 tall; the thread title (the shell's `threadTitle`) and, in grey,
  "For {audience}" (the last `run-header.audienceLabel` in the thread; hidden when none or "General"). No Share
  button: nothing can be shared today (no route, no public page). The visible title is the page's `h1`.
- **Phone header:** the same "For {audience}" as a second line under the title.
- **Base under the field:** a solid background layer behind the docked field, full width, from the field's
  top edge to the bottom of the screen with a short fade above it, so nothing shows under or beside the field
  (first built from the field's middle; text showed at its rounded top corners, changed in step 1's checks).
  The field stays glass.
- The loading skeleton loses its old "MAVEN" label (slice 1 open minor).

## 6. Not in step 1

The hook and idea sheets (P6), the hook result page and its endpoint (P7), a simulated gauge as a link, Share,
Home and new chat (P1, P2, D1: slice 5), re-running a simulated row, the ＋ door and the room for brought text,
the funnel's room return (it opens nothing under the flag), "Why?", "Shorter", "Bolder" and other chips with no
curated entry.

## 7. Done when

1. Flag off renders and behaves exactly as before (all flag-off suites green; flag-off production build matches
   the baseline).
2. Real threads, flag on, phone and desktop, light and dark: a hooks thread, an ideas thread, a script, a remix
   (with three cards), a video thread, a chat answer and a fallback card each match the drawing in a
   full-window side-by-side; no intro, receipt, outro, forward chip, offer chip or side panel anywhere.
3. A real "Simulate all 3" runs three `react` calls one after another (3 credits), shows "1 of 3", "2 of 3",
   lands three numbers that match the stored seals after a reload, and marks Best only with a 10-point lead.
4. A real video run shows the running card after the history with a clock and "Watch it run", then the done
   card with the number, the curve and the sentence of `/simulation/[id]`.
5. Nothing shows under or beside the field when the thread is scrolled under it.
6. Keyboard: every gauge, primary, pager and chip is reachable, named and at least 44 px; focus visible.
7. An independent critic reviewed the full-window renders of the built screens and its points were applied or
   answered.

## 8. Known gaps

- A number moves several points between runs of one text; nothing re-runs automatically.
- Seals written before populations existed show their text as not simulated.
- Remix cards made by the runner show no multiplier.
- Script beats with timings the parser cannot read show no times and no total.
- The audience line uses the last run's audience label, which may be a display name rather than an @handle.
