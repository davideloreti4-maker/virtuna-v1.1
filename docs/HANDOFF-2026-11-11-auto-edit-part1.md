# Handoff 2026-11-11 (evening) — auto-edit: build part 1

Written at the end of the session that proved the render path, took the owner's rulings and wrote
the specs and the plan. Start here; do not redo what is listed as done.

## Update, same day (late): part 1 is built

"Do next" below is done up to step 4. Do not redo it; start from "Next" here.

- Branch `feat/openfilm-edit`: 15 commits on top of `main` (`0efcddd6`), all local. **Nothing is
  pushed.** The repo's `post-commit` hook pushes on every commit, so every commit here was made
  with `git -c core.hooksPath=/dev/null commit`. Keep doing that until the owner asks for a push.
- Checked on the last code commit (`2db67400`): `pnpm exec tsc --noEmit` clean; ESLint clean on
  `src/lib/edit`; the edit suite 106 tests in 7 files, none skipped, a real render among them; the
  whole suite 6,832 passed and 42 skipped of 6,874 (the same 42 as before this branch);
  `pnpm build` green.
- The branch no longer matches the plan's code blocks, and must not be made to. Reviews found real
  defects in them, and each was fixed with a failing test first. What changed and why is in
  `docs/superpowers/specs/2026-11-11-edit-format-design.md` §9 (F7 to F13); the spec's text is
  updated to what was built. Two of the changes are in the stored format: a document names its kit
  (`kit: 'v1'`), and an id never names a member of `Object.prototype`.
- The prototype in `.scratch/openfilm-spike/proto/` is the plan's code, so it is out of date too.
  Do not diff against it any more.
- What is still open, sorted by the part it must be done before, is in the same spec, §10. The
  review reports, with file and line for every item, are in
  `.scratch/openfilm-spike/part1-reviews/` (gitignored).

Next:

1. The "before part 2" list in the spec's §10. It needs nothing from the owner.
2. Part 2's spec, through `superpowers:brainstorming`. It needs the owner's Modal account.

One more machine fact: `pnpm add` in this repo also bumps three unrelated packages in the lockfile,
because `react-scan` asks for `react-grab: latest`. After any `pnpm add`, put those hunks back and
run `pnpm install --frozen-lockfile`.

## Goal

Maven edits a creator's takes to match a reference video and renders the result. Engine: OpenFilm
(MIT, exact pin `0.3.2`) behind Maven's own edit format. The work is split into five parts. **This
session's job: build part 1 from the finished plan.**

## State

- Worktree `~/virtuna-openfilm`, branch `feat/openfilm-edit` = `main` = `0efcddd6`. Deps installed
  with pnpm. The owner says `.env.local` is now copied in (a deny rule blocks the agent from reading
  or even listing it; do not work around that).
- Untracked, uncommitted: two specs, one plan, this handoff. **Nothing is in `src/` yet.**
- No Colima VM, no servers running. Disk: about 6 GB free.

## Read first, in this order

1. `CLAUDE.md` (repo root).
2. `docs/superpowers/specs/2026-11-11-auto-edit-overview-design.md`: the owner's rulings D1 to D8,
   my decisions M1 to M6, what is measured, the five parts.
3. `docs/superpowers/specs/2026-11-11-edit-format-design.md`: part 1.
4. `docs/superpowers/plans/2026-11-11-edit-format.md`: 8 tasks, 49 steps. Every code block is a
   file that already ran green.

## Do next

1. **Ask the owner once: a commit per task on this branch, or stage only?** His rule is commits
   only when asked, and he has not answered this yet. His last words were "lets continu in fresh
   context. env is also copied now", which I read as go for building part 1.
2. Execute the plan with `superpowers:subagent-driven-development`. Subagents run on model opus.
3. The code was prototyped in `.scratch/openfilm-spike/proto/` (gitignored): tsc and ESLint clean,
   71 of 71 tests green, including a real render and 500 random sequences of operations. After each
   task, `diff -r` the new files against the prototype; they should be identical. Run the prototype
   from the worktree root with
   `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run --root .scratch/openfilm-spike/proto`.
4. Part 1 is done when the plan's Task 8 is green: `tsc`, ESLint on `src/lib/edit`, 71 edit tests
   with no `SKIPPED` line, the whole suite, `pnpm build`. Report with the output.
5. Then part 2 (the render worker on Modal): its spec, through `superpowers:brainstorming`. It
   needs the owner's Modal account. Its first task is `scripts/codec-check.mjs` on a real x64 box.

## Decided, do not re-open

- Engine, pin, own edit format, render off Vercel, no name borrowed from OpenFilm.
- One take per beat. An in-app filming mode with the script on screen (part 5); upload stays.
- The owner's own and the fleet's videos first, with a progress view; user release right after.
- Credits per finished video. Worker on Modal (my reading of "build the right infrastructure from
  the start"; he has not said "Modal" himself, though he asked what the account and token are).
- A timeline for quick adjustments on desktop and phone, opening where the audience panel is. This
  overrides the 2026-08-09 rail ruling in `home-page-layout.tsx:118-120`.
- "Full functionality for TikTok and Instagram": the format expresses everything from day one, the
  screens ship in two releases. Platform music never goes into the export.

## Measured, with evidence in `.scratch/openfilm-spike/`

- `results/report.html`: every number and frame. Open it in a browser.
- Call `render()` from `openfilm/render`, never the CLI (it starts a Studio server).
- A render makes no network connection.
- linux/arm64's render browser has no H.264, HEVC or AAC. linux/x64 gets Chrome's build. **x64 has
  not been run for real.**
- Linux without a GPU: 150 to 226 s for a 30 s film at 1080×1920 on 4 CPUs. Pass `workers`; the
  default on Linux is 1.
- Floor frame times to the millisecond; rounding puts cuts a frame late.
- An ordinary browser can host the film: 60 frames/s, an edit applied in place in 11 to 33 ms, on
  Chrome and on WebKit. **No real iPhone yet.**
- `notes/openfilm-editor-internals.md`: how OpenFilm's own editor plays, edits and what is reusable.
- `notes/maven-integration-map.md`: the rail, tool runs, billing, storage, jobs, tests in Maven.

## Machine facts

- Node 25.2.1: every vitest command needs `NODE_OPTIONS=--no-experimental-webstorage`.
- No `docker`. Colima works (`--runtime containerd`, `colima nerdctl`) but its disk fills the Mac:
  prune, `fstrim`, and `colima delete --force --data` when done.
- ffmpeg 8 and the headless browser for the pinned Playwright are installed.

## The owner still owes

A Modal account and token (part 2), an iPhone for the preview test (part 4), the new Vercel account
(any user release; production deploy has been off since 2026-08-07).

## Owner rules

Terse, plain words. Decide design questions yourself and list the decisions; ask only what changes
what gets built. Commits and pushes only when asked. Verify before claiming: run it, show the
output. Never read `.env*`.
