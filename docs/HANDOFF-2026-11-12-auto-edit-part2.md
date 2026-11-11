# Handoff 2026-11-12 — auto-edit: the Modal account, then part 2

Written at the end of the session that built part 1. Start here; do not redo what is listed as done.

## Goal

Maven edits a creator's takes to match a reference video and renders the result. Engine: OpenFilm
(MIT, exact pin `0.3.2`) behind Maven's own edit format. The work is split into five parts. Part 1
(the edit format, its compiler, its operations) is built. **This session's job: connect the owner's
Modal account, clear the short list that must be done before part 2, then write part 2's spec (the
render worker).**

## State

- Worktree `~/virtuna-openfilm`, branch `feat/openfilm-edit`, on top of `main` (`0efcddd6`).
  **Pushed** on the owner's word (2026-11-12). Draft PR:
  https://github.com/davideloreti4-maker/virtuna-v1.1/pull/560. It is a draft on purpose: merging
  deploys to production, and the owner has said not yet.
- Checked on the last commit that changes code (`2db67400`; everything after it is docs):
  `pnpm exec tsc --noEmit` clean, ESLint clean on `src/lib/edit`, the edit suite 106 tests in 7
  files with none skipped (a real render among them), `pnpm build` green. The whole suite, run again
  on `fcc615c6`: 6,832 passed and 42 skipped of 6,874 (the same 42 as before the branch).
- Nothing in the app imports `src/lib/edit` yet. No database change, no route, no UI.
- Disk: 7.0 GB free after a cleanup on 2026-11-12. `.next` was deleted here and in `~/virtuna-v1.1`,
  `~/virtuna-claude-design` and `~/virtuna-trial-landing`; the first build or dev start makes it
  again. No Colima VM, no servers running.
- `.env.local` is in the worktree. A deny rule blocks the agent from reading or listing it; do not
  work around that.

## Read first, in this order

1. `CLAUDE.md` (repo root).
2. `docs/superpowers/specs/2026-11-11-auto-edit-overview-design.md`: the owner's rulings D1 to D8,
   decisions M1 to M6, what is measured, the five parts. Part 2 is the second row of §5; §6 names
   what it must add (assets in their own bucket, jobs, the kit).
3. `docs/superpowers/specs/2026-11-11-edit-format-design.md`: part 1 as it was built. §9 (F7 to
   F13) are the decisions taken during the build; §10 is what is still open, sorted by the part it
   must be done before.
4. `.scratch/openfilm-spike/notes/maven-integration-map.md` (gitignored): the rail, tool runs,
   billing, storage, jobs and tests in Maven. `.scratch/openfilm-spike/results/report.html`: every
   render number and frame.

Do not run `docs/superpowers/plans/2026-11-11-edit-format.md` and do not copy its code blocks: it
is executed, and the branch departs from it on purpose. The prototype in
`.scratch/openfilm-spike/proto/` is that plan's code and is out of date for the same reason.

## Do next

1. **The Modal account, with the owner.** Part 2 cannot start without it. Only he can do these:
   - Sign up at modal.com.
   - Log this Mac in himself, so the token never passes through the chat. Typed into the prompt
     with the `!` prefix: first `! uv tool install modal` (the Modal command line is part of its
     Python package; `uv` is installed here, `pipx` is not, Python is 3.15.2, and no `modal`
     command exists yet), then `! modal token new`, which opens the browser and writes the token
     to `~/.modal.toml`. Modal's docs confirm `modal token new` and the file; its getting-started
     page also names `modal setup`. Read the current docs before telling him which to type.
   - Never ask him to paste a token, and never read `~/.modal.toml`. A token is two values, an id
     and a secret. To check the login, use a command that prints only the workspace name (look it
     up in Modal's command-line reference first).
   - Later, for Maven's own server to reach the worker: the two values go into `.env.local` as
     `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`, typed in by him. Whether Maven calls the worker
     through Modal's own client or through a web address with our own key is a question for the
     spec.
2. **The "before part 2" list** in the edit-format spec, §10. It needs nothing from the owner, so
   it can run while he signs up. The bulk of it is making the render test stricter, because part 2
   runs that test inside the worker image as its proof: it must fail, not skip, when the browser
   cannot start; it must hear the kit sound; it must check the caption's end on the right frame
   and the label's words; it must fail on any line `render()` reports; and one text motion must be
   drawn. Then the seven check rules that have no test. Work test-first. If it is more than a
   handful of steps, write a plan with `superpowers:writing-plans` first.
3. **Part 2's spec**, through `superpowers:brainstorming`, one question to the owner at a time.
   What it has to cover, from the overview: prepare media (a preview copy, thumbnails, a waveform,
   a transcript), render, a job table, progress that survives a reload, its own bucket with expiry,
   credits per finished video, the mark for AI-made footage. What part 1 hands it, all in the
   edit-format spec's §10:
   - Check every document at the door and cap the request size.
   - An asset's `ms` must be no longer than both the original and the preview copy.
   - `compile` throws three kinds of error; tell them apart.
   - Send `asset.words` only when the words changed: it drops that asset's caption fixes.
   - Name files by asset id, directly under `assets/`; the compiler refuses anything else.
   - Store the compiled film with each render: the compiler's output is not versioned.
   - The worker image: Node 22.2 or later, `fonts-noto` with emoji, the headless browser of the
     engine's own `playwright-core` (the working install command is in §10; the one in the old
     plan fails).
   - The first task once it is built: `.scratch/openfilm-spike/scripts/codec-check.mjs` on a real
     x64 machine. x64 has never been run for real.
4. Then the plan (`superpowers:writing-plans`) and the build
   (`superpowers:subagent-driven-development`, every subagent on model opus).

## How commits and pushes work here

- The repo's `post-commit` hook pushes on every commit and sends a Telegram message. The owner's
  rule is commits and pushes only when asked. Part 1 was committed with
  `git -c core.hooksPath=/dev/null commit` and pushed once, when he said push.
- The branch is on origin now. **Ask him once**: may new commits on this branch go through the
  hook, or do they stay local until he says push?
- `pnpm add` in this repo also bumps three unrelated packages in the lockfile, because `react-scan`
  asks for `react-grab: latest`. After any `pnpm add`, put those hunks back and run
  `pnpm install --frozen-lockfile`.
- A subagent that is told to bring code in should also be told to read it against the spec. In
  part 1 that reading, not the tests, found the worst defects.

## Decided, do not re-open

- Engine, pin, own edit format, render off Vercel, no name borrowed from OpenFilm.
- One take per beat. An in-app filming mode with the script on screen (part 5); upload stays.
- The owner's own and the fleet's videos first, with a progress view; user release right after.
- Credits per finished video. Worker on Modal (the owner asked for "the right infrastructure from
  the start" and has now asked to continue with the Modal account).
- A timeline for quick adjustments on desktop and phone, where the audience panel is.
- The format expresses everything from day one, the screens ship in two releases. Platform music
  never goes into the export.
- From the build of part 1 (edit-format spec §9, F7 to F13): a clip's fit does not depend on where
  it sits; layers stack by `z`, the later one on top when equal; a speed change rounds, then fits;
  ids never name a member of `Object.prototype`, and `applyOps` and `compile` validate everything;
  a document names its kit; the test guard allows no 1 ms overlap; a place past the end is refused.

## Measured, with evidence in `.scratch/openfilm-spike/`

- Call `render()` from `openfilm/render`, never the CLI (it starts a Studio server).
- A render makes no network connection.
- linux/arm64's render browser has no H.264, HEVC or AAC, so the worker is x64. **x64 has not been
  run for real.**
- Linux without a GPU: 150 to 226 s for a 30 s film at 1080×1920 on 4 CPUs, about 1.5 GB per
  browser, more than two browsers gains nothing. Pass `workers`; the default on Linux is 1. A GPU
  worker is untested.
- An ordinary browser can host the film: 60 frames/s, an edit applied in place in 11 to 33 ms.
  **No real iPhone yet.**
- Part 1's real render on this Mac: a 45-frame film at a quarter scale in about 7 s. I looked at
  the frames: the cut is on the exact frame, the label and the captions are drawn.

## Machine facts

- Node 25.2.1: every vitest command needs `NODE_OPTIONS=--no-experimental-webstorage`.
- No `docker`. Colima works (`--runtime containerd`, `colima nerdctl`) but its disk fills the Mac:
  prune, `fstrim`, and `colima delete --force --data` when done.
- ffmpeg 8 and the headless browsers are installed. The pnpm store was pruned on 2026-11-12, so a
  fresh install elsewhere may download again.
- Check `df -h /` before anything big; 7.0 GB was free on 2026-11-12.

## The owner still owes

A Modal account and login (step 1). An iPhone for the preview test (part 4). The new Vercel account
(any user release; production deploy has been off since 2026-08-07), with its Node version at 22.2
or later. TikTok and Meta developer apps before release 2's direct posting.

## Owner rules

Terse, plain words. Decide design questions yourself and list the decisions; ask only what changes
what gets built. Commits and pushes only when asked. Verify before claiming: run it, show the
output. Never read `.env*`.
