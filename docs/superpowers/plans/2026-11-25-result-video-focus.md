# The result with the video in focus, and the simulating screen A: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. One task per
> implementer, a failing test first for every behaviour, a review after each task.

**Goal:** under the new look, on `/simulation/[id]`: the video in focus at the top of the result (the
gauge leaves the page) with one count under it, "how many of 1,000 viewers", that follows the video;
Engagement and Brain redrawn so playing the video moves them; the screen shown while a simulation runs
redrawn as the result's first block building itself (option A), drawn by the same layout parts as the
result, so the result lands in its place. Spec: `docs/superpowers/specs/2026-11-25-result-video-focus-design.md`.
`.superpowers/sdd/2026-11-25-video-focus/rulings.md` wins over this plan and the spec; the approved
pictures (`.scratch/next-look/part8d/simulation/hero4-a-hero.png`, `hero4-b-engagement-brain.png`,
`options-template.html` scene `#a`) win over the spec's wording.

**Shape:** no route, table, package or request is added (the stream's existing `source` event is read).
New pure modules in `src/lib/result/`: `count.ts`, `most-likely.ts`, `brain-read.ts`. New parts in
`src/components/result/`: `first-block.tsx` (the shared layout parts and the loading frame),
`viewer-count.tsx`, `landing.tsx`. Rewritten: `hero.tsx`, `engagement-panel.tsx`, `running.tsx`,
`running-ring.tsx` (keeps `equalRing` only), most of `video-result.tsx`, `compact-player.tsx`. Edited:
`curve.tsx` (draws through `LineFrame`; an entrance, off by default), `scene-strip.tsx` (two shared
constants), `player.tsx` (exports, the hero tile's width moves to the layout), `brain-panel.tsx`,
`result-page.tsx`, `use-run-stream.ts`, `run-progress.ts`, the dev preview, `src/app/globals.css`
(new `result-` keyframes), `src/components/app/home/composer.tsx` (one import and one effect that
hands `nextRunInputsRef.current?.file` over; no send path changes; built by the controller),
`docs/DESIGN-SYSTEM.md`.

**Stack:** Next.js 16.1, React 19.2, TypeScript, Tailwind v4 (container queries, arbitrary values),
TanStack Query 5, Vitest 4 (happy-dom 20, Testing Library), `@sinonjs/fake-timers` through `vi.useFakeTimers`.

## Global constraints (every task)

Copied from the rulings; they bind every task.

- **Rule 1.** Workers run in this one working tree. Never commit, stash, reset or push. No dev server,
  build, network, database query or `.env*` read: the controller runs the real checks. Another session
  edits `src/components/thread-next`, `src/components/home-next` and `src/lib/thread-next` in this same
  tree: never touch those folders, and report (do not fix) a failure that comes from them.
- **Rule 4.** Code comments give the reason, never a ruling number, a task number, a review or a fix
  round.
- **Rule 5.** The repository is public: no real handle, id or link in code, tests, fixtures or docs
  (made-up names such as `nia.tests`, hosts such as `p.test`, `f`, `frames.test`); nothing that
  describes an open weakness.
- **Rule 6.** Nothing is invented on screen. The only new numbers are counts out of 1,000 (a stored
  share times ten, rounded) and they follow rule 9. No count, no line and no percent while a simulation
  is still running: the wait shows the clip, the frames that arrived and the time since the start.
- **Rule 7.** Change only what he named. NOT edited at all: `audience-panel.tsx`, `audience-ring.tsx`,
  `panel-switch.tsx`, `moment.tsx`, `gauge.tsx`, `text-result*.tsx`, `no-audience.tsx`,
  `result-header.tsx`, `playhead.tsx`, `src/lib/result/playhead.ts`, `headline.ts`, `verdict.ts`,
  `video-model.ts`, and their tests. Stay as built: the tabs' order (Brain, Engagement, Audience) and
  Audience open first; the sentence row; the line at rest, its playhead line, its dot, its chip
  ("71% · 0:03"), its slider behaviour and its screen-reader text; the film strip's look; "After
  posting" and its place; the dead ends; the loading frame's idea; the old look (flag off renders
  exactly as before). No next-step button, no "On screen:", no estimated like / comment / save / share
  counts, no circle of dots anywhere on `/simulation/[id]`.
- **Rule 8.** Tokens only, type roles only, no glass outside `player.tsx`, no colour literal
  (`result-guard.test.ts` scans every file directly in `src/components/result`: no `#hex`, `rgb(`,
  `rgba(`, `hsl(`, `oklch(`, no `backdropFilter` / `backdrop-blur` outside `player.tsx`, no
  `text-[Npx]`). Every motion is behind `motion-safe:` or `usePrefersReducedMotion()`: with reduced
  motion nothing moves by itself.
- **Rule 31.** A failing test first for every behaviour; stand-ins only at I/O boundaries (`fetch`,
  `EventSource`, `matchMedia`, the clock, `IntersectionObserver`, `ResizeObserver`, a video element's
  `play`, and, where a width must be measured, the element's `clientWidth`, which happy-dom does not
  lay out); never for the unit under test; never `-u`. Tests that pin what changes are rewritten to pin
  the new behaviour, not deleted. Component tests carry `/** @vitest-environment happy-dom */` and use
  the real `PlayheadProvider` and the recorded fixtures (`src/lib/result/__tests__/fixtures/*.json`)
  through `hero-harness.tsx` (`modelOf`, `renderWithPlayhead`, `playhead`).
- Implementers do not commit. Each command once per task (plus once more after a fix):
  `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <paths> --testTimeout 30000`,
  `pnpm exec tsc --noEmit`, `pnpm exec eslint <changed files>`. A `tsc` error in a file of the other
  session's three folders is reported, not fixed.
- Reports: `.superpowers/sdd/2026-11-25-video-focus/task-N-report.md` (what changed, the three
  commands' totals, anything removed by rule 28 and the grep that proved it had no user). The reply to
  the controller is only: status (DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED), one line of
  test totals, and concerns.
- Numbers the tests pin, read from the fixtures before planning (`early`: clip 0:29, 7 scenes, stored
  shares 100 at 0:00 and 0:02, 70.7865 at 0:03, 56.1798 at 0:07, 46.0674 from 0:14; headline 46):
  the count at rest is **461**, at 0:02.5 **854**, at 0:07 **562**, past the opening (0:03) **708**;
  `holds` ends at **843**, `ending` at **0**, `opening` is **708** past the opening and at the end;
  the Focus sentences (ruling 33: the lowest read from the highest second on) are early "Focus is
  highest at 0:07 and lowest at 0:23.", middle "Focus is highest at 0:10 and falls when the scene
  changes at 0:17.", opening "Focus is highest at 0:09 and lowest at 0:20.", leak "Focus is highest at
  0:08 and lowest at 0:25.", holds "Focus is highest at 0:09 and lowest at 0:16.", ending "Focus is
  highest at 0:09 and lowest at 0:29."; at 0:07 early's four words are above, above,
  above, below rest; at its end all four are above rest; at 0:00 all four are at rest.

## Constants and contracts (shared by all tasks)

A later task may only use names defined here.

### `src/lib/result/count.ts` (pure)

```ts
export const VIEWERS = 1000;
export const OPENING_S = 3;
export const COUNT_WORDS = { end: "watched to the end", now: "still watching" } as const;
export type CountWords = (typeof COUNT_WORDS)[keyof typeof COUNT_WORDS];
export interface Count { n: number; words: CountWords }
export const OF_VIEWERS = "of 1,000";
export const ROLL_MS = 1500;
export function toCount(pct: number): number;                 // Math.round(pct * 10)
export function formatCount(n: number): string;               // n.toLocaleString("en-US")
export function endCount(audience: Audience): number;         // toCount(last point's share)
export function countAt(audience: Audience, t: number, resting: boolean): Count;
export function pastOpening(audience: Audience): number;      // toCount(watchingAt(points, min(3, clipS)))
export function rolledAt(from: number, to: number, elapsedMs: number): number; // ease-out cubic over ROLL_MS, rounded
```

### `src/lib/result/most-likely.ts` (pure)

```ts
export function mostLikely(intents: readonly Intent[] | null): Intent["id"] | null;
```

### `src/lib/result/brain-read.ts` (pure)

```ts
export const LEVEL_STEP = 3;
export type RestWord = "above rest" | "at rest" | "below rest";
export function restWord(level: number, rest: number): RestWord;
export const SIGNAL_MEANING: Partial<Record<NetworkId, string>>;
export function momentLine(t: number): string;               // `At ${timecode(t)} · the dashed line is at rest`
export const FOCUS_LEVEL = "Focus stays level through the video.";
export function focusSentence(perSecond: readonly number[], scenes: readonly Scene[]): string;
```

### `src/lib/result/run-progress.ts` (additive; `frameOnScreen` removed in Task 5)

```ts
export interface RunProgress {
  groups: readonly string[] | null;
  frames: ReadonlyArray<string | null>;
  /** The post's cover (a link run), once the stream named one; null until then, and for a file. */
  cover: string | null;
  done: boolean;
}
export const NO_PROGRESS: RunProgress = { groups: null, frames: [], cover: null, done: false };
export type RunEvent =
  | { type: "roster"; data: unknown }
  | { type: "source"; data: unknown }
  | { type: "filmstrip_segment_ready"; data: unknown }
  | { type: "complete" };
```

### `src/components/result/first-block.tsx` (the shared layout parts)

```ts
export const PLOT_PX = { phone: 100, wide: 104 } as const;
export const STRIP_GAP_PX = 3;
export const stripHeight: (width: number) => number;          // width > 400 ? 46 : 38
export const STRIP_TILE = "rounded-lg bg-surface-sunken shadow-[0_0_0_1px_var(--color-border)]";
export const PHONE_LINE_FALLBACK = 333;
export const WIDE_LINE_FALLBACK = 540;
export const PHONE_COLUMN = "px-4 pt-[9px] pb-[calc(env(safe-area-inset-bottom)+40px)]";
export const PHONE_TOP_PX = 9;

export interface FirstCardProps {
  name?: string;                          // the card's data-result: "hero" | "running"
  cardRef?: React.Ref<HTMLDivElement>;
  tile: React.ReactNode;                  // in data-part="tile-box": mx-auto w-[clamp(140px,53%,200px)]
  under: React.ReactNode;                 // in data-part="under": mt-4 flex min-h-[34px] items-center justify-center
  line: React.ReactNode;                  // in data-part="line-box": mt-3.5 border-t border-border pt-[30px]
}
export function FirstCard(props: FirstCardProps): React.JSX.Element;   // Card px-3.5 pb-3 pt-5

export interface LineFrameProps {
  width?: number;                         // the frame's own width when undefined (the loading frame)
  height: number;
  box?: React.HTMLAttributes<HTMLDivElement>;   // the slider's props on the result; merged with "relative rounded-md"
  plotRef?: React.Ref<HTMLDivElement>;
  plotName?: string;                      // the plot box's data-result ("curve" on the result)
  plot?: React.ReactNode;
  strip: React.ReactNode | null;          // data-part="strip-slot", mt-2, pointer-events-none
  stripClassName?: string;
  times: readonly [string, string] | null;      // data-part="times": h-[21px], mt-0.5 with a strip, else mt-1
}
export function LineFrame(props: LineFrameProps): React.JSX.Element;  // data-part="line-frame", plot data-part="plot"

export interface WideFrameProps {
  name?: string;                          // the root's data-result ("running" while it simulates)
  tile: React.ReactNode;                  // data-part="tile-column", first child
  under: React.ReactNode;                 // data-part="under": mt-[18px] flex min-h-[34px] items-center justify-center
  first: React.ReactNode;                 // inside data-result="sentence-card" (flex min-h-[158px] items-center p-[22px] @min-[460px]:pr-[30px])
  firstClassName?: string;
  after?: React.ReactNode;                // data-part="after", empty:hidden; not rendered when undefined
  afterClassName?: string;
  lineCardRef?: React.Ref<HTMLDivElement>;
  line: React.ReactNode;                  // in data-part="line-card": Card px-6 pb-3.5 pt-8
  rest?: React.ReactNode;                 // a flex flex-col gap-4 wrapper; not rendered when undefined
  restClassName?: string;
}
export function WideFrame(props: WideFrameProps): React.JSX.Element;
export function ResultFrame(): React.JSX.Element;            // moved here from video-result.tsx
```

### `src/components/result/player.tsx` (exports added)

```ts
export const TILE = "relative aspect-[9/16] shrink-0";
export const RADIUS: Record<"hero" | "desktop" | "compact", string>;   // was module-private
export const SHADOW: Record<"hero" | "desktop" | "compact", string>;   // unchanged
// BOX.hero becomes "w-full": the first card's tile box sets the hero tile's width.
```

### Other parts

```ts
// viewer-count.tsx
export function ViewerCount({ audience }: { audience: Audience }): React.JSX.Element;
// landing.tsx (Task 6)
export const LandingProvider: React.Provider<boolean>;
export function useLanding(): boolean;
export const LANDING_MS = 2000;
export function useLandingWindow(on: boolean, ms?: number): boolean;
export const LAND: { draw: string; coral: string; fill: string; strip: string; rest: string };
// curve.tsx (Task 6, additive): Curve takes `enter?: boolean` (default false)
// running.tsx (Task 5): RunningPreview loses `arriving`
export interface RunningPreview { progress?: RunProgress; video?: string | null; elapsed?: number }
// running-ring.tsx (Task 5): only `equalRing` and `EqualRing` remain (audience-next uses them)
```

### Words (new; spec section 6 exactly, `Usually about a minute` is not used: rule 20)

`of 1,000` · `watched to the end` · `still watching` · `Of 1,000 viewers` · `Past the first 3 seconds` ·
`Watched to the end` · `Average watch` · `Now, at <m:ss>` · `<n> still watching` · `Most likely` ·
`Focus stays level through the video.` · `Focus is highest at <m:ss> and falls when the scene changes at <m:ss>.` ·
`Focus is highest at <m:ss> and lowest at <m:ss>.` · `At <m:ss> · the dashed line is at rest` ·
`what there is to look at` · `how closely they follow` · `how much it moves them` · `how far the mind drifts` ·
`above rest` · `at rest` · `below rest` · `Building your 1,000 viewers`. Gone from this page:
`watch to the end` (the gauge).

### Sizes

| Part | Size | Where written |
|---|---|---|
| Phone first card | padding 14 sides, 20 top, 12 bottom | `FirstCard` |
| Tile | `clamp(140px, 53%, 200px)` of the card's inside (176 at 393), 9:16 | `FirstCard`, `TILE` |
| Under the tile | 16 below, one line at least 34 tall | `FirstCard` (`UNDER`) |
| Hairline | 14 below the count, 30 over the plot | `FirstCard` |
| Plot | 100 phone, 104 wide | `PLOT_PX` |
| Strip | 8 below the plot, 38 tall, 46 on a line over 400, tiles 3 apart | `LineFrame`, `stripHeight`, `STRIP_GAP_PX` |
| Times row | 21 tall, 2 under a strip, 4 without | `LineFrame` |
| Wide grid | 980, 372fr / 588fr, 20 apart, 32 from the top | `WideFrame` |
| Wide under the tile | 18 below | `WideFrame` |
| Sentence card | padding 22, right 30 from a 460 column, at least 158 tall (the moment's 114 frame and the padding) | `WideFrame` |
| Line card | padding 32 top, 24 sides, 14 bottom | `WideFrame` |
| Count number | `text-3xl font-bold leading-[25px] tracking-[-0.04em]` (today's "Avg watch" role) | `ViewerCount` |
| Engagement figures | `text-heading font-bold tracking-[-0.03em]` (22/26, as drawn) | `engagement-panel.tsx` |
| Engagement marker | 2 wide, 18 tall, 5 above the 8 tall bar, `bg-below` | `engagement-panel.tsx` |
| Brain label column | 112; 96 where the card's inside is under 300 | `brain-panel.tsx` |
| Brain word column | 74, never wraps; columns 10 apart | `brain-panel.tsx` |
| Brain on a wide panel | the brain 164 tall at `top: calc(50% - 82px)` | `brain-panel.tsx` |
| Wait | 7 tiles; dotted base at y 30 of the plot; tile band 38% tall from -40% | `running.tsx` |

### `data-result` and `data-part` names

Kept (rule 27): `hero`, `video`, `curve`, `strip`, `moment`, `compact`, `panel`, `tabs`, `engagement`,
`intents`, `brain`, `brain-stage`, `brain-signals`, `running-picture`, `running-clock`, the Audience
ones. Gone from this page: `gauge` (the `Gauge` part keeps it where it is still used), `running-ring`,
`avg-watch`. New `data-result`: `count`, `sentence-card`, `of-viewers`, `running` (the wait's phone card
and its wide root), `running-strip`. New `data-part`: `tile-box`, `under`, `line-box`, `line-frame`,
`plot`, `strip-slot`, `times`, `tile-column`, `after`, `line-card`, `count-number`, `count-words`,
`now`, `figure`, `marker`, `most-likely`, `focus-sentence`, `moment-line`, `moment-mark`, `building`,
`dots`, `base`, `scan`, `sweep`, `shimmer`. New attributes: `data-shows` (`clip|cover|frame|none`) on
`running-picture`; `data-tile`, `data-filled` on the wait's strip tiles; `data-tiles` on the wait's
strip; `data-meaning`, `data-word` in a Brain row; `data-landing` on `[data-result-body]`.

### Motion (`src/app/globals.css`, appended, outside `@theme`; every class `motion-safe:`)

| Keyframes | Task | Used by |
|---|---|---|
| `result-sweep` (`top` -40% → 105%) | 5 | the wait's tile band, 2.8 s `cubic-bezier(0.4,0,0.2,1)` infinite |
| `result-scan` (`left` -60px → 100%) | 5 | the wait's plot band, 2.2 s linear infinite |
| `result-shimmer` (`translateX` -100% → 100%) | 5 | an empty wait strip tile, 1.6 s ease-in-out infinite |
| `result-blink` (opacity .2 / 1 at 30%) | 5 | the three dots, 1.2 s, 0 / 200 / 400 ms delays |
| `result-settle` (opacity 0, `scale(1.15)` → 1, none) | 5 | a wait strip tile's frame once loaded, 0.7 s |
| `result-draw` (`stroke-dashoffset` 1 → 0) | 6 | the landing line, 1.5 s `cubic-bezier(0.3,0.1,0.2,1)` |
| `result-fade` (opacity 0 → 1) | 6 | coral and band 0.4 s after 0.5 s; fill and ticks 0.8 s after 0.9 s; strip 0.5 s; the rest 0.5 s after 0.9 s |

### How the landing reaches the parts (rule 25)

`ResultPage` already knows `arrived` (`useArrivedFromRun`). It also reads `usePrefersReducedMotion()`
(mounted since the running state, so the setting has settled by the time the result arrives) and
computes `landing = useLandingWindow(arrived && state.kind === "result" && !reducedMotion)`: true for
`LANDING_MS` (2 s, longer than every part's motion, the longest ends at 1.7 s) after the result
arrived, then false for good. It hands it down with `<LandingProvider value={landing}>` around
`VideoResult`. Parts read `useLanding()` (default `false`: a part rendered alone, a result opened
directly, reduced motion). `ViewerCount` rolls with `requestAnimationFrame` (decided at its mount, so a
count mounted later, after a resize or in the pinned player, never rolls; the final value is in an
`sr-only` span from the first frame); `Curve` takes `enter` (off by default) and gives its parts the
`LAND` classes; `PhoneResult` and `DesktopResult` give `LAND.rest` to the blocks outside the first
block. Keyframe animations with `both` fill were chosen over `@starting-style` (`starting:`): the
delays hold the start state without a flash, the classes are plain strings a test can read, and
nothing depends on whether the browser counted the element as newly styled. The whole-body
`ARRIVAL_FADE` stays for a run that ends with no audience only.

---

## Task order and why it differs from rule 32's split

1. The pure code: the count, the most likely action, the Brain's words and sentence, the stream's cover.
2. The shared layout parts (`first-block.tsx`), the hero on a phone and a wide window, the count, the
   pinned player, the loading frame. **Changed from rule 32:** the layout parts come here, not with
   the simulating screen, because the hero is their first user; building the hero first and moving it
   into the parts later would rewrite it twice.
3. Engagement.
4. Brain.
5. The simulating screen through the layout parts, its keyframes, the dev preview's `cover`, the
   removals (the ring, `frameOnScreen`, `arriving`, `groups`).
6. The landing (and the dev preview's `land`).
7. The composer's hand-off of the creator's clip, **built by the controller** (ruling 36). **Changed
   from rule 32:** its own task, because it is the only change in a 5,000-line file the chat session
   works next to, and nothing in Tasks 1 to 6 depends on it.
8. The design-system text and the leftovers.

---

### Task 1: the pure code and the stream's cover

**Files.** Create `src/lib/result/count.ts`, `src/lib/result/most-likely.ts`, `src/lib/result/brain-read.ts`,
`src/lib/result/__tests__/count.test.ts`, `src/lib/result/__tests__/most-likely.test.ts`,
`src/lib/result/__tests__/brain-read.test.ts`. Modify `src/lib/result/run-progress.ts`,
`src/lib/result/__tests__/run-progress.test.ts`, `src/components/result/use-run-stream.ts`,
`src/components/result/__tests__/use-run-stream.test.tsx`, and, only to add `cover: null` to a
`RunProgress` literal the new field makes incomplete, `src/app/(app)/dev/result/dev-result.tsx` (line 55-59)
and `src/components/result/__tests__/running.test.tsx` (lines 458 and 479). **Must not touch** anything
else; `frameOnScreen` stays until Task 5.

**Consumes:** `watchingAt` (`curve.ts`), `timecode` (`format.ts`), `Audience`, `Intent`, `Scene`
(`types.ts`), `NetworkId` (`@/lib/brain/cortex-sim`). **Produces:** the three modules as in the
contracts; `RunProgress.cover`, the `source` event.

#### Step 1: the failing tests

`src/lib/result/__tests__/count.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  COUNT_WORDS,
  OF_VIEWERS,
  OPENING_S,
  ROLL_MS,
  VIEWERS,
  countAt,
  endCount,
  formatCount,
  pastOpening,
  rolledAt,
  toCount,
} from "../count";
import { watchingAt } from "../curve";
import type { Audience, ResultRow, VideoModel } from "../types";
import { videoStateOf } from "../video-model";
import early from "./fixtures/early.json";
import ending from "./fixtures/ending.json";
import holds from "./fixtures/holds.json";
import opening from "./fixtures/opening.json";

function modelOf(fixture: unknown): VideoModel {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error(`fixture is ${state.kind}, not a result`);
  return state.model;
}

describe("the count's words", () => {
  it("counts the simulated audience as 1,000 viewers", () => {
    expect(VIEWERS).toBe(1000);
    expect(OF_VIEWERS).toBe("of 1,000");
    expect(OF_VIEWERS).toBe(`of ${formatCount(VIEWERS)}`);
    expect(COUNT_WORDS).toEqual({ end: "watched to the end", now: "still watching" });
    expect(OPENING_S).toBe(3);
  });
});

describe("toCount", () => {
  it("is a stored share times ten, rounded", () => {
    expect(toCount(100)).toBe(1000);
    expect(toCount(0)).toBe(0);
    expect(toCount(46.0674)).toBe(461);
    expect(toCount(45.96)).toBe(460);
    expect(toCount(70.7865)).toBe(708);
  });
});

describe("formatCount", () => {
  it("writes the thousands with a comma", () => {
    expect(formatCount(1000)).toBe("1,000");
    expect(formatCount(461)).toBe("461");
    expect(formatCount(0)).toBe("0");
  });
});

describe("countAt", () => {
  const { audience, clipS, headline } = modelOf(early);

  it("at rest: the share stored at the end of the last scene, watched to the end", () => {
    expect(countAt(audience, clipS, true)).toEqual({ n: 461, words: "watched to the end" });
    expect(endCount(audience)).toBe(461);
  });

  it("never the headline's rounded percent times ten (46% would say 460)", () => {
    expect(headline.value).toBe(46);
    expect(endCount(audience)).not.toBe(headline.value * 10);
  });

  it("at any other moment: the line's value there, still watching", () => {
    expect(countAt(audience, 0, false)).toEqual({ n: 1000, words: "still watching" });
    expect(countAt(audience, 2.5, false)).toEqual({ n: 854, words: "still watching" });
    expect(countAt(audience, 7, false)).toEqual({ n: 562, words: "still watching" });
    // Stopped at the clip's end without being at rest is still a moment of the line.
    expect(countAt(audience, 29, false)).toEqual({ n: 461, words: "still watching" });
  });

  it("is the line at the moment, everywhere", () => {
    for (const t of [0, 1, 2.4, 3, 6.9, 13.2, 20, 28.7]) {
      expect(countAt(audience, t, false).n).toBe(Math.round(watchingAt(audience.points, t) * 10));
    }
  });

  it("reads other runs: holds ends at 843, ending at 0", () => {
    expect(endCount(modelOf(holds).audience)).toBe(843);
    expect(endCount(modelOf(ending).audience)).toBe(0);
  });
});

describe("pastOpening", () => {
  it("is the count at 0:03", () => {
    expect(pastOpening(modelOf(early).audience)).toBe(708);
    expect(pastOpening(modelOf(holds).audience)).toBe(1000);
    expect(pastOpening(modelOf(opening).audience)).toBe(708);
  });

  it("is the count at the clip's end for a clip shorter than 3 seconds", () => {
    const short: Audience = {
      clipS: 2,
      scenes: [{ index: 0, t0: 0, t1: 2, frame: null, description: null }],
      viewers: [],
      points: [
        [0, 100],
        [2, 40],
      ],
    };
    expect(pastOpening(short)).toBe(400);
  });
});

describe("rolledAt", () => {
  it("rolls from 1,000 to the count in 1.5 s, whole numbers", () => {
    expect(ROLL_MS).toBe(1500);
    expect(rolledAt(1000, 461, 0)).toBe(1000);
    expect(rolledAt(1000, 461, 750)).toBe(528);
    expect(rolledAt(1000, 461, 1500)).toBe(461);
    expect(rolledAt(1000, 461, 9000)).toBe(461);
    expect(rolledAt(1000, 461, -5)).toBe(1000);
  });

  it("eases out: past half the way at a third of the time", () => {
    expect(rolledAt(1000, 0, 500)).toBe(296);
  });
});
```

`src/lib/result/__tests__/most-likely.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mostLikely } from "../most-likely";
import type { Intent, ResultRow } from "../types";
import { videoStateOf } from "../video-model";
import early from "./fixtures/early.json";
import holds from "./fixtures/holds.json";

const LABEL = { share: "Share", comment: "Comment", rewatch: "Rewatch", save: "Save" } as const;
const intent = (id: Intent["id"], value: number): Intent => ({ id, label: LABEL[id], value });
const intentsOf = (fixture: unknown) => {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error("not a result");
  return state.model.intents;
};

describe("mostLikely", () => {
  it("names the one action with the highest value", () => {
    expect(mostLikely([intent("share", 47.9), intent("comment", 29.6), intent("rewatch", 19.4), intent("save", 12.5)])).toBe("share");
  });

  it("follows the run: early Share, holds Save", () => {
    expect(mostLikely(intentsOf(early))).toBe("share");
    expect(mostLikely(intentsOf(holds))).toBe("save");
  });

  it("names none on a tie for the highest", () => {
    expect(mostLikely([intent("share", 40), intent("comment", 40), intent("rewatch", 10), intent("save", 5)])).toBeNull();
  });

  it("names none when every value is zero", () => {
    expect(mostLikely([intent("share", 0), intent("comment", 0), intent("rewatch", 0), intent("save", 0)])).toBeNull();
  });

  it("a tie further down does not matter", () => {
    expect(mostLikely([intent("share", 50), intent("comment", 20), intent("rewatch", 20), intent("save", 1)])).toBe("share");
  });

  it("names none without intents", () => {
    expect(mostLikely(null)).toBeNull();
    expect(mostLikely([])).toBeNull();
  });
});
```

`src/lib/result/__tests__/brain-read.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FOCUS_LEVEL, LEVEL_STEP, SIGNAL_MEANING, focusSentence, momentLine, restWord } from "../brain-read";
import { brainTrackOf } from "../brain-track";
import type { ResultRow, Scene, VideoModel } from "../types";
import { videoStateOf } from "../video-model";
import early from "./fixtures/early.json";
import ending from "./fixtures/ending.json";
import holds from "./fixtures/holds.json";
import leak from "./fixtures/leak.json";
import middle from "./fixtures/middle.json";
import opening from "./fixtures/opening.json";

/** Scenes starting at these seconds (the first at 0:00), each ending where the next starts. */
const scenesAt = (...starts: number[]): Scene[] =>
  starts.map((t0, index) => ({ index, t0, t1: starts[index + 1] ?? t0 + 5, frame: null, description: null }));

function modelOf(fixture: unknown): VideoModel {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error(`fixture is ${state.kind}, not a result`);
  return state.model;
}
const focusOf = (model: VideoModel) => brainTrackOf(model).signals.find((s) => s.id === "dorsal_attention")!.perSecond;

describe("restWord", () => {
  it("more than 3 points over the resting level is above rest, more than 3 under below rest, else at rest", () => {
    expect(LEVEL_STEP).toBe(3);
    expect(restWord(54, 10)).toBe("above rest");
    expect(restWord(13.1, 10)).toBe("above rest");
    expect(restWord(13, 10)).toBe("at rest");
    expect(restWord(10, 10)).toBe("at rest");
    expect(restWord(7, 10)).toBe("at rest");
    expect(restWord(6.9, 10)).toBe("below rest");
  });
});

describe("SIGNAL_MEANING", () => {
  it("says what each of the four signals stands for", () => {
    expect(SIGNAL_MEANING).toEqual({
      visual: "what there is to look at",
      dorsal_attention: "how closely they follow",
      limbic: "how much it moves them",
      default: "how far the mind drifts",
    });
  });
});

describe("momentLine", () => {
  it("names the moment the rows are read at", () => {
    expect(momentLine(7)).toBe("At 0:07 · the dashed line is at rest");
    expect(momentLine(7.25)).toBe("At 0:07 · the dashed line is at rest");
    expect(momentLine(29)).toBe("At 0:29 · the dashed line is at rest");
  });
});

describe("focusSentence", () => {
  it("level: highest minus lowest under 3 points", () => {
    expect(FOCUS_LEVEL).toBe("Focus stays level through the video.");
    expect(focusSentence([40, 41, 42.9, 41], scenesAt(0, 2))).toBe(FOCUS_LEVEL);
    expect(focusSentence([], [])).toBe(FOCUS_LEVEL);
  });

  it("a fall of 3 or more after the peak that lands on a scene change: falls when the scene changes", () => {
    // Highest at 0:02 (60); the largest fall after it, 60 to 40, lands on 0:03, where a scene starts.
    expect(focusSentence([20, 50, 60, 40, 38, 37], scenesAt(0, 3))).toBe(
      "Focus is highest at 0:02 and falls when the scene changes at 0:03.",
    );
  });

  it("within one second of the scene's start; the nearest start, the earlier on a tie", () => {
    // The fall (55 to 30) lands on 0:04: starts at 0:03 and 0:05 are both a second away.
    expect(focusSentence([10, 50, 60, 55, 30, 29], scenesAt(0, 3, 5))).toBe(
      "Focus is highest at 0:02 and falls when the scene changes at 0:03.",
    );
    // Starts at 0:04 and 0:05: 0:04 is nearer.
    expect(focusSentence([10, 50, 60, 55, 30, 29], scenesAt(0, 4, 5))).toBe(
      "Focus is highest at 0:02 and falls when the scene changes at 0:04.",
    );
  });

  it("the first scene's start is not a scene change", () => {
    // Highest at 0:00; the fall lands on 0:01, a second from the first scene's start but two from the next.
    expect(focusSentence([60, 30, 25, 24], scenesAt(0, 3))).toBe("Focus is highest at 0:00 and lowest at 0:03.");
  });

  it("a fall under 3 points: lowest, read from the highest second on", () => {
    // The whole clip's lowest (10 at 0:00) comes before the peak and is not read.
    expect(focusSentence([10, 40, 41, 39.5, 38, 37], scenesAt(0, 3))).toBe("Focus is highest at 0:02 and lowest at 0:05.");
  });

  it("a large fall far from any scene change: lowest, from the highest second on", () => {
    expect(focusSentence([10, 60, 59, 58, 30, 29, 28], scenesAt(0, 1))).toBe("Focus is highest at 0:01 and lowest at 0:06.");
  });

  it("neither a fall nor a low before the peak is read", () => {
    // 50 to 10 lands on 0:01, a second from the scene at 0:02, and 10 is the clip's lowest: both come
    // before the peak at 0:03, so the lowest from the peak on is 59 at 0:04.
    expect(focusSentence([50, 10, 20, 60, 59], scenesAt(0, 2))).toBe("Focus is highest at 0:03 and lowest at 0:04.");
  });

  it("the first highest second, and the first lowest second at or after it", () => {
    expect(focusSentence([10, 60, 10, 60, 10], scenesAt(0, 5))).toBe("Focus is highest at 0:01 and lowest at 0:02.");
  });

  it("highest at the clip's last second: the lowest is read over the whole clip", () => {
    expect(focusSentence([30, 20, 25, 60], scenesAt(0, 2))).toBe("Focus is highest at 0:03 and lowest at 0:01.");
  });

  it("reads the recorded runs", () => {
    const read = (fixture: unknown) => {
      const model = modelOf(fixture);
      return focusSentence(focusOf(model), model.audience.scenes);
    };
    expect(read(early)).toBe("Focus is highest at 0:07 and lowest at 0:23.");
    expect(read(middle)).toBe("Focus is highest at 0:10 and falls when the scene changes at 0:17.");
    expect(read(opening)).toBe("Focus is highest at 0:09 and lowest at 0:20.");
    expect(read(leak)).toBe("Focus is highest at 0:08 and lowest at 0:25.");
    expect(read(holds)).toBe("Focus is highest at 0:09 and lowest at 0:16.");
    expect(read(ending)).toBe("Focus is highest at 0:09 and lowest at 0:29.");
  });
});
```

`src/lib/result/__tests__/run-progress.test.ts`, change the first test and add three after
"marks the run done…" (inside `describe("applyRunEvent")`):

```ts
  it("starts knowing nothing", () => {
    expect(NO_PROGRESS).toEqual({ groups: null, frames: [], cover: null, done: false });
  });
```

```ts
  it("learns the post's cover from the source event; the first one stands", () => {
    const once = applyRunEvent(NO_PROGRESS, {
      type: "source",
      data: { cover_url: "https://p.test/cover.jpg", handle: "nia.tests", views: 1200, video_url: null },
    });
    expect(once.cover).toBe("https://p.test/cover.jpg");
    expect(applyRunEvent(once, { type: "source", data: { cover_url: "https://p.test/other.jpg" } })).toBe(once);
  });

  it("takes only an https cover, and ignores a source without one", () => {
    for (const cover_url of ["http://p.test/c.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "blob:x", "/c.jpg", "", null, 7]) {
      expect(applyRunEvent(NO_PROGRESS, { type: "source", data: { cover_url, handle: "nia.tests" } })).toBe(NO_PROGRESS);
    }
    expect(applyRunEvent(NO_PROGRESS, { type: "source", data: null })).toBe(NO_PROGRESS);
  });

  it("a cover changes nothing else it knows", () => {
    const withGroups = applyRunEvent(NO_PROGRESS, roster(10));
    const next = applyRunEvent(withGroups, { type: "source", data: { cover_url: "https://p.test/cover.jpg" } });
    expect(next.groups).toBe(withGroups.groups);
    expect(next.frames).toBe(withGroups.frames);
    expect(next.done).toBe(false);
  });
```

`src/components/result/__tests__/use-run-stream.test.tsx`, add after "learns the groups and the frames…":

```ts
  it("learns the post's cover from the source event", () => {
    const { result } = renderHook(() => useRunStream("run-1", () => {}));

    act(() => stream().send("source", { cover_url: "https://p.test/cover.jpg", handle: "nia.tests", views: 1200, video_url: null }));

    expect(result.current.cover).toBe("https://p.test/cover.jpg");
  });
```

#### Step 2: run, expect failures

```
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/result/__tests__/count.test.ts src/lib/result/__tests__/most-likely.test.ts src/lib/result/__tests__/brain-read.test.ts src/lib/result/__tests__/run-progress.test.ts src/components/result/__tests__/use-run-stream.test.tsx --testTimeout 30000
```

Expected: the three new files fail to import (`Cannot find module '../count'`, `'../most-likely'`,
`'../brain-read'`); in `run-progress.test.ts` "starts knowing nothing" and the three cover tests fail
(`cover` undefined); in `use-run-stream.test.tsx` the new test fails (`expected undefined to be
'https://p.test/cover.jpg'`).

#### Step 3: the implementation

`src/lib/result/count.ts`:

```ts
import { watchingAt } from "./curve";
import type { Audience } from "./types";

/**
 * The count under the video and on the Engagement page: the simulated audience counted as 1,000
 * viewers. A count is a stored share (0 to 100) times ten, rounded, and nothing else is counted. It is
 * never read off the headline's rounded percent: a whole percent times ten sits up to five viewers
 * away from the line it stands for.
 */

/** How many viewers a share of 100 is. */
export const VIEWERS = 1000;
/** The opening Engagement's first row is read at ("Past the first 3 seconds"). */
export const OPENING_S = 3;
/** The words beside a count. */
export const COUNT_WORDS = { end: "watched to the end", now: "still watching" } as const;
export type CountWords = (typeof COUNT_WORDS)[keyof typeof COUNT_WORDS];

export interface Count {
  n: number;
  words: CountWords;
}

/** Before the words of every count. */
export const OF_VIEWERS = "of 1,000";

/** A share (0 to 100) as a count of 1,000. */
export function toCount(pct: number): number {
  return Math.round(pct * 10);
}

/** A count as shown: `1,000`, `461`. */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** The count at the clip's end: the share stored at the end of the last scene. */
export function endCount(audience: Audience): number {
  return toCount(audience.points[audience.points.length - 1]![1]);
}

/**
 * The count at a moment. At rest, the clip's end ("watched to the end"); at any other moment (playing,
 * or stopped somewhere) the line's value there ("still watching").
 */
export function countAt(audience: Audience, t: number, resting: boolean): Count {
  if (resting) return { n: endCount(audience), words: COUNT_WORDS.end };
  return { n: toCount(watchingAt(audience.points, t)), words: COUNT_WORDS.now };
}

/** Still watching after the opening: the count at 0:03, or at the clip's end for a shorter clip. */
export function pastOpening(audience: Audience): number {
  return toCount(watchingAt(audience.points, Math.min(OPENING_S, audience.clipS)));
}

/** How long the count rolls when a result lands. */
export const ROLL_MS = 1500;

/** The number a roll shows `elapsedMs` in: from `from` to `to`, ease-out (cubic), whole numbers. */
export function rolledAt(from: number, to: number, elapsedMs: number): number {
  const k = Math.min(1, Math.max(0, elapsedMs / ROLL_MS));
  return Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
}
```

`src/lib/result/most-likely.ts`:

```ts
import type { Intent } from "./types";

/**
 * The action viewers are most likely to take: the one intent with the highest value. None on a tie
 * for the highest (every value zero included) and none without intents: the page names an action
 * only when one stands out.
 */
export function mostLikely(intents: readonly Intent[] | null): Intent["id"] | null {
  if (!intents || intents.length === 0) return null;
  const top = Math.max(...intents.map((intent) => intent.value));
  const highest = intents.filter((intent) => intent.value === top);
  return highest.length === 1 ? highest[0]!.id : null;
}
```

`src/lib/result/brain-read.ts`:

```ts
import type { NetworkId } from "@/lib/brain/cortex-sim";
import { timecode } from "./format";
import type { Scene } from "./types";

/**
 * The Brain page in words (spec 4.3): what each signal stands for, where it stands against its
 * resting level, and one sentence about Focus. Read off the model's own levels (`brain-track.ts`,
 * 0 to 100) and the run's scenes; nothing here is measured.
 */

/** Points within which a level counts as at rest, and the spread under which Focus stays level. */
export const LEVEL_STEP = 3;

export type RestWord = "above rest" | "at rest" | "below rest";

/** A level against its resting level: more than 3 points over, more than 3 under, else at rest. */
export function restWord(level: number, rest: number): RestWord {
  if (level - rest > LEVEL_STEP) return "above rest";
  if (rest - level > LEVEL_STEP) return "below rest";
  return "at rest";
}

/** What each of the four signals stands for, under its name. */
export const SIGNAL_MEANING: Partial<Record<NetworkId, string>> = {
  visual: "what there is to look at",
  dorsal_attention: "how closely they follow",
  limbic: "how much it moves them",
  default: "how far the mind drifts",
};

/** The small line over the rows: the moment they are read at (the clip's end at rest). */
export function momentLine(t: number): string {
  return `At ${timecode(t)} · the dashed line is at rest`;
}

export const FOCUS_LEVEL = "Focus stays level through the video.";

/**
 * One sentence from the Focus signal (`perSecond[s]`: its level at second s).
 * - Highest minus lowest under 3 points: it stays level.
 * - Else where it is highest (the first such second), then where it falls with a scene change when
 *   the largest fall from one second to the next, from the highest second on (the earliest on a
 *   tie), is 3 points or more and lands within a second of the start of a scene that is not the
 *   first (the nearest such start, the earlier on a tie); otherwise where it is lowest from the
 *   highest second on (the first such second). The model starts every clip at its resting level, so
 *   the whole clip's lowest is nearly always 0:00 and would say nothing; only when the highest
 *   second is the clip's last is the lowest read over the whole clip.
 */
export function focusSentence(perSecond: readonly number[], scenes: readonly Scene[]): string {
  if (perSecond.length === 0) return FOCUS_LEVEL;
  const high = Math.max(...perSecond);
  const low = Math.min(...perSecond);
  if (high - low < LEVEL_STEP) return FOCUS_LEVEL;
  const peak = perSecond.indexOf(high);
  const head = `Focus is highest at ${timecode(peak)}`;

  let fall = 0;
  let landsOn = -1;
  for (let s = peak; s < perSecond.length - 1; s++) {
    const drop = perSecond[s]! - perSecond[s + 1]!;
    if (drop > fall) {
      fall = drop;
      landsOn = s + 1;
    }
  }
  if (fall >= LEVEL_STEP) {
    let change: number | null = null;
    // Scenes are in time order: only a strictly nearer start replaces one, so a tie keeps the earlier.
    for (const scene of scenes.slice(1)) {
      const apart = Math.abs(landsOn - scene.t0);
      if (apart <= 1 && (change === null || apart < Math.abs(landsOn - change))) change = scene.t0;
    }
    if (change !== null) return `${head} and falls when the scene changes at ${timecode(change)}.`;
  }
  const from = peak === perSecond.length - 1 ? 0 : peak;
  const after = perSecond.slice(from);
  return `${head} and lowest at ${timecode(from + after.indexOf(Math.min(...after)))}.`;
}
```

`src/lib/result/run-progress.ts`, four edits:

1. In the header comment, replace "That stream sends the viewer groups once (`roster`, about 4 seconds
   in), each scene frame where" with "That stream sends the viewer groups once (`roster`, about 4
   seconds in), the post's cover once a link's scrape has landed (`source`), each scene frame where".
2. `RunProgress` and `NO_PROGRESS` as in the contracts (add the `cover` field with its comment between
   `frames` and `done`; `NO_PROGRESS = { groups: null, frames: [], cover: null, done: false }`).
3. `RunEvent` as in the contracts (add `| { type: "source"; data: unknown }` after `roster`).
4. Rename `isFrameAddress` to `isPictureAddress` (its comment: "A frame or a cover is a stored or
   posted picture's https address; anything else is not shown."), use the new name in the
   `filmstrip_segment_ready` branch, and add this branch after `roster`:

```ts
    case "source": {
      // Sent once, but replayed on every reconnect: the first cover stands.
      if (state.cover) return state;
      const cover = isRecord(event.data) ? event.data.cover_url : null;
      return isPictureAddress(cover) ? { ...state, cover } : state;
    }
```

`src/components/result/use-run-stream.ts`: `const EVENTS = ["roster", "source", "filmstrip_segment_ready", "complete"] as const;`
and in its doc comment replace "the viewer groups, the frames as they arrive, and the finish." with
"the viewer groups, the post's cover (a link run), the frames as they arrive, and the finish."

`src/app/(app)/dev/result/dev-result.tsx`, in `runningPreview`: the `progress` literal gains
`cover: null,` before `done: false,`. `src/components/result/__tests__/running.test.tsx` lines 458 and
479: each `progress` literal gains `cover: null,` before `done: false`.

#### Step 4: run, expect a pass

The Step 2 command plus `src/components/result/__tests__/running.test.tsx`; then `pnpm exec tsc
--noEmit`; then `pnpm exec eslint src/lib/result/count.ts src/lib/result/most-likely.ts
src/lib/result/brain-read.ts src/lib/result/run-progress.ts src/components/result/use-run-stream.ts
"src/app/(app)/dev/result/dev-result.tsx" src/lib/result/__tests__/count.test.ts
src/lib/result/__tests__/most-likely.test.ts src/lib/result/__tests__/brain-read.test.ts
src/lib/result/__tests__/run-progress.test.ts src/components/result/__tests__/use-run-stream.test.tsx
src/components/result/__tests__/running.test.tsx`. All green. **Report:** `task-1-report.md`.

---

### Task 2: the shared layout parts, the hero on a phone and a wide window, the count, the pinned player, the loading frame

**Files.** Create `src/components/result/first-block.tsx`, `src/components/result/viewer-count.tsx`,
`src/components/result/__tests__/first-block.test.tsx`, `src/components/result/__tests__/viewer-count.test.tsx`.
Rewrite `src/components/result/hero.tsx`, `src/components/result/compact-player.tsx`,
`src/components/result/__tests__/hero.test.tsx`. Modify `src/components/result/video-result.tsx`,
`curve.tsx`, `scene-strip.tsx`, `player.tsx`, `result-page.tsx` (one import),
`__tests__/player.test.tsx`, `__tests__/result-page.test.tsx`, `__tests__/after-posting-mount.test.tsx`,
`__tests__/simulation-screen.test.tsx`. **Must not touch** `gauge.tsx` and its test (the gauge keeps
its other users: `text-result.tsx`, `thread-next/video-answer.tsx`), `moment.tsx`, `playhead.tsx`,
`audience-*`, `panel-switch.tsx`, the Engagement and Brain panels, `running.tsx`, `curve.test.tsx`
(it must stay green unchanged: it proves the line kept every behaviour through `LineFrame`).

**Consumes:** Task 1's `count.ts`. **Produces:** everything in the contracts under `first-block.tsx`,
`player.tsx` and `ViewerCount`; `ResultFrame` now lives in `first-block.tsx`.

#### Step 1: the failing tests

`src/components/result/__tests__/first-block.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * The result's first block as layout parts: the result and the running screen draw through them, so
 * their boxes are written once. Real parts; nothing is stood in for.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  FirstCard,
  LineFrame,
  PHONE_LINE_FALLBACK,
  PLOT_PX,
  ResultFrame,
  STRIP_GAP_PX,
  WIDE_LINE_FALLBACK,
  WideFrame,
  stripHeight,
} from "../first-block";

const part = (root: ParentNode, name: string) => root.querySelector<HTMLElement>(`[data-part="${name}"]`)!;

describe("FirstCard", () => {
  it("top to bottom: the tile in its box, the line under the tile, the hairline over the line", () => {
    const { container } = render(
      <FirstCard name="hero" tile={<i data-testid="tile" />} under={<i data-testid="under" />} line={<i data-testid="line" />} />,
    );
    const card = container.querySelector<HTMLElement>('[data-result="hero"]')!;
    const [tileBox, under, lineBox] = [part(card, "tile-box"), part(card, "under"), part(card, "line-box")];
    expect([...card.children]).toEqual([tileBox, under, lineBox]);
    // 20 over the tile, 14 at the sides, 12 under the times.
    expect(card.className).toMatch(/\bpt-5\b/);
    expect(card.className).toMatch(/\bpx-3\.5\b/);
    expect(card.className).toMatch(/\bpb-3\b/);
    // Centred, 53% of the card's inside, never under 140 or over 200 (176 on a 393 phone).
    expect(tileBox.className).toMatch(/\bmx-auto\b/);
    expect(tileBox.className).toContain("w-[clamp(140px,53%,200px)]");
    expect(tileBox.querySelector('[data-testid="tile"]')).not.toBeNull();
    // 16 under it, at least one line of the count, centred.
    expect(under.className).toMatch(/\bmt-4\b/);
    expect(under.className).toContain("min-h-[34px]");
    expect(under.className).toMatch(/\bjustify-center\b/);
    expect(under.querySelector('[data-testid="under"]')).not.toBeNull();
    // 14 under that the hairline, 30 over the plot.
    expect(lineBox.className).toMatch(/\bmt-3\.5\b/);
    expect(lineBox.className).toMatch(/\bborder-t\b/);
    expect(lineBox.className).toContain("pt-[30px]");
    expect(lineBox.querySelector('[data-testid="line"]')).not.toBeNull();
  });

  it("carries no name when none is given (the loading frame)", () => {
    const { container } = render(<FirstCard tile={null} under={null} line={null} />);
    expect(container.querySelector("[data-result]")).toBeNull();
  });
});

describe("LineFrame", () => {
  it("the plot at its height, the strip 8 under it, the two times under them", () => {
    const { container } = render(
      <LineFrame width={333} height={PLOT_PX.phone} plotName="curve" strip={<i data-testid="strip" />} times={["0:00", "0:29"]} />,
    );
    expect(part(container, "line-frame").style.width).toBe("333px");
    const plot = part(container, "plot");
    expect(plot.style.height).toBe("100px");
    expect(plot.getAttribute("data-result")).toBe("curve");
    const slot = part(container, "strip-slot");
    expect(slot.className).toMatch(/\bmt-2\b/);
    expect(slot.querySelector('[data-testid="strip"]')).not.toBeNull();
    const times = part(container, "times");
    expect([...times.children].map((el) => el.textContent)).toEqual(["0:00", "0:29"]);
    expect(times.className).toContain("h-[21px]");
    expect(times.className).toMatch(/\bmt-0\.5\b/);
  });

  it("no times: the row keeps its height and shows nothing; no strip: no slot, and the times 4 under the plot", () => {
    const { container } = render(<LineFrame width={333} height={PLOT_PX.phone} strip={null} times={null} />);
    const times = part(container, "times");
    expect(times.textContent).toBe("");
    expect(times.className).toContain("h-[21px]");
    expect(times.className).toMatch(/\bmt-1\b/);
    expect(container.querySelector('[data-part="strip-slot"]')).toBeNull();
    expect(part(container, "plot").hasAttribute("data-result")).toBe(false);
  });

  it("the box around the plot and the strip takes the caller's props (the result's slider)", () => {
    const { container } = render(
      <LineFrame
        width={333}
        height={PLOT_PX.phone}
        box={{ role: "slider", "aria-label": "Still watching", className: "cursor-ew-resize" }}
        strip={<i />}
        stripClassName="x-strip"
        times={null}
      />,
    );
    const box = container.querySelector<HTMLElement>('[role="slider"]')!;
    expect(box.getAttribute("aria-label")).toBe("Still watching");
    expect(box.className).toMatch(/\brelative\b/);
    expect(box.className).toMatch(/\brounded-md\b/);
    expect(box.className).toMatch(/\bcursor-ew-resize\b/);
    expect(box.contains(part(container, "plot"))).toBe(true);
    expect(box.contains(part(container, "strip-slot"))).toBe(true);
    expect(box.contains(part(container, "times"))).toBe(false);
    expect(part(container, "strip-slot").className).toMatch(/\bx-strip\b/);
  });

  it("without a width the frame is as wide as its box (the loading frame)", () => {
    const { container } = render(<LineFrame height={PLOT_PX.wide} strip={null} times={null} />);
    expect(part(container, "line-frame").getAttribute("style")).toBeNull();
    expect(part(container, "plot").style.height).toBe("104px");
  });

  it("the sizes of the line", () => {
    expect(PLOT_PX).toEqual({ phone: 100, wide: 104 });
    expect(STRIP_GAP_PX).toBe(3);
    expect(stripHeight(333)).toBe(38);
    expect(stripHeight(400)).toBe(38);
    expect(stripHeight(401)).toBe(46);
    expect(PHONE_LINE_FALLBACK).toBe(333);
    expect(WIDE_LINE_FALLBACK).toBe(540);
  });
});

describe("WideFrame", () => {
  it("left the tile and 18 under it its line; right the sentence's card, After posting, the line's card, the rest", () => {
    const { container } = render(
      <WideFrame
        tile={<i data-testid="tile" />}
        under={<i data-testid="under" />}
        first={<i data-testid="first" />}
        after={<i data-testid="after" />}
        line={<i data-testid="line" />}
        rest={
          <>
            <i data-testid="tabs" />
            <i data-testid="panel" />
          </>
        }
      />,
    );
    const column = part(container, "tile-column");
    expect(column.firstElementChild).toBe(container.querySelector('[data-testid="tile"]'));
    const under = part(column, "under");
    expect(under.className).toContain("mt-[18px]");
    expect(under.className).toContain("min-h-[34px]");
    const grid = column.parentElement!;
    expect(grid.className).toContain("max-w-[980px]");
    expect(grid.className).toContain("grid-cols-[minmax(0,372fr)_minmax(0,588fr)]");
    expect(grid.className).toMatch(/\bgap-5\b/);
    const right = grid.children[1]!;
    const sentence = container.querySelector<HTMLElement>('[data-result="sentence-card"]')!;
    const after = part(container, "after");
    const lineCard = part(container, "line-card");
    expect([...right.children].slice(0, 3)).toEqual([sentence, after, lineCard]);
    expect(sentence.querySelector('[data-testid="first"]')).not.toBeNull();
    expect(sentence.className).toContain("min-h-[158px]");
    expect(sentence.className).toContain("p-[22px]");
    expect(after.className).toContain("empty:hidden");
    expect(after.querySelector('[data-testid="after"]')).not.toBeNull();
    expect(lineCard.className).toMatch(/\bpx-6\b/);
    expect(lineCard.className).toMatch(/\bpt-8\b/);
    expect(lineCard.className).toMatch(/\bpb-3\.5\b/);
    expect(lineCard.querySelector('[data-testid="line"]')).not.toBeNull();
    const rest = right.children[3]!;
    expect(rest.className).toMatch(/\bgap-4\b/);
    expect([...rest.children].map((el) => el.getAttribute("data-testid"))).toEqual(["tabs", "panel"]);
  });

  it("waiting: the sentence's card empty at its resting height, no After posting, no rest", () => {
    const { container } = render(<WideFrame name="running" tile={<i />} under={null} first={null} line={<i />} />);
    const root = container.querySelector('[data-result="running"]')!;
    const sentence = root.querySelector('[data-result="sentence-card"]')!;
    expect(sentence.children).toHaveLength(0);
    expect(root.querySelector('[data-part="after"]')).toBeNull();
    expect(part(root, "line-card").parentElement!.lastElementChild).toBe(part(root, "line-card"));
  });

  it("the classes it is given go on the sentence, After posting and the rest", () => {
    const { container } = render(
      <WideFrame
        tile={null}
        under={null}
        first={<i />}
        firstClassName="x-first"
        after={<i />}
        afterClassName="x-after"
        line={null}
        rest={<i />}
        restClassName="x-rest"
      />,
    );
    expect(container.querySelector('[data-result="sentence-card"]')!.firstElementChild!.className).toMatch(/\bx-first\b/);
    expect(part(container, "after").className).toMatch(/\bx-after\b/);
    expect(part(container, "line-card").nextElementSibling!.className).toMatch(/\bx-rest\b/);
    expect(part(container, "line-card").className).not.toMatch(/x-/);
  });
});

describe("ResultFrame", () => {
  it("the first block's own boxes, empty, and no text", () => {
    const { container } = render(<ResultFrame />);
    const frame = container.querySelector<HTMLElement>('[aria-busy="true"]')!;
    expect(frame.textContent).toBe("");
    const [phone, wide] = [...frame.children];
    expect(phone!.className).toMatch(/\bmd:hidden\b/);
    expect(part(phone!, "tile-box").firstElementChild!.className).toMatch(/aspect-\[9\/16\]/);
    expect(part(phone!, "plot").style.height).toBe("100px");
    expect(part(phone!, "strip-slot").firstElementChild!.getAttribute("style")).toContain("height: 38px");
    expect(part(phone!, "times").textContent).toBe("");
    expect(part(wide!, "plot").style.height).toBe("104px");
    expect(part(wide!, "strip-slot").firstElementChild!.getAttribute("style")).toContain("height: 46px");
    expect(wide!.querySelector('[data-result="sentence-card"]')!.className).toContain("min-h-[158px]");
  });
});
```

`src/components/result/__tests__/viewer-count.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * The count under the video (spec 3.1): how many of 1,000 viewers, from the stored shares, at the
 * playhead. Real component, real playhead, recorded runs.
 */
import { describe, expect, it } from "vitest";
import { act } from "@testing-library/react";
import early from "@/lib/result/__tests__/fixtures/early.json";
import ending from "@/lib/result/__tests__/fixtures/ending.json";
import { watchingAt } from "@/lib/result/curve";
import { ViewerCount } from "../viewer-count";
import { modelOf, playhead, renderWithPlayhead } from "./hero-harness";

const count = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-result="count"]')!;
const part = (c: HTMLElement, name: string) => c.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
const mount = (fixture: unknown) => {
  const model = modelOf(fixture);
  return { model, ...renderWithPlayhead(model, <ViewerCount audience={model.audience} />) };
};

describe("ViewerCount", () => {
  it("at rest: the count at the clip's end, watched to the end", () => {
    const { container } = mount(early);
    expect(count(container)).toHaveTextContent("461 of 1,000 watched to the end");
    expect(part(container, "count-number").textContent).toBe("461");
    expect(part(container, "count-words").textContent).toBe("of 1,000 watched to the end");
  });

  it("away from rest: the line's value at the playhead, still watching; back at rest, the end again", () => {
    const { container } = mount(early);
    act(() => playhead.current.seek(0));
    expect(count(container)).toHaveTextContent("1,000 of 1,000 still watching");
    act(() => playhead.current.seek(2.5));
    expect(count(container)).toHaveTextContent("854 of 1,000 still watching");
    act(() => playhead.current.seek(7));
    expect(count(container)).toHaveTextContent("562 of 1,000 still watching");
    act(() => playhead.current.seek(29));
    expect(count(container)).toHaveTextContent("461 of 1,000 watched to the end");
  });

  it("is always the line at the playhead", () => {
    const { container, model } = mount(early);
    for (const t of [0.5, 2.2, 3, 5.5, 13, 21, 28]) {
      act(() => playhead.current.seek(t));
      const n = Math.round(watchingAt(model.audience.points, t) * 10);
      expect(part(container, "count-number").textContent).toBe(n.toLocaleString("en-US"));
    }
  });

  it("ending: 0 watched to the end", () => {
    const { container } = mount(ending);
    expect(count(container)).toHaveTextContent("0 of 1,000 watched to the end");
  });

  it("is plain text for a screen reader: no live region, no role, nothing hidden", () => {
    const { container } = mount(early);
    const el = count(container);
    expect(el.tagName).toBe("P");
    expect(el.getAttribute("aria-live")).toBeNull();
    expect(el.getAttribute("role")).toBeNull();
    expect(el.querySelector("[aria-hidden]")).toBeNull();
  });

  it("the number in the average watch's figure role, the words in the text role, one baseline, centred, wrapping only when needed", () => {
    const { container } = mount(early);
    expect(count(container).className).toMatch(/\bflex\b/);
    expect(count(container).className).toMatch(/\bflex-wrap\b/);
    expect(count(container).className).toMatch(/\bitems-baseline\b/);
    expect(count(container).className).toMatch(/\bjustify-center\b/);
    expect(part(container, "count-number").className).toBe(
      "text-3xl font-bold leading-[25px] tracking-[-0.04em] text-foreground tabular-nums",
    );
    expect(part(container, "count-words").className).toBe("text-ui text-foreground-secondary");
  });
});
```

`src/components/result/__tests__/hero.test.tsx`, replaced whole:

```tsx
/** @vitest-environment happy-dom */
/**
 * The phone's first card and the pinned compact player (spec 3.1): the video in focus, the count under
 * it, the line with the strip and its times. Real components and playhead on recorded runs.
 */
import { describe, expect, it } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import early from "@/lib/result/__tests__/fixtures/early.json";
import holds from "@/lib/result/__tests__/fixtures/holds.json";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import { CompactPlayer } from "../compact-player";
import { Hero } from "../hero";
import { modelOf, playhead, renderWithPlayhead } from "./hero-harness";

const named = (container: HTMLElement, name: string) => container.querySelectorAll(`[data-result="${name}"]`);
const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("Hero", () => {
  it("early: the video in focus, the count under it, the line with the strip, in one card; no gauge", () => {
    const model = modelOf(early, { frames: true });
    const { container } = renderWithPlayhead(model, <Hero model={model} />);
    const hero = named(container, "hero")[0]!;
    const [video, count, curve, strip] = ["video", "count", "curve", "strip"].map(
      (name) => hero.querySelector<HTMLElement>(`[data-result="${name}"]`)!,
    );
    expect([video, count, curve, strip].every(Boolean)).toBe(true);
    expect(follows(video, count)).toBe(true);
    expect(follows(count, curve)).toBe(true);
    // The video fills the first card's tile box.
    expect(video.parentElement!.getAttribute("data-part")).toBe("tile-box");
    expect(count).toHaveTextContent("461 of 1,000 watched to the end");
    expect(container.querySelector('[data-result="gauge"]')).toBeNull();
    expect(screen.queryByRole("img", { name: /watch to the end/ })).toBeNull();
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(curve.style.height).toBe("100px");
  });

  it("holds: 843, nothing coral, no strip without frames", () => {
    const model = modelOf(holds);
    const { container } = renderWithPlayhead(model, <Hero model={model} />);
    expect(named(container, "count")[0]).toHaveTextContent("843 of 1,000 watched to the end");
    expect(container.innerHTML).not.toMatch(/--color-below/);
    expect(named(container, "strip")).toHaveLength(0);
  });

  it("middle (frames gone): the quiet tile, the count, the line with its coral scene", () => {
    const model = modelOf(middle);
    const { container } = renderWithPlayhead(model, <Hero model={model} />);
    expect(named(container, "video")[0]).toHaveTextContent("0:29");
    expect(named(container, "count")[0]).toHaveTextContent("461 of 1,000 watched to the end");
    expect(container.querySelector('[data-part="loss"]')).not.toBeNull();
  });

  it("the count follows the video as the line does", () => {
    const model = modelOf(early);
    const { container } = renderWithPlayhead(model, <Hero model={model} />);
    act(() => playhead.current.seek(2.5));
    expect(named(container, "count")[0]).toHaveTextContent("854 of 1,000 still watching");
    expect(container.querySelector('[data-part="readout"]')!.textContent).toBe("71% · 0:03");
    act(() => playhead.current.seek(29));
    expect(named(container, "count")[0]).toHaveTextContent("461 of 1,000 watched to the end");
  });
});

describe("CompactPlayer", () => {
  it("a small frame, the line (50 tall, no strip) and the count's number at its end", () => {
    const model = modelOf(early, { frames: true });
    const { container } = renderWithPlayhead(model, <CompactPlayer model={model} />);
    const compact = named(container, "compact")[0]!;
    expect(compact.querySelector('[data-result="video"]')!.className).toMatch(/w-\[62px\]/);
    expect(compact.querySelector<HTMLElement>('[data-result="curve"]')!.style.height).toBe("50px");
    expect(named(container, "strip")).toHaveLength(0);
    expect(compact.querySelector('[data-part="end"]')!.textContent).toBe("461");
  });

  it("its number is the count under the video at that moment, alone", () => {
    const model = modelOf(early);
    const { container } = renderWithPlayhead(
      model,
      <>
        <Hero model={model} />
        <CompactPlayer model={model} />
      </>,
    );
    const end = () => container.querySelector('[data-part="end"]')!.textContent;
    const shown = () => named(container, "hero")[0]!.querySelector('[data-part="count-number"]')!.textContent;
    expect(end()).toBe(shown());
    for (const t of [0, 2.5, 7, 20]) {
      act(() => playhead.current.seek(t));
      expect(end()).toBe(shown());
    }
    expect(end()).toBe("461");
    expect(end()).not.toMatch(/%|of|watch/);
  });

  it("its line is a copy of the hero's: not a slider, not a tab stop, hidden from assistive tech; dragging still seeks", () => {
    const model = modelOf(early);
    const { container } = renderWithPlayhead(
      model,
      <>
        <Hero model={model} />
        <CompactPlayer model={model} />
      </>,
    );
    expect(screen.getAllByRole("slider")).toHaveLength(1);
    const compact = named(container, "compact")[0]!;
    expect(compact.querySelector('[role="slider"]')).toBeNull();
    expect(compact.querySelector("[tabindex]")).toBeNull();
    const line = compact.querySelector<HTMLElement>('[data-result="curve"]')!.parentElement!;
    expect(line.getAttribute("aria-hidden")).toBe("true");
    fireEvent.pointerDown(line, { pointerId: 1, pointerType: "mouse", button: 0, clientX: (7 / 29) * 263 });
    expect(playhead.current.t).toBeCloseTo(7, 1);
  });

  it("follows the playhead like the hero's line", () => {
    const model = modelOf(early);
    const { container } = renderWithPlayhead(model, <CompactPlayer model={model} />);
    expect(container.querySelector('[data-part="readout"]')).toBeNull();
    act(() => playhead.current.seek(2.5));
    expect(container.querySelector('[data-part="readout"]')!.textContent).toBe("71% · 0:03");
  });
});
```

`src/components/result/__tests__/player.test.tsx`, the sizes test becomes:

```tsx
  it("sizes: the hero and the desktop tile fill their box (the first block's layout sets it), 62 in the compact player", () => {
    const model = modelOf(middle);
    const { container } = renderWithPlayhead(
      model,
      <>
        <Player model={model} size="hero" />
        <Player model={model} size="desktop" />
        <Player model={model} size="compact" />
      </>,
    );
    const [hero, desk, compact] = [...container.querySelectorAll<HTMLElement>('[data-result="video"]')];
    expect(hero!.className).toMatch(/\bw-full\b/);
    expect(hero!.className).not.toMatch(/w-\[104px\]/);
    expect(hero!.className).toMatch(/aspect-\[9\/16\]/);
    expect(desk!.className).toMatch(/\bw-full\b/);
    expect(compact!.className).toMatch(/w-\[62px\]/);
  });
```

`src/components/result/__tests__/result-page.test.tsx`, four edits:

1. In "the result fades in when the run finishes while the page is open" and in "a result opened
   directly does not fade in", replace `expect(container.querySelector('[data-result="gauge"]')).not.toBeNull();`
   with `expect(container.querySelector('[data-result="count"]')).not.toBeNull();` (both tests are
   rewritten in Task 6; until then they keep pinning the body's fade).
2. Replace the test "desktop: the video, the gauge beside the moment, the line as its own card, the
   switch and a panel" with:

```tsx
  it("desktop: the video with the count under it, the sentence's card alone, the line as its own card, the switch and a panel; no gauge", () => {
    const { container } = renderPage(stateOf(early));
    for (const name of ["video", "count", "sentence-card", "moment", "curve", "tabs", "panel"]) {
      expect(container.querySelector(`[data-result="${name}"]`), name).not.toBeNull();
    }
    expect(container.querySelector('[data-result="hero"]')).toBeNull();
    expect(container.querySelector('[data-result="gauge"]')).toBeNull();
    // The count stands under the video, in the left column.
    const column = container.querySelector('[data-result="video"]')!.parentElement!;
    expect(column.getAttribute("data-part")).toBe("tile-column");
    expect(column.querySelector('[data-result="count"]')).toHaveTextContent("461 of 1,000 watched to the end");
    // The sentence has the first card to itself.
    const card = container.querySelector('[data-result="sentence-card"]')!;
    expect([...card.querySelectorAll("[data-result]")].map((el) => el.getAttribute("data-result"))).toEqual(["moment"]);
  });
```

3. Replace the test "phone: the hero card, the moment, the switch and a panel" with:

```tsx
  it("phone: the first card with the video and the count, the moment, the switch and a panel; no gauge", async () => {
    setWidth(393);
    const { container } = renderPage(stateOf(early));
    await waitFor(() => expect(container.querySelector('[data-result="hero"]')).not.toBeNull());
    for (const name of ["moment", "tabs", "panel"]) {
      expect(container.querySelector(`[data-result="${name}"]`), name).not.toBeNull();
    }
    const hero = container.querySelector('[data-result="hero"]')!;
    expect(hero.querySelector('[data-result="video"]')).not.toBeNull();
    expect(hero.querySelector('[data-result="count"]')).toHaveTextContent("461 of 1,000 watched to the end");
    expect(container.querySelector('[data-result="gauge"]')).toBeNull();
  });
```

`src/components/result/__tests__/after-posting-mount.test.tsx`, replace the test "desk: in the right
column, directly under the gauge's card" with:

```tsx
  it("desk: in the right column, directly under the sentence's card", async () => {
    setWidth(1440);
    answers.posted = posted({ said: { number: 46, measure: "end" }, pieceKey: "fixture-early" });
    renderVideo();
    await waitFor(() => expect(afterCard()).not.toBeNull());
    const sentenceCard = document.querySelector('[data-result="sentence-card"]')!;
    expect(sentenceCard.querySelector('[data-result="moment"]')).not.toBeNull();
    expect(sentenceCard.nextElementSibling).toBe(afterCard()!.parentElement);
    expect(afterCard()!.textContent).toContain("46%watch to the end");
  });
```

`src/components/result/__tests__/simulation-screen.test.tsx`: both
`await waitFor(() => expect(screen.getByRole("img", { name: /^46% watch to the end/ })).toBeInTheDocument());`
lines become
`await waitFor(() => expect(container.querySelector('[data-result="count"]')).toHaveTextContent("461 of 1,000 watched to the end"));`
(in the second describe, take `container` from `const { container } = renderScreen();`, which it already
does). If `screen` is then unused, the import keeps it: the file uses it elsewhere.

#### Step 2: run, expect failures

```
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/result src/lib/result --testTimeout 30000
```

Expected: `first-block.test.tsx` and `viewer-count.test.tsx` fail to import their modules; `hero.test.tsx`
fails (no count, a gauge); `player.test.tsx` "sizes" fails (`w-[104px]`); the result-page,
after-posting and simulation-screen tests above fail (no `count`, no `sentence-card`, a gauge). Every
other test passes (`curve.test.tsx` included).

#### Step 3: the implementation

`src/components/result/first-block.tsx`:

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RADIUS, TILE } from "./player";

/**
 * The result's first block as layout parts with slots. The result and the screen shown while it
 * simulates are both drawn through them, so the wait cannot stand anywhere the result does not and the
 * result takes its place without a jump. Every size of that block is written here, once.
 *
 * Phone (`FirstCard`): one card. The 9:16 tile centred; 16 under it the line under the tile (the count,
 * or the wait's words); 14 under that a hairline and 30 over the plot; the plot, the strip and the two
 * times (`LineFrame`).
 *
 * Wide window (`WideFrame`, the mock's `simD` and `.desk` rules): a 980 grid centred in the content
 * area, 32 under the header row. Left the tile (372) and 18 under it its line; 20 to its right a 588
 * column with 16 between its parts: the sentence's card, "After posting", the line's card, the rest
 * (the switch and the panel).
 */

/** The plot's height: 100 in the phone's card, 104 in the wide window's line card. */
export const PLOT_PX = { phone: 100, wide: 104 } as const;
/** Between two tiles of the strip. */
export const STRIP_GAP_PX = 3;
/** The strip's height: 38, and 46 on a line wider than 400 (a wide window). */
export const stripHeight = (width: number): number => (width > 400 ? 46 : 38);
/** A strip tile's surface: the result's scenes and the wait's empty tiles. */
export const STRIP_TILE = "rounded-lg bg-surface-sunken shadow-[0_0_0_1px_var(--color-border)]";
/** The phone's line before its card is measured: a 393 phone (the card's inside, 361 less 2 × 14). */
export const PHONE_LINE_FALLBACK = 333;
/** The wide window's line before its card is measured (588 less 2 × 24). */
export const WIDE_LINE_FALLBACK = 540;
/**
 * The phone's column: 16 at the sides; the first card 9 into <main> (main reserves the header's band,
 * 46, and the 40 header sits centred in it, so the card lands 12 under the header, as in the mock).
 */
export const PHONE_COLUMN = "px-4 pt-[9px] pb-[calc(env(safe-area-inset-bottom)+40px)]";
/** The column's top, in px: where the pinned player sits under the header band. */
export const PHONE_TOP_PX = 9;

/** The line under the tile: at least one line of the count (its number is 30), centred. */
const UNDER = "flex min-h-[34px] items-center justify-center";
/** The sentence's card at rest: the moment's frame (114 tall) and the card's padding (2 × 22). */
const SENTENCE_CARD_MIN = "min-h-[158px]";

export interface FirstCardProps {
  /** The card's `data-result`: "hero" for the result, "running" while it simulates. */
  name?: string;
  cardRef?: React.Ref<HTMLDivElement>;
  /** The 9:16 tile, as wide as its box: 53% of the card's inside, never under 140 or over 200. */
  tile: React.ReactNode;
  /** 16 under the tile: the count, or the wait's words. */
  under: React.ReactNode;
  /** Under the hairline: a `LineFrame`. */
  line: React.ReactNode;
}

/** Phone: the first card. */
export function FirstCard({ name, cardRef, tile, under, line }: FirstCardProps) {
  return (
    <Card ref={cardRef} data-result={name} className="px-3.5 pb-3 pt-5">
      <div data-part="tile-box" className="mx-auto w-[clamp(140px,53%,200px)]">
        {tile}
      </div>
      <div data-part="under" className={cn("mt-4", UNDER)}>
        {under}
      </div>
      <div data-part="line-box" className="mt-3.5 border-t border-border pt-[30px]">
        {line}
      </div>
    </Card>
  );
}

export interface LineFrameProps {
  /** The plot's width; without it the frame is as wide as its box (the loading frame). */
  width?: number;
  /** The plot's height (`PLOT_PX`). */
  height: number;
  /** The box around the plot and the strip: the result's slider (role, keys, pointer), or nothing. */
  box?: React.HTMLAttributes<HTMLDivElement>;
  plotRef?: React.Ref<HTMLDivElement>;
  /** The plot's `data-result` ("curve" on the result). */
  plotName?: string;
  plot?: React.ReactNode;
  /** 8 under the plot; null: no strip. */
  strip: React.ReactNode | null;
  stripClassName?: string;
  /** The two times under it all; null: the row keeps its height and shows nothing. */
  times: readonly [string, string] | null;
}

/** The plot, the strip and the two times: the result's line, and the place the wait keeps for it. */
export function LineFrame({ width, height, box = {}, plotRef, plotName, plot, strip, stripClassName, times }: LineFrameProps) {
  const { className: boxClassName, ...boxProps } = box;
  return (
    <div data-part="line-frame" style={width === undefined ? undefined : { width }}>
      <div {...boxProps} className={cn("relative rounded-md", boxClassName)}>
        <div ref={plotRef} data-result={plotName} data-part="plot" className="relative" style={{ height }}>
          {plot}
        </div>
        {strip !== null && (
          <div data-part="strip-slot" className={cn("pointer-events-none mt-2", stripClassName)}>
            {strip}
          </div>
        )}
      </div>
      <div
        data-part="times"
        className={cn(
          "flex h-[21px] justify-between text-label leading-[21px] text-foreground-muted tabular-nums",
          strip !== null ? "mt-0.5" : "mt-1",
        )}
      >
        {times && (
          <>
            <span>{times[0]}</span>
            <span>{times[1]}</span>
          </>
        )}
      </div>
    </div>
  );
}

export interface WideFrameProps {
  /** The root's `data-result` ("running" while it simulates). */
  name?: string;
  /** The left column's 9:16 tile, as wide as the column. */
  tile: React.ReactNode;
  /** 18 under the tile, centred on it: the count, or the wait's words. */
  under: React.ReactNode;
  /** The right column's first card: the sentence alone; nothing while it simulates. */
  first: React.ReactNode;
  firstClassName?: string;
  /** Under the first card ("After posting"); not drawn when undefined, no room while empty. */
  after?: React.ReactNode;
  afterClassName?: string;
  lineCardRef?: React.Ref<HTMLDivElement>;
  /** The line's card: a `LineFrame`. */
  line: React.ReactNode;
  /** Under the line's card (the switch and the panel); not drawn when undefined. */
  rest?: React.ReactNode;
  restClassName?: string;
}

/** Wide window: the two columns. */
export function WideFrame({
  name,
  tile,
  under,
  first,
  firstClassName,
  after,
  afterClassName,
  lineCardRef,
  line,
  rest,
  restClassName,
}: WideFrameProps) {
  return (
    <div data-result={name} className="px-8 pb-12 pt-8">
      <div className="mx-auto grid max-w-[980px] grid-cols-[minmax(0,372fr)_minmax(0,588fr)] items-start gap-5">
        <div data-part="tile-column" className="min-w-0">
          {tile}
          <div data-part="under" className={cn("mt-[18px]", UNDER)}>
            {under}
          </div>
        </div>
        <div className="@container flex min-w-0 flex-col gap-4">
          <Card
            data-result="sentence-card"
            className={cn("flex items-center p-[22px] @min-[460px]:pr-[30px]", SENTENCE_CARD_MIN)}
          >
            {first != null && <div className={cn("w-full min-w-0", firstClassName)}>{first}</div>}
          </Card>
          {after !== undefined && (
            <div data-part="after" className={cn("empty:hidden", afterClassName)}>
              {after}
            </div>
          )}
          <Card ref={lineCardRef} data-part="line-card" className="px-6 pb-3.5 pt-8">
            {line}
          </Card>
          {rest !== undefined && <div className={cn("flex flex-col gap-4", restClassName)}>{rest}</div>}
        </div>
      </div>
    </div>
  );
}

/** An empty box of the strip's height. */
function EmptyStrip({ width }: { width: number }) {
  return <div style={{ height: stripHeight(width) }} />;
}

/**
 * The page's frame with empty boxes and no text: shown while the row loads, and for the one frame
 * before the viewport is measured (so the video is mounted once, in the right layout). The first
 * block's boxes are the result's own, so the result lands in them; on a phone one empty card stands
 * for what comes under the first.
 */
export function ResultFrame() {
  return (
    <div aria-busy="true">
      <div className={cn(PHONE_COLUMN, "md:hidden")}>
        <FirstCard
          tile={<div className={cn(TILE, "w-full bg-surface-sunken", RADIUS.hero)} />}
          under={null}
          line={<LineFrame height={PLOT_PX.phone} strip={<EmptyStrip width={PHONE_LINE_FALLBACK} />} times={null} />}
        />
        <Card className="mt-5 h-[350px]" />
      </div>
      <div className="hidden md:block">
        <WideFrame
          tile={<div className={cn(TILE, "w-full bg-surface-sunken", RADIUS.desktop)} />}
          under={null}
          first={null}
          line={<LineFrame height={PLOT_PX.wide} strip={<EmptyStrip width={WIDE_LINE_FALLBACK} />} times={null} />}
        />
      </div>
    </div>
  );
}
```

`src/components/result/viewer-count.tsx`:

```tsx
"use client";

import { OF_VIEWERS, countAt, formatCount } from "@/lib/result/count";
import type { Audience } from "@/lib/result/types";
import { usePlayhead } from "./playhead";

/** The count's number: the figure role the Engagement page's average watch had (30, bold, tight). */
const NUMBER = "text-3xl font-bold leading-[25px] tracking-[-0.04em] text-foreground tabular-nums";

/**
 * The count under the video (spec 3.1): how many of 1,000 viewers are still watching at the playhead,
 * or, at rest, watched to the end. The number and its words on one baseline, centred; the words go
 * under the number only where one line cannot hold both (a 320 phone).
 *
 * Plain text for a screen reader, no live region: it changes every frame while the video plays.
 */
export function ViewerCount({ audience }: { audience: Audience }) {
  const { t, resting } = usePlayhead();
  const { n, words } = countAt(audience, t, resting);
  return (
    <p data-result="count" className="flex flex-wrap items-baseline justify-center gap-x-2 text-center">
      <span data-part="count-number" className={NUMBER}>
        {formatCount(n)}
      </span>{" "}
      <span data-part="count-words" className="text-ui text-foreground-secondary">
        {OF_VIEWERS} {words}
      </span>
    </p>
  );
}
```

`src/components/result/hero.tsx`, replaced whole:

```tsx
"use client";

import type { VideoModel } from "@/lib/result/types";
import { Curve } from "./curve";
import { FirstCard, PHONE_LINE_FALLBACK, PLOT_PX } from "./first-block";
import { Player } from "./player";
import { useContentWidth } from "./use-content-width";
import { ViewerCount } from "./viewer-count";

/**
 * Phone: the first card (spec 3.1). The video in focus, the count under it, then under the hairline
 * the line with the strip and its two times. The line is as wide as the card's inside, so it follows
 * the card at 320, 393 and 430 wide.
 */
export function Hero({ model }: { model: VideoModel }) {
  const [cardRef, width] = useContentWidth<HTMLDivElement>(PHONE_LINE_FALLBACK);
  return (
    <FirstCard
      name="hero"
      cardRef={cardRef}
      tile={<Player model={model} size="hero" />}
      under={<ViewerCount audience={model.audience} />}
      line={<Curve model={model} width={width} height={PLOT_PX.phone} strip />}
    />
  );
}
```

`src/components/result/compact-player.tsx`, replaced whole:

```tsx
"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { countAt, formatCount } from "@/lib/result/count";
import { watchingAt } from "@/lib/result/curve";
import type { VideoModel } from "@/lib/result/types";
import { Curve, lineY } from "./curve";
import { usePlayhead } from "./playhead";
import { Player } from "./player";
import { useContentWidth } from "./use-content-width";

/** The plot's height in the compact player (the mock's `scr2(243, 50)` with `SC`). */
const PLOT = 50;
/** The room above the plot for the readout. */
const ABOVE = 30;
/** The line's width before it is measured: a 393-wide phone. */
const FALLBACK_WIDTH = 263;

/**
 * Phone, once the first card has scrolled away (the mock's `.pn-c`, `scr` with `SC`): a small frame
 * (62 wide), the line (plot 50 tall, no strip) with the playhead, and at the line's end, above it just
 * before the dot, the count's number alone: the number the first card shows under the video at that
 * moment. The layout (video-result.tsx) pins it under the header.
 */
export function CompactPlayer({ model }: { model: VideoModel }) {
  const { t, resting } = usePlayhead();
  const [lineRef, width] = useContentWidth<HTMLDivElement>(FALLBACK_WIDTH);
  const end = useMemo(() => {
    const { points, clipS } = model.audience;
    const last = points[points.length - 1]![1];
    // Clear of the line both at its end and a little before it (the mock's `endL`).
    const before = watchingAt(points, (Math.max(0, width - 36) / width) * clipS);
    return { x: width - 9, y: Math.min(lineY(last, PLOT), lineY(before, PLOT)) - 9 };
  }, [model, width]);

  return (
    <Card data-result="compact" data-id={model.id} className="flex items-start gap-3.5 rounded-3xl py-2 pl-2 pr-3.5">
      <Player model={model} size="compact" />
      <div ref={lineRef} className="relative min-w-0 flex-1" style={{ paddingTop: ABOVE }}>
        {/* A copy of the first card's line, which stays the one slider. */}
        <Curve model={model} width={width} height={PLOT} strip={false} mirror />
        <svg
          width={width}
          height={PLOT}
          viewBox={`0 0 ${width} ${PLOT}`}
          className="pointer-events-none absolute left-0 overflow-visible"
          style={{ top: ABOVE }}
          aria-hidden
        >
          <text
            data-part="end"
            x={end.x.toFixed(1)}
            y={end.y.toFixed(1)}
            textAnchor="end"
            fontSize={12}
            fontWeight={650}
            fill="var(--color-foreground)"
            className="tabular-nums"
          >
            {formatCount(countAt(model.audience, t, resting).n)}
          </text>
        </svg>
      </div>
    </Card>
  );
}
```

`src/components/result/video-result.tsx`, replaced whole:

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MOBILE_NAV_BAND } from "@/components/sidebar/Sidebar";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import type { VideoModel } from "@/lib/result/types";
import { AudiencePanel } from "./audience-panel";
import { BrainPanel } from "./brain-panel";
import { CompactPlayer } from "./compact-player";
import { Curve } from "./curve";
import { EngagementPanel } from "./engagement-panel";
import { PHONE_COLUMN, PHONE_TOP_PX, PLOT_PX, ResultFrame, WIDE_LINE_FALLBACK, WideFrame } from "./first-block";
import { Hero } from "./hero";
import { Moment } from "./moment";
import { PanelSwitch, panelId, tabId, type PanelId } from "./panel-switch";
import { Player } from "./player";
import { useContentWidth } from "./use-content-width";
import { ViewerCount } from "./viewer-count";

const PANEL_VIEWS: Record<PanelId, (props: { model: VideoModel }) => React.ReactNode> = {
  brain: BrainPanel,
  engagement: EngagementPanel,
  audience: AudiencePanel,
};

/** The line the first card has scrolled past when it is gone under the header. */
const PIN_LINE_PX = MOBILE_NAV_BAND + PHONE_TOP_PX;

/** True once the element has scrolled up under the header (the scroll container is <main>). */
function useScrolledPast(ref: React.RefObject<HTMLElement | null>): boolean {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setPast(!entry.isIntersecting && entry.boundingClientRect.top < PIN_LINE_PX);
      },
      { rootMargin: `-${PIN_LINE_PX}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return past;
}

interface Parts {
  model: VideoModel;
  tabs: React.ReactNode;
  panel: React.ReactNode;
  /** Directly under the first block ("After posting"), from the screen. */
  after?: React.ReactNode;
}

/**
 * Phone (the mock's `simP0`, RUN branch): one column, 16px sides. The first card (`Hero`); the moment
 * 18 below; the switch 20 below; the panel 10 below. Once the first card has scrolled under the header
 * the compact player is pinned there.
 */
function PhoneResult({ model, tabs, panel, after }: Parts) {
  const heroRef = useRef<HTMLDivElement>(null);
  const scrolled = useScrolledPast(heroRef);
  return (
    <div className={PHONE_COLUMN}>
      <div ref={heroRef}>
        <Hero model={model} />
      </div>
      {/* 12 under the first card; no room at all while it shows nothing (it renders nothing until read). */}
      {after !== undefined && <div className="mt-3 empty:hidden">{after}</div>}
      <div className="mt-[18px]">
        <Moment model={model} />
      </div>
      <div className="mt-5">{tabs}</div>
      <div className="mt-2.5">{panel}</div>
      {scrolled && (
        // Pinned right under the header band, 12px under the header like the first card was. The ground
        // behind it (and the 9px above it) hides the content scrolling under it, as a header would.
        <div
          className="fixed inset-x-0 z-[var(--z-sticky)] bg-background px-4"
          style={{ top: `calc(env(safe-area-inset-top) + ${MOBILE_NAV_BAND}px)`, paddingTop: PHONE_TOP_PX }}
        >
          <CompactPlayer model={model} />
        </div>
      )}
    </div>
  );
}

/**
 * Wide window (`WideFrame`, spec 3.2): the video large at the left with the count under it; at the
 * right the sentence's card alone, "After posting", the line's card (plot 104, as wide as the card's
 * inside), the switch and the panel.
 */
function DesktopResult({ model, tabs, panel, after }: Parts) {
  const [lineCard, lineWidth] = useContentWidth<HTMLDivElement>(WIDE_LINE_FALLBACK);
  return (
    <WideFrame
      tile={<Player model={model} size="desktop" />}
      under={<ViewerCount audience={model.audience} />}
      first={<Moment model={model} />}
      after={after}
      lineCardRef={lineCard}
      line={<Curve model={model} width={lineWidth} height={PLOT_PX.wide} strip />}
      rest={
        <>
          {tabs}
          {panel}
        </>
      }
    />
  );
}

/**
 * The video result: phone or desktop, the panel switch, and the chosen panel. `after` (the screen's
 * "After posting") stands under the first block: the first card on a phone, the sentence's card on a
 * wide window.
 */
export function VideoResult({ model, after }: { model: VideoModel; after?: React.ReactNode }) {
  const { isMobile, hydrated } = useIsMobileHydrated();
  const [selected, setSelected] = useState<PanelId>("audience");
  const idBase = useId();

  if (!hydrated) return <ResultFrame />;

  const View = PANEL_VIEWS[selected];
  const tabs = <PanelSwitch value={selected} onChange={setSelected} idBase={idBase} />;
  const panel = (
    // A Tab stop of its own: a panel without controls can still be reached and read.
    // A container too: a panel lays itself out for the width it gets, not for the window's.
    <div
      role="tabpanel"
      tabIndex={0}
      id={panelId(idBase)}
      aria-labelledby={tabId(idBase, selected)}
      data-result="panel"
      className="@container"
    >
      <View model={model} />
    </div>
  );

  return isMobile ? (
    <PhoneResult model={model} tabs={tabs} panel={panel} after={after} />
  ) : (
    <DesktopResult model={model} tabs={tabs} panel={panel} after={after} />
  );
}
```

`src/components/result/result-page.tsx`: replace `import { ResultFrame, VideoResult } from "./video-result";`
with `import { ResultFrame } from "./first-block";` and `import { VideoResult } from "./video-result";`.

`src/components/result/player.tsx`, three edits:

1. Replace the `BOX` and `RADIUS` constants with:

```tsx
/** The 9:16 tile's box: the result's video, the wait's picture, the loading frame's empty tile. */
export const TILE = "relative aspect-[9/16] shrink-0";
/**
 * The tile's width. The hero's is the first card's tile box (`FirstCard`: 53% of the card's inside,
 * 140 to 200) and the desktop's its column, so both fill their box; the compact player's is its own.
 */
const BOX: Record<Size, string> = {
  hero: "w-full",
  desktop: "w-full",
  compact: "w-[62px]",
};
/** The tile's corner; the running screen's tile has the same. */
export const RADIUS: Record<Size, string> = {
  hero: "rounded-2xl",
  desktop: "rounded-3xl",
  compact: "rounded-lg",
};
```

2. In the `SHADOW` comment, replace "The running screen's picture uses them too (the small tile `hero`,
   the large one `desktop`)." with "The running screen's tile uses them too (`hero` on a phone,
   `desktop` on a wide window)."
3. In `Player`, `<div data-result="video" className={cn("relative aspect-[9/16] shrink-0", BOX[size])}>`
   becomes `<div data-result="video" className={cn(TILE, BOX[size])}>`.

`src/components/result/scene-strip.tsx`: delete `/** Between two tiles. */ const GAP = 3;`, add
`import { cn } from "@/lib/utils";` and `import { STRIP_GAP_PX, STRIP_TILE } from "./first-block";`,
replace `(k < last ? GAP : 0)` with `(k < last ? STRIP_GAP_PX : 0)` and
`className="absolute inset-0 flex overflow-hidden rounded-lg bg-surface-sunken shadow-[0_0_0_1px_var(--color-border)]"`
with `className={cn("absolute inset-0 flex overflow-hidden", STRIP_TILE)}`. The look is unchanged.

`src/components/result/curve.tsx`:

1. Imports: remove `import { cn } from "@/lib/utils";`; add `import { LineFrame, stripHeight } from "./first-block";`.
2. Under `const TOUCH_SLOP = 6;` add:

```tsx
/** The slider's box: a drag moves sideways, the page still scrolls up and down. */
const GRAB = "cursor-ew-resize touch-pan-y select-none";
```

3. In the doc comment of `Curve`, after "38 tall, 46 on a line wider than 400.", add: "Drawn through
   `LineFrame`, the frame the running screen keeps the line's place in."
4. Replace everything from `  const valueText = \`${timecode(stored.at)}, ${stored.pct}% still watching\`;`
   to the end of the function with:

```tsx
  const valueText = `${timecode(stored.at)}, ${stored.pct}% still watching`;

  // Pointer drags seek on the slider and on its copy (the compact player's) alike.
  const pointer = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture: onPointerCancel,
  };
  const box: React.HTMLAttributes<HTMLDivElement> = mirror
    ? { "aria-hidden": true, ...pointer, className: GRAB }
    : {
        role: "slider",
        tabIndex: 0,
        "aria-label": "Still watching",
        "aria-valuemin": 0,
        "aria-valuemax": clipS,
        "aria-valuenow": Math.round(t * 10) / 10,
        "aria-valuetext": valueText,
        onKeyDown,
        ...pointer,
        className: GRAB,
      };

  return (
    <LineFrame
      width={width}
      height={height}
      box={box}
      plotRef={plotRef}
      plotName="curve"
      plot={
        <>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="pointer-events-none block overflow-visible"
            aria-hidden
          >
            <CurveArt geo={geo} width={width} height={height} />
            {!resting && (
              <path
                data-part="playhead"
                d={`M${f(px)} 0V${height}`}
                stroke="var(--color-foreground)"
                strokeWidth={1.5}
              />
            )}
            <circle
              data-part="dot"
              cx={f(dotX)}
              cy={f(dotY)}
              r={4.5}
              fill="var(--color-foreground)"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          </svg>
          {!resting && (
            <span
              data-part="readout"
              className="pointer-events-none absolute -top-[26px] h-[22px] -translate-x-1/2 whitespace-nowrap rounded-md bg-action px-2 text-label font-bold leading-[22px] text-action-foreground tabular-nums"
              style={{ left: Math.max(34, Math.min(width - 34, dotX)) }}
            >
              {stored.pct}% · {timecode(stored.at)}
            </span>
          )}
        </>
      }
      strip={showStrip ? <SceneStrip model={model} width={width} height={stripHeight(width)} /> : null}
      times={[timecode(0), timecode(clipS)]}
    />
  );
}
```

The DOM keeps its order and classes (the box around the plot and the strip carries the slider; the
plot is `data-result="curve"`; the strip 8 under it; the times row under the box), plus three
`data-part` names and the times row's fixed `h-[21px]`, the line height it already had.

#### Step 4: run, expect a pass

```
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/result src/lib/result --testTimeout 30000
pnpm exec tsc --noEmit
pnpm exec eslint src/components/result/first-block.tsx src/components/result/viewer-count.tsx src/components/result/hero.tsx src/components/result/compact-player.tsx src/components/result/video-result.tsx src/components/result/curve.tsx src/components/result/scene-strip.tsx src/components/result/player.tsx src/components/result/result-page.tsx src/components/result/__tests__/first-block.test.tsx src/components/result/__tests__/viewer-count.test.tsx src/components/result/__tests__/hero.test.tsx src/components/result/__tests__/player.test.tsx src/components/result/__tests__/result-page.test.tsx src/components/result/__tests__/after-posting-mount.test.tsx src/components/result/__tests__/simulation-screen.test.tsx
```

All green: `curve.test.tsx`, `moment.test.tsx`, `gauge.test.tsx`, `playhead.test.tsx`,
`audience-panel.test.tsx`, `result-guard.test.ts` unchanged. **Rule 28:** `Gauge` leaves `hero.tsx` and
`video-result.tsx` but keeps its users (`text-result.tsx`, `thread-next/video-answer.tsx`): it stays.
`ResultFrame` moved; grep `ResultFrame` to show `video-result.tsx` no longer exports it and every
importer reads `first-block.tsx`. **Report:** `task-2-report.md`.

---

### Task 3: Engagement

**Files.** Rewrite `src/components/result/engagement-panel.tsx` and
`src/components/result/__tests__/engagement-panel.test.tsx`. **Must not touch** `engagement-icons.tsx`
(the glyphs stay), any other part.

**Consumes:** `countAt`, `endCount`, `formatCount`, `pastOpening` (Task 1), `mostLikely` (Task 1),
`usePlayhead`, `ViewerCount` (Task 2, in the test only), `hero-harness.tsx`. **Produces:**
`data-result="of-viewers"` (replaces `avg-watch`), `data-part="now" | "figure" | "marker" | "most-likely"`.

Behaviour (rule 15): the panel reads the playhead. Card "Of 1,000 viewers" (the heading in the intents
card's style): three rows with hairlines between, a name left and a figure right: `Past the first 3
seconds` + `pastOpening`; `Watched to the end` + `endCount`; `Average watch` + `0:16` with `of 0:29`,
and under that row the bar filled to the average watch. Away from rest: above the three rows one sunken
row, `Now, at 0:07` left and `562 still watching` right (the number bold), and on the bar a coral marker
at `t / clipS`, 2 wide and 18 tall. At rest both are gone. Card "What viewers are likely to do": as
today (glyphs, longest first, bars, no numbers), plus `Most likely` at the right end of the single
highest row; a tie for the highest names none. Card 1's top padding is the intents card's (`pt-1.5`
with the heading's `pt-3`), so both headings stand at the same place (Question 10); its sides and
bottom are today's.

#### Step 1: the failing test

`src/components/result/__tests__/engagement-panel.test.tsx`, replaced whole:

```tsx
/** @vitest-environment happy-dom */
/**
 * The Engagement page on recorded runs (spec 4.2): the counts of 1,000 viewers, the average watch and
 * what viewers are likely to do, following the video. Real: the state function, the panel, the
 * playhead and the count under the video (the two must agree). Nothing is stood in for.
 */
import { describe, expect, it, vi } from "vitest";
import { act, screen, within } from "@testing-library/react";

// The flag is a build-time constant; this file is the flag-on build (the page exists only there).
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

import early from "@/lib/result/__tests__/fixtures/early.json";
import holds from "@/lib/result/__tests__/fixtures/holds.json";
import opening from "@/lib/result/__tests__/fixtures/opening.json";
import type { Intent, VideoModel } from "@/lib/result/types";
import { EngagementPanel } from "../engagement-panel";
import { ViewerCount } from "../viewer-count";
import { modelOf, playhead, renderWithPlayhead } from "./hero-harness";

const panel = () => document.querySelector<HTMLElement>('[data-result="engagement"]')!;
const ofViewers = () => document.querySelector<HTMLElement>('[data-result="of-viewers"]')!;
const now = () => ofViewers().querySelector<HTMLElement>('[data-part="now"]');
const marker = () => ofViewers().querySelector<HTMLElement>('[data-part="marker"]');
const fills = () => Array.from(panel().querySelectorAll<HTMLElement>("[data-fill]")).map((el) => el.style.width);
const figures = () =>
  [...ofViewers().querySelectorAll('[data-part="figure"]')].map((row) => [
    row.querySelector("dt")!.textContent,
    row.querySelector("dd")!.textContent,
  ]);
const intentRows = () => within(screen.getByRole("list", { name: "Most likely first" })).getAllByRole("listitem");
const mount = (model: VideoModel) => renderWithPlayhead(model, <EngagementPanel model={model} />);
const intents = (share: number, comment: number, rewatch: number, save: number): Intent[] => [
  { id: "share", label: "Share", value: share },
  { id: "comment", label: "Comment", value: comment },
  { id: "rewatch", label: "Rewatch", value: rewatch },
  { id: "save", label: "Save", value: save },
];

describe("Of 1,000 viewers", () => {
  it("three rows: past the first 3 seconds, watched to the end, the average watch with its bar", () => {
    const model = modelOf(early);
    mount(model);
    expect(within(ofViewers()).getByRole("heading", { name: "Of 1,000 viewers" })).toBeInTheDocument();
    expect(figures()).toEqual([
      ["Past the first 3 seconds", "708"],
      ["Watched to the end", "461"],
      ["Average watch", "0:16of 0:29"],
    ]);
    // The bar is as long as the clip, filled to the average watch.
    const bar = ofViewers().querySelector<HTMLElement>('[data-bar="avg-watch"] [data-fill]')!;
    expect(bar.style.width).toBe(`${(model.avgWatchS / model.clipS) * 100}%`);
  });

  it("reads other runs' numbers", () => {
    mount(modelOf(opening));
    expect(figures()).toEqual([
      ["Past the first 3 seconds", "708"],
      ["Watched to the end", "708"],
      ["Average watch", "1:26of 2:01"],
    ]);
  });

  it("at rest: no Now row and no marker", () => {
    mount(modelOf(early));
    expect(now()).toBeNull();
    expect(marker()).toBeNull();
  });

  it("away from rest: Now, at the moment, how many are still watching, above the rows; a coral marker on the bar there", () => {
    mount(modelOf(early));
    act(() => playhead.current.seek(7));
    expect(now()!.firstElementChild!.textContent).toBe("Now, at 0:07");
    expect(now()!.lastElementChild!.textContent).toBe("562 still watching");
    expect(now()!.lastElementChild!.firstElementChild!.className).toMatch(/\bfont-bold\b/);
    const firstFigure = ofViewers().querySelector('[data-part="figure"]')!;
    expect(now()!.compareDocumentPosition(firstFigure) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(parseFloat(marker()!.style.left)).toBeCloseTo((7 / 29) * 100, 3);
    expect(marker()!.className).toMatch(/\bbg-below\b/);
    expect(marker()!.className).toMatch(/\bw-0\.5\b/);
    expect(marker()!.className).toContain("h-[18px]");
    // On the average watch's bar, which keeps its fill.
    expect(marker()!.closest('[data-bar="avg-watch"]')).not.toBeNull();
    act(() => playhead.current.seek(29));
    expect(now()).toBeNull();
    expect(marker()).toBeNull();
  });

  it("the Now row says what the count under the video says", () => {
    const model = modelOf(early);
    const { container } = renderWithPlayhead(
      model,
      <>
        <ViewerCount audience={model.audience} />
        <EngagementPanel model={model} />
      </>,
    );
    for (const t of [0, 2.5, 7, 20]) {
      act(() => playhead.current.seek(t));
      const shown = container.querySelector('[data-part="count-number"]')!.textContent;
      expect(now()!.lastElementChild!.textContent).toBe(`${shown} still watching`);
    }
  });
});

describe("What viewers are likely to do", () => {
  it("the four actions, the longest bar first, no numbers; the single highest is Most likely", () => {
    mount(modelOf(early));
    expect(screen.getByRole("heading", { name: "What viewers are likely to do" })).toBeInTheDocument();
    const rows = intentRows();
    expect(rows.map((row) => row.textContent)).toEqual(["ShareMost likely", "Comment", "Rewatch", "Save"]);
    // early stores share 47.9, comment 29.6, rewatch 19.4, save 12.5.
    expect(fills().slice(1)).toEqual(["48%", "30%", "19%", "13%"]);
    const tags = panel().querySelectorAll('[data-part="most-likely"]');
    expect(tags).toHaveLength(1);
    // At the right end of its row, after the bar; an ink tag.
    expect(rows[0]!.lastElementChild).toBe(tags[0]);
    expect(tags[0]!.className).toMatch(/\bbg-action\b/);
    expect(tags[0]!.className).toMatch(/\btext-action-foreground\b/);
    for (const row of rows) {
      const bar = row.querySelector('[data-bar="intent"]')!;
      expect(bar.getAttribute("aria-hidden")).toBe("true");
      expect(bar.textContent).toBe("");
    }
  });

  it("follows the run's own order (holds: Save first, and most likely)", () => {
    mount(modelOf(holds));
    expect(intentRows().map((row) => row.textContent)).toEqual(["SaveMost likely", "Share", "Comment", "Rewatch"]);
  });

  it("a tie for the highest names none", () => {
    mount({ ...modelOf(early), intents: intents(40, 40, 10, 5) });
    expect(panel().querySelector('[data-part="most-likely"]')).toBeNull();
  });

  it("all zero names none, and each action keeps a visible stub of 4%", () => {
    mount({ ...modelOf(early), intents: intents(0, 0, 0, 0) });
    expect(panel().querySelector('[data-part="most-likely"]')).toBeNull();
    expect(fills().slice(1)).toEqual(["4%", "4%", "4%", "4%"]);
  });

  it("renders only the first card when the run stored no intents", () => {
    mount({ ...modelOf(early), intents: null });
    expect(ofViewers()).not.toBeNull();
    expect(screen.queryByText("What viewers are likely to do")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(panel().querySelectorAll('[data-result="intents"]')).toHaveLength(0);
  });
});

describe("the page as a whole", () => {
  it("its only numbers are the counts and the times: no percent, no index, no verdict", () => {
    mount(modelOf(early));
    const text = [
      panel().textContent ?? "",
      ...Array.from(panel().querySelectorAll("[aria-label]")).map((el) => el.getAttribute("aria-label") ?? ""),
    ].join(" ");
    expect(text).not.toMatch(/\b(low|high|medium|intent)\b/i);
    expect(text).not.toContain("%");
    expect(text.match(/\d[\d,]*(:\d+)?/g)).toEqual(["1,000", "3", "708", "461", "0:16", "0:29"]);
  });

  it("coral only at the video's moment: none at rest, the marker alone away from rest", () => {
    mount(modelOf(early));
    expect(panel().innerHTML).not.toMatch(/below|accent|#[0-9a-f]{3,8}\b|rgba?\(/i);
    act(() => playhead.current.seek(7));
    const coral = [...panel().querySelectorAll('[class*="below"], [fill*="below"], [stroke*="below"]')];
    expect(coral).toHaveLength(1);
    expect(coral[0]).toBe(marker());
  });

  it("two cards, 10 apart on the phone and 16 on desktop", () => {
    mount(modelOf(early));
    expect(panel().className).toMatch(/\bgap-2\.5\b/);
    expect(panel().className).toMatch(/\bmd:gap-4\b/);
    expect([...panel().children].map((el) => el.getAttribute("data-result"))).toEqual(["of-viewers", "intents"]);
  });
});
```

#### Step 2: run, expect failures

`NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/result/__tests__/engagement-panel.test.tsx --testTimeout 30000`.
Expected: every test fails on `[data-result="of-viewers"]` being null, the intent rows carry no tag,
and "the page as a whole" finds `Avg watch` instead of the counts.

#### Step 3: the implementation

`src/components/result/engagement-panel.tsx`, replaced whole:

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { countAt, endCount, formatCount, pastOpening } from "@/lib/result/count";
import { timecode } from "@/lib/result/format";
import { mostLikely } from "@/lib/result/most-likely";
import type { Intent, VideoModel } from "@/lib/result/types";
import { cn } from "@/lib/utils";
import { INTENT_GLYPHS } from "./engagement-icons";
import { usePlayhead } from "./playhead";

/**
 * Engagement (spec 4.2): two cards, 10 apart on the phone and 16 on desktop.
 *
 * "Of 1,000 viewers": counts of the simulated audience (past the first 3 seconds, watched to the end)
 * and the average watch with its bar. Away from rest a sunken row says how many are still watching at
 * the video's moment, and a coral marker stands on the bar there: besides the named scene, the video's
 * moment is the one thing coral marks. At rest both are gone.
 *
 * "What viewers are likely to do": the four actions, longest bar first, no numbers and no verdict
 * words (the intent value is the engine's 0 to 100 index, not a share of viewers). The single highest
 * carries "Most likely"; a tie for the highest names none.
 */
export function EngagementPanel({ model }: { model: VideoModel }) {
  return (
    <div data-result="engagement" className="flex flex-col gap-2.5 md:gap-4">
      <OfViewers model={model} />
      {model.intents && <LikelyActions intents={model.intents} />}
    </div>
  );
}

/** Both cards' heading (`.en-h`). */
const HEADING = "px-0.5 pb-[5px] pt-3 text-label font-[560] text-foreground-secondary";

/** A time of the clip as a share of its length, 0 to 100. */
const shareOf = (seconds: number, clipS: number) =>
  clipS > 0 ? Math.min(100, Math.max(0, (seconds / clipS) * 100)) : 0;

/**
 * A bar of the track's full length, filled in ink to `pct` (0 to 100), and, when given, a coral
 * marker at `marker` (0 to 100), taller than the bar. Decorative to readers.
 */
function Bar({
  pct,
  kind,
  marker = null,
  className,
}: {
  pct: number;
  kind: "avg-watch" | "intent";
  marker?: number | null;
  className?: string;
}) {
  return (
    <div data-bar={kind} aria-hidden="true" className={cn("relative h-2", className)}>
      <div className="h-full overflow-hidden rounded-full bg-track">
        <div data-fill className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
      {marker !== null && (
        <span
          data-part="marker"
          className="absolute -top-[5px] h-[18px] w-0.5 -translate-x-1/2 rounded-full bg-below"
          style={{ left: `${marker}%` }}
        />
      )}
    </div>
  );
}

/** One row of the first card: its name left, its figure right, on one baseline. */
function Figure({ name, value, suffix, last = false }: { name: string; value: string; suffix?: string; last?: boolean }) {
  return (
    <div
      data-part="figure"
      className={cn("flex items-baseline justify-between gap-3", last ? "pb-1 pt-[9px]" : "border-b border-border py-[9px]")}
    >
      <dt className="text-ui text-foreground-secondary">{name}</dt>
      <dd className="flex items-baseline gap-1.5 tabular-nums">
        <span className="text-heading font-bold tracking-[-0.03em] text-foreground">{value}</span>
        {suffix && <span className="text-ui font-[560] text-foreground-secondary">{suffix}</span>}
      </dd>
    </div>
  );
}

/** "Of 1,000 viewers" (the drawing's first Engagement card). */
function OfViewers({ model }: { model: VideoModel }) {
  const { t, resting } = usePlayhead();
  const { audience, avgWatchS, clipS } = model;
  const watching = resting ? null : countAt(audience, t, false).n;
  return (
    <Card data-result="of-viewers" className="px-[18px] pb-[18px] pt-1.5 md:px-[22px] md:pt-2">
      <h2 className={HEADING}>Of 1,000 viewers</h2>
      {watching !== null && (
        <p
          data-part="now"
          className="mt-1 flex items-baseline justify-between gap-3 rounded-xl bg-surface-sunken px-3 py-2.5 text-ui text-foreground-secondary"
        >
          <span className="tabular-nums">Now, at {timecode(t)}</span>
          <span>
            <span className="text-title font-bold text-foreground tabular-nums">{formatCount(watching)}</span> still watching
          </span>
        </p>
      )}
      <dl className="mt-1">
        <Figure name="Past the first 3 seconds" value={formatCount(pastOpening(audience))} />
        <Figure name="Watched to the end" value={formatCount(endCount(audience))} />
        <Figure name="Average watch" value={timecode(avgWatchS)} suffix={`of ${timecode(clipS)}`} last />
      </dl>
      <Bar
        kind="avg-watch"
        pct={shareOf(avgWatchS, clipS)}
        marker={watching === null ? null : shareOf(t, clipS)}
        className="mt-1"
      />
    </Card>
  );
}

/**
 * "What viewers are likely to do" (`.en-c`, `.en-h`, `.en-r.ra`): the heading, then one row per
 * action, longest bar first, hairlines between the rows. A row: the glyph (18, secondary), the label
 * (76 wide), the bar to the card's edge, `max(4, round(value))`% long so a near-zero action still
 * shows a stub, and on the single highest row "Most likely" at its right end. Rows are 56 tall on the
 * phone and 50 on desktop.
 */
function LikelyActions({ intents }: { intents: Intent[] }) {
  const top = mostLikely(intents);
  return (
    <Card data-result="intents" className="px-[18px] pb-2.5 pt-1.5 md:px-[22px] md:pt-2">
      <h2 className={HEADING}>What viewers are likely to do</h2>
      <ol aria-label="Most likely first">
        {intents.map((intent, i) => {
          const Glyph = INTENT_GLYPHS[intent.id];
          return (
            <li
              key={intent.id}
              className={cn("flex h-14 items-center gap-3 md:h-[50px]", i > 0 && "border-t border-border")}
            >
              <Glyph size={18} className="shrink-0 text-foreground-secondary" />
              <span className="w-[76px] shrink-0 text-ui font-[560] text-foreground">{intent.label}</span>
              <Bar kind="intent" pct={Math.max(4, Math.round(intent.value))} className="min-w-0 flex-1" />
              {intent.id === top && (
                <span
                  data-part="most-likely"
                  className="shrink-0 rounded-full bg-action px-2 text-label font-[560] leading-5 text-action-foreground"
                >
                  Most likely
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
```

#### Step 4: run, expect a pass

```
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/result/__tests__/engagement-panel.test.tsx src/components/result/__tests__/result-page.test.tsx src/components/result/__tests__/result-guard.test.ts --testTimeout 30000
pnpm exec tsc --noEmit
pnpm exec eslint src/components/result/engagement-panel.tsx src/components/result/__tests__/engagement-panel.test.tsx
```

`result-page.test.tsx` runs because its panel-switch tests open Engagement inside the page's playhead.
**Report:** `task-3-report.md`.

---

### Task 4: Brain

**Files.** Modify `src/components/result/brain-panel.tsx` (replaced whole below; the WebGL stage, the
painted-theme hook, `STAGE`, `CAST` and `monotonePath` are kept byte for byte). Rewrite
`src/components/result/__tests__/brain-panel.test.tsx`. **Must not touch** `cortex-porcelain.ts`,
`CortexCanvas`, `brain-track.ts`, `cortex-sim`.

**Consumes:** `brain-read.ts` (Task 1), `brainTrackOf`, `usePlayhead`, `useContentWidth`.
**Produces:** `data-part="focus-sentence" | "moment-line" | "moment-mark"`, `data-meaning`, `data-word`
in a row (`data-value` goes).

Behaviour (rules 17 to 19): the brain's card untouched (its `At 0:07` corner too); on a wide panel it
stands as tall as the signals card and the brain keeps its drawn 164, centred in it (rule 19; the
fixed 216 goes). The signals card, top to bottom: the Focus sentence; `At 0:07 · the dashed line is at
rest` (the clip's end at rest); four rows, each the name and under it what it stands for, today's curve
(dashed resting level, quiet whole line, ink up to the moment, the dot) with, away from rest, a coral
line at the moment, and at the right the word for the level at that moment. The name's column is 112,
96 where the card's inside is under 300 (a 320 phone: the meaning wraps to two lines); the word's column
is 74 and never wraps; the curve takes the rest. The widths are set inline from the measured inside, so
the columns and the curve always agree.

#### Step 1: the failing test

`src/components/result/__tests__/brain-panel.test.tsx`, replaced whole:

```tsx
/** @vitest-environment happy-dom */
/**
 * The Brain page on recorded runs (spec 4.3): the brain picture as built, and the signals card in
 * words. The model, the track, the reading in words, the playhead and the panel are real. Stand-ins:
 * the WebGL canvas (there is no GL in happy-dom: it records what it is handed, which is what the user
 * would see painted), the motion setting (matchMedia) and, for the widths, the card's measured width
 * (`clientWidth`: happy-dom lays nothing out).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

// The flag is a build-time constant; this file is the flag-on build (the page exists only there).
vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }));

interface CanvasProps {
  seed: number;
  bold: Record<string, number>;
  t: number;
  reducedMotion?: boolean;
  look?: string;
}
const handed: CanvasProps[] = [];
vi.mock("@/components/audience-lens/CortexCanvas", () => ({
  default: (props: CanvasProps) => {
    handed.push(props);
    return <div data-testid="cortex-stand-in" data-look={props.look} />;
  },
}));

import { predictedBold } from "@/lib/brain/cortex-sim";
import { brainTrackOf } from "@/lib/result/brain-track";
import { videoStateOf } from "@/lib/result/video-model";
import type { ResultRow, VideoModel } from "@/lib/result/types";
import early from "@/lib/result/__tests__/fixtures/early.json";
import middle from "@/lib/result/__tests__/fixtures/middle.json";
import { PlayheadProvider, usePlayhead, type Playhead } from "../playhead";
import { BrainPanel } from "../brain-panel";

function modelOf(fixture: unknown): VideoModel {
  const state = videoStateOf(fixture as ResultRow);
  if (state.kind !== "result") throw new Error(`fixture is ${state.kind}, not a result`);
  return state.model;
}

let playhead: Playhead;
function Probe() {
  const current = usePlayhead();
  useEffect(() => {
    playhead = current;
  });
  return null;
}

const model = modelOf(early);
const drive = brainTrackOf(model).drive;
const IDS = ["visual", "dorsal_attention", "limbic", "default"] as const;

function mount(m: VideoModel = model) {
  return render(
    <PlayheadProvider clipS={m.clipS} scenes={m.audience.scenes}>
      <Probe />
      <BrainPanel model={m} />
    </PlayheadProvider>,
  );
}

const lastHanded = () => handed[handed.length - 1]!;
const part = (c: HTMLElement, name: string) => c.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
const stage = (c: HTMLElement) => c.querySelector<HTMLElement>('[data-result="brain-stage"]')!;
const words = (c: HTMLElement) => IDS.map((id) => c.querySelector(`[data-signal="${id}"] [data-word]`)?.textContent);
const marks = (c: HTMLElement) => [...c.querySelectorAll('[data-part="moment-mark"]')];
const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

const realMatchMedia = window.matchMedia;
/** The user's motion setting, as the browser reports it. */
function prefersReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("no-preference") ? !reduce : reduce,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** The signals card's inside as a browser would measure it. */
function cardInside(width: number) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return this.dataset.result === "brain-signals" ? width : 0;
    },
  });
}

beforeEach(() => {
  handed.length = 0;
  document.documentElement.removeAttribute("data-theme");
  prefersReducedMotion(false);
});
afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
  document.documentElement.removeAttribute("data-theme");
  Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
});

describe("BrainPanel: the signals card", () => {
  it("one sentence from Focus, the moment line, the four signals and what each stands for; the picture and the caption as built", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    expect(part(container, "focus-sentence").textContent).toBe("Focus is highest at 0:07 and lowest at 0:23.");
    expect(part(container, "moment-line").textContent).toBe("At 0:29 · the dashed line is at rest");
    const rows = [...container.querySelectorAll("[data-signal]")];
    expect(rows.map((row) => row.querySelector("[data-label]")!.textContent)).toEqual(["Eyes", "Focus", "Feeling", "Wandering"]);
    expect(rows.map((row) => row.querySelector("[data-meaning]")!.textContent)).toEqual([
      "what there is to look at",
      "how closely they follow",
      "how much it moves them",
      "how far the mind drifts",
    ]);
    expect(follows(part(container, "focus-sentence"), part(container, "moment-line"))).toBe(true);
    expect(follows(part(container, "moment-line"), rows[0]!)).toBe(true);
    // No bare numbers in the rows, no legend row.
    expect(container.querySelector("[data-value]")).toBeNull();
    expect(screen.queryByText("at rest")).toBeNull();
    expect(screen.getByText("calm")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("A model of attention, not a scan.")).toBeTruthy();
  });

  it("a run whose Focus falls at a scene change says so (middle)", async () => {
    const { container } = mount(modelOf(middle));
    await screen.findByTestId("cortex-stand-in");
    expect(part(container, "focus-sentence").textContent).toBe(
      "Focus is highest at 0:10 and falls when the scene changes at 0:17.",
    );
  });

  it("at rest: no time in the corner, no moment line on the curves, the words and the brain at the clip's end", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    expect(stage(container).textContent).not.toMatch(/At \d+:\d\d/);
    expect(marks(container)).toHaveLength(0);
    expect(words(container)).toEqual(["above rest", "above rest", "above rest", "above rest"]);
    expect(lastHanded().t).toBe(29);
    expect(lastHanded().bold).toEqual(predictedBold(drive, 29));
  });

  it("away from rest: the time in the corner and the moment line, the words at the moment, a coral line at it on every curve", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    act(() => playhead.seek(7));
    expect(stage(container).textContent).toContain("At 0:07");
    expect(part(container, "moment-line").textContent).toBe("At 0:07 · the dashed line is at rest");
    expect(words(container)).toEqual(["above rest", "above rest", "above rest", "below rest"]);
    expect(lastHanded().t).toBe(7);
    expect(lastHanded().bold).toEqual(predictedBold(drive, 7));
    expect(marks(container)).toHaveLength(4);
    for (const id of IDS) {
      const row = container.querySelector(`[data-signal="${id}"]`)!;
      const mark = row.querySelector('[data-part="moment-mark"]')!;
      expect(mark.getAttribute("stroke")).toBe("var(--color-below)");
      // At the video's moment, where the curve's dot stands.
      expect(parseFloat(mark.getAttribute("d")!.slice(1))).toBeCloseTo(Number(row.querySelector("circle")!.getAttribute("cx")), 1);
    }
    act(() => playhead.seek(29));
    expect(marks(container)).toHaveLength(0);
    expect(stage(container).textContent).not.toMatch(/At \d+:\d\d/);
  });

  it("at 0:00 every signal is at rest", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    act(() => playhead.seek(0));
    expect(words(container)).toEqual(["at rest", "at rest", "at rest", "at rest"]);
    expect(part(container, "moment-line").textContent).toBe("At 0:00 · the dashed line is at rest");
  });

  it("coral only at the video's moment: none at rest, the four moment lines alone away from it", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    expect(container.innerHTML).not.toContain("--color-below");
    act(() => playhead.seek(3));
    const coral = [...container.querySelectorAll('[stroke*="below"], [fill*="below"], [class*="below"]')];
    expect(coral).toHaveLength(4);
    for (const el of coral) expect(el.getAttribute("data-part")).toBe("moment-mark");
  });

  it("a 393 phone: the name's column 112, the word's 74, the curve the rest", async () => {
    cardInside(325);
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    const row = container.querySelector('[data-signal="visual"]')!;
    expect(row.querySelector<HTMLElement>("[data-label]")!.parentElement!.style.width).toBe("112px");
    expect(row.querySelector<HTMLElement>("[data-word]")!.style.width).toBe("74px");
    expect(row.querySelector("svg")!.getAttribute("width")).toBe("119");
  });

  it("a 320 phone: the name's column narrows to 96 (the meaning on two lines); the word never wraps", async () => {
    cardInside(252);
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    const row = container.querySelector('[data-signal="visual"]')!;
    expect(row.querySelector<HTMLElement>("[data-label]")!.parentElement!.style.width).toBe("96px");
    expect(row.querySelector("svg")!.getAttribute("width")).toBe("62");
    expect(row.querySelector("[data-word]")!.className).toMatch(/\bwhitespace-nowrap\b/);
    expect(row.querySelector("[data-meaning]")!.className).toMatch(/\bblock\b/);
  });

  it("a wide panel: the cards side by side as tall as their content; the brain at its drawn size, centred", async () => {
    const { container } = mount();
    await screen.findByTestId("cortex-stand-in");
    const grid = container.querySelector('[data-result="brain"]')!.firstElementChild!;
    expect(grid.className).toContain("@min-[520px]:grid");
    expect(grid.className).not.toContain("h-[216px]");
    expect(stage(container).className).toContain("@min-[520px]:h-auto");
    const canvasBox = screen.getByTestId("cortex-stand-in").parentElement!;
    expect(canvasBox.className).toContain("@min-[520px]:h-[164px]");
    expect(canvasBox.className).toContain("@min-[520px]:top-[calc(50%-82px)]");
    const signals = container.querySelector('[data-result="brain-signals"]')!;
    expect(signals.className).not.toMatch(/min-h-0/);
    for (const row of container.querySelectorAll("[data-signal]")) expect(row.className).not.toMatch(/flex-1/);
  });
});

describe("BrainPanel: the brain, as built", () => {
  it("hands the brain a new reading at most every quarter second", async () => {
    mount();
    await screen.findByTestId("cortex-stand-in");
    act(() => playhead.seek(7.1));
    const first = lastHanded().bold;
    expect(lastHanded().t).toBe(7);
    act(() => playhead.seek(7.2));
    expect(lastHanded().bold).toBe(first);
    act(() => playhead.seek(7.3));
    expect(lastHanded().t).toBe(7.25);
    expect(lastHanded().bold).toEqual(predictedBold(drive, 7.25));
  });

  it("renders the brain once per quarter second while the playhead moves, not once per frame", async () => {
    mount();
    await screen.findByTestId("cortex-stand-in");
    handed.length = 0;
    act(() => playhead.seek(29));
    expect(handed).toHaveLength(0);
    for (const t of [7, 7.04, 7.09, 7.13, 7.18, 7.22]) act(() => playhead.seek(t));
    expect(handed).toHaveLength(1);
    for (const t of [7.26, 7.3, 7.35]) act(() => playhead.seek(t));
    expect(handed).toHaveLength(2);
    expect(lastHanded().t).toBe(7.25);
    expect(screen.getByText("At 0:07")).toBeTruthy();
  });

  it("paints porcelain for the theme, and follows a change of theme", async () => {
    mount();
    expect((await screen.findByTestId("cortex-stand-in")).dataset.look).toBe("porcelain-light");
    act(() => document.documentElement.setAttribute("data-theme", "dark"));
    await waitFor(() => expect(screen.getByTestId("cortex-stand-in").dataset.look).toBe("porcelain-dark"));
  });

  it("does not drift when the user asks for reduced motion", async () => {
    prefersReducedMotion(true);
    mount();
    await screen.findByTestId("cortex-stand-in");
    await waitFor(() => expect(lastHanded().reducedMotion).toBe(true));
    cleanup();
    handed.length = 0;
    prefersReducedMotion(false);
    mount();
    await screen.findByTestId("cortex-stand-in");
    await waitFor(() => expect(lastHanded().reducedMotion).toBe(false));
  });
});
```

(`screen.getByText("At 0:07")` in the quarter-second test finds the corner only: the moment line's text
is the whole sentence, so an exact match does not find it.)

#### Step 2: run, expect failures

`NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/result/__tests__/brain-panel.test.tsx --testTimeout 30000`.
Expected: the "signals card" tests fail (no `focus-sentence`, no `moment-line`, no `data-word`,
`data-value` and the `at rest` legend present, `h-[216px]` present, the column widths unset); the
"brain, as built" tests pass already.

#### Step 3: the implementation

`src/components/result/brain-panel.tsx`, replaced whole:

```tsx
"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useId, useMemo, useState, useSyncExternalStore } from "react";
import { porcelainLegend, type PorcelainLook } from "@/components/audience-lens/cortex-porcelain";
import { Card } from "@/components/ui/card";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { predictedBold, type NetworkId } from "@/lib/brain/cortex-sim";
import { FOCUS_LEVEL, SIGNAL_MEANING, focusSentence, momentLine, restWord } from "@/lib/result/brain-read";
import { brainTrackOf, type BrainSignal } from "@/lib/result/brain-track";
import { timecode } from "@/lib/result/format";
import type { VideoModel } from "@/lib/result/types";
import { cn } from "@/lib/utils";
import { usePlayhead } from "./playhead";
import { useContentWidth } from "./use-content-width";

// WebGL (three.js): browser only, never rendered on the server.
const CortexCanvas = dynamic(() => import("@/components/audience-lens/CortexCanvas"), { ssr: false });

/**
 * Brain (spec 4.3). The existing 3D brain driven by the existing model at the playhead, in porcelain,
 * as built; and the signals card: one sentence about Focus, the moment the rows are read at, and four
 * signals, each its name and what it stands for, its curve over the clip against its resting level,
 * and a word for where it stands at that moment. Away from rest a coral line marks the video's moment
 * on every curve: besides the named scene, the video's moment is the one thing coral marks. A model
 * of attention, not a scan.
 *
 * Phone: the brain card (232 tall), 10 below it the signals card, the caption under both. A panel 520
 * wide and up: the two cards side by side, 1 : 1.28, 16 apart, as tall as the signals card's content;
 * the brain keeps its drawn size, centred in its card's height.
 *
 * The brain is handed a new reading at most four times a second while the playhead moves: the
 * reading is taken on quarter seconds, and the canvas walks its surface between readings itself.
 * Only this component follows the playhead frame by frame; it hands the stage and the rows nothing
 * but quarter-second values, and both are memoised, so the WebGL root renders at most four times a
 * second while playing and not at all at rest.
 */
export function BrainPanel({ model }: { model: VideoModel }) {
  const playhead = usePlayhead();
  const track = useMemo(() => brainTrackOf(model), [model]);
  const look: PorcelainLook = usePaintedTheme() === "dark" ? "porcelain-dark" : "porcelain-light";
  const reducedMotion = usePrefersReducedMotion();

  const moving = !playhead.resting;
  const t = moving ? Math.min(model.clipS, Math.floor(playhead.t * 4) / 4) : model.clipS;
  const bold = useMemo(() => predictedBold(track.drive, t), [track, t]);
  const atEnd = useMemo(() => predictedBold(track.drive, model.clipS), [track, model.clipS]);

  return (
    <div data-result="brain">
      <div className="flex flex-col gap-2.5 @min-[520px]:grid @min-[520px]:grid-cols-[minmax(0,1fr)_minmax(0,1.28fr)] @min-[520px]:gap-4">
        <BrainStage
          seed={track.seed}
          bold={bold}
          t={t}
          look={look}
          reducedMotion={reducedMotion}
          corner={moving ? `At ${timecode(t)}` : null}
        />
        <Signals model={model} signals={track.signals} bold={bold} atEnd={atEnd} t={t} moving={moving} />
      </div>
      <p className="mt-2.5 px-1 text-label leading-4 text-foreground-secondary">A model of attention, not a scan.</p>
    </div>
  );
}

// ── the brain ────────────────────────────────────────────────────────────────

/** The stage behind the brain (`--stage` in the mock), from the theme's tokens. */
const STAGE: Record<PorcelainLook, string> = {
  "porcelain-light":
    "radial-gradient(90% 80% at 50% 40%, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 30%, var(--color-background)) 100%)",
  "porcelain-dark":
    "radial-gradient(80% 70% at 50% 42%, color-mix(in srgb, var(--color-surface-elevated) 60%, var(--color-surface)) 0%, var(--color-surface) 100%)",
};

/** The shadow the brain casts on its stage (`--bshadow`, without the dark theme's warm glow). */
const CAST: Record<PorcelainLook, string> = {
  "porcelain-light": "drop-shadow(0 22px 20px color-mix(in srgb, var(--color-foreground) 16%, transparent))",
  "porcelain-dark": "drop-shadow(0 26px 24px color-mix(in srgb, var(--color-scrim) 83%, transparent))",
};

const BrainStage = memo(function BrainStage({
  seed,
  bold,
  t,
  look,
  reducedMotion,
  corner,
}: {
  seed: number;
  bold: Record<NetworkId, number>;
  t: number;
  look: PorcelainLook;
  reducedMotion: boolean;
  corner: string | null;
}) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const [warm, hot] = porcelainLegend(look);

  return (
    <Card
      data-result="brain-stage"
      className="relative h-[232px] overflow-hidden p-0 @min-[520px]:h-auto"
      style={{ backgroundImage: STAGE[look] }}
    >
      {/* The brain fills the stage's height on the phone (232, set 7 below its top); on a wide panel
          it keeps its drawn 164, centred in the card's height, however tall the signals card makes it.
          The stage clips what falls past its edge. */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-[7px] h-[232px] @min-[520px]:top-[calc(50%-82px)] @min-[520px]:h-[164px] motion-safe:transition-opacity motion-safe:duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
        style={{ filter: CAST[look] }}
      >
        <CortexCanvas seed={seed} bold={bold} t={t} look={look} reducedMotion={reducedMotion} onReady={onReady} />
      </div>
      {/* On the phone a touch on the brain scrolls the page: the canvas's turn-it-by-hand control
          would otherwise hold every gesture that starts on it. */}
      <div className="absolute inset-0 @min-[520px]:hidden" />
      {corner && (
        <span className="absolute left-[18px] top-4 text-meta font-[560] leading-[21px] text-foreground-secondary tabular-nums">
          {corner}
        </span>
      )}
      <span className="absolute right-[18px] top-[17px] flex items-center gap-[7px] text-label leading-[21px] text-foreground-secondary">
        <span>calm</span>
        <i
          aria-hidden="true"
          className="block h-[5px] w-11 rounded-full"
          style={{
            backgroundImage: `linear-gradient(90deg, color-mix(in srgb, var(--color-foreground) 10%, transparent), ${warm}, ${hot})`,
          }}
        />
        <span>active</span>
      </span>
    </Card>
  );
});

// ── the four signals ─────────────────────────────────────────────────────────

const ROW_H = 34;
/** The mock draws a level of 74 at the curve's top; a run that runs hotter widens the scale. */
const SCALE_TOP = 74;
/** The name and what it stands for: 112 wide; 96 where the card's inside is under 300 (a 320 phone). */
const LABEL_W = { wide: 112, narrow: 96 } as const;
const NARROW_BELOW = 300;
/** The word at the right ("above rest"), on one line. */
const WORD_W = 74;
/** The row's two gaps (`gap-2.5`). */
const GAPS = 20;

const Signals = memo(function Signals({
  model,
  signals,
  bold,
  atEnd,
  t,
  moving,
}: {
  model: VideoModel;
  signals: BrainSignal[];
  bold: Record<NetworkId, number>;
  /** The levels at the clip's end, where a clip that is not a whole number of seconds ends its line. */
  atEnd: Record<NetworkId, number>;
  t: number;
  /** Away from rest: the coral line at the moment on every curve. */
  moving: boolean;
}) {
  const [cardRef, inner] = useContentWidth<HTMLDivElement>(325);
  const label = inner < NARROW_BELOW ? LABEL_W.narrow : LABEL_W.wide;
  const width = Math.max(40, inner - label - WORD_W - GAPS);
  const top = useMemo(() => Math.max(SCALE_TOP, ...signals.flatMap((s) => s.perSecond)), [signals]);
  const sentence = useMemo(() => {
    const focus = signals.find((signal) => signal.id === "dorsal_attention");
    return focus ? focusSentence(focus.perSecond, model.audience.scenes) : FOCUS_LEVEL;
  }, [signals, model]);

  return (
    <Card ref={cardRef} data-result="brain-signals" className="flex flex-col px-[18px] pb-2.5 pt-4 @min-[520px]:px-[22px]">
      <p data-part="focus-sentence" className="text-title font-[640] text-foreground tabular-nums">
        {sentence}
      </p>
      <p data-part="moment-line" className="mt-1.5 text-meta font-[560] text-foreground-secondary tabular-nums">
        {momentLine(t)}
      </p>
      <div className="mt-1">
        {signals.map((signal, i) => (
          <div
            key={signal.id}
            data-signal={signal.id}
            className={cn("flex items-center gap-2.5 py-2.5", i > 0 && "border-t border-border")}
          >
            <span className="shrink-0" style={{ width: label }}>
              <span data-label className="block text-ui font-[560] text-foreground">
                {signal.label}
              </span>
              <span data-meaning className="block text-label leading-4 text-foreground-secondary">
                {SIGNAL_MEANING[signal.id]}
              </span>
            </span>
            <SignalLine
              signal={signal}
              clipS={model.clipS}
              t={t}
              now={bold[signal.id] * 100}
              end={atEnd[signal.id] * 100}
              width={width}
              top={top}
              moving={moving}
            />
            <span
              data-word
              className="ml-auto shrink-0 whitespace-nowrap text-right text-meta font-[560] text-foreground-secondary"
              style={{ width: WORD_W }}
            >
              {restWord(bold[signal.id] * 100, signal.rest)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
});

/**
 * One signal over the clip (`sigLine`): the dashed resting level, the whole curve quiet, the part up
 * to the playhead in ink, a dot at the playhead and, away from rest, a coral line there. At rest the
 * playhead is the clip's end.
 */
function SignalLine({
  signal,
  clipS,
  t,
  now,
  end,
  width: W,
  top,
  moving,
}: {
  signal: BrainSignal;
  clipS: number;
  t: number;
  now: number;
  end: number;
  width: number;
  top: number;
  moving: boolean;
}) {
  const clipId = useId();
  const H = ROW_H;
  const x = (s: number) => xOf(s, clipS, W);
  const y = (v: number) => yOf(v, top);

  const d = useMemo(() => {
    const xs = signal.perSecond.map((_, s) => xOf(s, clipS, W));
    const ys = signal.perSecond.map((v) => yOf(v, top));
    // One value per whole second; a clip that ends between two seconds ends at its last level.
    if (clipS - (signal.perSecond.length - 1) > 0.05) {
      xs.push(xOf(clipS, clipS, W));
      ys.push(yOf(end, top));
    }
    return monotonePath(xs, ys);
  }, [signal, clipS, end, W, top]);

  const px = x(t);
  return (
    <svg aria-hidden="true" width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 overflow-visible">
      <defs>
        <clipPath id={clipId}>
          <rect x={-3} y={-6} width={px + 3} height={H + 12} />
        </clipPath>
      </defs>
      <path
        d={`M0 ${y(signal.rest).toFixed(1)}H${W}`}
        stroke="var(--color-foreground-muted)"
        strokeWidth={1.25}
        strokeDasharray="2 4"
      />
      <path d={d} fill="none" stroke="var(--color-foreground-muted)" strokeWidth={1.5} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke="var(--color-foreground)"
        strokeWidth={2.25}
        strokeLinecap="round"
        clipPath={`url(#${clipId})`}
      />
      {moving && <path data-part="moment-mark" d={`M${f(px)} 0V${H}`} stroke="var(--color-below)" strokeWidth={2} />}
      <circle cx={px} cy={y(now)} r={4} fill="var(--color-foreground)" stroke="var(--color-surface)" strokeWidth={2} />
    </svg>
  );
}

/** A second of the clip across the curve's width. */
const xOf = (s: number, clipS: number, width: number) => (clipS > 0 ? (s / clipS) * width : 0);
/** A level (0 to 100) up the row: `top` at the curve's top, 2 above the bottom at 0 (`sigLine`). */
const yOf = (v: number, top: number) => ROW_H - 2 - (v / top) * (ROW_H - 5);

const f = (n: number) => n.toFixed(1);
```

…followed, unchanged, by `monotonePath` and the `// ── hooks` section (`subscribeTheme`,
`paintedTheme`, `serverTheme`, `usePaintedTheme`) exactly as they are in the file today.

#### Step 4: run, expect a pass

```
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/result/__tests__/brain-panel.test.tsx src/lib/result/__tests__/brain-read.test.ts src/lib/result/__tests__/brain-track.test.ts src/components/result/__tests__/result-page.test.tsx src/components/result/__tests__/result-guard.test.ts --testTimeout 30000
pnpm exec tsc --noEmit
pnpm exec eslint src/components/result/brain-panel.tsx src/components/result/__tests__/brain-panel.test.tsx
```

**Report:** `task-4-report.md`.

---

### Task 5: the simulating screen, option A

**Files.** Rewrite `src/components/result/running.tsx`, `src/components/result/running-ring.tsx` (only
`equalRing` stays), `src/components/result/__tests__/running.test.tsx`. Create
`src/components/result/__tests__/result-motion-guard.test.ts`,
`src/app/(app)/dev/result/__tests__/dev-result.test.tsx`. Modify `src/lib/result/run-progress.ts`
(remove `frameOnScreen` and `FRAME_HOLD_S`), `src/lib/result/__tests__/run-progress.test.ts` (remove
the `frameOnScreen` describe and import), `src/components/result/result-page.tsx` (the running body),
`src/components/result/__tests__/result-page.test.tsx` (the running cases),
`src/components/result/__tests__/simulation-screen.test.tsx`, `src/app/(app)/dev/result/page.tsx`,
`src/app/(app)/dev/result/dev-result.tsx`, `src/app/globals.css` (append). **Must not touch**
`src/components/audience-next/*` (they import `equalRing`: it stays as it is), `audience-ring.tsx`,
`ring-layout.ts`, `use-run-stream.ts` (done in Task 1), the result's parts.

**Consumes:** Task 1 (`cover`, `source`), Task 2 (`FirstCard`, `WideFrame`, `LineFrame`,
`ResultFrame`, `PLOT_PX`, `PHONE_COLUMN`, the fallbacks, `stripHeight`, `STRIP_GAP_PX`, `STRIP_TILE`,
`TILE`, `RADIUS`, `SHADOW`). **Produces:** `RunningPreview` without `arriving`; the keyframes
`result-sweep`, `result-scan`, `result-shimmer`, `result-blink`, `result-settle`; the dev preview's
`cover=`; `data-result="running" | "running-strip"`.

Behaviour (rules 20 to 22): see the component's comment below. The roster stays read (`useRunStream`)
and is drawn nowhere. With reduced motion the band, the scan and the shimmer are not drawn and the clip
does not start by itself; the dots stand still (their class is `motion-safe:` only).

#### Step 1: the failing tests

`src/components/result/__tests__/running.test.tsx`, replaced whole:

```tsx
/** @vitest-environment happy-dom */
/**
 * The running screen, option A (spec section 5): the result's first block building itself, drawn by
 * the result's own layout parts. Stood in for: the browser's EventSource (a small working one that
 * hands out named events), the clock (fake timers), the user's motion setting (matchMedia), the
 * window's width (`innerWidth`), images loading (`load` and `error` events) and the browser's
 * autoplay answer (`play()`). The screen, the stream hook, the reading of the events, the layout parts,
 * the result's own parts (for the comparison) and the query client are real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import early from "@/lib/result/__tests__/fixtures/early.json";
import { queryKeys } from "@/lib/queries/query-keys";
import { forgetRunVideos, rememberRunVideo } from "@/lib/result/run-video";
import { Running } from "../running";
import { VideoResult } from "../video-result";
import { modelOf, renderWithPlayhead } from "./hero-harness";

type Listener = (event: MessageEvent) => void;

class FakeEventSource {
  static readonly CLOSED = 2;
  static opened: FakeEventSource[] = [];
  readyState = 1;
  private listeners = new Map<string, Set<Listener>>();
  constructor(public url: string) {
    FakeEventSource.opened.push(this);
  }
  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }
  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
  send(type: string, data?: unknown) {
    const text = JSON.stringify(data ?? {});
    for (const listener of this.listeners.get(type) ?? []) listener({ data: text } as MessageEvent);
  }
}

const stream = () => FakeEventSource.opened.at(-1)!;
const COVER = "https://p.test/cover.jpg";
const sendFrame = (i: number) =>
  act(() => stream().send("filmstrip_segment_ready", { segment_idx: i, keyframe_uri: `https://f/${i}.jpg` }));
const sendCover = () =>
  act(() => stream().send("source", { cover_url: COVER, handle: "nia.tests", views: 1200, video_url: null }));

const realMatchMedia = window.matchMedia;
/** The user's motion setting, as the browser reports it. */
function prefersReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("no-preference") ? !reduce : reduce,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const realWidth = window.innerWidth;
const setWidth = (value: number) =>
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value });

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const renderRunning = (startedAt: number | null = Date.now()) =>
  render(<Running id="run-1" startedAt={startedAt} />, { wrapper });

const q = (root: ParentNode, selector: string) => root.querySelector<HTMLElement>(selector);
const card = (c: HTMLElement) => q(c, '[data-result="running"]');
const picture = (c: HTMLElement) => q(c, '[data-result="running-picture"]')!;
const shows = (c: HTMLElement) => picture(c).getAttribute("data-shows");
const clock = (c: HTMLElement) => q(c, '[data-result="running-clock"]')!;
const tiles = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-result="running-strip"] [data-tile]')];
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const realPlay = HTMLMediaElement.prototype.play;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-11-20T10:00:00Z") });
  FakeEventSource.opened = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  prefersReducedMotion(false);
  setWidth(393);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.matchMedia = realMatchMedia;
  HTMLMediaElement.prototype.play = realPlay;
  setWidth(realWidth);
  forgetRunVideos();
  client.clear();
});

describe("on a phone: the first card building itself", () => {
  it("just opened: an empty tile with a band of light, the words and the clock, the dotted base with its band, seven empty tiles; nothing else", () => {
    const { container } = renderRunning();
    expect(card(container)).not.toBeNull();
    expect(shows(container)).toBe("none");
    expect(picture(container).querySelector("img, video")).toBeNull();
    expect(q(picture(container), '[data-part="sweep"]')).not.toBeNull();
    expect(q(container, '[data-part="building"]')!.firstElementChild!.textContent).toBe("Building your 1,000 viewers");
    const dots = q(container, '[data-part="dots"]')!;
    expect(dots.children).toHaveLength(3);
    expect(dots.getAttribute("aria-hidden")).toBe("true");
    expect(clock(container).textContent).toBe("0:00");
    // Not announced every second; the page's heading names the screen.
    expect(clock(container).getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector('[role="status"], [aria-live]')).toBeNull();
    expect(q(container, '[data-part="base"]')!.getAttribute("stroke-dasharray")).toBe("1 6");
    expect(q(container, '[data-part="scan"]')).not.toBeNull();
    expect(tiles(container)).toHaveLength(7);
    for (const tile of tiles(container)) {
      expect(tile.querySelector("img")).toBeNull();
      expect(tile.querySelector('[data-part="shimmer"]')).not.toBeNull();
    }
    // The two times' row keeps its place and shows nothing.
    expect(q(card(container)!, '[data-part="times"]')!.textContent).toBe("");
    // No count, no line, no percent: the words are the wait's and the clock's only.
    expect(container.querySelector('[data-result="count"], [data-result="curve"], [data-result="strip"]')).toBeNull();
    expect(container.textContent).toBe("Building your 1,000 viewers0:00");
    // Nothing under the card.
    expect(card(container)!.nextElementSibling).toBeNull();
  });

  it("the clock counts from the run's start", () => {
    const { container } = renderRunning(Date.now() - 42_000);
    expect(clock(container).textContent).toBe("0:42");
    wait(1000);
    expect(clock(container).textContent).toBe("0:43");
  });

  it("without a known start, or with one ahead of this device's clock, it counts from the screen's opening", () => {
    const unknown = renderRunning(null);
    wait(5000);
    expect(clock(unknown.container).textContent).toBe("0:05");
    unknown.unmount();

    const ahead = renderRunning(Date.now() + 60_000);
    wait(5000);
    expect(clock(ahead.container).textContent).toBe("0:05");
  });

  it("the strip fills as the frames arrive: each at its scene, hidden until its picture loaded, then a short fade and settle", () => {
    const { container } = renderRunning();
    sendFrame(2);
    const third = tiles(container)[2]!;
    const img = third.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://f/2.jpg");
    expect(img.getAttribute("alt")).toBe("");
    expect(img.className).toMatch(/\bopacity-0\b/);
    expect(third.hasAttribute("data-filled")).toBe(false);
    expect(third.querySelector('[data-part="shimmer"]')).not.toBeNull();

    fireEvent.load(img);
    expect(third.hasAttribute("data-filled")).toBe(true);
    expect(img.className).toContain("motion-safe:animate-[result-settle_");
    expect(img.className).not.toMatch(/\bopacity-0\b/);
    expect(third.querySelector('[data-part="shimmer"]')).toBeNull();
    for (const i of [0, 1, 3, 4, 5, 6]) expect(tiles(container)[i]!.querySelector("img")).toBeNull();
  });

  it("a frame of a later scene adds tiles up to it", () => {
    const { container } = renderRunning();
    sendFrame(8);
    expect(tiles(container)).toHaveLength(9);
    expect(q(container, '[data-result="running-strip"]')!.getAttribute("data-tiles")).toBe("9");
    expect(tiles(container)[8]!.querySelector("img")!.getAttribute("src")).toBe("https://f/8.jpg");
  });

  it("the strip's tiles are equal and 3 apart, the strip 38 tall on a phone", () => {
    const { container } = renderRunning();
    const strip = q(container, '[data-result="running-strip"]')!;
    expect(strip.style.height).toBe("38px");
    expect(strip.style.gap).toBe("3px");
    for (const tile of tiles(container)) expect(tile.className).toMatch(/\bflex-1\b/);
  });

  it("the tile with no clip and no cover: the first frame that arrived, in scene order; a band of light sweeps down it", () => {
    const { container } = renderRunning();
    sendFrame(3);
    sendFrame(1);
    expect(shows(container)).toBe("frame");
    expect(picture(container).querySelector("img")!.getAttribute("src")).toBe("https://f/1.jpg");
    expect(picture(container).querySelector("img")!.getAttribute("alt")).toBe("");
    expect(q(picture(container), '[data-part="sweep"]')).not.toBeNull();
  });

  it("a link run: the post's cover once the stream names it, before any frame; a cover that cannot load falls through to the frame", () => {
    const { container } = renderRunning();
    sendFrame(0);
    sendCover();
    expect(shows(container)).toBe("cover");
    expect(picture(container).querySelector("img")!.getAttribute("src")).toBe(COVER);
    expect(q(picture(container), '[data-part="sweep"]')).not.toBeNull();

    fireEvent.error(picture(container).querySelector("img")!);
    expect(shows(container)).toBe("frame");
    expect(picture(container).querySelector("img")!.getAttribute("src")).toBe("https://f/0.jpg");
  });

  it("a run this tab started from a file: the creator's own clip, muted, looping, no controls, ahead of a cover or frames; no band over it", () => {
    rememberRunVideo("run-1", "blob:x");
    const { container } = renderRunning();
    const video = picture(container).querySelector("video")!;
    expect(shows(container)).toBe("clip");
    expect(video.getAttribute("src")).toBe("blob:x");
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.hasAttribute("controls")).toBe(false);
    expect(q(picture(container), '[data-part="sweep"]')).toBeNull();

    sendCover();
    sendFrame(0);
    expect(shows(container)).toBe("clip");
    expect(picture(container).querySelector("img")).toBeNull();
  });

  it("a clip that cannot play falls through to the cover, and a cover that cannot load to the frame", () => {
    rememberRunVideo("run-1", "blob:revoked");
    const { container } = renderRunning();
    sendFrame(0);
    sendCover();
    fireEvent.error(picture(container).querySelector("video")!);
    expect(shows(container)).toBe("cover");
    fireEvent.error(picture(container).querySelector("img")!);
    expect(shows(container)).toBe("frame");
  });

  it("a clip the browser will not autoplay falls through too", async () => {
    HTMLMediaElement.prototype.play = () => Promise.reject(Object.assign(new Error("refused"), { name: "NotAllowedError" }));
    rememberRunVideo("run-1", "blob:x");
    const { container } = renderRunning();

    await act(async () => {});

    expect(shows(container)).toBe("none");
    expect(picture(container).querySelector("video")).toBeNull();
  });

  it("with reduced motion: the clip does not start by itself (its first frame shows), and nothing else moves", () => {
    prefersReducedMotion(true);
    const play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.play = play;
    rememberRunVideo("run-1", "blob:x");
    const withClip = renderRunning();
    const video = picture(withClip.container).querySelector("video")!;
    expect(video.autoplay).toBe(false);
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.getAttribute("src")).toMatch(/^blob:x/);
    expect(video.muted).toBe(true);
    expect(play).not.toHaveBeenCalled();
    for (const name of ["sweep", "scan", "shimmer"]) expect(q(withClip.container, `[data-part="${name}"]`)).toBeNull();
    withClip.unmount();

    forgetRunVideos();
    const still = renderRunning();
    expect(shows(still.container)).toBe("none");
    expect(q(still.container, '[data-part="sweep"]')).toBeNull();
  });

  it("every motion is motion-safe", () => {
    const { container } = renderRunning();
    const animated = [...container.querySelectorAll("[class*='animate-']")];
    expect(animated.length).toBeGreaterThan(0);
    for (const el of animated) {
      for (const name of el.getAttribute("class")!.split(/\s+/).filter((c) => c.includes("animate-"))) {
        expect(name).toMatch(/^motion-safe:animate-\[result-/);
      }
    }
  });

  it("the roster is read and drawn nowhere", () => {
    const { container } = renderRunning();
    const before = container.innerHTML;
    act(() => stream().send("roster", { personas: Array.from({ length: 10 }, (_, i) => ({ archetype: `group-${i}` })) }));
    expect(container.innerHTML).toBe(before);
    expect(container.querySelector("[data-wedge], [data-result='running-ring']")).toBeNull();
  });

  it("the finish asks for the stored row again at once", () => {
    const key = queryKeys.analysis.detail("run-1");
    client.setQueryData(key, { id: "run-1" });
    renderRunning();
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);

    act(() => stream().send("complete"));

    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
  });

  it("is ink and greys only, with no percent", () => {
    const { container } = renderRunning(Date.now() - 42_000);
    sendFrame(0);
    sendCover();
    expect(container.textContent).not.toMatch(/%/);
    for (const el of container.querySelectorAll("*")) {
      const look = ["class", "fill", "stroke", "style"].map((name) => el.getAttribute(name) ?? "").join(" ");
      expect(look).not.toMatch(/below|accent|coral/);
    }
  });

  it("leaving leaves no timer running", () => {
    const { unmount } = renderRunning();
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("the dev page's preview replaces the stream, the remembered video and the clock", () => {
    rememberRunVideo("run-1", "blob:x");
    const { container } = render(
      <Running
        id="run-1"
        startedAt={Date.now()}
        preview={{ progress: { groups: null, frames: ["https://f/0.jpg", null], cover: null, done: false }, video: null, elapsed: 42 }}
      />,
      { wrapper },
    );
    expect(FakeEventSource.opened).toHaveLength(0);
    expect(clock(container).textContent).toBe("0:42");
    expect(shows(container)).toBe("frame");
    expect(tiles(container)[0]!.querySelector("img")!.getAttribute("src")).toBe("https://f/0.jpg");
    expect(picture(container).querySelector("video")).toBeNull();
  });

  it("the preview's cover", () => {
    const { container } = render(
      <Running id="run-1" startedAt={Date.now()} preview={{ progress: { groups: null, frames: [], cover: COVER, done: false }, elapsed: 0 }} />,
      { wrapper },
    );
    expect(shows(container)).toBe("cover");
  });
});

describe("on a wide window", () => {
  it("the result's two columns: the large tile with the words under it; the sentence's empty card, the line's card with the base, the band and the strip; no tabs, no panel", () => {
    setWidth(1440);
    const { container } = renderRunning();
    const root = card(container)!;
    const column = q(root, '[data-part="tile-column"]')!;
    expect(column.firstElementChild).toBe(picture(container));
    expect(picture(container).firstElementChild!.className).toMatch(/\brounded-3xl\b/);
    expect(q(column, '[data-part="building"]')).not.toBeNull();
    const sentence = q(root, '[data-result="sentence-card"]')!;
    expect(sentence.children).toHaveLength(0);
    expect(sentence.className).toContain("min-h-[158px]");
    const lineCard = q(root, '[data-part="line-card"]')!;
    expect(q(lineCard, '[data-part="base"]')).not.toBeNull();
    expect(q(lineCard, '[data-part="scan"]')).not.toBeNull();
    expect(q(lineCard, '[data-part="plot"]')!.style.height).toBe("104px");
    expect(q(lineCard, '[data-result="running-strip"]')!.style.height).toBe("46px");
    expect(container.querySelector('[role="tablist"], [role="tabpanel"]')).toBeNull();
    expect(q(root, '[data-part="after"]')).toBeNull();
  });
});

describe("the wait and the result share their boxes", () => {
  const PHONE_BOXES = ["tile-box", "under", "line-box", "line-frame", "plot", "strip-slot", "times"];
  const WIDE_BOXES = ["tile-column", "under", "line-card", "line-frame", "plot", "strip-slot", "times"];
  const boxesOf = (root: Element, names: string[]) =>
    names.map((name) => {
      const el = root.querySelector<HTMLElement>(`[data-part="${name}"]`)!;
      return [name, el.className, el.getAttribute("style")];
    });

  it("on a phone: the first card's boxes are the result's, class for class and size for size", () => {
    const wait = renderRunning();
    const waitCard = card(wait.container)!;
    const waited = {
      card: waitCard.className,
      boxes: boxesOf(waitCard, PHONE_BOXES),
      tile: picture(wait.container).className,
      strip: q(waitCard, '[data-result="running-strip"]')!.style.height,
    };
    wait.unmount();

    const model = modelOf(early, { frames: true });
    const result = renderWithPlayhead(model, <VideoResult model={model} />);
    const hero = q(result.container, '[data-result="hero"]')!;
    expect(hero.className).toBe(waited.card);
    expect(boxesOf(hero, PHONE_BOXES)).toEqual(waited.boxes);
    expect(q(hero, '[data-result="video"]')!.className).toBe(waited.tile);
    expect(q(hero, '[data-result="strip"]')!.style.height).toBe(waited.strip);
  });

  it("on a wide window: the columns, the sentence's card and the line's card are the result's", () => {
    setWidth(1440);
    const wait = renderRunning();
    const root = card(wait.container)!;
    const waited = {
      grid: q(root, '[data-part="tile-column"]')!.parentElement!.className,
      sentence: q(root, '[data-result="sentence-card"]')!.className,
      boxes: boxesOf(root, WIDE_BOXES),
      tile: picture(wait.container).className,
    };
    wait.unmount();

    const model = modelOf(early, { frames: true });
    const result = renderWithPlayhead(model, <VideoResult model={model} />);
    const column = q(result.container, '[data-part="tile-column"]')!;
    expect(column.parentElement!.className).toBe(waited.grid);
    expect(q(result.container, '[data-result="sentence-card"]')!.className).toBe(waited.sentence);
    expect(boxesOf(column.parentElement!.parentElement!, WIDE_BOXES)).toEqual(waited.boxes);
    expect(q(column, '[data-result="video"]')!.className).toBe(waited.tile);
  });
});
```

`src/components/result/__tests__/result-motion-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// The result page's motion: every animation it names is one of its own `result-` keyframes, defined
// in globals.css outside `@theme`, and every one is behind `motion-safe:`, so with reduced motion
// nothing moves by itself. PURE FS test (default `node` env).
// ─────────────────────────────────────────────────────────────────────────────

const RESULT = join(__dirname, "..");
const CSS = readFileSync(join(__dirname, "../../../app/globals.css"), "utf8");
const FILES = readdirSync(RESULT, { withFileTypes: true })
  .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
  .map((e) => e.name);
const source = (file: string) => readFileSync(join(RESULT, file), "utf8");

/** The block that starts at `opener` (its braces matched), or "" when there is none. */
function block(css: string, opener: string): string {
  const start = css.indexOf(opener);
  if (start < 0) return "";
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  return css.slice(start);
}

const named = new Set(FILES.flatMap((file) => [...source(file).matchAll(/animate-\[(result-[a-z-]+)_/g)].map((m) => m[1]!)));

describe("result page: motion", () => {
  it("names its own keyframes (guards against a walker that matches nothing)", () => {
    expect(named.size).toBeGreaterThan(0);
  });

  it.each([...named])("%s is defined in globals.css, outside @theme", (name) => {
    expect(block(CSS, `@keyframes ${name} {`)).not.toBe("");
    expect(block(CSS, "@theme {")).not.toContain(`@keyframes ${name}`);
  });

  it.each(FILES)("%s: every animation and animation delay is motion-safe", (file) => {
    const src = source(file);
    for (const m of src.matchAll(/(\S*)animate-\[/g)) expect(m[1]).toMatch(/motion-safe:$/);
    for (const m of src.matchAll(/(\S*)\[animation-delay:/g)) expect(m[1]).toMatch(/motion-safe:$/);
  });
});
```

`src/app/(app)/dev/result/__tests__/dev-result.test.tsx`:

```tsx
/** @vitest-environment happy-dom */
/**
 * The dev page's running moments (`/dev/result?processing=1&…`): what the preview hands the running
 * screen. Real: the dev page's client part, the result page, the running screen, the query client.
 * Stand-ins: the router and the window's width.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dev/result",
}));

import early from "@/lib/result/__tests__/fixtures/early.json";
import type { ResultRow } from "@/lib/result/types";
import { DevResult } from "../dev-result";

const realWidth = window.innerWidth;
const setWidth = (value: number) =>
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value });

let client: QueryClient;
const renderDev = (props: Partial<ComponentProps<typeof DevResult>> = {}) =>
  render(
    <QueryClientProvider client={client}>
      <DevResult
        row={structuredClone(early) as unknown as ResultRow}
        frames="https://frames.test/run"
        video={null}
        processing
        t={undefined}
        simulateAgain={false}
        run={{ own: false, elapsed: 42 }}
        {...props}
      />
    </QueryClientProvider>,
  );

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  setWidth(393);
});
afterEach(() => {
  client.clear();
  setWidth(realWidth);
  vi.useRealTimers();
});

describe("the dev page's running moment", () => {
  it("cover= is the post's cover the stream named", () => {
    const { container } = renderDev({ run: { own: false, cover: "https://p.test/cover.jpg", elapsed: 42 } });
    const picture = container.querySelector('[data-result="running-picture"]')!;
    expect(picture.getAttribute("data-shows")).toBe("cover");
    expect(picture.querySelector("img")!.getAttribute("src")).toBe("https://p.test/cover.jpg");
    expect(container.querySelector('[data-result="running-clock"]')!.textContent).toBe("0:42");
  });

  it("runframes= fills that many tiles of the strip, from the frames' base", () => {
    const { container } = renderDev({ run: { own: false, frames: 3, elapsed: 0 } });
    const srcs = [...container.querySelectorAll('[data-result="running-strip"] img')].map((img) => img.getAttribute("src"));
    expect(srcs).toEqual(["https://frames.test/run/0.jpg", "https://frames.test/run/1.jpg", "https://frames.test/run/2.jpg"]);
  });
});
```

`src/lib/result/__tests__/run-progress.test.ts`: delete the whole `describe("frameOnScreen", …)` block
and `frameOnScreen,` from the import.

`src/components/result/__tests__/result-page.test.tsx`, inside `describe("running")`: delete the
`FakeResizeObserver` class, its comment and its `beforeEach` (the screen measures no stage now); move
`const body = (c: HTMLElement) => c.querySelector<HTMLElement>("[data-result-body]");` to the top of
the describe (and delete its later line); replace the first two tests with:

```tsx
  it("shows the running screen, the result's first block building itself, and names the screen 'Simulating'", () => {
    const { container } = renderPage({ kind: "running", id: "run-1", startedAt: null });
    expect(container.querySelector('[data-result="running"]')).not.toBeNull();
    expect(useShellStore.getState().pushedTitle).toBe("Simulating");
    // On desktop the page's heading names it (the phone's is the shell's pushed header).
    expect(screen.getByRole("heading", { level: 1, name: "Simulating" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/%/);
    // A block in the page's flow, as the result is: no stage stretched to the screen's height.
    expect(body(container)!.className).not.toMatch(/flex-col/);
  });

  it("another run starts fresh: its own stream, and none of the frames of the run before", () => {
    type Listener = (event: MessageEvent) => void;
    const opened: Array<{ url: string; listeners: Map<string, Listener[]> }> = [];
    vi.stubGlobal(
      "EventSource",
      class {
        listeners = new Map<string, Listener[]>();
        constructor(public url: string) {
          opened.push(this);
        }
        addEventListener(type: string, listener: Listener) {
          this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
        }
        removeEventListener() {}
        close() {}
      },
    );
    const frame = JSON.stringify({ segment_idx: 0, keyframe_uri: "https://f/0.jpg" });
    const sendFrame = () =>
      act(() => opened.at(-1)!.listeners.get("filmstrip_segment_ready")!.forEach((l) => l({ data: frame } as MessageEvent)));
    const filled = (c: HTMLElement) => c.querySelectorAll('[data-result="running-strip"] img').length;

    const { container, rerender } = renderPage({ kind: "running", id: "run-1", startedAt: null });
    sendFrame();
    expect(filled(container)).toBe(1);

    rerender(<ResultPage state={{ kind: "running", id: "run-2", startedAt: null }} />);
    expect(opened.at(-1)!.url).toBe("/api/analyze/run-2/stream");
    expect(filled(container)).toBe(0);
  });
```

`src/components/result/__tests__/simulation-screen.test.tsx`: in the header comment replace "the stage's
measured size (ResizeObserver)" with "the line's measured width (ResizeObserver)"; replace the first
test with:

```tsx
  it("shows the running screen, the frames as they arrive, and turns into the result at the finish", async () => {
    const { container } = render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <SimulationScreen id="fixture-early" />
        </ToastProvider>
      </QueryClientProvider>,
    );
    const running = () => container.querySelector('[data-result="running"]');
    const filled = () => container.querySelectorAll('[data-result="running-strip"] img').length;

    // The row answers in flight: the running screen, listening to this run's stream.
    await waitFor(() => expect(running()).not.toBeNull());
    expect(stream().url).toBe("/api/analyze/fixture-early/stream");
    expect(filled()).toBe(0);

    // The roster is read and drawn nowhere; a frame fills its tile.
    act(() => stream().send("roster", roster));
    act(() => stream().send("filmstrip_segment_ready", { segment_idx: 0, keyframe_uri: "https://f/0.jpg" }));
    await waitFor(() => expect(filled()).toBe(1));

    // The finish: the stream says so and the row, asked for again, has finished.
    const asked = fetchMock.mock.calls.length;
    finished = true;
    act(() => stream().send("complete"));

    await waitFor(() =>
      expect(container.querySelector('[data-result="count"]')).toHaveTextContent("461 of 1,000 watched to the end"),
    );
    expect(fetchMock.mock.calls.length).toBeGreaterThan(asked);
    expect(FakeEventSource.opened.every((source) => source.readyState === FakeEventSource.CLOSED)).toBe(true);
    expect(running()).toBeNull();
  });
```

and in "says nothing it does not know while it asks again, then shows the result" replace
`'[data-result="running-ring"]'` with `'[data-result="running"]'`.

#### Step 2: run, expect failures

```
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/result src/lib/result "src/app/(app)/dev/result" --testTimeout 30000
```

Expected: `running.test.tsx` fails throughout (a ring, no `running` card); `result-motion-guard.test.ts`
fails "names its own keyframes" (none named yet); `dev-result.test.tsx` fails (no cover, no
`running-strip`); the rewritten result-page and simulation-screen tests fail on `[data-result="running"]`
and the running body's `flex-col`. Everything else passes.

#### Step 3: the implementation

`src/components/result/running.tsx`, replaced whole:

```tsx
"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useIsMobileHydrated } from "@/hooks/useIsMobile";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { queryKeys } from "@/lib/queries/query-keys";
import { timecode } from "@/lib/result/format";
import { NO_PROGRESS, arrivedFrames, elapsedSeconds, type RunProgress } from "@/lib/result/run-progress";
import { runVideoOf } from "@/lib/result/run-video";
import { cn } from "@/lib/utils";
import {
  FirstCard,
  LineFrame,
  PHONE_COLUMN,
  PHONE_LINE_FALLBACK,
  PLOT_PX,
  ResultFrame,
  STRIP_GAP_PX,
  STRIP_TILE,
  WIDE_LINE_FALLBACK,
  WideFrame,
  stripHeight,
} from "./first-block";
import { RADIUS, SHADOW, TILE } from "./player";
import { useContentWidth } from "./use-content-width";
import { useRunStream } from "./use-run-stream";

/**
 * What the dev page and the tests hand the screen instead of the live run: the stream's progress,
 * the creator's own video (null for none) and the seconds on the clock.
 */
export interface RunningPreview {
  progress?: RunProgress;
  video?: string | null;
  elapsed?: number;
}

/** The strip's tiles before the scenes are known: seven, as drawn; more once a frame names a later scene. */
const WAIT_TILES = 7;
/** Where the dotted base runs in the plot while the line is not known yet, as drawn. */
const WAIT_BASE_Y = 30;

// The wait's motion (keyframes `result-*` in globals.css). Every class is `motion-safe:`, and the parts
// that only move are not drawn at all with reduced motion: then nothing moves by itself.
/** A band of light down the tile, while it shows a still or nothing. */
const SWEEP = "motion-safe:animate-[result-sweep_2.8s_cubic-bezier(0.4,0,0.2,1)_infinite]";
/** A quiet band of light across the plot. */
const SCAN = "motion-safe:animate-[result-scan_2.2s_linear_infinite]";
/** An empty strip tile's shimmer. */
const SHIMMER = "motion-safe:animate-[result-shimmer_1.6s_ease-in-out_infinite]";
/** A strip tile's frame once its picture has loaded: a short fade and settle. */
const SETTLE = "motion-safe:animate-[result-settle_0.7s_cubic-bezier(0.2,0.8,0.2,1)_both]";
/** The three dots after the words, blinking in turn. */
const BLINK = "motion-safe:animate-[result-blink_1.2s_ease-in-out_infinite]";
const BLINK_DELAYS = ["", "motion-safe:[animation-delay:200ms]", "motion-safe:[animation-delay:400ms]"] as const;

/** The time, read again every second while `ticking`. */
function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}

/**
 * The creator's own video: decoration that plays by itself, not the page's playhead, no controls, no
 * sound. With reduced motion it does not start by itself: its first frame shows. When it cannot play
 * (a revoked or expired address, autoplay refused) the tile falls through to what comes next.
 */
function RunVideo({ src, still, onFail }: { src: string; still: boolean; onFail: (src: string) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (still) return;
    const playing = ref.current?.play();
    if (!playing) return;
    playing.catch((error: unknown) => {
      // An interrupted load is not a refusal.
      if ((error as { name?: string } | null)?.name !== "AbortError") onFail(src);
    });
  }, [src, still, onFail]);
  return (
    <video
      ref={ref}
      // Still: `#t=0.001` makes Safari paint the first frame instead of a black box.
      src={still ? `${src}#t=0.001` : src}
      muted
      autoPlay={!still}
      preload={still ? "metadata" : undefined}
      loop
      playsInline
      onError={() => onFail(src)}
      className="block h-full w-full object-cover"
    />
  );
}

/**
 * A still filling the tile: the post's cover or a scene frame, drawn as the app draws a post's cover
 * (a plain image with an empty alt that reports a failed load), so a picture that cannot load falls
 * through to the next.
 */
function Still({ src, onFail }: { src: string; onFail: (src: string) => void }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a cover or a stored frame's address (it can expire); next/image has nothing to optimise
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      onError={() => onFail(src)}
      className="absolute inset-0 block h-full w-full object-cover"
    />
  );
}

/**
 * The tile where the result's video will stand, its size and corner. It shows the creator's own clip,
 * else the post's cover, else the first scene frame that arrived, else nothing (a sunken tile). A band
 * of light sweeps down it while it shows a still or nothing, never over the playing clip, and never
 * with reduced motion.
 */
const RunningTile = memo(function RunningTile({
  video,
  cover,
  frame,
  size,
  still,
  onFail,
}: {
  video: string | null;
  cover: string | null;
  frame: string | null;
  size: "hero" | "desktop";
  still: boolean;
  onFail: (src: string) => void;
}) {
  const shows = video ? "clip" : cover ? "cover" : frame ? "frame" : "none";
  return (
    <div data-result="running-picture" data-shows={shows} className={cn(TILE, "w-full")}>
      <div
        className={cn(
          "absolute inset-0 overflow-hidden bg-surface-sunken",
          RADIUS[size],
          shows === "none" ? "shadow-[inset_0_0_0_1px_var(--color-border)]" : SHADOW[size],
        )}
      >
        {video ? (
          <RunVideo key={video} src={video} still={still} onFail={onFail} />
        ) : cover ? (
          <Still key={cover} src={cover} onFail={onFail} />
        ) : frame ? (
          <Still key={frame} src={frame} onFail={onFail} />
        ) : null}
        {!video && !still && (
          // White over a picture, as the play mark on footage: a band of light whichever the theme.
          <span
            data-part="sweep"
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 top-[-40%] h-[38%] bg-linear-to-b from-transparent via-white/20 to-transparent",
              SWEEP,
            )}
          />
        )}
      </div>
    </div>
  );
});

/** Where the count will stand: the words, three dots in turn and the time since the start. */
function BuildingLine({ elapsed }: { elapsed: number }) {
  return (
    <p data-part="building" className="flex flex-wrap items-baseline justify-center gap-x-2 text-center">
      <span className="text-title font-[640] text-foreground">
        Building your 1,000 viewers
        <span data-part="dots" aria-hidden="true" className="ml-0.5 inline-flex gap-[3px]">
          {BLINK_DELAYS.map((delay, i) => (
            <i key={i} className={cn("block size-1 rounded-full bg-current", BLINK, delay)} />
          ))}
        </span>
      </span>
      {/* Not announced every second; the page's heading names the screen. */}
      <span data-result="running-clock" aria-hidden="true" className="text-ui text-foreground-secondary tabular-nums">
        {timecode(elapsed)}
      </span>
    </p>
  );
}

/** Where the line will be: a dotted base with a quiet band of light passing over it. */
function WaitPlot({ width, height, still }: { width: number; height: number; still: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" aria-hidden="true">
        <path
          data-part="base"
          d={`M0 ${WAIT_BASE_Y}H${width}`}
          fill="none"
          stroke="var(--color-foreground)"
          strokeOpacity={0.16}
          strokeWidth={2}
          strokeDasharray="1 6"
          strokeLinecap="round"
        />
      </svg>
      {!still && (
        <span
          data-part="scan"
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-[-60px] w-[60px] bg-linear-to-r from-transparent via-foreground/[0.07] to-transparent",
            SCAN,
          )}
        />
      )}
    </div>
  );
}

/** One tile of the wait's strip: it shimmers while empty and takes its scene's frame once it has loaded. */
function WaitTile({ frame, still }: { frame: string | null; still: boolean }) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const shown = frame !== null && loaded === frame;
  return (
    <div data-tile="" data-filled={shown ? "" : undefined} className={cn("relative min-w-0 flex-1 overflow-hidden", STRIP_TILE)}>
      {!shown && !still && (
        // The card's own surface passing over the sunken tile: a shimmer in either theme, from tokens.
        <span
          data-part="shimmer"
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-linear-to-r from-transparent from-30% via-surface via-50% to-transparent to-70%",
            SHIMMER,
          )}
        />
      )}
      {frame && (
        // eslint-disable-next-line @next/next/no-img-element -- a stored frame's signed address
        <img
          src={frame}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(frame)}
          className={cn("absolute inset-0 block h-full w-full object-cover object-[50%_14%]", shown ? SETTLE : "opacity-0")}
        />
      )}
    </div>
  );
}

/**
 * The strip while the scenes are not known: equal tiles, seven or as many as the latest frame names,
 * each filled with its scene's frame as it arrives.
 */
function WaitStrip({ frames, width, still }: { frames: ReadonlyArray<string | null>; width: number; still: boolean }) {
  const count = Math.max(WAIT_TILES, frames.length);
  return (
    <div
      data-result="running-strip"
      data-tiles={count}
      className="flex"
      style={{ width, height: stripHeight(width), gap: STRIP_GAP_PX }}
    >
      {Array.from({ length: count }, (_, i) => (
        <WaitTile key={i} frame={frames[i] ?? null} still={still} />
      ))}
    </div>
  );
}

/** The line's place in the result's own frame: the plot waiting, the strip filling, the times' row empty. */
function WaitLine({ width, height, frames, still }: { width: number; height: number; frames: ReadonlyArray<string | null>; still: boolean }) {
  return (
    <LineFrame
      width={width}
      height={height}
      plot={<WaitPlot width={width} height={height} still={still} />}
      strip={<WaitStrip frames={frames} width={width} still={still} />}
      times={null}
    />
  );
}

interface WaitParts {
  tile: React.ReactNode;
  under: React.ReactNode;
  frames: ReadonlyArray<string | null>;
  still: boolean;
}

/** Phone: the first card, nothing under it. */
function PhoneWait({ tile, under, frames, still }: WaitParts) {
  const [cardRef, width] = useContentWidth<HTMLDivElement>(PHONE_LINE_FALLBACK);
  return (
    <div className={PHONE_COLUMN}>
      <FirstCard
        name="running"
        cardRef={cardRef}
        tile={tile}
        under={under}
        line={<WaitLine width={width} height={PLOT_PX.phone} frames={frames} still={still} />}
      />
    </div>
  );
}

/** Wide window: the result's two columns; the sentence's card empty, no tabs, no panel. */
function WideWait({ tile, under, frames, still }: WaitParts) {
  const [lineCard, width] = useContentWidth<HTMLDivElement>(WIDE_LINE_FALLBACK);
  return (
    <WideFrame
      name="running"
      tile={tile}
      under={under}
      first={null}
      lineCardRef={lineCard}
      line={<WaitLine width={width} height={PLOT_PX.wide} frames={frames} still={still} />}
    />
  );
}

/** The screen itself, from what is known about the run so far. */
function RunningScreen({
  progress,
  video: givenVideo,
  startedAt,
  elapsed: fixedElapsed,
}: {
  progress: RunProgress;
  video: string | null;
  startedAt: number | null;
  elapsed?: number;
}) {
  const { isMobile, hydrated } = useIsMobileHydrated();
  const still = usePrefersReducedMotion();

  const [openedAt] = useState(() => Date.now());
  const now = useNow(fixedElapsed === undefined);
  // A start this device does not know, or one ahead of its clock, counts from the screen's opening.
  const origin = startedAt !== null && startedAt <= openedAt ? startedAt : openedAt;
  const elapsed = fixedElapsed ?? elapsedSeconds(origin, now);

  // What failed to load falls through to the next: the clip, the cover, the first frame, nothing.
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const onFail = useCallback(
    (src: string) => setFailed((prev) => (prev.has(src) ? prev : new Set(prev).add(src))),
    [],
  );
  const usable = (src: string | null) => (src !== null && !failed.has(src) ? src : null);
  const video = usable(givenVideo);
  const cover = video ? null : usable(progress.cover);
  const frame = video || cover ? null : (arrivedFrames(progress).find((src) => !failed.has(src)) ?? null);

  // Before the viewport is measured: the result's empty frame, so the clip mounts once, in its layout.
  if (!hydrated) return <ResultFrame />;

  const parts: WaitParts = {
    tile: (
      <RunningTile
        video={video}
        cover={cover}
        frame={frame}
        size={isMobile ? "hero" : "desktop"}
        still={still}
        onFail={onFail}
      />
    ),
    under: <BuildingLine elapsed={elapsed} />,
    frames: progress.frames,
    still,
  };
  return isMobile ? <PhoneWait {...parts} /> : <WideWait {...parts} />;
}

/** The live run: its own stream; at the finish the stored row is asked for at once. */
function LiveRunning({ id, startedAt }: { id: string; startedAt: number | null }) {
  const client = useQueryClient();
  const progress = useRunStream(id, () => {
    void client.invalidateQueries({ queryKey: queryKeys.analysis.detail(id) });
  });
  return <RunningScreen progress={progress} video={runVideoOf(id)} startedAt={startedAt} />;
}

/**
 * A video simulation still in flight (spec section 5, option A): the result's first block building
 * itself, drawn by the result's own layout parts (`first-block.tsx`), so the result takes its place
 * without a jump. The tile shows the creator's own clip (a run this tab started from a file), else the
 * post's cover once the stream names it, else the first scene frame that arrived, else nothing; under
 * it "Building your 1,000 viewers" and the time since the start; where the line will be, a dotted base
 * with a band of light passing; the strip's tiles fill with the scenes' frames as they arrive. No
 * count, no line, no percent: the stream carries none. The roster is read, not drawn. The row keeps
 * polling (useSimulationRow); the stream's finish asks for it at once, and the page turns into the
 * result.
 *
 * `preview` is for the dev page and tests only: it replaces the stream, the remembered video and the
 * clock.
 */
export function Running({ id, startedAt, preview }: { id: string; startedAt: number | null; preview?: RunningPreview }) {
  if (!preview) return <LiveRunning id={id} startedAt={startedAt} />;
  return (
    <RunningScreen
      progress={preview.progress ?? NO_PROGRESS}
      video={preview.video ?? null}
      startedAt={startedAt}
      elapsed={preview.elapsed}
    />
  );
}
```

`src/components/result/running-ring.tsx`, replaced whole (`audience-next/building-view.tsx` and
`ring-card.tsx` import `equalRing`; nothing else in this file has a user left):

```tsx
"use client";

import type { Archetype } from "@/lib/engine/wave3/persona-registry";
import { ringDots, type RingLayout } from "@/lib/result/ring-layout";

/**
 * A ring of equal wedges of dots, laid out by the same `ringDots` as the result's audience ring. The
 * audience pages draw their building ring and their card with it.
 */

/** A ring of equal wedges, and the radius of its innermost row of dots. */
export interface EqualRing {
  layout: RingLayout;
  innerRow: number;
}

const rings = new Map<string, EqualRing>();

/** `groups` equal wedges of `n` dots between `r1` and `R`; laid out once per size and count. */
export function equalRing(groups: number, r1: number, R: number, n: number): EqualRing {
  const key = `${groups}:${r1}:${R}:${n}`;
  let ring = rings.get(key);
  if (!ring) {
    // The ring only counts the groups; a wedge is named by its place.
    const wedges = Array.from({ length: groups }, (_, i) => ({ group: String(i) as Archetype, weight: 1, present: true }));
    const layout = ringDots(wedges, { r1, R, n });
    const rows = 1 + layout.wedges.reduce((most, wedge) => wedge.dots.reduce((m, dot) => Math.max(m, dot.row), most), 0);
    ring = { layout, innerRow: r1 + (R - r1) / (2 * rows) };
    rings.set(key, ring);
  }
  return ring;
}
```

`src/lib/result/run-progress.ts`: delete `FRAME_HOLD_S` and `frameOnScreen` (from
`/** How long one frame stays in the centre before the next takes its place. */` to the end of the file).

`src/components/result/result-page.tsx`:

1. The root's comment `// A column as tall as what the shell leaves: the running screen fills the rest under the header.`
   becomes `// A column as tall as what the shell leaves.`
2. The body: delete the two comment lines `// Only the running screen lays out as a column (its stage takes the rest of the height);`
   and `// the other bodies stay blocks, so a centred column such as NoAudience keeps its width.`, and
   `className={cn("flex-1", state.kind === "running" && "flex flex-col", arrived && ARRIVAL_FADE)}` becomes
   `className={cn("flex-1", arrived && ARRIVAL_FADE)}`.
3. The `case "running":` comment `// Keyed by the run: another run starts with its own clock, wedges and picture.`
   becomes `// Keyed by the run: another run starts with its own clock, tile and strip.`

`src/app/(app)/dev/result/page.tsx`: the doc comment's usage and running parameters become:

```
 *   /dev/result?fixture=<name>[&frames=<base>][&video=<url>][&processing=1][&t=<seconds>][&again=1]
 *              [&runframes=<n>][&own=1][&cover=<url>][&elapsed=<seconds>]
```

```
 * - processing=1: the run is still in flight, started `elapsed` seconds ago (now when not given).
 *   The running screen shows a moment built from the parameters below instead of listening to the
 *   run's stream (none given: just opened, no frames, no cover, the clock counting):
 *   - runframes: n scene frames have arrived, `<frames base>/<i>.jpg` as `frames` gives them
 *   - own=1: the `video` address plays as the creator's own video (a run this tab started)
 *   - cover: the post's cover the stream named (a link run)
 *   - elapsed: the clock stands at these seconds (it does not count, so a shot is stable)
```

and the `run` prop becomes:

```tsx
      run={{
        frames: count(one(params.runframes)),
        own: one(params.own) === "1",
        cover: one(params.cover),
        elapsed: count(one(params.elapsed)),
      }}
```

`src/app/(app)/dev/result/dev-result.tsx`: `DevRun` becomes

```tsx
/** The running screen's moment, from the dev page's parameters (see page.tsx). */
export interface DevRun {
  frames?: number;
  own: boolean;
  cover?: string;
  elapsed?: number;
}
```

and `runningPreview` returns

```tsx
  return {
    progress: { groups: null, frames: arrived, cover: run.cover ?? null, done: false },
    video: run.own ? video : null,
    elapsed: run.elapsed,
  };
```

`src/app/globals.css`, appended at the end of the file:

```css
/* ── Result page (new look): the running screen ───────────────────────────────
   The screen shown while a video simulates (src/components/result/running.tsx). Every class that
   names one is `motion-safe:`; with reduced motion the parts that only move are not drawn. */

/* A band of light down the tile while it shows a still or nothing. */
@keyframes result-sweep {
  from {
    top: -40%;
  }
  to {
    top: 105%;
  }
}

/* A quiet band of light across the plot, where the line will be. */
@keyframes result-scan {
  from {
    left: -60px;
  }
  to {
    left: 100%;
  }
}

/* An empty strip tile's shimmer. */
@keyframes result-shimmer {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(100%);
  }
}

/* The three dots after "Building your 1,000 viewers", in turn. */
@keyframes result-blink {
  0%,
  60%,
  100% {
    opacity: 0.2;
  }
  30% {
    opacity: 1;
  }
}

/* A strip tile's frame arriving: a short fade and settle. */
@keyframes result-settle {
  from {
    opacity: 0;
    transform: scale(1.15);
  }
  70% {
    opacity: 1;
  }
  to {
    opacity: 1;
    transform: none;
  }
}
```

#### Step 4: run, expect a pass

```
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/result src/lib/result "src/app/(app)/dev/result" src/components/audience-next src/app/__tests__/design-token-drift.test.ts src/app/__tests__/next-look-contrast.test.ts --testTimeout 30000
pnpm exec tsc --noEmit
pnpm exec eslint src/components/result/running.tsx src/components/result/running-ring.tsx src/components/result/result-page.tsx src/lib/result/run-progress.ts "src/app/(app)/dev/result/page.tsx" "src/app/(app)/dev/result/dev-result.tsx" src/components/result/__tests__/running.test.tsx src/components/result/__tests__/result-motion-guard.test.ts src/components/result/__tests__/result-page.test.tsx src/components/result/__tests__/simulation-screen.test.tsx src/lib/result/__tests__/run-progress.test.ts "src/app/(app)/dev/result/__tests__/dev-result.test.tsx"
```

`src/components/audience-next` runs because it imports `equalRing`; the two `src/app/__tests__` guards
because `globals.css` changed. **Rule 28, in the report:** removed `RunningRing`, `arrivalOrder`, the
ring sizing (`SMALL`, `LARGE`, `figureFor`, `useStageBox`, `Figure`, `useArrival`, `Frames`,
`Picture`), `frameOnScreen`, `FRAME_HOLD_S`, `RunningPreview.arriving`, the dev page's `groups` and
`arriving`; prove each with `grep -rn "<name>" src` (no hit left but this plan's names in comments).
`equalRing`, `EqualRing`, `arrivedFrames`, `elapsedSeconds`, `circles` (now unused here, still used by
`audience-panel.tsx`, `text-result.tsx`, `audience-next`, `thread-next/answer-gauge.tsx`) stay.
**Report:** `task-5-report.md`.

---

### Task 6: the landing

**Files.** Create `src/components/result/landing.tsx`. Modify `src/components/result/viewer-count.tsx`,
`curve.tsx`, `hero.tsx`, `video-result.tsx`, `result-page.tsx`, `src/app/globals.css` (append),
`src/app/(app)/dev/result/page.tsx`, `dev-result.tsx`; tests: `viewer-count.test.tsx`, `curve.test.tsx`
(a describe added; nothing in it changes), `result-motion-guard.test.ts`, `result-page.test.tsx`,
`src/app/(app)/dev/result/__tests__/dev-result.test.tsx`. **Must not touch** `player.tsx` (rule 26:
after the landing the tile is the result's own player at rest, as today), `running.tsx`, the panels.

**Consumes:** `ROLL_MS`, `VIEWERS`, `rolledAt` (Task 1); the parts of Tasks 2 and 5. **Produces:**
`landing.tsx` as in the contracts; `Curve`'s `enter`; `data-landing`; the keyframes `result-draw`,
`result-fade`; the dev preview's `land=`.

Behaviour (rule 25, and "How the landing reaches the parts" above): only when a run turns into its
result while the page is open, and motion is allowed: the count rolls 1,000 → its value in 1.5 s
(ease-out; the final value in an `sr-only` span from the first frame, the rolling number
`aria-hidden`); the line draws itself in 1.5 s; the named stretch's coral and its band fade in after
0.5 s; the fill and the ticks after 0.9 s; the strip at once; outside the first block (phone: "After
posting", the moment, the switch, the panel; wide window: the sentence inside its card, "After
posting", the switch and the panel; the line's card was there while waiting and stays, its line draws)
after 0.9 s. A playhead move during the roll ends it. 2 s after the arrival the classes leave for good.
The whole-body fade now applies to a run that ends with no audience only. With reduced motion, and for
a result opened directly, everything is there at once.

#### Step 1: the failing tests

`src/components/result/__tests__/viewer-count.test.tsx`: add `afterEach, beforeEach, vi` to the
`vitest` import, `import { LandingProvider } from "../landing";`, and at the end:

```tsx
describe("ViewerCount: the landing", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "Date", "setTimeout", "clearTimeout"] });
  });
  afterEach(() => vi.useRealTimers());

  const landed = (fixture: unknown, landing = true) => {
    const model = modelOf(fixture);
    return renderWithPlayhead(
      model,
      <LandingProvider value={landing}>
        <ViewerCount audience={model.audience} />
      </LandingProvider>,
    );
  };
  const frames = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it("rolls from 1,000 to the count in 1.5 s, ease-out; a screen reader has the count from the first frame", () => {
    const { container } = landed(early);
    expect(part(container, "count-number").textContent).toBe("1,000");
    expect(part(container, "count-number").getAttribute("aria-hidden")).toBe("true");
    expect(count(container).querySelector(".sr-only")!.textContent).toBe("461");
    expect(part(container, "count-words").textContent).toBe("of 1,000 watched to the end");

    frames(750);
    const halfway = Number(part(container, "count-number").textContent!.replace(/,/g, ""));
    // Ease-out: well past half the way (730) at half the time.
    expect(halfway).toBeLessThan(600);
    expect(halfway).toBeGreaterThan(461);

    frames(800);
    expect(part(container, "count-number").textContent).toBe("461");
    expect(part(container, "count-number").hasAttribute("aria-hidden")).toBe(false);
    expect(count(container).querySelector(".sr-only")).toBeNull();
    expect(count(container)).toHaveTextContent("461 of 1,000 watched to the end");
  });

  it("the video moving during the roll ends it: the count follows the playhead at once", () => {
    const { container } = landed(early);
    frames(300);
    act(() => playhead.current.seek(7));
    expect(count(container)).toHaveTextContent("562 of 1,000 still watching");
    expect(count(container).querySelector(".sr-only")).toBeNull();
  });

  it("without the landing the count is there at once", () => {
    const { container } = landed(early, false);
    expect(part(container, "count-number").textContent).toBe("461");
    expect(count(container).querySelector(".sr-only, [aria-hidden]")).toBeNull();
  });
});
```

`src/components/result/__tests__/curve.test.tsx`: add `import { LAND } from "../landing";` and at the end:

```tsx
describe("entering (the landing)", () => {
  it("off by default: the line is not dashed and nothing carries a landing class", () => {
    const { part, container } = mountCurve(modelOf(early, { frames: true }));
    expect(part("line")!.hasAttribute("pathLength")).toBe(false);
    expect(part("line")!.hasAttribute("stroke-dasharray")).toBe(false);
    expect(container.innerHTML).not.toContain("animate-[result-");
  });

  it("entering: the line draws itself, its coral and band come in after 0.5 s, the fill and ticks after 0.9 s, the strip at once; the rest as at rest", () => {
    const model = modelOf(early, { frames: true });
    const view = renderWithPlayhead(model, <Curve model={model} width={W} height={H} strip enter />);
    const part = (name: string) => view.container.querySelector(`[data-part="${name}"]`)!;
    expect(part("line").getAttribute("pathLength")).toBe("1");
    expect(part("line").getAttribute("stroke-dasharray")).toBe("1");
    expect(part("line").getAttribute("class")).toBe(LAND.draw);
    expect(part("loss").getAttribute("class")).toBe(LAND.coral);
    expect(part("band").getAttribute("class")).toBe(LAND.coral);
    expect(part("fill").getAttribute("class")).toBe(LAND.fill);
    for (const tick of view.container.querySelectorAll('[data-part="tick"]')) expect(tick.getAttribute("class")).toBe(LAND.fill);
    expect(part("strip-slot").className).toContain(LAND.strip);
    // The same line, the dot at its end, the slider at rest.
    expect(part("loss").getAttribute("d")).toBe(part("line").getAttribute("d"));
    expect(Number(part("dot").getAttribute("cx"))).toBeCloseTo(W, 0);
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "29");
  });
});
```

`src/components/result/__tests__/result-motion-guard.test.ts`, add inside the describe:

```ts
  it("the landing moves opacity and the line's stroke only: no transform, no filter", () => {
    const properties = (name: string) =>
      [...block(CSS, `@keyframes ${name} {`).matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    expect(new Set(properties("result-fade"))).toEqual(new Set(["opacity"]));
    expect(new Set(properties("result-draw"))).toEqual(new Set(["stroke-dashoffset"]));
  });
```

`src/components/result/__tests__/result-page.test.tsx`: add `import { LAND } from "../landing";` and
`import { modelOf } from "./hero-harness";`. Inside `describe("running")`, delete the tests "the result
fades in when the run finishes while the page is open", "a run that turns into no audience fades in
too" and "a result opened directly does not fade in" (keep "a run that stalls does not fade in"), and
add:

```tsx
  // The landing. Stand-ins: the user's motion setting, the clock and the animation frames, and the
  // browser's report that the first card has scrolled away (so the pinned player shows).
  const realMatchMedia = window.matchMedia;
  const motion = (reduce: boolean) => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes("no-preference") ? !reduce : reduce,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  };
  class ScrolledAway {
    constructor(private callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      this.callback(
        [{ target, isIntersecting: false, boundingClientRect: { top: -400 } } as unknown as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  /** Every animation class on the page. */
  const animations = (root: ParentNode) =>
    [...root.querySelectorAll("[class*='animate-[']")].flatMap((el) =>
      el.getAttribute("class")!.split(/\s+/).filter((name) => name.includes("animate-[")),
    );
  const withFrames = (): ResultPageState => ({ kind: "result", model: modelOf(early, { frames: true }) });
  /** The page while the run simulates, then its result arriving. */
  const land = (after?: ReactNode) => {
    const view = renderPage({ kind: "running", id: "run-1", startedAt: null });
    view.rerender(<ResultPage state={withFrames()} after={after} />);
    return view;
  };
  afterEach(() => {
    window.matchMedia = realMatchMedia;
    vi.useRealTimers();
  });

  it("a result that arrives from its run lands, on a phone: the count rolls, the line draws itself, its coral, fill and strip come in, the rest after 0.9 s; opacity and the stroke only", () => {
    setWidth(393);
    motion(false);
    vi.stubGlobal("IntersectionObserver", ScrolledAway);
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date", "requestAnimationFrame", "cancelAnimationFrame"],
    });
    const { container } = land(<p data-testid="after">Posted it?</p>);
    const hero = container.querySelector('[data-result="hero"]')!;

    expect(body(container)!.hasAttribute("data-landing")).toBe(true);
    // A result lands part by part: no whole-body fade.
    expect(body(container)!.className).not.toMatch(/opacity|transition/);
    expect(hero.querySelector('[data-part="count-number"]')!.textContent).toBe("1,000");
    expect(hero.querySelector('[data-result="count"] .sr-only')!.textContent).toBe("461");
    const line = hero.querySelector('[data-part="line"]')!;
    expect(line.getAttribute("pathLength")).toBe("1");
    expect(line.getAttribute("class")).toBe(LAND.draw);
    expect(hero.querySelector('[data-part="loss"]')!.getAttribute("class")).toBe(LAND.coral);
    expect(hero.querySelector('[data-part="band"]')!.getAttribute("class")).toBe(LAND.coral);
    expect(hero.querySelector('[data-part="fill"]')!.getAttribute("class")).toBe(LAND.fill);
    expect(hero.querySelector('[data-part="strip-slot"]')!.className).toContain(LAND.strip);
    // Outside the first card: After posting, the moment, the switch and the panel.
    for (const el of [
      screen.getByTestId("after").parentElement!,
      container.querySelector('[data-result="moment"]')!.parentElement!,
      container.querySelector('[data-result="tabs"]')!.parentElement!,
      container.querySelector('[data-result="panel"]')!.parentElement!,
    ]) {
      expect(el.className).toContain(LAND.rest);
    }
    // The tile is the result's own player at rest; it does not move.
    expect(hero.querySelector('[data-result="video"]')!.closest("[class*='animate-[']")).toBeNull();
    // Only the landing's two keyframes, and none on an ancestor of the pinned player.
    expect(new Set(animations(container).map((name) => name.match(/result-[a-z]+/)![0]))).toEqual(
      new Set(["result-draw", "result-fade"]),
    );
    expect(container.querySelector('[data-result="compact"]')!.closest("[class*='animate-[']")).toBeNull();

    act(() => vi.advanceTimersByTime(1600));
    expect(hero.querySelector('[data-part="count-number"]')!.textContent).toBe("461");
    // The landing is over: its classes leave, so a part mounted later does not land again.
    act(() => vi.advanceTimersByTime(500));
    expect(body(container)!.hasAttribute("data-landing")).toBe(false);
    expect(animations(container)).toEqual([]);
  });

  it("on a wide window: the sentence, After posting, the switch and the panel come in after 0.9 s; the line's card stays and its line draws", () => {
    setWidth(1440);
    motion(false);
    const { container } = land(<p data-testid="after">Posted it?</p>);
    const sentence = container.querySelector('[data-result="sentence-card"]')!;
    expect(sentence.className).not.toContain("animate-[");
    expect(sentence.firstElementChild!.className).toContain(LAND.rest);
    expect(screen.getByTestId("after").parentElement!.className).toContain(LAND.rest);
    expect(container.querySelector('[data-result="tabs"]')!.parentElement!.className).toContain(LAND.rest);
    const lineCard = container.querySelector('[data-part="line-card"]')!;
    expect(lineCard.className).not.toContain("animate-[");
    expect(lineCard.querySelector('[data-part="line"]')!.getAttribute("class")).toBe(LAND.draw);
    expect(container.querySelector('[data-part="count-number"]')!.textContent).toBe("1,000");
  });

  it("with reduced motion the arriving result is there at once", () => {
    setWidth(393);
    motion(true);
    const { container } = land();
    expect(body(container)!.hasAttribute("data-arrived")).toBe(true);
    expect(body(container)!.hasAttribute("data-landing")).toBe(false);
    expect(container.querySelector('[data-part="count-number"]')!.textContent).toBe("461");
    expect(container.querySelector('[data-result="count"] .sr-only')).toBeNull();
    expect(animations(container)).toEqual([]);
  });

  it("a result opened directly is there at once", () => {
    setWidth(393);
    motion(false);
    const { container } = renderPage(withFrames());
    expect(body(container)!.hasAttribute("data-arrived")).toBe(false);
    expect(body(container)!.hasAttribute("data-landing")).toBe(false);
    expect(container.querySelector('[data-part="count-number"]')!.textContent).toBe("461");
    expect(animations(container)).toEqual([]);
    expect(body(container)!.className).not.toMatch(/fade-in|opacity/);
  });

  it("a run that turns into no audience fades in as a whole, as before (opacity only)", () => {
    const { container, rerender } = renderPage({ kind: "running", id: "run-1", startedAt: null });

    rerender(<ResultPage state={{ kind: "no-audience", id: "run-1", title: "Video", videoPath: null }} />);

    expect(screen.getByText("No audience came back.")).toBeInTheDocument();
    expect(body(container)?.hasAttribute("data-arrived")).toBe(true);
    // Opacity only: an animated transform or filter would, for its 400 ms, make a fixed element
    // place itself against the page body instead of the screen.
    const fade = body(container)?.className ?? "";
    expect(fade).toMatch(/motion-safe:transition-opacity/);
    expect(fade).toMatch(/motion-safe:starting:opacity-0/);
    expect(fade).not.toMatch(/animate-in|fade-in|zoom|slide|spin|blur|translate|scale|rotate|transform|filter/);
  });
```

`src/app/(app)/dev/result/__tests__/dev-result.test.tsx`: add `act` to the Testing Library import, a
motion stand-in, and a test:

```tsx
const realMatchMedia = window.matchMedia;
/** The visitor asked for less motion: the result arrives without its landing (no animation frames to drive). */
function reduceMotion() {
  window.matchMedia = ((query: string) => ({
    matches: !query.includes("no-preference"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
```

(add `window.matchMedia = realMatchMedia;` to its `afterEach`), and in the describe:

```tsx
  it("land= turns the running moment into the result after that many seconds", () => {
    reduceMotion();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    const { container } = renderDev({ land: 3 });
    expect(container.querySelector('[data-result="running"]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(2999));
    expect(container.querySelector('[data-result="count"]')).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('[data-result="running"]')).toBeNull();
    expect(container.querySelector('[data-result="count"]')).toHaveTextContent("461 of 1,000 watched to the end");
    expect(container.querySelector("[data-result-body]")!.hasAttribute("data-arrived")).toBe(true);
  });
```

#### Step 2: run, expect failures

```
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/result src/lib/result "src/app/(app)/dev/result" --testTimeout 30000
```

Expected: `../landing` cannot be found (viewer-count, curve, result-page tests); the guard's new test
fails (no `result-fade` / `result-draw` blocks); `land` is not a prop of `DevResult` (a type error in
`tsc`; at run time the page stays on the running moment).

#### Step 3: the implementation

`src/components/result/landing.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * The landing (spec section 5, option A): a result that arrives while its running screen is open
 * finishes building itself in the wait's place. The count rolls from 1,000 to its value, the line draws
 * itself, the named stretch's coral and its band come in, then the fill and the ticks; the strip's
 * scenes come in over the wait's tiles; what lies outside the first block fades in after it. Only for
 * a result that arrives from its run, and only with motion allowed: a result opened directly, or with
 * reduced motion, is all there at once.
 *
 * Opacity and the line's stroke only: an animated transform or filter on an ancestor of the pinned
 * compact player (position: fixed) would make it place itself against that ancestor, not the screen.
 */
const LandingContext = createContext(false);

/** Set by the result page around the result. */
export const LandingProvider = LandingContext.Provider;

/** True while the page's result is landing; false anywhere else. */
export function useLanding(): boolean {
  return useContext(LandingContext);
}

/** Longer than every part of the landing (the longest, the fill, ends at 1.7 s). */
export const LANDING_MS = 2000;

/**
 * `on`, for `ms` after it turned on; then false for good, so a part mounted after that (the other
 * layout after a resize, the pinned player) shows at once and never lands again.
 */
export function useLandingWindow(on: boolean, ms: number = LANDING_MS): boolean {
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!on || over) return;
    const timer = setTimeout(() => setOver(true), ms);
    return () => clearTimeout(timer);
  }, [on, over, ms]);
  return on && !over;
}

/** The landing's classes (keyframes `result-draw` and `result-fade` in globals.css), motion-safe only. */
export const LAND = {
  /** The line draws itself in 1.5 s (on a path with `pathLength` 1 and a dash of 1). */
  draw: "motion-safe:animate-[result-draw_1.5s_cubic-bezier(0.3,0.1,0.2,1)_both]",
  /** The named stretch's coral and its band, after 0.5 s. */
  coral: "motion-safe:animate-[result-fade_0.4s_ease-out_0.5s_both]",
  /** The fill under the line and the ticks, after 0.9 s. */
  fill: "motion-safe:animate-[result-fade_0.8s_ease-out_0.9s_both]",
  /** The strip's scenes, at once, over the wait's tiles. */
  strip: "motion-safe:animate-[result-fade_0.5s_ease-out_both]",
  /** Everything outside the first block, after 0.9 s. */
  rest: "motion-safe:animate-[result-fade_0.5s_ease-out_0.9s_both]",
} as const;
```

`src/components/result/viewer-count.tsx`, replaced whole:

```tsx
"use client";

import { useEffect, useState } from "react";
import { OF_VIEWERS, ROLL_MS, VIEWERS, countAt, formatCount, rolledAt } from "@/lib/result/count";
import type { Audience } from "@/lib/result/types";
import { useLanding } from "./landing";
import { usePlayhead } from "./playhead";

/** The count's number: the figure role the Engagement page's average watch had (30, bold, tight). */
const NUMBER = "text-3xl font-bold leading-[25px] tracking-[-0.04em] text-foreground tabular-nums";

/**
 * The count under the video (spec 3.1): how many of 1,000 viewers are still watching at the playhead,
 * or, at rest, watched to the end. The number and its words on one baseline, centred; the words go
 * under the number only where one line cannot hold both (a 320 phone).
 *
 * Plain text for a screen reader, no live region: it changes every frame while the video plays. When
 * the result lands the number rolls from 1,000 to the count; a screen reader reads the count itself
 * from the first frame.
 */
export function ViewerCount({ audience }: { audience: Audience }) {
  const { t, resting } = usePlayhead();
  const { n, words } = countAt(audience, t, resting);
  const landing = useLanding();
  const rolled = useRoll(n, landing);
  return (
    <p data-result="count" className="flex flex-wrap items-baseline justify-center gap-x-2 text-center">
      <span data-part="count-number" aria-hidden={rolled !== null ? true : undefined} className={NUMBER}>
        {formatCount(rolled ?? n)}
      </span>
      {rolled !== null && <span className="sr-only">{formatCount(n)}</span>}{" "}
      <span data-part="count-words" className="text-ui text-foreground-secondary">
        {OF_VIEWERS} {words}
      </span>
    </p>
  );
}

/**
 * The landing's roll: from 1,000 down to `to` in 1.5 s (ease-out), once, from the count's first frame;
 * null when not rolling. Decided when the count mounts, so a count mounted later does not roll. A move
 * of the playhead during the roll ends it: the count follows the video at once.
 */
function useRoll(to: number, landing: boolean): number | null {
  const [target] = useState(() => (landing ? to : null));
  const [value, setValue] = useState<number | null>(() => (landing ? VIEWERS : null));
  useEffect(() => {
    if (target === null) return;
    const start = Date.now();
    let frame = requestAnimationFrame(function tick() {
      const elapsed = Date.now() - start;
      if (elapsed >= ROLL_MS) {
        setValue(null);
        return;
      }
      setValue(rolledAt(VIEWERS, target, elapsed));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value !== null && to === target ? value : null;
}
```

`src/components/result/curve.tsx`:

1. Add `import { LAND } from "./landing";`.
2. `CurveArt` takes `enter` and gives its parts the landing's classes:

```tsx
/** The still part of the line: base, fill, the named scene's band, ticks, the line, its coral. */
const CurveArt = memo(function CurveArt({
  geo,
  width,
  height,
  enter,
}: {
  geo: Geometry;
  width: number;
  height: number;
  enter: boolean;
}) {
  const clipId = useId();
  // The landing (landing.tsx): the line draws itself as a dash as long as the path, its coral and band
  // come in after it starts, the fill and the ticks after that.
  const land = (part: keyof typeof LAND) => (enter ? LAND[part] : undefined);
  return (
    <g>
      {geo.loss && (
        <defs>
          <clipPath id={clipId}>
            <rect x={f(geo.loss.clip.x)} y={-6} width={f(geo.loss.clip.width)} height={height + 12} />
          </clipPath>
        </defs>
      )}
      <path d={`M0 ${geo.base}H${width}`} stroke="var(--color-border)" />
      {/* The band sits under the fill: the soft fill still shows where the line is above it. */}
      {geo.loss && (
        <rect
          data-part="band"
          x={f(geo.loss.band.x)}
          y={0}
          width={f(geo.loss.band.width)}
          height={geo.base}
          rx={3}
          fill="var(--color-below-soft)"
          className={land("coral")}
        />
      )}
      <path data-part="fill" d={geo.fill} fill="var(--color-surface-sunken)" className={land("fill")} />
      {geo.ticks.map((x, i) => (
        <path
          key={i}
          data-part="tick"
          d={`M${x} ${geo.base}v-5`}
          stroke="var(--color-foreground-muted)"
          strokeWidth={1}
          className={land("fill")}
        />
      ))}
      <path
        data-part="line"
        d={geo.line}
        fill="none"
        stroke="var(--color-foreground)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={land("draw")}
        {...(enter ? { pathLength: 1, strokeDasharray: 1 } : {})}
      />
      {geo.loss && (
        <path
          data-part="loss"
          d={geo.line}
          fill="none"
          stroke="var(--color-below)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          clipPath={`url(#${clipId})`}
          className={land("coral")}
        />
      )}
    </g>
  );
});
```

3. `Curve` takes `enter` (after `mirror` in the destructuring and the props type):

```tsx
  enter = false,
```

```tsx
  /**
   * The landing: the line draws itself, then its coral and its band, its fill and ticks, and its strip
   * come in (landing.tsx). Off by default; only the page's own line lands.
   */
  enter?: boolean;
```

and passes it on: `<CurveArt geo={geo} width={width} height={height} enter={enter} />` and, on the
`LineFrame`, `stripClassName={enter ? LAND.strip : undefined}`.

`src/components/result/hero.tsx`: add `import { useLanding } from "./landing";`, in `Hero`
`const landing = useLanding();`, and `enter={landing}` on its `Curve`.

`src/components/result/video-result.tsx`:

1. Add `import { cn } from "@/lib/utils";` and `import { LAND, useLanding } from "./landing";`.
2. In `PhoneResult`, after `const scrolled = …`:

```tsx
  // Landing: what lies under the first card comes in after it (opacity only, see landing.tsx).
  const rest = useLanding() ? LAND.rest : undefined;
```

and the four slots become `<div className={cn("mt-3 empty:hidden", rest)}>{after}</div>`,
`<div className={cn("mt-[18px]", rest)}>`, `<div className={cn("mt-5", rest)}>{tabs}</div>`,
`<div className={cn("mt-2.5", rest)}>{panel}</div>`. The pinned player's wrapper gets nothing.
3. In `DesktopResult`, after `useContentWidth`:

```tsx
  const landing = useLanding();
  // Landing: the line's card was there while waiting; its line draws, the rest of the column comes in.
  const rest = landing ? LAND.rest : undefined;
```

and `WideFrame` gets `firstClassName={rest}`, `afterClassName={rest}`, `restClassName={rest}`, and its
`Curve` `enter={landing}`.

`src/components/result/result-page.tsx`:

1. Imports: add `import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";` and
   `import { LandingProvider, useLandingWindow } from "./landing";`.
2. `useArrivedFromRun`'s comment: "True once the run turned into its result (or into no audience) while
   the page was open: that result lands, that body fades in. A result opened directly does neither. The
   kind seen last is kept in state, not in a ref, so it can be read while rendering."
3. `ARRIVAL_FADE`'s comment becomes:

```tsx
// A run that turns into no audience fades in as a whole (not with reduced motion): opacity only, from
// the element's starting style. A result lands part by part instead (landing.tsx). An animated
// transform or filter would make a fixed element place itself against this element, not the screen.
```

4. In `ResultPage`, after `const arrived = useArrivedFromRun(state.kind);`:

```tsx
  // Only a result that arrives from its run lands, and only with motion allowed. The setting was read
  // while the run's screen was open, so it has settled by the time the result arrives.
  const reducedMotion = usePrefersReducedMotion();
  const landing = useLandingWindow(arrived && state.kind === "result" && !reducedMotion);
```

5. The result's body wraps `VideoResult`: `<LandingProvider value={landing}><VideoResult model={state.model} after={after} /></LandingProvider>`.
6. The body `div` gains `data-landing={landing ? "" : undefined}` and its class becomes
   `cn("flex-1", arrived && state.kind === "no-audience" && ARRIVAL_FADE)`.

`src/app/globals.css`, appended after the Task 5 block:

```css
/* ── Result page (new look): the landing ──────────────────────────────────────
   A result that arrives while its running screen is open finishes building itself
   (src/components/result/landing.tsx). Opacity and the line's stroke only: an animated transform or
   filter on an ancestor of the pinned compact player (position: fixed) would make it place itself
   against that ancestor. */

/* The line drawing itself: a path with pathLength 1 and a dash of 1. */
@keyframes result-draw {
  from {
    stroke-dashoffset: 1;
  }
  to {
    stroke-dashoffset: 0;
  }
}

/* A part of the result coming in. */
@keyframes result-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

`src/app/(app)/dev/result/page.tsx`: the usage line gains `[&land=<seconds>]` after `[&elapsed=<seconds>]`;
under `elapsed` add ` *   - land: the running moment turns into the result after these seconds, so the
landing can be looked at`; pass `land={count(one(params.land))}` to `DevResult`.

`src/app/(app)/dev/result/dev-result.tsx`: add `useEffect` to the React import; add `land` to
`DevResult`'s destructured props and `/** Seconds after which the running moment turns into the result. */ land?: number;`
to their type; its body becomes:

```tsx
  const client = useQueryClient();
  // The address stands in for the signed one before the page first asks for it.
  useState(() => {
    if (video) seedSignedVideo(client, DEV_VIDEO_PATH, video);
    return null;
  });
  const [running] = useState(() => videoStateOf(devRow(row, frames, video, processing, run.elapsed)));
  // `land`: the same recorded run, finished, takes the running moment's place after that many seconds.
  const [finished] = useState(() =>
    processing && land !== undefined ? videoStateOf(devRow(row, frames, video, false)) : null,
  );
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!finished || land === undefined) return;
    const timer = setTimeout(() => setLanded(true), land * 1000);
    return () => clearTimeout(timer);
  }, [finished, land]);
  const [preview] = useState(() => (processing ? runningPreview(run, frames, video) : undefined));
  const state = landed && finished ? finished : running;
  return <ResultPage state={state} startAt={t} simulateAgain={simulateAgain} runningPreview={preview} />;
```

#### Step 4: run, expect a pass

```
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/result src/lib/result "src/app/(app)/dev/result" src/app/__tests__/design-token-drift.test.ts src/app/__tests__/next-look-contrast.test.ts --testTimeout 30000
pnpm exec tsc --noEmit
pnpm exec eslint src/components/result/landing.tsx src/components/result/viewer-count.tsx src/components/result/curve.tsx src/components/result/hero.tsx src/components/result/video-result.tsx src/components/result/result-page.tsx "src/app/(app)/dev/result/page.tsx" "src/app/(app)/dev/result/dev-result.tsx" src/components/result/__tests__/viewer-count.test.tsx src/components/result/__tests__/curve.test.tsx src/components/result/__tests__/result-motion-guard.test.ts src/components/result/__tests__/result-page.test.tsx "src/app/(app)/dev/result/__tests__/dev-result.test.tsx"
```

What these tests cannot prove (happy-dom runs no CSS animation): that the keyframes play, their
timing and feel, and that nothing jumps; the controller's look does (the checklist at the end).
**Report:** `task-6-report.md`.

---

### Task 7: the composer hands the creator's clip to the run's page (built by the controller)

**Built by the controller itself** once the chat session has freed `composer.tsx` (ruling 36): one
import and one effect in `src/components/app/home/composer.tsx`, under `NEW_LOOK_ENABLED`, that hands
the file the run was started with (`nextRunInputsRef.current?.file`, recorded before the run starts,
null for a link) to `rememberRunVideo` once the run has its id. No new ref, no change in any send path;
`runBroughtVideo` is not touched (its door cannot be reached under the flag).

**Files.** Modify `src/components/app/home/composer.tsx` (exactly the two places below; nothing else in
it changes), `src/components/app/home/__tests__/composer-next-field.flag-on.test.tsx` (one import, one
describe at the end). **Must not touch** anything under `src/components/thread-next`,
`src/components/home-next`, `src/lib/thread-next`; `src/lib/result/run-video.ts` (it already lets a
replaced or pushed-out `blob:` address go); any send path in the composer (`handleSubmit`,
`runBroughtVideo`).

**Consumes:** `rememberRunVideo`, `runVideoOf`, `forgetRunVideos` (`run-video.ts`), the composer's
`stream.analysisId` (`useAnalysisStream`, set by the stream's `started` event) and `nextRunInputsRef`
(set where a run is armed: `{ file, brief }` for a clip, `{ file: null, … }` for a link or a brought
video).
**Produces:** a run started from a file in this tab has its object URL remembered under its id, once,
when the id arrives; `Running` already reads it (`runVideoOf(id)`).

Why the composer and not a pure helper: the composer's flag-on tests drive the real composer with
stand-ins only for `fetch`, the storage client and object URLs (`composer-next-field.flag-on.test.tsx`,
`holdAnalyzeStarted`, `pickAndSend`), so the hand-over can be tested where it happens.

#### Step 1: the failing test

In `composer-next-field.flag-on.test.tsx`, add after `import { useShellStore } from "@/stores/shell-store";`:

```ts
import { forgetRunVideos, runVideoOf } from "@/lib/result/run-video";
```

and at the end of the file:

```tsx
describe("the run's page plays the creator's own clip", () => {
  const LINK = "https://www.tiktok.com/@nia.tests/video/7000000000000000001";
  beforeEach(() => {
    // Every object URL is its own, so the one handed over can be told from the field's tile's.
    let n = 0;
    vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:test/${++n}`);
  });
  afterEach(() => forgetRunVideos());

  it("a clip sent from the field: its file is handed to the run's page once the run has its id, and once only", async () => {
    let releaseUpload: () => void = () => {};
    upload.mockImplementation(() => new Promise((r) => (releaseUpload = () => r({ error: null }))));
    holdAnalyzeStarted("run-7");
    await renderComposer();
    const sent = clip();
    fireEvent.change(inField().getByLabelText("Choose a video file"), { target: { files: [sent] } });
    fireEvent.click(send());

    // Uploading: the run has no id yet, so nothing is handed over.
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(runVideoOf("run-7")).toBeNull();

    await act(async () => releaseUpload());
    await waitFor(() => expect(runVideoOf("run-7")).not.toBeNull());
    const handed = runVideoOf("run-7")!;
    const created = vi.mocked(URL.createObjectURL);
    const at = created.mock.results.findIndex((r) => r.value === handed);
    expect(at).toBeGreaterThanOrEqual(0);
    expect(created.mock.calls[at]![0]).toBe(sent);

    // Once: later renders hand nothing new over (a new address would replace this one and let it go).
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(runVideoOf("run-7")).toBe(handed);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(handed);
  });

  it("a link run hands nothing over", async () => {
    holdAnalyzeStarted("run-8");
    await renderComposer();
    fireEvent.click(pill("Simulate"));
    fireEvent.change(text(), { target: { value: LINK } });
    await waitFor(() => expect(send()).not.toBeDisabled());
    fireEvent.click(send());

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /Watch it run/ })).toHaveAttribute("href", "/simulation/run-8"),
    );
    expect(runVideoOf("run-8")).toBeNull();
  });
});
```

#### Step 2: run, expect a failure

`NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/app/home/__tests__/composer-next-field.flag-on.test.tsx --testTimeout 30000`.
Expected: the first new test times out at `expect(runVideoOf("run-7")).not.toBeNull()`. The link test
passes already: it pins that a link never hands a file over (its run records `file: null`).

#### Step 3: the implementation, in `src/components/app/home/composer.tsx`

1. After `import { NEW_LOOK_ENABLED } from "@/lib/flags/new-look";` add
   `import { rememberRunVideo } from "@/lib/result/run-video";`.
2. Directly after `const nextRunInputsRef = useRef<{ file: File | null; brief: typeof testBrief } | null>(null);` add:

```tsx
  // New look: the run's own page plays the creator's clip while it simulates. The file a run sent is
  // recorded before it starts (`nextRunInputsRef`, null for a link); it is handed over once, when the
  // run has its id.
  useEffect(() => {
    const id = stream.analysisId;
    const file = nextRunInputsRef.current?.file ?? null;
    if (!NEW_LOOK_ENABLED || !id || !file) return;
    rememberRunVideo(id, URL.createObjectURL(file));
  }, [stream.analysisId]);
```

The effect runs when the run's id changes (null to an id at its `started` event), so once per run; the
upload branch records `{ file, brief }` before `stream.start`, so the file is there when the id
arrives, and the seal that clears the record runs only after the run completes. The object URL lives
until `run-video.ts` lets it go (a newer run for the same id, or eight newer runs).

#### Step 4: run, expect a pass

```
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/app/home/__tests__/composer-next-field.flag-on.test.tsx src/components/app/home/__tests__/composer-home.flag-on.test.tsx src/components/app/home/__tests__/composer.test.tsx src/lib/result/__tests__/run-video.test.ts --testTimeout 30000
pnpm exec tsc --noEmit
pnpm exec eslint src/components/app/home/composer.tsx src/components/app/home/__tests__/composer-next-field.flag-on.test.tsx
```

`composer.test.tsx` is the flag-off build: it must stay green unchanged (nothing runs without the
flag). If `eslint` on `composer.tsx` reports problems on lines this task did not touch, report them,
do not fix them. **Report:** `task-7-report.md`.

---

### Task 8: the design-system text and the leftovers

**Files.** Modify `docs/DESIGN-SYSTEM.md` (the result page paragraph, lines 325 to 349 today; never a
token value), `scripts/result-shots.cjs` (one comment line). Remove whatever the greps below find with
no user left (none expected after Tasks 2 and 5). **Must not touch** any table in `DESIGN-SYSTEM.md`.

#### Step 1: the text

Replace the paragraph from `Result page (\`src/components/result\`, logic in \`src/lib/result\`; spec`
through the bullet ending `` `/dev/result?fixture=early&processing=1&elapsed=<s>&groups=<n>[&arriving=<k>][&runframes=<n>][&own=1]`. ``
with:

```markdown
Result page (`src/components/result`, logic in `src/lib/result`; specs
`docs/superpowers/specs/2026-11-19-result-page-design.md` and
`docs/superpowers/specs/2026-11-25-result-video-focus-design.md`): `ResultPage` (loading, running,
stalled, not found, no audience, result), `VideoResult` (phone column / desktop grid) drawn through the
first block's layout parts (`FirstCard`, `WideFrame`, `LineFrame` in `first-block.tsx`), `Hero`,
`Player`, `ViewerCount`, `Curve` with `SceneStrip`, `Moment`, `CompactPlayer`, `PanelSwitch`,
`BrainPanel`, `EngagementPanel`, `AudiencePanel` with `AudienceRing`. One playhead for all of them:
`PlayheadProvider` / `usePlayhead()`. Rules of that page:

- Coral (`--color-below`, text `--color-below-text`, band `--color-below-soft`) marks two things: the
  scene the sentence names (its part of the line, its tile in the strip, its wedges and rows) and,
  while the video is away from rest, the video's moment (the marker on Engagement's bar, the line on
  each of the Brain's curves).
- Tokens only; `result-guard.test.ts` enforces it. Glass exists in one place, the play mark on
  the video (`PlayMark` in `player.tsx`, blur as an inline style).
- The video is in focus: on a phone the first card holds the video, the count under it, then the line
  with the strip; on a wide window the video stands large at the left with the count under it and the
  sentence has the right column's first card to itself. The gauge is not on this page.
- The numbers are counts of 1,000 viewers (`count.ts`: a stored share times ten, rounded): under the
  video, in the pinned player and on Engagement. A count is never read off the headline's rounded
  percent; the craft grader's score is never shown.
- While the playhead moves, the readout shows a stored value (the end of the scene under it),
  and its dot sits at that point; the count under the video shows the line's value at the moment.
- The brain's porcelain look is `look="porcelain-light" | "porcelain-dark"` on `CortexCanvas`
  (`cortex-porcelain.ts`); the default `"scan"` is the legacy look, unchanged. Its signals are said in
  words (`brain-read.ts`): one sentence about Focus, and for each signal above, at or below rest.
- To look at it: `/dev/result?fixture=<name>` and `node scripts/result-shots.cjs --out <dir>`.
- Each panel lays itself out for the width it gets, not the window's (container queries and
  `audienceLayoutFor`), so a tablet or a narrow window never cuts a part off.
- The running screen (`Running`; what the run's stream has said so far is `useRunStream` over
  `run-progress.ts`) is the result's first block building itself, drawn by the same layout parts: the
  tile (the creator's own clip when this tab started the run from a file, else the post's cover, else
  the first scene frame that arrived, else an empty tile), "Building your 1,000 viewers" with the time
  since the start, a dotted base where the line will be, and the strip's tiles filling as the frames
  arrive. No count, no line, no percent, nothing coral. A result that arrives while it is open lands
  (`landing.tsx`): the count rolls from 1,000, the line draws itself, the rest comes in; opacity and
  the line's stroke only, `motion-safe:` only (keyframes `result-*` in `globals.css`). Its moments on
  the dev page: `/dev/result?fixture=early&processing=1&elapsed=<s>[&runframes=<n>][&own=1][&cover=<url>][&land=<s>]`.
```

In `scripts/result-shots.cjs`'s header comment, `e.g. --processing --query "elapsed=42&groups=10&runframes=7"`
becomes `e.g. --processing --query "elapsed=42&runframes=7"`.

#### Step 2: the leftovers (read-only greps; remove only what has no user, and name it in the report)

```
grep -rn "RunningRing\|frameOnScreen\|FRAME_HOLD_S\|arrivalOrder\|arriving\|running-ring\"\|groups=" src scripts docs/DESIGN-SYSTEM.md
grep -rn "from \"./gauge\"\|Gauge" src/components/result
grep -rn "headline.value" src/components/result
grep -rn "ResultFrame\|PHONE_TOP\b\|PHONE_GAP_PX" src
grep -rn "equalRing\|EqualRing" src
```

Expected: no hit for the first line but the `running-ring.tsx` file name in `audience-next` imports;
`Gauge` only in `gauge.tsx` and `text-result.tsx`; `headline.value` only in `audience-panel.tsx` and
`text-result*`; `ResultFrame` in `first-block.tsx`, `video-result.tsx`, `running.tsx`,
`result-page.tsx`; `equalRing` in `running-ring.tsx` and `audience-next`.

#### Step 3: the whole run

```
NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/result src/lib/result "src/app/(app)/dev/result" src/components/audience-next src/app/__tests__/design-token-drift.test.ts src/app/__tests__/next-look-contrast.test.ts src/components/app/home/__tests__/composer-next-field.flag-on.test.tsx --testTimeout 30000
pnpm exec tsc --noEmit
pnpm exec eslint src/components/result "src/app/(app)/dev/result" src/lib/result
```

All green. **Report:** `task-8-report.md`.

---

## What only a browser can prove (the controller's look)

happy-dom runs no CSS, no layout and no animation: the tests pin the state that drives each of these,
not the look. `df -h /` first; the flag on; `/dev/result` and a real run.

- [ ] **Hero, phone 320 / 375 / 393 / 430, light and dark:** the tile 140 / ~162 / 176 / ~196 wide,
      centred, its corner, shadow and play mark as today; the count 16 under it on one line at 375 and
      up, the words under the number only at 320; the hairline 14 under; the line, strip and times as
      today; no gauge. `result-shots.cjs --view phone` boxes: `hero`, `video`, `count`.
- [ ] **Wide 1024 / 1440:** the video 372 at the left, the count 18 under it, centred on it; the
      sentence's card at least 158 tall with the moment centred; "After posting" under it; the line's
      card, tabs and panel as today.
- [ ] **Playing:** the count, the pinned player's number, the Audience ring, Engagement's Now row and
      marker, the Brain's moment lines and words all move with the video; at rest they show the end.
- [ ] **Engagement:** the marker stands 5 above and below the bar, not clipped; `Most likely` fits on
      a 320 phone without pushing the bar under a usable length.
- [ ] **Brain:** at 320 the meanings wrap to two lines inside 96, the words never wrap; on a wide panel
      the two cards side by side as tall as the signals card, the brain centred at its drawn size.
- [ ] **The wait, phone and wide:** the tile where the result's video will stand, the same size; the
      band of light sweeping down a still or empty tile and never over the clip; the dots blinking in
      turn; the clock; the dotted base with its band; the strip shimmering and its tiles filling with a
      short fade and settle; dark theme: the tile's white band still reads as light passing, the strip's
      shimmer (the card's surface over the sunken tile) still reads as motion.
- [ ] **The landing** (`/dev/result?fixture=early&frames=…&processing=1&runframes=7&own=1&video=…&land=4`
      and a real run): the result takes the wait's place with no jump of the first block at 320, 393,
      1024, 1440 (the strip changes from equal tiles to scene widths: expected); the count rolls,
      the line draws, the coral and band after half a second, the fill after it, the rest after 0.9 s;
      the pinned player (scroll down during the landing) stays pinned to the screen; after the landing
      the tile is the player at rest with its play mark. A result opened directly: no motion.
- [ ] **Reduced motion:** nothing moves on the wait or at the landing; the clip shows its first frame.
- [ ] **A link run:** the post's cover loads from the platform's address (no referrer or host refusal);
      a cover that fails falls through to the first frame.
- [ ] **A run from a file in this tab** (Task 7): the clip plays in the wait, muted and looping.
- [ ] **Keyboard and screen reader:** the count reads as plain text; during the roll the reader hears
      the final count once; the line is still the one slider; the tabs as today.
- [ ] **Flag off** against the baseline; types, the whole suite, lint and both production builds.

## Questions for the controller

Each carries the plan's default in brackets and, after it, the controller's answer (rulings 33 to 37). Build the answer.

1. **The Focus sentence says "lowest at 0:00" on five of the six recorded runs.** The model starts
   every clip at its resting level and ramps up over the first seconds, so the first lowest second is
   0:00 almost always (early, opening, leak, holds, ending; only middle gets "falls when the scene
   changes at 0:17"). Rule 18 is written that way. A reading from the peak on ("and lowest after it at
   <m:ss>") would say something. [Rule 18 as written; one line in `focusSentence` if you change it.]
   **Answered (ruling 33):** the lowest is read from the highest second on (the whole clip only when the highest second is the last); built in Task 1.
2. **The drawn numbers are samples.** The pictures show 460 / 680 / 571 for early; rule 9 gives 461
   (46.0674 × 10), 708 past the opening, 562 at 0:07. [Rule 9.]
   **Answered (ruling 34):** rule 9 stands; the drawn numbers were samples.
3. **Engagement's average watch figure:** the picture draws it at the other rows' size (22); rule 15
   says "as today's figures" (today 30). [The picture: 22, `text-heading font-bold`, for all three.]
   **Answered (ruling 34):** the picture; all three figures at 22.
4. **The wide sentence card is at least 158 tall** (the moment's 114 frame and the padding), its
   sentence centred, so the wait's empty card and the result's card match; a result whose frames are
   gone keeps the 158 card instead of shrinking. [Always at least 158.]
   **Answered (ruling 34):** as proposed.
5. **"On a wide window the right column's contents fade in":** the line's card is there while waiting,
   so it does not fade; its line draws, and the sentence (inside its card), "After posting", the tabs
   and the panel fade in. [As written.]
   **Answered (ruling 34):** as proposed.
6. **Landing timings rule 25 leaves open:** the fill and ticks 0.8 s after 0.9 s (the prototype's
   fill); the strip 0.5 s with no delay (so the frames are never gone); the count and line 1.5 s. [As
   written in `LAND`.]
   **Answered (ruling 34):** as proposed.
7. **White for the light bands:** the tile's band (`via-white/20`) and the strip's shimmer
   (`via-white/70`, `dark:via-white/10`) use white over a picture or an empty tile, as the play mark on
   footage does; it is a palette colour, not a token (the guard allows it, rule 8 says tokens). The
   plot's band uses `foreground/[0.07]`. [White, as the play mark.]
   **Answered (ruling 35):** the tile's band stays white (it is over footage or the tile); the strip's shimmer uses tokens, `via-surface` over `surface-sunken`, no theme variant (built so in Task 5).
8. **The landing window:** 2 s after the arrival the landing's classes leave, so a part mounted later
   (a resize across 768, the pinned player) never lands again. [2 s.]
   **Answered (ruling 34):** as proposed.
9. **The brought-file send** (rule 23) cannot be reached under the flag (the door that starts it went
   with the room; pinned by `composer-next-field.flag-on.test.tsx`), so its assignment has no test.
   [Set it as ruled, untested, named in the report.]
   **Answered (ruling 36):** the brought-file send is not touched; Task 7 is one import and one effect reading `nextRunInputsRef.current?.file`, built by the controller.
10. **Engagement card 1's top padding** is the intents card's (`pt-1.5` and the heading's `pt-3`, both
    headings at the same place) rather than today's average-watch card (`pt-4`); sides and bottom as
    today. [As written.]
    **Answered (ruling 34):** as proposed.
11. **Brain's columns at 320:** the name's column 96 (112 from an inside of 300), set inline from the
    measured width, so the curve and the columns always agree; the curve is 62 wide there. [As
    written.]
    **Answered (ruling 34):** as proposed; `clientWidth` as a stand-in accepted.
12. **Names:** `avg-watch` becomes `of-viewers` (the card now holds three figures); new names `count`,
    `sentence-card`, `running`, `running-strip`. `result-shots.cjs` keeps working (it lists every
    `[data-result]`). [As written.]
    **Answered (ruling 34):** as proposed.
13. **The wait's words at 320** ("Building your 1,000 viewers" with the dots and the clock, about 290
    wide in 260) wrap to two lines, so the line under the tile is one line taller than the count's
    there: a one-line jump at the landing on a 320 phone only. [Accept; the browser look decides.]
    **Answered (ruling 37):** accepted for now; the browser look at 320 decides whether the wait's line must change.
14. **The task split** has eight tasks: the layout parts come with the hero (Task 2), the composer is
    its own task (Task 7). [As written.]
    **Answered (ruling 34):** as proposed.
15. **The dev page gets a test file** (`dev-result.test.tsx`; it had none) for `cover` and `land`.
    [As written.]
    **Answered (ruling 34):** as proposed.
16. **`Most likely` shortens its row's bar track** (the tag stands after the bar, as drawn), so that
    row's fill is a share of a shorter track. [As drawn.]
    **Answered (ruling 34):** as proposed.
17. **The roster** stays read by `useRunStream` and is drawn nowhere (rule 22); `RunProgress.groups`
    stays though no part reads it now. [Keep: rule 22 says it stays read.]
    **Answered (ruling 34):** as proposed.

## Self-review

- Rules 9 and 10: Task 1 (`count.ts`), Task 2 (`ViewerCount`). 11, 12: Task 2. 13: Task 2
  (`CompactPlayer`). 14: Task 2 (`ResultFrame` from the layout parts). 15, 16: Task 3, and Task 8 for
  the coral text. 17 to 19: Task 4. 20, 21: Task 5. 22: Task 1 (`cover`, `source`) and Task 5 (drawn).
  23, as changed by 36: Task 7 (the controller). 33: Task 1 (`focusSentence`). 35: Task 5 (the
  shimmer). 24: Task 2 (the parts) and Task 5 (the wait through them; the "share their boxes" tests).
  25: Task 6. 26: Task 6 (the player is not touched; a test checks the tile does not move). 27: Task 5
  (`cover`, `groups` and `arriving` gone), Task 6 (`land`), Task 8 (`result-shots.cjs`). 28: Tasks 2,
  5 and 8. 29: Task 8. 30: Tasks 5 and 6 (keyframes; the motion guard). 31: every task, the listed test
  files rewritten (`running`, `hero`, `result-page`, `after-posting-mount`, `engagement-panel`,
  `brain-panel`, `player`, `use-run-stream`, `run-progress`, `simulation-screen`).
- The names agree across tasks: `VIEWERS`, `OF_VIEWERS`, `COUNT_WORDS`, `countAt`, `endCount`,
  `pastOpening`, `toCount`, `formatCount`, `rolledAt`, `ROLL_MS`, `mostLikely`, `restWord`,
  `SIGNAL_MEANING`, `momentLine`, `focusSentence`, `FOCUS_LEVEL`, `LEVEL_STEP`, `FirstCard`,
  `WideFrame`, `LineFrame`, `ResultFrame`, `PLOT_PX`, `STRIP_GAP_PX`, `STRIP_TILE`, `stripHeight`,
  `PHONE_COLUMN`, `PHONE_TOP_PX`, `PHONE_LINE_FALLBACK`, `WIDE_LINE_FALLBACK`, `TILE`, `RADIUS`,
  `SHADOW`, `ViewerCount`, `LandingProvider`, `useLanding`, `useLandingWindow`, `LAND`, `LANDING_MS`,
  `enter`, `stripClassName`, `firstClassName`, `afterClassName`, `restClassName`.
- No "TBD"; every task names its tests, its commands and the existing tests it rewrites.

<!-- plan complete -->

