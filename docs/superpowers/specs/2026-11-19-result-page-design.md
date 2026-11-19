# The result page on real simulation data

Date: 2026-11-19 · Status: draft, waiting for the owner's review · Build part 2 of 6

Foundation (part 1): `docs/superpowers/specs/2026-11-18-foundation-look-and-shell-design.md`.
Inputs for this part, on disk only (`.scratch/next-look/part2/`, not in git):
`result-data-inventory.md` (every element of the reference against what the app produces),
`result-ui-map.md` (how results are shown today), and the redrawn reference in `renders/`.

## 1. What this part delivers

One result page in the new look, behind `NEXT_PUBLIC_NEW_LOOK`:

1. The result of a video simulation: a player with the still-watching curve, one headline number,
   one verdict sentence, one action, and three panels (Brain, Engagement, Audience).
2. The result of a hook simulation: the hook, the same headline, Brain and Audience.
3. The running state of a video simulation.
4. One rule for the headline number, used by every later part.

Not in this part: thread cards and the message field (part 3), links from Library (part 4), sharing,
and anything the engine does not produce today (section 11).

## 2. Rulings this rests on (owner)

- 2026-11-18: the result page is a player; Brain, Engagement and Audience follow the playhead. Copy is
  short and plain. Say "Simulate", never "Test". Ten viewer groups everywhere.
- 2026-11-18: built UI is checked in a browser against the reference before it counts as done.
- 2026-11-19: build the page on the data the app produces today. Where the reference shows something
  that does not exist, the page leaves it out. Extending the engine is a separate, later track.

## 3. What exists and what does not

| The v11 reference shows | The app produces | This part |
|---|---|---|
| "38% watching at 3s" | A still-watching curve per scene, from 10 simulated viewers | Uses the curve's value at 0:03 |
| "usual 58%" | Nothing in that unit | Computes it from the user's own past simulations (section 4) |
| A smooth curve with a dashed "usual" line | One point per scene | Draws the real points; no "usual" line |
| Likes, comments, shares, saves per 1,000, with timing and "vs usual" | Average watch, share who finish; comment, share, save and rewatch as a 0–100 intent score | Two numbers and four levels |
| A ring of 1,000 dots with a % per group (video) | Ten groups with real sizes; one to three viewers per group | A state per group |
| The same ring for a hook | 1,000 projected viewers, a % per group | As drawn |
| Dots leaving live during a run, a live count | The cover, the scene frames one by one, "finished" | Three real stages |
| "Cut the greeting 38 → 64%", then Keep / Compare / Undo | A calculated projection; nothing cuts or re-simulates a video | A preview of the cut |
| A hook playing word by word against a curve | One number per hook, no time axis | No curve on the hook page |

## 4. The one number

Today the same video shows up to five different headline numbers across the app (craft score,
"viral N", "N% who would stop", "X% leave by m:ss", overall score). The new look shows one.

- **Video:** the share of simulated viewers still watching at 0:03, read from `retentionCurveOf` at the
  end of the 0–3s scene. Label: "watching at 3s".
- **Hook:** `population.stopPct`. Label: "would stop to watch".
- Whole percent. One function, `headlineOf`, in `src/lib/result/headline.ts`. Thread cards and Library
  (parts 3 and 4) must call it. Legacy screens keep their numbers until they are replaced.

**Your usual.** The median headline of the user's 20 most recent finished simulations of the same
kind, without the current one. Shown from five. Six points or more above is "Above your usual"
(`--color-above`), six or more below is "Below your usual" (`--color-below`), otherwise "About your
usual" (ink). The gauge's arc takes the same colour. With fewer than five, the page shows no status
line and no "usual" tick, and the arc is ink.

Source: a new read-only endpoint, `GET /api/simulations/usual?kind=video|hook`, returning
`{ median, count }`. It computes from rows that already exist (`analysis_results.heatmap`; text seals in
`threads.sim_seals`) with the same pure function the page uses. No schema change. Cached per user for
five minutes.

## 5. The video result

Reference: `renders/a-{light,dark}-phone-sim*.png`, `a-light-desk-sim*.png`.

**Hero.** The video, the gauge, the status line. Below them the still-watching curve: a point at 0:00
(100%) and one per scene end, joined by straight segments. The steepest drop (`curveBreak`) is drawn in
`--color-below`. A playhead with a label ("34% · 0:07") shows the value of the scene under it.

**Player.** Tapping the video plays it; playing moves the playhead; dragging the playhead seeks the
video; left and right arrow keys step by scene. One playhead time is shared by the hero and all three
panels. If the video file is gone (files are deleted after 30 days) the page shows a frame or a neutral
tile, hides the play button, and the curve still scrubs. A signed address that has expired is renewed
once.

**Verdict.** One sentence, from `videoAnswer(...).head`. The reference's wording ("The greeting loses
them.") is an illustration; the page shows what the existing function writes. No new model call.

**The action.** Shown when a trim exists and its projection is six points or more above the headline.
Label "Cut 0:00–0:03" with "38 → 64% projected". Tapping it previews the cut: the video starts after
the cut, the curve shows the projection with the original as a faint line, the gauge shows the
projected number with a "Projected" tag, the sentence reads "Projected without the first 3 seconds.",
and the button becomes "Back to the original". The three panels keep describing the original video.
There is no Keep, Compare or Undo.

**Brain.** The existing 3D brain (`CortexCanvas`, loaded only in the browser) driven by the existing
model (`driveFor`, `predictedBold`) at the playhead. Four rows, Eyes, Focus, Feeling, Wandering, each a
curve over the clip with its value at the playhead; the dashed line is the resting level and is labelled
"at rest". Caption: "A model of attention, not a scan."

**Engagement.** Two tiles: "Avg watch" in seconds and "Finished" in percent (`watchStatsOf`). One card,
"How likely viewers are to act", with Comment, Share, Save and Rewatch, each a three-step bar and a
word: 0–33 Low, 34–66 Medium, 67–100 High.

**Audience.** The ring with ten wedges sized by each group's share of the audience. A group's state at
the playhead comes from its own viewers: all still watching is "Staying" (wedge full), some is "Mixed"
(inner half), none is "Left at m:ss" (empty), no viewer in this run is "Not in this run" (outlined). The
centre shows the curve's value and time. Below, ten rows: name, share, state. Caption: "A video
simulation runs up to three viewers per group."

**Details.** A quiet row under the panel opens a sheet: the six graded scores (name, score out of 10,
one line) and up to three other openings. Hidden when the run has no grading.

**Flags on the run.** "Low confidence" as a tag under the gauge when the run says so. "Don't post yet"
as a line above the verdict, with its reason below, when the run's gate is set.

**Scrolled, phone.** The hero collapses to a compact player (frame, curve, playhead); the action stays
as a bar above the bottom edge. Desktop: video left, hero and panels right, as drawn.

## 6. The hook result

Reference: `renders/a-{light,dark}-phone-text*.png`, `a-light-desk-text*.png`.

The hook on its tile, the gauge with "would stop to watch", the status line, one verdict sentence. No
curve and no play button. Two panels: Brain (the brain and four rows with a bar, a tick for "at rest"
and a value) and Audience (the 1,000-dot ring filled per group, the headline in the centre, ten rows
with a percent and a bar). Details opens a sheet with what viewers said: up to five quotes with their
group, and the most common reasons. The "Script it" button belongs to the chat and arrives with part 3.

## 7. The running state

Reference: `renders/a-{light,dark}-phone-run-p0*.png`, `a-light-desk-run-p05.png`.

Shown on the video result's own address while the run is in flight. The ring, faint, with the video's
cover in its centre. Under it one line and one bar, in three stages taken from the events the server
already sends: "Reading your video" until the scene plan arrives; "Scene 4 of 9" while frames arrive,
shown as a row of small frames; "Showing it to your audience" until the run finishes. When it finishes
the groups fill and the gauge counts up once, in at most 1.2 seconds, and not at all under reduced
motion. No live count, no dots leaving, no brain. If the event stream is unavailable the first line
stays and the page keeps asking for the result; after six minutes it shows an error with a way back.

## 8. Addresses and ways in

- `/simulation/[id]` for a video (the id of the analysis) and `/simulation/hook/[threadId]/[key]` for a
  hook (the key is a short hash of the hook's text, which is how its result is stored).
- Both are pushed screens in the new frame; Back returns to the chat. The header is the one built in
  part 1 (Back, title, new chat). The reference still draws a share button and, on desktop, a
  "Library /" crumb: neither is built in this part.
- Flag off: both addresses answer "not found" and `/analyze/[id]` is unchanged. Flag on:
  `/analyze/[id]` redirects to `/simulation/[id]`.
- Under the flag, the video card's door and the composer's fallback open `/simulation/[id]`; a hook
  card's door opens the hook address when its result exists. The legacy side panel is not opened from
  those doors any more.

## 9. Code layout

- `src/lib/result/`, pure functions: `headline.ts`, `usual.ts`, `video-model.ts`, `hook-model.ts`,
  `group-state.ts`. They call the existing helpers in `src/lib/surfaces/` and `src/lib/brain/` and do not
  change or copy them. Each page renders from one model object.
- `src/components/result/`: the two pages, the running state, hero, gauge, curve, player, the three
  panels, the ring, the details sheet, the shared playhead. Tokens and base parts only. The folder is
  added to the guard that bans colour literals and glass.
- `src/app/(app)/simulation/…` for the two addresses; `src/app/api/simulations/usual/route.ts`.
- Data: the video page reads the analysis row through the existing `usePermalinkAnalysis`; the hook
  page reads the stored result from its thread.

## 10. Done when

1. With the flag off the app renders exactly as before (the part 1 comparison passes).
2. A real video simulated on the development account opens at `/simulation/[id]`, plays, scrubs, and
   all three panels follow the playhead.
3. The page's headline equals the curve's value at 0:03, and no other headline number appears on it.
4. A real hook result opens at its address with Brain and Audience.
5. A run opened while in flight shows the three stages and then the result, with no invented progress.
6. Phone (393) and desktop (1440), light and dark, match the part 2 reference in a browser: measured
   positions for hero, gauge, curve, panel switch and action, and side-by-side sheets.
7. Keyboard: the panel switch, the curve and the sheet are fully usable; focus is always visible.
8. The models are tested on real recorded runs, without stand-ins for our own code.

## 11. Not in this part

For the engine track: 1,000 viewers for a video; a per-second curve; a "usual" from real posts; likes;
when viewers act; results arriving during a run; simulating a cut again; a hook's word-by-word curve;
simulating a script beat by beat; a record of predictions against real outcomes.

For billing: the code's trial is 50 credits for 3 days at $1; the ruling is a free 7-day trial.

## 12. Known gaps and risks

- Which legacy result screen users get in production depends on flags that were not read.
- `retentionCurveOf`'s exact indexing at 0:03 is confirmed in the plan, on a recorded run.
- The 3D brain was tuned for a dark ground; its look on the light ground is checked in a browser first,
  and adjusted through a prop if it does not hold.
- Where a video run records which audience it used is confirmed in the plan; the ring needs its shares.
- A hook's result is stored under the hook's full text inside its thread; the address scheme and
  loading it on a cold start are confirmed in the plan.
- "Your usual" reads up to 20 stored runs; if that proves slow on real data it drops to 10.
- A rewatch level needs an aggregate that may only exist per viewer; the plan confirms it.
- The verdict's wording is whatever the existing function writes; it will read plainer than the
  reference.
- In the cut preview the panels still describe the original video.
