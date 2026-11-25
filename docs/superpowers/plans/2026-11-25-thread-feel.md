# The chat's feel (thread, step 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Between a send and its answer the thread shows what Maven is doing, the answer's card is there from the start and fills in, the new message sits at the top of the window, scores count up, a plain answer fades in, and three defects found in the same test are fixed.

**Architecture:** All of it is new-look code behind `NEW_LOOK_ENABLED` (a build-time constant). The scroll rule grows inside the existing `useThreadAutoscroll` hook and a turn wrapper in `PersistedThreadStream`; the wait, the outline and the landing are new files in `src/components/thread-next` and `src/lib/thread-next`, wired in `thread-turn-next.tsx`; motion is five CSS keyframes with reduced-motion rules; the composer changes in six named places.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, vitest + Testing Library (jsdom), react-markdown 10 with rehype-sanitize.

Spec: `docs/superpowers/specs/2026-11-25-thread-feel-design.md`. Seams with file and line (read your section before you start; verify a line before you build on it): `.scratch/next-look/part11/thread-ux/seam-map.md`. Rulings (they win over this plan and the spec): `.superpowers/sdd/2026-11-25-thread-feel/rulings.md`.

A departure from the planning skill's form, on purpose: steps give the contract, the exact names, the words on screen and the tests to write first, not every line of code. The implementers are senior; the seam map carries the code facts.

## Global Constraints

- Flag off must render exactly as before. New behaviour lives in new-look-only files or behind `NEW_LOOK_ENABLED` (`src/lib/flags/new-look.ts`). Never change an existing `@theme` value.
- New-look code uses tokens only: no hex, `rgb()`, `hsl()`, `oklch()` or Tailwind palette classes in `src/components/thread-next` (its guard test refuses them), no `backdrop-` anywhere but the field, shadows as `shadow-[var(--shadow-…)]`. Ink and greys; coral only on the Maven mark. Inter only, no uppercase labels.
- Every string on screen exactly as the spec writes it (§4.2 table, §4.7). "Simulate", never "Test". No dashes used as punctuation in copy.
- Every animation has a `prefers-reduced-motion: reduce` rest state. Never animate `width`, `height`, `top` or `left`.
- Tests first, and tests that prove behaviour: no stand-in for the unit under test, no assertion that cannot fail. Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <files> --testTimeout 30000` (never `-u`). Types: `pnpm exec tsc --noEmit` (read its exit status directly, not through a pipe).
- The working tree is shared with other workers and another session. Touch only the files your task lists. If a file outside your list needs a change, stop and report it. Never run a formatter or a codemod over the tree. `src/components/result`, `src/lib/result`, `src/app/(app)/dev/result` belong to another session: do not read them as yours, do not edit them.
- No commit, no stash, no branch, no reset, no dev server, no build, no network call, no database query, no read of any `.env*` file.
- The repository is public: no ids, links, account names or creator handles in code comments, test names or fixtures. Use made-up handles ("@creator_one").
- Comments say why in plain words and follow the file's own style.
- When done, write your report to `.superpowers/sdd/2026-11-25-thread-feel/task-N-report.md`: what you built, the tests you ran with their totals, every place you departed from this plan and why, and your concerns.

## File map

| File | Task | Change |
|---|---|---|
| `src/components/app/home/use-thread-autoscroll.ts` (+ `__tests__/use-thread-autoscroll.test.ts`) | 1 | anchor, settle, latest, hidden-below, the room |
| `src/components/thread/persisted-thread-stream.tsx` (+ a new `__tests__/persisted-thread-stream.flag-on.test.tsx`) | 1 | a `data-turn` element per turn under the flag |
| `src/components/thread-next/jump-button.tsx` (+ test) | 1 | new: "Go to the latest" |
| `src/components/app/home/composer.tsx` (+ `__tests__/composer-next-field.flag-on.test.tsx`) | 1, then 4 | the six places named in tasks 1 and 4 |
| `src/app/globals.css` | 2 | five keyframes and their classes |
| `src/components/thread-next/answer-gauge.tsx` (+ test) | 2 | the count-up |
| `src/components/thread-next/streamed-text.tsx` (+ test) | 2 | new: the fading answer, Copy |
| `src/components/thread-next/pack-answer.tsx` (+ tests) | 2 (header words), 3 (landing classes) | |
| `src/lib/hook-test-context.tsx` | 2 | the script button's optional label |
| `src/lib/thread-next/run-status.ts`, `landing.ts` (+ tests) | 3 | new |
| `src/components/thread-next/run-status.tsx`, `answer-outline.tsx`, `landing-group.tsx` (+ tests) | 3 | new |
| `src/components/thread-next/thread-turn-next.tsx` (+ its flag-on tests), `script-answer.tsx`, `remix-answer.tsx`, `fallback-answer.tsx`, `waiting-row.tsx` (removed) | 3 | the wiring |
| `src/app/(app)/dev/answers/*` | 3 | states to look at |
| `src/components/thread-next/thread-field.tsx` (+ test), `src/stores/shell-store.ts` (+ test) | 4 | the field's third state, the title hint's setter |
| `src/lib/threads/chat-prior-turns.ts` (+ test) | 5 | cards reach the chat's context |
| `docs/DESIGN-SYSTEM.md`, `docs/superpowers/specs/2026-11-21-thread-answers-design.md` | controller | the new rules written down |

Tasks 1 and 2 run at the same time; then 3 (after 2) and 4 (after 1) at the same time; 5 whenever a worker is free. No two running tasks share a file.

---

### Task 1: A new turn sits at the top

**Files:**
- Modify: `src/components/app/home/use-thread-autoscroll.ts`, `src/components/thread/persisted-thread-stream.tsx`, `src/components/app/home/composer.tsx` (only the places named below)
- Create: `src/components/thread-next/jump-button.tsx`, `src/components/thread-next/__tests__/jump-button.test.tsx`, `src/components/thread/__tests__/persisted-thread-stream.flag-on.test.tsx`
- Test: `src/components/app/home/__tests__/use-thread-autoscroll.test.ts`, `src/components/app/home/__tests__/composer-next-field.flag-on.test.tsx`

**Interfaces:**
- Produces, on the hook's result (`ThreadAutoscroll`), beside today's `registerScrollRegion` and `scrollThreadToBottom` (both unchanged in behaviour):
  - `anchorNextTurn(): void` — arms the anchor. The next time the content grows and the LAST `[data-turn]` element in the region is not the one that was last when it was armed, the region scrolls so that element's top sits `ANCHOR_TOP_PX = 8` under the region's top edge, the pin is released (growth no longer moves the view), and the arm is cleared. Armed and nothing new within 2,000 ms: the arm is dropped. Scroll: 380 ms, cubic ease-out, by `requestAnimationFrame`; at once when `matchMedia("(prefers-reduced-motion: reduce)")` matches or is missing. A scroll event caused by the hook's own writes is not read as the creator's (today's `lastWrittenTopRef` rule, kept true during the animation).
  - `settle(): void` — if the end of the last `[data-turn]`'s content (the bottom of its last child element; the turn's own box can be taller than its content) is below the visible end (the region's bottom edge less its computed `padding-bottom`) by more than 0 and at most `SETTLE_MAX_PX = 150`, scroll down by that much plus 8, with the same motion rule. Otherwise nothing.
  - `scrollToLatest(): void` — scroll to the end with the same motion rule and pin.
  - `hiddenBelow: boolean` — React state: true when the end of the last turn's content is more than `HIDDEN_MIN_PX = 150` below the visible end. Recomputed on scroll and on content growth; set only when it changes.
  - The region gets the CSS variable `--thread-room` = its own `clientHeight` in px, written on register and whenever the region's box changes size (a ResizeObserver on the region itself).
- Produces on `PersistedThreadStream`: prop `anchored?: boolean`.
- Produces: `JumpButton({ shown, onClick }: { shown: boolean; onClick(): void })`.

- [ ] **Step 1: the hook's tests, failing.** In `use-thread-autoscroll.test.ts` add cases (the file shows how the region, its content and ResizeObserver are faked; add `data-turn` children to the content as needed): (a) armed, a new last turn appears and the content grows: `scrollTop` becomes that turn's `offsetTop - 8` and later growth leaves `scrollTop` where it is; (b) armed, growth without a new last turn: no scroll, and after 2,000 ms a new turn no longer anchors; (c) not armed: today's pin rule exactly (the eight existing cases stay green untouched); (d) `settle()` with the content's end 90 px under the visible end scrolls by 98, with 300 px does nothing, with the end in view does nothing; (e) `hiddenBelow` is false at the end, true when more than 150 px of the last turn's content is under the visible end, false again after `scrollToLatest()`; (f) `--thread-room` equals the region's `clientHeight` after register and after a resize; (g) with reduced motion the anchor lands in the same task (no animation frames needed). Use fake timers and a faked `requestAnimationFrame` for the animated path; assert the final position, not the frames.
- [ ] **Step 2: run them, see them fail** for the missing functions.
- [ ] **Step 3: build the hook.** Keep every existing line of behaviour for callers that never call the new functions (the flag-off build calls only the old two). One ResizeObserver callback decides: armed and a new last turn → anchor; else pinned → `applyBottom`; then recompute `hiddenBelow`.
- [ ] **Step 4: the stream's tests, failing** (`persisted-thread-stream.flag-on.test.tsx`; mock `@/lib/flags/new-look` to true as the other `*.flag-on.test.tsx` files do, and stub `ThreadTurn` with a marker element so the test is about the stream): each persisted turn, the live turn and `tail` each sit in their own `[data-turn]` element, in that order; a turn after the first that has a question (`userTurn` non-empty; for `tail`: always) carries `data-turn="later"` and the first `data-turn="first"`; with `anchored` the LAST `[data-turn]` has `data-room` and no other has; without `anchored` none has; the wrappers do not change which turn gets `showFollowups`. A second test file is not needed for flag off: assert in the existing stream tests (or one new plain test) that with the flag off no `[data-turn]` exists and the children are direct children of the column as before.
- [ ] **Step 5: build the wrappers.** Under the flag each turn is wrapped in `<div data-turn=… className=…>`: the wrapper is a flex column with the column's own gap (`flex flex-col gap-3.5 md:gap-4`), so a turn's parts stay as far apart as they are today; `data-turn="later"` adds `mt-3.5` (the bubble inside is its wrapper's first child, so its own `first:mt-0` drops the margin it used to carry: the sum is unchanged); `data-room` adds `min-h-[calc(var(--thread-room,0px)-var(--field-reserve,0px)-var(--thread-room-trim,72px))]`. Define the trim so that with the turn's top 8 under the region's top its minimum bottom meets the visible end: read `NEXT_THREAD_RESERVE` and the column's padding in the seam map §1 and set `--thread-room-trim` on the region in the composer to the px sum that makes this true on a phone and from `md` (two values, set by class). Keep `Fragment key={i}` semantics: the wrapper takes the key.
- [ ] **Step 6: the button.** `JumpButton`: a round 34 px button named "Go to the latest" (`aria-label`), the down arrow from `src/components/shell/icons.tsx` if it has one, else a 17 px stroke arrow drawn in the file as the folder's other icons are; `bg-surface`, `shadow-[var(--shadow-float)]`, `text-foreground`; not rendered at all when `shown` is false (no hidden focus stop). Test: renders nothing when not shown; calls `onClick`; has the name.
- [ ] **Step 7: the composer, tests first** (`composer-next-field.flag-on.test.tsx` has the harness; find the scroll cases near "the dock and the reserve agree" and the send cases): under the flag (a) a send from the field calls the anchor and not the pin (assert through behaviour: after the live turn appears, the region's `scrollTop` equals the new turn's `offsetTop - 8`, not `scrollHeight`); (b) the stream receives `anchored` after the first send of this visit and not on a chat that was only opened; a thread switch clears it; (c) when the active run's cards are in (`isDone`), `settle()` runs once; (d) the button shows when `hiddenBelow` and a click calls `scrollToLatest`.
- [ ] **Step 8: wire the composer.** Under `NEW_LOOK_ENABLED` only: at the four send-time call sites of `scrollThreadToBottom()` (seam map §1: `handleWriteScript`, `handleDevelopRemix`, `sendChatFollowup`, the top of `handleSubmit`) call `anchorNextTurn()` instead and set `anchored` (a `useState(false)`, reset to false where the open thread changes); the reserve-follow effect keeps `scrollThreadToBottom`. Pass `anchored` to `PersistedThreadStream`. An effect on the active run becoming done (`activeRun?.isDone` turning true, and a plain chat answer's stream ending) calls `settle()` on the next animation frame. Render `<JumpButton shown={hiddenBelow} onClick={scrollToLatest} />` centred 12 px above the field block, inside the dock's positioned ancestor (the dock is at seam map §1 "l.4903"); it must not take part in the field's measured height.
- [ ] **Step 9: run** the four test files of this task and `pnpm exec tsc --noEmit`. All green, no existing case edited except where this plan changes behaviour (name each such case in your report).

---

### Task 2: Motion, the count-up, the fading answer, the pack's header words

**Files:**
- Modify: `src/app/globals.css`, `src/components/thread-next/answer-gauge.tsx`, `src/components/thread-next/pack-answer.tsx`, `src/lib/hook-test-context.tsx`
- Create: `src/components/thread-next/streamed-text.tsx`, `src/components/thread-next/__tests__/streamed-text.test.tsx`
- Test: `src/components/thread-next/__tests__/answer-gauge.test.tsx`, `pack-answer.test.tsx`, `answer-card.test.tsx`, `src/app/(app)/dev/answers/__tests__/dev-answers.test.tsx`

**Interfaces:**
- Produces in `globals.css`, in one block headed by a comment naming the spec, placed after the existing `word-fade` rules:

```css
@keyframes thread-rise { from { opacity: 0; transform: translateY(6px); } }
@keyframes thread-light { from { background-position: 130% 0; } to { background-position: -110% 0; } }
@keyframes thread-sweep { from { background-position: 120% 0; } to { background-position: -100% 0; } }
@keyframes gauge-draw { from { stroke-dasharray: 0 100; } }
@keyframes word-in { from { opacity: 0; } }

[data-landing] .land {
  animation: thread-rise 420ms var(--ease-out) both;
  animation-delay: calc(var(--landed, 0ms) + var(--i, 0) * 70ms);
}
.run-words {
  background-image: linear-gradient(90deg, var(--color-foreground-secondary) 0%, var(--color-foreground-secondary) 38%, var(--color-foreground) 50%, var(--color-foreground-secondary) 62%, var(--color-foreground-secondary) 100%);
  background-size: 240% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: thread-light 2s linear infinite;
}
.ghost-bar {
  background-image: linear-gradient(90deg, var(--color-surface-sunken) 0%, color-mix(in srgb, var(--color-foreground) 3%, transparent) 45%, var(--color-surface-sunken) 90%);
  background-size: 220% 100%;
  animation: thread-sweep 1.6s ease-in-out infinite;
}
.gauge-draw { animation: gauge-draw 700ms var(--ease-out) both; }
.word-in { animation: word-in 240ms ease both; }
@media (prefers-reduced-motion: reduce) {
  [data-landing] .land, .gauge-draw, .word-in, .ghost-bar { animation: none; }
  .run-words { animation: none; background-image: none; color: var(--color-foreground-secondary); }
}
```

  If the done gauge's value path does not use a path length of 100 (read `answer-gauge.tsx`), write `gauge-draw`'s `from` so the arc starts empty for that path, and say so in the report.
- Produces: `StreamedAnswer({ text, live }: { text: string; live: boolean })` — the plain answer's part. Live: react-markdown with `rehypePlugins={[rehypeSanitize, rehypeWords]}` in the same wrapper the turn uses today for a text part (`thread-turn-next.tsx`, the `"text"` case: the `PROSE` class, `[&_.md]:leading-[22px]`, `aria-live="polite"`, the `.md max-w-[68ch] text-prose` box of `MarkdownBlockRenderer`). Not live: today's `MarkdownBlockRenderer` markup unchanged (no word spans), and under it `<AnswerActions text={text} />`.
- Produces: `rehypeWords` (exported for its test): a rehype transformer that replaces every text node that is not inside `code` or `pre` with one `<span class="word-in">` per run of non-space characters, spaces kept as text between them. No new dependency: walk the tree by hand.
- Produces: `AnswerActions({ text }: { text: string })`: one quiet `Copy` control from the folder's own parts (`useCopyText`, `CopyButton` in `sheet-actions.tsx`; seam map §12), muted ink, 4 px above the chips' row rhythm as the film draws it (`-ml-2`, 34 px target).
- Produces: `OnWriteScriptFn = (hookLine: string, audienceArchetype: string, label?: string) => void` in `src/lib/hook-test-context.tsx` (the third argument is new and optional; nothing else in that file changes).
- Produces in `PackAnswer`: the header's left words are `"${rows.length} hooks"` / `"${rows.length} ideas"` (singular "1 hook", "1 idea") while EVERY row is empty, and "Would stop to watch" as soon as any row is waiting, running or done. The right words are unchanged.

- [ ] **Step 1: tests first.** Gauge (`answer-gauge.test.tsx`; keep its existing cases green untouched): a gauge rendered done has no `gauge-draw` class and its `<text>` is the value; a gauge that is rerendered from `running` to `done` with motion allowed (stub `window.matchMedia` so `(prefers-reduced-motion: reduce)` does not match, fake `requestAnimationFrame` and `performance.now`) has `gauge-draw` on `[data-part="value"]`, shows a number below the value on the first frame and exactly the value after 700 ms, while `data-value` and the accessible name are the final value from the first frame; the same rerender with reduced motion (or no `matchMedia`) shows the value at once and no class; `waiting` to `done` counts as `running` to `done`. Streamed text: `rehypeWords` on a tree with a paragraph, a `strong` and a `code` wraps the words of the first two and leaves the code's text whole; `StreamedAnswer live` renders one `.word-in` per word and, rerendered with a longer text, keeps the first spans' DOM nodes (same element identity) and adds new ones; not live it renders no `.word-in` and a Copy control that copies `text` (stub `navigator.clipboard.writeText`). Pack header: all rows empty shows "3 hooks" (and "4 ideas" for ideas, "1 hook" for one row) with "1 credit each"; one row running or done shows "Would stop to watch"; update the cases the seam map §11 lists that pinned the old words, and `dev-answers.test.tsx:28`.
- [ ] **Step 2: see them fail.**
- [ ] **Step 3: build.** Gauge: inside `SmallGauge` keep the previous `state.kind` in a ref; decide "fresh" in render when the kind changes to `done` from `running` or `waiting`; the count runs in a layout effect so the first painted frame is already the count's start; clear the frame on unmount. Nothing outside `SmallGauge` learns about it. Streamed text and actions as above. Pack header as above. The context type as above.
- [ ] **Step 4: run** the five test files, the folder guard (`src/components/thread-next/__tests__/thread-next-guard.test.ts`) and `pnpm exec tsc --noEmit`.

---

### Task 3: The wait, the outline, the landing

Starts after task 2 is done and reviewed (it uses task 2's classes, `StreamedAnswer` and the context type).

**Files:**
- Create: `src/lib/thread-next/run-status.ts`, `src/lib/thread-next/landing.ts`, `src/components/thread-next/run-status.tsx`, `src/components/thread-next/answer-outline.tsx`, `src/components/thread-next/landing-group.tsx`, and a test file for each under the matching `__tests__` folder
- Modify: `src/components/thread-next/thread-turn-next.tsx`, `pack-answer.tsx`, `script-answer.tsx`, `remix-answer.tsx`, `fallback-answer.tsx`, `src/app/(app)/dev/answers/page.tsx`, `dev-answers.tsx` and their tests
- Delete: `src/components/thread-next/waiting-row.tsx` (and its cases in `answer-card.test.tsx`), once nothing imports it
- Test: `src/components/thread-next/__tests__/thread-turn-next.flag-on.test.tsx`

**Interfaces:**
- Consumes: the classes `land`, `run-words`, `ghost-bar` and the `[data-landing]` rule (task 2); `StreamedAnswer` (task 2); `OnWriteScriptFn`'s third argument (task 2); `LiveRun` (`src/components/thread/thread-turn.tsx`: `skill`, `isStreaming`, `stages`, `evidence`, `preGuess`); `RunEvidence` (`src/lib/tools/evidence.ts`).
- Produces `src/lib/thread-next/run-status.ts` (pure):
  - `statusWords(skill: string, stages: readonly { name: string; status: string }[]): string` — the spec's §4.2 table, exactly. Walk the stages in order; the words are those of the last stage whose status is `active` or `done` and that has words for this skill; a stage without words keeps the words before it; no such stage: the skill's own words ("Writing hooks", "Finding ideas", "Writing your script", "Reworking the video", "Scanning for outliers", "Reading your account"); any other skill: "Thinking".
  - `USUAL_S: Readonly<Record<string, number>>` = `{ hooks: 20, ideas: 30, script: 30 }`, and `usualNote(skill: string, elapsedS: number): string | null` — `"about 20 s"` / `"about 30 s"` while `elapsedS <= 2 * usual`, then `"taking longer"`; `null` for a skill without a usual.
  - `outlineOf(skill: string): "pack" | "script" | "remix" | null` — hooks and ideas `pack`, script `script`, remix `remix`, else `null`.
- Produces `src/lib/thread-next/landing.ts`:
  - `LANDING_WINDOW_MS = 1600`; `landingKeyOf(blocks: readonly unknown[]): string | null` (the first card line of the turn through `cardLinesOf` from `@/lib/tools/chat-followups`, trimmed; `null` when there is none); `markLanded(key: string, now?: number): number` (remembers the first moment this key landed and returns the ms since then, 0 on the first call; a different key replaces the memory); `landedAgo(key: string, now?: number): number | null` (ms since it landed when inside the window, else `null`); `resetLanding()` for tests.
- Produces `LandingGroup({ sinceMs, children })` (`landing-group.tsx`): keeps the FIRST `sinceMs` it was given (state initialiser); `null` → renders children with no wrapper; a number → `<div data-landing className="contents" style={{ "--landed": `${-sinceMs}ms` }}>`.
- Produces `RunStatus({ words, note, inCard = false })` and `EvidenceRow({ evidence })` (`run-status.tsx`): the line is `role="status"` `aria-live="polite"`, its words in a `span.run-words` (15 / 21 outside a card, 13 / 21 at weight 540 inside a card's header, as `CardHeader`'s left text), the note at the right end in the muted ink (13); the row is up to five covers (16 × 22, radius 4.5 px as `rounded-[4.5px]`, overlapping by 4, each with a 1.5 px ring in the surface it sits on, `aria-hidden`, a failed or missing image is a `bg-surface-sunken` tile) followed by `evidence.headline` as sent (13 / 18, secondary ink, wraps to two lines at most then clips with an ellipsis). Only items of kind `video` or `profile` with or without an image count; no item → no row.
- Produces `AnswerOutline({ kind, words, note, evidence })` (`answer-outline.tsx`): §4.3. Built from `AnswerCard` and `CardHeader`; ghost parts are `span.ghost-bar` (`aria-hidden`), a pack row's ring is a 46 px circle with a 4.5 px border in `--color-gauge-track`; row and beat sizes match the real card's first paint closely enough that a three-row pack does not change height by more than 24 px on landing (measure against `PackAnswer` with three three-line hooks). The remix outline's source row is the real `SourceRow` markup once `evidence.items[0]` exists (cover, label, metric), bars before.

- [ ] **Step 1: the pure parts, tests first.** `run-status.test.ts`: every row of the §4.2 table, in both the "no stage yet" and the staged form; "Ranking" keeps "Writing hooks"; an unknown stage keeps the words before it; an unknown skill is "Thinking"; `usualNote("hooks", 0)`, `(…, 40)`, `(…, 41)`, `("remix", 5)`. `landing.test.ts`: first mark returns 0; a later mark of the same key returns the elapsed ms; `landedAgo` inside and outside the window; a second key replaces the first; `landingKeyOf` on a hooks turn, a text-only turn and an empty turn. Build both files.
- [ ] **Step 2: the line, the row, the outline, the group, tests first.** The line announces its words and its note; a words change rerenders the same status element; the evidence row shows at most five covers and the headline word for word, hides its covers from a screen reader, and renders nothing for an evidence without usable items; each outline kind renders its header line and its ghosts, the pack's evidence row when given, the remix's real source row when its post is there; `LandingGroup` with `null` adds no element, with a number sets `--landed` to the negative ms and ignores a later different `sinceMs`. Build the four files.
- [ ] **Step 3: the turn, tests first.** In `thread-turn-next.flag-on.test.tsx` rewrite the "while a run is live" cases (seam map §10 lists them) to the new rules and keep every one of their situations covered: a live hooks run with no card shows the pack outline whose status says "Writing hooks" (and the staged words when stages say more), no card rows, no chips; a typed ask before dispatch (`skill: "chat"`, also with `preGuess`) shows the line "Thinking" and no outline; explore and account show the line alone with their words; stages done but no card yet keeps the outline; when the cards arrive the outline is gone, the cards are inside a `[data-landing]` group and the pack's rows carry `land` with `--i` 0, 1, 2, the button the next index, the chips three more; a turn that mounts with cards and no landing memory has no `[data-landing]`; a turn that mounts within the window of a marked landing has `[data-landing]` with a negative `--landed`; a plain chat answer renders through `StreamedAnswer` (live while streaming, Copy once ended); an errored run still shows today's error and Retry; the pack's script button sends the label "hook 2" / "idea 3" as the third argument (1-based row).
- [ ] **Step 4: wire the turn.** In `ThreadTurnNext`: the waiting row becomes `RunStatus` or `AnswerOutline` by `outlineOf(skill)` (only once the run is named: a `chat` or guessed run is the line "Thinking"); words from `statusWords(skill, stages)`; the note from `usualNote` with the seconds since this status mounted (a timer that fires only at the moment the note changes); evidence from `live.evidence`. The landing: a ref remembers that this turn waited; on the render where cards first show after a wait, `markLanded(key)`; a turn that never waited reads `landedAgo(key)` once at mount; wrap the shown parts and the chips in `LandingGroup`. Give the landing indexes: in `PackAnswer` each `li` gets `land` and `--i` (the row's index, capped at 9), the footer the next, in `ScriptAnswer` each beat and the footer, in `RemixAnswer` the source row, the headline, the slot, the steps and the button in that order, `FallbackAnswer` and a legacy part as one `land` at 0; the chips' row `land` at the last index plus 3. `PackPart.scriptRow(i)` passes the label. Remove `waiting-row.tsx`.
- [ ] **Step 5: states to look at.** `/dev/answers` gets `w1` (the line "Thinking"), `w2` (hooks outline, no evidence), `w3` (hooks outline with an evidence of three items without images and the topical headline), `w4` (script outline), `w5` (remix outline with its post), `w6` (explore: the line alone), `wl` (starts as `w3`, after 2,500 ms renders the `p3` pack as a landed turn, so the landing can be watched; a reload plays it again). Add them to `STATES` in `page.tsx`, to the file's header list and to the list its test pins.
- [ ] **Step 6: run** every test file of the folder (`src/components/thread-next/__tests__`), `src/lib/thread-next`, the dev answers tests, and `pnpm exec tsc --noEmit`.

---

### Task 4: The field while a run finishes, the title, the stored question, the script's message

Starts after task 1 is done and reviewed (both edit `composer.tsx`).

**Files:**
- Modify: `src/components/thread-next/thread-field.tsx`, `src/stores/shell-store.ts`, `src/components/app/home/composer.tsx`
- Test: `src/components/thread-next/__tests__/thread-field.test.tsx`, the shell store's test file (find it under `src/stores/__tests__`), `src/components/app/home/__tests__/composer-next-field.flag-on.test.tsx`, `src/components/app/home/__tests__/composer.test.tsx`

**Interfaces:**
- Consumes: `OnWriteScriptFn`'s optional third argument `label` (task 2).
- Produces on `ThreadFieldProps`: `finishing?: boolean` — with `streaming` false and `finishing` true the send button is the send arrow, disabled (`disabled`, the off look it already has), named by `sendLabel`; `streaming` wins when both are true.
- Produces on the shell store: `setThreadTitleHint(hint: { id: string; title: string } | null): void` — writes only `threadTitleHint`.

- [ ] **Step 1: tests first.** Field: `finishing` shows a disabled send named by `sendLabel` and no Stop; `streaming` shows Stop whatever `finishing` is. Store: the setter writes the hint and leaves `threadBack` and `libraryScroll` as they were. Composer, flag on: (a) while the active run is streaming with no card, the field shows Stop; once its cards are in and the stream is still open, the field shows the disabled send, and Enter still does not send; when the stream closes, the field is at rest; (b) the first send in a chat whose title the list does not hold sets the header's title to `cleanThreadTitle(ask)` at once (assert the header text), a bare link as the ask sets none, and a chat that has a title is left alone; (c) after a run is folded into history the thread list is read again (assert the list request is made a second time, or the query is invalidated, through the harness the file already uses for `/api/threads/list`); (d) `handleWriteScript` with a label sends "Write the script for hook 2." and without one "Write the script from this hook." (update the two cases the seam map §11 names). Composer, flag off (`composer.test.tsx`): the test from the saved diff below.
- [ ] **Step 2: see them fail.**
- [ ] **Step 3: the stored question.** Apply `.scratch/next-look/part11/thread-ux/skill-user-turn-once.diff` (`git apply` from the repository root; it changes `USER_TURN_TOOLS` in `composer.tsx` and adds a test to `composer.test.tsx`). It is the change already on main: apply it as it is, do not reword it, so the two copies are identical.
- [ ] **Step 4: build the rest.** Field prop. Store setter. Composer, under `NEW_LOOK_ENABLED`: `streaming={isAnyStreaming && !answerIn}` and `finishing={isAnyStreaming && answerIn}`, where `answerIn` is true when the active run is done (`activeRun.isDone`), or it is a named run whose blocks already hold a result card and whose stages are all done (the rule `thread-turn-next.tsx` uses to show the cards: reuse `hasResultCard` from `@/lib/thread-next/answer-parts`); `onSubmitNextField`'s block on `isAnyStreaming` stays. The title: where a send has made sure the thread exists (after `ensureThreadForSend` in each branch of `handleSubmit`, in `sendChatFollowup` and `handleWriteScript`), if the thread list's cached entry for the open thread has no title, call `setThreadTitleHint({ id, title })` with `cleanThreadTitle(ask)` from `@/lib/threads/title` when it returns one. In the fold effect (seam map §3: `reloadChatThread` then `reset`), after the reload succeeds, `queryClient.invalidateQueries({ queryKey: queryKeys.threads.list() })`. The script's message: `handleWriteScript(hookLine, _audienceArchetype, label?)` builds `label ? `Write the script for ${label}.` : "Write the script from this hook."`.
- [ ] **Step 5: run** the four test files and `pnpm exec tsc --noEmit`.

---

### Task 5: Cards from a run reach the chat's context

**Files:**
- Modify: `src/lib/threads/chat-prior-turns.ts`
- Test: `src/lib/threads/__tests__/chat-prior-turns.test.ts`

**Interfaces:** none new. `openChatPriorTurns(hydratedMessages)` keeps its signature and its return type (`ChatAgentPriorTurn[]`, defined in `src/lib/tools/chat-agent-loop.ts`, which this task does not edit).

What is wrong (seam map section 7): cards collected since the last text (`pendingRuns`) reach the model only as `toolRuns` on an assistant line stamped `origin: "chat-agent"`. A run started from a skill button stores its cards in one assistant row and its closing line, unstamped, in another (or no closing line at all), so those cards are dropped and the chat cannot talk about them.

The rule to build: cards that were not announced by a chat-agent line are results the creator ran on their own surface. They are handed to the model the way such results already are: as `skillRecords` (the "thread state" note that `replayPriorTurn` in `chat-agent-loop.ts` writes as a user-role message), never as a tool call the chat agent did not make.

- A stamped assistant line after cards: exactly as today (`toolRuns` on that line).
- An UNSTAMPED assistant line after cards, a USER line after cards, or the end of the thread after cards: each pending run becomes one record line, added to `pendingRecords` in run order, and is flushed by the existing `flushRecords()` (before the turn that follows, or at the end). Then `pendingRuns` is cleared.
- The record line of a run: the tool's name as the creator knows it ("hooks", "ideas", "script"), the number of cards, and the cards' own lines in order, each in double quotes, joined by " · ". Example for three hooks: `hooks, 3 on screen: "First line" · "Second line" · "Third line"`. A run with no extractable line: `hooks, 3 on screen`. Keep `MAX_LINES_PER_RUN` and the existing length rules of `cardLineOf`; `MAX_RECORDS` still caps a flush. Read how `recordLineOf` in the same folder words and clips its lines (`on-screen.ts`) and match its style.
- Only card blocks (`CARD_BLOCK_TOOL`) make a run, as today: an `input-request` or any other block alone makes none.

- [ ] **Step 1: tests first**, each building rows the way the direct routes store them (seam map section 7): (a) a user ask, an assistant row `[run-header, hook-card x 3]`, an assistant row with an unstamped markdown line: the returned turns hold, before that line's turn, a turn with `skillRecords` containing one line that names hooks, says 3, and quotes the three hook lines in order; the line's own turn has no `toolRuns`; (b) the same without the closing line, at the end of the thread: the records turn is the last turn; (c) the same without the closing line, followed by a user question: the records turn comes before the user's turn; (d) the chat agent's own shape (stamped line) gives exactly what it gave before: keep the existing cases green untouched; (e) an assistant row with only an `input-request` and an unstamped line gives no record and no `toolRuns`; (f) a recorded block (`SKILL_BLOCK_RECORD`) and cards before the same unstamped line end up in ONE records turn, in the order they were stored; (g) two runs before one unstamped line (hooks then ideas) give two record lines; (h) the cap of 20 turns still holds.
- [ ] **Step 2: see (a), (b), (c), (f), (g) fail; build; run** the test file and `pnpm exec tsc --noEmit`.

---

## After the tasks (controller)

- A review per task by a fresh reviewer (`.superpowers/sdd/reviewer-instructions-2026-11-25.md`), fixes, then one review of the whole part.
- Docs: `docs/DESIGN-SYSTEM.md` "Next look": the thread's wait and its motion (the five classes, when each may be used, the landing's one-time rule, the turn wrapper and the room); `2026-11-21-thread-answers-design.md` §4.8 marked as replaced by the new spec.
- The checks of the spec's §10, the controller's own look in the running app included.
