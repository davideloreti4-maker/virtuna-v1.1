# The Thread's Answers as One System (rework step 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Under `NEXT_PUBLIC_NEW_LOOK`, every thread answer renders through one new turn renderer as the Maven label, one compact card per result (hook pack, idea pack, script, remix, video, fallback), at most one computed sentence and two chips, with text simulations fired one at a time from the cards; the old narration and the side panel are gone, desktop has a thread header, and a solid base sits under the field.

**Architecture:** Pure functions in `src/lib/thread-next/` turn a turn's raw blocks into ordered "parts" (packs grouped, narration dropped, original block indices kept). Presentational cards in `src/components/thread-next/` render a part from props. `ThreadTurnNext` replaces the legacy turn under the flag through a constant fork at the `ThreadTurn` export. A `TextSimProvider` in the composer owns the one-at-a-time `react` queue and merges results into the composer's seal map, so card state survives the live → persisted remount. The video card reads the same `useSimulationRow` cache as `/simulation/[id]`. Flag off: nothing changes.

**Tech Stack:** Next.js (app router), React 19, TypeScript, Tailwind v4 tokens (`data-look="next"`), TanStack Query, Vitest + happy-dom, Playwright for looking at it.

Spec: `docs/superpowers/specs/2026-11-21-thread-answers-design.md` (read all of it). Seams with file:line: `.scratch/next-look/part3/answers/seam-map-step1.md` (HEAD `d4204a91`; read §0, §1, §2, and the section your task names). Drawing to match: `.scratch/next-look/part3/answers/answer-system.png`; single renders `answers/renders/ax-<id>.png` (phone 393×852, desktop 1440×900, at 2x); **source `answers/answers.html`: read the functions your task ports and copy their geometry exactly** (sizes, gaps, radii, type sizes, weights, colours via the tokens they map to).

## Global Constraints

- Work only in `~/virtuna-next-look` on branch `design/next-look`. Never edit another worktree.
- **Do not commit, push or stash.** The controller snapshots the tree for review and commits only on the owner's word. The repository is public: no ids, links, tokens, handles of real accounts or account data in code, tests, fixtures or docs. Fixtures use invented handles (`@nia.tests`, `@dij.arc`, `@lacapture` are fine: drawing stand-ins).
- Flag `NEW_LOOK_ENABLED` (`src/lib/flags/new-look.ts`): **flag off must render and behave exactly as today.** Every edit to a legacy file is a constant flag branch, as small as possible. Every existing flag-off test stays green unchanged.
- **No request logic moves.** Prices, endpoints, the `react` body (`reactRequestBody`, `src/components/app/home/v8/fire-sim.ts:44-48`), write-script (`handleWriteScript`), `handleTestScript`, the stream hooks: untouched. New code calls them.
- **Numbers:** a text simulation's number is `Math.round(population.stopPct)` only. Never `seal.pct`, `fraction`, `band`, `rank`, `scrollQuote` or a projected score on any new card. Video numbers come only from `headlineOf` / `verdictOf` on the `videoStateOf` model.
- **Words:** "Simulate", never "Test" or "Testing" (the legacy `SKILL_RUN_META.test.running` is "Testing your video": do not show it). Sentence case, no uppercase labels, labels one to three words, no "usual", no "watching at 3s".
- **Colour:** ink and greys only. Coral (`--color-accent`) only on the Maven mark (already built) and the one named scene band of the video mini curve. No green, no red.
- No new dependencies. pnpm. Tests: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <path>`; types `pnpm exec tsc --noEmit`; lint `pnpm exec eslint <path>` (`react-hooks/set-state-in-effect` is on).
- Tests exercise real behaviour; stand-ins only for what cannot run (network via a `fetch` stub, file pickers, matchMedia). Never a stand-in for our own code. Write the test first and watch it fail. Flag-on tests use `vi.mock("@/lib/flags/new-look", () => ({ NEW_LOOK_ENABLED: true }))`.
- Never read `.env*` files.
- Files in `src/components/thread-next/` stay FLAT (the guard `thread-next-guard.test.ts` is not recursive): no hex, `rgb()`, `rgba()`, Tailwind palette colours or blur classes; `backdropFilter` only in `thread-field.tsx`. Type from role tokens, radii from the scale, shadows as `shadow-[var(--shadow-…)]` (never `shadow-float`). The guards `type-scale`, `radius-scale`, `section-label-scale` scan `thread-next`.
- Every control ≥ 44 px to tap (`.tap-44` where the drawn size is smaller); focus always visible; every button named (a gauge's name includes the text it simulates: "Simulate: I spent $40 …", truncated to 60 characters).
- A part with visible UI is not done until it was rendered and compared with the drawing at full window size (never a cropped box). Say plainly what you did not check.
- Dev server (run by the controller): `http://localhost:3021`, flag on. Send POSTs from `localhost`, not `127.0.0.1`. Cookies: `.scratch/next-look/cookie.json` (mint from the trunk: seam map §0.5). Screenshot pattern: `.scratch/next-look/part3/task4-shots.cjs`.

## File Structure

```
src/lib/thread-next/                     pure, no React                                        (Task 1)
  answer-parts.ts      partsOf(blocks) -> AnswerPart[]; RESULT_TYPES; hasResultCard(blocks)
  pack-lead.ts         leadOf(values), leadSentence(kind, lead)
  beat-timing.ts       timingStart(s), timingEnd(s), clockLabel(sec)
  remix-steps.ts       formatSteps(formatBorrowed)
  fallback-lines.ts    fallbackOf(block) -> { title, lines }
  next-followups.ts    nextFollowups(kind) -> ChatFollowup[]
  thread-audience.ts   threadAudienceOf(turns, liveLabel?) -> string | null
  stop-number.ts       stopNumberOf(seal) -> number | null
  __tests__/*.test.ts

src/components/thread-next/              new-look only, flat
  answer-gauge.tsx     SmallGauge (empty | waiting | running | done)                         (Task 2)
  answer-card.tsx      AnswerCard shell, CardHeader, AnswerPrimary (ink button + em price)   (Task 2)
  pack-answer.tsx      PackAnswer (hooks and ideas)                                          (Task 2)
  waiting-row.tsx      WaitingRow ("Writing hooks" + dots)                                   (Task 2)
  script-answer.tsx, remix-answer.tsx, fallback-answer.tsx, mini-curve.tsx,
  video-answer.tsx (VideoAnswerView + VideoAnswer), video-running.tsx                        (Task 3)
  text-sim.tsx         TextSimProvider, useTextSim                                           (Task 4)
  thread-turn-next.tsx ThreadTurnNext                                                        (Task 5)
  thread-header.tsx    DesktopThreadHeader                                                   (Task 6)
  __tests__/…

src/app/(app)/dev/answers/page.tsx + dev-answers.tsx    every drawn state from fixtures      (Tasks 2-3)
src/components/thread-next/__tests__/fixtures/answers.ts  fixture blocks (shared by tests and /dev/answers)
   (fixtures live in __tests__/fixtures/; the guard reads only files directly in thread-next)

Legacy files touched (flag branches only):
  src/components/thread/thread-turn.tsx        rename body to ThreadTurnLegacy; ThreadTurn = constant fork   (Task 5)
  src/components/app/home/composer.tsx         TextSimProvider, openRoomForCard null, video turn order and
                                               card, room/sheet/presence gates, header row, base layer,
                                               audience to the shell store                               (Tasks 4-6)
  src/components/app/home/home-page-layout.tsx railMounted false under the flag                           (Task 6)
  src/stores/shell-store.ts                    threadAudience                                             (Task 6)
  src/components/shell/pushed-header.tsx       optional subtitle                                          (Task 6)
  src/components/shell/next-shell.tsx          passes the subtitle in a thread; useThreadTitle extracted  (Task 6)
  src/components/thread/thread-loading.tsx     skeleton without the old label under the flag              (Task 6)
```

---

### Task 1: The answer model (pure functions)

**Files:** Create everything under `src/lib/thread-next/` listed above, with tests in `src/lib/thread-next/__tests__/`.

**Interfaces (Produces):**

```ts
// answer-parts.ts
import type { HookCardBlock, IdeaCardBlock, ScriptCardBlock, RemixCardBlock } from "@/lib/tools/blocks";
import type { VideoTestCardBlock } from "@/lib/tools/profile-blocks";
export interface Indexed<B> { index: number; block: B }          // index = position in the ORIGINAL blocks array
export type AnswerPart =
  | { kind: "hooks"; items: Indexed<HookCardBlock>[] }
  | { kind: "ideas"; items: Indexed<IdeaCardBlock>[] }
  | { kind: "remix"; items: Indexed<RemixCardBlock>[] }
  | { kind: "script"; item: Indexed<ScriptCardBlock> }
  | { kind: "video"; item: Indexed<VideoTestCardBlock> }
  | { kind: "text"; index: number; text: string }               // markdown, only in a turn with no result card
  | { kind: "legacy"; index: number; block: unknown }            // input-request, outlier-grid (validated)
  | { kind: "fallback"; index: number; block: { type: string; props: unknown } };
export const RESULT_TYPES: ReadonlySet<string>;  // hook-card idea-card script-card remix-card video-test-card composed-card
                                                 // outlier-grid account-read profile-read multi-audience-read brought-card
                                                 // reaction-distribution prediction-gauge band personas
export function hasResultCard(blocks: readonly unknown[]): boolean;
export function partsOf(blocks: readonly unknown[]): AnswerPart[];
// pack-lead.ts
export interface Lead { allDone: boolean; top: number | null; best: number | null; lead: number | null }
export function leadOf(values: readonly (number | null)[]): Lead;     // top/best are 0-based row indices
export function leadSentence(kind: "hook" | "idea", l: Lead): string | null;
// beat-timing.ts
export function timingStart(s: string): number | null;   // seconds
export function timingEnd(s: string): number | null;
export function clockLabel(sec: number): string;         // 0 -> "0:00", 24 -> "0:24", 75 -> "1:15"
// remix-steps.ts
export function formatSteps(formatBorrowed: string): string[];   // split on → / ->, trimmed, "Borrowed:" prefix dropped, max 4
// fallback-lines.ts
export function fallbackOf(block: { type: string; props: unknown }): { title: string; lines: string[] };
// next-followups.ts
export function nextFollowups(kind: ChatTurnKind): ChatFollowup[];
// thread-audience.ts
export function threadAudienceOf(turns: readonly { blocks: readonly unknown[] }[], liveLabel?: string | null): string | null;
// stop-number.ts
export function stopNumberOf(seal: unknown): number | null;
```

Rules the code must follow (from the spec §3, §4):
- `partsOf`: validate each block with `validateBlock` (`src/lib/tools/block-registry.ts`); an invalid block becomes `fallback` with `{ type: "unknown", props: {} }`. `run-header` yields nothing. Consecutive `hook-card` blocks form one `hooks` part (any other block in between closes the run), the same for `idea-card` → `ideas`, `remix-card` → `remix`. `input-request`, `outlier-grid` → `legacy`. `markdown` → `text` only when `hasResultCard(blocks)` is false (a `corpus-references`, `persona-chat-turn` or `input-request` does not make a result card); otherwise dropped. Every other type → `fallback`. Indices always refer to the original array.
- `leadOf`: `allDone` = every value is a number; `top` = index of the highest (first on a tie) among numbers, null when none; `best` = `top` only when `allDone`, there are ≥ 2 rows and `values[top] - secondHighest >= 10`; `lead` = that difference when `allDone` and ≥ 2 rows, else null.
- `leadSentence`: null unless `allDone` and ≥ 2 rows; with a best: "Hook {best+1} leads by {lead} points." / "Idea …"; without: "No clear winner."
- `timingStart` / `timingEnd` read "0–3s", "0-3s", "3–15s", "0:00–0:03", "0:03-0:08", "15s", "0:20"; en dash, hyphen or "to" as the separator; anything else → null. `timingEnd` of a single value is null.
- `fallbackOf` per the spec table §4.6; titles trimmed, empty lines dropped; unknown → `{ title: "Answer", lines: [] }`.
- `nextFollowups`: by label from `followupsForKind` (`src/lib/tools/chat-followups.ts`): hooks [More hooks, Punch them up], ideas [More ideas, Sharper angles], script [Make it punchier, Different angle], remix [More like this, Write hooks], test [Rewrite the hook, Fix the pacing], chat [Give me ideas, Write hooks]; any other kind: its first two. Return the original objects (prompt, skill, carryCards intact).
- `threadAudienceOf`: the `audienceLabel` of the LAST `run-header` across the turns, else `liveLabel`; null when missing, empty, "General" or "your audience".
- `stopNumberOf`: `Math.round(seal.population.stopPct)` when finite and 0..100, else null (sealed wire seals, older seals without a population, anything else).

- [ ] **Step 1: Write the failing tests** (one file per module). The core cases, verbatim:

```ts
// answer-parts.test.ts
import { describe, expect, it } from "vitest";
import { partsOf, hasResultCard } from "@/lib/thread-next/answer-parts";
import { hook, idea, remix, md, runHeader, corpus, inputRequest, composed } from "@/components/thread-next/__tests__/fixtures/answers";

describe("partsOf", () => {
  it("groups a run of hook cards into one pack and keeps original indices", () => {
    const blocks = [runHeader("hooks"), hook("A"), hook("B"), hook("C"), md("Hook #1 wins by a mile.", "chat-agent")];
    const parts = partsOf(blocks);
    expect(parts).toHaveLength(1);
    expect(parts[0].kind).toBe("hooks");
    expect(parts[0].kind === "hooks" && parts[0].items.map((i) => i.index)).toEqual([1, 2, 3]);
  });
  it("drops narration markdown in a turn with a result card, live (no origin) or persisted", () => {
    expect(partsOf([md("On it, generating a few angles"), hook("A"), md("The first one lands best.")]).map((p) => p.kind)).toEqual(["hooks"]);
  });
  it("keeps a plain chat answer and its sources", () => {
    expect(partsOf([md("The contrast opens a gap."), corpus()]).map((p) => p.kind)).toEqual(["text", "fallback"]);
  });
  it("two runs separated by prose are two packs", () => {
    expect(partsOf([hook("A"), hook("B"), md("And five more:"), hook("C")]).map((p) => p.kind)).toEqual(["hooks", "hooks"]);
  });
  it("interactive blocks stay legacy; others fall back", () => {
    expect(partsOf([inputRequest(), composed()]).map((p) => p.kind)).toEqual(["legacy", "fallback"]);
    expect(hasResultCard([inputRequest(), md("x")])).toBe(false);
  });
  it("a run of remix cards is one part", () => {
    const p = partsOf([remix("x"), remix("y"), remix("z")]);
    expect(p).toHaveLength(1);
    expect(p[0].kind === "remix" && p[0].items).toHaveLength(3);
  });
  it("an ideas pack is one part", () => {
    expect(partsOf([idea("T1"), idea("T2"), idea("T3"), idea("T4")])).toHaveLength(1);
  });
});
```

```ts
// pack-lead.test.ts
import { leadOf, leadSentence } from "@/lib/thread-next/pack-lead";
it("marks best only with a 10-point lead and all rows done", () => {
  expect(leadOf([30, 22, 45])).toEqual({ allDone: true, top: 2, best: 2, lead: 15 });
  expect(leadOf([30, 22, 38])).toEqual({ allDone: true, top: 2, best: null, lead: 8 });
  expect(leadOf([30, null, 45])).toEqual({ allDone: false, top: 2, best: null, lead: null });
  expect(leadOf([null, null])).toEqual({ allDone: false, top: null, best: null, lead: null });
  expect(leadOf([40, 40])).toEqual({ allDone: true, top: 0, best: null, lead: 0 });
});
it("writes the sentence", () => {
  expect(leadSentence("hook", leadOf([30, 22, 45]))).toBe("Hook 3 leads by 15 points.");
  expect(leadSentence("idea", leadOf([50, 30]))).toBe("Idea 1 leads by 20 points.");
  expect(leadSentence("hook", leadOf([30, 22, 38]))).toBe("No clear winner.");
  expect(leadSentence("hook", leadOf([30, null]))).toBeNull();
  expect(leadSentence("hook", leadOf([30]))).toBeNull();
});
```

```ts
// beat-timing.test.ts
import { timingStart, timingEnd, clockLabel } from "@/lib/thread-next/beat-timing";
it.each([["0–3s", 0, 3], ["3-15s", 3, 15], ["0:03–0:08", 3, 8], ["15s", 15, null], ["0:20", 20, null], ["20 to 24s", 20, 24], ["Hook", null, null]])(
  "%s", (s, a, b) => { expect(timingStart(s)).toBe(a); expect(timingEnd(s)).toBe(b); });
it("labels", () => { expect(clockLabel(0)).toBe("0:00"); expect(clockLabel(24)).toBe("0:24"); expect(clockLabel(75)).toBe("1:15"); });
```

```ts
// remix-steps.test.ts, next-followups.test.ts, thread-audience.test.ts, stop-number.test.ts, fallback-lines.test.ts
expect(formatSteps("Borrowed: Visual Hook → Concept Definition → Tools Required → Footage")).toEqual(["Visual Hook", "Concept Definition", "Tools Required", "Footage"]);
expect(formatSteps("A -> B → C → D → E")).toEqual(["A", "B", "C", "D"]);
expect(nextFollowups("hooks").map((f) => f.label)).toEqual(["More hooks", "Punch them up"]);
expect(nextFollowups("hooks")[1].carryCards).toBe(true);
expect(threadAudienceOf([{ blocks: [runHeader("hooks", "@nia.tests")] }, { blocks: [runHeader("script", "General")] }])).toBeNull(); // last wins, General hidden
expect(threadAudienceOf([{ blocks: [runHeader("hooks", "@nia.tests")] }])).toBe("@nia.tests");
expect(threadAudienceOf([], "@nia.tests")).toBe("@nia.tests");
expect(stopNumberOf({ pct: 70, population: { stopPct: 29.6 } })).toBe(30);
expect(stopNumberOf({ pct: 70 })).toBeNull();
expect(stopNumberOf({ sealed: true })).toBeNull();
expect(fallbackOf(composed()).title).toBe("Two hooks compared");   // fixture's deliverable.text
expect(fallbackOf({ type: "band", props: {} })).toEqual({ title: "Answer", lines: [] });
```

- [ ] **Step 2: Create the shared fixtures** `src/components/thread-next/__tests__/fixtures/answers.ts`: builders `hook(text)`, `idea(title, angle?)`, `script(beats?)`, `remix(adaptedHook, opts?)`, `video(analysisId)`, `md(text, origin?)`, `runHeader(skill, audienceLabel?)`, `corpus()`, `inputRequest()`, `composed()`, each returning a block that passes `validateBlock` (build from the schemas in `src/lib/tools/blocks.ts` / `profile-blocks.ts` / `composed-card-schema.ts`; fill every required prop). Plus the drawing's content as named packs: `MEAL_PREP_HOOKS` (the three hook texts of `answers.html` `AXH`, with `mechanism`, `visualHook`, `proof` of hook 1), `IDEAS_4` (`AXID`), `SCRIPT_AI` (opening line + `AXSC`, timings "0–3s", "3–8s", "8–14s", "14–20s", "20–24s"), `REMIX_CAMERA` (adapted hook, `formatBorrowed` "Visual Hook → Concept → Tools → Footage", proof handle `@lacapture`, views 154000, multiplier 10.4, baselineLabel "their average"), `SEALS_DONE` = `{ [hook1]: { pct: 70, band: null, at: "2026-11-21T00:00:00Z", population: { …, stopPct: 30 } }, [hook2]: …22, [hook3]: …45 }` (population objects must satisfy `PopulationAggregate`: build one helper `population(stopPct)`). Add a test that every builder's block passes `validateBlock`.
- [ ] **Step 3: Run the tests, watch them fail** (`NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/thread-next`).
- [ ] **Step 4: Implement the modules** to the rules above.
- [ ] **Step 5: Run the tests, tsc, eslint on the folder.** All green.

---

### Task 2: The gauge, the card, the pack, the waiting row (presentational)

**Files:** Create `answer-gauge.tsx`, `answer-card.tsx`, `pack-answer.tsx`, `waiting-row.tsx` in `src/components/thread-next/`; tests in `src/components/thread-next/__tests__/`; create `src/app/(app)/dev/answers/page.tsx` + `dev-answers.tsx` + `__tests__/page.test.ts` (copy the `/dev/field` pattern: server page, `notFound()` when the flag is off, state from `?state=`).

**Port from `answers.html`:** `mg()` (line ~1070) and `axG`/`axG0`/`axGw`/`axGrun` (~1243) for the gauge, `.ax[data-skin] --track` (0.12 light, 0.17 dark): add a NEW token `--color-gauge-track` to the new-look light and dark token blocks of `globals.css` (light `rgba(18, 18, 17, 0.12)`, dark `rgba(255, 255, 255, 0.17)`) and use it for the thread gauges and the mini curve's empty track; do NOT change `--color-track` (the approved result page uses it) or any existing `@theme` value; add the row the token-drift guard asks for in `docs/DESIGN-SYSTEM.md` "Next look", `axHooks` + `.tq-card`, `.tq-h`, `.tq-hook`, `.ax-gc`, `.ax-best`, `.tq-prog`, `.tq-f`, `cta()` + `price()` for the card and primary, `.ax-id` for the idea rows, `axNx` is slice 1's `FollowupChips` (already built).

**Interfaces:**

```ts
// answer-gauge.tsx
export type GaugeState = { kind: "empty" } | { kind: "waiting" } | { kind: "running" } | { kind: "done"; value: number };
export function SmallGauge(p: { state: GaugeState; size?: number /* 46 */; label: string; onSimulate?: () => void }): JSX.Element;
//  empty: a <button aria-label={`Simulate: ${label}`}> (disabled when onSimulate is absent) with the pulse glyph;
//  waiting: the empty track, dimmed, not a button; running: the dotted ring (axGrun), aria-label "Simulating";
//  done: ink arc + number, a <span role="img" aria-label={`${value}% would stop to watch`}> (not a link in step 1).
//  Under prefers-reduced-motion the running ring does not rotate.
// answer-card.tsx
export function AnswerCard(p: { children: React.ReactNode; className?: string }): JSX.Element;      // .card.tq-card
export function CardHeader(p: { left: React.ReactNode; right?: React.ReactNode }): JSX.Element;      // .tq-h
export function AnswerPrimary(p: { icon: React.ReactNode; label: string; price?: number; onClick?: () => void; href?: string; trailingArrow?: boolean }): JSX.Element;
//  the ink 50-tall button of cta(); price -> <em>"N credit(s)"</em>; disabled (aria-disabled) with no onClick/href.
// pack-answer.tsx
export interface PackRow { key: string; text: string; sub?: string | null; state: GaugeState; failed?: boolean }
export function PackAnswer(p: {
  kind: "hook" | "idea"; rows: PackRow[];
  queue: { done: number; total: number } | null;          // non-null while Simulate all runs: progress line replaces the primary
  onSimulate?: (key: string) => void; onSimulateAll?: () => void; onScript?: (rowIndex: number) => void;
}): JSX.Element;
//  header "Would stop to watch" + right "1 credit each" while any row is empty; "Best" pill under the gauge of leadOf(...).best;
//  primary: any row empty -> "Simulate all N" price N (N = empty rows); all done -> "Script the best" / "Script hook K" | "Script idea K", price 2.
//  failed row -> "Couldn't simulate" (text-meta, secondary) under its text.
// waiting-row.tsx
export function WaitingRow(p: { label: string }): JSX.Element;    // three soft dots + label, aria-live="polite"
```

- [ ] **Step 1: Failing tests** (`pack-answer.test.tsx`, happy-dom, flag mocked on). Real behaviour through the DOM:

```tsx
it("not simulated: empty gauges, '1 credit each', primary 'Simulate all 3' with '3 credits'", …);
it("tapping an empty gauge calls onSimulate with that row's key", …);
it("queue running: no primary button, '2 of 3' shown", …);
it("all done with a 15-point lead: 'Best' on row 3, primary 'Script the best', onScript(2)", …);
it("all done without a lead: no 'Best', primary 'Script hook 3'", …);
it("a failed row says 'Couldn't simulate' and keeps an enabled Simulate button", …);
it("no handlers: buttons render disabled, nothing throws", …);
it("idea rows show the title and the grey line, primary 'Script idea 1' when idea 1 leads without a 10-point lead", …);
```
plus `answer-gauge.test.tsx` (names, states, the button only when empty) and the dev page test (404 when the flag is off; each state renders).
- [ ] **Step 2: Run, watch them fail.**
- [ ] **Step 3: Implement**, porting the geometry. Use `leadOf` for Best and the primary label.
- [ ] **Step 4: `/dev/answers?state=p3|p4|p5|p12` with `?skin=dark` support** rendering the fixture packs inside the real `NextAssistantTurn` and a 393 / 1440 wide column, so the controller can screenshot them next to `ax-p3.png` etc.
- [ ] **Step 5: Tests, tsc, eslint green. Render `/dev/answers` p3, p4, p5, p12 phone + p5 dark next to the drawing renders at full size (script under `.scratch/next-look/part3/answers/`), list differences, fix, re-render.**

---

### Task 3: Script, remix, fallback and video cards (presentational + the video data hook)

**Files:** Create `script-answer.tsx`, `remix-answer.tsx`, `fallback-answer.tsx`, `mini-curve.tsx`, `video-answer.tsx`, `video-running.tsx`; tests; extend `/dev/answers` with p8, p9, p10, p11, p13, d3.

**Port from `answers.html`:** `axScript` + `.tq-beat`, `.ax-b0`, `.ax-slot`; `axRemix` + `.ax-rsrc`, `.ax-rh`, `.ax-steps` (grey discs), the remix pager = v11 `.tq-pg` dots + two 44 px arrow buttons; `axChat` `.ax-fb` for the fallback; `axVideoDone` / `axVideoDoneDesk` + `.ax-vd*` + `axCurve` for the video; `axVideoRun` + `axBigRun` for the running card.

**Interfaces:**

```ts
export function ScriptAnswer(p: { block: ScriptCardBlock; opener: { state: GaugeState; onSimulate?: () => void }; onAddTake?: () => void }): JSX.Element;
//  header "Script" + total clockLabel(timingEnd(last.timing)) when it parses; rail rows: clockLabel(timingStart) or none, beat.content;
//  under beat 0 the slot: SmallGauge size 30 + "Simulate the opening" + "1 credit" (slot text "Simulate the opening" only while empty;
//  when done: the gauge with its number + "would stop to watch"); primary "Add your take" (upload icon, no price, trailing arrow).
export function RemixAnswer(p: { items: RemixCardBlock[]; hookOf: (adaptedHook: string) => { state: GaugeState; onSimulate?: () => void }; onScript?: (adaptedHook: string) => void }): JSX.Element;
//  one card; page index state; source row: cover (proof.coverUrl ?? coverUrl; img with onError -> neutral tile), "@handle",
//  "{multiplier}× {baselineLabel} · {views} views" when proof.multiplier, else "{views} views" (compact: 154K);
//  headline “adaptedHook”; slot "Simulate the hook" + "1 credit"; steps formatSteps(formatBorrowed); primary "Script it" price 2;
//  pager only when items.length > 1: dots (current ink) + "Previous" / "Next" buttons, named "Remix 2 of 3".
export function FallbackAnswer(p: { title: string; lines: string[] }): JSX.Element;   // 3 lines, "Show all" expands in place (button, aria-expanded)
export function MiniCurve(p: { points: readonly (readonly [number, number])[]; clipS: number; band: { t0: number; t1: number } | null; width: number; height: number }): JSX.Element;
//  axCurve: filled area (ink 4%), base line, scene ticks, ink line, the band in --color-accent at its drawn opacity, line coral inside the band.
export function VideoAnswerView(p: { state: ResultState; posterUrl: string | null; href: string; desktop: boolean }): JSX.Element;
//  result: thumbnail + Gauge (src/components/result/gauge.tsx, size 140, headline) + MiniCurve(model.audience.points, verdict scene band) + sentence + "Open simulation";
//  loading/running: thumbnail + the gauge track with no number + "Open simulation"; no-audience/stalled/not found: thumbnail + "Open simulation".
//  desktop: the .ax-vd layout (picture 120 left; gauge + sentence row, curve 532×64 under it).
export function VideoAnswer(p: { block: VideoTestCardBlock }): JSX.Element;
//  const { row, notFound } = useSimulationRow(block.props.analysisId); state = notFound ? {kind:"stalled",…} : videoStateOf(row);
//  posterUrl = first scene frame of the model, else block.props.filmstrip?.[0]?.keyframeUrl ?? null; href = resultHref(analysisId);
//  desktop from useMediaQuery("(min-width: 768px)") (use the project's existing hook; find it with grep, do not add one).
export function VideoRunning(p: { file: File | null; analysisId: string | null }): JSX.Element;
//  const [startedAt] = useState(() => Date.now()); a 1 s interval clock (clockLabel); label "uploading" while !analysisId, else "running";
//  thumbnail useVideoMeta(file).thumbnail (src/hooks/use-video-meta.ts); primary "Watch it run" (play icon, link to resultHref(analysisId)),
//  rendered only when analysisId exists. aria-live polite on the label, not on the clock.
```

- [ ] **Step 1: Failing tests:** script times and total from timings, no times when unparseable, opener slot calls `onSimulate`, "Add your take" calls `onAddTake`; remix source line with and without multiplier, steps, pager moves and names, "Script it" passes the current page's `adaptedHook`; fallback shows 3 lines then all after "Show all"; `VideoAnswerView` with a real `ResultState` built by `videoStateOf` from a stored-row fixture (reuse the fixtures of `src/lib/result/__tests__/` — find the row fixture used by `video-model` tests) shows the headline number, the verdict sentence and a link to `/simulation/<id>`; loading shows no number; `VideoRunning` shows "uploading" without an id and a "Watch it run" link with one (use fake timers for the clock: 0:00 → 0:41 after 41 s).
- [ ] **Step 2: Run, watch them fail. Step 3: implement. Step 4: dev states p8, p9, p10, p11, p13, d3 (video states from the same row fixture). Step 5: tests, tsc, eslint; render each dev state next to its drawing at full size, fix, re-render.**

---

### Task 4: Text simulations, one at a time (`TextSimProvider`)

**Files:** Create `src/components/thread-next/text-sim.tsx` + `__tests__/text-sim.test.tsx`. Modify `src/components/app/home/composer.tsx`: wrap the children of `threadContent` (`C:3317-3362`) in `<TextSimProvider>` under the flag; under the flag `openRoomForCard` provided as `null` (`C:3319`).

**Interfaces:**

```ts
export type TextKind = "hook" | "idea" | "script" | "remix";   // the legacy descriptor kinds (ambient-descriptors.ts KIND_BY_BLOCK_TYPE)
export interface TextSimApi {
  stateOf(text: string): GaugeState;              // from the seal map (stopNumberOf) or the queue: running | waiting | empty | done
  failed(text: string): boolean;
  fire(text: string, kind: TextKind): void;       // enqueue one (no-op if done, queued or running)
  fireAll(items: { text: string; kind: TextKind }[]): void;   // enqueue the not-done ones, in order
  progress(texts: readonly string[]): { done: number; total: number } | null;  // non-null while any of these is queued or running
}
export function TextSimProvider(p: { seals: WireSimSealMap; onSealed: (key: string, seal: SimSeal) => void; children: React.ReactNode }): JSX.Element;
export function useTextSim(): TextSimApi | null;   // null outside the provider (cards then render their gauges disabled)
```

Behaviour:
- Keys are `sealKey(text)` (`src/lib/threads/sim-seals.ts`): trimmed. Duplicate texts share one state.
- ONE request in flight in the whole provider; the queue is FIFO. Body `reactRequestBody({ text, kind })` to `POST /api/tools/react`, exactly as the legacy fire sends it (`use-fire-sim.ts:44`): hook and idea get their framing, script and remix the route default.
- 200: `onSealed(key, { pct: <fractionToStopPct or 0>, band: null, at: new Date().toISOString(), population: data.population ?? null, personas: data.personas, scrollQuote: data.scrollQuote })`; if `population` is missing the key is marked failed (billed but no number; spec §8). Then the next in the queue.
- 402: `reportCredit402(status, body)` (`src/lib/billing/credit-wall.ts:33`), mark this key failed, CLEAR the rest of the queue (do not keep spending).
- Other status or a network error: mark failed, continue with the next.
- State lives in the provider (rendered by the composer, above the thread), so a turn's remount on the live → persisted swap keeps it.
- `progress(texts)`: counts how many of `texts` became done since they were queued together; `{ done, total }` where total = the count enqueued by the `fireAll` that is running.

In the composer: `onSealed = (key, seal) => setPersistedSimSeals((m) => ({ ...m, [key]: seal }))` (`C:514`). Seals reload with the thread (`C:1207`); nothing else changes.

- [ ] **Step 1: Failing tests** with a `fetch` stub (the network is the boundary; the provider is real): queue runs strictly one at a time (assert the second request starts only after the first resolves), order kept, `fire` on a done key does nothing, duplicates share state, `stateOf` reads `population.stopPct` from `seals` (rounded), a 200 without population → failed, a 402 stops the queue and calls the credit wall (spy on `reportCredit402`'s module only if it touches `window`; otherwise assert its observable effect), `progress` goes 0/3 → 1/3 → 2/3 → null.
- [ ] **Step 2: Run, fail. Step 3: implement. Step 4: composer wiring (no composer integration test here: the pack renders in the thread only after Task 5, which carries that test).**
- [ ] **Step 5: Tests (the new file, the composer flag-on file, and every flag-off composer suite), tsc, eslint.**

---

### Task 5: `ThreadTurnNext` and the fork

**Files:** Create `src/components/thread-next/thread-turn-next.tsx` + `__tests__/thread-turn-next.flag-on.test.tsx`. Modify `src/components/thread/thread-turn.tsx`: rename the function body to `ThreadTurnLegacy` (not exported), add
```tsx
export function ThreadTurn(props: ThreadTurnProps) {
  return NEW_LOOK_ENABLED ? <ThreadTurnNext {...props} /> : <ThreadTurnLegacy {...props} />;
}
```
(the flag is a build-time constant; no hook runs before the branch). Update `src/components/thread-next/__tests__/thread-frame.flag-on.test.tsx:311-316` (it pinned the legacy outro text under the flag: the new turn shows no outro text; assert that instead).

**`ThreadTurnNext(props: ThreadTurnProps)`** renders:
1. The user turn exactly as `ThreadTurn` does today under the flag (`<ThreadUserTurn text video={videoOfTurn(blocks)} />`).
2. If there is assistant content: `<NextAssistantTurn>` with, in order:
   - the error (`SkillRunError` with `runErrorCopy`, exactly as `TT:352-365`), when `live.error && !isStreaming`;
   - while the run is live (`runLive`, same definition as `TT:245`) or `thinking` (`TT:324`): `<WaitingRow label>`; label = `SKILL_RUN_META[skill]?.running` for hooks/ideas/script/remix/explore/account, else "Thinking". Nothing else of the run while live except, for a turn whose skill is `chat` and that has no result card, its streaming text;
   - after the run: `partsOf(blocks)` mapped:
     - `hooks` → `PackAnswer kind="hook"` rows from `items` (`key = sealKey(hookLine)`, `text = hookLine`, state from `useTextSim()?.stateOf`), `onSimulate` → `fire(text,"hook")`, `onSimulateAll` → `fireAll`, `onScript(i)` → `useOnWriteScriptHook()?.(rows[i].text, items[i].block.props.audienceArchetype ?? "")`; under the card `leadSentence("hook", leadOf(values))` as one line (`text-body`, 15.5/22 per `axLine`) when non-null;
     - `ideas` → the same with `kind="idea"`, text = `title`, sub = `angle || take || null`, script with `seedHook || title`;
     - `script` → `ScriptAnswer`, opener = `openingBeatSeed || beats[0].content`, kind `script`, `onAddTake` → `useOnTestScript()?.(opener, brief)` where brief is built exactly as `script-card-block.tsx` builds it today (import or lift that function; do not re-implement it differently);
     - `remix` → `RemixAnswer`, `hookOf(t)` → state/fire with kind `remix`, `onScript` → write-script with the adapted hook;
     - `video` → `VideoAnswer`;
     - `text` → the markdown renderer used today for chat text (`MarkdownBlockRenderer`), no card;
     - `legacy` → `MessageBlocks body={[block]}` for that one block (original index passed through `blockOrigins`);
     - `fallback` → `FallbackAnswer {...fallbackOf(block)}`;
     - every part is wrapped in `BlockOriginContext.Provider` with `blockOrigins?.[originalIndex]` (packs: the first item's index) so Save keeps its message ref;
   - the chips: `showFollowups && !runLive` → `<FollowupRow followups={nextFollowups(skill)} cardLines={cardLinesOf(bodyWithoutTrailingOutro)} />` (FollowupRow already renders slice 1's chips under the flag).
3. NOT rendered: `ThreadIntro`, `SkillProgress`, `RunWarnings`, `OutliersOffer`, `ThreadOutro` text, forward chip, `outroFallback`, any markdown in a result turn. No `data-ambient-card` anchors (the room is off).

- [ ] **Step 1: Failing tests** (flag on, real `ThreadTurn` export, fixtures from Task 1, the real `TextSimProvider` around it with a fetch stub): a stamped hooks turn with a trailing outro and a chat-agent sentence shows ONE card, no "Pulled hooks", no "Ran your audience", no outro text, no "Write a script from #1"; a chat turn shows its text and its chips; chips only when `showFollowups`; a live hooks run shows "Writing hooks" and no cards until settled; an errored live run shows the error and Retry; a pack's Save ref equals the original block index (render with `blockOrigins` and assert the context value through a probe child that reads `BlockOriginContext`); the lead sentence appears only when all rows have numbers (seals fixture `SEALS_DONE`); and, in `composer-next-field.flag-on.test.tsx` (its URL-switch fetch stub, `/api/threads/open` returning a hooks thread and `/api/tools/react` returning a population), a hook pack in a reloaded thread fires `react` once per tap, one request at a time, and shows the number.
- [ ] **Step 2: Run, fail. Step 3: implement. Step 4: run the flag-on frame tests and EVERY flag-off thread suite listed in seam map §9.2 unchanged. Step 5: tsc, eslint.**

---

### Task 6: The frame: side panel off, headers, base, video turn order

**Files:** Modify `home-page-layout.tsx`, `composer.tsx`, `shell-store.ts`, `pushed-header.tsx`, `next-shell.tsx`, `thread-loading.tsx`; create `src/components/thread-next/thread-header.tsx` and `src/components/shell/use-thread-title.ts`; tests beside each.

1. **Rail off:** `home-page-layout.tsx:128` → `const railMounted = !NEW_LOOK_ENABLED && (threadMode || arrivalRail);`. In the composer under the flag: no rail portal (`C:4024-4025`), `useHeader` false (`C:2600`) so the phone room sheet and its header slot never mount, the docked `AudiencePresence` (`C:4026-4028`) never mounts.
2. **Video turn order and card:** under the flag render `{testSubmitTurn}{testFailedTurn}` AFTER `<PersistedThreadStream>` (move them below it inside `threadContent`; flag off keeps today's order), and under the flag `testSubmitTurn` = `<ThreadShell userTurn={lastUserTurn} userVideoFile={testTurnVideo}><ThreadAssistantTurn><VideoRunning file={testTurnVideo ?? null} analysisId={stream.analysisId ?? null} /></ThreadAssistantTurn></ThreadShell>`, one element for the upload and the analyzing phase (so its clock does not restart).
3. **Desktop header:** `DesktopThreadHeader({ title, audience })`: `hidden md:flex h-[68px] items-center gap-2.5 pl-3 pr-8` (copy `ResultHeader`), `<h1 className="text-title font-[640] tracking-[-0.014em]">{title}</h1>` + `<span className="text-body text-foreground-tertiary">For {audience}</span>` when audience. Rendered by the composer in Branch A as a `shrink-0` row before the scroll region (`C:4264-4275`) under the flag in thread mode; the sr-only `<h1>Conversation</h1>` (`C:4344`) is not rendered under the flag then. Title: `useThreadTitle()` = the derivation now inline in `next-shell.tsx:65-68` (extract it to `src/components/shell/use-thread-title.ts`; NextShell uses the hook). Audience: `threadAudienceOf(persistedStreamTurns, liveTurn?.live?.audienceLabel)`.
4. **Phone subtitle:** `shell-store.ts` gains `threadAudience: string` + `setThreadAudience` (not persisted; same pattern as `pushedTitle`). The composer publishes it under the flag (effect with cleanup to ""). `PushedHeader` gets `subtitle?: string` rendered as a second line (`text-meta text-foreground-tertiary`, centred, truncated) under the title, keeping the 40 px band height (title and subtitle stack inside it: port `.nav b` / `.ax-sub`: 12 px, 500, margin-top 2). `NextShell` passes `subtitle={threadAudience ? \`For ${threadAudience}\` : undefined}` in a thread.
5. **Base under the field:** inside `NEXT_DOCK` (`C:278`, mounted `C:4432-4435`), first child: `<div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(var(--field-reserve)/2+30px)] md:h-[calc(var(--field-reserve)/2+24px)] bg-background" />` plus a 24 px fade above it (`.composer-veil`'s mask pattern, `globals.css:1345-1348`). Do not change `pb-[30px]` / `md:pb-[24px]` (pinned).
6. **Skeleton:** `ThreadLoadingSkeleton` under the flag renders without the old "MAVEN" label (use `AssistantLabel` from `assistant-label.tsx` or nothing; match the drawing's label).
7. **Tests to update on purpose (flag on):** `composer-next-field.flag-on.test.tsx:186-201` (no `audience-header-slot`), `:432-437` (no `ambient-overview-sheet`), `:439-446` and `:1232-1279` (remove: the room no longer opens; replace with "a remix card's 'Simulate the hook' fires `react` once and never mounts `ambient-sheet-panel`"), `video-test-card-simulate-door.flag-on.test.tsx` (the legacy card no longer renders under the flag: re-point at `VideoAnswer`'s link). New: the live video turn renders after the history (render a thread with one persisted turn + a pending video run; assert DOM order); header shows title and "For @nia.tests"; `railMounted` false under the flag.

- [ ] **Step 1: Failing tests for 1-7. Step 2: run, fail. Step 3: implement. Step 4: every composer and layout suite, flag on and off. Step 5: tsc, eslint.**

---

### Task 7: Checks (controller)

- [ ] Dev server on 3021 (flag on); fresh cookie.
- [ ] `/dev/answers` every state, phone + desktop, light + dark, side by side with `answers/renders/ax-*.png` at full window size; fix differences.
- [ ] Real threads in a browser, phone 393×852 and desktop 1440×900, light and dark: a hooks thread with stored seals, an ideas thread, a script, a remix with three cards, a video thread, a chat answer, a thread with a fallback type. Full-window screenshots; side-by-side sheet against the drawing (`.scratch/next-look/part3/answers/built/`). No intro, receipt, outro, forward chip, offer chip, side panel or empty right column anywhere.
- [ ] Spend, on the test account only: one real "Simulate all 3" on a fresh hooks answer (3 credits: watch "1 of 3", "2 of 3", three numbers; reload: same numbers from the seals; Best only with a 10-point lead), one real video run (10 credits: the running card after the history with a ticking clock and "Watch it run"; then the done card whose number and sentence equal `/simulation/[id]`).
- [ ] Scroll a long thread under the field on phone and desktop: nothing shows under or beside the field.
- [ ] Keyboard pass: gauges, primaries, pager, "Show all", chips reachable, named, focus visible, ≥ 44 px.
- [ ] Flag-off production build matches the baseline (same method as slice 1: landmarks + token count).
- [ ] Full suite alone (re-run single failures alone before calling it red: the suite flakes under load), tsc, eslint, `next build`.
- [ ] Independent critic (fresh subagent, Opus) given ONLY the built full-window screenshots, the drawing and the spec's rules; apply or answer every point.
- [ ] Write the "Result" section below; the controller commits on the owner's word.

## Spec coverage

| Spec | Task |
|---|---|
| §3.1 one card, no narration | 1 (`partsOf`), 5 |
| §3.2 one primary with em price | 2, 3 |
| §3.3 Inter, ink, coral only on the band | 2, 3 (guards), 7 |
| §3.4 the gauge, `population.stopPct` | 1 (`stopNumberOf`), 2, 4 |
| §3.5 one at a time | 4 |
| §3.6 Best and the sentence | 1 (`leadOf`), 2, 5 |
| §3.7 chips | 1 (`nextFollowups`), 5 |
| §4.1-4.4 packs, script, remix | 2, 3, 5 |
| §4.5 video done and running | 3, 6 |
| §4.6 chat and fallback | 1, 3, 5 |
| §4.8 live waiting row | 2, 5 |
| §5 side panel, headers, base, skeleton | 6 |
| §7 done when | 7 |

## Result

Built by Tasks 1-6 (2026-11-21, each reviewed clean, ledger `.superpowers/sdd/2026-11-21-thread-answers-step1/progress.md`),
checked by Task 7 (2026-11-22). Evidence in `.scratch/next-look/part3/answers/task7/` and `built/task7/`.

| Check | Outcome |
|---|---|
| Flag off | `next build` exit 0; probe on the production build vs `.scratch/next-look/baseline`: landmarks and `<html>` attributes identical on 6 route × view; token "differences" are minifier comma spacing only; 24 added tokens are new-look additions; no existing value changed. New pages are `notFound()` behind `NEW_LOOK_ENABLED` |
| /dev/answers vs drawing | Re-sheeted (prefix `t7-` in `built/task2`, `built/task3`): card heights equal the drawing for P5, P9, P10, P11, P12, P13, D2, D3; differences are the planned ones (no chevrons, "Why?", "···"; curated chips), radius 24 vs 26, no play mark, the user's video tile as a portrait tile |
| Real threads | Hooks (empty / partly / fully simulated), ideas, script, remix with pager, video, chat, fallback, brought text; phone + desktop, light + dark; census: no intro, receipt, outro, forward or offer chip, side panel or uppercase label anywhere |
| Real spends (test account, 24 credits) | Hooks run (1) + "Simulate all 3" (3): three `react` calls strictly one after another, "1/2/3 of 3", numbers 28 / 11 / 21 equal the stored seals after a reload, no Best (lead 7), "Script hook 1", "No clear winner." Video runs (2 × 10): running card after the history, "uploading" → "running" + "Watch it run", done card's number and sentence equal `/simulation/[id]` |
| Scroll under the field | Nothing under or beside the field, phone and desktop, light and dark |
| Keyboard | 114 stops: all reachable, named, visible focus; none hidden under the field after the fix. Desktop chips 32 px and the opener/hook slots 40 px tall as drawn (44 on touch through `tap-44`; WCAG 2.5.8's 24 px met) — controller ruling, open to the owner |
| Suite | 665 files, 8,183 tests pass; the 3 composer files that time out at 5 s under full-suite load pass alone (known flake); tsc clean; eslint: no new errors (`home-page-layout.tsx:63` is at HEAD) |
| Critic | Fresh Opus, images + drawing + rules only. Applied: chips of the turn's LAST run; no chips while rows simulate; Sources in a row = one card; base under the field from its top edge; running dial where the done gauge lands on desktop; "Simulate the rest". Answered, not changed: see below |

Fixed in Task 7 from real data and the checks: idea row line = first sentence of `take` (stored `angle`s are
~200-character paragraphs with segment ids); fallback lines fold to their first sentence; the video card's clock
restarted at the read → card hand-off (`testSentAt` + `testCardDue`); the first video of a new chat ran in the
arrival layout (`threadShown`); 17 focus stops hid under the field (`NEXT_THREAD_SCROLL_PAD`); "Show all"'s
square focus ring. Each with a test; the clock and layout fixes verified on a second real run (clock continuous
0:46 → 0:50 across the hand-off, header and field fixed).

Code review of the Task 7 changes (fresh Opus reviewer, 2026-11-22): flag off unchanged, `testCardDue` cannot
stick, the moved effect is safe, `simTextsOf` fires exactly the rows' strings. Fixed from it: the first-sentence
rule no longer ends at "Dr.", "vs.", "No.", "U.S.", a list number or a single letter, and folds after a closing
quote; the running card is keyed on its send (a second clip gets its own clock); a Sources repeat is the same
video (`videoUrl`); a stale test title. Accepted knowingly: an upload that fails before its run starts shows no
turn (the error sits by the field, the clip stays staged), so the page returns to the arrival layout.

Open for the owner (not changed in this step):
1. **Ideas, Hooks and Script sends stored the user's question twice** (the composer posted it to
   `/api/threads/user-turn` and, since Stage A, those routes insert it too); main's code, so the fix is its own
   PR, #564 (open, merge is the owner's call). Until it lands, this branch still shows the double bubble.
2. Real scripts and chat answers are long (the drawing used short stand-ins); the script keeps its full text.
3. Titles: the stored title is the raw prompt clipped at 48 characters mid-word; video-only chats get none
   ("New chat"); the audience line disappears after a video run (video turns carry no run-header).
4. Video turn: the user bubble is the file name, not "Simulate this"; the staged clip stays in the field for
   ~1.5 s while it uploads.
5. Shell (part 1): the sidebar highlights Home inside a thread; "0 left" shows while runs are not blocked; the
   sidebar's V mark vs the thread label's wave mark.
6. No play mark on the done video card; desktop title 16 / 640 vs drawn 14.5 / 620.
