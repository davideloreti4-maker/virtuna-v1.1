# The editor's screens, slice B ("the trust"): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A creator can judge the video before posting it: a request is about the moment the video is paused on (E15), the take as it was shot is one tap away (E16), the video can be seen full screen under drawings of the apps' buttons (E17), and what the review finds arrives one at a time with its fix (E18); the chips under an answer follow from the change just made (§5.3). Spec `docs/superpowers/specs/2026-11-24-editor-screens-design.md`, slice B; screens 4, 6, 7 and 8 of `.scratch/editor/drawing/editor-v2-drawing.png` (rows `editor-v2-row-A.png`, `editor-v2-row-B.png`; sizes in `editor-v2.html`).

**Architecture:** Two tracks that meet at the end. The agent track resolves a paused film frame into named things in code (`src/lib/edit/agent/moment.ts`), writes them as one `moment:` block above `request:` (the system prompt stays byte for byte), holds a start or an end the model set near the moment onto it, and makes "zoom in here" a split on the moment and a push that starts at the footage's own framing, so no cut lands in speech. The page track adds the Original toggle (the same Player fed the take with nothing on it), the full-screen preview (the same stage element promoted by CSS, with furniture drawn from `.scratch/editor/slice-b/safe-zones.md`), the moment tag in the field, findings put away per turn (`edit_turns.kept`, a new route), steps computed from the turn's edit, and the finding card. Two proof tasks run the real model through `scripts/edit-agent-proof.ts`.

**Tech Stack:** as slice A: Next.js 16.1.5, React 19.2.3, TypeScript, Tailwind v4 (new-look tokens), Supabase (supabase-js, PostgREST), zod 4, Remotion Player 4.0.545 (`EditPlayer`), Vitest 4 with happy-dom and Testing Library, Qwen through `askQwen` for the proof scripts only.

## Global Constraints

- Work only in the worktree `/Users/davideloreti/virtuna-edit`, branch `feat/edit`; the plan starts at `9cdab29d`, where `pnpm exec tsc --noEmit` and the whole suite are green (slice A's Results).
- **Rulings R1 to R31 of `.superpowers/sdd/2026-11-24-editor-screens-a/rulings.md` bind this slice** (Undo and Redo as a round trip R9, the store's guards R19, chips one row R30, the order of checks R16, no words of the owner's take R12, commits R8/R14, and the rest). Where this plan and a ruling disagree, the ruling wins; say so in the report.
- Tests exercise real behaviour. Mocks only at boundaries that cannot run in a test: the model (`agentDeps.ask`, or `deps.ask` of `change`), the worker's stills, Supabase's REST API (the `standIns()` stand-in through `src/app/api/edit/__tests__/edit-world.ts`), the bucket, `fetch` in client tests, and browser APIs happy-dom lacks. Never mock `applyOps`, `review`, `change`, `tighter`/`zoomFor`, the reducer, the turns' rules, `momentFor` or the Player.
- Vitest on this Mac: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run <paths>`. Type check: `pnpm exec tsc --noEmit`. Lint: `pnpm exec eslint <paths>`. Time-bound tests in `ops.test`, `context.test` and `recipes.test` time out under load: rerun them alone before calling a failure (R6).
- Commits: local only, by named paths, hook off: `git add <paths> && git -c core.hooksPath=/dev/null commit -m "type(scope): description" -m "Co-Authored-By: Claude <the model you run on> <noreply@anthropic.com>" -- <paths>` (for example `Claude Opus 5.5`). Nothing after that line: no session link, no ids (R14). Never push, never amend, never `git add -A`.
- New look only. Flag off renders exactly as before: never update `src/components/ui/__tests__/next-look-parity.test.tsx` with `-u`; no shared part under `src/components/ui/` changes.
- Tokens and parts only in `src/components/editor/`: the guard `src/components/editor/__tests__/editor-guard.test.ts` stays green (no colour literal, no glass, type only from the role scale, never `shadow-float`). The ground under footage is black in both themes and may be written `bg-black` (R26); a glyph over footage is `text-action-foreground dark:text-foreground`, as the stage's `OVER_FOOTAGE`. Every control at least 44 px to tap (`tap-44`). Inter only. Light and dark.
- The system prompt (`systemPrompt()`) and the catalogue stay byte for byte: a request with no moment sends exactly the messages it sends today. If a task finds it must change either, it stops and reports.
- Disk is tight (R5): no copies of `src/`, no `next build`, no dev server, no Remotion bundle, no new `node_modules`. No task starts a dev server or a build, the proof script's own `words` mode (which starts one) included: it is not used in this slice. Only the controller runs a browser (the last section), and another session may run a dev server at the same time.
- Model calls only in Tasks 4 and 10, at most 60 calls each, counted by the script and stopped at the cap. No agent reads a `.env*` file; the proof script loads `.env.local` itself (`process.loadEnvFile`) and prints no value of it.
- The repo is public: no ids, addresses, account emails, secrets or words of the owner's take in code, tests, fixtures, JSON files or commit messages. A word of the take is named by its index (`w16`), never its text.
- One call at a time from the page, every call with a deadline, every route that changes an edit answers the whole `EditView` (slice A's rules, kept).

## How the tasks run

Two tracks may be built at the same time by two implementers; each task ends testable on its own.

| Track | Tasks | Touches |
|---|---|---|
| Agent | 1 → 2 → 3 → 4 | `src/lib/edit/agent/`, `src/app/api/edit/agent-calls.ts`, `src/app/api/edit/edits/[id]/change/route.ts`, `scripts/edit-agent-proof.ts` |
| Page | 5 → 6 → 7 → 8 → 9 | `src/components/editor/`, `src/lib/edit/` (new pure files), the edit routes |
| Both | 10 | after Tasks 3 and 9 |

Task 8 starts only once Task 2 is committed (both change `change/route.ts`). Task 10 starts once Tasks 3 and 9 are committed.

## What the code forced (read before Task 3 and Task 9)

1. **A still punch-in on the moment would be refused.** The review counts a join where the footage runs on with another framing as a cut, and a cut outside a measured pause is an error (`cutBetween`, `cutsOutsidePauses`, `review.ts:525-575`); the loop takes no answer with a new error. So B2's zoom on the moment is a **push**: the shot is split on the moment and the piece after it moves from the framing the footage has there to the tighter one in `PUSH_MS` (400 ms), then holds; at the join nothing jumps, so there is no cut. Where a clean cut (a shot's start or a pause's cut@) lies within 3 frames of the moment, the zoom starts there as a still punch-in, the house's own look. The piece ends at the first pause after the sentence where it can, else with the shot.
2. **`empty-start` cannot reach a stored edit:** the door refuses every edit that would have it (`review.ts` header, "The door refuses all of these"). Its fix "Start on the first word" cannot be tried on a real edit, so it is offered as "Show" only (E18: a fix is offered only after it cleared its finding in two of three runs).
3. **The turn's ops are not stored.** §5.3's chips are computed from the turn's edit against the edit of the turn before (`nextSteps`), which tells the same four kinds of change (a zoom, a look, a cut, bigger captions). No migration.
4. **A zoom can only get tighter today** (`tighter` searches from the most down to just over the shot's own zoom, `ZOOM.most` 1.3). "Zoom less" on a still zoom above the take's sharp limit (the `soft-zoom` finding) has no move and depends on the model writing a framing by hand; Task 10 decides by measure whether it stays. On a piece pushed here (item 1), "Zoom less" works: the push is made again to a lower target.
5. **The preview's furniture and the review's zones disagree** (safe-zones §4): the review's bottom bars are 20 to 22 % of the height, the furniture at rest about 9 %. A caption at `y` 0.82 looks clear in the preview and is `under-buttons` in the review. The review's zones are not changed in this slice (see "Not changed: the review's zones").

---

## File structure

Created:

| File | Task | One job |
|---|---|---|
| `src/lib/edit/agent/moment.ts` | 1, 2, 3 | the moment: resolved from a frame, written as a block, the pointing test, the snap, the zoom here, the proof's measures |
| `src/lib/edit/agent/__tests__/fixture.ts` | 1 | the agent suites' made-up edit and analysis, moved out of `context.test.ts` |
| `src/lib/edit/agent/__tests__/moment.test.ts` | 1, 2, 3 | its tests |
| `src/lib/edit/agent/moments.json` | 4 | the six proof requests and the fifteen control runs |
| `src/components/editor/before-the-cut.tsx` | 5 | moved out of `editor-screen.tsx`: `BeforeTheCut`, `WaitLine`, `PickAgain`, `Unshown`, `BEHIND` |
| `src/components/editor/editor-tools.tsx` | 5, 6 | the tools row: Look, Captions, Original, the preview button |
| `src/components/editor/original.ts` | 5 | the take with nothing on it, and the mapping both ways |
| `src/components/editor/posted.ts` | 6 | the preview's geometry, the furniture's table, the remembered choice |
| `src/components/editor/posted-preview.tsx` | 6 | the full-screen overlay: backdrop, close, switch, furniture, the app's band, a scrubber |
| `src/lib/edit/kept.ts` | 8 | a finding's key, what is left to check, what is carried |
| `src/lib/edit/next-steps.ts` | 8 | the steps after a change |
| `src/app/api/edit/edits/[id]/kept/route.ts` | 8 | `POST …/kept {finding}` |
| `src/components/editor/fixes.ts` | 9, 10 | a finding's sentence for a creator, its fix |
| `src/components/editor/finding-card.tsx` | 9 | the card of screen 8 |
| tests: `src/components/editor/__tests__/original.test.ts`, `posted.test.ts`, `posted-preview.test.tsx`, `fixes.test.ts`, `finding-card.test.tsx`; `src/lib/edit/__tests__/kept.test.ts`, `next-steps.test.ts` | | |

Modified: `src/lib/edit/agent/{context,loop,prompt}.ts` and their tests; `src/app/api/edit/agent-calls.ts`; `src/app/api/edit/edits/store.ts`; `src/app/api/edit/edits/[id]/{change,cut,ops}/route.ts`; `src/app/api/edit/__tests__/edit-turns.test.ts`; `src/lib/edit/edit-view.ts`; `src/components/editor/{editor-screen,editor-stage,editor-scrubber,editor-field,editor-thread,editor-icons,edit-session,use-edit}.ts(x)` and their tests, `__tests__/views.ts`; `scripts/edit-agent-proof.ts`.

Not touched: the migration (both columns `at` and `kept` exist), `src/lib/edit/review.ts`, `src/lib/edit/zones.ts`, the catalogue, `systemPrompt()`, `POST /api/edit/agent`, `src/app/dev-edit/**`, `src/components/ui/**`.

---

### Task 1: The moment, resolved (agent track)

**Files:**
- Create: `src/lib/edit/agent/moment.ts`, `src/lib/edit/agent/__tests__/moment.test.ts`, `src/lib/edit/agent/__tests__/fixture.ts`
- Modify: `src/lib/edit/agent/context.ts` (extract and export `cleanCuts` from `timeCut`, behaviour unchanged), `src/lib/edit/agent/__tests__/context.test.ts` (import the fixture instead of declaring it)

**Interfaces:**

Consumes: `layout`, `momentAt`, `frameOf`, `placed`, `runWords`, `Run`, `Layout` (`src/lib/edit/derive.ts`); `pagesFor` (`src/edit/film/pages.ts`); `analysisOf`; `unquoted` (`context.ts:1228`); `FPS`, `frameAt`, `msOf`.

Produces:

```ts
// context.ts: the list timeCut builds today (context.ts:1018-1025), exported, timeCut calling it.
export interface CutPoint { film: number /* film ms */; index: number /* shot */; ms: number /* of its take */ }
/** Every moment a cut may land on, in film order: each shot's start, each pause's cut@ inside a shot, and the film's end. */
export function cleanCuts(edit: Edit, analyses: Analyses): CutPoint[];

// moment.ts
/** A start or an end within this many frames of the moment is the moment (CUT_NEAR_MS, one second). */
export const NEAR = 30;
/** What counts as on the moment, in frames, for the snap's window and the proof's measure. */
export const ON = 3;
/** A word that ended this long ago or less is "just said" while nothing is being said. */
export const JUST_SAID_MS = 200;

export interface WordHere { index: number; startMs: number; endMs: number; from: number; to: number; how: "saying" | "just said" | "next" | "last" }
export interface Stretch { first: number; last: number; from: number; to: number } // word indexes; film frames [from, to)
export interface Showing { id: string; part: string; kind: "mark" | "item"; shot: string | null; from: number; to: number }
export interface Moment {
  frame: number;      // the paused film frame (`at`)
  frames: number;     // the film's length
  shot: string;       // the shot under it (momentAt)
  take: string;       // that shot's asset
  ms: number;         // the take's moment there
  word: WordHere | null;   // null where the take says nothing (a picture)
  start: number;      // where something new "here" starts: word.from while saying, else frame
  startMs: number;    // the take's moment at `start`, on `startShot`
  startShot: string;
  sentence: Stretch | null;
  page: Stretch | null;    // the caption page on screen; null with captions off or none on screen
  part: { from: number; to: number; fromMs: number; toMs: number; words: { first: number; last: number } | null; sentences: number };
  showing: Showing[];      // every mark and item placed on the frame, in `placed` order
}

export function momentFor(edit: Edit, analyses: Analyses, at: number): Moment | null; // null when `at` is no frame of the film
export function pointsAt(request: string): boolean;
export function momentBlock(moment: Moment, edit: Edit): string; // the lines under "moment:", no heading

export type Landing = "zoom" | "cut" | "starts" | "word" | "ends";
export function landed(kind: Landing, moment: Moment, before: Edit, after: Edit): boolean;
export type Whole = "pauses" | "look" | "title-out" | "faster";
export function stayedWhole(kind: Whole, before: Edit, after: Edit, analyses: Analyses): boolean;
```

How each anchor is found (the rules a reader could get wrong):

- `word`: among the take's words (hidden ones count, they are said) in the run under the frame: the one with `startMs <= ms < endMs` (`saying`); else the last that ended at most `JUST_SAID_MS` before `ms` (`just said`); else the next word whose start lies inside the run (`next`); else the run's last word that ends at or before `ms` (`last`); none in the run: null. `from`/`to` are the word's film frames in that run (`frameOf` on the shot under the frame, held inside the run).
- `sentence`: the words after the last word before it whose text ends a sentence (`/[.!?]["”’']?$/`, the test `afterWord` uses) up to and including the next that ends one; in a take with no such word, the words between silences of 400 ms or more. Null when `word` is null.
- `page`: `pagesFor(edit.captions, runWords(edit, run), run.frames)` of the run under the frame, the page whose `[from, to)` holds `frame − run.at`; its words mapped back to the take's indexes by order (`runWords` drops hidden words and the index: keep your own list of the indexes it kept). Null with `captions.on` false or no page there.
- `part`: the two `cleanCuts` either side of the frame's film ms (the one at or before, the next after); `fromMs`/`toMs` are those film ms (what `time.cut` takes); `sentences` counts the sentences the part's words touch.
- `showing`: `placed(edit)` with `at <= frame < at + frames`.

The block (`momentBlock`), one line each, in this order. Word texts as the `words` section writes them, bare:

```
paused frame=<frame> of film <frames>f: shot <shot> at <ms> ms of take <take>. In the request, "here", "now" and "this" are this frame; "this word", "this sentence", "this part" and what is "showing" are the lines below. A request that points at none of them is about the whole video. say tells it as "here" or by what is said there, never as a frame or a time.
<word line> New here as a mark: "shot":"<startShot>","atMs":<startMs>; as an item: "anchor":"start","at":<start>.
sentence w<first>-w<last> film=[<from>,<to>)f            | sentence: none
page w<first>-w<last> film=[<from>,<to>)f                | page: no captions on screen
part film=[<from>,<to>)f w<first>-w<last>: the least that cuts cleanly around this frame[; it holds <n> sentences]; for time.cut "fromMs":<fromMs>,"toMs":<toMs>
showing: <kind> <id> <part> film=[<from>,<to>)f[, to end it on this frame "frames":<frame-from> | "lenMs":<ms>][; …]   | showing: nothing but the footage and the captions
```

Word lines: `word w<i> <text> [<startMs>,<endMs>) film=[<from>,<to>)f, being said.` · `word w<i> <text> [<startMs>,<endMs>) film=[<from>,<to>)f, just said; none is being said.` · `word: none is being said; the next is w<i> <text> [<startMs>,<endMs>), from frame <from>.` · `word: none is being said; the last before it is w<i> <text> [<startMs>,<endMs>).` · `word: none; nothing is said here.` The part line with no words reads `part film=[a,b)f, no words: …`. "to end it on this frame" is written for an item anchored at the start (`"frames"`) and for a mark (`"lenMs"`, film ms, at least `MIN_MARK_MS`). Task 3 adds a `zoom:` line between `part` and `showing`.

`pointsAt` (H0), exactly:

```ts
/** The request points at the paused frame: "here", "now", or "this" not followed by a word for the whole film. Quoted text does not count. English only. */
const POINTING = /\b(?:here|now)\b|\bthis\b(?!\s+(?:whole\s+)?(?:video|clip|film|edit)\b)/i;
export const pointsAt = (request: string): boolean => POINTING.test(unquoted(request));
```

The measures (the proof's verdict, Task 4; misses stay strict):
- `starts`: the after edit has exactly one title, call-out, cutaway or sound whose id is new; its first frame F satisfies `start − ON <= F <= frame + ON`.
- `ends`: the one title or call-out placed on `frame` in `before` still exists, its first frame is unchanged, its end E satisfies `|E − frame| <= ON`, and no other thing's length changed.
- `word`: the take's words whose `stress` differs between before and after are exactly `[word.index]`.
- `cut`: after is shorter; the word under the frame is no longer shown (no run of `after` shows its middle); every word no longer shown lies in `sentence`.
- `zoom`: let `z(e, f)` be the framing's zoom on frame f (`momentAt`, the shot, `framingAt`). The first frame F where `z(after, F) > z(before, F) + 0.01` satisfies `|F − frame| <= ON`; `z(after, min(frame + 15, end)) >= z(before, same) + 0.05`, where `end` is the last frame of the shot under the frame in `before`; no frame outside `[that shot's first frame, end]` differs in zoom. (The film's length is unchanged by a split, so frames line up.)
- `stayedWhole("pauses")`: at least two of the take's measured pauses show fewer ms in after than in before. `("look")`: `after.look` differs from `before.look` and every shot's own `look` is as it was. `("title-out")`: no title is placed in after. `("faster")`: every shot of after has speed 1.25 (±0.01).

**Behaviour** (all on the moved fixture `twoShots()`: s1 = take ms [0,2400) on frames [0,72), a 6-frame fade into s2 = [3000,6000) on frames [66,156), zoom 1.2, mono; words w0 Hi [300,500), w1 there [500,800), w2 so [1500,1700) hidden, w3 this [1700,2100), w4 works [3200,3600), w5 well [3600,4000) hidden; pauses cut@ 1200 and 2700; no punctuation):
1. `momentFor(e, a, 55)`: shot s1, ms 1833, word w3 `saying` with from 51, to 63; start 51, startMs 1700; sentence w2-w3 (the 700 ms silence after w1 breaks it); part from 36 to 66, fromMs 1200, toMs 2200, words w2-w3, sentences 1.
2. `momentFor(e, a, 30)` (ms 1000, 200 ms after w1 ended): word w1 `just said`; start 30. At 31 (233 ms after): word w2 `next`, from 45; start 31.
3. `momentFor(e, a, 140)`: shot s2; word w5 `last` (no word after it); start 140.
4. `momentFor(e, a, 68)`: shot s2 (in a fade the one coming in), ms 3067. `momentFor(e, a, 156)` and `(e, a, -1)`: null.
5. `momentFor(e, a, 75).showing` holds the call-out m1 `[72,96)`, the sound p1 and the bar; `momentFor(e, a, 20).showing` holds only the bar.
6. With `captions.on` false, `page` is null and the block reads `page: no captions on screen`.
7. `pointsAt`: "Zoom in here." true · "Cut this part" true · "Start now" true · "Make this video warmer" false · "Make it warmer" false · `Add the word "here" as a title` false · "Nowhere to go" false · "this whole clip faster" false.
8. `momentBlock(momentFor(e, a, 55), e)` equals an exact expected string written out in the test from the formats above (first line verbatim).
9. `cleanCuts(e, a)` gives film ms 0, 1200, 2200 and 5200, in that order; `timeCut`'s own tests pass unchanged.
10. Measures for the moment at 55, one passing and one failing edit each, made with `applyOps` on the fixture: `starts` (a new title item at 53 true; at 60 false); `ends` (with a title item on `[0,156)` added to `before`, its `frames` set to 55 true; to 50 false); `word` (stress w3 true; w2 and w3 false); `cut` (`shot.trim {id: "s1", endMs: 1200}`, which takes w2 and w3, true; the same plus `shot.trim {id: "s2", startMs: 3700}`, which also takes w4, false); `zoom` (a split of s1 at 1833 and a push on the piece from frame 55 true; s1 zoomed whole from frame 0 false); each `stayedWhole` kind true and false.

**Steps:**
- [ ] Move `take`, `pop`, `twoShots`, `box`, `MOUTH`, `faces`, `analysis` and the constants they use from `context.test.ts:15-70` into `__tests__/fixture.ts`, exported, unchanged; import them in `context.test.ts`. Run `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/agent/__tests__/context.test.ts` → green as before.
- [ ] Extract `cleanCuts` from `timeCut` (the `points` list and the end point); test case 9 first, then the extraction; `context.test.ts` green.
- [ ] Write `moment.test.ts` cases 1 to 10; run, see them fail; write `moment.ts`; run until green.
- [ ] `pnpm exec tsc --noEmit`; `pnpm exec eslint src/lib/edit/agent/moment.ts src/lib/edit/agent/context.ts src/lib/edit/agent/__tests__/`.
- [ ] Commit: `feat(edit-agent): the moment a request is about, resolved in code` with the trailer, the paths named.

---

### Task 2: The moment, sent to the agent (agent track)

**Files:**
- Modify: `src/lib/edit/agent/loop.ts` (`AgentInput.at`, `change`, `codeMoves`), `src/lib/edit/agent/prompt.ts` (`requestMessage`), `src/lib/edit/agent/moment.ts` (`snapToMoment`), `src/app/api/edit/agent-calls.ts` (`changeEdit`), `src/app/api/edit/edits/[id]/change/route.ts`, `src/app/api/edit/edits/store.ts` (`EDIT_SAID.moment`)
- Test: `src/lib/edit/agent/__tests__/{loop,prompt,moment}.test.ts`, `src/app/api/edit/__tests__/edit-turns.test.ts`

**Interfaces:**

Consumes: Task 1's `momentFor`, `momentBlock`, `pointsAt`, `NEAR`, `ON`, `Moment`; `placed`, `momentAt`, `applyOps`.

Produces:

```ts
// loop.ts
export interface AgentInput { /* …as today… */ /** The film frame of `edit` the video was paused on; left out when the request has none. */ at?: number }
export function codeMoves(was: Edit, edit: Edit, sent: readonly unknown[], analyses: Analyses, library: readonly Asset[], request = "", here: Moment | null = null): { edit: Edit; ops: Op[]; says: string[]; gave: GaveWay[] };

// prompt.ts
export function requestMessage(context: Context, request: string, moment?: string): string;
// no moment: exactly `${sections(context)}\n\nrequest:\n${request}\n\n${ONLY}` (today's bytes)
// a moment:  `${sections(context)}\n\nmoment:\n${moment}\n\nrequest:\n${request}\n\n${ONLY}`

// moment.ts
/** H1 and H2: a start or an end the answer set within NEAR frames of the moment, put on it. Ops for the door; none when nothing is near. */
export function snapToMoment(was: Edit, edit: Edit, here: Moment): { ops: Op[]; says: string[] };

// agent-calls.ts
export async function changeEdit(who: Creator, takes: readonly TakeRow[], edit: Edit, request: string, begun: number, at: number | null = null): Promise<AgentResult | Response>;

// store.ts
EDIT_SAID.moment = "That moment is not in this video."
```

In `change`: `const here = input.at === undefined ? null : momentFor(input.edit, analyses, input.at)`; the first user message is `requestMessage(context, request, here ? momentBlock(here, input.edit) : undefined)`; the system message is `systemPrompt()` as today. `codeMoves` gets `here` only when `here !== null && pointsAt(request) && applied.length === 0` (an answer to the edit as handed in; after a change has been applied the frames are of another film), else null. In `codeMoves` the snap is the FIRST move, before `plainHighlight`, `stressShows`, `calloutVoice` and `labelGivesWay` (the label gives way six frames before the new text's first frame, so that frame must be final first).

`snapToMoment` rules:
- **Starts (H1):** each title, call-out, cutaway or sound placed in `edit` whose id is not placed in `was`, whose first frame F lies outside `[here.start − ON, here.frame + ON]` and within `NEAR` of `[here.start, here.frame]`, is moved to start on `here.start`: a mark on the shot that shows `here.startMs` (`here.startShot`) gets `mark.set {id, atMs: here.startMs}`; a mark on another shot gets `mark.remove {id}` then `mark.add {shot: here.startShot, mark: {...mark, atMs: here.startMs}}` (a mark cannot change shots); an item gets `item.set {id, anchor: "start", at: here.start}`. Further off: left, the creator named another place.
- **Ends (H2):** each thing placed on `here.frame` in `was` that is still in `edit` with another length, whose end E (first frame + frames) is not within ON of `here.frame` and is within NEAR of it, ends on `here.frame`: an item anchored at the start gets `item.set {id, frames: here.frame − its first frame}`; a mark gets `mark.set {id, lenMs: max(MIN_MARK_MS, round(msOf(here.frame − its first frame, 1)))}` (a mark's `lenMs` is film time).
- `says` is empty: the model's sentence already says "here".

The route (R16's order kept): after the body, the hold, the edit, its export and its turns, and once the doc shown is read: `at` given and `at >= filmFrames(doc)` → 400 `EDIT_SAID.moment`, no model call; else `changeEdit(…, body.data.at ?? null)` and `at` stored as today.

**Behaviour:**
1. `requestMessage(c, r)` and `requestMessage(c, r, undefined)` are equal to today's pinned string (the existing pin in `loop.test.ts` passes unchanged).
2. `change` with `at` and without: `messages[0].content` is `systemPrompt()` in both; the first user message with `at: 55` on the fixture contains `\n\nmoment:\npaused frame=55 of film 156f:` directly before `\n\nrequest:\n`; without `at` it contains no `moment:`.
3. `at: 156` (past the end): no block, the change runs as without.
4. Snap a mark: "Add a call-out "Go" here." at 55 (start 51); the stubbed model adds a call-out mark on s1 at `atMs` 1500 (frame 45): the edit taken has it at 1700. At `atMs` 660 (frame 20, 31 frames off): left at 660.
5. Snap an item: "Add a title "Go" from here." at 55; the model adds a title item at 70: taken at 51, anchor start.
6. A mark onto another shot: at 75 (s2, w4 saying, start 72, startMs 3200); the model adds a call-out on s1 at 2200 ms (frame 66): taken as a mark of s2 at 3200 with the same id.
7. Snap an end: "End the bar here." at 55; the model sets the bar's `frames` to 50: taken as 55.
8. Not pointing: "Add a call-out "Go" at the start." with `at: 55`: the model's 1500 stays. And a request with no `at`: `codeMoves` runs as today (its existing tests unchanged).
9. Only the first answer: a stubbed two-round run where round 1 is refused by the door and round 2 adds the mark at 1500: snapped (nothing was applied yet). A run whose round 1 applied a trim and round 2 adds the mark: not snapped.
10. Order: a new call-out snapped onto 51 on the fixture with a title item that stays to the end: the title gives way at 45 (51 − 6), not before the model's own frame.
11. Route: `at: 9999` → 400 "That moment is not in this video.", the model not asked, nothing written; `at` a frame inside the edit's film → the stubbed ask's first user message holds `moment:\npaused frame=<at>`, the turn stores `at`; no `at` → no `moment:` in the message, `at` stored null.

**Steps:**
- [ ] Tests 1 to 3 and 11 first (they fail on the missing argument and route check); then `prompt.ts`, `loop.ts`'s `AgentInput` and `change`, `agent-calls.ts`, the route; green.
- [ ] Tests 4 to 10; then `snapToMoment` and its place in `codeMoves`; green.
- [ ] Run the whole agent suite and the routes: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/agent src/app/api/edit` → green (rerun `context.test` alone on a timeout). `pnpm exec tsc --noEmit`; eslint on the changed files.
- [ ] Commit: `feat(edit-agent): a request carries its moment to the agent; a start or an end near it is put on it`.

---

### Task 3: Zoom in here (agent track)

**Files:**
- Modify: `src/lib/edit/agent/context.ts` (`tighter`, `zoomFor`: a push), `src/lib/edit/agent/moment.ts` (`zoomHere`, `PUSH_MS`, `isPush`, the block's `zoom:` line), `src/lib/edit/agent/loop.ts` (`withMoves` gets `here`)
- Test: `src/lib/edit/agent/__tests__/{moment,context,loop}.test.ts`

**Interfaces:**

Consumes: Task 1's `Moment`, `cleanCuts`, `ON`; `framingAt`, `layout`, `applyOps`, `ZOOM`, `MIN_FRAMES`.

Produces:

```ts
// moment.ts
/** How long the push into a zoom "here" takes, then it holds. */
export const PUSH_MS = 400;
/** A framing made by zoomHere: a move eased out that starts at 0 of its part and reaches its end within the shot. */
export function isPush(framing: Shot["framing"]): boolean; // move !== null && move.ease === "out" && move.part[0] === 0 && move.part[1] >= 1
export function zoomHere(edit: Edit, analyses: Analyses, here: Moment, zoom: number, slow: boolean, library: readonly Asset[]): { ops: Op[]; says: string; first: number; last: number; to: number } | { none: string };

// context.ts: an optional last argument; every existing call is unchanged.
export interface Push { from: Frame; part: number }
function tighter(edit, analyses, index, most, slow: boolean, push?: Push): Shot["framing"] | null;
export function zoomFor(edit, analyses, id, zoom, slow: boolean, push?: Push): { framing: Shot["framing"] } | { none: string };

// loop.ts
export function withMoves(edit: Edit, analyses: Analyses, ops: readonly unknown[], library: readonly Asset[], here: Moment | null = null): …as today…;
```

With `push`, `tighter` builds `{ from: push.from, move: { to, ease: "out", part: [0, push.part] } }` for each candidate `to` (the same search, the same face line held, the same review check), skips the "moves already" refusal when the shot `isPush`, and `own` (the lower bound of the search and the face's place now) is `push.from`. `zoomFor` with `push` gives the same refusals as today except the in-speech one (a push makes no cut).

`zoomHere`, in order (the algorithm the plan pins):

```
S  = the shot here.shot, i its index, P its place in layout(edit)
if S.framing.move !== null and not isPush(S.framing): none `shot "<S>" moves already: set its framing plain first, or leave it`
if isPush(S.framing):                       // a zoom made here before: made again, from the same start
    framing = zoomFor(edit, analyses, S, zoom, slow, { from: S.framing.from, part: slow ? 1 : (S.endMs − S.startMs) / PUSH_MS })
    → ops [shot.set S framing]; first = P.at; says "from where it started"
clean = the cleanCuts point nearest here.frame (by film frame) if within ON frames, else none
on, piece:
    clean at S's own start (P.at)          → no split; piece = S
    clean inside S (a pause's cut@)        → split S at clean.ms (newId <S>-z, as withMoves names pieces); piece = the new shot
    otherwise, here.frame − P.at > ON and P.at + P.frames − here.frame > ON
                                           → split S at here.ms; piece = the new shot
    otherwise                              → no split; piece = S
end: e = the first pause of the take with cutMs >= the end of the sentence's last word (here.sentence; or of here.word when there is no sentence)
    if piece.startMs + PUSH_MS + 100 <= e.cutMs <= piece.endMs − 100: split the piece at e.cutMs (newId <piece>-b); says "from here to the end of the sentence"
    else the piece runs to its shot's end; says "from here to the next cut" (or "from here to the end" when S is the film's last shot)
framing:
    when the piece starts at a clean cut: try still first: zoomFor(on, analyses, piece, zoom, slow)
    else, or when still has none: zoomFor(on, analyses, piece, zoom, slow, { from: framingAt(piece, piece.startMs), part: slow ? 1 : pieceMs / PUSH_MS })
    none → { none } with zoomFor's sentence, and NO ops (the splits are not made)
ops = [the splits…, { op: "shot.set", id: piece, framing }]; first/last = the piece's film frames; to = framing's target zoom
```

A split that removes nothing leaves the sound untouched: the pieces run on (`runsOn`: same file, same speed, plain cut, contiguous), so the run, and the sound the kit plays for it, is one as before.

In `withMoves`' zoom branch: when `here !== null`, the op's `id === here.shot`, and the ops before it in the answer left the shots as they were (`JSON.stringify(before.edit.shots) === JSON.stringify(edit.shots)`), call `zoomHere(before.edit, analyses, here, read.data.zoom, read.data.slow === true, library)` instead of today's path (the `word` the model sent is ignored); ok → push its ops and its `says`; none → `refuse(`${none}. Zoom another part and say which part stays as it is; or send "ops": [] and say what is in the way`)`. Any other zoom: today's path. In `change`, `withMoves` gets the same `here` that `codeMoves` gets (Task 2's condition).

When the review refuses the zoom here (no framing passes: a title or a call-out over the face, the captions in the way, nothing tighter fits), nothing is split and the move refuses with that reason; the loop's next round shows it to the model, which answers with `"ops": []` and says what is in the way. Task 4 counts that run a miss.

The block's `zoom:` line (between `part` and `showing`), from `zoomHere(edit, analyses, moment, ZOOM.most, false, [])`:
- ok: `zoom: shot.zoom on <shot> starts on this frame; the code splits the shot here and pushes in until <frame <last + 1>, the end of the sentence | frame <last + 1>, the next cut>; up to <to>`
- none: `zoom: none here: <none>`

**Behaviour** (fixture of Task 1; zoom limit of its 720×1280 take is 1.33):
1. `zoomHere` at 40 (s1, ms 1333, in a pause, 4 frames from the cut@ 1200 at frame 36): ops `shot.split {id: "s1", atMs: 1333, newId: "s1-z"}` then `shot.set {id: "s1-z", framing: {from: {zoom: 1, x: 0, y: 0}, move: {to: …, ease: "out", part: [0, 1067 / 400]}}}`; no end split (the sentence w2-w3 ends at 2100 and the next cut@, 2700, is past s1's end); `says` "from here to the next cut". Applied: the door takes it; `review` finds no error the fixture did not have; `landed("zoom", momentFor(e, a, 40), e, after)` true; `layout(after).runs.length === layout(e).runs.length` and `layout(after).frames === layout(e).frames`.
2. At 37 (one frame from the cut@ at 36): split at 1200 and a still framing (`move: null`).
3. At 2 (two frames from s1's start): no split; the zoom covers s1 from its start, still where it passes, else pushed.
4. A title item over the face on frames [0,72): at 40 → `{none}` naming the title or call-out, no ops; `withMoves` with `here` refuses with that sentence plus the suffix.
5. At 100 in s2 (already 1.2): split in s2 at its ms; the push's `from` is `{zoom: 1.2, x: 0, y: 0}`; the join has no jump (`framingAt` of the piece before at its end equals the push's `from`).
6. A push made again: on the result of case 1, `zoomHere` at 50 (inside `s1-z`) with zoom 1.1 → one op, `shot.set` on `s1-z` with the same `from` and part, a lower `to`; no split.
7. `withMoves(e, a, [{op: "shot.zoom", id: "s1", zoom: 1.3}], [], momentFor(e, a, 40))` gives case 1's ops; the same with `here` null gives today's ops (existing tests unchanged); with `id: "s2"` and the moment in s1: today's path.
8. `momentBlock` at 40 holds a line matching `/^zoom: shot\.zoom on s1 starts on this frame; the code splits the shot here and pushes in until frame \d+, the next cut; up to 1\.\d+$/m`; with case 4's title: `zoom: none here: …`.
9. `isPush`: case 1's framing true; a `slow` framing from `tighter` (ease linear) false; a still framing false.
10. `zoomFor` and `tighter` without `push`: every existing test in `context.test.ts` passes unchanged.

**Steps:**
- [ ] Tests 9 and 10's push variant for `tighter`/`zoomFor` first; then the optional `push`; `context.test.ts` green (rerun alone on a timeout).
- [ ] Tests 1 to 6 and 8; then `zoomHere`, `isPush`, the block line; green.
- [ ] Test 7; then `withMoves`' branch and `change` passing `here`; `loop.test.ts` green.
- [ ] Whole agent suite, tsc, eslint as in Task 2.
- [ ] Commit: `feat(edit-agent): "zoom in here" starts on the moment: a split there and a push, no cut in speech`.

---

### Task 4: Proof of the moment (agent track; model calls)

**Files:**
- Create: `src/lib/edit/agent/moments.json`
- Modify: `scripts/edit-agent-proof.ts` (mode `moments`; `examples` reads `moments.json` too)

**Interfaces:**

Consumes: `change` with `at`, `momentFor`, `landed`, `stayedWhole` (Tasks 1 to 3); the script's own `takeOf`, `asking`, `baseOf`, cost and record writing.

Produces: `moments.json`:

```json
{
  "about": "E15's proof: six requests that point at the paused frame and fifteen control runs of requests about the whole video sent with a moment, each on the house first cut of the owner's take, three runs each. A moment is a word's index in the take or a share of the film, never a word's text; every text asked to be written is made up. allowed: everyday words the requests use that the take also says.",
  "allowed": ["here", "this"],
  "moments": [
    { "id": "m01", "request": "Zoom in here.", "at": { "in": 22 }, "lands": "zoom" },
    { "id": "m02", "request": "Cut this part.", "at": { "in": 14 }, "lands": "cut" },
    { "id": "m03", "request": "Add a title \"Part two\" from here.", "at": { "before": 19, "ms": 150 }, "lands": "starts" },
    { "id": "m04", "request": "Add a call-out \"New tool\" here.", "at": { "in": 16 }, "lands": "starts" },
    { "id": "m05", "request": "Stress this word in the captions.", "at": { "in": 21 }, "lands": "word" },
    { "id": "m06", "request": "End the title here.", "at": { "after": 8, "ms": 300 }, "lands": "ends" }
  ],
  "controls": [
    { "id": "c08", "of": "r08", "at": { "film": 0.5 }, "whole": "pauses" },
    { "id": "c11", "of": "r11", "at": { "film": 0.5 }, "whole": "look" },
    { "id": "c12", "of": "r12", "at": { "film": 0.5 }, "whole": "look" },
    { "id": "c18", "of": "r18", "at": { "film": 0.5 }, "whole": "title-out" },
    { "id": "c19", "of": "r19", "at": { "film": 0.5 }, "whole": "faster" }
  ]
}
```

`at` forms, turned into a film frame of the base the script runs on: `{in: i}` the middle of word i (`(startMs + endMs) / 2`), `{before: i, ms}` and `{after: i, ms}` n ms before word i starts or after it ends, each through `frameOf` on the shot that shows that moment; `{film: s}` `floor(frames × s)`. A control's request is `requests.json`'s request of that id.

The mode:

```
pnpm exec tsx scripts/edit-agent-proof.ts moments [--tag <tag>] [--base <first cut's json>] [--runs <n>] [--calls <n>] [--short-block] [<id>…]
```

Each moment and control `--runs` times (3), on `--base` (use `.scratch/native-default-2/first-cut/house-1.json`, the first cut the last gate ran on, on which the six frames are 276, 154, 234, 190, 267 and 91: the script prints the frames it computed and stops if any differs), with `change({…, at})`. Each run is written as today's records plus `at`, `landed` (or `whole`) as computed by `moment.ts`, and the model calls it took. `--calls` (60) is a hard cap: the asking wrapper counts every call, and once the next run could pass the cap no run starts; runs not made are listed and count as misses. At the end it prints, per id, the runs that landed (or stayed whole), the totals against the bars (15 of 18; 14 of 15), the calls, the median seconds and the cents. `--short-block` sends, for a request where `pointsAt` is false, only the block's first line (the fallback below).

`examples` also reads every string of `moments.json`: a word of the take of four letters or more that is not in `allowed`, or three words of the take in a row, fails it (by place, never printing the word). A request that fails is reworded with made-up words, never allowed in.

**Behaviour:**
1. `examples` passes with `moments.json` as written (if it does not, reword the request it names and run it again; `allowed` gets no word beyond the pointing ones).
2. The six frames printed are 276, 154, 234, 190, 267 and 91.
3. The run stays within 60 calls and prints its cost.
4. Bars: at least 15 of the 18 moment runs land; at least 14 of the 15 controls stay whole.
5. If the controls miss their bar: run the controls again once with `--short-block` (within a second cap of 25 calls); if that passes, make the short form the code's (in `change`: the full block when `pointsAt(request)`, else the first line alone), add a test for it in `loop.test.ts`, and record both runs. If the eighteen miss their bar, change nothing: report the runs per id and the misses' reasons from the records.

**Steps:**
- [ ] Write `moments.json`; extend `examples`; run `pnpm exec tsx scripts/edit-agent-proof.ts examples --base .scratch/native-default-2/first-cut/house-1.json` → passes.
- [ ] Add the `moments` mode. Dry check without the model: `--runs 0` prints the frames and the plan of runs and exits 0.
- [ ] Run: `pnpm exec tsx scripts/edit-agent-proof.ts moments --tag slice-b-moments --base .scratch/native-default-2/first-cut/house-1.json --calls 60`. Keep the output folder under `.scratch/` (not committed).
- [ ] Step 5 if needed.
- [ ] `pnpm exec tsc --noEmit` for `src/` (the repo's tsc skips `scripts/`, so the script is held by `pnpm exec eslint scripts/edit-agent-proof.ts` and by its `--runs 0` dry check).
- [ ] Commit `moments.json` and the script: `test(edit-agent): the moment's proof, six requests and fifteen controls`. Report the table (per id, landed of 3), the totals, the calls and the cents; no word of the take.

---

### Task 5: The original (page track)

**Files:**
- Create: `src/components/editor/original.ts`, `src/components/editor/before-the-cut.tsx`, `src/components/editor/editor-tools.tsx`, `src/components/editor/__tests__/original.test.ts`
- Modify: `src/components/editor/editor-screen.tsx`, `editor-stage.tsx` (`badge`, `StageHandle.playing`, `onPlayingChange`), `editor-icons.tsx` (`EyeIcon`, from the drawing's `eye` path), tests `editor-screen.test.tsx`, `editor-stage.test.tsx`

**Interfaces:**

Consumes: `newEdit`, `momentAt`, `frameOf`, `layout`, `filmFrames`, `frameAt`, `msOf`.

Produces:

```ts
// original.ts (pure)
/** The take with nothing on it (E16): newEdit of the take the edit's first shot shows (its first three minutes), captions off. Null when that is no video. */
export function plainEdit(edit: Edit): Edit | null;
/** The take's moment a film frame shows; null past the film's end. */
export function takeMomentAt(edit: Edit, frame: number): { asset: string; ms: number } | null;
/** The frame of the plain edit that shows a moment of the take, held inside it. */
export function plainFrameAt(plain: Edit, ms: number): number;
/**
 * The film frame that shows a moment of the take: the first that shows it (exact); when the film shows it nowhere (cut out),
 * the first frame of the shot that starts soonest after it; past every shot, the film's last frame.
 */
export function filmFrameAt(edit: Edit, asset: string, ms: number): { frame: number; exact: boolean };

// editor-stage.tsx
export interface StageHandle { seek(frame: number): void; play(): void; pause(): void; /** The medium on the stage is playing, or plays on after a seek. */ playing(): boolean }
interface StageProps { /* … */ /** A word over the footage, top centre ("Original"); null for none. */ badge?: string | null; /** Told when the medium shown starts or stops playing. */ onPlayingChange?(playing: boolean): void }

// editor-tools.tsx
export interface ToolsProps { disabled: boolean; watching: boolean /* Original is usable: a cut is shown, no call out, or an export runs */; original: boolean; onLook(): void; onCaptions(): void; onOriginal(): void }
export function EditorTools(props: ToolsProps): JSX.Element; // Task 6 adds onPreview
```

Page rules (in `editor-screen.tsx`):
- State `original: { film: number; plain: number } | null`. On: `f = playhead.get()`, `m = takeMomentAt(shown, f)`, `p = plainFrameAt(plain, m.ms)` (0 when m is null), `was = stage.playing()`; set; after the commit (a layout effect on `original`) `seek(p)` and `play()` when `was`. Off: `q = playhead.get()`; target `original.film` when `q === original.plain`, else `filmFrameAt(shown, asset, msOf(q, 1)).frame`; set null; after the commit `seek(target)`, `play()` when it was playing.
- The stage gets `edit={original ? plain : shown}` and `badge={original ? "Original" : null}`; nothing else around the Player changes (the Player is never mounted again). `plain` is memoised on the take.
- The scrubber reads the frames of the edit on the stage and draws no rings while Original is on.
- Original turns off (by the same "off" rule) before anything that works on the film: a call going out (`working` becomes non-null), a sheet opening, the preview opening (Task 6), the card opening (Task 9), or the turn shown changing.
- The chip is usable when a cut is shown and no call is out, and also while an export runs (watching is allowed then, E20).
- Drawing: the chip (`Chip`, `selected` gives `aria-pressed` and the ink fill, `[&_svg]:size-4`) after Captions; the badge 26 tall, fully round, `bg-scrim`, 11 px side padding, `text-label font-[600]` in the footage glyph tone, 12 px from the top, centred, `pointer-events-none`.

**Behaviour:**
1. `plainEdit(FIRST)` (the views fixture's first cut): one shot of the take from 0 to `min(asset.ms, 180000)`, framing zoom 1, no marks, `items` empty, `captions.on` false, `look` `NO_LOOK`, `cover` null.
2. On a first cut with its start trimmed, for every frame f: `filmFrameAt(e, asset, takeMomentAt(e, f).ms)` is `{frame: f, exact: true}`.
3. A moment cut out between two shots → the next shot's first frame, `exact` false; a moment after every shot → the last frame, `exact` false.
4. The page: the chip "Original" reads `aria-pressed="false"`; pressed → "true", the stage shows "Original", the scrubber's `aria-valuemax` is the plain edit's frames − 1, and the element `.__remotion-player` is the same node as before the press.
5. Pressed again with the playhead not moved → `aria-pressed="false"`, no badge, the scrubber's `aria-valuenow` is the frame it left; the Player node is still the same.
6. Original on, then a request sent → the chip reads "false" before the call goes out.
7. While a call is out the chip is disabled; while an export runs it is not.
8. `StageHandle.playing()` is true after `play()` and false after `pause()`; `onPlayingChange` is told each change once.
9. Moving `BeforeTheCut`, `WaitLine`, `PickAgain`, `Unshown` and `BEHIND` to `before-the-cut.tsx` changes no test.

**Steps:**
- [ ] Move the four parts to `before-the-cut.tsx` (no change in them); run `src/components/editor` → green (test 9).
- [ ] `original.test.ts` cases 1 to 3; write `original.ts`; green.
- [ ] Stage tests 8 and the badge; then the stage's changes; `editor-stage.test.tsx` green.
- [ ] `editor-tools.tsx` with Look, Captions, Original (the page's tools row moved into it); screen tests 4 to 7; the page's state; green.
- [ ] `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor` (the guard included); tsc; eslint.
- [ ] Commit: `feat(editor): the take as it was shot, one tap away, on the same Player`.

---

### Task 6: The preview as it will be posted (page track)

**Files:**
- Create: `src/components/editor/posted.ts`, `src/components/editor/posted-preview.tsx`, tests `__tests__/posted.test.ts`, `__tests__/posted-preview.test.tsx`
- Modify: `editor-stage.tsx` (`frame` prop), `editor-scrubber.tsx` (`onFootage`), `editor-tools.tsx` (the preview button), `editor-icons.tsx` (`ExpandIcon`, `CloseIcon`, `HeartIcon`, `ChatIcon`, `SaveIcon`, `ShareIcon` from the drawing's `expand`, `x`, `heart`, `chat`, `mark`, `fwd`; `RepostIcon` and `DiscIcon` drawn new in the same 20 × 20 manner), `editor-screen.tsx`

**Interfaces:**

```ts
// posted.ts (pure, but readApp/keepApp, which touch localStorage inside try/catch)
export type App = "tiktok" | "reels" | "off";
export interface Box { left: number; top: number; width: number; height: number }
export interface PostedLayout { screen: Box; video: Box; clip: Box; band: Box | null }
export function postedLayout(app: App, win: { w: number; h: number }): PostedLayout;
export const POSTED_KEY = "maven.editor.posted";
export function readApp(): App;          // the stored choice; "tiktok" when none, unreadable, or storage throws
export function keepApp(app: App): void; // stores it; a storage that throws is ignored
export interface Shape { kind: "avatar" | "glyph" | "count" | "text" | "disc" | "tile" | "mark" | "follow"; icon?: "heart" | "chat" | "save" | "share" | "repost" | "more"; text?: string; box: readonly [number, number, number, number] }
export const FURNITURE: Record<"tiktok" | "reels", readonly Shape[]>;

// editor-stage.tsx
interface StageProps { /* … */ /** Promoted to the preview: the stage's own box placed by these styles, square-cornered, no shadow, no mute button. Null in the page. */ frame?: React.CSSProperties | null }

// editor-scrubber.tsx
interface ScrubberProps { /* … */ /** Drawn over the black of the preview: the track, the fill, the knob and the times in the footage glyph tone. */ onFootage?: boolean }

// posted-preview.tsx
export interface PostedPreviewProps {
  app: App; onApp(app: App): void; onClose(): void;
  layout: PostedLayout; title: string;        // the edit's title stands for the post's caption
  scrubber: React.ReactNode;                  // the page's Scrubber with onFootage
  closeRef: React.RefObject<HTMLButtonElement | null>;
}
```

The geometry (pinned; 1 pt is 1 px on a phone, `screen.h / 852` px in the framed screen):

```ts
const PHONE_W = 600; // narrower windows are a phone: the screen is the window
export function postedLayout(app: App, win: { w: number; h: number }): PostedLayout {
  const phone = win.w < PHONE_W;
  const h = phone ? win.h : win.h - 32;
  const w = phone ? win.w : (h * 393) / 852;
  const screen = { left: (win.w - w) / 2, top: phone ? 0 : 16, width: w, height: h };
  const pt = phone ? 1 : h / 852;
  const fit = (width: number, height: number, inside: Box): Box => ({ left: inside.left + (inside.width - width) / 2, top: inside.top + (inside.height - height) / 2, width, height });
  if (app === "off") {
    const vw = Math.min(w, (h * 9) / 16);
    const video = fit(vw, (vw * 16) / 9, screen);
    return { screen, video, clip: screen, band: null };
  }
  if (app === "tiktok") {
    // Shown whole at full width, black above (the status strip) and below (the app's band): 50 and 103 pt on a 393 × 852 phone.
    let [vw, vh] = [w, (w * 16) / 9];
    if (vh > h) [vh, vw] = [h, (h * 9) / 16];
    const free = h - vh;
    const above = Math.min(50 * pt, (free * 50) / 153);
    const video = { left: screen.left + (w - vw) / 2, top: screen.top + above, width: vw, height: vh };
    const band = { left: screen.left, top: screen.top + h - 103 * pt, width: w, height: 103 * pt };
    return { screen, video, clip: screen, band };
  }
  // Reels: the video covers the screen down to the app's band (82 pt), its sides cut.
  const clip = { left: screen.left, top: screen.top, width: w, height: h - 82 * pt };
  const vw = Math.max(clip.width, (clip.height * 9) / 16);
  const video = fit(vw, (vw * 16) / 9, clip);
  return { screen, video, clip, band: { left: screen.left, top: clip.top + clip.height, width: w, height: 82 * pt } };
}
```

The furniture, in percent of the video frame (left, top, width, height), from safe-zones §5.1 for a 393 × 852 phone. Names of the apps appear only on the switch; no logo, no mark; counts and names are made up:

```ts
export const FURNITURE = {
  tiktok: [
    { kind: "avatar", box: [87.2, 43.2, 10.0, 6.4] },               // a circle with a small plus under it
    { kind: "glyph", icon: "heart", text: "12.4K", box: [88.6, 54.8, 7.5, 5.7] },
    { kind: "glyph", icon: "chat", text: "318", box: [88.7, 64.1, 7.3, 6.1] },
    { kind: "glyph", icon: "save", text: "902", box: [89.6, 73.8, 5.5, 6.0] },
    { kind: "glyph", icon: "share", text: "211", box: [88.7, 83.1, 7.0, 6.3] },
    { kind: "disc", box: [88.6, 94.9, 7.4, 4.2] },
    { kind: "text", text: "yourname", box: [3.0, 87.1, 20, 2.1] },  // the name, a sound line under the caption: all 2.9 up
    { kind: "text", text: "(the title, two lines)", box: [3.0, 90.5, 70, 4.8] },
    { kind: "text", text: "♫ original sound", box: [3.0, 96.3, 60, 1.9] },
  ],
  reels: [
    { kind: "glyph", icon: "heart", text: "8,915", box: [85.1, 53.6, 6.1, 6.0] },
    { kind: "glyph", icon: "chat", text: "112", box: [85.5, 62.7, 5.6, 5.5] },
    { kind: "glyph", icon: "repost", text: "47", box: [85.7, 68.6, 5.1, 6.8] },
    { kind: "glyph", icon: "share", text: "260", box: [85.5, 78.8, 5.6, 5.7] },
    { kind: "glyph", icon: "more", box: [85.9, 88.6, 4.7, 1.3] },
    { kind: "tile", box: [84.7, 93.4, 7.1, 4.0] },
    { kind: "avatar", box: [8.4, 88.9, 8.1, 4.5] },
    { kind: "follow", text: "yourname", box: [18.4, 89.2, 28.8, 1.8] }, // the name and a "Follow" outline
    { kind: "text", text: "♫ Original audio", box: [18.6, 92.1, 15.8, 1.5] },
    { kind: "text", text: "(the title, one line)", box: [8.3, 95.2, 70, 1.8] },
    { kind: "mark", box: [12.0, 9.5, 2.6, 2.9] },                   // the top row: a back chevron, a square on the right
    { kind: "mark", box: [85.0, 9.5, 5.2, 2.9] },
  ],
} as const satisfies Record<"tiktok" | "reels", readonly Shape[]>;
```

`(the title, …)` is a stand-in in this table only: the component draws the edit's title there, cut to two lines (TikTok) or one (Reels) with an ellipsis. Shapes are white in both themes, a light text shadow over footage being the drawing's (`drop-shadow` through a token class, no literal); counts `text-caption font-[600]`, the name `text-ui font-[640]`, the caption `text-meta`, glyphs 32 px (TikTok) and 28 px (Reels) inside their boxes.

The overlay (`posted-preview.tsx`), drawn from screen 7:
- A backdrop: `fixed inset-0 bg-black z-[var(--z-modal-backdrop)]`.
- The stage (the page's own `#edit-stage`, never a second Player) gets `frame`: `position: fixed`, the `video` box, `z-index: var(--z-modal)`, `border-radius: 0`, no shadow, and `clip-path: inset(<clip.top − video.top>px <video right − clip right>px <video bottom − clip bottom>px <clip.left − video.left>px)` (each at least 0), which cuts Reels' sides.
- Above it (`z-[calc(var(--z-modal)+1)]`, `pointer-events-none` but on its controls): the furniture placed in the `video` box and clipped as the stage is; in the screen's top-left, 14 pt in and 10 pt under the video's top, the close button (36 drawn, 44 to tap, `bg-scrim`, `CloseIcon`, `aria-label="Close preview"`); centred on the same line, the switch (36 tall, fully round, `bg-scrim`, three options 13 pt apart; the chosen one on `bg-surface text-foreground`): a `role="radiogroup"` named "App" with three `role="radio"` buttons "TikTok", "Reels", "Off" (`aria-checked`, arrow keys move the choice); in the band, five plain marks (22 pt rounded squares, the middle one a filled 40 × 26 pt pill; labels under them on TikTok only: Home, Friends, Inbox, Profile, none under the pill) and, at the screen's bottom with 16 px gutters, the scrubber (`onFootage`); with Off, the scrubber alone at the bottom.
- The whole is `role="dialog"` named "Preview as posted" (not `aria-modal`: the stage's own Play and Mute stay reachable); while it is open the page's header, its panel and its own scrubber carry `inert`; the close button takes the focus on open; Escape or the close button closes it and gives the focus back to the preview button.

Page rules: the tools row gets an icon button at its right end (36 drawn, `IconButton`, `ExpandIcon`, `aria-label="Preview as posted"`), usable whenever Original is; pressing it turns Original off, reads `readApp()`, and opens; the window's size is read with `useSyncExternalStore` on `resize`; a new choice is `keepApp`'d; the stage's `frame` is null when closed, so it returns to the page as it was.

**Behaviour:**
1. `postedLayout("tiktok", {w: 393, h: 852})`: screen {0, 0, 393, 852}; video {0, 50, 393, 698.67}; band {0, 749, 393, 103} (to 0.01).
2. `postedLayout("reels", {w: 393, h: 852})`: clip {0, 0, 393, 770}; video width 433.13, left −20.06, height 770; band top 770, height 82.
3. `postedLayout("off", {w: 393, h: 852})`: video top 76.67, height 698.67.
4. `postedLayout("tiktok", {w: 1280, h: 800})`: screen left 462.87, top 16, width 354.25, height 768; video width 354.25.
5. A short phone `{w: 375, h: 600}`, TikTok: video height 600, width 337.5, left 18.75, top 0.
6. `readApp()`: nothing stored → "tiktok"; "reels" stored → "reels"; "junk" → "tiktok"; `getItem` throwing → "tiktok"; `keepApp` with `setItem` throwing does not throw.
7. `FURNITURE`: every box inside 0 to 100 on both axes; every Reels box inside x 4.6 to 95.4; no `text` holds "TikTok", "Instagram" or "Reels".
8. The page: pressing "Preview as posted" shows a dialog "Preview as posted" with the radio "TikTok" checked; `#edit-stage` has an inline `position: fixed`; `.__remotion-player` is the same node; the header is `inert`; the focus is on "Close preview".
9. Choosing "Reels" checks it and stores "reels"; the stage's inline `clip-path` cuts both sides; Escape closes: no dialog, the stage has no inline position, focus on "Preview as posted"; opening again shows "Reels" checked.
10. The preview's scrubber moves the playhead (a key press on it changes `aria-valuenow` and the stage is sought); a press on the stage still plays and pauses.
11. Opening with Original on turns it off first.

**Steps:**
- [ ] `posted.test.ts` cases 1 to 7; write `posted.ts`; green.
- [ ] Icons; the stage's `frame`, the scrubber's `onFootage` with their own tests in `editor-stage.test.tsx` / the scrubber's suite.
- [ ] `posted-preview.test.tsx` (the overlay alone: the switch, Escape, focus, the furniture drawn with the title) and the screen's cases 8 to 11; write `posted-preview.tsx` and the page's wiring; green.
- [ ] The editor suite with the guard, tsc, eslint.
- [ ] Commit: `feat(editor): the video full screen as it will be posted, the app's buttons drawn over it`.

---

### Task 7: The moment on the page (page track)

**Files:**
- Modify: `src/components/editor/edit-session.ts` (`pausedMoment`, `Working`'s `change` gets `at`, `problem` keeps `at`), `use-edit.ts` (`ask(request, at)`), `editor-field.tsx` (the tag), `editor-thread.tsx` (the time on a request), `editor-screen.tsx`, tests `edit-session.test.ts`, `use-edit.test.tsx`, `editor-thread.test.tsx`, `editor-screen.test.tsx`, `editor-a11y.test.tsx`

**Interfaces:**

```ts
// edit-session.ts
export type Working = /* … */ | { what: "change"; request: string; at: number | null } /* … */;
// problem: { text: string; request: string | null; at?: number | null; hand?: true }
/** The moment a request is about (E15): the paused film frame, when the creator paused inside the film; else null. */
export function pausedMoment(frame: number, frames: number, playing: boolean, dropped: number | null): number | null;
// null when playing, frame <= STILL (15: the first half second, where a first cut stands by itself), frame >= frames − 1 (its end), or frame === dropped

// use-edit.ts
ask(request: string, at?: number | null): Promise<boolean>; // the body is {request} with no `at` key when at is null or undefined, else {request, at}

// editor-field.tsx
interface Props { /* … */ moment: { frame: number; label: string } | null; onDropMoment(): void }

// editor-thread.tsx: a request is shown with its moment
export function requestOf(turn: TurnShown): string | null; // unchanged; the time is drawn beside it
// ThreadProps.pending becomes { request: string; at: number | null } | null
```

The label is the scrubber's own time: `timecode(Math.floor(frame / FPS))` (R30, rounded down). The page reads `playing` from the stage's `onPlayingChange`, the frame from the playhead store, the frames from the edit on the stage, and holds `dropped` (the frame whose tag was removed; it comes back when the video pauses on another frame). While Original is on, the moment is the film frame `filmFrameAt` gives for the take's moment shown, and only when it is `exact`. The field does not draw again on each frame while the video plays (read the playhead through a snapshot that is null while playing).

The tag (drawing `.field .at`): the first thing in the field, 28 tall, fully round, `bg-surface-sunken`, `text-meta font-[600] tabular-nums`, 10 px side padding, the time and a 12 px close glyph; a button (`tap-44`) named "Remove the moment at 0:06"; the textarea's `aria-describedby` points to a hidden "This request is about the moment at 0:06."; Backspace with the caret at the field's start and nothing selected removes it too. A request in the conversation with a moment reads `0:06 · ` in `text-foreground-muted tabular-nums` before its words (drawing `.me .q`), for a turn (`turn.at`) and for the request out.

**Behaviour:**
1. `pausedMoment`: (100, 338, false, null) → 100 · (100, 338, true, null) → null · (15, 338, false, null) → null · (16, 338, false, null) → 16 · (337, 338, false, null) → null · (336, 338, false, null) → 336 · (100, 338, false, 100) → null · (101, 338, false, 100) → 101.
2. The field with `moment {frame: 186, label: "0:06"}` shows a button "Remove the moment at 0:06" whose text is "0:06"; pressing it calls `onDropMoment`; Backspace in an empty field calls it; with `moment` null there is no such button.
3. Paused on frame 186 of a cut, "Zoom in here" sent → `POST …/change` with body `{"request":"Zoom in here","at":186}`; while playing, or after the tag was removed → body `{"request":"Zoom in here"}` (no `at` key).
4. The request out reads "0:06 · Zoom in here" with "Working on it…"; the turn that comes back with `at: 186` reads the same; a turn with `at: null` reads "Zoom in here".
5. A change that fails puts its words back in the field (as today); its Try again sends `at: 186` again.
6. The chips of slice A ("Shorter", "Bigger captions", "Add zooms") send no `at`.
7. A first cut standing still on frame 15 shows no tag; one tap pause on frame 40 shows "0:01".
8. The a11y suite: the tag is a named button; the field is described by the moment's sentence.

**Steps:**
- [ ] `edit-session.test.ts` case 1 and the `Working`/`problem` shapes; `use-edit.test.tsx` case 3's bodies and 5; green.
- [ ] The field's and the thread's tests 2 and 4; then the parts; green.
- [ ] The screen's tests 3, 6, 7 and the a11y case; the page's wiring; green.
- [ ] The editor suite, tsc, eslint.
- [ ] Commit: `feat(editor): a request carries the moment the video is paused on, shown as a tag that can be removed`.

---

### Task 8: Findings put away, and the steps after a change (page track; after Task 2)

**Files:**
- Create: `src/lib/edit/kept.ts`, `src/lib/edit/next-steps.ts`, `src/app/api/edit/edits/[id]/kept/route.ts`, tests `src/lib/edit/__tests__/kept.test.ts`, `src/lib/edit/__tests__/next-steps.test.ts`
- Modify: `src/lib/edit/edit-view.ts`, `src/app/api/edit/edits/store.ts`, `src/app/api/edit/edits/[id]/{change,ops,cut}/route.ts`, `src/app/api/edit/__tests__/edit-turns.test.ts`, `src/components/editor/edit-session.ts` (`chipsOf`, `NextChip`, `chipLabel`, `isView`), `src/components/editor/editor-thread.tsx` (the `status` slot), `src/components/editor/editor-screen.tsx` (a step chip, a hand chip, the reading line moved into the thread, the rings), tests `edit-session.test.ts`, `editor-thread.test.tsx`, `editor-screen.test.tsx`, `src/components/editor/__tests__/views.ts` (`kept: []`, `next: []` by default), `src/lib/auth/__tests__/session-401-coverage.test.ts` only if it needs the new route listed

**Interfaces:**

```ts
// kept.ts
/** A finding's key across turns: its code and the thing it is about (an item, a mark, else the shot), never its frame. */
export function findingKey(finding: Finding): string; // `${code} ${where.item ?? where.mark ?? where.shot ?? ""}`.trimEnd()
/** What is left to check: the findings not put away, one a key (the first in the list's order), in the list's order. */
export function toCheck(findings: readonly Finding[], kept: readonly string[]): Finding[];
/** What a new turn keeps put away: the keys of `kept` still among its findings, each once, in kept's order. */
export function carryKept(kept: readonly string[], findings: readonly Finding[]): string[];

// next-steps.ts
export type StepKind = "zoom" | "look" | "cut" | "captions";
export interface NextStep { kind: StepKind; label: string; /** Asked of the agent; null: Undo. */ request: string | null; /** The film frame it is about; null for none. */ at: number | null }
/** At most two steps after a change, from the edit before it and the edit it made (§5.3): the kinds in this order, the first that apply. */
export function nextSteps(before: Edit, after: Edit): NextStep[];

// edit-view.ts
export interface TurnShown { /* … */ /** The findings of this turn put away, by key. */ kept: string[] }
export interface EditView { /* … */ /** The steps after the change shown; [] when the turn shown is no change. */ next: NextStep[] }

// store.ts
export interface TurnLine extends TurnMark { /* … */ kept: string[] }
export interface TurnWritten { /* … */ kept: readonly string[] }
EDIT_SAID.notToCheck = "That is not among the things to check."

// edit-session.ts
export type NextChip =
  | { kind: "check"; count: number }
  | { kind: "style" }
  | { kind: "step"; step: NextStep }
  | { kind: "ask"; text: string }
  /** A change made by hand through `POST …/ops`, no model call: "Captions on". */
  | { kind: "hand"; text: string; ops: Op[] };
export function chipsOf(view: EditView | null, styleReady: boolean): NextChip[];

// editor-thread.tsx
// ThreadProps gains `status: React.ReactNode | null`: a line drawn in the chips row's place; while it is set the chips row is not drawn.
```

The steps (exact words; the requests point, so Task 3's zoom here applies to them):

| Kind | Applies when | Steps |
|---|---|---|
| zoom | some shot of `after` whose largest zoom (`from.zoom`, or `move.to.zoom` when larger) is 0.05 or more above that of the `before` shot showing its first moment (same take, `startMs` inside it) | "Zoom less" → "Zoom in less here." · "Hold it longer" → "Hold this zoom longer here."; `at` = that shot's first film frame in `after` |
| look | `after.look` differs from `before.look`, or a shot (by id) has another `look` | "Another look" → "Try a different colour look." |
| cut | `filmFrames(after) < filmFrames(before)` | "Put it back" → Undo (`request` null) |
| captions | `after.captions.size > before.captions.size` | "Smaller captions" → "Make the captions a little smaller." |

`chipsOf`: "N to check" first when `toCheck(findings of the turn shown, its kept)` is not empty (N its length); then "Use that style" when a video's style is ready (slice A); then the view's `next`; then slice A's fixed three (`NEXT_ASKS`) less the one of a kind already in `next` ("Shorter" for cut, "Bigger captions" for captions, "Add zooms" for zoom); four at most, one row (R30). With the edit shown's captions off (`view.edit.captions.on === false`), the fixed "Bigger captions" is replaced, in its place, by the hand chip "Captions on" with `ops: [{ op: "captions.set", on: true }]` (no `at`, no model call); with them on it stays "Bigger captions". A step chip sends `ask(step.request, step.at)`, or Undo (`move(view.undo)`) when its request is null; a hand chip goes through the page's `byHand` (`api.ops`), as the Captions sheet's switch does. The scrubber's rings are the frames of `toCheck`.

The reading line ("Reading the video's style. …" with Stop, slice A's background read of "Like a video") is drawn today after the thread, over the chips row. It moves into the thread as its `status`, in the chips row's place: while it shows the chips row is not drawn; when the read ends (ready, failed or stopped) the line goes and the chips come back. Its words, its `role="status"` and its Stop stay as they are.

The view: `viewOf` reads `kept` with the turns (`select("n,kind,request,at,say,findings,kept,v:doc->v")`) and, when the turn shown is a `change` and a turn before it holds a doc, reads both docs in one `docsOf` and gives `next = nextSteps(before, shown)`; else `[]`.

What is carried (spec §7): `change` and `said` turns made by `POST …/change`, and `direct` turns made by `POST …/ops`, write `kept: carryKept(kept of the turn shown, the new turn's findings)`; a `cut` writes `[]` (a cut starts again from the take, E9). `commitTurn` inserts `kept`.

`POST /api/edit/edits/[id]/kept {finding}` (`finding`: a key, a string of 1 to 120 characters): the gate, the CSRF guard, the body (400 `SAID.unread` for any other body), the edit (404), its turns, the turn shown (409 `EDIT_SAID.noCut` when none); a key that is not among the turn shown's findings' keys → 400 `EDIT_SAID.notToCheck`; a key already kept → 200, nothing written; else the turn shown's row is updated to `kept = [...kept, key]`, and the view is answered (200). It holds no agent call and is not refused while an export runs (it changes no film). Two keeps at the same moment from two tabs may lose one: the page makes one call at a time; say so in the route's header.

**Behaviour:**
1. `findingKey`: `{code: "on-face", where: {frame: 10, shot: "s1"}}` → "on-face s1"; with `mark: "m1"` → "on-face m1"; with `item: "t1"` → "on-face t1"; the frame never changes it.
2. `toCheck`: two `under-buttons` findings on the captions in one shot (two apps) → one; a kept key left out; the order by the list's.
3. `carryKept(["soft-zoom s1", "on-face s2"], [soft-zoom s1 at another frame])` → ["soft-zoom s1"].
4. `nextSteps`: before `FIRST`, after a zoom here on its first shot → [Zoom less, Hold it longer] with `at` the piece's first frame; after `look.set {preset: "warm"}` → [Another look]; after a `shot.trim` → [Put it back]; after `captions.set {size: size + 8}` → [Smaller captions]; after a `word.set` only → []; after a zoom and bigger captions together → the two zoom steps only.
5. Routes: a keep → 200, the turn shown's `kept` is [key] in the view; a change after it whose findings still hold that key → the new turn's `kept` is [key]; one whose findings do not → []; a look (`POST …/cut`) → []; a keep of a key not found → 400 "That is not among the things to check."; with no cut → 409; another creator's edit → 404; without the CSRF header → refused as the other routes; a second keep of the same key writes nothing.
6. The view's `next` after a change that zoomed is the two zoom steps; after the first cut `[]`; with the head on a `said` answer after that change, still the change's steps.
7. `chipsOf` on a view whose turn shown has two findings (one kept) and `next` = the zoom steps → ["1 to check", "Zoom less", "Hold it longer", "Shorter"]; "Add zooms" is not among them.
8. The page: a "Put it back" chip moves the head back (a `POST …/head` with the view's `undo`); "Zoom less" sends `{"request":"Zoom in less here.","at":<the step's at>}`.
9. `chipsOf` on a view whose edit has `captions.on` false, no findings and no steps → ["Shorter", "Captions on", "Add zooms"]; with captions on → ["Shorter", "Bigger captions", "Add zooms"]. On the page, pressing "Captions on" sends `POST …/ops` with `{"ops":[{"op":"captions.set","on":true}]}` and no `POST …/change`.
10. While a video's style is being read, the thread shows "Reading the video's style. …" with Stop and no chips row (no button named "Shorter" in the page); once the read is stopped, the line is gone and the chips are back.

**Steps:**
- [ ] `kept.test.ts` 1 to 3 and `next-steps.test.ts` 4; write the two files; green.
- [ ] The view's types, `turnsOf`, `TurnWritten`, `commitTurn`, `viewOf`, the three routes' `kept`, and the new route, test-first in `edit-turns.test.ts` (5, 6); green with `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/app/api/edit src/lib/edit/__tests__ src/lib/auth/__tests__/session-401-coverage.test.ts`.
- [ ] `chipsOf` and the page (7 to 10): the hand chip, the thread's `status` slot with the reading line moved into it; `views.ts` defaults; the editor suite green.
- [ ] tsc, eslint.
- [ ] Commit: `feat(editor): a finding put away stays away while it lasts; the chips follow from the change`.

---

### Task 9: The finding card (page track)

**Files:**
- Create: `src/components/editor/fixes.ts`, `src/components/editor/finding-card.tsx`, tests `__tests__/fixes.test.ts`, `__tests__/finding-card.test.tsx`
- Modify: `src/components/editor/editor-thread.tsx` (the list of slice A goes; a `card` slot), `edit-session.ts` (`Working` gets `{ what: "keep" }`), `use-edit.ts` (`keep(key)`), `editor-screen.tsx`, tests `editor-thread.test.tsx`, `editor-screen.test.tsx`, `use-edit.test.tsx`, `editor-a11y.test.tsx`

**Interfaces:**

```ts
// fixes.ts (pure: no React, no "use client"; the proof script imports it)
export type Thing = "captions" | "title" | "callout" | "progress" | "cutaway" | "sound";
/** What a finding is about: its item's or its mark's part, else the captions. */
export function thingOf(finding: Finding, edit: Edit): Thing;
/** One sentence for a creator, not the review's own words. */
export function sentenceOf(finding: Finding, edit: Edit): string;
export interface Fix { label: string; request: string }
/** The fix offered as one button, or null ("Show" only). */
export function fixOf(finding: Finding, edit: Edit): Fix | null;

// use-edit.ts
keep(key: string): Promise<boolean>; // POST …/kept {finding: key}; a call like the others (one at a time, a deadline, the view answered)

// editor-thread.tsx
// ThreadProps loses `checking`, `findings`, `onShow`; gains `card: React.ReactNode | null`. After the turns, in this order: the card when set, then Task 8's `status` line when set; the chips row only when neither is.

// finding-card.tsx
export interface FindingCardProps {
  finding: Finding; sentence: string; fix: Fix | null;
  index: number; count: number; disabled: boolean;
  onFix(fix: Fix): void; onKeep(): void; onShow(): void; onNext(): void; onClose(): void;
}
```

The sentences (`the X` is "The captions", "The title", "The call-out", "The progress bar", "The cutaway", "The sound"; the verb agrees: the captions are plural):

| Code | Sentence |
|---|---|
| on-face | `<The X> cover(s) your face here.` |
| under-buttons | `<The X> sit(s) under the app's buttons here.` |
| on-text | `<The X> cover(s) other words here.` |
| text-fits | captions: "A caption here is too long to fit at a size people can read." · else `<The X> is too long to fit at a size people can read.` |
| two-titles | "Two titles show at once here." |
| short-text | `<The X> is gone before it can be read.` |
| caption-rows | "The captions take up too many lines here." |
| cut-outside-pause | `says` starting "the film's start": "The video starts in the middle of a word." · "the film's end": "The video ends in the middle of a word." · else "This cut lands in the middle of a word." |
| empty-start | "The video starts on an empty frame." |
| mark-hidden | `<The X> sits on a part that was cut, so it never shows.` |
| fade-both | "This part fades in and out at once." |
| soft-zoom | "This zoom makes the picture soft." |
| unmeasured | `<The X> uses a letter we cannot measure, so its fit is a guess.` |
| no-analysis | "This part was not checked." |

The fixes (`<the x>` lower case: "the captions", "the title", "the call-out"). Task 10 sets to null any that fails its trial:

| Code | Button | Request sent, with the finding's frame as its moment |
|---|---|---|
| soft-zoom | "Zoom less" | "Zoom in less here, so the picture stays sharp." |
| on-face | "Move it off my face" | `Move <the x> off my face.` |
| under-buttons | "Move it clear of the app's buttons" | `Move <the x> clear of the app's buttons.` |
| short-text | "Keep it on longer" | `Keep <the x> on screen longer.` |
| text-fits | "Make it fit" | `Make <the x> fit on screen at a size people can read.` |
| two-titles | "Keep one" | "Keep only one title here." |
| caption-rows | "Fewer words a page" | "Put fewer words on each caption page." |
| cut-outside-pause | "Move the cut to the pause" | "Move this cut into the nearest pause." |
| empty-start | none: it cannot arise in an edit that passed the door ("What the code forced", 2) | |
| on-text, mark-hidden, fade-both, unmeasured, no-analysis | none ("Show") | |

The card (drawing `.fc`, screen 8): a white card (`bg-surface`, `rounded-[20px]`, `shadow-[var(--shadow-rest)]`, 13/14 px padding) at the end of the conversation in place of the chips; first line `0:06 · ` (`text-foreground-muted tabular-nums`, the frame's time rounded down) and the sentence (`font-[560]`); a close button at its top right (`aria-label="Close"`, 32 drawn, 44 to tap); then a row: the fix as an ink `Button` (36 tall) when there is one, else "Show" (secondary, 36); "Keep it" (secondary, 36); and at the row's end the count "1 of 3" (`text-meta text-foreground-muted`), which is a button named "Next, 2 of 3" when there are more than one (it goes round to the first after the last), plain text otherwise. The card is `role="group"` named "Things to check"; it is announced politely when it changes.

Page rules: "N to check" opens the card on the first finding of `toCheck` (index 0) and shows its moment: pause, seek to the finding's frame held inside the film, the stage scrolled into view (slice A's `show`). Next and Show do the same for theirs. The fix sends `ask(fix.request, min(frame, frames − 1))` (the request bubble reads "0:06 · Zoom in less here, so the picture stays sharp."); "Keep it" sends `keep(findingKey(finding))`, and the card then shows the finding now at the same index of the shorter list, or closes when none is left. The card closes when the turn shown changes (as R27's list did), when Close or Escape (focus inside it) is pressed, and on a call that goes out other than a keep. Original turns off when the card opens (Task 5).

**Behaviour:**
1. `sentenceOf`: an on-face finding on the captions → "The captions cover your face here."; on a title item → "The title covers your face here."; a call-out mark's short-text → "The call-out is gone before it can be read."; a cut-outside-pause whose `says` starts "the film's end" → "The video ends in the middle of a word."; every code of `FindingCode` gives a sentence that ends with a full stop and holds no digit.
2. `fixOf`: soft-zoom → {"Zoom less", "Zoom in less here, so the picture stays sharp."}; on-face on a title → request "Move the title off my face."; fade-both → null; empty-start → null.
3. The card with a fix: buttons "Zoom less" and "Keep it", the text "1 of 3" in a button named "Next, 2 of 3"; without a fix: "Show" and "Keep it"; with one finding: "1 of 1" as plain text.
4. The page: a view whose turn shown has three findings → chip "3 to check"; pressing it shows the card with the first finding's sentence, the scrubber's `aria-valuenow` at its frame, the chips row gone.
5. "Zoom less" → `POST …/change` with `{"request":"Zoom in less here, so the picture stays sharp.","at":<frame>}`; the card closes as the call goes out, and the request shows in the conversation with its time.
6. "Keep it" → `POST …/kept` with `{"finding":"soft-zoom s1"}`; the answered view keeps it → the card shows "1 of 2" with the next finding; keeping the last closes the card and the chip is gone.
7. "Next, 2 of 3" shows the second finding and seeks to its frame; Close closes the card and the chips come back.
8. A keep that fails shows the route's sentence in the conversation as any failed call; the card stays.

**Steps:**
- [ ] `fixes.test.ts` 1, 2; write `fixes.ts`; green.
- [ ] `finding-card.test.tsx` 3; write the card; green.
- [ ] Thread: replace the list with the slot (its tests that asserted the list become card tests); `use-edit` `keep` with its test; the screen's 4 to 8; green.
- [ ] The editor suite with the guard and the a11y suite, tsc, eslint.
- [ ] Commit: `feat(editor): a problem arrives with its fix, one at a time, at its moment`.

---

### Task 10: The fixes tried (both tracks; model calls; after Tasks 3 and 9)

**Files:**
- Modify: `scripts/edit-agent-proof.ts` (mode `fixes`), `src/components/editor/fixes.ts` (fixes that failed set to null, each with its measured rate in a comment), `src/lib/edit/next-steps.ts` (a zoom step that failed removed), their tests

**Interfaces:**

Consumes: `fixOf`, `sentenceOf` (Task 9); `findingKey` (Task 8); `nextSteps` (Task 8); `change` with `at` (Task 2); `zoomHere` (Task 3).

Produces:

```
pnpm exec tsx scripts/edit-agent-proof.ts fixes [--tag <tag>] [--base <first cut's json>] [--runs <n>] [--calls <n>] [<code>…]
```

For each code whose `fixOf` is not null, a setup made by ops through the door on the base (no word of the take: words by index, frames by the base's layout), checked to carry that finding (`review`); then the fix's request `--runs` times (3) with `at` = the finding's frame. A run clears when the change was taken and the edit it made has no finding with the same `findingKey`. Plus the two zoom steps: on the base with a zoom made here by code at m01's frame (`zoomHere`), "Zoom in less here." lands when the piece's target zoom went down; "Hold this zoom longer here." lands when the frames whose zoom is above the base's grew in number. Cap `--calls` 60 as in Task 4; a setup that cannot be made is reported "not tried" and its fix goes to "Show".

The setups (the label that stays to the end is the base's title; remove it first where a second title would be another finding):

| Code | Setup on the base |
|---|---|
| soft-zoom | `shot.set` on the first shot: `framing {from: {zoom: min(3, zoomLimit(take) + 0.3), x: 0, y: 0}, move: null}` |
| on-face | `captions.set {y}` at 0.45, else 0.35, else 0.55: the first that gives on-face |
| under-buttons | `captions.set {y: 0.93}` |
| short-text | the label removed; `item.add` a title "Short one" (made up) at frame 120 for 12 frames, its other props `PARTS.title`'s defaults |
| text-fits | the label removed; `item.add` a title "This title is far too long to fit on the screen at any size people could read" at 120 for 60 frames |
| two-titles | `item.add` a title "Second one" at 120 for 60 frames over the label |
| caption-rows | `captions.set {maxWords: 12, width: 0.5}` (if no caption-rows, also `size` up by 16) |
| cut-outside-pause | `shot.trim` the first shot's end to the middle of the last word it shows |

**Behaviour:**
1. Before any model call, `examples` passes on the fix requests (they are read from `fixes.ts`) and the setups (made-up texts only).
2. Each setup's base carries its finding; one that does not is reported "not tried".
3. The run stays within 60 calls and prints its cost and, per fix, cleared of 3.
4. In `fixes.ts`, each fix with fewer than 2 of 3 is set to null with a comment `// tried <date>: <k> of 3, Show only`; each kept one gets `// tried <date>: <k> of 3`. In `next-steps.ts` a zoom step with fewer than 2 of 3 is removed (its test changed to match). `fixes.test.ts` and `next-steps.test.ts` updated to the result and green.

**Steps:**
- [ ] The `fixes` mode with a `--runs 0` dry check (prints each setup's finding, makes no call).
- [ ] Run: `pnpm exec tsx scripts/edit-agent-proof.ts fixes --tag slice-b-fixes --base .scratch/native-default-2/first-cut/house-1.json --calls 60` (output under `.scratch/`).
- [ ] Update the two tables and their tests; `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/components/editor src/lib/edit/__tests__/next-steps.test.ts`; tsc; eslint.
- [ ] Commit: `test(editor): each fix tried three times; the ones that do not clear their finding are offered as Show`. Report the table (per code, cleared of 3), the calls and the cents.

---

## Not changed: the review's zones

Changing the review's zones is not in this slice: they are pinned to the pixel (`src/lib/edit/__tests__/zones.test.ts`), printed into the agent's prompt (`zonesLine`), and drive `room` and `placeCaptions`, so a change asks for the agent's whole gate again. For the agent track, from `.scratch/editor/slice-b/safe-zones.md` §4 and §5.2:

| Zone | Review today (px) | Found for an organic post | Proposed |
|---|---|---|---|
| TikTok right-side buttons | x 916-1058, y 576-1737 | from y 830-924, x from 942 | x 930-1080, y 780-1920 (starts 254-348 px too high today: a call-out at the right between 30 % and 43 % is flagged with nothing over it) |
| Instagram right-side buttons | x 950-1080, y 1056-1920 | icons from x 915-926 | x 900-1080, y 1030-1920 (24-35 px too far right today: text can reach under the icons and pass) |
| Instagram sides | none | 4.6-5 % cut off each side | add x 0-54 and 1026-1080, full height (`awayFrom` needs a case for a side strip) |
| TikTok and Instagram bottom bars | from 1540 / 1500 | the block at rest from 1707-1744 | keep until real captures with two-line captions; until then the preview (furniture at rest) and the review (bars twice as tall) disagree for captions between `y` 0.80 and 0.89 |
| Top bars | 240 / 269 | close | keep |

## The controller's proof

One command, after Task 10, in the manner of `.scratch/editor/proof/run.mjs` (local, uncommitted): `node .scratch/editor/proof/slice-b.mjs`. Another session may run a dev server at the same time, so the script keeps its own disk guard: it stops before it starts, and stops its server mid-run, when the disk has under 1,200 MB free (`statfsSync`, read again every 15 s). It takes a port no other server holds (from 3003 up, checked with `lsof -ti:<port>`), starts `next dev -H 127.0.0.1 --port <that port>` with `NEXT_PUBLIC_NEW_LOOK=true` inside itself, signs in as the proof account, opens an edit with a cut (made by the script when none), runs every step at 393 × 852 with touch and at 1280 × 800, light and dark, writes screenshots and a log under `.scratch/editor/proof/slice-b/`, stops the server on exit (a nine-minute guard), and removes `.next` after.

1. **The moment.** Pause in the last shot on a word: the field shows the tag with the scrubber's time; "Zoom in here" → the request bubble carries the time; frames at the moment − 5 and + 15 show the zoom starting there, not at the shot's start. Remove the tag, send "Make it warmer": no time on the bubble, the whole video warmer.
2. **The original.** Original on: the badge, the take's own picture at the same moment, one `.__remotion-player` and the same node (a marker set on it before survives); off: back on the same frame; while playing, it plays on.
3. **The preview.** TikTok, Reels and Off at both sizes; the stage the same node; Escape closes; a reload keeps the last choice; the screenshots beside screen 7 of the drawing (and beside Remotion's two overlay images if they are still on disk: they stand in for a real screenshot of each app, which this Mac cannot take).
4. **Things to check.** "N to check" → the card at its moment; a fix that passed Task 10 → a new turn and the card closed; "Keep it" → the count goes down; a reload keeps it put away; a change that leaves that finding → still put away.
5. **The chips.** After the zoom: "Zoom less" and "Hold it longer" (where Task 10 kept them), "Add zooms" gone; after a cut, "Put it back" undoes. Captions turned off in the Captions sheet: the chip reads "Captions on", and pressing it turns them on with no model call. "Like a video" read in the background: the reading line sits where the chips were, none half covered, and the chips come back when it ends.
6. **Flag off** (`NEXT_PUBLIC_NEW_LOOK` unset): `/edit/<id>` is the app's 404, as before.

Not provable here: a real iPhone (Safari, the preview over a phone's real bars), Android, the apps' For You and Reels tabs (safe-zones §6).

## Spec coverage

| Spec | Where |
|---|---|
| E15 the moment: the frame carried, the time and the words told, "here", "this part", "from here" | Tasks 1, 2 (agent), 7 (page); E15's bar in Task 4 |
| B2 "zoom in here" lands on the moment | Task 3; measured in Task 4 (m01) |
| E15's proof: six requests × 3, fifteen controls | Task 4 |
| E16 the original, a toggle, same moment, the Player not mounted again | Task 5 |
| E17 the preview: same Player full screen, our drawings, the name only on the switch, TikTok / Reels / Off | Task 6 |
| E18 a problem with its fix, "Keep it", a fix offered only after 2 of 3 | Tasks 9 and 10; `POST …/kept` in Task 8 |
| §5.2 parts `original.ts`, `posted-preview.tsx`, `finding-card.tsx` + `fixes.ts`, the field's tag | Tasks 5, 6, 9, 7 |
| §5.3 chips from the turn, by code, four at most, one row | Task 8 |
| §6 `edit_turns.at`, `edit_turns.kept` written | Tasks 2/7, 8 |
| §7 `POST …/change {request, at?}` used; `POST …/kept {finding}` | Tasks 2, 8 |
| §8 the agent's context names the moment | Tasks 1 to 3 |
| §9 slice B's proof: the eighteen runs, each fix three times, the preview beside each app | Tasks 4, 10, the controller's proof |
| The review's zones | not changed; listed above |
| Not in this slice: a still punch-in in speech (a cut there is refused), "this word" held by code (H4), the told-back moment after a cut (H6), a say that names a frame (H7), German and Italian pointing words, a size for one word | |

## Type consistency

The names one task makes and another reads, spelled once here: `Moment`, `WordHere`, `Stretch`, `Showing`, `momentFor`, `momentBlock`, `pointsAt`, `NEAR`, `ON`, `JUST_SAID_MS`, `landed`, `Landing`, `stayedWhole`, `Whole` (Task 1); `CutPoint`, `cleanCuts` (Task 1, `context.ts`); `AgentInput.at`, `requestMessage(context, request, moment?)`, `codeMoves(…, request, here)`, `snapToMoment`, `changeEdit(…, at)`, `EDIT_SAID.moment` (Task 2); `PUSH_MS`, `isPush`, `zoomHere`, `Push`, `zoomFor(…, push?)`, `withMoves(…, here)` (Task 3); `plainEdit`, `takeMomentAt`, `plainFrameAt`, `filmFrameAt`, `StageHandle.playing`, `badge`, `onPlayingChange`, `EditorTools`, `ToolsProps` (Task 5); `App`, `Box`, `PostedLayout`, `postedLayout`, `POSTED_KEY`, `readApp`, `keepApp`, `Shape`, `FURNITURE`, `frame` (stage), `onFootage` (scrubber), `PostedPreviewProps` (Task 6); `pausedMoment`, `Working` `change.at`, `ask(request, at?)`, the field's `moment` and `onDropMoment` (Task 7); `findingKey`, `toCheck`, `carryKept`, `StepKind`, `NextStep`, `nextSteps`, `TurnShown.kept`, `EditView.next`, `TurnLine.kept`, `TurnWritten.kept`, `EDIT_SAID.notToCheck`, `NextChip` `step` and `hand`, `ThreadProps.status` (Task 8); `Thing`, `thingOf`, `sentenceOf`, `Fix`, `fixOf`, `keep(key)`, `Working` `keep`, `FindingCardProps`, `ThreadProps.card` (Task 9). Frames are always film frames of the edit named beside them; a take's moment is always ms of that take; `at` is always a film frame of the edit shown when the request was sent.

---

## Results (2026-11-25)

Built as planned, subagent-driven, in 10 tasks, with a fix round for most and one final fix wave: 28 commits on `feat/edit`
after the plan's own, 53 files. The rulings that override this plan's text where they differ are S1 to S18 in the plan's
workspace (with slice A's R1 to R31). Nothing is pushed.

**What a creator has now, on top of slice A:**
- **A request is about the moment the video is paused on.** The field shows the moment as a tag that can be removed; the
  request's bubble shows its time. A thing asked for with the tag lands there, with or without the word "here", unless the
  request names another place (the start, the end, the whole film, a time). "Zoom in" starts on the moment: the shot is
  split there and the picture pushes in over 400 ms, so no cut lands in speech.
- **The take as it was shot, one tap away**, on the same player, at the same moment, and back to the same frame.
- **The video as it will be posted**: full screen, as a phone drawn to scale, under our own drawings of TikTok's or Reels'
  buttons, on a phone, in a phone's browser and on a desk.
- **A problem arrives with its fix.** "N to check" opens one finding at a time at its moment, in one sentence, with the fix
  as one button where a fix was proved, and "Keep it" to put it away.
- **The steps under an answer follow from the change**: after a zoom here "Zoom less"; after a look "Another look"; after a
  cut "Put it back"; after bigger captions "Smaller captions"; with captions off "Captions on".

**Changed from the plan while building, each ruled:** the zoom here is a push, not a still punch-in (the review refuses a
jump in speech); the tag is the pointer for the code's moves too (S13, S17), where the plan asked for a pointing word; a
thing added with a moment that the model leaves on the film's first frame is moved onto the moment by code, and code then
writes the line (S15, S16); an end card cannot come out too short to read (S17); the preview is a phone drawn to scale
(S10); the tools row holds four controls from 320 px (S8); a request that failed comes back with its own moment; the
chin's warning is kept from the creator and the face's error keeps its fix (S18).

**Measured on the real model** (the repo's proof script; all runs 6.4 cents):
- the moment, second run of 48: a request that points lands 17 of 18 (bar 15); a request with the tag and no pointing word
  9 of 9 (bar 7; 4 of 9 before S17); whole-film requests sent with a tag stay whole 15 of 15 (bar 14); an end card is
  readable 3 of 3; "a hook title at the start" 1 of 3, both misses a collision with the first cut's own title;
- the fixes, three runs each: kept at 3 of 3: the captions clear of the apps' buttons, a title kept on longer, one of two
  titles kept, the captions off the face (by the error), and the step "Zoom less" after a zoom here; set to "Show" only at
  0 of 3: a soft zoom, text that does not fit, too many caption rows, a cut outside a pause; "Hold it longer" removed.

**Proved on the final head `23ca86d9`:**
- the whole suite: 873 files and 13,249 tests passed, none failed; `tsc --noEmit` clean; `next build` with the new look on
  exits 0; with the flag off no editor is drawn and Home is the old one;
- in a real browser (Chromium, a phone of 393 by 852 with touch, also 320, 375 by 600, 393 by 660 and a desk), signed in as
  a dedicated account, on the real model: the Original toggle (same player node, same moment, plays on both ways); the
  preview at five sizes; the tag, its removal, `{request, at}` on the wire; "Zoom in here" answered in 8 s; "Add a title"
  with the tag lands on the moment; the card at 320 and 393, "Keep it" kept after a reload; a fix pressed from the card
  goes out with the finding's frame and its answer is shown.

**Not proved:** a real iPhone or any Safari; a fix from the card that clears its finding on a real edit (the one pressed
was declined by the agent with a true sentence: no room); the title whose own words name a place, on the real model (unit
tests only); the deployed platform.

**Known and left for later** (the full triage is in the workspace's `final-review.md`): the review's zones and the
preview's furniture are not one table, so a creator can meet a finding the preview does not bear out (first follow-up);
the words that point or name a place are English; fixes are offered only on the kind of thing they were tried on, and
their rates come from made-up setups; a phone held sideways in the preview; when code moves a title off the first frame, a
shortening of the first cut's label the model made for it can stay; no spending limit exists, so the editor stays behind
its list of accounts.
