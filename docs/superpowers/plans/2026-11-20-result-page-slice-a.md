# Result Page, Slice A (the video result) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stored video simulation opens at `/simulation/[id]` in the new look: a player with the still-watching line and the strip of scenes, one number, the moment viewers leave, and three panels (Brain, Engagement, Audience) that follow the playhead.

**Architecture:** Pure functions in `src/lib/result/` turn the stored row into one object (`VideoModel`); they are written and tested on recorded runs (Task 1, done). Components in `src/components/result/` render that object and share one playhead through a React context. The page lives behind `NEXT_PUBLIC_NEW_LOOK`; with the flag off nothing changes.

**Tech Stack:** Next.js 15 (app router), React 19, TypeScript, Tailwind v4 tokens, TanStack Query, three.js through `@react-three/fiber` (the existing `CortexCanvas`), Vitest, Playwright for looking at it.

Spec: `docs/superpowers/specs/2026-11-19-result-page-design.md` (sections 3, 4, 5, 8, 9, 10; approved by the owner 2026-11-20).
Reference to match: `.scratch/next-look/part2/result-page-as-specified.png`, row A and Desktop. Its single screens are in `.scratch/next-look/part2/renders/real/spec-1-result.png`, `spec-2-audience.png`, `spec-3-engagement.png`, `spec-4-noframes.png`, `spec-5-noaudience.png`, `spec-11-desktop.png`. The source of those pictures is the mock `.scratch/next-look/part2/design/app.html` (one file, plain JS and CSS): **read the named function there before you build its part, and port its geometry exactly.**

## Global Constraints

- Work only in the worktree `~/virtuna-next-look` on branch `design/next-look`. Never edit `~/virtuna-v1.1` (trunk), `~/virtuna-edit` or `~/virtuna-fold-fix`.
- **Do not commit, do not push, do not stash.** Leave your work in the working tree. Several workers share this tree: touch only the files your task lists.
- Flag: `NEW_LOOK_ENABLED` (`src/lib/flags/new-look.ts`). **Flag off must render exactly as today.** Every edit to an existing (legacy) file is gated by the flag and as small as possible.
- No new dependencies. Package manager is pnpm.
- Tests: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <path>`. Type check: `pnpm exec tsc --noEmit`. Lint: `pnpm exec eslint <path>`.
- Tests exercise real behaviour. Stand-ins only for what cannot run (network, WebGL). Never a stand-in for our own code. Write the test first and watch it fail.
- Never read, print or copy `.env*` files.
- Tokens only in `src/components/result/`: no hex, no `rgb()`, no `rgba()`, no `backdropFilter`. In SVG use `var(--color-…)` or `currentColor`. The tokens are listed in `docs/DESIGN-SYSTEM.md` → "Next look".
- Coral (`--color-below`, text `--color-below-text`, band `--color-below-soft`) means one thing on this page: the scene the sentence names. Nothing else is coral. Buttons are ink.
- Type sizes from role tokens (`text-micro`, `text-label`, `text-meta`, `text-ui`, `text-title`, `text-heading`, `text-3xl`, `text-figure`); no `text-[Npx]` except inside SVG. Weights: `font-[430]` text, `font-[560]` label, `font-[640]` title, `font-bold` numbers. Every number is `tabular-nums`.
- Radii from the scale (`rounded-lg` 12, `rounded-xl` 16, `rounded-2xl` 20, `rounded-3xl` 24, `rounded-full`). Shadows as `shadow-[var(--shadow-rest)]`, never `shadow-rest`.
- Cards are `Card` from `src/components/ui/card.tsx`; buttons are `Button` and `IconButton` from `src/components/ui`.
- Copy: short and plain, sentence case, no uppercase labels. Say "Simulate", never "Test". Exact strings are given per task; do not invent others.
- Not on this page: the craft score, a confidence label, "Don't post yet", likes, "your usual" (slice B), an Edit button (waits for the edit tool), a share button.
- Every control is at least 44px to tap. Focus is always visible (the app-wide ring).
- Reduced motion: no animation that is not the playhead itself.
- New CSS classes in `globals.css` are a last resort and must be prefixed `result-`.
- A part with visible UI is not done until it was rendered in the running app and compared with the reference (side by side, and measured sizes). Say plainly what you did not check.
- Dev server (run by the controller, do not start another): `http://127.0.0.1:3021`, flag on. Signed-in cookies: `.scratch/next-look/cookie.json`.

## Where this plan departs from the spec

| # | Spec says | Plan does | Why |
|---|---|---|---|
| 1 | Header title is the chat's title | Slice A always shows "Video · 0:29" | The stored run does not say which chat it belongs to; that link arrives with thread cards (part 3). |
| 2 | An old run draws its audience | A run whose viewers carry no group shows the no-audience state | Without groups the Audience panel has nothing to name; the same rule tells a made-up heatmap from a stored one (`audienceOf`). |
| 3 | Running state is slice B | Slice A shows one quiet line, "Simulating…", while a run is in flight | "Simulate again" lands on a run in flight; the page must not be blank. |
| 4 | Recorded 19-scene run | The longest recorded run has 9 scenes (121 s) | No stored run with more scenes has an audience (they failed before PR #562). |
| 5 | "Simulate again" always shown without an audience | Shown only when the video file is still stored | Without the file there is nothing to simulate. |

## File Structure

```
src/lib/result/                      pure, tested on recorded runs
  types.ts            ResultRow, Scene, Viewer, Audience, Verdict, GroupRow, VideoModel, ResultState   (Task 1)
  format.ts           timecode, groupName                                                              (Task 1)
  curve.ts            audienceOf, watchingAt, sceneIndexAt, sceneEndShareAt, HEAVY_PCT                 (Task 1)
  headline.ts         headlineOf                                                                       (Task 1)
  verdict.ts          verdictOf                                                                        (Task 1)
  avg-watch.ts        avgWatchSeconds                                                                  (Task 1)
  group-state.ts      groupsAt, groupSections, groupWord                                               (Task 1)
  video-model.ts      videoStateOf                                                                     (Task 1)
  playhead.ts         restingAt, isResting, stepScene                                                  (Task 2)
  href.ts             resultHref                                                                       (Task 2)
  simulate-again.ts   readStartedId, startVideoSimulation                                              (Task 2)
  ring-layout.ts      ringDots, wedgesOf                                                               (Task 4)
  brain-track.ts      brainTrackOf                                                                     (Task 6)
  __tests__/fixtures/ early, middle, opening, leak, holds, ending, no-groups, no-audience (.json)      (Task 1)

src/components/result/               tokens only
  simulation-screen.tsx   reads the row, picks the state                (Task 2)
  result-page.tsx         loading / running / not found / no audience / result   (Task 2)
  video-result.tsx        the result's layout, phone and desktop        (Task 2)
  playhead.tsx            PlayheadProvider, usePlayhead                 (Task 2)
  result-header.tsx       desktop header row: Back, title               (Task 2)
  panel-switch.tsx        Brain · Engagement · Audience                 (Task 2)
  no-audience.tsx, running.tsx                                          (Task 2)
  use-signed-video.ts                                                   (Task 2)
  player.tsx, gauge.tsx, curve.tsx, scene-strip.tsx, moment.tsx, hero.tsx, compact-player.tsx   (Task 3; stubs in Task 2)
  audience-panel.tsx, audience-ring.tsx                                 (Task 4; stub in Task 2)
  engagement-panel.tsx                                                  (Task 5; stub in Task 2)
  brain-panel.tsx                                                       (Task 6; stub in Task 2)
  __tests__/result-guard.test.ts                                        (Task 7)

src/app/(app)/simulation/[id]/page.tsx     flag off: not found          (Task 2)
src/app/(app)/dev/result/page.tsx          a recorded run by name, for looking at it   (Task 2)
src/hooks/queries/use-simulation-row.ts                                 (Task 2)
scripts/result-shots.cjs                   screenshots and measured boxes   (Task 2)
```

Legacy files touched (flag-gated, minimal): `src/app/(app)/analyze/[id]/page.tsx`, `src/components/app/home/composer.tsx`, `src/components/thread/video-test-card-block.tsx`, `src/components/thread/input-request-block.tsx`, `src/hooks/queries/use-permalink-analysis.ts`, `src/stores/shell-store.ts`, `src/components/shell/next-shell.tsx`, `src/components/audience-lens/CortexCanvas.tsx` (Task 6, one optional prop).

---

### Task 1: The page's logic on recorded runs (DONE by the controller, 2026-11-20)

`src/lib/result/` and `src/lib/result/__tests__/video-model.test.ts` exist: 58 tests on eight recorded runs, green. Do not change these files without saying so in your report.

**Produces (exact):**

```ts
// types.ts
interface ResultRow { id: string; engine_version?; input_mode?; video_storage_path?; processing?; heatmap?; persona_behavioral_aggregate?; variants? }
interface Scene { index: number; t0: number; t1: number; frame: string | null; description: string | null }
interface Viewer { group: Archetype; weight: number /* 0..100 */; heavy: boolean; leftScene: number | null }
type CurvePoint = readonly [t: number, pct: number];
interface Audience { clipS: number; scenes: Scene[]; viewers: Viewer[]; points: CurvePoint[] /* points[k+1] ends scene k */ }
interface Headline { value: number; label: string }
interface Verdict { kind: "opening"|"early"|"middle"|"ending"|"leak"|"holds"; sentence: string; scene: number | null }
interface GroupRow { group: Archetype; name: string; present: boolean; weight: number; heavy: boolean; lit: number /* 0..1 */; status: "watching"|"leaving"|"left"|"absent"; leftBy: number | null; named: boolean }
interface Intent { id: "share"|"comment"|"rewatch"|"save"; label: string; value: number /* 0..100 */ }
interface VideoModel { id: string; title: string; clipS: number; audience: Audience; headline: Headline; verdict: Verdict; moment: Scene | null; avgWatchS: number; intents: Intent[] | null; videoPath: string | null }
type ResultState = { kind: "loading" } | { kind: "running"; id: string } | { kind: "no-audience"; id: string; title: string; videoPath: string | null } | { kind: "result"; model: VideoModel };

// functions
videoStateOf(row: ResultRow | null | undefined): ResultState
audienceOf(row): Audience | null
watchingAt(points, t): number                       // straight lines between points
sceneIndexAt(scenes, t): number
sceneEndShareAt(audience, t): { pct: number; at: number }   // the readout's stored value
groupsAt(audience, verdict, t): GroupRow[]          // ten rows, the app's order
groupSections(rows): { left: GroupRow[]; stayed: GroupRow[]; absent: GroupRow[] }
groupWord(row, t, clipS): string                    // "Left by 0:03" | "Watching" | "To the end" | "Not in this run"
timecode(seconds): string                           // "0:03"
```

Fixtures (`src/lib/result/__tests__/fixtures/<name>.json`, each a `ResultRow`): `early` ("A third leave by 0:03.", 46%, the reference run), `middle` ("Half leave by 0:17."), `opening` (9 scenes, 121 s), `leak` ("They leave bit by bit.", 8 groups), `holds` ("Most watch to the end.", 84%), `ending` (0%), `no-groups`, `no-audience`.

---

### Task 2: The address, the states, the frame of the page, and the tools to look at it

**Files:** as listed under "File Structure" for Task 2, plus the legacy edits. Stubs for every Task 3 to 6 component (each renders a `Card` with its `data-result` name and a fixed height, so the layout can be judged).

**Interfaces — Consumes:** everything from Task 1. `usePermalinkAnalysis` (`src/hooks/queries/use-permalink-analysis.ts`), `PushedHeader`, `IconButton`, `Button`, `Card`, `useShellStore`, `NEW_LOOK_ENABLED`.

**Interfaces — Produces (exact; Tasks 3 to 6 rely on them):**

```ts
// src/lib/result/playhead.ts  (pure, tested)
interface PlayheadState { t: number; playing: boolean }
restingAt(clipS: number): PlayheadState                 // { t: clipS, playing: false }
isResting(state: PlayheadState, clipS: number): boolean // !playing && t >= clipS
stepScene(scenes: readonly Scene[], t: number, dir: -1 | 1, clipS: number): number
//  right: the start of the next scene; from the last scene, clipS.
//  left: the start of the scene under t when t is inside it, else the start of the one before; from rest, the start of the last scene.

// src/components/result/playhead.tsx  ("use client")
interface Playhead {
  t: number; playing: boolean; resting: boolean;
  canPlay: boolean;                      // a video element with a source is attached
  play(): void;                          // from rest it starts at 0:00
  pause(): void; toggle(): void;
  seek(t: number): void;                 // also sets the attached video's currentTime
  playFrom(t: number): void;             // seek, then play when canPlay
  step(dir: -1 | 1): void;               // stepScene
  attachVideo(el: HTMLVideoElement | null): void;
}
function PlayheadProvider(props: { clipS: number; scenes: readonly Scene[]; children: React.ReactNode }): React.JSX.Element
function usePlayhead(): Playhead
//  While playing, t follows video.currentTime once per animation frame. On `ended`: t = clipS, playing = false.
//  Without a video, play() does nothing; seek and step still move t.

// src/components/result/use-signed-video.ts
function useSignedVideo(path: string | null): { src: string | null; status: "idle" | "loading" | "ready" | "missing" }
//  GET /api/videos/sign?path=… → { url }. 404 → "missing". Through useQuery, key ["video-sign", path].

// src/lib/result/href.ts
resultHref(id: string): string           // NEW_LOOK_ENABLED ? `/simulation/${id}` : `/analyze/${id}`

// src/lib/result/simulate-again.ts
readStartedId(stream: ReadableStream<Uint8Array>): Promise<string>   // the id of the `started` event; rejects if the stream ends without one
startVideoSimulation(videoPath: string): Promise<string>
//  POST /api/analyze?bypass_cache=true, headers Content-Type: application/json and Accept: text/event-stream,
//  body { input_mode: "video_upload", content_type: "video", video_storage_path: videoPath }.
//  Resolves with the new id at the `started` event and keeps reading the stream to its end in the background.

// src/hooks/queries/use-simulation-row.ts
function useSimulationRow(id: string): { row: ResultRow | undefined; notFound: boolean }
//  Same query key (queryKeys.analysis.detail(id)), same fetch and the same 2-second polling while the row is in flight
//  as usePermalinkAnalysis: move that hook's query options into one exported factory and use it from both. The legacy
//  hook's behaviour and its tests must not change.

// component props (stubs now, real in Tasks 3 to 6)
Hero({ model }: { model: VideoModel })                 // phone: the card with video, gauge, curve + strip
Player({ model, size }: { model: VideoModel; size: "hero" | "desktop" | "compact" })
Gauge({ headline, size }: { headline: Headline; size: number })
Curve({ model, width, height, strip }: { model: VideoModel; width: number; height: number; strip: boolean })
Moment({ model }: { model: VideoModel })               // renders nothing when there is no sentence to show
CompactPlayer({ model }: { model: VideoModel })        // phone, when the hero has scrolled away
BrainPanel({ model }: { model: VideoModel })
EngagementPanel({ model }: { model: VideoModel })
AudiencePanel({ model }: { model: VideoModel })
```

**What to build:**

- [ ] **Address.** `src/app/(app)/simulation/[id]/page.tsx`: `notFound()` when the flag is off, else `<SimulationScreen id={id} />`. `src/app/(app)/analyze/[id]/page.tsx`: when the flag is on, `redirect(resultHref(id))` before anything renders. Under the flag the three legacy doors use `resultHref(id)`; in `video-test-card-block.tsx` the flag-on path navigates and does not call `simulateVideo` (the legacy side panel is not opened from that door any more).
- [ ] **States** (`result-page.tsx`), exact copy:
  - loading: the frame with empty cards, no text.
  - not found (the fetch failed): "This simulation is not here." and a secondary button "Home".
  - running: a quiet 9:16 tile and the line "Simulating…". The row keeps polling; when it finishes the result shows.
  - no audience: the video (or a quiet tile when there is no file), the line "No audience came back.", and, only when `videoPath` is not null, one primary button "Simulate again". Pressing it calls `startVideoSimulation`, disables itself, then `router.push(resultHref(newId))`. On failure: "Could not start. Try again." under the button. No number, no curve, no panels.
  - result: `<PlayheadProvider>` around `<VideoResult model>`.
- [ ] **Header.** Phone: the shell's pushed header shows the state's title ("Video · 0:29", "Video", "Simulating"). Add `pushedTitle` / `setPushedTitle` to `useShellStore`; `NextShell` shows it when not in a thread; the page sets it and clears it on unmount. Back on `/simulation/*` is `router.back()` when there is history, else Home. Desktop (md and up): `ResultHeader`, a row with the Back `IconButton` and the title (`text-title font-[640]`), as in `spec-11-desktop.png`.
- [ ] **Layout** (`video-result.tsx`). Phone (one column, 16px side padding, 12px between cards): `Hero`, `Moment`, `PanelSwitch`, the chosen panel, and `CompactPlayer` pinned under the header once the hero has scrolled out (IntersectionObserver). Desktop: the video on the left; on the right a card with the gauge beside the moment, then the curve as its own full-width card, then the switch and the panel. Read `simD` and the `.desk` rules in the mock for the desktop measures and `simP0` for the phone's.
- [ ] **Panel switch.** A segmented control, `role="tablist"`, three tabs in this order: Brain, Engagement, Audience; Audience is selected first (as in the reference). Left and right arrows move, the panels are `role="tabpanel"`. Port `.tabs` from the mock.
- [ ] **Dev page** `/dev/result?fixture=<name>[&frames=<base>][&video=<url>][&processing=1]`: renders `ResultPage` on a recorded run (dynamic `import()` of the fixture). `frames=<base>` gives every scene the frame `<base>/<index>.jpg`.
- [ ] **`scripts/result-shots.cjs`** (Playwright, like `scripts/next-look-probe.cjs`): `node scripts/result-shots.cjs --out <dir> [--fixture early] [--view phone|desktop] [--theme light|dark] [--tab brain|engagement|audience] [--scroll <px>] [--t <seconds>]`. Phone 393×852, desktop 1440×900, device scale 2. It loads the cookies, opens the dev page with `frames=https://frames.fixture/early`, answers those requests from `.scratch/next-look/part2/frames/ZVDugmW7*/<i>.jpg`, starts Chromium with `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist --enable-webgl` (the brain is WebGL), waits for fonts and network, writes `<name>.png` and `<name>.json` with the page-relative box of every `[data-result]` element. `--t` moves the playhead (the page reads `?t=` on the dev page only).
- [ ] Tests first, each watched failing: `playhead.ts` (rest, step left and right at borders, inside a scene, from rest), `href.ts`, `readStartedId` (a stream with `event: started` then `data: {"id":"abc"}`; a stream that ends without it), `use-simulation-row` (polls while `processing`, stops after), `result-page` states with `@vitest-environment happy-dom` on the fixtures (the copy above appears; no score appears), the shell title, and the flag-off `notFound`.
- [ ] Verify in the browser: `node scripts/result-shots.cjs --out .scratch/next-look/part2/built/t2` for `early` (phone and desktop, light and dark), `no-audience`, and `processing=1`. Look at the pictures. Flag-off check: `pnpm exec vitest run src/app src/components/shell` stays green.

---

### Task 3: The hero — video, gauge, the line with the strip, the moment

**Files:** `player.tsx`, `gauge.tsx`, `curve.tsx`, `scene-strip.tsx`, `moment.tsx`, `hero.tsx`, `compact-player.tsx` and their tests in `src/components/result/__tests__/`. Nothing else.

**Consumes:** `VideoModel`, `usePlayhead`, `useSignedVideo`, `watchingAt`, `sceneEndShareAt`, `sceneIndexAt`, `timecode`. **Read in the mock first:** `mg` (gauge), `scrub` and `scr2` (line, band, ticks, playhead, readout), `rStrip` (strip), `rplayer` and `vframe` (video tile), the `.mom` rules and `simP0` (moment, hero), `scr` with `SC` (compact player).

- [ ] **Gauge.** A 270° arc from 135°, round caps, track in `--color-track`, value in ink (`--color-foreground`); inside it the number (`font-bold`, tabular) with a small "%" and under it the label "watch to the end". 148px in the phone hero, 180px on desktop. No "usual" line and no tick (slice B).
- [ ] **The line.** 100% at 0:00, one point at the end of each scene, straight lines (`model.audience.points`), a soft fill under it. Small ticks at scene borders. The named scene (`model.verdict.scene`): its segment of the line in `--color-below` on a band of `--color-below-soft`, at least 8px wide. Plot height 100px on phone. Times "0:00" and the clip's length under it.
- [ ] **The strip.** Under the line on the same time axis when any scene has a frame: one tile per scene, as wide as its time, 3px apart, 38px tall (46 on desktop), `rounded-lg`, the frame repeated to fill. The named scene carries the coral mark (a `--color-below` outline with a `--color-below-soft` wash). No frames: no strip.
- [ ] **Playhead.** At rest it sits at the clip's end as a dot on the line and there is no readout. While it moves: a vertical line and a readout chip with a stored value, `"71% · 0:03"` (`sceneEndShareAt`). Dragging on the line seeks (pointer events, also touch). The line is a slider: `role="slider"`, `aria-valuemin=0`, `aria-valuemax=clipS`, `aria-valuenow`, `aria-valuetext="0:03, 71% still watching"`; left and right arrows step by scene (`step`), Home goes to 0:00, End to rest; focus ring visible.
- [ ] **Player.** 9:16, 104px wide in the phone hero, `rounded-2xl`. With a file: a `<video>` (muted off, `playsInline`, `preload="metadata"`), registered with `attachVideo`; tapping toggles play; a round play mark while paused. Without a file: the frame of the scene under the playhead; without frames too: a quiet tile (`bg-surface-sunken`) with the clip's length, no play mark. On desktop the video has only the play button on it.
- [ ] **Moment.** One row under the hero, one button (`playFrom(scene.t0)`): the named scene's frame (64×114, `rounded-lg`), the sentence (`text-heading font-[640]`), and the scene's description (`text-meta`, secondary colour, two lines at most). No frame: sentence and description. No description: the sentence alone. No named scene: the sentence alone, not a button.
- [ ] **Compact player** (phone, scrolled): a small frame, the line 44px tall with the playhead, the number at the line's end. Compare with `spec-2-audience.png`.
- [ ] Tests (happy-dom, on the fixtures, real components): the gauge shows 46 and "watch to the end" for `early`; the line's `d` has one vertex per scene end plus the start; the coral segment exists for `early` and not for `leak`; the slider's arrows move `aria-valuenow` to scene borders; the readout is absent at rest and reads "71% · 0:03" at t = 2.5; no strip without frames; the moment is a button only when a scene is named; `holds` shows "Most watch to the end.".
- [ ] Verify in the browser against `spec-1-result.png`, `spec-4-noframes.png` (`--fixture middle`), `spec-11-desktop.png`, light and dark. Measure: video 104 wide, gauge 148, plot 100 tall, strip 38, moment frame 64×114. Report every difference you leave.

---

### Task 4: The Audience panel

**Files:** `src/lib/result/ring-layout.ts` (+ test), `audience-ring.tsx`, `audience-panel.tsx` (+ tests). Nothing else.

**Consumes:** `groupsAt`, `groupSections`, `groupWord`, `sceneEndShareAt`, `usePlayhead`, `timecode`. **Read in the mock first:** `ringDots`, `ring`, `rlit`, `rnamed`, `rrows`, `lens` (the `RUN` branches), and the `.au-g`, `.gs-*`, `.au-h`, `.lcap` rules.

- [ ] **`ring-layout.ts`** (pure): the positions of the ring's 1,000 dots and which wedge each belongs to, with wedges sized by `GroupRow.weight` (a group that is not in the run keeps a thin outline wedge). Port `ringDots`. Test: 1,000 dots in total, each wedge's share of dots within one dot of its weight, a fixed input gives a fixed output.
- [ ] **Ring.** One wedge per group. A wedge is full while its viewers watch and pale when they are gone (`lit`); the wedges of groups with `named && status === "left"` are coral instead of pale; an absent group is an outline. Phone: inner radius 74, outer 158, card 350px tall; desktop 56 / 124. Centre: at rest the headline and "stayed" ("46%" over "stayed"); while the playhead moves, `sceneEndShareAt` and "watching · 0:03". **Do not re-render 1,000 dots per frame:** the ring changes only when a group's state changes; memoise on that.
- [ ] **Rows.** Under small headings "Left" (earliest first) and "Stayed" (while the playhead moves the second heading reads "Watching"); then groups that are not in the run. A row: a dot (large for a heavy group, small for a light one; coral when `named && status === "left"`), the name, and `groupWord` at the right. No percentages and no head counts. Caption under the card: "One simulated viewer per group."
- [ ] Tests (happy-dom, fixtures): for `early` at rest the "Left" rows read Tough crowd "Left by 0:03", Purposeful viewers "Left by 0:03", Savers "Left by 0:07", …, and "Stayed" lists four; exactly the two named rows carry the coral state; for `leak` Sharers and Purposeful viewers read "Not in this run"; no "%" appears in a row.
- [ ] Verify against `spec-2-audience.png` and the desktop sheet, light and dark, at rest and at `--t 2.5`.

---

### Task 5: The Engagement panel

**Files:** `engagement-panel.tsx` (+ test). **Read in the mock first:** `engTiles` (the `RUN` branch) and `actCard`, with `.en-c`, `.en-h`, `.en-r`, `.ra-*`.

- [ ] **Avg watch.** One card: the label "Avg watch", the time `timecode(model.avgWatchS)` with "of 0:29" beside it, and a bar as long as the clip filled to `avgWatchS / clipS`.
- [ ] **What viewers are likely to do.** One card with that heading and `model.intents` as four rows, the longest first: an icon, the label (Share, Comment, Rewatch, Save), a bar `max(4, round(value))`% long. No verdict words ("low", "high") and no numbers. When `intents` is null this card is not rendered.
- [ ] The panel does not move with the playhead.
- [ ] Tests (happy-dom): for `early` "0:16" and "of 0:29" appear, the rows are in the order Share, Comment, Rewatch, Save; the words "low", "high" and "intent" do not appear; with `intents: null` only the first card renders.
- [ ] Verify against `spec-3-engagement.png`, light and dark.

---

### Task 6: The Brain panel

**Files:** `src/lib/result/brain-track.ts` (+ test), `brain-panel.tsx` (+ test), and one optional prop on `src/components/audience-lens/CortexCanvas.tsx`. Nothing else.

**Consumes:** `driveFor`, `predictedBold`, `hashSeed`, `RESTING_BOLD`, `NetworkId` (`src/lib/brain/cortex-sim.ts`); how the current tab drives the canvas (`src/components/audience-lens/v2/BrainTab.tsx`, `CortexFigure`); how the porcelain stills of the mock were made (`.scratch/next-look/part2/design/brain/entry4.ts`: fragment shader `FRAG2`, materials `light` and `pearl`). **Read in the mock first:** `brainRows`, `sigLine`, `lens` (brain branch), `.stagec`, `.en-*`.

- [ ] **First, look.** Before building, render today's `CortexCanvas` on three recorded runs (`early`, `holds`, `opening`) through a scratch page and look at it. If the model's output is flat, saturated or absurd on real runs, stop and report that instead of tuning it.
- [ ] **`brain-track.ts`** (pure): `brainTrackOf(model: VideoModel): { seed: number; drive: DriveInput; signals: Array<{ id: NetworkId; label: string; rest: number; perSecond: number[] }> }` with the four signals in this order and with these labels: `visual` "Eyes", `dorsal_attention` "Focus", `limbic` "Feeling", `default` "Wandering". The drive is `driveFor({ seedKey: model.id, stopRatio, durationS: model.clipS, retentionCurve })`, where `retentionCurve` is the still-watching line sampled once per second as 0..1 (`watchingAt(points, s) / 100`) and `stopRatio` is taken the way `buildBrainFrameData` (`src/lib/surfaces/ambient-v2-brain.ts`) takes it. `perSecond[s]` is `predictedBold(drive, s)[id] * 100`, `rest` is `RESTING_BOLD[id] * 100`. Test on `early` and `holds`: lengths, range 0..100, and that Focus at the end is lower on `early` than on `holds`.
- [ ] **Porcelain.** `CortexCanvas` gains `look?: "scan" | "porcelain-light" | "porcelain-dark"` (default `"scan"`: nothing changes for today's callers). The porcelain looks use `FRAG2` and the `light` / `pearl` values from `entry4.ts`. The panel picks by theme (`useTheme` in `src/lib/theme/use-theme.ts`).
- [ ] **Panel.** A card with the brain (`dynamic(() => import(...), { ssr: false })`), the corner label "At 0:07" while the playhead moves, and the small legend "calm · active". Under it a card with four rows, each: the label, a small curve over the clip (`perSecond`), a dashed line at `rest` with the legend "at rest", and the value at the playhead. Under the cards the caption "A model of attention, not a scan." The canvas gets `bold = predictedBold(drive, t)`, recomputed at most four times a second while playing.
- [ ] Tests: `brain-track` as above; the panel (happy-dom, the canvas replaced by a stand-in because WebGL cannot run there) shows the four labels in order, "at rest" and the caption.
- [ ] Verify in the browser (the shots script starts Chromium with WebGL), light and dark, at rest and at `--t 7`, against the brain in the v11 sheets (`~/virtuna-v1.1/.scratch/app-screens/app-v11-phone.jpg`) and the stills `.scratch/next-look/part2/design/img/brain-pl7.png` / `brain-pd7.png`. Say plainly how close it is.

---

### Task 7: Guards, keyboard, the comparison sheets, flag-off parity (controller)

- [ ] `src/components/result/__tests__/result-guard.test.ts`: every file in `src/components/result/` carries no colour literal and no `backdropFilter` (copy the method of `src/components/shell/__tests__/shell-guard.test.ts`).
- [ ] Keyboard pass in the browser: Tab reaches Back, the video, the line, the moment, the three tabs and the panel's controls in order; one ring each; arrows work on the line and the switch.
- [ ] Sheets: built against reference, side by side, phone and desktop, light and dark, for Result, Audience, Engagement, Brain, a later drop without frames, no audience. Saved under `.scratch/next-look/part2/built/`.
- [ ] A stored run of the signed-in test user opens at `/simulation/<id>` and plays.
- [ ] Flag off: `node scripts/next-look-probe.cjs` against the recorded baseline (`.scratch/next-look/baseline`) with `scripts/next-look-compare.cjs`; `/simulation/x` answers not found; `/analyze/<id>` is unchanged.
- [ ] Full suite, `tsc --noEmit`, `eslint`, `pnpm build`.
- [ ] Update `docs/DESIGN-SYSTEM.md` ("Next look": the result parts) and the spec's status line; write the "Result" section below.

## Spec coverage

| Spec | Task |
|---|---|
| §4 the one number, `headlineOf` | 1, 3 |
| §5 one thread, coral = the named scene | 1, 3, 4 |
| §5 hero, curve, strip, player | 3 |
| §5 the moment, the sentence | 1, 3 |
| §5 no next-step button until the editor exists | (nothing to build) |
| §5 no audience | 1, 2 |
| §5 Brain | 6 |
| §5 Engagement | 1, 5 |
| §5 Audience | 1, 4 |
| §5 header, scrolled phone, desktop | 2, 3 |
| §8 addresses and ways in | 2 |
| §9 code layout, recorded runs | 1 |
| §10 done-when 1 to 8 | 7 (and each task's own checks) |
| §5b the edit tool, §6 hook result, §7 running state, "your usual" | not in this slice |

## Result (2026-11-20)

Built, reviewed and verified. Nothing is committed: the work sits in the working tree of
`design/next-look` until the owner says so.

| Check | Result |
|---|---|
| Full suite | 617 files passed, 1 skipped, 0 failed; 7,337 tests (before this part: 593 files, 7,022 tests) |
| `tsc --noEmit` | clean |
| `eslint` on every touched folder | clean |
| `pnpm build` (flag off) | compiled successfully; `/simulation/[id]` and `/dev/result` are in the route list |
| Flag off, in a browser | 194 token values identical on `/home`, `/library`, `/feed` (phone and desktop); 7 of 9 chrome screenshots byte for byte, the other two differ in page content only (a post's age, another chat); `/simulation/<id>` and `/dev/result` say "404 Page not found"; `/analyze/<id>` is not redirected |
| A real stored run | `/simulation/ZVDugmW7mxzm` of the test user opens with its stored video and its 7 scene frames, no console errors |
| Real playback | pressing Play on that run: the video runs, the playhead follows (video 3.2 s, line 3.2 s), the readout reads "56% · 0:07", ring and brain follow |
| Keyboard, in a browser | Tab reaches Back, the video, the moment, the line, the selected tab and the panel, one ring each; arrows step the line by scene and move the switch; Home, End, Up and Down work |
| Against the reference | side by side in `.scratch/next-look/part2/built/result-page-built.png` (the approved row A above the built page; dark; desktop). Measured: video 104 wide, gauge 148, plot 100, strip 38, moment frame 64×114, ring 326 (phone) and 258 (desktop) |
| Independent code review | 16 findings; flag-off safety clean. Fixed: the two high ones (see below) and 10 of the others. Left open: the last list of this section |

**What the review changed**

- "Simulate again" is switched off (dormant behind `simulateAgain`): the server would delete the
  stored video when the new run is refused or fails. It also now handles a dead session and a
  spent allowance like every other paid request, opens the new run in place of the page, and
  does not navigate after the creator has left.
- A run whose pipeline died shows "This simulation did not finish." instead of "Simulating…"
  forever. A run that is not there stops being asked for (it polled every 2 seconds).
- Pressing End while the video plays lands at rest (it landed at 0:00). The compact player's
  line is no longer a second slider. Up and Down work on the line. The panel is a Tab stop. The
  phone header is the page's `h1`.
- The brain re-renders at most four times a second while playing (it re-rendered every frame).
- A one-scene run is drawn; a group without weight is counted in viewers; a group that is partly
  gone reads "Some left"; the caption reads "One to three simulated viewers per group." when a
  group appears more than once; a scene of no length cannot trap the arrow keys.

**Built differently from the plan**

- The readout's dot sits at the point the readout names (the end of the scene under the
  playhead), not on the slope at the playhead's time; the playhead is a plain vertical line.
- The play mark on the video is glass (`PlayMark`), the one exception to "no glass" on this page.
- The dev page is not found with the flag off as well.
- The Audience panel picks phone or desktop in code at the same 768px line as the page, because
  the ring's size changes with it.

**Added later the same day (second session)**

| Check | Result |
|---|---|
| Widths between phone and desktop, in a browser (768, 834, 900, 1024, 1180, 1240, 1280) | A defect, fixed. From 768 to about 1270 the Audience ring (a fixed 258 box) was wider than its card and was cut off; at 768 the sentence broke one word per line and the group names were cut. Now each part lays itself out for the width it gets, not for the window's: the Audience panel stacks below 570 and scales the ring to its card above (`src/lib/result/audience-layout.ts`, 12 tests); the gauge sits above the moment in a column under 460; the Brain panel stacks under 520. Measured after: the ring fits its card at all eight widths; phone (ring 326, video 104, gauge 148) and 1440 (ring 258) are unchanged. Sheet: `.scratch/next-look/part2/built/result-page-widths.png` |
| Reduced motion, in a browser | With the preference on, the page starts 0 animations or transitions (phone and desktop; load, the three panels, keyboard on the line). Before: the three tabs still faded their colour; fixed in `panel-switch.tsx` |
| Full suite after these changes | 618 files passed, 1 skipped, 0 failed; 7,349 tests. `tsc --noEmit` and `eslint` clean |

`scripts/result-shots.cjs` gained `--width`, `--height` and `--reduced-motion`.

**The two server findings: fixed in pull request #563**

Branch `fix/analyze-upload-cleanup` off `main`, worktree `~/virtuna-analyze-cleanup`.

- One owner check for a path in the `videos` bucket (`src/lib/storage/own-video-path.ts`), used
  by `POST /api/analyze` and `GET /api/videos/sign`.
- The orphan cleanup of `api/analyze` removes only the caller's own upload, and only while no
  stored run plays from it. A run of a stored video that is refused, cached or fails leaves the
  video where it is: the server side of "Simulate again".
- Checked against a running server, old code against new, and by an independent review. The
  details are in the pull request.

**Open after this part**

For the owner:
- Merging pull request #563 (merging deploys).
- "Simulate again" stays switched off here until that fix is in this branch's base.
- When a stored video is run again, two runs share one file. The 30-day retention job deletes
  the file when the FIRST run is 30 days old and clears the path on that run only; the newer run
  keeps a dead path (its page shows the video as gone). Should a new run keep the video for
  another 30 days, or does the file expire 30 days after upload? (`cron/delete-retained-videos`)
- Not verified, read in code only: the weekly orphan sweep (`cron/sweep-orphan-videos`) deletes
  every file in the `videos` bucket that no run references and that is older than a day. The
  engine's training videos live in that bucket under `training/` and are tracked in another
  table, so the sweep would delete them wherever it runs.

For later parts and the cut-over:
- The sealed result of an anonymous funnel visitor has no state on the new page.
- The video's signed address lasts an hour; a page left open longer cannot play until reloaded,
  and nothing says so.
- Back uses the browser history when there is any.
- `/analyze/[id]` redirects from inside the legacy layout's Suspense; the legacy thread may mount
  for a moment before the redirect on a full page load. Not measured.
- A viewer whose stored leaving time is not on a scene border is counted one scene late, as in
  the engine's own helper (older runs only).
- Not checked: iOS Safari and a real touch device; a screen reader; the brain's cost on a real
  phone; the in-between widths in dark (same tokens, not looked at).
- Slice B: "your usual", the staged running state, the hook result. The Edit button arrives with
  the edit tool.
