# The result page on real simulation data

Date: 2026-11-19 · Status: approved by the owner 2026-11-20 ("looks good lets go with your
recommendation": slice A is built now; section 5b is the agreed target for the edit tool's screens) ·
Build part 2 of 6 · Plan: `docs/superpowers/plans/2026-11-20-result-page-slice-a.md`

This replaces the first draft of the same day (git: `579fc3d8`). That draft was written from the code
and the mock's numbers; checked against 25 stored simulations and a repeat test it did not hold. What
changed and why is in `.scratch/next-look/part2/real-runs-findings.md` (sections 1 to 10, on disk only)
and on four sheets beside it (`real-runs-1-number.png` … `-4-repeat-test.png`).

Foundation (part 1): `docs/superpowers/specs/2026-11-18-foundation-look-and-shell-design.md`.

## 1. What this part delivers

One result page in the new look, behind `NEXT_PUBLIC_NEW_LOOK`, built in two slices.

**Slice A, the video result:** a player with the still-watching curve and the strip of scenes, one
number, the moment viewers leave, three panels (Brain, Engagement, Audience), and the state for a run
that came back without an audience. The edit tool joins this page later (section 5b).

**Slice B:** "your usual", the running state, and the result of a hook simulation.

Not in this part: thread cards and the message field (part 3), links from Library (part 4), sharing, a
fix button, and anything the engine does not produce today (section 11).

## 2. Rulings this rests on (owner)

- 2026-11-18: the result page is a player; Brain, Engagement and Audience follow the playhead. Copy is
  short and plain. Say "Simulate", never "Test". Ten viewer groups everywhere. Show it through UI, not
  text.
- 2026-11-18: built UI is checked in a browser against the reference before it counts as done.
- 2026-11-19: build the page on the data the app produces today; leave out what does not exist.
- 2026-11-19: the one number for a video is **"watch to the end"**. The sentence is counted in viewers.
  No Cut button. "Usual" is a number; a status needs a real distance. "Low confidence" and "Don't post
  yet" are not shown.
- 2026-11-19: surfaces first. Whether the engine's number is accurate is a separate, later track.

## 3. What the engine gives a video run (measured)

- **Ten simulated viewers**, one per viewer group in most runs. Their weights are fixed by the engine:
  six carry about 15% each, the other four 1 to 5%. Some runs have 8 groups (a group twice or three
  times, another missing).
- **4 to 19 scenes.** A one-take talking video is cut into 2-second pieces.
- **Per viewer: the scene they leave in, or none.** The stored second is that scene's START. So the
  share still watching is known at the END of each scene, not in between.
- **No reasons** for leaving on current runs. No likes. No "usual". Scene frames exist for about 30
  days after a run.
- **Sometimes no audience at all.** Until PR #562 is merged this is most runs (3 of 10 in the test);
  after it, 6 of 6 in the same test. The page must handle it either way.
- The craft grader's score, its confidence label and its "Don't post yet" line change between runs of
  one clip (29 and 82 on the same video). The page does not show them.

## 4. The one number

- **Video:** the share of the simulated audience that watches to the end: the last value of the
  still-watching curve. Whole percent. Label: "watch to the end".
- **Hook:** `population.stopPct`, label "would stop to watch" (unchanged; not yet checked on real hook
  runs, see section 6).
- One function, `headlineOf`, in `src/lib/result/headline.ts`. Thread cards and Library (parts 3 and
  4) must call it. Legacy screens keep their numbers until they are replaced.

**Your usual (slice B).** The median headline of the user's 20 most recent finished video simulations
on engine 3.8 or later, without the current one. Shown from five. It appears as a quiet line under the
gauge, "your usual 47%", and as a small grey mark outside the gauge's track. Before five runs neither
is shown. A status ("Above your usual" in
`--color-above`, "Below your usual" in `--color-below`, the arc in the same colour) appears only when
the difference is at least the weight of two heavy viewers (about 29 points). On the stored runs that
happens rarely; most pages show the neutral line and an ink arc. Source: a read-only endpoint
`GET /api/simulations/usual`, computed from rows that already exist. No schema change.

## 5. The video result (slice A)

Reference: `.scratch/next-look/part2/result-page-as-specified.png` (row A: result, Audience,
Engagement, a later drop with its frames gone, no audience; row B: the edit tool on the page; then
desktop), and the v11 sheets for the Brain panel's look. Reviewed by the author and by an independent
critic on 2026-11-19; the points below include both.

**One thread.** The page answers three questions in this order: how did it do (the number), where and
what loses people (the moment), what now (one next step). Coral means one thing on the whole page: the
moment the sentence names. It marks that scene on the curve, its viewers in the ring and their rows.

**Hero.** The video, the gauge with the number, the curve. The gauge is the smaller part, the curve the
larger (phone: gauge about 148pt, curve plot 100pt tall). Under the gauge, when it exists, a quiet line
"your usual 47%" and a grey mark on the gauge's track.

**The curve.** 100% at 0:00, then one point at the end of each scene, joined by straight lines: inside a
scene nobody knows when a viewer leaves, so its loss is drawn as a slope across it. Small ticks mark
the scene borders. The scene the sentence names is drawn in `--color-below` on a soft band of the same
colour (at least 8pt wide, so a one-second scene is still visible). Everything else is ink.

**Player.** Tapping the video plays it; playing moves the playhead; dragging the playhead seeks the
video; left and right arrow keys step by scene. While the playhead moves, a readout shows a stored
value: the share at the end of the scene under it ("71% · 0:03"). At rest the playhead sits at the end
of the clip, the video shows its first frame, and there is no readout: the gauge is the number.
Pressing play starts from 0:00. If the video file is gone the page shows the scene's frame; if the
frames are gone too, a quiet tile with the clip's length, no play button, and the curve still scrubs.

**The moment.** One row under the hero: the frame of the named scene (64 by 114pt), the sentence, and
under it the engine's one-sentence description of what is on screen in that scene, cut to two lines.
The whole row is one tap target and plays from the start of that scene. No frame: the row is the
sentence and the description. No usable description (missing, or the engine's placeholder): the
sentence alone.

The sentence, from the run's own viewers (`src/lib/result/verdict.ts`):
- two or more heavy viewers (10% or more each) leave in one scene → "A third leave by 0:03." The
  fraction is everyone gone by the end of that scene (A third, Half, Two thirds, Most), so it reads
  like the rows ("Left by 0:03"). For the first scene: "… in the first 3 seconds." If several scenes
  qualify, the one that loses the most; the earlier on a tie.
- otherwise, two or more heavy viewers leave over the clip → "They leave bit by bit." No coral.
- otherwise → "Most watch to the end." ("They watch to the end." when nobody leaves.) No coral.

**One next step: the editor.** Not a cut with a projected gain (ruled out: no such gain follows from
this data), and nothing that needs the chat. The page's one button opens the edit tool on this same
page (section 5b): black "Edit this moment" when the sentence names a scene, a quiet "Edit" otherwise.
Until the edit tool's screens exist (it is built in another worktree, `~/virtuna-edit`), slice A ships
without this button.

**The strip.** Under the curve, on the same time axis, the video's scenes as a strip of their frames
(when the frames exist). The named scene carries the coral mark. It is the same strip the editor
works on.

**No audience.** When the run has no simulated viewers the page shows the video and the line "No
audience came back." No number, no curve, no panels, and no score from the craft grader. The button
"Simulate again" is built but not offered yet (section 12): today the server would delete the stored
video if the new run is refused or fails.

**Did not finish.** A run still marked as in flight six minutes after it started (its pipeline died)
shows "This simulation did not finish." and the way Home. A run that is not there shows "This
simulation is not here."

**Brain.** The existing 3D brain (`CortexCanvas`, browser only) driven by the existing model at the
playhead. Four rows, Eyes, Focus, Feeling, Wandering, each a curve over the clip with its value at the
playhead; the dashed line is the resting level, labelled "at rest". Caption: "A model of attention, not
a scan." Not yet looked at on stored runs: the plan starts by rendering it on three of them.

**Engagement.** "Avg watch" as a bar of the clip's length with the time beside it ("0:16 of 0:29"),
a scene's loss spread over that scene (the existing helper counts every leaver at the start of their
scene and reads low). Below it "What viewers are likely to do": Share, Comment, Rewatch and Save as
four bars, the longest first, without verdict words: the engine has no threshold for "low" or "high".
This panel does not move with the playhead; the engine has nothing per moment for it.

**Audience.** Everything is counted by weight, like the number. The ring has one wedge per group in the
run, sized by the weight that group carries. A wedge is full while its viewer watches and empties when
the playhead passes the end of the scene they leave in, the whole wedge at once. The wedges of the
viewers who leave in the named scene turn coral instead of pale. A group that is not in the run is an
outline. The centre shows the share still watching at the playhead ("46% stayed" at rest, "71%
watching · 0:03" while it moves). Below, the groups as rows under two small headings, "Left" (earliest
first, with "Left by 0:03"; coral for the named scene) and "Stayed" ("To the end"). A row's dot is
large for a heavy viewer and small for a light one; there are no percentages and no head counts.
Caption: "One simulated viewer per group."

**Details** (the craft grader's six scores) is not in this part: those numbers change between runs.

**Header.** Back, the chat's title (if the simulation has none, "Video · 0:29"), new chat. No share
button. Every control is at least 44pt to tap.

**Scrolled, phone.** The hero collapses to a compact player (frame, curve, playhead) with the number
at the curve's end. **Desktop.** Video left with only a play button on it; right: the gauge beside the
moment and the next step, then the curve as its own full-width card, then the panels.

## 5b. The edit tool on this page (arrives with the edit tool)

Owner, 2026-11-19: the other session is building the edit tool, so it belongs in this UI, and the
chat does not have to be connected yet. The edit tool's own design already puts its editor on "a
page with the video and one strip of clips" (`~/virtuna-edit/docs/superpowers/specs/2026-11-19-edit-design.md`,
sections 9 and 12, part 4). That page is this page. Drawn in row B of the reference sheet (screens 6
to 10); nothing here is built in part 2.

- **Edit mode.** The video large, the number as a small badge on it, the curve over the strip, the
  playhead, a "Done" button. With a scene selected: Split, Speed, Replace, Delete. With nothing
  selected: Captions, Text, Sound, Look. These are the edit tool's own operations and kit parts
  (shot.split / trim / remove / set; four caption looks; title, call-out, progress bar, cutaway;
  sounds; six looks).
- **"Ask for a change".** One field under the tools. It goes to the edit tool's agent, which answers
  with what it changed. It is not the chat.
- **Text → a hook title.** The app's three rewrites of the first line are offered as a title over the
  first second (the kit's Title part). This is where "other openings" lives.
- **After a change.** The changed scene is marked on the strip and one button appears: "Simulate
  again · 10 credits". It simulates the edited video as a new run.
- **The new result.** The result page of the new run, with "was 46%" under the gauge and the earlier
  curve as a dashed line, and two buttons: "Keep this version" and "Undo". The number is a real
  simulation of the edited video, never a projection.
- **Scenes and shots.** The result's strip shows the engine's scenes; the editor works on the edit's
  shots. For a video uploaded as one file the edit starts as one shot, and cutting a scene is a split
  and a remove on it. How the two line up for a video made from several takes is for the edit tool's
  part 4.

## 6. The hook result (slice B)

As in the first draft: the hook on its tile, the gauge with "would stop to watch", one sentence, two
panels (Brain with four bars against "at rest"; Audience as the 1,000-dot ring filled per group, ten
rows with a percent). No curve, no play button. **Not checked on stored hook runs yet.** Before this
slice is planned, the same check as for video runs: dump the stored ones, feed the screen, look.

## 7. The running state (slice B)

Shown on the video result's own address while the run is in flight. The video's cover in a faint ring.
One line and one bar, in three stages taken from the events the server already sends: "Reading your
video" until the scene plan arrives; "Scene 4 of 9" while frames arrive, shown as a row of small
frames; "Showing it to your audience" until the run finishes. Then the result appears once: the wedges
fill and the gauge counts up in at most 1.2 seconds, not at all under reduced motion. If the run ends
without an audience, the "No audience" state of section 5. If the event stream is unavailable the
first line stays and the page keeps asking for the result; after six minutes an error with a way back.

## 8. Addresses and ways in

- `/simulation/[id]` for a video (the id of the analysis) and `/simulation/hook/[threadId]/[key]` for a
  hook (the key is a short hash of the hook's text).
- Both are pushed screens in the new frame; Back returns to the chat. The header is the one from part
  1 (Back, title, new chat). No share button and no "Library /" crumb in this part.
- Flag off: both addresses answer "not found" and `/analyze/[id]` is unchanged. Flag on:
  `/analyze/[id]` redirects to `/simulation/[id]`.
- Under the flag, the video card's door and the composer's fallback open `/simulation/[id]`. The
  legacy side panel is not opened from those doors any more.

## 9. Code layout

- `src/lib/result/`, pure functions on a stored run, each tested on recorded runs:
  `curve.ts` (points per scene end, heavy-viewer scenes), `headline.ts`, `verdict.ts`,
  `avg-watch.ts`, `group-state.ts`, `video-model.ts` (the one object the page renders from),
  later `usual.ts` and `hook-model.ts`. They read the stored heatmap directly and do not call
  `curveBreak`, `videoAnswer` or `watchStatsOf`, whose timing is one scene off. The working draft of
  the rule is `.scratch/next-look/part2/rule.cjs`.
- `src/components/result/`: the page, hero, gauge, curve, player, the three panels, the ring, the
  no-audience state, the shared playhead. Tokens and base parts only; the folder joins the guard that
  bans colour literals and glass.
- `src/app/(app)/simulation/…` for the addresses; later `src/app/api/simulations/usual/route.ts`.
- Data: the video page reads the analysis row through the existing `usePermalinkAnalysis`.
- Recorded runs for the tests: a handful of stored heatmaps copied into
  `src/lib/result/__tests__/fixtures/` (early drop, middle drop, bit by bit, holds, 8 groups, 19
  scenes, no audience).

## 10. Done when

Slice A:
1. With the flag off the app renders exactly as before (the part 1 comparison passes).
2. A stored video run opens at `/simulation/[id]`, plays or scrubs, and all three panels follow.
3. The number equals the last value of the curve, and no other score appears on the page.
4. For each recorded fixture the sentence and the coral scene match what `rule.cjs` gives today.
5. A run without an audience shows the no-audience state. ("Simulate again" starts a run in the
   tests; it is not offered in the app until the server change of section 12.)
5a. The scene strip shows under the curve when the run has frames.
6. Phone (393) and desktop (1440), light and dark, match the reference in a browser: measured
   positions for hero, gauge, curve and panel switch, and side-by-side sheets.
7. Keyboard: the panel switch and the curve are fully usable; focus is always visible.
8. The pure functions are tested on recorded runs, without stand-ins for our own code.

Slice B: the usual line and mark appear from five runs and the status only at two heavy viewers'
distance; a run opened in flight shows the three stages and then the result; a stored hook result
opens at its address.

## 11. Not in this part

For the engine track, later: whether the number tells a strong video from a weak one (an exam of
posted videos is prepared in `~/reports/maven-exam/`); more simulated viewers; when inside a scene a
viewer leaves; reasons for leaving; a "usual" from real posts; a fix that is simulated again; scene
frames that do not expire; the wording and trim of today's result screen, which are one scene off.

For billing: the code's trial is 50 credits for 3 days at $1; the ruling is a free 7-day trial.

## 12. Known gaps and risks

- The page shows an audience for most videos only once PR #562 (the audience step) is merged.
- A 19-scene run is slow (43 seconds for the audience step against a 45-second limit); longer
  one-take videos may come back without an audience and land in that state.
- Brain, Engagement's levels and the hook result have not been looked at on stored runs.
- "Simulate again" costs a simulation; whether a failed run is charged is not ruled.
- **"Simulate again" is switched off** (built, tested, behind `simulateAgain` on `ResultPage`).
  It hands `POST /api/analyze` the file the first run still plays from, and that route's cleanup
  did not expect a stored file. The server side is fixed in pull request #563; the button is
  switched on once that fix is in this branch's base.
- An anonymous funnel visitor's result arrives sealed (no audience data). The new page has no
  sealed state and would say "No audience came back." Not designed yet; before cut-over.
- The video's signed address lasts an hour; a page left open longer cannot play until reloaded.
- Back uses the browser's history when there is any, so a pasted link in a tab with history can
  lead out of the app.
- The brain model lags the video by about five seconds and starts with the same rise on every run
  (a drop at 0:03 shows around 0:08). A model property, for the engine track.
- The next step is the editor (section 5b), which is not built yet; slice A has no button until it is.
- The engine's scene descriptions are shown as written; some are clumsy or generic. The stored first
  line holds prompt text on engine 3.23 ("INSTRUCTION: …"); then "Yours" is left out.
- Section 5b is a drawing agreed between two tracks, not a build item of this part. The edit tool's
  worker (upload analysis, render), its agent and its screens are its own parts 2 to 4.
- The reference sheet's "simulated again" screen pairs a stored run of the original (engine 3.23)
  with a new run of the really cut clip (engine 3.25): both real, not a fair measure of the cut.
- Where a video run records which audience it used is confirmed in the plan.
- The number is not calibrated: a two-minute clip read 71%. The page states it plainly as the
  simulation's result and makes no promise about real views.
