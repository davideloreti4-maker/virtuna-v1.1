# The Edit Document Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the edit document, what follows from it, its checks and its operations as pure TypeScript in `src/lib/edit/`: the stored truth of a video edit, and the one door every change passes.

**Architecture:** One JSON document per video, validated by zod with strict objects. A shot is a stretch of its file in whole milliseconds, stored exactly as asked; the film is counted in whole frames at 30 a second, and frames are worked out in one place, never stored. Everything placed is a kit part with one of two homes: a mark on a shot (it starts at a moment of the shot's file, so it follows what is said, and lasts a length of film) or an item on the film. Marks, captions and the cover are placed by runs of unbroken footage, so cutting a shot in two changes nothing a viewer sees. A closed list of named operations changes a document, all or none; the result must parse, pass `checkEdit` and show what was asked to show, or nothing changes; no operation removes what it was not asked to remove, and none has to round. No engine code is imported here: the kit that draws a document comes in the next plan and reads the same schemas and the same derived positions.

**Tech Stack:** TypeScript 5, zod 4 (`^4.3.6`, already in the repo), vitest 4 (already in the repo). No new package.

**Spec:** `docs/superpowers/specs/2026-11-19-edit-design.md`, §3 (rules), §5 (the document), §5.1 (operations, without the recipes), §5.2 (`check`). The recipes and `review` need a take's analysis and get their own plan with the worker.

**Status: carried out on 2026-11-19.** Each step names its file; the code is in `src/lib/edit/` as committed, not repeated here. It was built test first, read by two independent reviewers and reworked twice to their findings (which changed the document: see decisions X14 to X28 in the spec), and proved by a mutation pass (193 single-rule breaks, every one of which turns the suite red). 189 tests, `tsc` and `eslint` clean.

## Global Constraints

- Times inside a source file are whole milliseconds, stored exactly. Film positions and lengths are whole frames at 30 frames a second, worked out by `derive.ts`. The stage is 1080 x 1920.
- Every zod object is `z.strictObject`: an unknown key is refused. No schema field has a default.
- `src/lib/edit/` imports only `zod` and its own files. No engine, no React, no Node built-ins.
- Nothing is named after the engine (spec rule N9).
- Facts about a file (its length, its size) are stored on the asset and trusted; a shot, a cutaway or a sound may never reach past its file (spec rule N5).
- Tests exercise the real code. No mocks. Each test file imports from `vitest` explicitly.
- Run tests with: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit` (Node 25 needs the flag).
- Commit locally without the repo's push hook: `git -c core.hooksPath=/dev/null commit`. Never push.
- Work only in `~/virtuna-edit` on branch `feat/edit`. Never read or list `.env*`.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/edit/atoms.ts` | The small shapes several schemas share. Not part of the public surface. |
| `src/lib/edit/time.ts` | Frames and milliseconds: the constants and the two conversions. |
| `src/lib/edit/parts.ts` | The kit's parts as a document sees them: where each may sit, whether it runs on over a cut, what file it plays, the shape of its settings. |
| `src/lib/edit/doc.ts` | The document's zod schemas and types, `parseEdit`, and what a new shot and a new edit start with. |
| `src/lib/edit/derive.ts` | What follows from a document without being stored: the runs of unbroken footage, each shot's frames, the film's length, where every mark and item shows, the words said in a run, the framing of a moment, the frame of a moment and the moment on a frame, the cover's frame, the look a shot is drawn with. |
| `src/lib/edit/check.ts` | `checkEdit`: the problems that make a document refusable. |
| `src/lib/edit/ops.ts` | The closed list of operations, `parseOps`, `applyOps`. |
| `src/lib/edit/index.ts` | The public surface. |
| `src/lib/edit/__tests__/fixture.ts` | One small valid edit every test starts from, and the files an edit may use. |
| `src/lib/edit/__tests__/*.test.ts` | One test file per source file. |

---

### Task 1: Time, the shared shapes and the kit's parts

**Files:**
- Create: `src/lib/edit/atoms.ts`, `src/lib/edit/time.ts`, `src/lib/edit/parts.ts`
- Test: `src/lib/edit/__tests__/time.test.ts`, `src/lib/edit/__tests__/parts.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, from `atoms.ts`: `Hex`, `Unit`, `Ms`, `text(max: number)`.
- Produces, from `time.ts`: `FPS = 30`, `MIN_FRAMES = 3`, `MAX_FRAMES = 5400`, `MIN_MARK_MS = 100`, `frameAt(ms: number, speed: number): number` (the nearest frame, signed), `msOf(frames: number, speed: number): number` (unrounded).
- Produces, from `parts.ts`: `FONTS`, `interface PartSpec { where: readonly ("shot" | "film")[]; spills: boolean; plays: readonly ("video" | "image" | "audio")[] | null; props: z.ZodType }`, `PARTS` (the five first parts: `title`, `callout`, `progress`, `cutaway`, `sound`), `type PartId`, `PART_IDS`, `partOf(name: string): PartSpec | undefined`. A part that plays a file has `startMs` in its settings.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/edit/__tests__/time.test.ts` (33 lines, as committed).

Create `src/lib/edit/__tests__/parts.test.ts` (64 lines, as committed).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit`
Expected: FAIL, 2 files, the imports of `../time` and `../parts` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/lib/edit/atoms.ts` (11 lines, as committed).

Create `src/lib/edit/time.ts` (27 lines, as committed).

Create `src/lib/edit/parts.ts` (108 lines, as committed).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit`
Expected: PASS, 2 files, 4 + 8 tests.

- [ ] **Step 5: Type-check, lint and commit**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/lib/edit`
Expected: no output from either, exit 0.

```bash
git add src/lib/edit/atoms.ts src/lib/edit/time.ts src/lib/edit/parts.ts src/lib/edit/__tests__/time.test.ts src/lib/edit/__tests__/parts.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(edit): time, and the kit's parts as a document sees them"
```

---

### Task 2: The document

**Files:**
- Create: `src/lib/edit/doc.ts`, `src/lib/edit/__tests__/fixture.ts`
- Test: `src/lib/edit/__tests__/doc.test.ts`

**Interfaces:**
- Consumes: `FONTS`, `PARTS` from `./parts`; `Hex`, `Ms`, `Unit`, `text` from `./atoms`; `FPS`, `MAX_FRAMES`, `MIN_FRAMES`, `MIN_MARK_MS`, `frameAt`, `msOf` from `./time`.
- Produces:
  - Schemas: `IdSchema`, `WordShape`, `WordSchema`, `WordsSchema`, `AssetSchema` (one shape per kind: a clip, a picture, a sound), `FrameSchema`, `MoveSchema`, `FramingSchema`, `CutSchema`, `AdjustSchema`, `LookSchema`, `ShotLookSchema`, `MarkSchema` and `ItemSchema` (each one shape per part), `CaptionsSchema`, `ShotShape` (for `.pick()`) and `ShotSchema`, `CoverSchema`, `EditSchema`.
  - Types: `Word`, `Asset`, `Frame`, `Move`, `Framing`, `Cut`, `Adjust`, `Look`, `ShotLook`, `Mark`, `Item`, `Captions`, `Shot`, `Cover`, `Edit`.
  - `MARK_TIMING`, `ITEM_TIMING`, `MARK_PARTS`, `ITEM_PARTS`, `CUT_KINDS`, `LOOK_IDS`, `CAPTION_LOOKS`, `STAGE`, `DEFAULT_CAPTIONS`, `NEUTRAL`, `NO_LOOK` (the last three frozen), `parseEdit(json: unknown): Edit`, `newShot(a: { id: string; asset: string; endMs: number; startMs?: number }): Shot`, `newEdit(asset: Asset): Edit` (throws for a sound or a clip too short for a shot).
  - From `__tests__/fixture.ts`: `fixture(): Edit` with assets `take` (a clip, 12 700 ms, 4 words), `broll` (a clip, 4 000 ms, no sound), `whoosh` (a sound, 677 ms); shots `s1` (0 to 5 000 ms, 150 frames) and `s2` (8 000 to 12 000 ms, 120 frames) with marks `m1` (a call-out at 8 920 ms for 740 ms) and `w1` (the whoosh at 8 000 ms for 660 ms); item `bar` (a progress bar from frame 0 to the film's end); 270 frames long. Also `picture`, `voice` (a 3 000 ms sound) and `library(): Asset[]`, the files on offer.

- [ ] **Step 1: Write the fixture and the failing test**

Create `src/lib/edit/__tests__/fixture.ts` (53 lines, as committed).

Create `src/lib/edit/__tests__/doc.test.ts` (226 lines, as committed).

- [ ] **Step 2: Run the test to verify it fails**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/doc.test.ts`
Expected: FAIL, the import of `../doc` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/lib/edit/doc.ts` (288 lines, as committed).

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/doc.test.ts`
Expected: PASS, 27 tests.

- [ ] **Step 5: Type-check, lint and commit**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/lib/edit`
Expected: no output from either, exit 0.

```bash
git add src/lib/edit/doc.ts src/lib/edit/__tests__/fixture.ts src/lib/edit/__tests__/doc.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(edit): the edit document"
```

---

### Task 3: What follows from an edit, and its checks

**Files:**
- Create: `src/lib/edit/derive.ts`, `src/lib/edit/check.ts`
- Test: `src/lib/edit/__tests__/derive.test.ts`, `src/lib/edit/__tests__/check.test.ts`

**Interfaces:**
- Consumes: the types of `./doc`, `newShot`; `PARTS` from `./parts`; `FPS`, `MAX_FRAMES`, `MIN_FRAMES`, `frameAt`, `msOf` from `./time`; `fixture()`, `picture`, `voice`.
- Produces, from `derive.ts`: `assetOf(edit, id): Asset | undefined`, `lengthOf(asset): number | null`, `overlapOf(cut): number`, `runsOn(shot, next): boolean`, `interface Run { first; last; at; frames; asset; speed; fromMs; toMs }`, `interface Layout { frames; shots: { at; frames; run }[]; runs: Run[] }`, `layout(edit): Layout`, `filmFrames(edit): number`, `interface Placed { path; thing: Mark | Item; shot: string | null; at; frames; skip; fileMs }`, `placed(edit): Placed[]`, `interface SaidWord { text; from; to; stress }`, `runWords(edit, run): SaidWord[]`, `easeAt(ease, t): number`, `framingAt(shot, ms): Frame`, `momentOf(run, frame): number`, `frameOf(edit, shotId, ms): number | null`, `momentAt(edit, frame): { shot; ms } | null`, `coverFrame(edit): number | null`, `lookOf(edit, shot): Look`.
- Produces, from `check.ts`: `interface Problem { path: string; id: string | null; message: string }`, `checkEdit(edit: Edit): Problem[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/edit/__tests__/derive.test.ts` (400 lines, as committed).

Create `src/lib/edit/__tests__/check.test.ts` (181 lines, as committed).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/derive.test.ts src/lib/edit/__tests__/check.test.ts`
Expected: FAIL, 2 files, the imports of `../derive` and `../check` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/lib/edit/derive.ts` (273 lines, as committed).

Create `src/lib/edit/check.ts` (110 lines, as committed).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/derive.test.ts src/lib/edit/__tests__/check.test.ts`
Expected: PASS, 2 files, 44 + 21 tests.

- [ ] **Step 5: Type-check, lint and commit**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/lib/edit`
Expected: no output from either, exit 0.

```bash
git add src/lib/edit/derive.ts src/lib/edit/check.ts src/lib/edit/__tests__/derive.test.ts src/lib/edit/__tests__/check.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(edit): what follows from an edit, and its checks"
```

---

### Task 4: Operations and the door

**Files:**
- Create: `src/lib/edit/ops.ts`, `src/lib/edit/index.ts`
- Test: `src/lib/edit/__tests__/ops.test.ts`, `src/lib/edit/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `checkEdit`, `Problem` from `./check`; `assetOf`, `coverFrame`, `layout`, `placed` from `./derive`; the schemas, `NEUTRAL`, `NO_LOOK` and `newShot` from `./doc`; `PARTS` from `./parts`; `Ms` from `./atoms`.
- Produces, from `ops.ts`: `OpSchema`, `OpsSchema`, `OP_NAMES`, `type Op`, `parseOps(json: unknown): Op[]`, `type Applied = { ok: true; edit: Edit } | { ok: false; problems: Problem[] }`, `applyOps(edit: Edit, ops: unknown, library?: readonly Asset[]): Applied`.
- Produces, from `index.ts`: everything the six files export, under `@/lib/edit`. `atoms.ts` is not exported.

What each operation does, for whoever reads only this task:

| Operation | What it does |
|---|---|
| `shot.insert { after, shot: { id, asset, startMs, endMs, ...settings } }` | A new shot after the named one, or first when `after` is null: a stretch of a file. |
| `shot.split { id, atMs, newId }` | Two shots from one, cut at a moment of its file. Nothing on the film changes. Each mark goes, whole, to the piece that shows its moment. |
| `shot.trim { id, startMs?, endMs? }` | The stretch of its file a shot shows, exactly as asked; an end not given stays. Marks, items and the cover are left as they are. |
| `shot.remove { id }` | Takes a shot out, with its marks. An edit keeps at least one. |
| `shot.move { id, after }` | Puts a shot after another, or first. |
| `shot.set { id, speed?, volume?, framing?, out? }` | A shot's settings. A new speed keeps the stretch of file. |
| `mark.add { shot, mark }`, `mark.set { id, asset?, atMs?, lenMs?, props? }`, `mark.remove { id }` | A kit part on a shot, at a moment its footage shows. Settings given are laid over the ones it has. |
| `item.add { item }`, `item.set { id, asset?, anchor?, at?, frames?, props? }`, `item.remove { id }` | A kit part on the film, counted from its start or back from its end. |
| `word.set { asset, index, text?, hidden?, stress? }` | A word's text, whether the captions show it, whether they stress it. |
| `captions.set { ...some of the captions' settings }` | The captions. |
| `asset.add { id }`, `asset.remove { id }` | A file from the ones on offer; out again when nothing uses it. |
| `look.set { shot?, preset?, adjust? }`, `look.clear { shot? }` | The film's look, or what one shot changes of it. What is given is laid over what is there. |
| `cover.set { cover }` | The cover: a moment a shot shows, or none. |

- [ ] **Step 1: Write the failing tests**

Create `src/lib/edit/__tests__/ops.test.ts` (696 lines, as committed).

Create `src/lib/edit/__tests__/index.test.ts` (33 lines, as committed).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/ops.test.ts src/lib/edit/__tests__/index.test.ts`
Expected: FAIL, 2 files, the imports of `../ops` and `..` cannot be resolved.

- [ ] **Step 3: Write the implementation**

Create `src/lib/edit/ops.ts` (446 lines, as committed).

Create `src/lib/edit/index.ts` (12 lines, as committed).

- [ ] **Step 4: Run the whole of `src/lib/edit` to verify it passes**

Run: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit`
Expected: PASS, 7 files, 189 tests (82 in `ops.test.ts`, 3 in `index.test.ts`).

- [ ] **Step 5: Type-check, lint and commit**

Run: `pnpm exec tsc --noEmit && pnpm exec eslint src/lib/edit`
Expected: no output from either, exit 0.

```bash
git add src/lib/edit/ops.ts src/lib/edit/index.ts src/lib/edit/__tests__/ops.test.ts src/lib/edit/__tests__/index.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(edit): operations and the one door"
```

---

## After the last task

- [ ] Run the repository's whole suite once: `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run`. Expected: the baseline's 6 726 tests plus the 189 new ones pass.
- [ ] Have a fresh reviewer read `src/lib/edit/` against spec §5 to §5.2, given the code and the spec and nothing else. (Done twice; see the status line at the top.)

## What this plan leaves for the next ones

- The kit and the film (`src/edit/film/`): a component for each part of `parts.ts`, drawn from `derive.ts` (`layout`, `placed`, `runWords`, `framingAt`, `momentOf`, `lookOf`); a run drawn as one piece of footage, so a cut inside it cannot hitch or click; what is drawn over what, by kind of part and by start; a short fade of a run's sound where it starts and ends; a test that holds the two lists of parts equal; the preview-against-render test.
- The end card, the arrow and the sticker of the first kit: each is a schema in `parts.ts` and a component.
- The recipes (`tighten`, `place.captions`, `level.voice`) and `review`: they need a take's analysis, which the worker makes.
- `review`: two titles at once, a mark that no longer shows, and the faults that need a take's analysis.
- The largest zoom a file's size allows, settled with the kit's framing.
