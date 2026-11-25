# Design — the editor's screens, piece 1: a raw take in, a finished video out · 2026-11-24

Status: **second version.** The owner on the first drawing, 2026-11-24: "i like it i think there is
still some refinement to make for the best ui / ux and user value. on the ohter points ocntinue wiht
your recommendation." So the direction, the decisions of §4, the two tables and the merge of §4 E13
stand, and this version carries the refinement (§4 E15 to E22). Nothing here is built.

The drawing is `.scratch/editor/drawing/editor-v2-drawing.png` (source `editor-v2.html`, `render.cjs`
beside it; the first version is `editor-drawing.png`; none of it is in git).

This is part 4 of the edit tool (`2026-11-19-edit-design.md` §12, "the editor's screens"), cut into
pieces. Parts 1 to 3 (the edit, the worker, the agent) are built on this branch and reach a person
only through three dev pages.

## 1. The rulings this builds to

- Owner, 2026-11-24: "lets focus on getting the tool / agent / ux ready. we want a seamless and smooth
  experience for users editing their videos". His own videos wait.
- Owner, 2026-11-24 (question dialog): the first way in is **a raw take**. The result page's "Edit this
  moment" comes second and opens the same editor.
- Owner, 2026-11-24, on the test account: "test user should be existing alredy or create new".
- Owner, 2026-11-19: the agent edits "to the requirements of the user"; the editor is "good, clean and
  smooth".
- Agreed 2026-11-19 and 2026-11-20 (the new look's result-page spec, §5b and its sheet's row B): the
  editor is a page with the video; "Ask for a change" is one field of its own and is not the chat; a
  card in the thread opens the page.
- The new look's rules (`docs/DESIGN-SYSTEM.md` → "Next look" on `design/next-look`): light ground,
  white cards, ink buttons, Inter only, one primary action a screen, every control 44 pt to tap.

## 2. The four pieces, and this one in two slices

| # | Piece | Done when |
|---|---|---|
| 1 | **The editor in the app** (this spec) | a creator attaches a raw take on Home, gets a first cut, changes it by asking, fixes a word, exports the file, and finds the edit again in Library |
| 2 | Direct controls | the strip of clips with split, trim and delete; text and sound sheets; a tap on the video selects what is under it |
| 3 | The bridge to Check | "Check it" after an export; "Edit this moment" on the result page |
| 4 | Open to users | the price on Export, a daily quota, the live-job race, production CORS, new keys, resumable uploads, clean-up of old takes and films |

The agent's own quality (a second take, a call-out held to its word, the rest of the native look) runs
beside these and is not a screen.

This piece is built in two slices, each with its own plan and its own proof:

- **Slice A, the path:** the way in, the page and its states, saved edits, asking and undoing, the
  look, the captions, the export, the card in the chat. After it a creator can finish a video.
- **Slice B, the trust:** the moment in a request (E15), the original (E16), the preview as it will be
  posted (E17), a fix on what the review finds (E18). After it a creator can judge the video before
  posting it. It is planned when slice A's proof is in, from what that proof shows.

## 3. What a creator does

Numbers are the drawing's screens.

1. **Home.** Edit is a skill beside Simulate. Tapping it opens the file picker; a video attached first
   offers Edit beside Simulate as the pill in the field. Sending goes straight to the editor page.
2. **Getting ready.** The take plays at once, from the phone's own copy of the file. Under it one line
   and one bar: "Uploading" with the time left, then "Listening to it", then "Making the first cut".
   A look may be picked from a row while this runs. Nothing has to be picked.
3. **The first cut** is made by itself the moment the take is ready, in the look picked or in ours. One
   line says what was done. Under it, as chips, the next steps: first "2 to check" when the review
   found something, then suggestions.
4. **Asking.** One field, "Ask for a change", docked at the bottom. When the video is paused inside
   the film, the field shows that moment as a small tag, and the request is about it: "zoom in here",
   "cut this part", "add a title from here". The tag can be removed.
5. **The change.** The video goes to where the change starts and plays it. The answer is one sentence
   with Undo on it. Undo and Redo are in the header.
6. **The original.** One tap shows the take as it was shot, at the same moment. A second tap returns.
7. **As it will be posted.** The video full screen with the app's buttons and caption drawn over it:
   TikTok, Reels, or nothing.
8. **Things to check.** A tap on "to check" goes to the moment and says what is wrong in one sentence,
   with the fix as one button where a fix exists, and "Keep it".
9. **Look.** A sheet of the eight looks, each drawn on the creator's own frame, and two more ways:
   "Like a video" (a TikTok link or an upload) and "Describe it".
10. **Fix a word.** The Captions sheet shows the words as they were heard. A tap on a word edits it. No
    request goes to the agent and there is no wait. The same sheet turns captions off and on.
11. **Exporting.** The edit saves itself, so there is no Save. Export makes the finished file on the
    server and shows in the page; the edit holds still until it is done or cancelled.
12. **Ready.** On a phone the button opens the share sheet (Photos, TikTok, Instagram). On a desktop it
    reads Download.
13. **Afterwards.** The edit is a card in its chat. Library lists the chat. Opening the card returns to
    the editor as it was left, with its history.

Desktop is the same page in two columns: the video and its scrubber on the left, the tools, the
conversation and the field on the right.

## 4. Decisions taken here (the owner's to overturn)

- **E1. Its own page.** `/edit/[id]`, in the new look only (a 404 with the flag off), with the pushed
  header and no tab bar, as the result page has. Not inside the chat: ruled 2026-11-19.
- **E2. No question before the first cut.** The dev page asks "How should it look?" and waits for a
  button. Here the cut is made as soon as the take is ready. A first cut takes 2 to 7 s and costs under
  a fifth of a cent, so a second one in another look is cheaper than a question.
- **E3. Home's grid goes from four tiles to six:** Simulate, Edit, Hooks, Script, Remix, More. "More
  skills", today a line under the grid, becomes the sixth tile. The other way is to keep four tiles and
  offer Edit only once a video is attached; then nobody finds it who does not attach first.
- **E4. The server keeps the edit.** Today the page holds it and a reload starts over. Two new tables
  (§6). Every change is a turn; Undo and Redo move a pointer; the conversation is the turns.
- **E5. Two things are done by hand in this piece:** the look, and a word of the captions (with
  captions on and off). A wrong look or a mis-heard name stops a video from being posted, and both are
  one operation that exists (`firstCut` with a style; `word.set`, `captions.set`). Everything else is
  asked for.
- **E6. "Export", not "Save".** Export makes the file. "Save to Photos" puts it on the phone. The
  thread card says "Edited today".
- **E7. The agent says less.** The first cut's line is written by code from facts, two short sentences
  at most. What the review found goes to "to check", not into the sentence. The row that scores a cut
  against a style shows only after "Like a video". Rounds, seconds and cost are never shown.
- **E8. Our own player controls.** A tap on the video plays and pauses, with a play button in its
  middle while it is paused; one scrubber; a mute button. Remotion's controls are off (edit spec §9:
  "controls of our own come with the editor's screens").
- **E9. A look picked after changes starts from the take again.** No code restyles an edit in place. The
  sheet says so when there are changes ("Picking a look starts again from your take. Undo brings your
  changes back."), and Undo does. Restyling in place is the agent track's next item.
- **E10. One take an edit.** Several takes, one a beat, come with capture (part 5).
- **E11. Still closed.** The page and its routes stay behind `EDIT_CREATORS`. Home shows the Edit tile
  and pill only to an account the gate lets in, so nobody meets a closed door.
- **E12. No price on screen.** Export is where a price will sit (credits a finished video, ruled
  2026-11-11); the number is piece 4's.
- **E13. Built on this branch.** `design/next-look`'s committed head is merged into `feat/edit` in
  this worktree, and merged again as that branch moves. The two branches share one changed file
  (`src/types/database.types.ts`). No third worktree: the disk has 4 GB free.
- **E14. The dev pages stay** until this page has passed its proof, then `/dev-edit/agent` goes. The
  stateless `POST /api/edit/agent` stays for the proof scripts.

The refinement, 2026-11-24:

- **E15. A request is about the moment on screen** (slice B). A creator without a timeline points with
  the playhead. The request carries the frame the video is paused on; the agent is told the time and
  the words said there; "here", "this part" and "from here" mean it. Its bar: six such requests, three
  runs each, on the owner's take, land on the moment in 15 of 18.
- **E16. The original is one tap away** (slice B). Trust in a cut comes from seeing what it was made
  from. A toggle, not a press-and-hold, so it works with a keyboard and a screen reader.
- **E17. A preview as it will be posted** (slice B). Captions under an app's buttons are the commonest
  reason a finished video is redone. The preview is the same Player, full screen, never mounted again,
  with the app's furniture as drawings of our own: no logo, no mark, only the name on the switch.
- **E18. A problem arrives with its fix** (slice B). Where a finding has a request that clears it, the
  page offers that request as one button; "Keep it" puts the finding away. A fix is offered only if it
  cleared its finding in two of three real runs when it was tried.
- **E19. The video is the page.** On a phone it takes at least half the screen's height (254 by 452 on
  a 393 by 852 screen, a quarter more than the first drawing). The header has no title on a phone:
  Back, Undo, Redo, Export. The conversation shows the latest exchange; older turns are a scroll away.
- **E20. An export shows in the page and holds the edit still.** The first drawing let a creator keep
  editing under a sheet, and any change would have thrown the file away. Now the tools and the field
  rest while the file is made, the video can still be watched, and Cancel gives the edit back.
- **E21. Waits say how long.** The upload shows the time left, from what it has measured. The analysis
  and the export give an estimate from the take's and the film's length ("About a minute", "About 3
  minutes"), not a percentage alone.
- **E22. Small things that save a second pass.** A fixed word that was heard more than once offers
  "Fix all N". "Like a video" reads in the background (it takes one to three minutes) and is offered
  as a chip when it is ready; the edit stays usable meanwhile.

## 5. The page

### 5.1 States

| State | When | What shows |
|---|---|---|
| loading | the edit is being read | the frame of the page, no spinner over it |
| not here | no such edit, or not theirs | "This edit is not here." and the way Home |
| closed | the gate refuses | "The editor is not open to this account yet." |
| getting ready | the take is uploading or being analysed | screen 2 |
| upload stopped | the page was reloaded mid-upload, or the upload failed | "The upload stopped." and "Pick the video again" |
| cutting | the take is ready and no cut exists | screen 2 with "Making the first cut" |
| ready | a cut exists | screens 3 to 10 |
| exporting | a render of the turn shown is running | screen 11 |
| take failed | the analysis failed, or the take is over 10 minutes | the worker's sentence and "Use another video" |

A take's limits are checked before anything is sent: MP4 or MOV, at most 2 GB. Its length is known
only after the upload (at most 10 minutes). The page follows the app's light or dark theme.

### 5.2 Parts

All in `src/components/editor/`, each one job:

| Part | Does | Depends on | Slice |
|---|---|---|---|
| `editor-screen.tsx` | picks the state, lays out phone and desktop | `use-edit` | A |
| `use-edit.ts` + `edit-session.ts` | the page's state: a pure reducer (from the dev page's `session.ts`) and the calls around it | the routes of §7 | A |
| `uploads.ts` | one holder of uploads in flight, outside any page, so an upload survives the move from Home to the editor; gives progress, time left and the local file's address | `POST takes`, the signed PUT | A |
| `editor-stage.tsx` | the video: the browser's own `<video>` before the cut, `EditPlayer` after, our controls over both | `EditPlayer` | A |
| `editor-scrubber.tsx` | track, playhead, the rings of things to check | the Player's ref | A |
| `editor-thread.tsx` | the turns: request, answer, Undo, the chips under the latest | the turns | A |
| `editor-field.tsx` | the field; in slice B its moment tag | | A, B |
| `look-sheet.tsx`, `captions-sheet.tsx`, `ready-sheet.tsx` | the three sheets | `ui/sheet` | A |
| `export-panel.tsx` | the export in the page: the estimate, the bar, Cancel | the job | A |
| `thread-next/edit-answer.tsx` | the card in the chat | `answer-card` | A |
| `original.ts` | the take with nothing on it, and the frame of it that matches a frame of the film | `derive.ts` | B |
| `posted-preview.tsx` | the full-screen preview and the two apps' furniture | the stage | B |
| `finding-card.tsx` + `fixes.ts` | a finding's sentence, its fix, "Keep it"; the table from a finding's code to a request | `review.ts` | B |

Kept from the dev page because they were proved there: the video stays on screen while the
conversation moves under it on a phone; controls are off while a call is out; the playhead keeps its
place across a change when that frame still exists; focus goes to the field when the cut lands, and to
the panel on a touch screen so no keyboard opens over the video; a request that failed returns to the
field; an export belongs to the exact version it was asked for.

New: `firstChangedFrame(before, after)` in `src/lib/edit/`, a pure function over the two edits'
layouts, so the video can show a change. When the whole film changed (a look) the playhead stays.

### 5.3 The chips under the latest answer

At most four. First "N to check" when the review found something. Then, in slice A, a fixed list
("Shorter", "Bigger captions", "Add zooms"). In slice B the list comes from the turn: after a change
its opposite or its next step where one exists ("Zoom less", "Hold it longer"). Written by code; the
model is not asked.

In slice A "N to check" opens the findings as a short list, each with "Show". In slice B it opens the
finding's card at its moment (screen 8).

### 5.4 Words on screen

One problem at a time, each a sentence and one action, as the dev page does. The routes' sentences
are shown as they are. The first cut's line is one of: "Cut from A to B seconds. Captions and a label
are on." · "Captions and a label are on." (nothing to cut) · "No speech was found, so there are no
captions." The agent's `say` is English only today (X120); the page's own words go through the app's
usual strings.

## 6. What is stored

Two tables, additive, on the production database (the owner's word given 2026-11-24, "continue wiht
your recommendation"; the migration is written as a task, reviewed, then applied by the controller):

- `edits`: `id`, `user_id`, `thread_id` (its chat), `take_id`, `title`, `look` (a preset's id, `house`,
  `video` or `words`), `style` (the profile used), `head` (the turn shown), `export_job`, `export_turn`,
  `created_at`, `updated_at`.
- `edit_turns`: `edit_id`, `n`, `kind` (`cut`, `change`, `direct`, `said`), `request`, `at` (the frame a
  request was about; null without one), `say`, `findings`, `kept` (findings put away), `doc` (the edit
  after this turn; null for `said`, an answer that changed nothing), `created_at`. Key `(edit_id, n)`.

Undo moves `head` to the turn before that holds a `doc`. A new turn made while `head` is not the last
drops the turns after `head`. A document is 3 to 20 KB; an edit is capped at 300 turns. Rows are read
by their owner and written only by the routes, as `edit_takes` is.

The chat holds one message with one block, `{type: "edit", props: {editId}}`. The card reads the edit's
title, length, look, poster and date from the edit, so it is never out of date.

## 7. Routes

All behind the gate and the CSRF guard the edit routes already have. New:

| Route | Does | Slice |
|---|---|---|
| `POST /api/edit/edits {take}` | makes the edit, its chat and the chat's card; the take may still be uploading | A |
| `GET /api/edit/edits/[id]` | the edit, its take's state and job, the turn shown, the turns' words, the export's state; signs fresh addresses each time | A |
| `POST …/cut {look?}` | the first cut, or a new one in a look: a preset's id, a reference's profile, or words | A |
| `POST …/change {request, at?}` | the agent's change on the turn shown; `at` is used from slice B | A, B |
| `POST …/ops {ops}` | direct operations, from a list of two: `word.set`, `captions.set` | A |
| `POST …/head {n}` | Undo and Redo | A |
| `POST …/export`, `DELETE …/export` | a render of the turn shown; giving it up, and stopping the worker's call where it can be stopped | A |
| `POST …/kept {finding}` | puts a finding away for the turn shown; carried to the next turn while the same finding is still there | B |

They call what exists: `firstCut`, `change`, `applyOps`, `review`, the render job, `refusedFiles`.
Used as they are: `POST takes`, `takes/[id]/uploaded`, `jobs/[id]`, `references`.

The page asks for the first cut when it reads a ready take and no turn. A creator who left during the
wait gets the cut when they come back; nothing runs for an edit nobody is looking at.

Two turns at once on one edit cannot both land: the key `(edit_id, n)` refuses the second, and the
route answers 409 as the agent's hold does. No turn is made while an export runs.

## 8. What changes outside the editor

From the new look's code as it stands at `9478c611`:

- Home: `HOME_SKILLS`, `FIELD_TOOLS`, `ToolId` and `SKILLS` get `edit`; the composer's send, with
  Edit picked and a video staged, starts the upload, makes the edit and pushes `/edit/{id}`.
- Thread: a block schema and its registry entry, an `AnswerPart` and its `partsOf` case, a `PartView`
  case, the legacy renderer's map.
- Library: `PieceKind` gets `edit`.
- Shell: `/edit/` joins `/simulation/` where Back and the hidden tab bar are decided.
- The agent (slice B): its context names the moment a request is about (`context.ts`, the prompt).

Flag off must render as before: the new-look parity snapshot, the flag-off tests of each touched part,
and the probe and compare scripts.

## 9. Proof

Tests exercise the real thing: the reducer, `firstChangedFrame` and the routes' rules as units against
real edits; the routes against the database with only the worker and the model stubbed at their own
boundary.

Then, for each slice, in a signed-in browser at 390 and at 1280, on the real app with the real worker,
as the test account (`e2e/create-test-user.ts` makes one where none is set up; its id joins
`EDIT_CREATORS`): a take attached on Home, the first cut, one change, one word fixed, a look switched
and undone, an export, the file read with ffprobe; a reload at each wait; the built screens beside the
drawing, light and dark.

Slice B adds: E15's eighteen runs; each fix of E18 three times on real edits; the preview beside a
screenshot of each app.

Not provable on this Mac, and the screens are phone-first: a real iPhone. Tests 1, 2 and 6 of the edit
spec were never run, and neither was the share sheet or an upload over mobile data. Remotion 4.0.546
is said to fix the Safari memory growth and was never checked.

## 10. Not in this piece

The strip of clips; split, trim, delete, speed; title, call-out and sound sheets; a tap on the video;
"Edit this moment"; "Check it"; a price; a quota; several takes; resumable uploads; a restyle that
keeps the changes; the agent speaking the creator's language.

## 11. What the owner owes

1. His reaction to the second drawing, whenever he has one; the build does not wait for it.
2. One raw take from his iPhone, and a quarter of an hour with the iPhone on a Wi-Fi he trusts. Only
   the phone proof waits for this.
