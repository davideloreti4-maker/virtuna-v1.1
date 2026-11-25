# Handoff 2026-11-19 — the edit tool, built fresh on Remotion

Start here. This replaces `docs/HANDOFF-2026-11-12-auto-edit-part2.md`, which lives only in the old
worktree `~/virtuna-openfilm` (uncommitted there) and is history: read it for how the decisions
below were reached, not for what to build.

## Where things stand

- **Worktree `~/virtuna-edit`, branch `feat/edit`, cut from `main` at `0efcddd6` on 2026-11-19.**
  `pnpm install` is done. Baseline on untouched main: `tsc` clean, 6 726 tests pass.
- **The design:** `docs/superpowers/specs/2026-11-19-edit-design.md`. Read it first. Rules N1 to
  N9, the edit document (§5), the kit, upload analysis, the agent, the Player, the render, six
  tests, five parts, decisions X1 to X37. The owner said to continue on it; he has not read the
  decisions X14 to X37, which were taken while building.
- **Part 1a is built and committed locally (five commits, `14d6ac27` to `7362f555`, not pushed):**
  the edit document, what follows from it, its checks and its operations, in `src/lib/edit/` (pure
  TypeScript, zod, no engine code). 189 tests; the whole repository's suite passes (6 915 tests).
  The plan, as carried out: `docs/superpowers/plans/2026-11-19-edit-document.md`. The branch has
  no upstream set, on purpose, so a bare `git push` goes nowhere.
- **Part 1b, the kit and a page that plays an edit, is built.** Its plan, with every box ticked
  and how each was proved: `docs/superpowers/plans/2026-11-19-edit-kit.md`. In `src/edit/film/`:
  the footage of a run (`Footage.tsx`), six looks (`looks.ts`), five parts (`parts/`: title,
  call-out, progress bar, cutaway, sound), captions in four looks (`pages.ts`, `Captions.tsx`),
  the kit's own line breaking (`lines.ts`), the film (`Film.tsx`, seven cuts), the typefaces
  (`fonts.ts`), what a browser without WebGL 2 gets (`grading.ts`). In `src/edit/player/`:
  `EditPlayer.tsx`. `/dev-edit` plays a hand-written edit of the owner's take and sends changes
  through the door.
- **What is seen is what is posted, measured** (test 4, `scripts/edit-preview-vs-render.ts`): on 129
  frames of 53 edits the Player's picture and the rendered still agree in Chromium (at worst 0.29 %
  of pixels far apart, colours 1.1 levels of 255 apart) and in WebKit (0.34 %, 1.7 levels). It
  starts its own dev server when none runs. **Run it after any change to how the film draws**;
  how is in the kit plan, Task 8. `scripts/edit-film.ts` renders a whole edit to a video file.
- **Eight faults that comparison and one independent review found, all fixed** (design X30 to
  X37, none read by the owner yet): footage left black in a browser without WebGL 2; a vivid look
  that turned a grey wall orange; letters 7 % fuller in the posted file than in the preview,
  because the film took the app's text smoothing; a title's third line two pixels off in WebKit; a
  label title on five lines instead of three; Chrome and Safari breaking the same title's lines
  differently; a call-out a pixel smaller in Safari, because the two kern a hyphen differently;
  one failing clip switching the whole film to the stand-in look. Each has a line in the plan
  with how it was seen.
- **Measured in the real renderer:** a volume above 1 is louder (6.0 dB a doubling, up to 2); the
  sound of a run cut in three is the same file as the run in one piece; a sound part starts on
  its frame; a 720p take turns soft from about twice its own pixels (a rule for `review`).
- **Not proved anywhere yet:** an iPhone (Playwright's WebKit is not Safari on a phone); files
  from R2 over a network (everything here was local); what the renderer does on the worker, where
  the browser draws in software; the film's sound by ear (it was measured, nobody has listened;
  the owner has the first rendered file, `.scratch/film/demo.mp4`).
- **Next part: the worker** (analysis of an upload, the render, storage), design §7 and §10. It
  needs the R2 token and `.env.local` from the owner. `review` (the quality check) and the
  recipes come with the agent; the rules found for `review` so far are in the design's open list.
- **Something on this Mac stops dev servers when a Claude turn ends** (five times on 2026-11-19,
  cleanly, each time together with the owner's own local app on port 3030; the cause was not
  found, his hook scripts show nothing). So: run anything that needs the dev server inside one
  command, or let the comparison start its own.
- **Start any server bound to this machine only** (`-H 127.0.0.1`). How to open `/dev-edit` is in
  the kit plan, Task 7.
- **To look at footage:** the owner's test take is at
  `~/virtuna-openfilm/.scratch/openfilm-spike/media/raw-take-720.mp4` (720x1280, 30 fps,
  12.7 s) and its words at `~/virtuna-openfilm/.scratch/agent-edit/words.json`. Copy them into
  `.scratch/media/` here (gitignored); they never go into git.
- **`pnpm add` in this repo bumps `react-grab`, `@react-grab/cli` and `bippy` every time.** Put
  their old blocks back in `pnpm-lock.yaml` and run `pnpm install --frozen-lockfile`; how is in
  the kit plan, Task 1.

## What part 1a settled, beyond the first design

Two independent reviews found real faults in the first two versions, and the document changed
twice. What a reader of the code must know:

- **A shot is a stretch of its file in milliseconds** (`startMs`, `endMs`), stored exactly as
  asked. **Frames are worked out, never stored** (`derive.ts`, `layout`). With stored frames
  every trim, split and speed change had to round, and the rounding leaked.
- **Runs.** Shots where each starts exactly where the one before stops (same file, same speed, a
  plain cut) are one run. Frames are counted on the run's clock. Marks, captions and the cover
  are placed by it (`placed`, `runWords`, `frameOf`, `coverFrame`), so `shot.split` changes
  nothing a viewer sees. Tests hold that over a thousand single cuts and over repeated random
  cuts with speeds, pictures and transitions.
- **A mark starts at a moment of its shot's file and lasts a length of film** (`atMs`, `lenMs`). A
  sound is a kit part like a graphic. There is no list of sounds. A call-out ends with its run;
  a sound, a cutaway and a title run on over cuts.
- **Nothing is removed that was not asked.** A trim hides marks, items and the cover; it never
  deletes them. The door refuses, judged at the end of the list, what was asked to show and
  would not.
- **A move has a part** (`framing.move.part`), which may reach before the move or past it, so a
  split or a trim keeps its pace and a trim taken back gives the move back.
- **A shot's look sits on the film's** (`lookOf`): a preset of its own or the film's, adjustments
  added on top.
- **An item counts frames from the film's start or back from its end** (`anchor`).
- **Files come only from the list the server offers:** `applyOps(edit, ops, library)`,
  `asset.add { id }`.
- **`checkEdit` refuses only what cannot be drawn.** Two titles at once, a mark that no longer
  shows, a caption on the face: all `review`'s, which is not built.
- **For the kit (part 1b):** draw a run as ONE piece of footage (one media element over
  `run.fromMs` to `run.toMs`), with the framing of each frame from `framingAt(shot,
  momentOf(run, frame))`; draw every mark and item on the film from `placed()` (`at`, `frames`,
  `skip`, `fileMs`), not inside a shot's sequence; captions per run from `runWords`; fade a
  run's sound only where the run starts and ends; draw order by kind of part, then by start.
  Checked against the engine on 2026-11-19, in the old trial project: a start between two source
  frames is taken, and the picture is the source frame on screen at that moment (not the
  nearest); a shot fading in and out at once is drawn; the engine refuses only a transition
  longer than the sequence beside it, which is what `checkEdit` now refuses too (X28); a volume
  given as a function of the frame, above 1, at another speed, renders. Not checked: whether a
  volume above 1 is really louder.

How it was proved: built test first; a mutation pass (single-rule breaks, each must turn the suite
red) with the runner at `.scratch/trial/mutate.mjs` (outside git; it runs on a copy in
`.scratch/trial/src`); two independent reviews, each followed by a rework.

**Open, written down in the spec under "Left open on purpose":** a cut that carries its own sound;
the caption line per shot; the largest zoom a file's size allows; a longer fade of a shot's sound;
merging, splitting and re-timing words.

## The owner's rulings of 2026-11-19, in his words

- "i want the ai agent to be able to edit it to the requirements of the user for example with
  animations etc. this editor needs to be good, clean and smooth"
- "we want whats get us the absulte best result inside the app when integrated"
- "lets go with remotion"
- "we dont want to reuse anything we had lets build it fresh in the best form"
- "on everytihng else ocntinue with your thought through recommendation we want the best tool this
  needs to be good"

So: Remotion `4.0.545` is the engine. No code, format or kit comes from the old branch
`feat/openfilm-edit` (draft PR 560, left untouched until he says what to do with it). Facts that
branch measured may be cited. The Modal account and the R2 bucket `edit-media` are kept.

## Evidence, all outside git

- `~/reports/Remotion best practice November 2026.md`: what to use, what to avoid, costs, six
  tests; notes in `~/research_notes/Remotion best practice November 2026/`.
- `~/virtuna-openfilm/.scratch/agent-native/`: the same take edited by an agent with three
  toolkits (`film/`, `hf/`, `remotion/`, each with `LOG.md`), the board
  `compare/three-toolkits.jpg`, and the player test (`player/measure.mjs`,
  `player/results/*.json`). The Remotion trial project there shows the official rules applied.
- `~/virtuna-openfilm/.scratch/agent-native/remotion-skills-src/skills`: Remotion's official agent
  skills at 4.0.545, cloned 2026-11-19. Subagents that write Remotion code read
  `remotion-best-practices` and `remotion-markup` there first.
- The owner's test take: `~/virtuna-openfilm/.scratch/openfilm-spike/media/raw-take-720.mp4`
  (H.264, 720x1280, 30 fps, 12.7 s) and its words in
  `~/virtuna-openfilm/.scratch/agent-edit/words.json`. The transcript's word times are up to 0.4 s
  early; cut points come from the sound.

## Rules for whoever works here

- Terse, plain words. Decide design questions and list the decisions; ask only what changes what
  gets built. Verify before claiming: run it, show the output. Tests exercise real behaviour; mocks
  only for input and output that cannot be run.
- **Commits stay local on `feat/edit`, made with `git -c core.hooksPath=/dev/null commit`, and are
  not pushed until the owner says push** (decision X13). The repo's hook pushes and sends a
  Telegram message on every commit; his rule is pushes only when asked.
- Never read `.env*`. A deny rule blocks it; do not work around it. Secrets go from his clipboard
  into `.env.local` with `.scratch/setup/env-put.sh`, which he runs himself.
- Nothing in the product is named after the engine (N9).
- Node 25 needs `NODE_OPTIONS=--no-experimental-webstorage` for vitest. zsh does not split `$VAR`.
  After `pnpm add`, restore lockfile hunks that are not about the added packages. Free disk was
  down to 1.0 GB on the evening of 2026-11-19 and about 5 GB later that night:
  `~/virtuna-openfilm/.scratch/agent-native/remotion/node_modules` holds 1 GB that can go once he
  agrees; he has been asked and has not answered. A sweep of the preview-against-render script
  keeps only failing frames' pictures for that reason.
- The probes that found today's faults are outside git in `.scratch/probe/` (jump, play-through,
  live change, colour distance, the lettering's box, lines and boxes in two browsers, how two
  browsers measure the same words); the demo edits and their makers are in `.scratch/media/`.
- The scripts in `scripts/edit-*.ts` have a type check of their own:
  `pnpm exec tsc -p scripts/tsconfig.edit.json`. The repo's check leaves `scripts/` out.
- Project versions on this branch: Next 16.1.5, React 19.2.3, zod 4.3.6, Tailwind 4, pnpm 10.

## What the owner owes

1. `! cp ~/virtuna-openfilm/.env.local ~/virtuna-edit/.env.local`, then the R2 token: the steps and
   the four `env-put.sh` lines were given to him on 2026-11-19 (the account id
   and the bucket `edit-media`; neither is a secret).
2. His iPhone on a Wi-Fi he trusts, for tests 1 and 2. Hand-test pages of the three trial players
   may still be served on this Mac at `127.0.0.1:8801` to `8804` (`try.html`); they are bound to
   this machine only.
3. An ElevenLabs key (test 5) and one take filmed on the iPhone in its default format (test 6).
4. A word on the old branch and draft PR 560.
5. A payment method on Modal before real use (about 85 cents of free credit were left on
   2026-11-12).
