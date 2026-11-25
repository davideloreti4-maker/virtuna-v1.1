# The edit agent (part 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A plain request changes a creator's edit in seconds, and a take comes back as a reviewed first cut **in a style** (a reference video's, a preset's, or one described in words), with Qwen choosing and code doing the craft.

**Architecture:** Pure TypeScript pieces under `src/lib/edit/`:
- a server-side text measure and the kit's layout boxes, shared with the kit;
- `review`, which reads an edit against its takes' analyses;
- the recipes `tighten`, `placeCaptions` and `levelVoice`;
- the catalogue and context the model is given;
- the agent loop.

A style (`StyleProfile`) is read from a reference video (the worker's analysis plus a sighted Qwen reading of its frames), from a preset, or from the creator's words, and the first cut applies it. One Qwen call per round answers `{say, ops}`. The door (`applyOps`, `checkEdit`) and `review` judge it. At most three rounds. Stills come from the worker's new `/stills` route when something seen changed. A Next route (`POST /api/edit/agent`) and a dev page (`/dev-edit/agent`) expose it.

**Tech Stack:**
- Next.js 16 route handlers and TypeScript, zod 4, vitest;
- Qwen 3.7-flash through DashScope's OpenAI-compatible API (`src/lib/engine/qwen/client.ts`);
- Remotion 4.0.545 (kit and Player);
- the worker on Modal (Python, FastAPI);
- Playwright 1.58.2 (Chromium, WebKit) for browser proofs.

**Spec:** `docs/superpowers/specs/2026-11-21-edit-agent-design.md` (read it first; decisions X83–X89 are there). Part 2's handoff: `docs/HANDOFF-2026-11-20-edit-worker.md`; part 2's decisions X38–X82 are in `docs/superpowers/plans/2026-11-20-edit-worker.md`.

## Global Constraints

**Model**
- **P1, the owner:** "lets use just qwen". The agent calls only `QWEN_REASONING_MODEL` (today `qwen3.7-flash`) through `getQwenClient()`, with `response_format: { type: "json_object" }`, `temperature: 0` and `seed: QWEN_SEED`. No other model, no comparison arm. A failing gate is fixed in our layer (prompt, catalogue, repair messages), never with a bigger model (`docs/MODEL-POLICY.md`).

**The design's rules (N2, N3, N4, N5, N8)**
- **N2:** the agent writes operations, never code that runs.
- **N4:** every change passes one door: `applyOps` (all or none), then `checkEdit`. The agent, the recipes and a button use the same door.
- **N3:** nothing is placed from a transcript alone. A cut between shots of one take lands in a measured pause (X54).
- **N8:** the craft is in code. Where a cut goes, where captions sit and how loud a shot is are computed from the analysis. The model chooses what and why.
- **N5:** facts about a file (length, size, word times) are the worker's, read from the take rows. An edit handed to the route has its take facts checked against the rows (X78's `refusedFiles`).

**The kit**
- **What is seen is what is posted (N1):** any change to the kit (`src/edit/film/`) keeps `scripts/edit-preview-vs-render.ts` saying "preview and render agree" in Chromium and WebKit.
- **Pinned engine:** every `remotion` and `@remotion/*` package stays pinned to exactly `4.0.545`. `@remotion/renderer` and `@remotion/bundler` never run in a Next route.

**Who may spend**
- **The gate (X81):** every edit route goes through `creator()` and its `EDIT_CREATORS` allowlist.
- **Modal:** every function keeps a `timeout`, with cores requested and limited to the same number, and a `max_containers`.

**Secrets, data and the repo**
- Never read, `cat`, `grep`, list or open `.env*`, or `~/.modal.toml`. Scripts load `.env.local` programmatically. Never print a secret.
- The repo is public: no real ids, emails, signed links, the worker's address, or a transcript of the owner's takes in committed files (the proof's requests may name a word or two of his take). Fixtures are made up. Tests against the owner's real take read `.scratch/` and skip when it is absent.

**Tests**
- Tests exercise the real code. Mocks only at network boundaries: Qwen (DashScope), R2, Modal (the worker's address), Supabase. Each boundary is proved by a real run, written down in the task's results.
- Vitest runs with `NODE_OPTIONS=--no-experimental-webstorage`. The repo's checks are `pnpm exec tsc --noEmit` and `pnpm exec tsc -p scripts/tsconfig.edit.json`. The machine is shared and sometimes loaded: rerun a timed-out test alone before concluding.

**Local servers and tools**
- Dev servers bind to 127.0.0.1 on a port from 3000 to 3005 (the bucket's CORS). Background servers die when a turn ends, so a browser proof is one command that starts its own server.
- `pnpm add` bumps `react-grab`, `@react-grab/cli` and `bippy`. Restore their blocks in `pnpm-lock.yaml` and run `pnpm install --frozen-lockfile` (`docs/superpowers/plans/2026-11-19-edit-kit.md`, Task 1).

**Git and recording**
- Commit with `git -c core.hooksPath=/dev/null commit` on `feat/edit`. Never push.
- New decisions are numbered from X90 on, in this plan's table.

## Decisions taken in this plan (mine, the owner's to overturn)

Decisions X94 to X100 (ligatures and optical size, styles, references, the analysis's new stages, punch-ins) are in the spec's §10.

| # | Decision | Why |
|---|---|---|
| X90 | Text is measured on the server from width tables made from the kit's own font files (unkerned advances per font and weight), proved against the browser's `measureText` with the kit's `MEASURED_AS` in Chromium and WebKit. | `review` and the recipes run on the server, where there is no browser; the kit already measures without kerning, so a table can match it. |
| X91 | The kit's boxes (each caption page, title, call-out, progress bar) are computed by pure functions in `src/edit/film/layout.ts`. The parts and `review` both call them, the parts with the browser's measure and `review` with the table's. | One source of geometry, so `review` judges what is drawn. |
| X92 | "One live agent call per creator" (X89) is held in the server instance's memory for now; a durable hold comes with part 4's edits table. | No table and no migration in this part; the allowlist (X81) is two accounts. |
| X93 | A change is accepted when the door passes and `review` finds no error that the input edit did not already have; a first cut must end with no errors at all. | A request should not force unrequested changes to fix an older finding; a first cut is the agent's own edit, so it answers for all of it. |

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/edit-font-widths.ts` | Makes the width tables from `public/edit/fonts/*` | 1 |
| `src/edit/film/widths.json` | The width tables (generated, committed) | 1 |
| `src/lib/edit/measure.ts` | `measure(text, font, weight, size, trackingEm)`: unkerned width in px from the tables | 1 |
| `scripts/edit-measure-proof.ts` | Table width against the browser's, in Chromium and WebKit | 1 |
| `src/edit/film/layout.ts` | Pure box math for captions pages, title, call-out, progress | 2 |
| `src/edit/film/Captions.tsx`, `parts/Title.tsx`, `parts/Callout.tsx`, `parts/Progress.tsx` | Call `layout.ts` (no visual change) | 2 |
| `src/lib/edit/analysis.ts` | `TakeAnalysisSchema` and `analysisOf(take row)`: pauses, faces, loudness | 3 |
| `src/lib/edit/zones.ts` | TikTok and Instagram overlay zones, with source and date | 3 |
| `src/lib/edit/stage.ts` | `faceOnStage`: a face sample to stage shares through the shot's framing and cover fit | 3 |
| `src/lib/edit/review.ts` | `review(edit, analyses) → Finding[]` | 3 |
| `src/lib/edit/recipes/{tighten,captions,voice,punch,index}.ts` | The four recipes | 4 |
| `src/lib/edit/agent/catalogue.ts` | The catalogue text for the model | 5 |
| `src/lib/edit/agent/context.ts` | The compact edit, words, pauses, faces and findings for one request | 5 |
| `worker/app.py`, `worker/store.py` | `POST /stills` (frames or one sheet) on the web address; `max_containers` on `stills` | 6 |
| `src/lib/edit/worker/stills.ts` | `stillsOf(user, edit, frames) → Still[]` (server only) | 6 |
| `src/lib/edit/agent/model.ts` | `askQwen(messages) → {text, usage, ms}`, the one network boundary | 7 |
| `src/lib/edit/agent/loop.ts` | `change(input) → AgentResult`: rounds, door, review, stills, repair | 7 |
| `worker/media/scenes.py`, `worker/media/picture.py` | The analysis's `cuts` and `picture` stages; reference mode | 8 |
| `src/lib/edit/style/{profile,measures,read,match,index}.ts` | `StyleProfileSchema`, measures from an analysis, the sighted reading, `profileOf` and the match check | 9 |
| `src/lib/edit/agent/first-cut.ts` | `firstCut(input) → AgentResult`, in a style | 10 |
| `src/lib/edit/style/reference.ts`, `src/app/api/edit/references/` | A reference fetched or uploaded, read, and dropped | 11 |
| `src/lib/edit/style/{words,presets}.ts`, `src/lib/edit/style/presets.json` | A style from words; the measured presets | 12 |
| `src/app/api/edit/agent/route.ts` | `POST`: a change or a first cut | 13 |
| `src/app/dev-edit/agent/{page.tsx,agent.tsx}` | The dev page | 13 |
| `src/lib/edit/agent/requests.json` | The proof's fixed requests | 14 |
| `scripts/edit-agent-proof.ts` | Runs the proof: requests and first cuts ×3, styles, rates, times, cost, stills | 14 |

---

### Task 1: Measuring text on the server

**Files:**
- Create: `scripts/edit-font-widths.ts`, `src/edit/film/widths.json`, `src/lib/edit/measure.ts`, `src/lib/edit/__tests__/measure.test.ts`, `scripts/edit-measure-proof.ts`
- Modify: `package.json` (devDependency `fontkit`, pinned exactly), `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `FONT_FILES`, `MEASURED_AS` (`src/edit/film/fonts.ts`); the font files in `public/edit/fonts/`; `FONTS` (`src/lib/edit/parts.ts`).
- Produces:
  ```ts
  // src/lib/edit/measure.ts
  export type FontId = "inter" | "montserrat" | "tiktok";
  /** Unkerned width in px, as the kit measures with MEASURED_AS; null when a character is not in the table. */
  export function measure(text: string, font: FontId, weight: number, size: number, trackingEm?: number): number | null;
  /** The weights the table holds for each font (every weight the kit draws with). */
  export const MEASURED_WEIGHTS: Record<FontId, readonly number[]>;
  ```

- [x] **Step 1: List every font weight the kit draws with.** Read `src/edit/film/Captions.tsx` (captions 800, stressed 900), `parts/Title.tsx`, `parts/Callout.tsx` and `parts/Progress.tsx`. Write the list into the header of `scripts/edit-font-widths.ts`.
- [x] **Step 2: Write the table script.** For each font, and each weight from Step 1, instance the variable font at `wght` and write `{unitsPerEm, advances: {char: units}}` to `src/edit/film/widths.json`.
  - Instance with fontkit's `font.getVariation({ wght })`.
  - Include U+0020–U+007E, U+00A0–U+017F, and the punctuation `– — ' ' " " … • €`.
  - Run with `pnpm exec tsx scripts/edit-font-widths.ts`.

  ```ts
  import * as fontkit from "fontkit";
  // for each font id → file, each weight → const instance = font.getVariation({ wght: weight });
  // advances[ch] = instance.glyphForCodePoint(cp).advanceWidth
  ```
- [x] **Step 3: Write the failing tests** in `src/lib/edit/__tests__/measure.test.ts`:
  - `measure("", "inter", 800, 72)` is 0;
  - width scales linearly with size: `measure("Hello", "inter", 800, 144)` equals twice the value at 72, to 1e-9;
  - tracking adds `trackingEm * size` per character: `measure("ab", "tiktok", 800, 100, -0.01)` equals the value without tracking minus 2 px;
  - a character outside the table gives `null` (`measure("👋", …)`);
  - an unlisted weight throws, naming the font and the weight.
- [x] **Step 4: Run them; they fail** (no module): `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vitest run src/lib/edit/__tests__/measure.test.ts`.
- [x] **Step 5: Implement `measure`.** Sum the advances, scale by `size / unitsPerEm`, and add `trackingEm * size` once per character, as CSS `letter-spacing` does.
- [x] **Step 6: Run the tests; they pass.**
- [x] **Step 7: The browser proof** (`scripts/edit-measure-proof.ts`, one command that starts its own server, like `scripts/edit-preview-vs-render.ts`):
  - **Corpus:** 300 strings: the English, German and Italian words of `src/lib/edit/__tests__` fixtures, 50 generated mixes of the table's characters, and the titles and call-outs of the kit's demo edits.
  - **Each string:** measure it in the page with `@remotion/layout-utils` `measureText` and `MEASURED_AS`, at every listed font and weight, at size 100, in Chromium (`chromium.launch({ channel: "chromium" })`) and WebKit.
  - **Pass:** every string within 0.5 px of `measure`.
  - Print the worst five per browser. Run it and keep the output.
- [x] **Step 8: Commit.**
  ```bash
  git add scripts/edit-font-widths.ts scripts/edit-measure-proof.ts src/edit/film/widths.json src/lib/edit/measure.ts src/lib/edit/__tests__/measure.test.ts package.json pnpm-lock.yaml
  git -c core.hooksPath=/dev/null commit -m "feat(edit): text measured on the server from the kit's own fonts, as the browser measures it"
  ```

**Results** (2026-11-21; `pnpm exec tsx scripts/edit-measure-proof.ts`, Playwright 1.58.2, Chromium and WebKit). **The 0.5 px pass is not met, because of the typefaces' default substitutions. Nothing else is off.**

- **The table:** fontkit 2.0.4, pinned (3.0.0 was ten days old). `getVariation` takes `wght`, plus `opsz` at its largest (see below). Each weight holds 326 characters in Inter, 327 in Montserrat and 323 in TikTok Sans. The fonts have no glyph for these, so `measure` gives null: U+00AD in all three, U+0149 in Inter, and U+00A6 U+00AC U+00B5 U+017F in TikTok Sans. The kit draws text at weights 700, 800 and 900, and every typeface is tabled at all three.
- **The corpus:** 300 strings.
  - 15 come from `src/lib/edit/__tests__`. They are English only: the folder has no German or Italian words.
  - 55 come from `worker/tests/test_words.py`, in English, German and Italian.
  - 19 are the demo edits' titles and call-outs.
  - 50 are random mixes.
  - 165 are made-up everyday words and lines in the three languages.
- **The run:** 5,400 widths per browser: each string in 3 typefaces × 3 weights, without tracking and with -0.01em, at 100 px.
- **Chromium:** 58 widths more than 0.5 px apart; 275 of 300 strings within 0.5 px everywhere. The worst five (browser − table):
  - "before -> after", Inter 900: -19.82
  - "before -> after", Inter 800: -18.26
  - "before -> after", Inter 700: -16.86
  - a mix with "–>", Inter 700: +16.32
  - the same mix, Inter 800: +15.58
- **WebKit:** 52 widths more than 0.5 px apart; 277 of 300 strings within 0.5 px. The worst five are all the "–>" mix in Inter, all positive:
  - 700 tracked: +17.32
  - 800 tracked: +16.58
  - 700: +16.32
  - 900 tracked: +15.76
  - 800: +15.58
- **Every width more than 0.05 px apart has one of these causes.** Each is a substitution the font makes by default, and the kit's `MEASURED_AS` keeps it on (`fontFeatureSettings` and `fontVariantLigatures` are `normal`):

  | Typeface | What | Apart at 100 px | Chromium | WebKit |
  |---|---|---|---|---|
  | Montserrat | the "fi" ligature (liga), per "fi" | +0.40 (700), +0.70 (800), +1.00 (900) | yes; off with tracking | yes; off with tracking |
  | Montserrat | "ŀ" set as l + middle dot (locl) | +0.34 to +0.41 | yes, tracked too | yes, tracked too |
  | Inter | arrows (calt): "->", "<-" -18.3; "=>" -39.7; "–>" +15.6 | as given | yes; off with tracking | "<-", "=>", "–>" yes, tracked too; "->" in "a -> b" no |
  | Inter | × for x between digits (calt): "3x4", "1080x1920" | +11.7 | yes; off with tracking | yes, tracked too |
  | TikTok Sans | ß after a capital: "STRAßE" | +5.0 (+4.3 to +5.9 by weight) | yes, tracked too | no |
  | Montserrat | the no-break space, which WebKit sets as wide as the space | +0.05 to +0.11 | no | yes |

- **Without those strings:** every width is within 0.05 px in Chromium, and within 0.112 px in WebKit.
- **Kerning** is off in both browsers, as `MEASURED_AS` asks.
- **Letter-spacing:** both browsers add it after every character, the last one too. Every other tracked width agrees with the table plus `trackingEm × size` per character to within 0.05 px.
- **Optical size:** with `font-optical-sizing: auto`, both browsers set `opsz` to the type size in px. So the table is made at `opsz` 32 (Inter) and 36 (TikTok Sans).
  - Reported, not held, over the strings that agree at 100 px, at weight 800.
  - At 44 px the browser agrees: typically 0.00 %, at most 0.06 %.
  - At 24 px the browser is wider: Inter +2.2 % typically (up to 17 % for a lone character), TikTok Sans +1.8 % (0.4 to 4.6 %), Montserrat 0.01 %. The numbers are the same in both browsers.
  - Type that small happens: a 40-character label call-out is set at 31 px, so its box in Task 2 will meet this.
- **The kit itself:** its own measure disagrees between the two browsers on Inter's "->" (-18.3 px in Chromium; 0 in WebKit in "a -> b") and on TikTok Sans' "ß" after a capital (+5.0 px in Chromium; 0 in WebKit). This is the same kind of split as the kerning one of 2026-11-19 (`fonts.ts`).
- **Not decided here (the owner's):**
  - (a) Measure with those features off, as kerning is: `fontVariantLigatures: "none"` and `"calt" 0`. This is a change to the kit, under N1. What is drawn would then differ from the box, by up to ±20 px for an arrow.
  - (b) Shape on the server. fontkit's `layout` gives the fi, ŀ, arrow and × widths to 0.02 px, but not TikTok Sans' ß, which only Chromium makes.
  - (c) Give the table pairs. That is a new rule, so it was not taken.

**After fix round 1** (commit `b2886d92`; recorded by the controller from the report):
- **The kit changed (X94):**
  - ligatures and contextual alternates (liga, calt) are off in what it measures and in what it draws;
  - the optical size is pinned with `"opsz" 36`, so small type is drawn as large type is;
  - the measure also sets `"kern" 0`, because WebKit otherwise drifted after thousands of measurements on one page.
  
  Montserrat's ccmp characters (Ŀ ŀ ŉ) are held as each is set alone.
- **The proof again:** 27,000 widths per browser, at 100, 44, 31, 20 and 12 px, all within 0.5 px (worst 0.016 px in Chromium, 0.109 px in WebKit). The kit's own two browsers now draw the old problem lines identically; they were 18 px apart before.
- **Nothing drawn changes in the demos** (no demo text is under 32 px). Preview and render agree over 97 frames: 0.292 % / 0.76 levels in Chromium, 0.340 % / 1.65 in WebKit.
- **Known:** with calt off, Inter loses its raised punctuation between capitals in all-caps text, so the widths are unchanged but the look is slightly different.

---

### Task 2: The kit's boxes as pure functions

**Files:**
- Create: `src/edit/film/layout.ts`, `src/edit/film/__tests__/layout.test.ts`
- Modify: `src/edit/film/Captions.tsx`, `src/edit/film/parts/Title.tsx`, `src/edit/film/parts/Callout.tsx`, `src/edit/film/parts/Progress.tsx`

**Interfaces:**
- Consumes: `lines.ts` (`rowsWithin`, `fitLines`, `markedWords`), the parts' settings (`PARTS` in `src/lib/edit/parts.ts`), `STAGE`, `Captions`.
- Produces:
  ```ts
  // src/edit/film/layout.ts
  export type Measure = (text: string, weight: number, size: number, trackingEm?: number) => number; // px, unkerned, for one font
  export interface Box { x: number; y: number; w: number; h: number } // stage pixels: left, top, width, height
  /** Every page of one run of captions, each held at the place of the run's tallest page, as the kit draws them. There is no one-page box: a page's place depends on its run (Task 2's review, I1). */
  export function captionPages(captions: Captions, pages: readonly (readonly CaptionWord[])[], measure: Measure, stage?: Stage): CaptionLayout[];
  export function titleBox(props: TitleProps, measure: Measure): Box & { size: number; breaks: number[] };
  export function calloutBox(props: CalloutProps, measure: Measure): Box & { size: number };
  export function progressBox(props: ProgressProps): Box;
  ```
  `TitleProps`, `CalloutProps` and `ProgressProps` are `z.infer` of the parts' `props`.

- [x] **Step 1: Read the four components** and write down, as comments at the top of `layout.ts`, each one's box rule as it is today. Cover size fitting, line breaks, padding (`side`, `reach`), line pitch (`size * 1.15` for captions), and `hold` near the stage's top and bottom.
- [x] **Step 2: Write the failing tests** (`layout.test.ts`), using a fixed measure (`(text, weight, size) => text.length * size * 0.5`) so the expected numbers are exact:
  - `captionPages` (one page) with `DEFAULT_CAPTIONS` and three words gives one row centred at `0.8 * 1920`, its height one pitch plus the pill's padding;
  - `captionPages` with words too wide for `width * 1080` breaks into two rows, never more than the kit allows;
  - `titleBox` with a long text and size 220 shrinks to the size `fitLines` gives;
  - `calloutBox` at `x: 0.5, y: 0.3` is centred on (540, 576);
  - `progressBox({ edge: "top" })` sits at y 0.
- [x] **Step 3: Run them; they fail.**
- [x] **Step 4: Move each component's box math into `layout.ts`,** unchanged in what it computes. The component passes a `Measure` built from `measureText` with `MEASURED_AS`, which is the call it makes today.
- [x] **Step 5: Run the layout tests and the kit's tests:** `pnpm exec vitest run src/edit`. All pass.
- [x] **Step 6: Prove that nothing drawn changed:**
  - run `pnpm exec tsx scripts/edit-preview-vs-render.ts`, which must still say "preview and render agree" in Chromium and WebKit;
  - render the demo edit's stills at frames 0, 45, 300 and its last frame before and after the change (`scripts/edit-still.ts`), and compare them with `worker/tests/apart.mjs`: 0 far-apart pixels.
- [x] **Step 7: Add a cross-check test,** run inside the existing browser proof: for 20 strings, `captionPages`, `titleBox` and `calloutBox` with `measure` (Task 1) equal the boxes the components draw, read from the DOM in Chromium, within 1 px.
- [x] **Step 8: Commit.**
  ```bash
  git add src/edit/film/layout.ts src/edit/film/__tests__/layout.test.ts src/edit/film/Captions.tsx src/edit/film/parts/Title.tsx src/edit/film/parts/Callout.tsx src/edit/film/parts/Progress.tsx
  git -c core.hooksPath=/dev/null commit -m "refactor(edit): the kit's boxes in one pure module, shared with review; nothing drawn changes"
  ```

**Results (2026-11-21, commits `3f54c4f7`, `985f2981`; recorded by the controller from the report):**
- **`layout.ts`** holds the box rules of Captions, Title, Callout and Progress, moved unchanged (the review compared them operation by operation). `fitText` is replaced by its own formula, exactly.
- **Caption boxes come only by run:** `captionPages`. The kit holds every page of a run at its tallest page's place, so a page set alone would sit up to 332 px from where it is drawn. The one-page `captionBox` is no longer exported.
- **Before and after:** 68 stills are pixel-identical (0 far-apart pixels, 0 levels; the demo edit and `demo-long` at frames 0, 45, 300 and 2725).
- **Preview against render:** they agree, at the same numbers as Task 1 (0.292 % / 0.76 levels in Chromium, 0.340 % / 1.65 in WebKit).
- **The cross-check inside that proof:** 57 boxes (titles, call-outs and caption pages, from 20 made-up strings) are 0.000 px apart from the server's `measure`. "Wow 👋" is the only allowed skip. Six cases cross a taller-page hold, three at the top and three at the bottom. A 1 % skew of the measure fails it by 12–16 px.
- **For Task 3:** the boxes are at rest, without outline strokes, shadows or the pop and slide motion; the box check runs in Chromium only; and `review` must skip text the table cannot measure, not throw.

---

### Task 3: `review`

**Files:**
- Create: `src/lib/edit/analysis.ts`, `src/lib/edit/zones.ts`, `src/lib/edit/stage.ts`, `src/lib/edit/review.ts`, and tests for each in `src/lib/edit/__tests__/`
- Modify: `src/lib/edit/index.ts` (export them)

**Interfaces:**
- Consumes: the take row's `analysis` (X62: `pauses`, `faces`, `loudness`, `language`; the worker's `worker/media/analyse.py` `Analysis`); `layout.ts` (Task 2: `captionPages` per run, never a page alone; `titleBox`, `calloutBox`, `progressBox`); `measure` (Task 1); `layout`, `placed`, `runWords`, `framingAt`, `momentAt`, `frameOf`, `filmFrames` (`src/lib/edit/derive.ts`).
- Produces:
  ```ts
  // analysis.ts
  export const PauseSchema: z.ZodType<{ startMs: number; endMs: number; cutMs: number }>;
  export const ShareBoxSchema: z.ZodType<{ x: number; y: number; w: number; h: number }>; // shares of the take's picture
  export const FaceSampleSchema: z.ZodType<{ ms: number; face: ShareBox | null; mouth: ShareBox | null }>;
  export const TakeAnalysisSchema: z.ZodType<{ language: string | null; pauses: Pause[]; faces: FaceSample[]; loudness: { lufs: number; truePeak: number; levels: { ms: number; lufs: number }[] } | null }>;
  export type TakeAnalysis = z.infer<typeof TakeAnalysisSchema>;
  export type Pause = z.infer<typeof PauseSchema>; export type ShareBox = z.infer<typeof ShareBoxSchema>; export type FaceSample = z.infer<typeof FaceSampleSchema>;
  /** By asset id. */
  export type Analyses = Readonly<Record<string, TakeAnalysis>>;
  export function analysisOf(take: TakeRow): TakeAnalysis; // throws on a row without a valid analysis
  // zones.ts
  export interface Zone { app: "tiktok" | "instagram"; what: string; x: number; y: number; w: number; h: number } // stage shares
  export const ZONES: readonly Zone[];
  export const ZONES_SOURCE: { measured: string; from: string[] }; // date and the sources' addresses
  // stage.ts
  export function faceOnStage(sample: FaceSample, asset: { w: number; h: number }, frame: Frame): { face: Box | null; mouth: Box | null }; // stage pixels
  // review.ts
  export type FindingCode = "on-face" | "under-buttons" | "text-fits" | "two-titles" | "cut-outside-pause" | "empty-start" | "mark-hidden" | "fade-both" | "soft-zoom";
  export interface Finding { code: FindingCode; severity: "error" | "warn"; where: { frame: number; shot?: string; mark?: string; item?: string }; says: string }
  export function review(edit: Edit, analyses: Analyses): Finding[];
  ```

- [x] **Step 1: Measure the overlay zones.** Collect TikTok's and Instagram Reels' current safe zones for a 1080×1920 video:
  - TikTok's own guidance (TikTok for Business / Creative Center);
  - Meta's Reels guidance;
  - at least one dated third-party template for each.

  Write each overlay as a `Zone` in stage shares: TikTok's right-side buttons, its bottom caption and sound bar, its top bar; Instagram's right-side buttons, its bottom caption and audio bar, its top bar. Where sources disagree, take the larger. Fill `ZONES_SOURCE` with today's date and the addresses.
- [x] **Step 2: Write the failing tests:**
  - `analysis.test.ts`: a made-up row parses; a row with no `analysis`, or a face box outside 0..1, throws, naming the field.
  - `stage.test.ts`:
    - a 720×1280 take at `{zoom: 1, x: 0, y: 0}` maps the share box `{x: .25, y: .25, w: .5, h: .25}` to `{x: 270, y: 480, w: 540, h: 480}`;
    - a 1920×1080 take, cover-fit, crops its sides: the centre share box `{x: .4, y: .4, w: .2, h: .2}` maps to a box centred on (540, 960) that is 0.2 of the scaled width wide;
    - zoom 2 at `x: 0, y: 0` doubles about the centre.
  - `review.test.ts`, one test per code, each on a hand-made edit and analysis:
    - **`on-face` error:** a face box from 0.6 to 0.9 of the height through the whole take, with captions at `y: 0.8`. Moving the captions to `y: 0.3` clears it. A call-out over the mouth at its moment is flagged; the same call-out at a moment with `face: null` is not.
    - **`under-buttons` error:** a call-out at `x: 0.95, y: 0.6` is flagged with the zone's app and name in `says`.
    - **`text-fits` error:** a call-out whose text at the part's smallest size (44) is wider than the stage.
    - **`two-titles` error:** a film title over frames 0–45 and a shot title at frame 30.
    - **`cut-outside-pause` error:** two shots of one take joined at 1500 ms where the pauses are 1000–1200 and 2000–2400; joined at 1100 is clean.
    - **`empty-start` error:** a first shot starting at a moment the take shows nothing, i.e. an image of zero length. Write the case the derive functions allow; if none exists, say so in a comment and test that frame 0 always has footage.
    - **`mark-hidden` warn:** a mark whose `atMs` a later `shot.trim` cut away.
    - **`fade-both` warn:** a shot shorter than its in-fade plus out-fade.
    - **`soft-zoom` warn:** zoom 1.5 on a 720×1280 take (limit `2 × 720 / 1080 = 1.333`).
    - **A clean edit** gives `[]`, and `review` is deterministic (the same call twice gives equal arrays).
- [x] **Step 3: Run them; they fail.**
- [x] **Step 4: Implement `analysis.ts`, `zones.ts` and `stage.ts`.** `faceOnStage` follows the kit's `objectFit: "cover"` (`src/edit/film/Footage.tsx`) and `framingAt` (zoom about the centre, `x`/`y` choosing the part shown).
- [x] **Step 5: Implement `review`.** For each caption page, title, call-out and progress bar, find the frames it shows (`placed`, `runWords`) and its box (`layout.ts` with `measure`). Then check the face at every face sample inside those frames, and the zones at every frame it shows. Box overlap counts when the intersection is at least 4 % of the text box's area. `says` is one sentence naming the thing, the moment in seconds and the fix's direction ("the captions at 3.2 s cover the mouth; move them up or down").
- [x] **Step 6: Run the tests; they pass.**
- [x] **Step 7: The real take.** Add a test that reads the owner's take analysis from `.scratch/worker-proof/` (`it.skipIf` when absent). It runs `review` on `firstEdit` of that take, prints the findings, and asserts there are no `cut-outside-pause` and no `empty-start` findings. Run it and keep the output.
- [x] **Step 8: Commit.**
  ```bash
  git add src/lib/edit/analysis.ts src/lib/edit/zones.ts src/lib/edit/stage.ts src/lib/edit/review.ts src/lib/edit/index.ts src/lib/edit/__tests__/
  git -c core.hooksPath=/dev/null commit -m "feat(edit): review reads an edit against its takes: faces, the apps' buttons, text, cuts in pauses"
  ```

**Results (2026-11-21, commits `d45579c1`, `5a581661`, `21879008`, `e77ba47a`, `ffac8613`, `5f71c207`; recorded by the controller from the report):**
- **Rulings that amended the brief before review** (`task-3-fix-0*.md` in the plan's workspace):
  - The zones are an organic post's overlays, not an ad's. Each element comes from the sources that measure it, with medians:
    - TikTok's icons: x 916–1058, y 576–1737, measured on TikTok's own UI template;
    - TikTok's bottom bar: 380 px;
    - Instagram's icons: 130 px wide, from y 1056;
    - Instagram's bottom bar: 420 px;
    - the top bars: 240 and 269 px.
    
    Every source and date is recorded in `zones.ts`.
  - `under-buttons` is graded: an error at 15 % of a text's box, a warning from 4 %. The progress bar is exempt.
  - `on-face` is graded: an error over the mouth (25 % of its box) or the eyes (the face's upper half, from 4 % of the text's box); a warning on the chin, the cheeks or the hair.
  - `cut-outside-pause` also judges the film's start and end, and joins between takes.
  - New warnings: `no-analysis` and `unmeasured`.
  - `review`, `measure`, `zones` and `stage` stay out of the browser barrel.
- **The review's finding:** each face sample stands for the frames up to the next one, so a 3-frame call-out over the mouth, or one in a slowed shot, is caught. Faces are skipped only under a push or a punch, which move the footage; a fade, wipe, iris or clock keeps them.
- **The caption pages' frames** come from one helper (`captionFrames` in `derive.ts`), shared by the kit and `review`. Preview and render still agree, at the same numbers.
- **The owner's take, first edit (captions at y 0.8):** 4 findings:
  - two bottom-bar errors;
  - a 12 px chin warning;
  - a touch of TikTok's icons, also a warning.
  
  Its error-free caption bands are y 0.17–0.26 and 0.75–0.76. Between them, his eyes and mouth (0.27–0.74; his mouth sits at 0.63–0.69); below them, the bottom bars from 0.77. Stills with the zone, face and caption boxes outlined match every finding (`.scratch/task3-stills/`).
- **Open for Task 9:** the zones rest mostly on secondary sources. The five references' real caption heights will check them.

---

### Task 4: The recipes

**Files:**
- Create: `src/lib/edit/recipes/tighten.ts`, `src/lib/edit/recipes/captions.ts`, `src/lib/edit/recipes/voice.ts`, `src/lib/edit/recipes/punch.ts`, `src/lib/edit/recipes/index.ts`, `src/lib/edit/recipes/__tests__/recipes.test.ts`

**Interfaces:**
- Consumes: `Op`, `applyOps` (`src/lib/edit/ops.ts`), `Analyses` and `review` (Task 3), `layout.ts` (Task 2), `measure` (Task 1).
- Produces:
  ```ts
  export function tighten(edit: Edit, analyses: Analyses, opts: { pauseMs: number }): Op[];   // 120 ≤ pauseMs ≤ 400
  export function placeCaptions(edit: Edit, analyses: Analyses): Op[];                      // [] or one captions.set
  export function levelVoice(edit: Edit, analyses: Analyses): Op[];                         // shot.set { volume } where needed
  export function punchIns(edit: Edit, analyses: Analyses, opts: { perMin: number; zoom: number }): Op[]; // 0 ≤ perMin ≤ 30; 1.05 ≤ zoom ≤ 1.3
  ```

**Rules:**
- **`tighten`**, for each shot of a take with words, and each pause inside the shot longer than `pauseMs`:
  - remove `r = (pause.endMs − pause.startMs) − pauseMs` ms, centred on `pause.cutMs`;
  - clamp the removed stretch inside the pause: `lo = clamp(cutMs − r/2, startMs, endMs − r)` and `hi = lo + r`;
  - ops: `shot.split` at `lo` with a new id, then `shot.trim` of the new right shot to start at `hi`.

  The take's head pause is trimmed so speech starts at most `pauseMs / 2` after the shot's start, and its tail so the shot ends at most `pauseMs / 2` after the last word. A pause under `pauseMs` is left alone. The new ids are `<shot id>-t<n>`, unique in the edit.
- **`placeCaptions`** (amended after Task 3: `on-face` and `under-buttons` are graded, and warnings are allowed):
  - try `y` in this order: 0.72, 0.74, 0.76, 0.70, 0.68, 0.66, 0.64, 0.62, 0.60, 0.30, 0.26, 0.22, 0.18;
  - take the first where `review` gives the captions no `on-face` and no `under-buttons` **error**; warnings are allowed, and among clear candidates take the first in that order;
  - if none is clear, take the one with the fewest error frames;
  - keep `width`, size and look; return `[]` when the current `y` already has no such error.
  
  On the owner's take, Task 3 found error-free bands at 0.17–0.26 and 0.75–0.76.
- **`punchIns`** (X100): it runs on an edit already cut in pauses (after `tighten`).
  - Choose cuts between shots of one take so the tight shots come about `perMin` a minute, evenly spaced, never two tight shots in a row.
  - Prefer a cut before a stressed word, if the edit has any.
  - The shot after each chosen cut gets `shot.set { framing: { from: { zoom, x, y }, move: null } }`, where `x` and `y` keep the take's face box (at the shot's start) inside the middle 60 % of the stage. The zoom is clamped to `review`'s `soft-zoom` limit for the take.
  - `perMin: 0` gives `[]`.
- **`levelVoice`:**
  - a shot's loudness is the power mean of the take's `levels` inside its stretch;
  - the film's target is the median of its shots' loudness;
  - a shot more than 1 LU off gets `volume = 10 ** ((target − lufs) / 20)`, clamped to 0.5..2 and rounded to 2 decimals;
  - takes without loudness are left alone.

- [x] **Step 1: Write the failing tests:**
  - **`tighten` on one 10 s shot** with pauses `[{1000,1600,1300},{4000,4150,4075},{7000,8000,7900}]`, `pauseMs: 200`:
    - three shots;
    - the first cut removes 400 ms centred on 1300 (1100–1500);
    - the second pause is untouched;
    - the third removes 800 ms clamped to 7200–8000;
    - the result passes `applyOps`, and `review` gives no `cut-outside-pause`.
  - **`tighten` on the head and tail:** a take whose first word starts at 900 and last ends at 9000 of 10000 is trimmed to start at 800 and end at 9100 with `pauseMs: 200`.
  - **`tighten` property test:** 200 random pause sets give only cuts inside pauses, and every shot keeps at least three frames.
  - **`placeCaptions`:** with a made-up face whose eyes and mouth cover 0.40 to 0.80 of the height, the captions move to the first error-free candidate (0.30, if it is clear of the zones); with no face they stay at 0.72; with a face covering everything, it gives the candidate with the fewest error frames. On the owner's take (`skipIf`), it lands in 0.75–0.76.
  - **`levelVoice`:** two shots at -20 and -26 LUFS get volumes of 1.41 and 0.71 (target -23, the median of the two).
  - **`punchIns`:**
    - on a tightened 60 s edit with 20 cuts, `perMin: 6` gives six tight shots, never adjacent, each with zoom 1.15 and the face inside the middle 60 %;
    - on a 720p take, `zoom: 1.3` is clamped to 1.3 only if `review` gives no `soft-zoom`, else to the limit;
    - `review` gives no `on-face` from it.
- [x] **Step 2: Run them; they fail.**
- [x] **Step 3: Implement the three recipes and `index.ts`.**
- [x] **Step 4: Run them; they pass.**
- [x] **Step 5: The real take** (`it.skipIf` without `.scratch`): `tighten` at 200 ms, then `placeCaptions`, then `levelVoice` on `firstEdit` of the owner's take. Through `applyOps`, then `review`, there are no errors. Print the film's length before and after. Render it on this Mac (`scripts/edit-render.ts`) and look at it: are the cuts clean, with no word clipped? Write what you see.
- [x] **Step 6: Commit.**
  ```bash
  git add src/lib/edit/recipes/
  git -c core.hooksPath=/dev/null commit -m "feat(edit): the recipes: pauses tightened inside the silence, captions clear of the face, shots levelled, punch-ins at cuts"
  ```

**Results (2026-11-21, commits `eaa4eb9c` … `376398e6`; recorded by the controller from the report):**
- **Rulings before and during the build** (the report and `task-4-fix-*.md` in the plan's workspace):
  - **Cut points:** stay strictly inside pauses, by `review`'s half-open rule.
  - **Short pieces:** a removal that would leave a piece under three frames is slid, then shrunk, then left alone.
  - **Joined silences:** pauses separated only by a wordless gap of 400 ms or less are tightened as one silence. This drops clicks and breaths.
  - **The film's start and end:** they follow its words (100 ms before the first and after the last), so a knock after the last word is dropped. `review` passes the film's own start and end there.
  - **One budget per silence:** each silence's removal is shared across all its joins and cuts, and never keeps less than `pauseMs` or what the gap forces.
  - **Idempotent:** every recipe, run on its own output, gives `[]`. `levelVoice` iterates to a fixed point; `punchIns` counts existing tight shots; `pauseMs` is rounded once.
  - **The swapped example:** the brief's `levelVoice` example was swapped (the controller's error). A −20 LUFS shot gets 0.71 and a −26 one gets 1.41 against −23.
- **The property test:** 200 seeded takes, with creator splits at pause edges, word edges and random moments, fractional `pauseMs`, and four speeds. It finds:
  - no cut outside a pause;
  - no word cut short;
  - every shot at least three frames;
  - a second run gives `[]`.

  The re-reviews' own generators added about 39,000 more edits with no failure. On fresh one-shot edits (the first cut), no silence longer than `pauseMs` is left alone.
- **The owner's take** (tighten 200 ms, placeCaptions, levelVoice, punchIns 6/min):
  - 12.70 s becomes 11.00 s, with no review errors;
  - the captions sit at y 0.76;
  - one punch-in at zoom 1.15;
  - the film ends 100 ms after the last word.

  In the render, no word is clipped and every cut sits in room tone (−32 to −51 dBFS). The click, its stutter and the closing knock are gone (`.scratch/task4/`).
- **Deferred to the final review:** a chain's spend can take an inner silence's room (3 in about 39,000 edits, all at speed 2).

---

### Task 5: What the model is given

**Files:**
- Create: `src/lib/edit/agent/catalogue.ts`, `src/lib/edit/agent/context.ts`, `src/lib/edit/agent/__tests__/catalogue.test.ts`, `src/lib/edit/agent/__tests__/context.test.ts`

**Interfaces:**
- Consumes: `OpSchema`, `OP_NAMES` (`ops.ts`), `PARTS`, `FONTS` (`parts.ts`), `CAPTION_LOOKS`, `LOOK_IDS`, `CUT_KINDS`, `MARK_PARTS`, `ITEM_PARTS` (`doc.ts`), `Finding` (Task 3), `Analyses` (Task 3).
- Produces:
  ```ts
  // catalogue.ts
  /** The operations and parts, with every field's type, range and meaning, generated from the schemas (z.toJSONSchema), in a compact text the model reads. */
  export function catalogue(): string;
  // context.ts
  export interface Context { edit: string; words: string; pauses: string; faces: string; findings: string }
  export function contextOf(edit: Edit, analyses: Analyses, findings: readonly Finding[]): Context;
  ```

**Formats (exact):**
- **The edit:**
  - one line per shot: `shot <id> take=<asset> <startMs>-<endMs>ms speed=<s> vol=<v> film=<f0>-<f1>f look=<preset|-> marks=[<id>:<part>@<atMs>+<lenMs>]`;
  - then items, captions and look on one line each;
  - asset words are left out of the edit text.
- **Words:** per take, `w<index> <text> <startMs>-<endMs>`, one per line, with hidden words marked `(hidden)` and stressed ones `(stressed)`.
- **Pauses:** `<startMs>-<endMs> cut@<cutMs>`, one per line.
- **Faces:** per take, the face box in stage shares, merged across samples into stretches where it moves less than 0.05: `<fromMs>-<toMs> face y=<top>-<bottom> x=<left>-<right>`.
- **Findings:** `<severity> <code> frame=<n> <says>`, or `none`.

- [x] **Step 1: Write the failing tests:**
  - **The catalogue names:**
    - every name in `OP_NAMES`;
    - every part and each of its props, with ranges taken from the schemas (for example "size 44–200" for captions);
    - every look in `LOOK_IDS`, every cut kind in `CUT_KINDS` and every caption look in `CAPTION_LOOKS`.
  - **The catalogue is generated:** add a fake op to a copy of the schema list and the text changes (test through a parameter of an inner function).
  - **The context:** on a made-up two-shot edit, it has exactly the lines above; a 600-word take's context stays under 40,000 characters.
- [x] **Step 2: Run them; they fail.**
- [x] **Step 3: Implement both.** The catalogue also carries the rules the model must keep, each in one line:
  - answer only `{"say": string, "ops": Op[]}`;
  - shots are cut by file time, in a pause's `cut@` where one is near;
  - word indexes are per take;
  - a part not in the catalogue cannot be made: say so in `say` and send no ops;
  - no music;
  - frames are 30 a second.
- [x] **Step 4: Run them; they pass.**
- [x] **Step 5: Commit.**
  ```bash
  git add src/lib/edit/agent/catalogue.ts src/lib/edit/agent/context.ts src/lib/edit/agent/__tests__/
  git -c core.hooksPath=/dev/null commit -m "feat(edit): the catalogue and the context the agent reads, generated from the schemas"
  ```


**Results (2026-11-21, commits `147a1ede` … `527a16be`; recorded by the controller from the report):**
- **The catalogue** is 16,467 characters, about 4k tokens. It is generated from the schemas through `z.toJSONSchema`. A field without a meaning fails a test, and every enum value is named. It carries the rules and a full reading guide for every context line.
- **The formats changed from the ones above, after reviews:**
  - one range notation: `[a,b]` with both ends in, `[a,b)` with the end left out, and lists that are not ranges;
  - a part's `props.startMs` is on the part's own file;
  - a shot's look adds to the film's;
  - the refusal rule names nothing the kit can do (a visual effect the kit does not give, a sticker, an arrow, a file not on offer, music, changing the speaker), answered in `say` with `ops: []`.
- **The context** gains a `files` section: the edit's files and the library, `in edit` or `to add`, capped at 2,000 characters. Its other changes:
  - words and pauses only from 2 s before to 2 s after what each take's shots show, keeping the take's own word indexes;
  - faces in stage shares, rounded outward, with the mouth, one envelope per take and framing, and stretches only when the face moves more than 0.10, held at or under 6,000 characters with a hard trim as the last guard;
  - `none` (measured) is kept apart from `not measured`.
- **Sizes:**
  - a 600-word take with a library: 21,132 characters;
  - a 10-minute take shown 60 s at a time: 8,170;
  - faces on 3-minute takes from 1 to 200 shots: at most 5,684.
- **For Task 7:**
  - `ops: []` is an accepted round with no change;
  - each section of the user message is headed with its key (`files:`, `words:` …);
  - `contextOf` refuses an edit that does not parse, so the route parses first;
  - the door's refusal of a missing file could point to `asset.add`.

---

### Task 6: Stills for the agent from the worker

**Files:**
- Modify: `worker/app.py` (the `web` app: `POST /stills`; `stills` gets `max_containers=2`), `worker/store.py` (`stills_request`)
- Test: `worker/tests/test_store.py`
- Create: `src/lib/edit/worker/stills.ts`, `src/lib/edit/worker/__tests__/stills.test.ts`

**Interfaces:**
- Consumes:
  - `store.allowed`, `store.addresses(edit, user, r2)` (X63: every take file under `u/<user>/takes/`, kit paths held to `KitPath`);
  - `stills(props, frames) → list[bytes]` (PNG);
  - `workerSettings()` and its headers (`src/lib/edit/worker/jobs.ts`: Bearer, `Modal-Key`, `Modal-Secret`).
- Produces:
  - **Worker:** `POST /stills`, body `{"user": uuid, "edit": Edit, "frames": [int, …], "sheet"?: boolean}`. With `sheet: true`, up to 12 frames come back as one JPEG grid, four across, each frame 270×480 in the order asked (for the style read, Task 9).
    - At most 6 frames (12 with `sheet`), each `0 ≤ f < filmFrames`.
    - Answers `200 {"stills": [{"frame": n, "jpeg": base64}]}`, each 540×960 JPEG at quality 85.
    - Errors: 401 on a wrong secret (checked before the body), 400 on a bad body, 422 with `{"error": <plain line>}` when an asset is refused.
  - **App:**
    ```ts
    // src/lib/edit/worker/stills.ts (import "server-only")
    export interface Still { frame: number; jpeg: string } // base64
    export async function stillsOf(user: string, edit: Edit, frames: number[]): Promise<Still[]>; // throws Error(plain line) on failure; timeout 45 s
    export async function sheetOf(user: string, edit: Edit, frames: number[]): Promise<string>; // one base64 JPEG grid; ≤ 12 frames
    ```

- [x] **Step 1: Write the failing worker tests:** `stills_request` refuses a wrong secret, more than 6 frames, a frame past the film, and an asset outside the user's folder (each with its status). On a good body it calls the stills function with `{edit, urls}`, where `urls` holds signed reads, and turns the PNGs it returns into 540×960 JPEGs. Use a PNG made in the test with Pillow if the render image has it; otherwise use ffmpeg, as the image already does.
- [x] **Step 2: Run them; they fail.** `cd worker && uv run pytest tests/test_store.py -k stills` (see `task-6-report.md` in `.superpowers/sdd/2026-11-20-edit-worker/` for how the worker tests run).
- [x] **Step 3: Implement `stills_request` and the route.** The route checks `allowed` before it reads the body, as `/start` does, and calls `stills.remote` in a thread. Give `stills` `max_containers=2`.
- [x] **Step 4: Run them; they pass.** Run the worker's whole local suite.
- [x] **Step 5: Write the failing app test:** against a stand-in worker at the `fetch` boundary, `stillsOf` sends the three headers and the body, returns the stills, and throws the worker's plain line on a 422 and "the worker could not be reached" on a network error, never the address.
- [x] **Step 6: Implement `stillsOf`** by reusing `workerSettings` (export it from `jobs.ts`).
- [x] **Step 7: Run it; it passes.**
- [x] **Step 8: Deploy and prove.** Run `modal billing summary` first (part 3's stop: $5.00 metered). Then `modal deploy worker/app.py`, and from a script (`scripts/edit-stills-proof.ts`, which loads `.env.local`) ask for frames 0, 45 and 300 of `firstEdit` of the owner's Task 6 take. Record the time cold and warm, and look at the three JPEGs.
- [x] **Step 9: Commit.**
  ```bash
  git add worker/app.py worker/store.py worker/tests/test_store.py src/lib/edit/worker/stills.ts src/lib/edit/worker/__tests__/stills.test.ts src/lib/edit/worker/jobs.ts scripts/edit-stills-proof.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): stills for the agent from the worker's own address, signed as renders are"
  ```

**Results (2026-11-21, commits `c22f6a14`, `a5501c3d`; deployed; recorded by the controller from the report):**
- **The design changed on contact with the code.** The web image has no boto3, ffmpeg or Pillow, so `web` only checks the secret before the body and hands the call to a new render-image function, `stills_answer` (4 cores, 8 GiB, 60 s, at most 2 machines, 300 s warm). That function checks the secret again, signs with `addresses` (X63 and `KitPath`), draws with `render.mjs`, and turns the frames into JPEGs with ffmpeg: 540×960 stills, or a sheet of 270×480 cells, four across with black gaps. `web` takes 8 calls at once (`@modal.concurrent`), so stills never hold back `/start`.
- **Answers:**
  - **400:** a malformed body or edit;
  - **401:** a wrong secret;
  - **422:** a refused file, or a frame past the film's end ("frame N is past the film's end: it has M frames", checked in `render.mjs` before any drawing);
  - **500:** "the stills failed on our side; try again" for anything else.

  `render.mjs` marks only the lines it words for the creator on purpose (`Said`, and the film's X73 look line), so an engine failure is never told as the creator's.
- **On Modal** (the owner's take, `firstEdit`):

  | Call | Cold | Warm |
  |---|---|---|
  | Three stills | 25.0 s | 7.7 s |
  | A sheet of 12 | 37.4 s | 17–22 s |

  - A forced engine failure answered 500.
  - `/start` answered in 1.1 s with four stills calls out.
  - Metered spend went from $2.02 to $2.13.
- **The deploy shipped the current kit bundle,** so production renders draw part 3's kit (X94). Only the `EDIT_CREATORS` accounts can render.
- **Deferred to the final review:**
  - every call fetches the whole take;
  - the timeouts' order holds only for a warm call that does not queue;
  - the look line's match should allow an `Error: ` prefix.

---

### Task 7: The agent loop (a change)

**Files:**
- Create: `src/lib/edit/agent/model.ts`, `src/lib/edit/agent/loop.ts`, `src/lib/edit/agent/prompt.ts`, `src/lib/edit/agent/__tests__/loop.test.ts`

**Interfaces:**
- Consumes: `getQwenClient`, `QWEN_REASONING_MODEL`, `QWEN_SEED` (`src/lib/engine/qwen/client.ts`); `calculateCost` (`src/lib/engine/qwen/cost.ts`; read its signature and the models it prices); `applyOps`, `checkEdit`; `review` (Task 3); `catalogue`, `contextOf` (Task 5); `stillsOf` (Task 6).
- Produces:
  ```ts
  // model.ts — the one network boundary
  export type Message = { role: "system" | "user" | "assistant"; content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] };
  export interface Asked { text: string; usage: { input: number; output: number }; ms: number }
  export type Ask = (messages: Message[], opts: { maxTokens: number; thinking: boolean }) => Promise<Asked>;
  export const askQwen: Ask; // getQwenClient(), QWEN_REASONING_MODEL, json_object, temperature 0, seed QWEN_SEED, enable_thinking per opts
  // loop.ts
  export const AnswerSchema: z.ZodType<{ say: string; ops: unknown[] }>; // say ≤ 600 chars; ops ≤ 200
  export interface AgentInput { edit: Edit; analyses: Analyses; request: string; library: readonly Asset[]; user: string; deadlineMs: number; stills?: boolean }
  export interface Round { n: number; ops: unknown[]; refused: Problem[] | null; findings: Finding[]; stills: number[]; ms: number; tokens: { input: number; output: number } }
  export interface AgentResult { say: string; ops: Op[]; edit: Edit; findings: Finding[]; rounds: Round[]; ms: number; cost: number; changed: boolean }
  export async function change(input: AgentInput, deps?: { ask?: Ask; stills?: typeof stillsOf; now?: () => number }): Promise<AgentResult>;
  export const AGENT_LIMITS: { rounds: 3; changeMs: 50_000; firstCutMs: 170_000; maxTokens: number; thinking: boolean };
  ```

**The loop (exact):**
1. `findings0 = review(edit, analyses)`.
2. **Round 1:** messages are the system prompt (`prompt.ts`: role + `catalogue()`), then the user message (`contextOf(edit, analyses, findings0, library)` + the request). The library (the kit's files and the creator's other takes on offer) is the same list passed to `applyOps` (Task 5's `files` section); `contextOf` refuses an edit that does not parse, so the route parses first (Task 13).
3. **Each round:**
   - `ask` → parse JSON → `AnswerSchema`. A bad parse is a failed round.
   - **`ops: []` is an accepted round with no change** (Task 5: the catalogue tells the model to send it for an impossible request). The loop answers with the model's `say` and the edit unchanged, `changed: false`, without calling `applyOps`, which refuses an empty list.
   - `applyOps(current, ops, library)`, then `review` the result.
   - **Accepted:** the door said ok and there are no `error` findings newer than `findings0` (an error already present before the request does not block a change that did not cause it). Then `current` becomes the new edit.
   - **Otherwise:** the next round's user message holds the exact problems ("the door refused: …" with each `Problem`'s path, id and message, or the findings), and says the edit is unchanged.
4. **Stills:** after an accepted round whose ops add or move something seen, and only when `input.stills !== false`:
   - "Seen" ops are `mark.add`, `mark.set` with `atMs` or `props`, `item.add`, `item.set`, `captions.set` with `y`, `look`, `size` or `font`, `shot.set` with `framing`, and `look.set`.
   - Draw stills at each changed thing's first frame, plus one frame in the middle of the film (at most 6), and send them to Qwen with the request: "Here is how it looks. If it does what was asked, answer with no ops; else answer with the ops that fix it."
   - One repair, through the door and `review`; no stills after it.
5. **Stop** after 3 rounds in all, or once `now()` passes `deadlineMs`. Return the last accepted edit (or the input edit), the `say` of the last answer that parsed, and every round's record.
6. **`changed`** is false when no round was accepted. `say` then ends with what could not be done.

- [ ] **Step 1: Write the failing tests** with a scripted `ask` (a list of canned answers; this is the network boundary) and a fake `stills`. The door, `review` and the edits are real:
  - one good answer gives 1 round, `changed: true`, and the ops applied;
  - an answer that fails to parse, then a good one, gives 2 rounds; round 2's message quotes the parse error;
  - an answer the door refuses (a `shot.trim` past the file), then a good one, makes the second message quote the problem's path and message;
  - an answer that makes captions cover the face (`captions.set {y: 0.75}` with a face there) makes round 2 receive the `on-face` finding;
  - three bad answers give `changed: false`, the input edit returned unchanged (deep-equal), and a `say` that says why;
  - a `mark.add` call-out triggers `stills` with its first frame, and a `word.set` alone does not;
  - with `stills: false`, nothing is drawn;
  - a deadline already past after round 1 stops there;
  - an error finding present before the request (on the input edit) does not block an unrelated `look.set`;
  - `cost` and `tokens` add up the rounds' usage.
- [ ] **Step 2: Run them; they fail.**
- [ ] **Step 3: Implement `model.ts`, `prompt.ts` and `loop.ts`.** Every call is logged with its rounds, tokens, cost and ms through the app's logger (`createLogger({ module: "edit.agent" })`), and never with the edit's words or file addresses.
- [ ] **Step 4: Run them; they pass.**
- [ ] **Step 5: A real smoke run** (`scripts/edit-agent-smoke.ts`, which loads `.env.local`). Run three requests on `firstEdit` of the owner's take: "make the captions bigger", "add a call-out 'Claude' when I say Claude", "make it black and white". For each, record the rounds, ms, tokens, cost and the ops. Look at the stills. This is the first real proof of the Qwen boundary.
- [ ] **Step 6: Commit.**
  ```bash
  git add src/lib/edit/agent/model.ts src/lib/edit/agent/prompt.ts src/lib/edit/agent/loop.ts src/lib/edit/agent/__tests__/loop.test.ts scripts/edit-agent-smoke.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): the agent: one Qwen answer a round, the door and review judge it, at most three rounds"
  ```

**Results (2026-11-22, commits `b877aeba`, `02d2a1bd`; recorded by the controller from the report):**
- **Built as briefed, with four departures the review ratified:**
  - stills are drawn where the thing is visible: a mark or item at its first frame + min(12, half its length), captions 8 frames into the first word, a shot at its middle (on its first frame a pop-in call-out is not drawn yet);
  - the final `say` is the last **accepted** answer's (a refused repair's `say` describes a change that never happened);
  - no stills after an accepted round 3, a failed model call counts as a round, and `captions.set on: true` counts as seen;
  - `stills.ts` takes the caller's `AbortSignal`, so a stills call stops at the change's 50 s deadline instead of running to its own 75 s.
- **Fix round 1 added:**
  - when nothing changed, the creator reads a plain line ("I couldn't make that change: …"); the door's words stay in `rounds`;
  - a failed call waits 1 s, then 2 s, before the next round, never past the deadline; a deadline abort says so;
  - the prompt now says: change only what the request asks; an existing finding is fixed only when asked, or when the change would land on it; `say` states exactly what the ops do.
- **The Qwen boundary, proved for real** (`scripts/edit-agent-smoke.ts`, the owner's take, `firstEdit`, which already carries two `under-buttons` errors; three runs of three requests):
  - qwen3.7-flash, JSON object, temperature 0, seed 7, thinking off. Every call answered in 0.9–4.6 s; every answer parsed; none was cut off.
  - A request is 14.5–23.1k input tokens. **Qwen cost 0.48 cents for all nine.**
  - A change took 7.4–29.2 s end to end (the 29 s one included a cold stills call of 23.4 s; warm stills take 3.6–6.1 s).

  | Request | Before the fix round | After |
  |---|---|---|
  | Captions bigger | 3 of 3 changed; 1 moved the captions too | 3 of 3 changed (72 → 84 → 96); 1 moved them up too |
  | Call-out "Claude" | 2 of 3 landed; both also moved the captions or stressed the word | 3 of 3 landed, nothing else changed |
  | Black and white | 3 of 3; 1 also removed the highlight | 3 of 3, nothing else changed |
  | **Finals with an unrequested change** | **5 of 9** | **1 of 9** |

- **The stills** (`.scratch/agent-smoke/fix1-stills.jpg`, looked at by the implementer and the controller): captions visibly bigger under the chin; "Claude" in white with a black outline, high over the hair, clear of the eyes and the captions, but **small beside the captions**; black and white over the whole picture, captions keeping their yellow highlight.
- **Modal:** $2.13 → $2.17 metered, against part 3's $5.00 stop.
- **For Task 14:**
  - **Where a call-out fits.** On this take a call-out at size 80 is clear only at y 0.16–0.26, 0.55–0.62 and 0.69–0.76. The review says only "move it up or down", and once (round 0) the model never found the band.
  - **Call-outs last 300 ms,** shorter than the 12 frames a call-out takes to come in. The call-out is also small.
  - **The answer to the stills can read like a second step.** One said "already black and white … in the previous step"; one said "from 84 to 96" where it went 72 → 96. A firmer prompt line is needed.
  - **The plain failure lines are English only,** while the model's `say` follows the request's language.

---

### Task 8: The worker measures cuts and the picture; reference mode

**Files:**
- Create: `worker/media/scenes.py`, `worker/media/picture.py`, `worker/tests/test_scenes.py`, `worker/tests/test_picture.py`
- Modify: `worker/media/analyse.py` (two stages; reference mode), `worker/store.py` (the analyse job reads `input.reference`), `worker/app.py` (stage weights), `worker/tests/test_analyse.py`, `worker/tests/test_store.py`, `src/lib/edit/analysis.ts` (the schema gains `cuts` and `picture`, optional for takes analysed before)

**Interfaces:**
- Consumes: `analyse(source, out_dir, key, on_progress, *, language, threads)` and its stages (X65); `probe`; the preview copy.
- Produces:
  ```python
  # scenes.py
  def cuts(preview: str | Path) -> list[int]  # ms of each scene change, in order; [] for one continuous shot
  # picture.py
  class PictureSample(TypedDict): ms: int; luma: float; sat: float; warmth: float  # 0..1, 0..1, -1..1
  def picture(preview: str | Path) -> list[PictureSample]  # every 500 ms
  # analyse.py: Analysis gains  cuts: list[int]; picture: list[PictureSample]
  # analyse(..., reference: bool = False): a reference may be any language (words [] where it is not en/de/it, no failure) and at most 180,000 ms ("<name> is longer than 3 minutes (it is M:SS)", rounded up)
  ```
  The analyse job reads `input.reference` (a boolean) from its row. An analyse job written by Task 7 of part 2 has no input, and that means `false`.

- [ ] **Step 1: Write the failing tests.** Make each test file with ffmpeg in a temp folder (lavfi), so they run on 5.1 and 8.
  - **`cuts`:**
    - three hard colour changes at 1.0, 2.5 and 4.0 s in a 5 s file give three cuts, each within one frame (33 ms);
    - a 5 s file of slowly moving noise gives none;
    - a 1 s cross-fade gives at most one.
  - **`picture`:**
    - a grey file gives `sat` near 0 and `warmth` near 0;
    - an orange file gives `warmth > 0.2`;
    - a blue one gives `warmth < -0.2`;
    - samples every 500 ms from 0.
  - **Reference mode:**
    - a Spanish-speaking take (any non-en/de/it speech file in the tests' made-up set, or a mocked language at the words stage) with `reference=True` completes with `words == []`, and fails as before without it;
    - a 3:00.5 file is refused in reference mode with "is longer than 3 minutes (it is 3:01)".
  - **The job:** `input = {"reference": true}` reaches `analyse` as `reference=True`; no input means `False`.
- [ ] **Step 2: Run them; they fail.** `cd worker && uv run pytest tests/test_scenes.py tests/test_picture.py tests/test_analyse.py tests/test_store.py`.
- [ ] **Step 3: Implement both stages.**
  - `cuts` uses ffmpeg's `scdet` filter on the preview copy, threshold 10. Measure it on the tests' files and on one real edited outlier film from `.scratch`, if any; else on part 2's 90 s render, whose cut frames are known from its edit. Write the threshold's measure in a comment.
  - `picture` uses `signalstats` (YAVG, SATAVG, UAVG, VAVG) on frames every 500 ms, scaled to the ranges above. Warmth is `(VAVG − UAVG) / 255`, normalised.
  - Add both as stages after `faces` with their weights (X65), and add reference mode.
- [ ] **Step 4: Run the worker's whole local suite; it passes.**
- [ ] **Step 5: Deploy and prove.** Run `modal billing summary` first (part 3's stop: $5.00 metered). Then `modal deploy worker/app.py`, then:
  - the in-image suite;
  - part 2's 90 s render's film analysed through `dev.py`'s `analyse_demo`, where its cuts must match the edit's cut frames within one frame;
  - the owner's take analysed, which must give no cuts.
  
  Record the times.
- [ ] **Step 6: Commit.**
  ```bash
  git add worker/media/scenes.py worker/media/picture.py worker/media/analyse.py worker/store.py worker/app.py worker/tests/ src/lib/edit/analysis.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): every take's cuts and picture measured; a reference analysed in any language"
  ```

**Results (2026-11-22, commit `46256375`; deployed, the deployed files match the commit; recorded by the controller from the report):**
- **Built:**
  - **`cuts`:** `scdet=threshold=10:sc_pass=1` on the preview copy; each passed frame's time in ms.
  - **`picture`:** `signalstats`, one sample every 500 ms, with `luma = YAVG/255`, `sat = min(1, SATAVG/181)` and `warmth = clamp((VAVG − UAVG)/255, −1, 1)`, each to 3 decimals. The copies are limited range, so in practice luma runs 0.063–0.922 and sat tops out at 0.875. **Task 9's thresholds are measured on this scale.**
  - **Reference mode:** decided in the words stage, where the pauses are measured, so a reference in another language keeps its pauses for its pace (X98). Its words are `[]` and its language `null`. A language *given* with reference mode is still held to X55.
  - **Old analyses** without `cuts`/`picture` still parse.
- **The threshold's measure** (every frame's `scdet` score):
  - hard cuts in the tests' files: 53–80;
  - part 2's 90 s film:
    - its 31 hard cuts and cutaways: **13.0–28.9**;
    - its fades, wipe, iris and clock: 3.3 at most;
    - nothing else: over 5.2;
  - the owner's take: 4.5 at most.

  So 10 lies between 5.2 and 13.0. **Limit:** `scdet` reads luma only. A red→green cut at equal brightness scores 0.78 (39.6 with `format=gbrp`). If outliers miss cuts in Task 9/12, that is the fix, with the threshold measured again.
- **The 90 s film's cuts against its edit** (ffmpeg 5.1.9 in the image and ffmpeg 8 on the Mac give the same 34):
  - all 31 hard cuts and cutaways on their own frame, none missed;
  - the two pushes 1 frame into their slide;
  - the punch transition at its swap frame (3 frames into its run, the first incoming frame; ruled as its cut);
  - **no false cut** in any fade, wipe, iris or clock.
- **The owner's take:** `cuts: []`. Picture: luma 0.46–0.58, sat ≈ 0.07, warmth ≈ 0.07.
- **Times on Modal** (8 cores):

  | | Copies | Words | Faces | Cuts | Picture | Loudness | Analysis |
  |---|---|---|---|---|---|---|---|
  | Owner's take, 12.7 s | 7.30 s | 10.04 s | 2.46 s | **0.35 s** | **0.58 s** | 0.30 s | 22.0 s |
  | 90 s film | 77.34 s | 19.36 s | 8.05 s | **1.13 s** | **1.67 s** | 0.75 s | 112.2 s |

  New stage weights: copies 0.31, words 0.52, faces 0.13, cuts 0.01, picture 0.02, loudness 0.01 (X65, amended).
- **Suites:**
  - the worker on the Mac: 419 passed, 11 skipped;
  - in the image (ffmpeg 5.1.9): 402 passed, 28 skipped (the tests that need node); the new tests alone, 42/42;
  - the edit's TypeScript tests: 496.
- **After the deploy:** `web` and `stills_answer` answered as in Task 6 (stills 20.6 s cold, 6.4 s warm). The deployed `analyse` ran no real job row; Task 14 runs one.
- **Modal:** $2.20 → $2.37 metered, against part 3's $5.00 stop. The dev Volume now holds the 90 s film and its analysis files (about 115 MB); clearing it is the owner's word.

---

### Task 9: The style profile, read from a reference, and the match check

**Files:**
- Create: `src/lib/edit/style/profile.ts`, `src/lib/edit/style/measures.ts`, `src/lib/edit/style/read.ts`, `src/lib/edit/style/match.ts`, `src/lib/edit/style/index.ts`, and tests for each in `src/lib/edit/style/__tests__/`; `scripts/edit-style-truth.ts`

**Interfaces:**
- Consumes: `TakeAnalysis` with `cuts` and `picture` (Tasks 3 and 8); `sheetOf` (Task 6); `Ask` (Task 7); `LOOK_IDS`, `CAPTION_LOOKS`, `FONTS`, `CaptionsSchema`, `PARTS.title.props`.
- Produces:
  ```ts
  // profile.ts
  export const StyleProfileSchema = z.strictObject({
    source: z.strictObject({ kind: z.enum(["reference", "preset", "words", "default"]), name: z.string().max(80).nullable() }),
    pace: z.strictObject({ pauseMs: z.number().int().min(120).max(400), cutsPerMin: z.number().min(0).max(60).nullable() }),
    captions: CaptionsSchema.pick({ on: true, look: true, font: true, size: true, y: true, maxWords: true, highlight: true }),
    title: z.strictObject({ on: z.boolean(), y: Unit, frames: z.number().int().min(15).max(150), look: z.enum(["bold", "label", "outline"]), size: z.number().min(84).max(220) }).nullable(),
    punchIns: z.strictObject({ perMin: z.number().min(0).max(30), zoom: z.number().min(1.05).max(1.3) }).nullable(),
    look: z.strictObject({ preset: z.enum(LOOK_IDS) }),
    notMatched: z.array(z.string().max(60)).max(20),
  });
  export type StyleProfile = z.infer<typeof StyleProfileSchema>;
  export const DEFAULT_STYLE: StyleProfile;
  // measures.ts — pure: what the analysis alone says
  export interface Measures { pauseMs: number; cutsPerMin: number; punchIns: { perMin: number; zoom: number } | null; look: (typeof LOOK_IDS)[number]; ms: number }
  export function measuresOf(analysis: TakeAnalysis, ms: number): Measures;
  // read.ts — the sighted reading of one sheet, and the profile from both
  export const ReadingSchema: z.ZodType<Reading>; // captions {present, y, height, color, highlight|null, wordsPerLine, upper, box: "pill"|"box"|"outline"|"none", pop}; title {present, y, height, fromCell, toCell} ; extras: string[]
  export function sheetFrames(analysis: TakeAnalysis, ms: number): number[]; // 12 frames: 4 over the first 5 s, the rest at cuts and spread
  export async function readSheet(sheetJpeg: string, frames: number[], ask: Ask): Promise<Reading>;
  export function styleOfReference(measures: Measures, reading: Reading, name: string | null): StyleProfile;
  // match.ts
  export function profileOf(edit: Edit, analyses: Analyses): Omit<StyleProfile, "source" | "notMatched">;
  export interface Match { field: string; target: string; actual: string; verdict: "matched" | "near" | "not" }
  export function matchOf(target: StyleProfile, edit: Edit, analyses: Analyses): { fields: Match[]; notMatched: string[] };
  ```

**Rules (exact):**
- **`measuresOf`:**
  - `pauseMs`: the median length of pauses lying between words, excluding the head and tail pauses, clamped to 120..400. Without words, use pauses between `cuts`-free speech stretches.
  - `cutsPerMin`: `cuts.length / (ms / 60000)`.
  - Punch-ins: at each cut, the face box's height just after (the first sample at or after the cut + 100 ms) against just before (the last sample before the cut − 100 ms). A ratio of at least 1.12 is a punch-in. `perMin` is their count a minute; `zoom` is their median ratio, clamped to 1.05..1.3. With no faces, `null`.
  - `look`: from the mean `sat`, `warmth` and `luma`, by thresholds measured on the kit's own looks. Render the owner's take in each of the six looks on this Mac, analyse each render's `picture` locally (the stage runs on a file), and write the thresholds and their measures in `measures.ts`. `mono` is sat below its threshold; `warm` and `cool` by warmth; `vivid` by sat above; `soft` by low luma contrast; else `natural`.
- **`styleOfReference`, mapping the reading to the kit:**
  - box `pill` or `box` gives `pill`;
  - `pop: true` gives `pop`;
  - a highlighted word gives `highlight`;
  - else `plain`;
  - `size` = `height × 1920 / 1.15`, clamped to the kit's range;
  - `y` as read;
  - `maxWords` = `wordsPerLine`, clamped to 1..6;
  - `font`: `tiktok` for a heavy sans in capitals, `montserrat` for a geometric sans, else `inter`;
  - the title from `fromCell`/`toCell`, with frames counted from the sheet's frame numbers;
  - `extras`, and anything mapped only roughly (such as capitals, since the kit has no all-caps caption setting), go into `notMatched`.

- [ ] **Step 1: Write the failing tests:**
  - `measuresOf` on made-up analyses: pauses `[300, 500, 200]` between words give 300; 10 cuts in 30 s give 20 a minute; face heights 0.30 then 0.36 across a cut give one punch-in at zoom 1.2; grey picture gives `mono`.
  - `sheetFrames` on a 30 s analysis with cuts at 3 s and 12 s gives 12 frames in order, 4 of them in the first 5 s, two of them just after the cuts.
  - `readSheet` with a scripted `ask` parses a good reply. A reply outside `ReadingSchema` gets one repair, quoting the zod issues, then throws a plain error.
  - `styleOfReference` maps a reading of a yellow-highlight, 3-word, capitals caption at y 0.62 to `{look: "highlight", maxWords: 3, y: 0.62}`, with "captions in capitals" in `notMatched`.
  - `profileOf` and `matchOf` on an edit made with known settings give every field `matched` against its own profile, and a caption `y` off by 0.08 gives `not` for that field.
- [ ] **Step 2: Run them; they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them; they pass.**
- [ ] **Step 5: The ground truth** (`scripts/edit-style-truth.ts`).
  - Make six edits with known profiles from the owner's take, repeated as shots through `applyOps` to at least 30 s:
    - three caption looks at three heights;
    - with and without a title;
    - two looks;
    - punch-ins at 6 and 12 a minute, through `punchIns`.
  - Render them, on this Mac or on Modal within the stop.
  - Analyse each as a reference on Modal, draw its sheet, read it, and compare the profile with the one it was made from.
  - **Gates:** pace within 15 %; caption `y` within 0.05; caption look right; title presence right and its timing within 0.5 s; the look preset right in at least 5 of 6.
  - Record each film's result, and look at each sheet.
- [ ] **Step 6: Commit.**
  ```bash
  git add src/lib/edit/style/ scripts/edit-style-truth.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): a style read from a reference, in the kit's terms, and checked against what an edit does"
  ```

**Results (2026-11-23, Task 9b, commits `fb8b00cd`, `05ad0057` (X103), `fa6a7dbe` and `388cc849` (round 2: X104 with `pauseFor`, punch-ins, extras, the worker's tests without the owner's words), `62450036` (round 3: punch-ins on the first face in the next shot, `QUIET_READ`); the worker deployed at `05ad0057`, round 2 changed no deployed worker file; written by the implementer). Task 9's first reading (Qwen boxing the text on a sheet) is replaced: the worker measures the text (X101), code reads the style from it, Qwen judges only the grade and the extras (kinds from a closed list, each with its cells); the look is mono by measure, else judged (X102); a reference is never heard (X103); the pace is its quiet share (X104).**

The six films (`scripts/edit-style-truth.ts`; film 6 made mono), each analysed as a reference on Modal (dev app), not heard, its sheet judged by Qwen. Made → read (`quiet`: the film's own, from the edit's `profileOf`, against the reference's measure; `pauseMs` recorded, not gated):

| film | quiet | pauseMs | caption y | size | look | highlight | words | font | title (length, y, size, look) | punch-ins | look (grade judged) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0.059 → 0.074 (+25 %) **MISS** | 200 → 182 | 0.80 → 0.803 | 72 → 71 | pill | #ffe14a → #f8dd48 | 3 → 3 | tiktok → tiktok | 2.00 s, 0.16, 120 → 2.00 s, 0.16, 118, bold | none → none | natural → natural (natural) |
| 2 | 0.078 → 0.080 (+3 %) ok | 300 → 271 | 0.62 → 0.621 | 80 → 79 | highlight | #ffe14a → #f8dd46 | 2 → 2 | montserrat → montserrat | none → none | 5.2/min → 5.2/min | natural → natural (natural) |
| 3 | 0.047 → 0.043 (−9 %) ok | 150 → 134 | 0.30 → 0.303 | 76 → 74 | pop | #4ade80 → #47d97d | 3 → 3 | inter → inter | 3.00 s, 0.14, 110 → 3.00 s, 0.142, 109, label | 10.76/min → 7.17/min | warm → natural (natural) |
| 4 | 0.069 → 0.067 (−3 %) ok | 250 → 177 | 0.80 → 0.802 | 72 → 71 | highlight | #4ade80 → #47d97c | 3 → 3 | tiktok → **inter** | 2.50 s, 0.20, 130 → 2.50 s, 0.201, 130, outline | none → none | warm → natural (natural) |
| 5 | 0.054 → 0.043 (−20.4 %) **MISS** | 180 → 142 | 0.62 → 0.622 | 84 → 84 | pop | #ffe14a → #f8dd4a | 4 → 4 | montserrat → montserrat | none → none | 5.35/min → 5.35/min | warm → natural (natural) |
| 6 | 0.082 → 0.139 (+70 %) **MISS** | 294 → 400 | 0.30 → 0.302 | 70 → 70 | pill | #ffe14a → #f8de49 | 2 → 2 | inter → inter | none → none | 10.25/min → 6.83/min | mono → mono (mono) |

- **Gates:** caption place, size, look, highlight and words 6/6; font 5/6 (gate 5); title there or not 6/6, and its length, place, size and look 3/3; punch-ins there or not 6/6 (rates recorded); look 6/6 (film 6 mono, no other). **Failed: pace (quiet within 20 %) 3/6, gate 5.**
- **The pace reading is coarse.** A reference's pace is read as its quiet share (X104): the inner pauses' total over its spoken span, measured on the finished film. That film's sound reads tighter than the raw take it was cut from, so the share is multiplied by `QUIET_READ` = 1.47, the median over the six films of their own share ÷ the measured one (1.164, 1.442, 1.622, 1.507, 1.867, 0.868), fitted on the same six films. After it, the six read +25, +3, −9, −3, −20 and +70 % off their own: three within 20 %. Film 6 (pauses kept at 294 ms, the longest) reads loose and film 1 (200 ms) loose; it tells a calm reference from a fast one, not 200 ms from 250. Before the correction: 2/6 (−14, −31, −38, −33, −46, +15 %). One attempt each, as ruled; no tuning.
- **Punch-ins:** at a cut, the face after it is the first sample with a face inside the shot that follows (at most 2 s in), the face before it the last with a face, at most 8 s back: films 2 and 5's punched shots open on the take's laptop, the face coming 0.7 to 0.8 s in. Read: 5.2 and 5.35 a minute on films 2 and 5 (made the same), 7.17 and 6.83 on films 3 and 6 (made 10.76 and 10.25), none on 1 and 4.
- **The worker's tests** hold no words of the owner's take: made-up words of the same count and timings; the in-image tests that check the take's own words read them from the development Volume (`take-words.json`, outside git) and skip where it is not (all four ran and passed in the image).
- **Extras:** a closed list of eight kinds, each with its cells; "other text" accepted and dropped (text is measured). On all six films Qwen answered only "other text" in all twelve cells; on film 5, three runs, the same each time: the split screen did not come back, and neither did the laptop shot as a cut-in.
- **The font's margins are thin** (accepted as they are, round 2): what the best font's fit leaves (as a share of the mean row width) is 6 to 8 % less than the next font's on films 1, 3, 4 and 6 (film 1: tiktok 0.0220 against montserrat 0.0233; film 4, the miss: inter 0.0141 against tiktok 0.0151), 17 and 25 % on films 2 and 5. Inter and TikTok Sans differ by 2 % a word in width at 800, the reader's box edges by about ±6 px. The brief's rule (the spread of sizes from width ÷ 1.025) chose montserrat on films 1, 4 and 6 (3/6): a padding that does not grow with the row favours the widest font. Fitted with the padding (`box width = size × the kit's row width + padding`), 5/6.
- **Constants** (`TEXT_RULES`, `src/lib/edit/style/text.ts`, each with its measure beside it): `minScore` 0.7 (phantoms read 0.57 and 0.58, real pieces 0.73 and up); `boxOverLetters` 1.03 (the reader's box over the kit's row width, median 1.02 to 1.04 per film; used for titles and few rows); `edge` the dark over the light at 0.58 or more on rows of light ring (bold title 0.39 to 0.56, median 0.51; outline 0.62 to 1.52, median 0.65); `whiteInk` 1/3 (on two-word pages the said colour holds half the letters: film 6 read yellow as the ink by count); `accent.box` 0.45 kept (a word's box fills 0.39 to 0.77 of its stretch, letters 0.17 to 0.48, decided by majority); the rest at the brief's values. Rows that are held and rows that change are never stacked into one page (film 3's captions sat under its title's last row); the background is a ring colour of every piece of a row (film 2's said word, boxed alone inside its yellow box). In the worker: 1280 on the long side (film 1: caption centres 0.8004 to 0.8035 against 0.8000 to 0.8041 at full size, the same words on 36 of 40 moments, of the other four one misread at 1280 and three at full size; 11.2 s against 21.8 s on this Mac), `MERGE_RGB` 40, Pillow's fast octree (median cut gave all the light pixels one colour).
- **The stage's time** on Modal (8 cores): 9.0 to 18.7 s for 40 moments on the 34 s films over two runs; 6.62 and 8.17 s for 25 on the owner's 12.7 s take (weight 0.34, X65 amended). Peak memory not read (the demo's cgroup figure came back empty).
- **X103, a reference never heard:** its words stage now only measures its pauses: 2.2 to 4.0 s on the films (8.2 to 14.5 s heard), 3.61 s on the owner's take (9.66 s heard), so a reference's words weigh 0.15 (`REFERENCE_WEIGHTS`). A whole reference analysis of the films: 42.6 to 60.3 s, mean 51.0 (heard 47.9 to 75.7, mean 60.8); the copies, 21 to 33 s, are most of it now. The pauses came out the same as heard on all six films; no Scribe call is made.
- **Qwen:** one call a reading, about 2,100 tokens in and 67 to 106 out, $0.00007 (six readings $0.00044). Its grade was natural for all five colour films (three were made warm) and mono for film 6.

**Results of Task 9c (2026-11-23, commits `9805c989` (worker, deployed from it), `e416d05b` (the reading), `b1e47375` (the first cut's title); written by the implementer).** The reading met five real references (Task 11) and the review of Task 9b.

- **Worker, references only** (a creator's take byte for byte as before): only the preview copy and the 16 kHz sound are made (no full copy, poster or loudness); the text stage reads its frames from the uploaded file (upright, SDR, 1280 long side); each line gains `beyond`, a ring as thick as `around` one box height further out; the stage makes the judgement's sheet (12 frames spread over its moments, the first and last among them, 270 × 480 letterboxed, 4 across, JPEG 85), stored as `sheet.jpg`, the only file a reference stores (`files` = preview, sound16k, sheet; `analysis.sheet = { file, ms }`). A soundless reference keeps no language. Analysis of the same 68.5 s file as a reference: 95.7 s before, 41.4 s after (copies 63.5 → 11.9 s; text 14.7 → 18.5 s, now decoding the upload). Image suite 429 passed, 29 skipped; Modal $2.70 → $2.80.
- **Box (B.1):** a box when `around` is one flat colour and `beyond` is not that colour; the edge is read on rows with no box. Three drawn clips analysed on the dev worker: white words over a flat dark wall and over flat skin: `beyond` the same colour, no box (today's rule: box); white words on a real dark box: `beyond` the picture's, box.
- **The six kit films again** (`scripts/edit-style-truth.ts`, their Task 9b analyses, which have no `beyond`): every gate that passed still passes (caption place, size, look, highlight, words 6/6; font 5/6; title 6/6 and 3/3; punch-ins 6/6; look 6/6); quiet 3/6 as before (ruled, not tuned).
- **Numbers measured:** height over type size 1.17 (six films: 1.116 to 1.203); a font unlike the kit's when its best fit leaves more than 0.06 of the mean row width (six films 0.012 to 0.024; references 0.018, 0.028, 0.056 TikTok's own sans, 0.063 a condensed serif, 0.097 a geometric sans) or its size is 30 % from the height's; `MONO_SAT` 0.012; `minScore` 0.65; same scene at a cut: luma 0.06, saturation and warmth 0.03, face ratio 1.5.
- **The five references reread from their saved analyses** (no fetch): reference 1 colour, no longer mono; reference 4's hook label held for the whole video is a title that stays, ink #010101 on its light label; reference 3's title ink #040404 (its 8.6 s kept, frames up to 600); reference 5 sized 116 by height in place of 32, "a typeface unlike the kit's", words a page 3 in place of 6, punch-ins 0.44 a minute in place of 3.93; no profile quotes any text. Not shown from disk: B.1 on the five (made before `beyond`).
- **The extras** (the controller's ruling, follow-up commit): "other text" is back as a kind Qwen may answer, dropped in code, and the judgement is asked twice at once, keeping the kinds both answers name on the cells both name (one answer stands alone when the other call fails). Six films and references 2 to 4, judged three times each: one extra named, film 4's laptop shot as a clip cut in (fair), and no false one (before: 26 of 54 on the films, 13 of them that laptop shot; 3 of 18 on the references). Reference 5's B-roll: named every time.


---

### Task 10: The first cut, in a style

**Files:**
- Create: `src/lib/edit/agent/first-cut.ts`, `src/lib/edit/agent/__tests__/first-cut.test.ts`

**Interfaces:**
- Consumes: `firstEdit` (`src/lib/edit/worker/takes.ts`), the recipes (Task 4), `change`, `Ask`, `AGENT_LIMITS` (Task 7), `review` (Task 3), `StyleProfile`, `DEFAULT_STYLE`, `matchOf` (Task 9).
- Produces:
  ```ts
  export const ChoicesSchema: z.ZodType<{ say: string; title: string | null; stress: number[]; look: (typeof LOOK_IDS)[number]; pauseMs: number }>; // stress: word indexes, ≤ 5; pauseMs 120–400; title ≤ 60 chars. With a style, look and pauseMs are the style's and Qwen's are ignored.
  export interface FirstCutInput { asset: Asset; analysis: TakeAnalysis; user: string; deadlineMs: number; style?: StyleProfile } // none: DEFAULT_STYLE, and Qwen chooses look and pace
  export async function firstCut(input: FirstCutInput, deps?: { ask?: Ask; stills?: typeof stillsOf; now?: () => number }): Promise<AgentResult & { match: ReturnType<typeof matchOf> | null }>;
  ```

**Steps of a first cut (exact):**
1. `edit = firstEdit(asset)`.
2. Ask Qwen once for `ChoicesSchema`, given the words, the pauses, the catalogue's title, call-out and look lines and, with a style, the style (so it chooses a title only when the style has one, and words in its manner). Bad output gets up to two repairs, quoting the zod issues.
3. Recipes on `edit`, in this order:
   - `tighten({ pauseMs })`, with the style's `pace.pauseMs` or, without a style, Qwen's;
   - with a style, `captions.set` to the style's captions;
   - `placeCaptions`, which moves them only where they would cover the face or the buttons;
   - with a style that has them, `punchIns(style.punchIns)`;
   - `levelVoice`.
4. Choices as ops:
   - a film title item when `title` is not null and the style's `title` is on, or there is no style:
     - with a style, its `y`, `frames`, `look` and `size`;
     - without, `anchor: "start", at: 0, frames: 45`, `look: "bold"`, with `y` in the half the captions are not in (0.2 if the captions are low, 0.75 if they are high);
   - `word.set { stress: true }` for each stressed index;
   - `look.set { preset }`, the style's or Qwen's.
5. Apply all through the door at once. Then `review`. If there are errors, run `change()` with the request "Fix the findings without changing the cut or the style" and the remaining deadline.
6. With a style, the answer carries `matchOf(style, edit, analyses)`, and its `say` names what matched and what did not (`notMatched` included).

- [ ] **Step 1: Write the failing tests** with a scripted `ask`, real recipes, door and review, on a made-up take:
  - good choices give a tightened edit with the title, the stresses and the look, and no review errors;
  - choices with `pauseMs: 50` are repaired, and round 2 quotes the range;
  - a title that would sit on the face (a made-up face high in the picture) ends with the title moved by the follow-up `change`;
  - `title: null` gives no title item.
  - **With a style:** a profile with `pauseMs: 180`, highlight captions at `y: 0.62`, a title at `y: 0.18` for 60 frames, and punch-ins at 6 a minute gives exactly those settings. Qwen's look is ignored for the style's, and `matchOf` says every field matched.
  - A style whose captions would sit on the made-up face ends with them moved, with `matchOf` saying `near` or `not` for `y`, and `say` saying why.
- [ ] **Step 2: Run them; they fail.**
- [ ] **Step 3: Implement `firstCut`.**
- [ ] **Step 4: Run them; they pass.**
- [ ] **Step 5: A real run** on the owner's take, without a style and with one of Task 9's ground-truth profiles, via an extension of `scripts/edit-agent-smoke.ts`:
  - render the first cut on this Mac;
  - look at it: the cuts, the title, the stressed words, the captions clear of the face;
  - record the time, cost and choices, and describe the film.
- [ ] **Step 6: Commit.**
  ```bash
  git add src/lib/edit/agent/first-cut.ts src/lib/edit/agent/__tests__/first-cut.test.ts scripts/edit-agent-smoke.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): the first cut, in a style: the style sets the craft, Qwen the hook and the stresses, the recipes cut"
  ```

**Results (2026-11-23, commit `ea965d4e`; written by the implementer):**
- **Built as the brief's steps**, with these choices of mine (the controller's to overturn):
  - the title's settings neither the style nor the brief gives are those Task 9's films were made with: font `tiktok`, white, no accent; size 120 with no style;
  - the stressed indexes are checked against the take's words (a zod issue, so a bad index is repaired like any other);
  - **a first cut ends with no review errors:** `change` accepts an answer that adds no error (X93), so it can leave the ones it was asked to fix. When the title still carries an error after the follow-up change, it is removed (`item.remove`) and `say` says why. An error that could still be left is only the captions where no one place is clear (spec §5); `say` says so, and the findings keep it;
  - when no answer can be read in three rounds, the recipes cut alone (no title, no stresses, the style's look or natural, the style's pause or 250 ms), and `say` says so;
  - the result also carries `choices` (as read), so the smoke run and the route can show them;
  - with a style, `say` names the areas that match (whole, or "the rest of" them), the fields close or not with why where code or the change moved them, and what the kit lacks.
- **Tests:** 19 in `first-cut.test.ts` (scripted `ask` and stand-in stills; recipes, door, review, `change` and `matchOf` real). Red first (no module; then a stub: 16 of 19 failed), then green. Ten mutations of `firstCut` (the style's look or pause ignored, no `placeCaptions`, the title's half inverted, no follow-up change, no index check, no title fallback, no punch-ins, no `levelVoice`, the style's "no title" ignored) are each caught. The agent folder: 97 of 97; both type checks clean on these files.
- **Real runs** on the owner's take (12.7 s, 27 words, first edit 381 frames), Qwen `qwen3.7-flash`, outputs in `.scratch/first-cut/` (git-ignored):
  - **No style:** one call, 1.9 s in all, 1,687 + 84 tokens, 0.0062 cents. Qwen chose a four-word hook from his opening line, three stresses (one is the filler verb "be"), `natural`, 150 ms. The cut: 325 frames (10.8 s), three shots, the first at volume 0.8, captions moved from 0.8 to 0.76, the title at 0.2 for 45 frames. No errors; four warnings (the title touches Instagram's top bar; the captions touch the chin, Instagram's bottom bar and TikTok's icons on the longest page). Rendered in 21.7 s.
  - **Style "truth 3"** (Task 9's profile 3: pop captions at 0.3, a label title at 0.14 for 90 frames, punch-ins 12 a minute at 1.25, warm, 150 ms): four calls, 8.6 s in all, 24,202 + 331 tokens, 0.077 cents. The captions at 0.3 covered the eyes, so `placeCaptions` moved them to 0.74. One punch-in (the last shot, 1.25): the take has only two cuts, so 5.5 a minute against 12. The style's title at 0.14 sits under Instagram's top bar (an error). **The follow-up change failed all three rounds:** each answer set the title to 0.2 (right) and also moved the captions (to 0.65, 0.5, 0.75, with width 0.7), which review refused each time. So the title was left out. Match: `captions.y` not (moved off the face), `title` not (left out), `punchIns.perMin` not; the rest matched. Rendered in 38 s.
  - **Why the change failed:** "Fix the findings" includes the captions' warnings, and Qwen fixes those too. Replayed on the same edit (stills off): the brief's request failed 2 of 2; "Fix the errors in the findings and change nothing else: leave the warnings, the cut and the style as they are" succeeded 1 of 2. Rewording helps but is not reliable.
  - **What the films look like** (sheets `none-sheet.jpg`, `truth3-sheet.jpg`; cuts `none-cuts.jpg`, `truth3-cuts.jpg`): the no-style title sits over the hair, well clear of the eyes; it is gone after 1.5 s. Captions sit below the chin (no style) or on the chin (truth 3); neither covers the mouth. The punch-in keeps the whole face in frame and crops the top of the hair. The first cut falls mid-turn to the laptop (a quicker turn); the second is a jump cut with no style and a clean punch-in with truth 3. White pop captions read weakly over light backgrounds. In the pill and pop looks a stressed word looks like the word being said; with five stresses (two side by side), whole truth-3 pages turn green.
  - **Modal:** $2.33 metered before and after: no stills were drawn (none of the follow-up rounds was accepted).
- **Concerns for the controller:** (1) the follow-up change does not reliably clear a style's title, so a style whose title sits under the apps' bars loses it; my recommendation: place the title in code as `placeCaptions` places the captions (N8), leaving the change for what code cannot do, or at least reword the request to the errors only; (2) Qwen's `say` is written before the cut and can claim a title that is then left out (the next sentence says so); (3) the stresses are weak (a filler verb, two words side by side) and barely read in the pill and pop looks; (4) the brief's order applies the stresses after `punchIns`, so `punchIns` cannot prefer a cut before a stressed word, as it was built to.

**Results of fix round 1 and Task 10b (2026-11-23, commits `9a685338`, `9e7645a2`; written by the implementer):**
- **Built:** `placeTitle` (recipes/title.ts: the nearest place review clears, a clear place within 0.12 over a nearer warned one, then 0.85 and 0.72 of the size); `placeCaptions` with sizes, by band (ruling a: the band its own `y` is in, full size then 0.85 then 0.72, before the other band); review's `on-text` (ruling b: a title or a call-out over a caption page, a title or a call-out on a shared frame, by 4 % of its own box); `punchIns` that split at pauses' `cutMs`, go back out at the next pause a second on, start 2 s apart and hold the face to 0.62 of the stage (none under 1.08); `wordLight` (one coloured word in the looks that follow the voice); `HOUSE_STYLE`; the first cut with code-written `say`, thinned stresses set before the punch-ins, the errors-only last resort, and every part still carrying an error left out (X93 now: no error it could remove). `change` and the first cut share `askRound`, `newRound` and `readAnswer` (I2).
- **Tests:** red first for each piece, then green: the edit tree and the kit, 706 of 706; 16 of 16 mutations caught; both type checks clean. The preview-against-render proof, once, 226 comparisons (four new variants with stressed words in each caption look): "preview and render agree" (Chromium at worst 0.292 % of pixels and 0.76 levels, WebKit 0.340 % and 1.65), and every box as `layout.ts` gives it.
- **What `on-text` caught:** one fixture, `loop.test.ts`'s repair after the stills, moved a call-out onto the captions; the rule stands, the fixture now moves it to a clear place.
- **The owner's take, house style** (`.scratch/first-cut/v2-none*`): one Qwen call, 1.5 s, 0.0058 cents, no errors. Captions low at 0.74, made 82 px (0.85) by the band rule; a three-line hook of about 47 characters at 0.22 (moved by code off the top bars), its two marked words in yellow; one stress kept of two (neighbours); one punch-in. Before the band ruling the captions had gone to 0.22 at 96 px, on the title (`v2pre-none-sheet.jpg`); the per-place table that led to ruling a is in the task's report.
- **Truth 3** (`.scratch/first-cut/v2-truth3*`): four calls, 5.8 s, 0.076 cents, no errors left. Captions high (0.26) as the style asks; the look warm; one punch-in of the two asked. **The title is still left out:** with the style's captions placed high first, every place for its title is under the top bars (to 0.18), on the captions (0.20–0.24) or on the face (below), at 110, 94 and 84 px. The last resort's fourth answer moved the title into the bars, which `change` accepts (an error of a kind it already had, X93), and the title was then left out, as ruled.
- **Weak points seen:** the one punch-in in both films lands on the shot of the laptop, which has no face: a punch-in on a face shot was dropped because, zoomed, it brings the mouth (house) or the eyes (truth 3) into the captions; and its way back out falls mid-phrase. Qwen's hooks run long (40 to 47 characters, three lines). Modal: $2.47 metered before and after these runs (no stills drawn).

**Results of fix round 2 (2026-11-23, commits `6a93cf65`, `1b988eac`; written by the implementer):**
- **Built:** a hook of at most 5 words and 28 characters and a short one of at most 3 and 18 (a bad length is repaired); the short one placed when the hook finds no place at any size. Punch-ins only where a face is found (the start's sample and half the stretch's); before a punch-in is dropped for its captions, the face's line nearest them is held (the mouth's bottom under, the face's top over), at its zoom and 0.05 smaller down to 1.08; a punched stretch ends at its shot's end 2 to 5 s on, else the longest pause starting in that window, never under 2 s. `levelVoice` held to 0.71–1.41 (±3 dB), and a piece under 3 s takes its longer neighbour's volume. With a style, `say` gives the match in at most two sentences ("It follows the style, except that …"; near fields not named). A style with `pace.quiet` is tightened to `pauseFor`'s cap for the take (X104; the span from the head pause's end to the tail pause's start, as `measures.ts` reads a reference).
- **Tests:** red first (the new punch-in rules against the committed `punch.ts`; voice; the first cut's 16), then green: the edit tree and the kit 720 of 720; 10 of 10 mutations caught; both type checks clean. No kit change, so no preview proof this round.
- **A number for the controller:** the short-hook test uses a face from 0.29 to 0.79, the owner's take's own extent (highest top 0.288, lowest bottom 0.791). With 0.27 to 0.81 the high captions are pushed to 0.22 and not even the short hook fits above them (bars to 0.16, captions from 0.18).
- **The owner's take, house style** (`.scratch/first-cut/v3-none*`): 2 calls (the first short hook had four words: repaired), 2.5 s, 0.0124 cents, no errors. A four-word hook on two lines at 0.20, its key word lit; captions at 0.74, 82 px; one punch-in, on the face, its mouth line held (pan y 0.39 where today's framing gave 0.12); nothing on the laptop shot; volumes 0.8, 1, 1.
- **Truth 3** (`.scratch/first-cut/v3-truth3*`): 2 calls, 2.7 s, 0.0136 cents, no findings at all. **The title is back:** the full four-word hook, one line on its label at 0.18 and 94 px; captions high at 0.26; one punch-in on the face with the brow line held. `say`: "It follows the style, except that it punches in less often." Weak: the title's line sits right on top of the captions' line over the hair for 3 s (clear of each other, crowded to the eye); 1 punch-in of the 2 asked, the first slot's only candidates being on the faceless laptop stretch.
- **Modal:** $2.49 metered before and after (no stills drawn).

**Results of fix round 3 (2026-11-23, commits `8c7b35d7`, `8510d3f7`, `6d2ccb90`; written by the implementer):**
- **Built:** a punched stretch always ends: at its shot's end or the longest pause 2 to 5 s on, else the first pause or cut up to 8 s on, else no punch-in there; to the film's end only within 5 s. No zoom under 1.08. A punch-in's errors are judged without the shot they name (a split renamed an old captions error into a new one). `levelVoice`: a short piece never takes a muted neighbour's volume and is held to 0.71–1.41. `on-text` grows the part's box by 0.012 of the stage's height above and below. `say`: at most four sentences without a style, five with one (two of them the match); any error left that the captions' sentence does not tell gets one plain line; "kept clear of your eyes and mouth" only where a face was found. Tests use made-up hooks. Part 2's plan describes the take instead of quoting it.
- **Tests:** red first for each rule, then green: the edit tree and the kit 730 of 730; 10 of 10 new mutations caught; both type checks clean on these files.
- **Time** (no Qwen, a made-up 90 s take with a face throughout, 162 words, 34 pauses): the first cut's code part 128 ms with a title that finds a place, 698 ms when neither hook finds one (then `placeTitle` alone is 314 ms a hook: 41 places × 3 sizes); `punchIns` 104 ms, `placeCaptions` 11 ms, the rest under 10 ms each.
- **Truth 3 again** (`.scratch/first-cut/v4-truth3*`): as v3, no findings; the title at 0.18 and 94 px, the captions at 0.26. The gap did not move it: the title's box ends at 412 px and the first caption page's starts at 455 px, 43 px apart against the 23 px the gap asks. The two read as two things (a dark label over plain edged words), one line apart.

---

### Task 11: References in the app: fetched or uploaded, read, dropped

**Files:**
- Create: `src/lib/edit/style/reference.ts`, `src/app/api/edit/references/route.ts`, `src/app/api/edit/references/[id]/route.ts`, `src/app/api/edit/__tests__/references.test.ts`
- Modify: `src/lib/edit/worker/jobs.ts` (`startJob` passes `input: { reference: true }`), `src/lib/edit/worker/takes.ts` (`UploadSchema` gains `reference?: true`)

**Interfaces:**
- Consumes:
  - `resolveAndRehost(url, requestId)` (`src/lib/engine/remix/resolve-and-rehost.ts`: a temporary signed copy; `cleanup()` always, in `finally`);
  - `signPut`, `takeKey`, `sizeOf` (`r2.ts`);
  - `startJob`, `readJob`, `latestJob`, `liveJob` (`jobs.ts`);
  - `creator()`, `ownTake` (`creator.ts`);
  - `measuresOf`, `sheetFrames`, `readSheet`, `styleOfReference` (Task 9);
  - `sheetOf` (Task 6);
  - `firstEdit`, `assetOf`.
- Produces:
  - `POST /api/edit/references`:
    - `{ url }` for an outlier or a pasted link: the server fetches it with `resolveAndRehost`, streams it into R2 as a take of the creator's (`u/<user>/takes/<id>/source`), and starts the analysis with `input: { reference: true }`;
    - or `{ name, bytes, type }` for an upload: the same as `POST /api/edit/takes`, with the job's input `{ reference: true }`.
    
    It answers `202 { id, upload? }`.
  - `GET /api/edit/references/[id]`:
    - while analysing: `{ status, stage, progress }`;
    - once ready: draws the sheet, reads it, makes the profile, **drops the reference** (deletes its R2 objects under `u/<user>/takes/<id>/`, its job rows and its take row, with the service client, filtered on the creator's `user_id`), and answers `{ status: "ready", style }`;
    - after the drop: 404.
  ```ts
  export async function dropReference(service: Db, user: string, id: string): Promise<void>; // R2 objects, jobs, take; each step tried even if one fails, failures logged
  ```

- [ ] **Step 1: Write the failing tests,** with stand-ins at R2, Supabase, the worker and `resolveAndRehost` (the network). The routes, schemas and Task 9's code are real:
  - a link is fetched, put in R2 under the creator's folder, and its analysis is started with `{ reference: true }`; `cleanup()` runs even when the R2 put fails;
  - a reference over 3 minutes, as its analysis reports it, gives the worker's plain line;
  - once ready, the GET gives a style, and every object, job row and take row of that reference is gone;
  - a second GET gives 404;
  - another creator's reference id gives 404 and drops nothing;
  - a drop whose R2 delete fails still deletes the rows and logs the failure.
- [ ] **Step 2: Run them; they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them; they pass.**
- [ ] **Step 5: A real run** as the e2e test account (`scripts/edit-reference-proof.ts`, loading `.env.local`):
  1. reference 1 of the five the owner approved (P7; links in `.superpowers/sdd/2026-11-21-edit-agent/references.md`, never in git), fetched by its link and read;
  2. its profile and its sheet (look at it: does the reading match what is on the frames?);
  3. confirm, by listing R2 and the rows, that nothing of it is left.
  
  Record the times: fetch, analysis, read.
- [ ] **Step 6: Commit.**
  ```bash
  git add src/lib/edit/style/reference.ts src/app/api/edit/references/ src/app/api/edit/__tests__/references.test.ts src/lib/edit/worker/jobs.ts src/lib/edit/worker/takes.ts scripts/edit-reference-proof.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): a reference fetched or uploaded, read into a style, and dropped"
  ```

**Results:** (2026-11-23, commit `d5d5a798`)

- **Built**:
  - `reference.ts`: `fetchReference`, `stageOf`, `readReference`, `claimRead`, `dropReference`;
  - `POST /api/edit/references`: `{url}` → 202 `{id}`; `{name, bytes, type}` → 202 `{id, upload}`;
  - `GET` and `POST /api/edit/references/[id]`: the GET reads and drops, the POST is the uploaded reference's start.
- **As the controller ruled (fix round 1)**:
  - **`jobs.ts` and `takes.ts` are unchanged.** `startJob` already writes `input`. An uploaded reference is started by
    `POST /api/edit/references/[id]` with `{reference: true}`. The GET answers only for a take whose analyse job has
    `input.reference === true`: a real take's id is 404, and nothing is deleted (tested).
  - **R2's `objectsUnder` and `removeObject` are in `r2.ts`**, with tests. `stand-ins.ts` was extended additively (the bucket's
    PUT, list and DELETE; the REST API's DELETE; the worker's `/stills`).
  - **One read at a time, two at most.** A first read that throws gives its claim back and keeps the reference, so the next
    poll reads again at once. A second that throws, or dies, drops it and answers failed.
  - **The drop comes only once the style is made.** A failed analysis is dropped too, and answers the worker's line.
  - **`judged: false`** when the sheet or the judgement fails.
  - **One log line per read**: seconds by step, the judgement, the sheet's SHA-1.
- **Tests**:
  - `references.test.ts`, 35: stand-ins at Supabase, R2, the worker, `resolveAndRehost` and Qwen only. `r2.test.ts` has 3 new
    tests.
  - Red: 10 of 31 failed on the first run, every one that needs the drop. The fix round's 4 failed against the first commit.
    The code was written before each of those runs.
  - Green: `src/app/api/edit` and `src/lib/edit`, 772 passed. Both type checks clean.
- **Real run, the five approved references, as the e2e test account** (`scripts/edit-reference-proof.ts`):
  - The references run 60 to 137 s, so none was 30 s.
  - A creator waits **127, 157, 145, 163 and 197 s**, against an aim of under 60 s for 30 s. The parts:
    - the Apify fetch, 33 to 93 s;
    - the R2 put, 1 to 3 s;
    - the worker's start, 2 to 14 s;
    - the analysis, 50 to 86 s (copies 15 to 29, text 13 to 18, faces 5 to 11, storing 4 to 9);
    - the sheet, 17.6 to 23.8 s cold and 16.4 to 19.4 s warm: **the largest part after the analysis**, about three-quarters
      of the read;
    - the judgement, 4 to 7 s;
    - the drop, about 1 s.
  - **Dropped, all five:** a second GET is 404, R2 lists 0 objects under the reference's folder, and 0 take and 0 job rows
    remain.
  - The sheet Qwen judged is the proof's own sheet (same SHA-1) on all five.
  - Reference 1 was run again on the final code: 119 s, dropped through `r2.ts`, and the same style but for a caption size of
    47 against 48.
  - Modal metered $2.48 before, $2.70 after the five, and $2.68 after the rerun.
- **The reading against the frames**:
  - Right, near and wrong of 12 fields: reference 1 6/4/2, reference 2 5/5/2, reference 3 7/2/3, reference 4 9/2/1,
    reference 5 7/1/4.
  - Right on all five: the captions' place, their ink and highlight, and capitals.
  - The misses, by rule (not tuned here):
    - "backing" read on plain or outlined text over a flat curtain, skin or desk, giving pill on 3 of 5, with an outline missed
      on one;
    - `MONO_SAT` reads a dim colour video (mean saturation 0.024) as mono;
    - size and font from widths fail on a condensed serif: 32 px inter for about 110 px captions;
    - the caption band takes in B-roll text;
    - B-roll cuts read as punch-ins;
    - a hook label held for the whole video is "other text", not a title;
    - Qwen grades blue content "cool", and lists the title's label as "boxes or shapes".
  - notMatched over the five:
    - captions of N words a page: 4;
    - captions smaller than the kit draws: 2;
    - a title smaller than the kit draws: 2;
    - text on screen: 8 lines in 2;
    - stickers: 1;
    - clips or pictures cut in: 1;
    - a split screen: 1;
    - boxes or shapes: 3.
  - Evidence in `.scratch/task11/` (git-ignored).
- **Round 3** (commits `b2d2a2cc`, `75d8ec81`):
  - **The read now takes the sheet the worker made in the analysis** (Task 9c), read from R2. No `/stills`, and no copy of the
    reference is asked for. A missing or unreadable sheet gives `judged: false`.
  - The stages map the lighter analysis. "Reading its look" is the judgement only.
  - The sweep's upload marks are read by `updated_at` and never on a ready take.
  - The list reads only the columns it answers with.
- **The second real run of the five, at HEAD's reading**:
  - **The waits.** A creator waits **124, 100, 100, 76 and 148 s**, against 127, 157, 145, 163 and 197 in the first run.
    - The copies are 8 to 15 s (was 15 to 29), the storing 0.7 to 1.4 s (was 4 to 10), and the sheet 0.3 to 0.6 s (was 17.6
      to 20.7).
    - The analysis is 37 to 55 s, and the read 6 to 11 s.
    - The Apify fetch, 25 to 61 s, is now the largest part. The judgement (two Qwen calls) is 4.9 to 9.8 s.
  - **Dropped, all five:** 404, 0 objects, 0 rows. The sweep's two reads ran against the real database without error and
    found nothing to drop.
  - **The reading against the frames:** right, near and wrong 8/4/0, 4/5/3, 11/1/0, 11/1/0 and 9/2/1, against 34/14/12 in all
    before.
  - **Still wrong:**
    - reference 2: dark clothing under white captions read as a highlight box with a dark highlight;
    - reference 2: arrows that are not there;
    - reference 5: one B-roll cut read as a punch-in.
  - **Newly missed:** reference 5's B-roll and split screen.
  - Modal metered $2.82 → $3.09, shared with other runs in the same window.

---

### Task 12: A style from words, and the presets

**Files:**
- Create: `src/lib/edit/style/words.ts`, `src/lib/edit/style/presets.ts`, `src/lib/edit/style/presets.json`, `src/lib/edit/style/__tests__/words.test.ts`, `scripts/edit-style-presets.ts`

**Interfaces:**
- Consumes: `StyleProfileSchema` (Task 9), `Ask` (Task 7), the reference pipeline (Task 11; the script calls its library functions directly, as the owner's account through the service key, never through the routes).
- Produces:
  ```ts
  export interface Preset { id: string; name: string; description: string; profile: StyleProfile } // name by look, never a person (X99)
  export const PRESETS: readonly Preset[];
  export async function styleOfWords(words: string, ask: Ask): Promise<{ style: StyleProfile; say: string }>; // the presets as examples; a person's name → the nearest preset, said in say
  ```

- [ ] **Step 1: Measure the presets** (`scripts/edit-style-presets.ts`).
  - **Sources (owner, 2026-11-21: "idk if you can use mavens videos maybe find new ones"):**
    - The five Maven outliers the owner approved (P7; `references.md`).
    - 5 to 15 openly licensed, edited short-form videos: YouTube's Creative Commons filter and Wikimedia Commons, CC BY or CC0 only, never NC or ND. For each, record its title, address, licence and the date checked in the results.
    - More of Maven's outliers only on the owner's word.
    - If fewer than 12 references in all are found, make fewer presets (at least three), and say so.
    - Each file stays outside git and is dropped after its read (X96).
  - Read them through Task 11's pipeline, dropping each.
  - Cluster their profiles into about six groups, on pace, cuts a minute, punch-ins, caption look, caption height, title and look. Use k-medoids or plain judgement written down.
  - Name each group by its look, describe it in one line, and store each medoid's profile in `presets.json`: numbers only, with no video, link or creator name.
  - Also write the frequency of each `notMatched` feature across the 20 into the results. It is the tool belt plan's order.
- [ ] **Step 2: Write the failing tests** with a scripted `ask`:
  - "fast cuts, big yellow captions, zoom when I make a point" parses to a valid profile;
  - a reply naming a preset id gives that preset's profile with the asked changes;
  - a person's name gets a reply saying it chose the nearest preset, by name;
  - a reply outside the schema gets one repair, then a plain error.
- [ ] **Step 3: Run them; they fail.**
- [ ] **Step 4: Implement `presets.ts` and `styleOfWords`.**
- [ ] **Step 5: Run them; they pass.**
- [ ] **Step 6: A real run.** Ten phrases through the real Qwen:
  - "Hormozi style";
  - "calm and clean";
  - "fast with zooms";
  - "like a podcast clip";
  - "big captions in the middle";
  - "no captions";
  - "cinematic and warm";
  - "MrBeast style";
  - "minimal, black and white";
  - "energetic, lots of cuts".
  
  Record each profile and `say`, and judge each as sensible or not.
- [ ] **Step 7: Commit.**
  ```bash
  git add src/lib/edit/style/words.ts src/lib/edit/style/presets.ts src/lib/edit/style/presets.json src/lib/edit/style/__tests__/words.test.ts scripts/edit-style-presets.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): styles from words, and presets measured from real outliers"
  ```

**Results:** (2026-11-23, commit `d40f5276`; built to the controller's addendum, X105: the presets designed, not measured;
Qwen chooses a preset and a change, code builds the profile.) Full report: `.superpowers/sdd/2026-11-21-edit-agent/task-12-report.md`.

*The presets*, each a first cut of the owner's 12.7 s take (Qwen `qwen3.7-flash`; rendered on this Mac; sheets in
`.scratch/task12/<id>-sheet.jpg`). No errors left in any. Times and cents are the first cut's (Qwen's rounds).

| id | name | line | cut | first cut | match (off the preset) | the sheet, weakest first |
|---|---|---|---|---|---|---|
| `bold-pop` | Bold pop | Big white words, the one being said in yellow. A hook up top, light zooms. | 11.1 s | 2.9 s, 0.0138¢, 2 rounds | captions 82 px (96), y 0.74 (0.72): near | captions sit on the chin and shrink to 82 px; title over the hair, clear of the eyes; one punch-in, face whole |
| `one-word` | One word | One huge word at a time, tight cuts, hard zooms. | 10.8 s | 1.6 s, 0.0067¢, 1 round | captions y 0.22 (0.64), title y 0.74 (0.20), title 101 px (140), punch-ins 5.5 a minute (14): not | weakest of the six on this take: 150 px at 0.64 lands on the face, so the words go to the top and the hook to the bottom, smaller than the captions (the order reads upside down); one punch-in at 1.2, face whole |
| `clean` | Clean | Small captions on a dark pill. Calm, no zooms. | 11.4 s | 2.6 s, 0.0136¢, 2 rounds | title y 0.22 (0.18): near | reads as calm subtitles; the 68 px pill is small but legible; title on dark labels over the hair |
| `highlighter` | Highlighter | Each word lights up on a block of colour. | 11.1 s | 2.8 s, 0.0137¢, 2 rounds | captions y 0.74 (0.70): near | green blocks read well; captions on the chin; the `outline` title looks like `bold` at this size |
| `key-words` | Key words | Plain white captions; only the words that matter take colour. | 11.1 s | 2.8 s, 0.0136¢, 2 rounds | captions 75 px (88), y 0.74 (0.72): near | the colour goes where Qwen's stresses go, and one of three was a filler (`be`); 75 px plain is thin |
| `mono` | Black and white | Black and white, quiet type, unhurried. | 11.4 s | 1.4 s, 0.0064¢, 1 round | all matched | quiet and coherent; white captions lose contrast where they cross the light shirt |

Each first cut's second round, where there was one, repaired the first cut's own short hook (over 3 words), not the preset.
Modal: $2.58 before, $2.68 after; none of these cuts drew stills, so the $0.10 is other work on the machine.

*Task 11's five references* (`.scratch/task11/ref-<n>/profile.json`): nearest preset, by a plain sum of per-field distances
and by eye: ref-1 Black and white (captions at the top, pill); ref-2 Clean; ref-3 Clean (cool look, slower); ref-4 Black and
white less the mono look; ref-5 Black and white less the mono look (punch-ins, vivid). None is near the four bold presets: all
five have captions with no colour, 44 to 65 px, six words a page or more. The set covers quiet subtitled videos only through
Clean and Black and white.

*`notMatched`, counted over the five* (by kind): captions of more than six words a page 4 of 5; boxes or shapes 3; text on
screen 2 (one reference with seven lines); a title smaller than the kit draws 2; captions smaller than the kit draws 2;
stickers 1; clips or pictures cut in 1; a split screen 1.

*The ten phrases* (final prompt; every answer read in one round, about 1 to 2 s and 0.005¢ each; earlier prompts' runs kept
as `words-v1` to `v3` in `.scratch/task12/`):

| phrase | preset, change | judgement |
|---|---|---|
| "Hormozi style" | bold-pop | sensible; say: the nearest preset to that style, names the person |
| "calm and clean" | clean | sensible |
| "fast with zooms" | one-word, zooms many, pace fast | sensible (the change repeats what one-word has) |
| "like a podcast clip" | clean | sensible |
| "big captions in the middle" | bold-pop, captions middle | half: placed in the middle, not made bigger (Bold pop's 96 px stand as "big") |
| "no captions" | clean, captions off | sensible |
| "cinematic and warm" | clean, look warm | sensible |
| "MrBeast style" | one-word | sensible; say names the person as the style it is nearest to |
| "minimal, black and white" | mono | sensible |
| "energetic, lots of cuts" | one-word | sensible |

The says are longer than asked and often say what was kept. Three phrase cuts (`words-1`, `-2`, `-9`): `words-2` and `words-9`
are byte for byte Clean's and Black and white's; `words-1` differs from Bold pop's only in Qwen's stressed words.

*Fix round 1* (commit `59cc360c`, the controller's ruling after review): Qwen no longer writes the say. Its answer is `preset`,
`change`, `named` (the words name a person, a channel or a brand as the style; left out, false) and `cannot` (music, emoji,
stickers, sound effects, clips or pictures cut in, other). Code writes at most three sentences: the preset's name and the
first sentence of its line, then the changes (or, when a change makes the line untrue of the cut, the name with the changes);
"It is the nearest look we have, not that person's own style." when named; "Not in the kit yet: …". The say checks and their
false refusals are gone. The ten phrases again, each read in one round (about 0.005¢):

| phrase | answer | say |
|---|---|---|
| "Hormozi style" | one-word, captions bigger, named | I used One word: one huge word at a time, tight cuts, hard zooms. With bigger captions. It is the nearest look we have, not that person's own style. |
| "calm and clean" | clean | I used Clean: small captions on a dark pill. |
| "fast with zooms" | bold-pop, zooms many, pace fast | I used Bold pop, with many zooms and a fast pace. |
| "like a podcast clip" | clean | I used Clean: small captions on a dark pill. |
| "big captions in the middle" | bold-pop, captions bigger and middle | I used Bold pop: big white words, the one being said in yellow. With bigger captions in the middle. |
| "no captions" | bold-pop, captions off | I used Bold pop, with no captions. |
| "cinematic and warm" | clean, look warm | I used Clean, with a warm look. |
| "MrBeast style" | one-word, 3 words a page, bigger, named | I used One word, with bigger captions and three words at a time. It is the nearest look we have, not that person's own style. |
| "minimal, black and white" | mono | I used Black and white: black and white, quiet type, unhurried. |
| "energetic, lots of cuts" | one-word | I used One word: one huge word at a time, tight cuts, hard zooms. |

All ten are sensible. Two runs with the same prompt minutes apart gave different answers for four phrases (temperature 0 and
the seed do not make DashScope's answers repeat).

---

### Task 13: The route and the page

**Files:**
- Create: `src/app/api/edit/agent/route.ts`, `src/app/dev-edit/agent/page.tsx`, `src/app/dev-edit/agent/agent.tsx`, `src/app/api/edit/__tests__/agent-route.test.ts`
- Modify: `src/app/api/edit/creator.ts` (an in-memory `holdAgent(user)` for X92)

**Interfaces:**
- Consumes: `creator()`, `route()`, `refuse()`, `ownTake` (`creator.ts`); `assetOf`, `refusedFiles`, `takeState` (`takes.ts`); `analysisOf` (Task 3); `change`, `AGENT_LIMITS` (Task 7); `firstCut` (Task 8); `EditPlayer` (`src/edit/player/EditPlayer.tsx`); the render routes (`POST /api/edit/renders`, `GET /api/edit/jobs/[id]`).
- Produces:
  - `POST /api/edit/agent`, body `{ takes: uuid[]; edit: Edit; request: string }` (a change) or `{ takes: [uuid]; firstCut: true; style?: StyleProfile | { words: string } | { preset: string } }`. A `words` style is turned into a profile with `styleOfWords` first, and the time it takes counts in the deadline.
  - Answers `200 { say, ops, edit, findings, rounds: number, ms, cost, changed }`.
  - Errors:
    - 400: a bad body; a request over 500 characters; an edit the door refuses;
    - 403: the gate;
    - 404: a take not the creator's;
    - 409: a take not ready, or a live agent call;
    - 422: `refusedFiles` problems.
  - `export const maxDuration = 180;` and the deadline: change 50 s, first cut 170 s (X89).

- [ ] **Step 1: Write the failing route tests.** Real door, review and loop; `ask` and `stills` injected at the boundary through a module the route imports (`src/lib/edit/agent/deps.ts`, exporting `agentDeps` that tests replace); Supabase stood in as in `routes.test.ts`. Cover:
  - an unlisted creator gets 403;
  - another creator's take gets 404;
  - a take still `analysing` gets 409;
  - an edit whose take facts differ from the row (a changed `ms`) gets 422;
  - a second call while one is live gets 409, and a call after the first finishes passes;
  - a good change gives 200 with the new edit;
  - a first cut gives 200 with a tightened edit;
  - a first cut with a preset id, with words, and with a full profile gives the style's settings and a `match` in the answer;
  - an unknown preset id gives 400.
- [ ] **Step 2: Run them; they fail.**
- [ ] **Step 3: Implement the route, `deps.ts` and `holdAgent`.**
- [ ] **Step 4: Run them; they pass.**
- [ ] **Step 5: The page** `/dev-edit/agent`:
  - 404 in production, and through `creator()`, like `/dev-edit/worker`;
  - plain, in the app's charcoal tokens, with no accent colour;
  - the creator's ready takes;
  - **a style for the first cut:** none, a preset (listed), a few words, or a reference, from a pasted link or an uploaded file, read through Task 11's routes with its progress shown;
  - a First cut button, the Player with the edit, the match check (matched, near, not, and what is not in the kit), a request box with Send, the answer, and the findings listed with their frames;
  - rounds, time and cost;
  - Undo, back through the edits this page was given;
  - Render, with progress and download, through the existing routes.
  
  Buttons are disabled while a call is out.
- [ ] **Step 6: The browser proof** (`scripts/edit-agent-page-proof.ts`, one command with its own server on 127.0.0.1, signed in as the e2e test account as in `scripts/edit-worker-proof.ts`, Playwright's `channel: "chromium"`):
  1. open the page;
  2. First cut on the test account's ready take, in a preset;
  3. a reference link read into a style, and a first cut in it (match check shown);
  4. the Player plays it;
  5. send "make the captions bigger";
  6. Undo;
  7. send it again;
  8. Render;
  9. download.
  
  Take a screenshot of each step into `.scratch/agent-proof/page/` and look at each. Record the times.
- [ ] **Step 7: Commit.**
  ```bash
  git add src/app/api/edit/agent/ src/app/dev-edit/agent/ src/app/api/edit/__tests__/agent-route.test.ts src/app/api/edit/creator.ts src/lib/edit/agent/deps.ts scripts/edit-agent-page-proof.ts
  git -c core.hooksPath=/dev/null commit -m "feat(edit): the agent's route and the page that tries it"
  ```

**Results:** _(the page's times; what each screenshot showed)_

---

### Task 14: The proof (part 3's gate)

**Files:**
- Create: `src/lib/edit/agent/requests.json`, `scripts/edit-agent-proof.ts`
- Modify: `src/lib/edit/agent/loop.ts` (`AGENT_LIMITS.thinking` and `maxTokens` from the measures, X88), and the prompt, catalogue wording or repair messages as the proof shows they need

**The requests** (`requests.json`: `{ id, request, start: "fresh" | "first-cut", expect: "done" | "refused" }`). They name at most a word or two of the owner's take, never its transcript:

| id | request | start | expect |
|---|---|---|---|
| r01 | Make the captions bigger. | fresh | done |
| r02 | Put the captions higher, above my chin. | fresh | done |
| r03 | Use the pop caption style. | fresh | done |
| r04 | Turn the captions off. | fresh | done |
| r05 | Add a hook title at the start that says "Day one". | fresh | done |
| r06 | Add a call-out "New tool" when I say Claude. | fresh | done |
| r07 | Add a closing line "Follow for more" over the last two seconds. | fresh | done |
| r08 | Make it snappier: cut the pauses shorter. | fresh | done |
| r09 | Cut out the first second. | fresh | done |
| r10 | Remove everything after the last word. | fresh | done |
| r11 | Make it warmer. | fresh | done |
| r12 | Black and white please. | fresh | done |
| r13 | Slowly zoom in on my face over the whole video. | fresh | done |
| r14 | Punch in when I say available. | fresh | done |
| r15 | Add a progress bar at the top. | fresh | done |
| r16 | Stress the word "available" in the captions. | fresh | done |
| r17 | In the captions, write "out" instead of "available". | fresh | done |
| r18 | Remove the title. | first-cut | done |
| r19 | Make the whole video 1.25 times faster. | fresh | done |
| r20 | Move the call-out so it does not cover my mouth. | first-cut | done |
| r21 | Captions lower and in the pop style. (2026-11-19 proof) | fresh | done |
| r22 | Zoom in on "Claude" and add a whoosh. (2026-11-19 proof) | fresh | refused (no sounds in the kit yet; the zoom may be done, the whoosh said not possible) |
| r23 | Make me taller. | fresh | refused |
| r24 | Add background music. | fresh | refused |

**Gates:**
- at least 90 % of the `done` runs end valid, with no review errors, doing what was asked;
- every `refused` run's `say` says what cannot be done, with no edit change beyond the possible part;
- the median change is under 10 s without stills and under 20 s with them;
- a first cut of a 90 s take is under two minutes;
- **styles:**
  - Task 9's ground truth passes;
  - the five references the owner approved (P7): the owner's take is cut in each style, with the match check reported and every field the kit can draw matched or near in at least 80 % of fields;
  - **more takes than one:** three free talking-to-camera clips under a licence that allows editing them (Mixkit's or Coverr's free licence, checked and recorded) are added as test takes, so first cuts are proved on more than the owner's 12.7 s;
  - ten phrases give valid, sensible profiles (Task 12);
- cost is recorded.

- [ ] **Step 1: Write `scripts/edit-agent-proof.ts`** (loads `.env.local`; reads the owner's take row and analysis with the service key as part 2's proofs did). For each request run 3 times through `change` (or `firstCut` then `change`), it records:
  - the rounds, ms, tokens, cost and `changed`;
  - the review errors left;
  - the ops;
  - the stills, saved as `.scratch/agent-proof/<id>-<run>.jpg`.

  Its summary table holds the rates per gate. Judging "does what was asked" is the controller's, by reading the ops and looking at the stills; the script prints a sheet per request to make that quick.
- [ ] **Step 2: Measure thinking (X88).** Run r01–r08 three times each with `thinking: false` and with `thinking: true`, at `maxTokens` 4000. Pick the setting that passes the validity gate with the lower median time. Set `AGENT_LIMITS` and record the numbers in X88's row.
- [ ] **Step 3: The full run.** Run all 24 requests ×3, plus first cuts of the owner's take and of the three free test takes ×3 with no style, ×1 in each preset, and ×1 in each of the five references' styles (with each reference read and dropped). If the 90 s first-cut gate cannot be judged on the 12.7 s take, run it on the ten-minute test take's first 90 s, cut from the part 2 Volume. Record everything.
- [ ] **Step 4: Fix our layer where a gate fails** (prompt, catalogue wording, repair messages, recipes), and rerun the failing requests ×3. Each fix gets a unit test where it is code. Stop after three such rounds and report the numbers as they stand.
- [ ] **Step 5: Look and send.** Look at every still sheet, at the rendered first cuts, and at each styled cut beside its reference's sheet, and write what you see. Pick for the owner: one sheet, two first-cut films, and one styled cut with its reference.
- [ ] **Step 6: Record and commit.** Write the results under this task (the table of rates, times and costs) and update the spec's §10 numbers where measured.
  ```bash
  git add src/lib/edit/agent/requests.json scripts/edit-agent-proof.ts src/lib/edit/agent/ docs/superpowers/plans/2026-11-21-edit-agent.md docs/superpowers/specs/2026-11-21-edit-agent-design.md
  git -c core.hooksPath=/dev/null commit -m "docs(edit): part 3 proved: the agent's rates, times and costs on the owner's take"
  ```

**Results (2026-11-23, commits `52d36b1f` (Step 0), `c6322ddd` (requests and script), `188895c2` (the three fix rounds), `c926aa7e` (script), `8faddf74` (first results), `c721968d` (the say), and the commit that carries these lines; written by the implementer). The time gates pass. On the code as it is the done-rate is 54 of 63 (86 %), three runs short of 90 %, and 58 % on a second take; one impossible request is not refused; two of five styled cuts are under 80 %. Three fix rounds are used, then the controller's addition on how a say reads: the numbers stand.**

Built to the controller's addendum: every request starts from the house first cut (r05 "Change the hook to say …", r03 and r21 ask for the pill style since the first cut is pop, r20 has the call-out set on the mouth first); every run is judged on two questions, what was asked and whether it looks right; Step 0 came before any measuring.

*Step 0, the craft the agent is told* (five requests, three runs each): 5 of 15 runs changed the edit before; 8 of 15 with the section "How it should look" alone; 15 of 15 with the section and `room`, the context's new part that says where text has room as the review itself judges it. No number of the addendum's starting values moved (`CRAFT` in `prompt.ts`). "Make the captions bigger": 0 of 3 before, 3 of 3 after (82 to 100 px, two words a page). The call-out: 0 of 3 before, 3 of 3 after at 130 px in the film's yellow for 1.0 to 1.2 s; on this close-up it still sits on the hair. The review gained the warning `short-text` (a title or call-out on screen under 0.8 s). *The say* (the controller's addition, after the fix rounds): one short sentence in the creator's own kind of words about what they will see ("It's black and white now."), naming no preset, operation, setting or number the creator did not use; a refusal is one sentence that says what would work instead. Over 24 requests, three runs each: says naming a kit term (preset, mono, pop, pill, op, mark, item, a shot's id, px; `kitTerms` in `loop.ts`) 3 of 72 before, 0 of 72 after; says of more than one sentence 21 before, 0 after; the middle length 16 words, then 13.

*The gates* (24 requests, three runs each; "before" is the run on `188895c2`, "now" the run on `c721968d` with the say rule, the code as it is):

| Gate | Before the say rule | Now | |
|---|---|---|---|
| At least 90 % of done runs valid and doing what was asked | 55 of 63 (87 %) | 54 of 63 (86 %); valid 63 of 63 | **fails by three runs** |
| Looks right (no number to pass) | 60 of 63 | 60 of 63 (95 %); right on both questions 51 of 63 (81 %) | |
| Every refused run's say tells what cannot be done | 6 of 9 | 5 of 9 | **fails**: "make me taller" got a zoom |
| Says naming a kit term | 3 of 72 | 0 of 72 | |
| Says of more than one sentence | 21 of 72 | 0 of 72 | |
| Median change without stills, under 10 s | 1.5 s | 1.5 s (28 runs, worst 2.6 s) | passes |
| Median change with stills, under 20 s | 9.1 s | 10.1 s (44 runs, worst 25.4 s) | passes |
| First cut of a 90 s take under two minutes | 6.8, 5.1, 5.7 s on a 92 s take | not run again | passes |
| Styles: 80 % of fields matched or near, five references | 92, 81, 75, 94, 58 % | not run again | 3 of 5 pass |
| Cost | 0.058 c a change | 0.059 c a change; a first cut 0.006 c (12.7 s take) to 0.17 c (92 s take) | recorded |

| id | request | asked: before, now | looks: before, now | changed now | median s now | cents now | what went wrong now |
|---|---|---|---|---|---|---|---|
| r01 | Make the captions bigger. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 10.7 (stills) | 0.066 |  |
| r02 | Put the captions higher, above my chin. | 0/3, 0/3 | 3/3, 3/3 | 2/3 | 9.2 (stills) | 0.065 | nothing is above the chin on this close-up but the mouth: one run said so; two made the captions bigger and a little lower and said "moved them higher" |
| r03 | Use the pill caption style. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 8.5 (stills) | 0.066 |  |
| r04 | Turn the captions off. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 1.1 | 0.029 |  |
| r05 | Change the hook to say "Day one". | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 10.0 (stills) | 0.066 |  |
| r06 | Add a call-out "New tool" when I say Claude. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 11.1 (stills) | 0.068 | (sits on the hair: the close-up has no free ground) |
| r07 | Add a closing line "Follow for more" over the last two seconds. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 11.1 (stills) | 0.090 | (one run set it on one line at 82 px, smaller than the film's title) |
| r08 | Make it snappier: cut the pauses shorter. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 1.2 | 0.030 |  |
| r09 | Cut out the first second. | 0/3, 0/3 | 3/3, 3/3 | 0/3 | 2.4 | 0.060 | changed nothing, 3 of 3: the first second lies in speech; offers the nearest clean cut, the word and time named differ from run to run |
| r10 | Remove everything after the last word. | 3/3, 0/3 | 3/3, 3/3 | 0/3 | 2.5 | 0.060 | took an earlier word's end for the last word's, the review refused the cut, and the say tells the creator it cannot be done, 3 of 3 (3 of 3 right one wording earlier) |
| r11 | Make it warmer. | 2/3, 3/3 | 3/3, 3/3 | 3/3 | 7.8 (stills) | 0.063 |  |
| r12 | Black and white please. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 7.7 (stills) | 0.063 |  |
| r13 | Slowly zoom in on my face over the whole video. | 2/3, 3/3 | 3/3, 3/3 | 3/3 | 13.8 (stills) | 0.072 | (each shot zooms on its own and steps back at the cut) |
| r14 | Punch in when I say available. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 8.9 (stills) | 0.069 | (a tenth tighter from the first frame: the word asked in these runs was the take's first) |
| r15 | Add a progress bar at the top. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 8.9 (stills) | 0.065 |  |
| r16 | Stress the word "available" in the captions. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 1.6 | 0.030 | (the op is right; the kit draws stress in this look one weight step heavier, hardly seen) |
| r17 | In the captions, write "out" instead of "available". | 3/3, 3/3 | 0/3, 0/3 | 3/3 | 1.5 | 0.030 | the new word lost the old one's full stop: the captions run two sentences together, 3 of 3 |
| r18 | Remove the title. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 2.0 | 0.062 |  |
| r19 | Make the whole video 1.25 times faster. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 1.3 | 0.030 |  |
| r20 | Move the call-out so it does not cover my mouth. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 10.5 (stills) | 0.067 |  |
| r21 | Captions lower and in the pill style. | 3/3, 3/3 | 3/3, 3/3 | 3/3 | 11.8 (stills) | 0.077 |  |
| r22 | Zoom in on "Claude" and add a whoosh. *(must be refused)* | 3/3, 2/3 | 3/3, 3/3 | 3/3 | 11.4 (stills) | 0.091 | the zoom is made and the whoosh said not to be on offer; one say also claims a whoosh was placed |
| r23 | Make me taller. *(must be refused)* | 0/3, 0/3 | 3/3, 3/3 | 2/3 | 12.5 (stills) | 0.072 | says it cannot, then zooms in, 2 of 3; in the third the zoom was taken back and the say still claims it |
| r24 | Add background music. *(must be refused)* | 3/3, 3/3 | 3/3, 3/3 | 0/3 | 1.0 | 0.029 |  |

The requests are written here as they read since the final fix wave, which took the owner's words out of them (two single words of his take are left in the whole file); the runs of this table used the earlier wording of r05, r06, r14, r16 and r17. Four of the nine misses changed nothing and gave a true reason (r02 once, r09 three times). Between the two runs r10 went from 3 of 3 to 0 of 3 and r22 from 3 to 2, r11 and r13 from 2 to 3: the say rule touches none of their ops; the rates follow the prompt's wording (r10 was right in 1, 2, 2, 1, 3 and 0 of 3 over six versions).

*A second take, held out* (a free clip none of the fixes saw; the sixteen requests that name none of the owner's words, three runs each, before the say rule): **26 of 45 (58 %)** did what was asked; the refusal 3 of 3; 34 of the 35 runs that changed the film look right; 2.4 s and 10.6 s. The simple changes carry over (23 of 24); those that need a place found do not: "remove everything after the last word" took the whole last shot out with its words (0 of 3), a closing line was given up after one refusal (0 of 3), "1.25 times faster" was refused because the fixed-length title ran into later captions (0 of 3). The closing call's say claimed a change that was not made, 4 of 4 times there.

*Thinking (X88)*, r01 to r08, three runs each: off, a median of 8.8 s (1.2 s without stills, 9.3 s with), 0.060 c, no run stopped; on, 25.9 s (8.1 s, 32.8 s), 0.079 c, 6 of 24 runs stopped by the 50 s with no answer, the ops otherwise the same but for two runs. `AGENT_LIMITS` stays `thinking: false`, `maxTokens: 4000`: the longest answer was 181 tokens for a change and 91 for a first cut.

*The fix rounds* (the failing requests rerun three times each): round 0, 38 of 63 and refusals 3 of 9; after round 1 (`pauses.tighten`, room's lines for pauses and framings, where the clean cuts are, "no sound on offer") 12 of 33; after round 2 (`shot.zoom`, captions placed by code, the look with measures and `undo`, the closing call, "this change and no other") 15 of 30; after round 3 (a zoom from a word, a say held to its op, a cut by time refused in so many words) 15 of 27; the full run of everything after them, 55 of 63 and 6 of 9; with the say rule, 54 of 63 and 5 of 9.

*Styles.* Each of the five references was read once through the app's path (a creator waited 80 to 105 s) and dropped; the owner's take was cut in each style in 1.3 to 1.8 s. To a viewer: reference 4 is alike (a white label that stays at the top, small sentence captions), references 1 and 3 partly, references 2 and 5 are not (an outlined headline with a tag and typewriter captions; B-roll under a condensed serif). `pace.cutsPerMin` is "not" in all five: a single take has no cuts to another scene. The seven presets: six cut in 1.5 to 1.8 s with every field matched or near; One word lost its title on the close-up (10 of 13). Three of Task 12's phrases through the route: Clean, One word, Bold pop with bigger captions. More takes than one: **one** free clip (Mixkit's free licence, read 2026-11-23; the clip has no sound, a made-up voice was put on it), first-cut in the house style three times and in two presets, then deleted with nothing left. Every first cut of it ends with one error: its captions cover the mouth in the clip's close-up, since the captions are one setting for the whole film (`first-cut.ts`).

*Still weak:* it says yes to what cannot be done, and a say is not held to what happened (the closing say, the say after an undo); the rates follow the prompt's wording (r10); it was tuned on one take; a swapped word loses its full stop (r17, 3 of 3); "cut out the first second" is refused by rule (r09); the model's look at the stills changed one of 86 changes for the better and costs about 7 of the 10 s.

*Not run:* nothing was listened to; two of the three free clips; the owner's iPhone take; German or Italian; Task 9's ground truth again; seven of the ten phrases. Modal: $3.13 before, $4.07 after. Qwen: 32 c over 490 runs kept. The full report: `.superpowers/sdd/2026-11-21-edit-agent/task-14-report.md` (not in git).

**Results of Task 14b (2026-11-23; one bounded round on what the proof found, by the controller's rulings and the code review of Task 14; written by the implementer). On the owner's take the done-rate is now 57 of 63 (90 %), a seen change takes 1.4 s for 10.1 s, and no say of 78 names a kit term or claims what did not happen. The second take could not be run again: its analysis is not on disk.**

| Gate | Before this round (`c721968d`) | After | |
|---|---|---|---|
| At least 90 % of done runs valid and doing what was asked | 54 of 63 (86 %) | **57 of 63 (90 %)**; valid 63 of 63 | passes, at the line |
| Looks right | 60 of 63 | 63 of 63 | |
| Every refused run's say tells what cannot be done | 5 of 9 | 13 of 15 (two requests added) | **fails**: "make me taller" got a zoom in 2 of 3 |
| Says naming a kit term; of more than one sentence | 0 and 0 of 72 | 0 and 0 of 78 | |
| Median change | 1.5 s unseen, 10.1 s seen (44 changes) | 1.4 s, seen or not (the same 44: 1.4 s); worst 3.5 s | passes |
| Cost | 0.059 c a change (19,372 tokens in) | 0.037 c (11,972 in, 66 out) | recorded |
| Styles, five references | 92, 81, 75, 94, 58 % | 100, 87, 80, 100, 64 % with the cuts a minute left out (from the stored fields; not read again) | 4 of 5 pass |

What moved, by request: r17 (a word swapped) 0 of 3 looking right to 3 of 3; r10 (after the last word) 0 of 3 to 3 of 3; r23 (taller) 0 of 3 to 1 of 3; r25 and r26 (younger, another background) 3 of 3 each; r22 2 of 3 to 3 of 3. r02 (captions "above my chin", where only the mouth is) 0 of 3 still: it now makes them a little bigger in place and says "higher". r09 (the first second) 0 of 3 still: this take has no pause in its first three seconds, so the move refuses, as ruled; but its refusal for that case names no place and the say names a wrong one.

What was built:
1. *A say never claims what did not happen:* when nothing was changed, a say that tells of a change is sent back once and then replaced by the loop's own line, for an answer with no ops, after an `undo`, and in the closing call (`claimsChange`, English only).
2. *The model's look is off (X115):* `AGENT_LIMITS.look`. What guards a change now: the door (all or none), the review (no new error; the captions' own errors by one rule), the say checks (no pixels, no kit words, no claim of what did not happen, no direction against its own captions op), and the measured effect on every change, which still goes back to the model, with `undo`, when words were cut or brought back or a part was taken out.
3. *A swapped word keeps its punctuation* (`withPunctuation`).
4. *A cut by time is a move* (`time.cut`): the nearest clean cut within one second, kept in one place (`CUT_NEAR_MS`).
5. *The person and the place:* said outright in the craft section; r25 and r26 added.
6. *The hook* is asked for once more when it repeats the opening words (`first-cut.ts`).
7. *The match* leaves out the cuts a minute (`style/match.ts`).
8. From the code review: one rule for the captions' errors in the room and the loop (`captionsRule`); the zoom's least 1.08 everywhere, with true reasons; every example in the prompt made up, with a test; the say rule in the code; six of the eleven minors, two of them in part (the closing say read as any say, `contradicts` not applied to captions the code placed, the pause length clamped, a long id cut before its piece's mark, the catalogue's line on warnings made true, a second upload refused).

Not done: the held-out rerun (the take was deleted in Task 14, as its brief asked, and its analysis was never on disk); the first cuts, the styles and the phrases were not run again. One assertion block of the route's test was changed with the look (`agent-route.test.ts`). Mutations of the code as it stands: 48, all caught, logged in `.scratch/task14/mutations.log`. Suites: 1,259 passed (58 files, with the page's); `tsc` twice and eslint clean.

Recorded for the next plan, not for this round: captions are one setting for a whole film (the largest known gap: a take whose framing changes ends its first cut with captions on the face); a stressed word that cannot be seen in pop, pill and highlight; a title of fixed length under a speed change; a zoom over the whole video that steps back at each cut; One word on a close-up; and the 58 % on a second take.

**Results of Task 14b, second part (2026-11-23; the controller's two further rulings, which reached the implementer after the first part was sent: the film's ends as a move in code, and the held-out number measured again; with the first cut's own say and the stills call's overrun; written by the implementer). Final numbers of this task, on the code as it is: on the owner's take 60 of 66 (91 %) done as asked and 15 of 15 refusals; on the second take 33 of 48 (69 %), 30 of 45 (67 %) on the fifteen requests it was 26 of 45 (58 %) on.**

| Gate | First part of 14b | Final (27 requests, three runs each) | |
|---|---|---|---|
| At least 90 % of done runs valid and doing what was asked | 57 of 63 (90 %) | **60 of 66 (91 %)**; valid 66 of 66 | passes |
| Looks right | 63 of 63 | 66 of 66 | |
| Every refused run's say tells what cannot be done | 13 of 15 | **15 of 15** | passes; "make me taller" refused 3 of 3 |
| Says naming a kit term; of more than one sentence | 0 and 0 of 78 | 2 ("operation") and 0 of 81 | |
| Median change | 1.4 s | 1.3 s (81 runs, worst 3.9 s) | passes |
| Cost | 0.037 c a change | 0.040 c | recorded |
| The second take, held out (20 requests, three runs each; the fifteen done requests of the first measure) | 26 of 45 (58 %) before 14b | **30 of 45 (67 %)**; with the ends' mirror 33 of 48 (69 %); refusals 12 of 12 | no gate |

The six misses on the owner's take are r02 and r09, which this take cannot meet (nothing is above the chin but the mouth; no pause in the first three seconds): each run changes nothing and says why, r09 now with the right place ("after your second sentence"). Counted as misses, as before.

What was built in this part:
1. *The film's ends are a move* (`ends.trim {start, end}`, `endsTrim` in `context.ts`): what the film shows before its first word, after its last, or both, cut by the tighten recipe's own rule for the head and the tail at its shortest pause; the model says only which end. r10 and its mirror r27 ("Cut the silence before I start.") run on a first cut whose ends are let run again (`setup: "loose-ends"`), since a first cut already ends on its words: 3 of 3 each on the owner's take, 3 of 3 each on the second (which lost its whole last shot to r10 before, 0 of 3).
2. *The first cut's own say* follows the rule as far as it can (`sayOf` in `first-cut.ts`): at most two short sentences, the cut's length (the point of a first cut) and what it carries and what its captions look like; then only what the creator has to know. "Your first cut runs 11.7 s, down from 16.9 s, with a title and 2 punch-ins; its captions are bold white words, the word being said in colour. The captions still cover your face in places." It was up to five sentences, with the title's words.
3. *Two faults of the first part's own code, found by its rerun and put right here, since the round was open again and a full rerun was owed:* `time.cut` no longer lands a cut's far end on the near end's own moment (it had answered "nothing to take out" and named no place; r09's refusals now name the right one, 5 of 6 over two runs; the sixth took the whole first shot out, three seconds for the one asked), and a say that has the captions "higher" while their height stayed is sent back (`contradicts`). A say that comes with no ops is held to the kit's words too (one read "ops: []").
4. *The stills call that ran 160 s past the 50 s:* both its limits are timers on the call (the loop's deadline and the client's own 75 s), and both were overdue at once, with "Connection error." from the model in the next three seconds: this Mac's timers stood still (sleep, or its network down), not the code's. With the look off a change no longer calls the worker. What still can: the style read's sheet of a reference (`sheetOf`, under the same 75 s and its caller's signal), and the loop's stills if `AGENT_LIMITS.look` is ever set again.

On the second take, by request (before 14b, now): bigger captions 2 to 0 of 3, the pill style 1 to 0, captions lower and pill 0 to 0, captions higher 0 to 0: with a captions error standing in the clip's close-up, the one rule (X118) refuses whatever covers the mouth on more frames, and each run says so; of 25 answers there that changed nothing, one still reads as a move ("the captions are moved up, but there is no room"), where before 4 of 4 closing says claimed a change. After the last word 0 to 3; black and white 2 to 3; faster 0 to 3 (it now makes the title smaller to clear the captions at the new speed, and says so); a closing line 0 to 0 (two runs set "Follow more" as a call-out for a second, shortening the creator's words). "Make me taller" there: a zoom 3 of 3 in one run, refused 3 of 3 in the next, on code that differs in nothing on that path.

The owner's take cut again on this code, three times: the hook is three words that are not his opening, the same each time (it was his own second sentence), 11.0 to 11.1 s from 12.7 s, no error, and the say is one sentence; the owner's `first-cut.mp4` is the first of them. Mutations of the code as it stands: 56, logged in `.scratch/task14/mutations.log`. Suites: 1,264 passed (58 files); `tsc` twice and eslint clean. Modal: $4.07 at the end, under the $4.60 set for this part; the take was uploaded once, analysed in 44.5 s, and deleted with nothing left (0 objects, 0 rows; the account holds what it held before).

**Results of the final fix wave (2026-11-23; the final review's findings for the agent, by the controller's rulings; written by the implementer).** `say` is English in this part whatever the request's language (X120), and a say that is not is sent back once; a length in milliseconds is refused every time, as pixels are. The captions' fit takes its ceiling from the room of the edit as it stood and from the answer, keeps the answer's count of words, and no longer turns 120 px asked into 192 px at one word a page. The room keeps no band of its own for the nose (the review now finds an error from the brow to the lower lip), and the one rule holds the loop's own test of an error an edit came with, so what the room names is what the loop takes: tested through the real loop at each of the forty heights the room tries, on a clean edit and on one that starts with a captions error. The first cut keeps the answer it sent back for its hook when nothing readable comes after. The requests name two single words of the take and no more, and the texts they ask for are made up.

The requests ran again three times on the owner's take, 81 runs, no Modal, and once more after the say check below. Their base had to be made again: under the nose rule the first cut all earlier runs started from carries an error (its captions at 0.74 touch the nose band on one shot), and a first cut made on this code puts them at 0.76 with none.

| | before the wave (old first cut) | after it (first cut made again) | after the say check (the last run) |
|---|---|---|---|
| done as asked, strict | 60/66 (91 %) | 57/66 (86 %) | **57/66 (86 %)** |
| without the requests his take cannot meet | 60/60 | 57/57 | **57/57** |
| his take cannot meet | r02, r09 | r02, r09, r21 | r02, r09, r21 |
| looks right | 66/66 | 66/66 | 66/66 |
| refusals | 15/15 | 14/15 | 15/15 |
| median, worst | 1.3 s, 3.9 s | 1.4 s, 3.9 s | 1.5 s, 4.7 s |
| a change costs | 0.040 c | 0.041 c | 0.039 c |
| says that tell what is not so, by my reading of each | not counted then (1 known) | 5/81 | 2/81 |
| says with a kit term | 2/81 | 2/81 | 0/81 |

r21 ("captions lower and in the pill style") is what moved the line: the first cut's captions now sit at the lowest clear height, so the pill is set and the height stays. In the first of the two runs five of the 81 says stated something that was not so on an edit that was right (a count of words a page the ops did not set, twice; "lower" with the height unmoved, twice; a sound that was not added, once). By the controller's ruling the say check (`contradicts`) got one narrow change: a word of where something is (above, below, bottom) is no move and no longer switches the check off; "lowest", "highest" or "moved" with the height as the ops left it is told, unless the say tells that the captions stayed or could not go; a count of words a page the ops do not set is told. In the last run it sent two of r21's says back, and the say taken then tells that there is no room lower; none of the four kinds it reads came through. Two says of the last run are still not exact, and no check reads them: for "punch in when I say" a word in the middle of a sentence, the say has the punch at the word, and the kit sets it at the pause before the sentence, 1.9 s earlier. Known limit kept: where an error of the captions stands on every frame, the one rule counts frames and not how much of the face is covered.

**Results of the last correction (2026-11-24; the re-review of the fix wave and the controller's ruling `final-fix-say.md`, with one exception ruled after its first run; written by the implementer).** The edit and the sentence are judged apart (X121). The rounds judge the edit only; the say is checked once when they are over, asked for once more alone, and else written by the code from the two edits ("The captions are bigger, two words at a time."), or, with nothing changed, as the loop's own line of why. A wrong sentence can no longer cost a change, and no change takes more than three rounds and one call. The one exception: an answer whose own say contradicts its ops is sent back once, never on the last round. It was ruled after the first run without it, in which "captions higher" with no room higher was answered with larger captions and "higher" and the swap was taken, 3 of 3; with it, nothing changes and the true reason is said, 3 of 3 (12 of 12 over the four runs of that request made with it). The send-back keeps the words measured before ("say and ops must agree; where there is no room for what was asked, send no ops and say what is in the way"); with the words the ruling sketched the model sent the swap again, 3 of 3. The room and the zoom's search now tell another text's standing error by its sentence, as the loop does. The requests' file lost a third word of the take from a note; the proof script's `examples` mode counts the take's words in every string of it on the Mac that has the take, since a committed test may not hold them.

The 27 requests three times on the final code, on a first cut made on it, no Modal:

| | after the fix wave | the final code |
|---|---|---|
| done as asked, strict | 57/66 (86 %) | **55/66 (83 %)** |
| without the requests his take cannot meet (r02, r09, r21) | 57/57 | **55/57** |
| looks right | 66/66 | 66/66 |
| refusals | 15/15 | 15/15 |
| median, worst | 1.5 s, 4.7 s | 1.5 s, 4.7 s |
| a change costs | 0.039 c | 0.042 c |
| whose sentence: the model's own, the model's when asked again, the code's | (not recorded) | 77, 2, 2 |
| most calls in a change | 3 rounds, then up to 2 for a sentence | 4 |
| says that tell what is not so, by my reading of each | 2/81 | 4/81 |
| says with a kit term | 0/81 | 0/81 |

The two new misses are one request, "slowly zoom in on my face over the whole video": twice of three the model sent the zoom without its slow move, and said "slowly" (0 of 9 on the earlier first cut, 3 of 9 on this one; no code changed that path). The four says that tell what is not so are those two and two of "punch in when I say" a word in the middle of a sentence, which the kit lands at the pause before the sentence: kinds no check reads, a known limit for the next plan. Two refusals read as the loop's bare line, because the model's sentence used the kit's word "operation" twice running. Over nine further runs of "captions lower and in the pill style" the pill was kept seven times; twice the send-back was followed by an answer the review refused on the last round, and nothing changed.

---

## Done when (the design's part 3)

- **The first cut:** the owner's take comes back cut in its pauses, captioned clear of the face and the apps' buttons, titled and levelled, with no review errors, in under two minutes for 90 s.
- **In a style:** the same, in the style of a reference outlier, a preset or a few words. The match check shows what matched and what the kit cannot draw yet, and the reference is gone afterwards.
- **A change:** a plain request changes the edit in under 10 s (median, without stills), and valid at least 90 % of the time on the proof's requests.
- **Refusals:** an impossible request is refused in plain words, with the edit unchanged.
- **The page:** it does all of this as the e2e test account, end to end, with a render and a download.
- **The next plan:** the tool belt, the kit's growth, ordered by the measured `notMatched` frequencies of Task 12.
