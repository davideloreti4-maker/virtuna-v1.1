# Result Page, Slice B (the running screen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A video simulation opened while it is still in flight shows, at `/simulation/[id]`, the ring of its ten viewer groups, the creator's video (or the scene frames) in the ring's centre and the time since the run started, and turns into the result when the run finishes.

**Architecture:** Pure functions in `src/lib/result/` turn the events of the run's own stream into one small object (`RunProgress`); a hook listens to the stream; one component (`Running`) draws it. The stored row's polling stays the source of the result, the stream only adds what is known earlier. Everything stays behind `NEXT_PUBLIC_NEW_LOOK`.

**Tech Stack:** Next.js (app router), React 19, TypeScript, Tailwind v4 tokens, TanStack Query, the browser's EventSource, Vitest, Playwright for looking at it.

Spec: `docs/superpowers/specs/2026-11-19-result-page-design.md`, section 7 (rewritten 2026-11-20 after the check against real data) and section 10 "Slice B". Facts behind it: `.scratch/next-look/part2/slice-b-inventory.md`, section A.
Reference to match: `.scratch/next-look/part2/running-state-refined.png`; single renders `.scratch/next-look/part2/renders/real/run2-ring2-*.png`; measured boxes `renders/real/run2-ring2-boxes.json`; source: the mock `.scratch/next-look/part2/design/app.html?screen=run&real=1&look=ring2&m=a0|a|b|b2|c` (the functions and CSS rules prefixed `rn2`). **Read the mock's `look=ring2` branch before building and port its geometry exactly.**

## Global Constraints

- Work only in the worktree `~/virtuna-next-look` on branch `design/next-look`. Never edit `~/virtuna-v1.1`, `~/virtuna-edit`, `~/virtuna-fold-fix`, `~/virtuna-analyze-cleanup`.
- **Do not commit, do not push, do not stash.** The controller commits. The repository is public: no ids, links, tokens or account data in code, tests, fixtures or docs.
- Flag `NEW_LOOK_ENABLED` (`src/lib/flags/new-look.ts`): flag off must render exactly as today. This slice touches no legacy file.
- No new dependencies. Package manager is pnpm.
- Tests: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <path>`. Type check: `pnpm exec tsc --noEmit`. Lint: `pnpm exec eslint <path>`.
- Tests exercise real behaviour. Stand-ins only for what cannot run (network, EventSource, WebGL, the clock). Never a stand-in for our own code. Write the test first and watch it fail.
- Never read, print or copy `.env*` files.
- Tokens only in `src/components/result/`: no hex, no `rgb()`, no `rgba()`, no `backdropFilter` (the guard `result-guard.test.ts` enforces it). In SVG use `var(--color-…)` or `currentColor`.
- **Nothing on the running screen is coral.** Ink and greys only.
- **The screen shows only what the app knows:** the ten groups, the frames that arrived, the creator's video when this device started the run, the time since the start. No stage names, no progress bar, no percent, no estimate, no spinner, no skeleton blocks.
- The only words: the header title "Simulating" and the clock (`0:42`). Nothing else.
- Type from role tokens; numbers `tabular-nums`; radii from the scale; shadows as `shadow-[var(--shadow-…)]`.
- Reduced motion: the wedges appear at once, the frames do not rotate (the first stays), nothing fades.
- A part with visible UI is not done until it was rendered in the running app and compared with the reference, side by side and with measured sizes. Say plainly what you did not check.
- Dev server (run by the controller, do not start another): `http://127.0.0.1:3021`, flag on. Signed-in cookies: `.scratch/next-look/cookie.json`.

## File Structure

```
src/lib/result/
  run-progress.ts     RunProgress, NO_PROGRESS, applyRunEvent, arrivedFrames, elapsedSeconds, frameOnScreen   (Task 1, done)
  run-video.ts        rememberRunVideo, runVideoOf, forgetRunVideos                                           (Task 1, done)
  types.ts            ResultState "running" carries startedAt                                                 (Task 1, done)
  video-model.ts      videoStateOf sets startedAt                                                             (Task 1, done)
src/components/result/
  use-run-stream.ts   useRunStream(id, onDone): RunProgress                                                   (Task 2, done)
  running.tsx         the running screen                                                                      (Task 3)
  running-ring.tsx    the pale ring of the groups that have arrived                                           (Task 3)
  result-page.tsx     passes the run to Running; the result fades in after a run                              (Task 3)
  no-audience.tsx     "Simulate again" (dormant) remembers the video for the new run                          (Task 3)
src/app/(app)/dev/result/   the running screen's moments by query, for looking at it                          (Task 3)
scripts/result-shots.cjs    --query passes extra parameters to the dev page                                   (Task 3)
```

---

### Task 1: What the page knows about a run in flight (DONE by the controller, 2026-11-20)

`src/lib/result/run-progress.ts` (+ `__tests__/run-progress.test.ts`, 15 tests), `src/lib/result/run-video.ts` (+ `__tests__/run-video.test.ts`, 3 tests), and `startedAt` on the running state (`types.ts`, `video-model.ts`, their tests). Do not change these without saying so.

**Produces (exact):**

```ts
// src/lib/result/run-progress.ts
interface RunProgress { groups: readonly string[] | null; frameTotal: number | null; frames: ReadonlyArray<string | null>; done: boolean }
const NO_PROGRESS: RunProgress                       // { groups: null, frameTotal: null, frames: [], done: false }
type RunEvent = { type: "roster"; data: unknown } | { type: "filmstrip_plan"; data: unknown } | { type: "filmstrip_segment_ready"; data: unknown } | { type: "complete" }
applyRunEvent(state: RunProgress, event: RunEvent): RunProgress   // same object back when nothing changes
arrivedFrames(state: RunProgress): string[]                       // the frames that arrived, in scene order
elapsedSeconds(startedAt: number | null, now: number): number     // whole seconds, never negative
FRAME_HOLD_S = 3
frameOnScreen(frames: readonly string[], seconds: number, opts?: { still?: boolean }): string | null

// src/lib/result/run-video.ts
rememberRunVideo(id: string, src: string): void      // src: an object URL or a signed address a <video> can play
runVideoOf(id: string): string | null

// src/lib/result/types.ts
type ResultState = … | { kind: "running"; id: string; startedAt: number | null } | …
```

### Task 2: Listening to the run's stream (DONE by the controller, 2026-11-20)

`src/components/result/use-run-stream.ts` (+ `__tests__/use-run-stream.test.tsx`, 8 tests on a working stand-in for EventSource).

**Produces (exact):**

```ts
useRunStream(id: string, onDone: () => void): RunProgress
//  Opens GET /api/analyze/<id>/stream; reads roster, filmstrip_plan, filmstrip_segment_ready, complete.
//  onDone is called once at `complete`, after which the stream is closed. Closes on unmount.
//  Without EventSource it returns NO_PROGRESS and does nothing.
```

Also done: `src/hooks/queries/use-simulation-row.ts` keeps polling a run in flight after a failed poll (a real run answered 401 once and 404 once while it was fine).

---

### Task 3: The running screen

**Files:**
- Create: `src/components/result/running-ring.tsx`, `src/components/result/__tests__/running.test.tsx`
- Modify: `src/components/result/running.tsx` (rewrite), `src/components/result/result-page.tsx` (the `running` case and the result's arrival), `src/components/result/no-audience.tsx` (one line in `startAgain`), `src/components/result/__tests__/result-page.test.tsx` (the `running` test), `src/app/(app)/dev/result/page.tsx` and `dev-result.tsx` (the moments), `scripts/result-shots.cjs` (`--query`)

**Interfaces — Consumes:** everything Tasks 1 and 2 produce; `ringDots`, `RingLayout`, `WedgeInput` (`src/lib/result/ring-layout.ts`); how `audience-ring.tsx` draws a wedge's dots as one path (`circles`); `timecode` (`src/lib/result/format.ts`); `queryKeys.analysis.detail(id)` (`src/lib/queries/query-keys.ts`); `useQueryClient`; `usePrefersReducedMotion` (as `brain-panel.tsx` imports it); `useIsMobileHydrated` (`src/hooks/useIsMobile.ts`, as `video-result.tsx` uses it).

**Interfaces — Produces (exact):**

```ts
// src/components/result/running.tsx
interface RunningPreview { progress?: RunProgress; video?: string | null; elapsed?: number }
function Running(props: { id: string; startedAt: number | null; preview?: RunningPreview }): React.JSX.Element
//  preview is for the dev page and tests only: it replaces the stream, the remembered video and the clock.

// src/components/result/running-ring.tsx
function RunningRing(props: { groups: number; shown: number; r1: number; R: number; n: number }): React.JSX.Element
//  `groups` equal pale wedges of `n` dots laid out by ringDots; `shown` of them are drawn.
//  The order they appear in is spread round the ring (0, 3, 6, 9, 1, 4, 7, 2, 5, 8 for ten), not
//  clockwise: neighbours filling in turn would read as a progress arc.
```

**Measures of the reference** (from `run2-ring2-boxes.json` and the mock's `ring2` branch; CSS px):

| | phone (393 × 852) | desktop (1440 × 900) |
|---|---|---|
| ring radii, outer / inner (`R` / `r1`) | 175 / 140 | 265 / 212 |
| dots in the ring (`n` of `ringDots`) | 400 | 800 |
| ring's centre on the page | x 196.5, y 463 (centred between the header's end at y 108 and y 818) | x 844, y 484 (centred in the content area) |
| picture tile | 131 × 233, radius 16 | 201 × 358, radius 24 |
| clock | 34px bold | 44px bold |
| clock under the ring (with a picture) | 20 under the ring's dots | 28 under the ring's dots |
| pale wedge opacity | 0.20 light, 0.14 dark | same |

**What to build**

- [ ] **The ring** (`running-ring.tsx`). Its props gain `n: number` (the number of dots), passed to `ringDots` as `n`. `ringDots(Array.from({ length: groups }, (_, i) => ({ group: String(i), weight: 1, present: true })), { r1, R })` once per size (memo). Draw wedge `i < shown` as one `<path>` of its dots, `fill="var(--color-foreground)"`, with the opacity the mock uses for a pale wedge in each theme (read `.rn2-g`, the `ring2` branch and its dark rule; use a token-based value such as `opacity-[0.2] dark:opacity-[0.14]` on the group, not a colour literal). `aria-hidden`. `data-result="running-ring"`, each wedge `data-wedge`.
- [ ] **The groups arrive.** Before the roster: no wedges. When `progress.groups` arrives, `shown` counts from 0 to `groups.length` one wedge every 60 ms (an interval in an effect), in the spread order above; with reduced motion, all at once. A roster that is already there when the screen mounts (the dev page's preview with `arriving` unset) shows all at once.
- [ ] **The clock.** `timecode(elapsedSeconds(startedAt, now))`, `now` re-read every second (one interval; cleared on unmount). Style: the mock's `rn2` clock (large, `font-bold`, `tabular-nums`, primary text colour; size and position from the reference). No picture yet: the clock sits in the centre of the ring. With a picture: centred under the ring. One element with `data-result="running-clock"`; it is a `<p>` with `aria-hidden="true"` (a ticking clock must not be announced every second), and beside it a visually hidden `<p role="status">Simulating</p>` (class `sr-only`) so a screen reader hears the state once.
- [ ] **The picture.** A 9:16 tile with the result page's video-tile radius, inscribed in the ring (size from the reference), `data-result="running-picture"`:
  - `video` (the preview's, else `runVideoOf(id)`): `<video src muted autoPlay loop playsInline>`; no controls, no mark on it.
  - else, once `arrivedFrames(progress).length > 0`: `frameOnScreen(frames, elapsed, { still: reducedMotion })` as an `<img alt="">`; when the frame changes the new one fades in over 500 ms (`motion-safe:` only).
  - else no tile at all.
- [ ] **Placement.** The ring is centred in the area under the header, horizontally and vertically, on phone and desktop, and does not move when the picture or the clock's place changes (the clock under the ring is positioned without pushing the ring). Phone and desktop sizes (radii, tile, clock) from `run2-ring2-boxes.json` and the mock; pick by `useIsMobileHydrated` as `video-result.tsx` does.
- [ ] **The finish.** `Running` calls `useRunStream(id, onDone)` (not when `preview.progress` is given) with `onDone = () => queryClient.invalidateQueries({ queryKey: queryKeys.analysis.detail(id) })`. In `result-page.tsx`: the `running` case renders `<Running id={state.id} startedAt={state.startedAt} />`; when the state turns from `running` into `result` or `no-audience` while the page is open, the new body fades in over 400 ms (`motion-safe:` only; remember the previous kind in a ref, do not animate a result opened directly).
- [ ] **"Simulate again"** (dormant). In `no-audience.tsx` `startAgain`, after `const id = await startVideoSimulation(videoPath)`: `if (src) rememberRunVideo(id, src)` where `src` is the signed address the component already holds from `useSignedVideo`. Nothing else changes there.
- [ ] **Dev page.** `/dev/result?fixture=early&processing=1` plus: `groups=<n>` (a roster of n groups), `arriving=<k>` (only the first k wedges shown, for the picture of the arrival), `runframes=<n>` (n frames arrived, addresses `<frames base>/<i>.jpg` as the page's `frames` parameter gives them), `own=1` (the `video` parameter plays as the creator's own video), `elapsed=<seconds>`. They build the `preview` prop. Document them in the page's header comment.
- [ ] **`scripts/result-shots.cjs`**: `--query "<k=v&k=v>"` is appended to the dev page's address; add the option to the header comment and to the file name (`q<hash of the query, 6 chars>` or the `--name` given).

- [ ] **Tests first, each watched failing** (`running.test.tsx`, `@vitest-environment happy-dom`, real components; EventSource stood in as in `use-run-stream.test.tsx`; fake timers for the clock):
  1. Just opened: no wedge is drawn, the clock reads `0:00` and sits inside the ring's box, no picture, and the only text in the document is the clock and the hidden "Simulating".
  2. The clock counts: `startedAt` 42 s ago reads `0:42`; one second later `0:43`.
  3. The roster arrives: after the stream's `roster` with ten groups and 600 ms, ten wedges are drawn; with reduced motion they are all there at once (stub `matchMedia`).
  4. Frames arrive: after `filmstrip_segment_ready` an `<img>` with that address is the picture and the clock is no longer inside the ring's box (assert through a `data-clock="centre" | "below"` attribute); three seconds later the second frame's address is shown; with reduced motion it stays on the first.
  5. This device started the run: after `rememberRunVideo(id, "blob:x")` the picture is a `<video>` with `muted`, `loop`, `playsInline` and that `src`, and no frame `<img>` even when frames arrive.
  6. The finish: the stream's `complete` invalidates the row's query (a real `QueryClient`; assert the query for `queryKeys.analysis.detail(id)` is invalidated) .
  7. Nothing coral, no `%`, no word other than "Simulating" (assert on `textContent` and that no class contains `below`).
  8. `result-page.test.tsx`: the `running` state renders the running screen (the ring's `data-result`) and names the screen "Simulating"; no `%` appears.

- [ ] **Verify in the browser** against the reference, phone (393×852) and desktop (1440×900), light and dark:
  `node scripts/result-shots.cjs --out .scratch/next-look/part2/built/running --fixture early --processing --clean --query "<moment>"` for the moments a0 (`elapsed=2&groups=10&arriving=4`), a (`elapsed=4&groups=10`), b (`elapsed=42&groups=10&runframes=7`), c (`elapsed=42&groups=10&runframes=7&own=1` with `--video-file` set to a local clip). Measure the ring, the tile and the clock against `run2-ring2-boxes.json` (the script writes the boxes of every `[data-result]`); build a side-by-side sheet with `.scratch/next-look/sbs.cjs`. With `--reduced-motion`: all wedges at once, the first frame stays. Report every difference you leave.

---

### Task 4: Checks, the sheet, the docs (controller)

- [ ] A real run in flight: start one from a script as `.scratch/next-look/part2/slice-b-run-timeline.ts` does, open `/simulation/<id>` in a browser while it runs, and watch: the wedges arrive, the clock counts, the result takes the screen's place without a reload. (No frames arrive on this Mac: the frame job posts to a port nothing listens on.)
- [ ] Keyboard and screen reader names: Back is reachable; the state is announced once ("Simulating"); the clock is not announced.
- [ ] Flag off: `/simulation/x` answers not found; `node scripts/next-look-probe.cjs` against the baseline.
- [ ] Full suite, `tsc --noEmit`, `eslint`, `pnpm build`.
- [ ] An independent code review of the slice; fix what holds.
- [ ] Sheets: built against reference, phone and desktop, light and dark, saved under `.scratch/next-look/part2/built/`.
- [ ] Update `docs/DESIGN-SYSTEM.md` ("Next look": the running screen), the spec's status line, and write the "Result" section below.

## Spec coverage

| Spec | Task |
|---|---|
| §7 the ring of the ten groups, equal and pale | 3 |
| §7 the picture: own video, else frames, else none | 1 (`run-video`, `frameOnScreen`), 3 |
| §7 the clock | 1 (`elapsedSeconds`), 3 |
| §7 only what the stream sends | 1, 2 |
| §7 the result takes the screen's place; a failed poll does not stop it | 2, 3, (done: `use-simulation-row`) |
| §7 no audience / did not finish | slice A (`videoStateOf`), unchanged |
| §10 slice B done-when | 3, 4 |
| §4 your usual, §6 hook result | not in this slice (parked; part 3) |

## Result (2026-11-20)

Built, reviewed and verified. Nothing is committed: the work sits in the working tree of
`design/next-look` until the owner says so.

| Check | Result |
|---|---|
| The running screen against the refined drawing, in a browser | Phone and desktop, light and dark: ring, tile and clock measured against `run2-ring2-boxes.json`; sheets `.scratch/next-look/part2/built/running-screen-built.png` and `running-screen-built-desktop.png` |
| A real run in flight, watched in a browser (phone) | Title "Simulating"; the clock counted 0:05 to 0:44; the ten wedges arrived within half a second of the roster; the result took the screen's place 0.6 s after the run finished, without a reload; no page errors. No frames: the frame job does not run on this Mac |
| The same, with the stream's first connect answered 401 on purpose | The screen opened the stream again after 5 s and then showed the groups; the result landed as before |
| Short and narrow windows | A 1366 × 768 laptop gets the small ring and keeps the clock in view; a 320-wide phone scales the figure down |
| Reduced motion | The wedges are there at once, the frames do not take turns, nothing fades, the creator's video stays on its first frame |
| Flag off | No legacy file is touched; `/simulation/x` answers not found; legacy code imports only `href.ts`, unchanged |
| Reviews | One task review (spec and quality), two scoped re-reviews, one whole-slice review ("ready after fixes"), one scoped re-review of the fix wave ("all findings addressed"); every finding fixed |

**Where the build departs from the plan**

- The clock is `text-4xl` (36px) on both sizes, not the drawing's 34 / 44 (owner-level rule: type
  from role tokens). The tile's shadow is the result page's own (`SHADOW` in `player.tsx`).
- The wedges arrive farthest first (0, 5, 2, 7, …): the plan's order put two neighbours side by
  side and read as a progress arc.
- The large ring needs 712.5 px of stage height (ring centred, clock hanging under it, 24 px each
  side); below that the small ring is used.
- The `filmstrip_plan` event and `frameTotal` were dropped: the screen never needed the count.
- The stream reopens by itself after a failed connect (5 s, at most five times); a row last seen in
  flight is asked for again when the page opens; while that answer is out, a run past six minutes
  shows the loading frame instead of "did not finish".

**Open**

- Not checked: iOS Safari and a real touch device; a screen reader on a real device; frames arriving
  in a real run (the frame job posts to a port nothing listens on locally: `NEXT_PUBLIC_APP_URL`);
  the fade on browsers without `@starting-style` (they show the result without it).
- Deferred minors (reviewed, none blocks a merge): the last six wedges arrive clockwise; a phone in
  landscape scales by width only (the clock can sit below the fold, the page scrolls); dot size
  shifts with 8 or 12 groups; Next's route announcer may read the page's title rather than the
  heading; a replayed event re-renders without a change; a run that finishes after six minutes
  while the page stays open stays on "did not finish"; a deleted run reopened from the cache says
  "did not finish" rather than "not here".
